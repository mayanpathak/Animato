//! The entitlement token: what the server signs to say which plan a user is
//! on, and what the browser checks before it exports (TS §10.8, D-25). This
//! crate reads a token, verifies it, and turns verified claims into an
//! export profile. It reaches no network, no storage and no clock, and it
//! never writes a token into a message.

pub mod claims;
pub mod profile;
pub mod token;
pub mod verify;

use thiserror::Error;

pub use crate::claims::EntitlementClaims;
pub use crate::profile::export_profile;
pub use crate::verify::verify_token;

/// Why a token is refused. Every one of them is `E_ENTITLEMENT_INVALID` to
/// the user (TS §11.2). No message holds a part of the token.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Error)]
pub enum TokenError {
    #[error("the token is not two segments, or is too long")]
    Format,
    #[error("a segment of the token is not unpadded base64url of the right length")]
    Base64,
    #[error("the first segment of the token is not the claims")]
    Json,
    #[error("the version of the claims is not known")]
    Version,
    #[error("no key verifies the signature of the token")]
    Signature,
}

/// The cross-language vector: tokens minted by `mintEntitlementToken` of
/// `web/tests-e2e/helpers/fake-api.ts` with the test seed, pasted here. What
/// TypeScript signs, Rust must verify. No seed is in this crate.
#[cfg(test)]
pub(crate) mod testing {
    use offcut_types::{ExportCount, Plan, UnixSecs};

    use crate::claims::EntitlementClaims;

    /// `{ plan: "creator", iat: 1760000000, exp: 1760604800, periodEnd: 1762592000 }`.
    pub(crate) const TOKEN: &str = concat!(
        "eyJ2IjoxLCJzdWIiOiIwMTkwZjNhMi03YjFjLTdkZWYtOGE1NS0wMTIzNDU2Nzg5YWIiLCJwbGFuIjoiY3JlYXRvciIs",
        "ImZyZWVfZXhwb3J0c19yZW1haW5pbmciOjMsInBlcmlvZF9lbmQiOjE3NjI1OTIwMDAsImlhdCI6MTc2MDAwMDAwMCwi",
        "ZXhwIjoxNzYwNjA0ODAwfQ",
        ".rcf9YKBOUQXtOHMPKLtXzqOkadl3f0CXJ-dk7SQhC4DqJ_XpFGfqAj5uM5Ou7k3jGdWdi0ZS49s2Fbrd0mP-AQ",
    );

    /// The same times, `{ plan: "free", freeExportsRemaining: 2 }`.
    pub(crate) const FREE_TOKEN: &str = concat!(
        "eyJ2IjoxLCJzdWIiOiIwMTkwZjNhMi03YjFjLTdkZWYtOGE1NS0wMTIzNDU2Nzg5YWIiLCJwbGFuIjoiZnJlZSIsImZy",
        "ZWVfZXhwb3J0c19yZW1haW5pbmciOjIsInBlcmlvZF9lbmQiOjE3NjI1OTIwMDAsImlhdCI6MTc2MDAwMDAwMCwiZXhw",
        "IjoxNzYwNjA0ODAwfQ",
        ".RybDTPPIt9KFFfGe7_-HUebH_ojpHdqsLMj136Km5QA8lKhuav5aWLDlPAKUr8bFJqvPiE0BAoORHQAbVLcfDQ",
    );

    /// The test public key: `testPublicKeyBase64()` of `fake-api.ts`, as bytes.
    pub(crate) const PUBLIC_KEY: [u8; 32] = [
        152, 44, 157, 111, 171, 139, 43, 159, 31, 106, 171, 73, 210, 253, 206, 151, 203, 103, 152,
        214, 232, 58, 129, 250, 183, 244, 67, 234, 183, 23, 199, 19,
    ];

    /// A valid key that signed neither token: the public key of the first
    /// test of RFC 8032, section 7.1.
    pub(crate) const OTHER_KEY: [u8; 32] = [
        0xd7, 0x5a, 0x98, 0x01, 0x82, 0xb1, 0x0a, 0xb7, 0xd5, 0x4b, 0xfe, 0xd3, 0xc9, 0x64, 0x07,
        0x3a, 0x0e, 0xe1, 0x72, 0xf3, 0xda, 0xa6, 0x23, 0x25, 0xaf, 0x02, 0x1a, 0x68, 0xf7, 0x07,
        0x51, 0x1a,
    ];

    pub(crate) const IAT: i64 = 1_760_000_000;
    pub(crate) const EXP: i64 = 1_760_604_800;
    pub(crate) const PERIOD_END: i64 = 1_762_592_000;

    /// The claims of `TOKEN`, or with `Plan::Free` and 2 of `FREE_TOKEN`.
    pub(crate) fn claims(plan: Plan, free_exports_remaining: u32) -> EntitlementClaims {
        EntitlementClaims {
            v: 1,
            sub: serde_json::from_str("\"0190f3a2-7b1c-7def-8a55-0123456789ab\"").unwrap(),
            plan,
            free_exports_remaining: ExportCount::new(free_exports_remaining),
            period_end: UnixSecs::new(PERIOD_END),
            iat: UnixSecs::new(IAT),
            exp: UnixSecs::new(EXP),
        }
    }
}
