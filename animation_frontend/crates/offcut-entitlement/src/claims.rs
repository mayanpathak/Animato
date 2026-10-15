//! What a token says (TS §10.6). Only the server writes these; the browser
//! reads them from a token it has verified.

use offcut_types::{ExportCount, Plan, UnixSecs, UserId};
use serde::{Deserialize, Serialize};

/// The version of the claims this code reads.
pub const CLAIMS_VERSION: u8 = 1;

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct EntitlementClaims {
    /// Format version = 1.
    pub v: u8,
    pub sub: UserId,
    pub plan: Plan,
    /// Meaningful when `plan == Free`.
    pub free_exports_remaining: ExportCount,
    /// Free: the end of the current UTC month. Creator: `current_period_end`.
    pub period_end: UnixSecs,
    pub iat: UnixSecs,
    /// `iat + ENTITLEMENT_OFFLINE_TTL_SECS`.
    pub exp: UnixSecs,
}
