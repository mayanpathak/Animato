//! The body of every API error response.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
pub struct ApiError {
    pub code: ApiErrorCode,
    pub retry_after_secs: Option<u32>,
}

/// V1 produces `bad_request`, `not_found`, `unsupported_media_type`,
/// `payload_too_large`, `rate_limited` and `internal`. The other seven are
/// defined now so V6 adds handlers, not enum members (D-3).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
pub enum ApiErrorCode {
    BadRequest,
    Unauthorized,
    Forbidden,
    NotFound,
    UnsupportedMediaType,
    PayloadTooLarge,
    RateLimited,
    LinkInvalid,
    LinkExpired,
    SessionExpired,
    EmailUnavailable,
    BillingUnavailable,
    Internal,
}

#[cfg(test)]
mod tests {
    use super::*;

    /// v1implementation §7.6, in its order.
    const CODES: [&str; 13] = [
        "bad_request",
        "unauthorized",
        "forbidden",
        "not_found",
        "unsupported_media_type",
        "payload_too_large",
        "rate_limited",
        "link_invalid",
        "link_expired",
        "session_expired",
        "email_unavailable",
        "billing_unavailable",
        "internal",
    ];

    /// Position in declaration order. The match has no wildcard, so a new
    /// member does not compile until it is given a place here.
    fn position(code: ApiErrorCode) -> usize {
        match code {
            ApiErrorCode::BadRequest => 0,
            ApiErrorCode::Unauthorized => 1,
            ApiErrorCode::Forbidden => 2,
            ApiErrorCode::NotFound => 3,
            ApiErrorCode::UnsupportedMediaType => 4,
            ApiErrorCode::PayloadTooLarge => 5,
            ApiErrorCode::RateLimited => 6,
            ApiErrorCode::LinkInvalid => 7,
            ApiErrorCode::LinkExpired => 8,
            ApiErrorCode::SessionExpired => 9,
            ApiErrorCode::EmailUnavailable => 10,
            ApiErrorCode::BillingUnavailable => 11,
            ApiErrorCode::Internal => 12,
        }
    }

    #[test]
    fn api_error_code_has_13_snake_case_members() {
        for (i, code) in CODES.iter().enumerate() {
            let json = format!("\"{code}\"");
            let parsed: ApiErrorCode = serde_json::from_str(&json).unwrap();
            assert_eq!(position(parsed), i, "{code} is out of order");
            assert_eq!(serde_json::to_string(&parsed).unwrap(), json);
        }
        let union: Vec<_> = CODES.iter().map(|code| format!("\"{code}\"")).collect();
        assert_eq!(
            ApiErrorCode::inline(&ts_rs::Config::default()),
            union.join(" | ")
        );
    }

    #[test]
    fn api_error_code_rejects_other_spellings() {
        for bad in [
            "\"NotFound\"",
            "\"notFound\"",
            "\"E_INTERNAL\"",
            "\"teapot\"",
        ] {
            assert!(
                serde_json::from_str::<ApiErrorCode>(bad).is_err(),
                "{bad} was accepted"
            );
        }
    }

    #[test]
    fn api_error_round_trips() {
        let limited = ApiError {
            code: ApiErrorCode::RateLimited,
            retry_after_secs: Some(30),
        };
        let json = serde_json::to_string(&limited).unwrap();
        assert_eq!(json, r#"{"code":"rate_limited","retry_after_secs":30}"#);
        assert_eq!(serde_json::from_str::<ApiError>(&json).unwrap(), limited);

        let not_found = ApiError {
            code: ApiErrorCode::NotFound,
            retry_after_secs: None,
        };
        let json = serde_json::to_string(&not_found).unwrap();
        assert_eq!(json, r#"{"code":"not_found","retry_after_secs":null}"#);
        assert_eq!(serde_json::from_str::<ApiError>(&json).unwrap(), not_found);
    }

    #[test]
    fn api_error_reads_a_body_without_retry_after_secs() {
        let parsed: ApiError = serde_json::from_str(r#"{"code":"internal"}"#).unwrap();
        assert_eq!(
            parsed,
            ApiError {
                code: ApiErrorCode::Internal,
                retry_after_secs: None
            }
        );
    }
}
