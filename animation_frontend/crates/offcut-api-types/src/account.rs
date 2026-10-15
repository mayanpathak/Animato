//! The account: who is signed in, the waitlist, and the data export (PS §17).

use offcut_types::{ExportId, Plan, UnixSecs};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::billing::SubscriptionSummary;

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
pub struct MeResponse {
    pub email: String,
    pub plan: Plan,
    pub subscription: Option<SubscriptionSummary>,
    pub entitlement_token: String,
}

/// What a waitlist signup is waiting for.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
pub enum Wanted {
    Launch,
    Safari,
    Firefox,
    Mobile,
    Linux,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
#[serde(deny_unknown_fields)]
pub struct NotifyMeRequest {
    pub email: String,
    pub wanted: Wanted,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
pub struct AccountExport {
    pub user: ExportedUser,
    pub sessions: Vec<ExportedSession>,
    pub subscription: Option<SubscriptionSummary>,
    pub usage_receipts: Vec<ExportedReceipt>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
pub struct ExportedUser {
    pub email: String,
    pub created_at: UnixSecs,
}

/// Session metadata only: no token hashes (TS §22.7).
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
pub struct ExportedSession {
    pub created_at: UnixSecs,
    pub last_used_at: UnixSecs,
    pub expires_at: UnixSecs,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
pub struct ExportedReceipt {
    pub export_id: ExportId,
    pub created_at: UnixSecs,
    pub plan_at_export: Plan,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::billing::{BillingInterval, SubscriptionStatus};

    const EXPORT_ID: &str = "0190f3a2-7b1c-7def-8a55-0123456789ab";

    #[test]
    fn wanted_serializes_as_snake_case() {
        let cases = [
            (Wanted::Launch, "launch"),
            (Wanted::Safari, "safari"),
            (Wanted::Firefox, "firefox"),
            (Wanted::Mobile, "mobile"),
            (Wanted::Linux, "linux"),
        ];
        for (wanted, name) in cases {
            let json = serde_json::to_string(&wanted).unwrap();
            assert_eq!(json, format!("\"{name}\""));
            assert_eq!(serde_json::from_str::<Wanted>(&json).unwrap(), wanted);
        }
    }

    #[test]
    fn notify_me_request_round_trips() {
        let request = NotifyMeRequest {
            email: "a@example.com".to_owned(),
            wanted: Wanted::Safari,
        };
        let json = serde_json::to_string(&request).unwrap();
        assert_eq!(json, r#"{"email":"a@example.com","wanted":"safari"}"#);
        assert_eq!(
            serde_json::from_str::<NotifyMeRequest>(&json).unwrap(),
            request
        );
    }

    #[test]
    fn notify_me_request_rejects_an_unknown_field() {
        let json = r#"{"email":"a@example.com","wanted":"launch","referrer":"x"}"#;
        assert!(serde_json::from_str::<NotifyMeRequest>(json).is_err());
    }

    #[test]
    fn notify_me_request_rejects_an_unknown_wanted() {
        for wanted in ["edge", "Launch", "LAUNCH", ""] {
            let json = format!(r#"{{"email":"a@example.com","wanted":"{wanted}"}}"#);
            assert!(
                serde_json::from_str::<NotifyMeRequest>(&json).is_err(),
                "{wanted} was accepted"
            );
        }
        assert!(serde_json::from_str::<NotifyMeRequest>(r#"{"email":"a@example.com"}"#).is_err());
        assert!(serde_json::from_str::<NotifyMeRequest>(r#"{"wanted":"launch"}"#).is_err());
    }

    #[test]
    fn me_response_round_trips() {
        let free = MeResponse {
            email: "a@example.com".to_owned(),
            plan: Plan::Free,
            subscription: None,
            entitlement_token: "claims.signature".to_owned(),
        };
        let json = serde_json::to_string(&free).unwrap();
        assert_eq!(
            json,
            r#"{"email":"a@example.com","plan":"free","subscription":null,"entitlement_token":"claims.signature"}"#
        );
        assert_eq!(serde_json::from_str::<MeResponse>(&json).unwrap(), free);

        let creator = MeResponse {
            plan: Plan::Creator,
            subscription: Some(SubscriptionSummary {
                status: SubscriptionStatus::Active,
                interval: BillingInterval::Monthly,
                current_period_end: UnixSecs::new(1_800_000_000),
                cancel_at_period_end: false,
            }),
            ..free
        };
        let json = serde_json::to_string(&creator).unwrap();
        assert!(json.contains(r#""plan":"creator""#));
        assert!(json.contains(r#""subscription":{"status":"active","interval":"monthly""#));
        assert_eq!(serde_json::from_str::<MeResponse>(&json).unwrap(), creator);
    }

    #[test]
    fn account_export_round_trips() {
        let export = AccountExport {
            user: ExportedUser {
                email: "a@example.com".to_owned(),
                created_at: UnixSecs::new(1_700_000_000),
            },
            sessions: vec![ExportedSession {
                created_at: UnixSecs::new(1_700_000_100),
                last_used_at: UnixSecs::new(1_700_000_200),
                expires_at: UnixSecs::new(1_702_000_000),
            }],
            subscription: None,
            usage_receipts: vec![ExportedReceipt {
                export_id: serde_json::from_str(&format!("\"{EXPORT_ID}\"")).unwrap(),
                created_at: UnixSecs::new(1_700_000_300),
                plan_at_export: Plan::Free,
            }],
        };
        let value = serde_json::to_value(&export).unwrap();
        assert_eq!(
            value,
            serde_json::json!({
                "user": { "email": "a@example.com", "created_at": 1_700_000_000 },
                "sessions": [{
                    "created_at": 1_700_000_100,
                    "last_used_at": 1_700_000_200,
                    "expires_at": 1_702_000_000,
                }],
                "subscription": null,
                "usage_receipts": [{
                    "export_id": EXPORT_ID,
                    "created_at": 1_700_000_300,
                    "plan_at_export": "free",
                }],
            })
        );
        assert_eq!(
            serde_json::from_value::<AccountExport>(value).unwrap(),
            export
        );
    }
}
