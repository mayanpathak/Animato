//! Subscriptions and checkout.

use offcut_types::UnixSecs;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
pub struct SubscriptionSummary {
    pub status: SubscriptionStatus,
    pub interval: BillingInterval,
    pub current_period_end: UnixSecs,
    pub cancel_at_period_end: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
pub enum SubscriptionStatus {
    Active,
    PastDue,
    Canceled,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
pub enum BillingInterval {
    Monthly,
    Annual,
}

/// What can be bought (PS §11). The founding offer is the E-5 presale.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
pub enum Offer {
    CreatorMonthly,
    CreatorAnnual,
    CreatorAnnualFounding,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
#[serde(deny_unknown_fields)]
pub struct CheckoutRequest {
    pub offer: Offer,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
pub struct UrlResponse {
    pub url: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn billing_enums_serialize_as_snake_case() {
        let statuses = [
            (SubscriptionStatus::Active, "active"),
            (SubscriptionStatus::PastDue, "past_due"),
            (SubscriptionStatus::Canceled, "canceled"),
        ];
        for (status, name) in statuses {
            let json = serde_json::to_string(&status).unwrap();
            assert_eq!(json, format!("\"{name}\""));
            assert_eq!(
                serde_json::from_str::<SubscriptionStatus>(&json).unwrap(),
                status
            );
        }

        let intervals = [
            (BillingInterval::Monthly, "monthly"),
            (BillingInterval::Annual, "annual"),
        ];
        for (interval, name) in intervals {
            let json = serde_json::to_string(&interval).unwrap();
            assert_eq!(json, format!("\"{name}\""));
            assert_eq!(
                serde_json::from_str::<BillingInterval>(&json).unwrap(),
                interval
            );
        }

        let offers = [
            (Offer::CreatorMonthly, "creator_monthly"),
            (Offer::CreatorAnnual, "creator_annual"),
            (Offer::CreatorAnnualFounding, "creator_annual_founding"),
        ];
        for (offer, name) in offers {
            let json = serde_json::to_string(&offer).unwrap();
            assert_eq!(json, format!("\"{name}\""));
            assert_eq!(serde_json::from_str::<Offer>(&json).unwrap(), offer);
        }
    }

    #[test]
    fn subscription_summary_round_trips() {
        let summary = SubscriptionSummary {
            status: SubscriptionStatus::PastDue,
            interval: BillingInterval::Annual,
            current_period_end: UnixSecs::new(1_800_000_000),
            cancel_at_period_end: true,
        };
        let json = serde_json::to_string(&summary).unwrap();
        assert_eq!(
            json,
            r#"{"status":"past_due","interval":"annual","current_period_end":1800000000,"cancel_at_period_end":true}"#
        );
        assert_eq!(
            serde_json::from_str::<SubscriptionSummary>(&json).unwrap(),
            summary
        );
    }

    #[test]
    fn checkout_request_round_trips_and_denies_unknown_fields() {
        let request = CheckoutRequest {
            offer: Offer::CreatorAnnualFounding,
        };
        let json = serde_json::to_string(&request).unwrap();
        assert_eq!(json, r#"{"offer":"creator_annual_founding"}"#);
        assert_eq!(
            serde_json::from_str::<CheckoutRequest>(&json).unwrap(),
            request
        );

        assert!(
            serde_json::from_str::<CheckoutRequest>(r#"{"offer":"creator_annual","coupon":"x"}"#)
                .is_err()
        );
        assert!(serde_json::from_str::<CheckoutRequest>(r#"{"offer":"lifetime"}"#).is_err());
    }

    #[test]
    fn url_response_round_trips() {
        let response = UrlResponse {
            url: "https://example.com/checkout".to_owned(),
        };
        let json = serde_json::to_string(&response).unwrap();
        assert_eq!(json, r#"{"url":"https://example.com/checkout"}"#);
        assert_eq!(
            serde_json::from_str::<UrlResponse>(&json).unwrap(),
            response
        );
    }
}
