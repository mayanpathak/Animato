//! The user's choices for one clip. No field changes audio, duration or timing.

use std::collections::BTreeMap;

use serde::de::Error as _;
use serde::{Deserialize, Deserializer, Serialize};
use ts_rs::TS;

use crate::ids::{EventId, WordIdx};

/// Caption style (PS §12.2).
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Hash, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
pub enum StyleId {
    #[default]
    Clean,
    Bold,
    Tech,
}

/// Horizontal crop position: -1.0 (left) ..= 1.0 (right); 0.0 is the centre.
/// Checked in `new` and when deserializing.
#[derive(Clone, Copy, Debug, PartialEq, PartialOrd, Serialize, TS)]
pub struct CropOffset(f32);

impl CropOffset {
    /// `None` when `v` is not finite or is outside `-1.0..=1.0`.
    pub fn new(v: f32) -> Option<Self> {
        (-1.0..=1.0).contains(&v).then_some(Self(v))
    }

    pub const fn get(self) -> f32 {
        self.0
    }
}

impl<'de> Deserialize<'de> for CropOffset {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let v = f32::deserialize(deserializer)?;
        Self::new(v)
            .ok_or_else(|| D::Error::custom("a crop offset must be a finite number in -1.0..=1.0"))
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
pub struct EditState {
    /// Replacement text; "" hides the word; timing never changes.
    pub word_edits: BTreeMap<WordIdx, String>,
    /// The enabled flag chosen by the user.
    pub event_overrides: BTreeMap<EventId, bool>,
    pub style: StyleId,
    pub crop_offset: CropOffset,
}

impl Default for EditState {
    /// No edits, no overrides, `StyleId::Clean`, offset `0.0`.
    fn default() -> Self {
        Self {
            word_edits: BTreeMap::new(),
            event_overrides: BTreeMap::new(),
            style: StyleId::Clean,
            crop_offset: CropOffset(0.0),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn crop_offset_accepts_only_minus_one_to_one() {
        for ok in [-1.0, -0.5, 0.0, 0.25, 1.0] {
            assert_eq!(CropOffset::new(ok).map(CropOffset::get), Some(ok));
        }
        for bad in [
            -1.001,
            1.001,
            2.0,
            f32::NAN,
            f32::INFINITY,
            f32::NEG_INFINITY,
        ] {
            assert_eq!(CropOffset::new(bad), None, "{bad} was accepted");
        }
    }

    #[test]
    fn crop_offset_deserializes_through_new() {
        let offset = CropOffset::new(-0.5).unwrap();
        assert_eq!(serde_json::to_string(&offset).unwrap(), "-0.5");
        assert_eq!(serde_json::from_str::<CropOffset>("-0.5").unwrap(), offset);
        assert!(serde_json::from_str::<CropOffset>("1.5").is_err());
        assert!(serde_json::from_str::<CropOffset>("-1.01").is_err());
    }

    #[test]
    fn style_id_serializes_as_snake_case_and_defaults_to_clean() {
        let cases = [
            (StyleId::Clean, "clean"),
            (StyleId::Bold, "bold"),
            (StyleId::Tech, "tech"),
        ];
        for (style, name) in cases {
            let json = serde_json::to_string(&style).unwrap();
            assert_eq!(json, format!("\"{name}\""));
            assert_eq!(serde_json::from_str::<StyleId>(&json).unwrap(), style);
        }
        assert_eq!(StyleId::default(), StyleId::Clean);
    }

    #[test]
    fn default_edit_state_has_no_edits() {
        let state = EditState::default();
        assert!(state.word_edits.is_empty());
        assert!(state.event_overrides.is_empty());
        assert_eq!(state.style, StyleId::Clean);
        assert_eq!(state.crop_offset.get(), 0.0);
        assert_eq!(
            serde_json::to_string(&state).unwrap(),
            r#"{"word_edits":{},"event_overrides":{},"style":"clean","crop_offset":0.0}"#
        );
    }

    #[test]
    fn edit_state_round_trips_with_ids_as_map_keys() {
        let mut state = EditState::default();
        state
            .word_edits
            .insert(WordIdx::new(3), "ten thousand".to_owned());
        state.word_edits.insert(WordIdx::new(9), String::new());
        state.event_overrides.insert(EventId::new(u64::MAX), false);
        state.style = StyleId::Tech;
        state.crop_offset = CropOffset::new(0.25).unwrap();

        let value = serde_json::to_value(&state).unwrap();
        assert_eq!(
            value,
            serde_json::json!({
                "word_edits": { "3": "ten thousand", "9": "" },
                "event_overrides": { "18446744073709551615": false },
                "style": "tech",
                "crop_offset": 0.25,
            })
        );
        assert_eq!(serde_json::from_value::<EditState>(value).unwrap(), state);
    }

    #[test]
    fn edit_state_with_a_bad_crop_offset_is_rejected() {
        let json = r#"{"word_edits":{},"event_overrides":{},"style":"clean","crop_offset":3.0}"#;
        assert!(serde_json::from_str::<EditState>(json).is_err());
    }
}
