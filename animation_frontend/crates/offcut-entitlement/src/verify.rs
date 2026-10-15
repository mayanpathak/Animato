//! Whether a token was signed by a key we trust.

use ed25519_dalek::{Signature, VerifyingKey};

use crate::TokenError;
use crate::claims::EntitlementClaims;
use crate::token::decode;

/// The claims of `token`, when one of `public_keys` verifies its signature.
/// The keys are tried in order; one that is not a valid Ed25519 key is
/// passed over. Whether the claims have run out is not looked at here:
/// `export_profile` does that, with the time its caller gives it.
pub fn verify_token(
    token: &str,
    public_keys: &[[u8; 32]],
) -> Result<EntitlementClaims, TokenError> {
    let parsed = decode(token)?;
    let signature = Signature::from_bytes(&parsed.signature);
    let verified = public_keys
        .iter()
        .filter_map(|bytes| VerifyingKey::from_bytes(bytes).ok())
        .any(|key| key.verify_strict(parsed.signed, &signature).is_ok());
    if verified {
        Ok(parsed.claims)
    } else {
        Err(TokenError::Signature)
    }
}

#[cfg(test)]
mod tests {
    use offcut_types::Plan;

    use super::*;
    use crate::testing::{FREE_TOKEN, OTHER_KEY, PUBLIC_KEY, TOKEN, claims};

    /// Bytes that are not an Ed25519 key.
    fn no_key() -> [u8; 32] {
        (2u8..=255)
            .map(|first| {
                let mut bytes = [0u8; 32];
                bytes[0] = first;
                bytes
            })
            .find(|bytes| VerifyingKey::from_bytes(bytes).is_err())
            .unwrap()
    }

    #[test]
    fn a_token_minted_in_typescript_verifies_with_the_test_public_key() {
        assert_eq!(
            verify_token(TOKEN, &[PUBLIC_KEY]),
            Ok(claims(Plan::Creator, 3))
        );
        assert_eq!(
            verify_token(FREE_TOKEN, &[PUBLIC_KEY]),
            Ok(claims(Plan::Free, 2))
        );
    }

    #[test]
    fn the_token_with_one_payload_character_changed_has_no_good_signature() {
        // "000" becomes "001" inside the time of issue: still base64url, still the claims.
        let (payload, signature) = TOKEN.split_once('.').unwrap();
        let changed = payload.replacen("MDAw", "MDAx", 1);
        let differing = payload
            .chars()
            .zip(changed.chars())
            .filter(|(a, b)| a != b)
            .count();
        assert_eq!((differing, changed.len()), (1, payload.len()));
        let token = format!("{changed}.{signature}");
        assert!(crate::token::decode(&token).is_ok());
        assert_eq!(
            verify_token(&token, &[PUBLIC_KEY]),
            Err(TokenError::Signature)
        );

        // One character of the signature changed; the signature of another token.
        let other = signature.replacen('r', "s", 1);
        assert_eq!(
            verify_token(&format!("{payload}.{other}"), &[PUBLIC_KEY]),
            Err(TokenError::Signature)
        );
        let (_, free_signature) = FREE_TOKEN.split_once('.').unwrap();
        let swapped = format!("{payload}.{free_signature}");
        assert_eq!(
            verify_token(&swapped, &[PUBLIC_KEY]),
            Err(TokenError::Signature)
        );
        // A token that cannot be read is refused for that, whatever the keys.
        assert_eq!(verify_token("abc", &[PUBLIC_KEY]), Err(TokenError::Format));
    }

    #[test]
    fn another_key_does_not_verify_and_the_right_key_after_a_wrong_one_does() {
        assert_eq!(
            verify_token(TOKEN, &[OTHER_KEY]),
            Err(TokenError::Signature)
        );
        assert_eq!(verify_token(TOKEN, &[]), Err(TokenError::Signature));
        assert_eq!(
            verify_token(TOKEN, &[OTHER_KEY, PUBLIC_KEY]),
            Ok(claims(Plan::Creator, 3))
        );
        assert_eq!(
            verify_token(TOKEN, &[PUBLIC_KEY, OTHER_KEY]),
            Ok(claims(Plan::Creator, 3))
        );

        // Bytes that are no key are passed over, wherever they stand.
        let no_key = no_key();
        assert_eq!(verify_token(TOKEN, &[no_key]), Err(TokenError::Signature));
        assert_eq!(
            verify_token(TOKEN, &[no_key, PUBLIC_KEY]),
            Ok(claims(Plan::Creator, 3))
        );
        assert_eq!(
            verify_token(TOKEN, &[[0u8; 32], PUBLIC_KEY]),
            Ok(claims(Plan::Creator, 3))
        );
        assert_eq!(
            verify_token(TOKEN, &[[0u8; 32], no_key]),
            Err(TokenError::Signature)
        );
    }
}
