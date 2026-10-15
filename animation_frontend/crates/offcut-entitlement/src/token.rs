//! The wire form of a token (D-25): `base64url(JSON claims) "."
//! base64url(signature)`, both without padding. The signature covers the
//! ASCII bytes of the first segment, so no rule for writing JSON is needed.

use base64::Engine as _;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;

use crate::TokenError;
use crate::claims::{CLAIMS_VERSION, EntitlementClaims};

/// A longer token is refused before a byte of it is decoded (D-60).
pub const MAX_TOKEN_CHARS: usize = 2_048;
const SIGNATURE_BYTES: usize = 64;

/// A token taken apart. Nothing here says that the signature is good.
/// It has no `Debug`: a token is never written into a message.
#[derive(Clone, PartialEq)]
pub struct ParsedToken<'a> {
    /// The bytes the signature covers: the first segment as it was sent.
    pub signed: &'a [u8],
    pub signature: [u8; SIGNATURE_BYTES],
    pub claims: EntitlementClaims,
}

pub fn decode(token: &str) -> Result<ParsedToken<'_>, TokenError> {
    // A character is at most four bytes, so the count below reads a bounded
    // number of bytes however long the input is.
    let too_long =
        token.len() > MAX_TOKEN_CHARS.saturating_mul(4) || token.chars().count() > MAX_TOKEN_CHARS;
    if too_long {
        return Err(TokenError::Format);
    }
    let (payload, signature) = token.split_once('.').ok_or(TokenError::Format)?;
    if payload.is_empty() || signature.is_empty() || signature.contains('.') {
        return Err(TokenError::Format);
    }

    let json = URL_SAFE_NO_PAD
        .decode(payload)
        .map_err(|_| TokenError::Base64)?;
    let signature: [u8; SIGNATURE_BYTES] = URL_SAFE_NO_PAD
        .decode(signature)
        .map_err(|_| TokenError::Base64)?
        .try_into()
        .map_err(|_| TokenError::Base64)?;

    // The claims are a JSON object with their field names (D-25). The reader
    // would also take a list of the seven values in order; no signer writes one.
    if json.first() != Some(&b'{') {
        return Err(TokenError::Json);
    }
    let claims: EntitlementClaims = serde_json::from_slice(&json).map_err(|_| TokenError::Json)?;
    if claims.v != CLAIMS_VERSION {
        return Err(TokenError::Version);
    }
    Ok(ParsedToken {
        signed: payload.as_bytes(),
        signature,
        claims,
    })
}

/// The first segment of a token of these claims: what is signed.
pub fn signing_input(claims: &EntitlementClaims) -> String {
    // The claims are numbers and short strings: writing them cannot fail.
    let json = serde_json::to_vec(claims).unwrap_or_default();
    URL_SAFE_NO_PAD.encode(json)
}

/// The token of these claims with this signature. Used by tests now, and by
/// the signer of V6.
pub fn encode(claims: &EntitlementClaims, signature: &[u8; SIGNATURE_BYTES]) -> String {
    let mut token = signing_input(claims);
    token.push('.');
    token.push_str(&URL_SAFE_NO_PAD.encode(signature));
    token
}

#[cfg(test)]
mod tests {
    use offcut_types::Plan;

    use super::*;
    use crate::testing::{TOKEN, claims};

    /// A token of this JSON with a signature of 64 zero bytes. `decode` does
    /// not look at what the signature says.
    fn token_of(json: &str) -> String {
        let signature = URL_SAFE_NO_PAD.encode([0u8; SIGNATURE_BYTES]);
        format!("{}.{signature}", URL_SAFE_NO_PAD.encode(json))
    }

    const CLAIMS_JSON: &str = concat!(
        r#"{"v":1,"sub":"0190f3a2-7b1c-7def-8a55-0123456789ab","plan":"creator","#,
        r#""free_exports_remaining":3,"period_end":1762592000,"iat":1760000000,"exp":1760604800}"#,
    );

    #[test]
    fn what_is_not_two_segments_of_unpadded_base64url_is_refused() {
        let (payload, signature) = TOKEN.split_once('.').unwrap();
        let refused = |token: &str| decode(token).err().unwrap();

        // Not exactly two segments with something in each.
        for token in ["", "abc", "a.b.c", ".sig", "abc.", ".", ".."] {
            assert_eq!(refused(token), TokenError::Format, "{token:?}");
        }
        assert_eq!(refused(&format!("{TOKEN}.")), TokenError::Format);
        assert_eq!(
            refused(&format!("{payload}.{signature}.{signature}")),
            TokenError::Format
        );

        // Padding; the other alphabet; a character of neither; a length base64 cannot have.
        assert_eq!(
            refused(&format!("{payload}=.{signature}")),
            TokenError::Base64
        );
        assert_eq!(
            refused(&format!("{payload}.{signature}==")),
            TokenError::Base64
        );
        assert_eq!(
            refused(&format!("{payload}.{}", signature.replace('-', "+"))),
            TokenError::Base64
        );
        assert_eq!(
            refused(&format!("{payload}.{}", signature.replace('_', "/"))),
            TokenError::Base64
        );
        assert_eq!(
            refused(&format!("{payload} .{signature}")),
            TokenError::Base64
        );
        assert_eq!(
            refused(&format!("{payload}AAA.{signature}")),
            TokenError::Base64
        );
        // A signature that is base64url and not 64 bytes: 63, 65, and 3.
        let long = URL_SAFE_NO_PAD.encode([0u8; 65]);
        let short = URL_SAFE_NO_PAD.encode([0u8; 63]);
        assert_eq!(refused(&format!("{payload}.{long}")), TokenError::Base64);
        assert_eq!(refused(&format!("{payload}.{short}")), TokenError::Base64);
        assert_eq!(refused("abcd.abcd"), TokenError::Base64);

        // Longer than 2,048 characters is refused before anything is decoded:
        // what follows would be a base64 fault at 2,048.
        let at_limit = format!(
            "{}.{signature}",
            "!".repeat(MAX_TOKEN_CHARS - 1 - signature.len())
        );
        assert_eq!(at_limit.chars().count(), MAX_TOKEN_CHARS);
        assert_eq!(refused(&at_limit), TokenError::Base64);
        assert_eq!(refused(&format!("!{at_limit}")), TokenError::Format);
        assert_eq!(
            refused(&"é".repeat(MAX_TOKEN_CHARS + 1)),
            TokenError::Format
        );
        assert_eq!(refused(&"a".repeat(1_000_000)), TokenError::Format);
    }

    #[test]
    fn a_payload_with_an_extra_field_is_not_the_claims_and_v_2_is_another_version() {
        // The JSON above is the claims: it is what the token of the tests holds.
        let unsigned = token_of(CLAIMS_JSON);
        let parsed = decode(&unsigned).unwrap();
        assert_eq!(parsed.claims, claims(Plan::Creator, 3));
        assert_eq!(parsed.signature, [0u8; SIGNATURE_BYTES]);

        let refused = |json: &str| decode(&token_of(json)).err().unwrap();
        let extra = CLAIMS_JSON.replace(r#"{"v":1,"#, r#"{"v":1,"admin":true,"#);
        assert_eq!(refused(&extra), TokenError::Json);
        assert_eq!(
            refused(&CLAIMS_JSON.replace(r#""v":1"#, r#""v":2"#)),
            TokenError::Version
        );
        assert_eq!(
            refused(&CLAIMS_JSON.replace(r#""v":1"#, r#""v":0"#)),
            TokenError::Version
        );

        // A missing field, a wrong type, a plan and a user id that are none.
        for (from, to) in [
            (r#","exp":1760604800"#, ""),
            (r#""iat":1760000000"#, r#""iat":"1760000000""#),
            (r#""v":1"#, r#""v":256"#),
            (r#""plan":"creator""#, r#""plan":"pro""#),
            (r#""plan":"creator""#, r#""plan":"Creator""#),
            (
                r#""free_exports_remaining":3"#,
                r#""free_exports_remaining":-1"#,
            ),
            ("0190f3a2-7b1c-7def-8a55-0123456789ab", "nobody"),
        ] {
            let json = CLAIMS_JSON.replace(from, to);
            assert_ne!(json, CLAIMS_JSON);
            assert_eq!(refused(&json), TokenError::Json, "{json}");
        }
        for json in ["null", "[]", "{}", "1", "{\"v\":1}", "not json"] {
            assert_eq!(refused(json), TokenError::Json, "{json}");
        }
        // The seven values in order, without their names, are not the claims.
        let list = r#"[1,"0190f3a2-7b1c-7def-8a55-0123456789ab","creator",3,1762592000,1760000000,1760604800]"#;
        assert_eq!(refused(list), TokenError::Json);
        assert_eq!(refused(&format!(" {CLAIMS_JSON}")), TokenError::Json);

        // Written and read again, claims are the same claims, and the token
        // of the tests is exactly what this crate writes for them (D-25).
        let (payload, signature) = TOKEN.split_once('.').unwrap();
        let fixed = claims(Plan::Creator, 3);
        assert_eq!(signing_input(&fixed), payload);
        let signed = decode(TOKEN).unwrap();
        assert_eq!(signed.signed, payload.as_bytes());
        assert_eq!(encode(&fixed, &signed.signature), TOKEN);
        assert_eq!(URL_SAFE_NO_PAD.encode(signed.signature), signature);
        assert_eq!(
            decode(&encode(&fixed, &[7u8; SIGNATURE_BYTES]))
                .unwrap()
                .claims,
            fixed
        );
    }
}
