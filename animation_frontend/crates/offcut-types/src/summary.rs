//! "What we changed" (PS §10 J11). Lists only transformations that are
//! performed. Nothing is cut, so nothing about cuts is reported.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
pub struct ChangeSummary {
    /// The enhancement chain ran (TS §18).
    pub voice_cleaned: bool,
    /// Enabled KeywordPop events.
    pub captions_emphasized: u32,
    /// Enabled NumberReveal + ListReveal + FromTo events.
    pub visual_moments: u32,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn change_summary_keeps_rust_field_names() {
        let summary = ChangeSummary {
            voice_cleaned: true,
            captions_emphasized: 4,
            visual_moments: 3,
        };
        let json = serde_json::to_string(&summary).unwrap();
        assert_eq!(
            json,
            r#"{"voice_cleaned":true,"captions_emphasized":4,"visual_moments":3}"#
        );
        assert_eq!(
            serde_json::from_str::<ChangeSummary>(&json).unwrap(),
            summary
        );
    }
}
