//! Sign-in by magic link.

use offcut_types::UnixSecs;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
#[serde(deny_unknown_fields)]
pub struct MagicLinkRequest {
    pub email: String,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
#[serde(deny_unknown_fields)]
pub struct VerifyRequest {
    pub token: String,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
pub struct SessionResponse {
    pub access_token: String,
    pub access_expires_at: UnixSecs,
    pub entitlement_token: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn magic_link_request_round_trips() {
        let request = MagicLinkRequest {
            email: "a@example.com".to_owned(),
        };
        let json = serde_json::to_string(&request).unwrap();
        assert_eq!(json, r#"{"email":"a@example.com"}"#);
        assert_eq!(
            serde_json::from_str::<MagicLinkRequest>(&json).unwrap(),
            request
        );
    }

    #[test]
    fn verify_request_round_trips() {
        let request = VerifyRequest {
            token: "abc".to_owned(),
        };
        let json = serde_json::to_string(&request).unwrap();
        assert_eq!(json, r#"{"token":"abc"}"#);
        assert_eq!(
            serde_json::from_str::<VerifyRequest>(&json).unwrap(),
            request
        );
    }

    #[test]
    fn session_response_round_trips() {
        let response = SessionResponse {
            access_token: "access".to_owned(),
            access_expires_at: UnixSecs::new(1_800_000_000),
            entitlement_token: "claims.signature".to_owned(),
        };
        let json = serde_json::to_string(&response).unwrap();
        assert_eq!(
            json,
            r#"{"access_token":"access","access_expires_at":1800000000,"entitlement_token":"claims.signature"}"#
        );
        assert_eq!(
            serde_json::from_str::<SessionResponse>(&json).unwrap(),
            response
        );
    }

    #[test]
    fn requests_deny_unknown_fields() {
        let json = r#"{"email":"a@example.com","extra":1}"#;
        assert!(serde_json::from_str::<MagicLinkRequest>(json).is_err());
        let json = r#"{"token":"abc","extra":1}"#;
        assert!(serde_json::from_str::<VerifyRequest>(json).is_err());
    }
}
