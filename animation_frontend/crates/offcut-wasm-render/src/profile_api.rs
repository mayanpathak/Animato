//! The exports of `offcut-entitlement`: from a token to the profile an export
//! is made with. The token goes to `verify_token` and nowhere else: it is in
//! no error, no message and no value this file returns.

use js_sys::{Array, Uint8Array};
use offcut_entitlement::{TokenError, export_profile, verify_token};
use offcut_types::{ErrorCode, UnixSecs};
use wasm_bindgen::prelude::wasm_bindgen;
use wasm_bindgen::{JsCast, JsValue};

use crate::{failure, to_js, to_plain};

const KEY_BYTES: u32 = 32;

/// The variant's name: the `detail` of a failure.
fn token_error_name(error: TokenError) -> &'static str {
    match error {
        TokenError::Format => "Format",
        TokenError::Base64 => "Base64",
        TokenError::Json => "Json",
        TokenError::Version => "Version",
        TokenError::Signature => "Signature",
    }
}

/// The keys of the list that are 32-byte `Uint8Array`s. Anything else in the
/// list is passed over.
fn keys(public_keys: &Array) -> Vec<[u8; 32]> {
    public_keys
        .iter()
        .filter_map(|entry| entry.dyn_into::<Uint8Array>().ok())
        .filter(|bytes| bytes.length() == KEY_BYTES)
        .map(|bytes| {
            let mut key = [0u8; 32];
            bytes.copy_to(&mut key);
            key
        })
        .collect()
}

/// The `ExportProfile` of a token that one of `public_keys` verifies, at the
/// time `now_unix_secs`. Every reason a token is refused for is
/// `E_ENTITLEMENT_INVALID`.
#[wasm_bindgen]
pub fn export_profile_from_token(
    token: &str,
    public_keys: Array,
    now_unix_secs: f64,
) -> Result<JsValue, JsValue> {
    // A time that is no number would read as the year 1970, when no token
    // has run out yet.
    if !now_unix_secs.is_finite() {
        return Err(failure(ErrorCode::Internal, "Now"));
    }
    let claims = verify_token(token, &keys(&public_keys))
        .map_err(|error| failure(ErrorCode::EntitlementInvalid, token_error_name(error)))?;
    to_js(&export_profile(
        Some(&claims),
        UnixSecs::new(now_unix_secs as i64),
    ))
}

/// The profile the preview is drawn with: no token, no watermark (D-53).
#[wasm_bindgen]
pub fn preview_profile() -> JsValue {
    // A struct of numbers and a flag always serializes.
    to_plain(&export_profile(None, UnixSecs::new(0))).unwrap_or(JsValue::NULL)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_detail_of_a_refused_token_is_the_name_of_its_fault() {
        let names = [
            (TokenError::Format, "Format"),
            (TokenError::Base64, "Base64"),
            (TokenError::Json, "Json"),
            (TokenError::Version, "Version"),
            (TokenError::Signature, "Signature"),
        ];
        for (error, name) in names {
            assert_eq!(token_error_name(error), name);
        }
        // The code all five are thrown with, as JavaScript reads it.
        let code = serde_json::to_value(ErrorCode::EntitlementInvalid).unwrap();
        assert_eq!(code, "E_ENTITLEMENT_INVALID");
    }
}
