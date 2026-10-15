//! Plans and the export profile a plan allows.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::units::{BitsPerSec, Px};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
pub enum Plan {
    Free,
    Creator,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
pub enum ProfileKind {
    Preview,
    Free,
    Creator,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
pub struct ExportProfile {
    pub kind: ProfileKind,
    pub width: Px,
    pub height: Px,
    pub watermark: bool,
    pub video_bitrate: BitsPerSec,
    pub audio_bitrate: BitsPerSec,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plan_and_profile_kind_serialize_as_snake_case() {
        assert_eq!(serde_json::to_string(&Plan::Free).unwrap(), "\"free\"");
        assert_eq!(
            serde_json::to_string(&Plan::Creator).unwrap(),
            "\"creator\""
        );
        assert_eq!(
            serde_json::from_str::<Plan>("\"creator\"").unwrap(),
            Plan::Creator
        );
        assert!(serde_json::from_str::<Plan>("\"Creator\"").is_err());
        assert!(serde_json::from_str::<Plan>("\"preview\"").is_err());

        let kinds = [
            (ProfileKind::Preview, "preview"),
            (ProfileKind::Free, "free"),
            (ProfileKind::Creator, "creator"),
        ];
        for (kind, name) in kinds {
            let json = serde_json::to_string(&kind).unwrap();
            assert_eq!(json, format!("\"{name}\""));
            assert_eq!(serde_json::from_str::<ProfileKind>(&json).unwrap(), kind);
        }
    }

    #[test]
    fn export_profile_keeps_rust_field_names() {
        let profile = ExportProfile {
            kind: ProfileKind::Free,
            width: Px::new(720),
            height: Px::new(1280),
            watermark: true,
            video_bitrate: BitsPerSec::new(4_000_000),
            audio_bitrate: BitsPerSec::new(128_000),
        };
        let json = serde_json::to_string(&profile).unwrap();
        assert_eq!(
            json,
            r#"{"kind":"free","width":720,"height":1280,"watermark":true,"video_bitrate":4000000,"audio_bitrate":128000}"#
        );
        assert_eq!(
            serde_json::from_str::<ExportProfile>(&json).unwrap(),
            profile
        );
    }
}
