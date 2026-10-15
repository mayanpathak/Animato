//! Export metering. The server receives an export id and nothing else about the export.

use offcut_types::ExportId;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
#[serde(deny_unknown_fields)]
pub struct UsageReceiptRequest {
    pub export_id: ExportId,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
pub struct EntitlementResponse {
    pub entitlement_token: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    const EXPORT_ID: &str = "0190f3a2-7b1c-7def-8a55-0123456789ab";

    #[test]
    fn usage_receipt_request_round_trips_and_denies_unknown_fields() {
        let json = format!(r#"{{"export_id":"{EXPORT_ID}"}}"#);
        let request: UsageReceiptRequest = serde_json::from_str(&json).unwrap();
        assert_eq!(request.export_id.get().to_string(), EXPORT_ID);
        assert_eq!(serde_json::to_string(&request).unwrap(), json);

        let with_extra = format!(r#"{{"export_id":"{EXPORT_ID}","duration_ms":60000}}"#);
        assert!(serde_json::from_str::<UsageReceiptRequest>(&with_extra).is_err());
        assert!(serde_json::from_str::<UsageReceiptRequest>(r#"{"export_id":"nope"}"#).is_err());
    }

    #[test]
    fn entitlement_response_round_trips() {
        let response = EntitlementResponse {
            entitlement_token: "claims.signature".to_owned(),
        };
        let json = serde_json::to_string(&response).unwrap();
        assert_eq!(json, r#"{"entitlement_token":"claims.signature"}"#);
        assert_eq!(
            serde_json::from_str::<EntitlementResponse>(&json).unwrap(),
            response
        );
    }
}
