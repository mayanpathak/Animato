//! What a container says about a clip, and why a clip is rejected.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::units::{Bytes, DurMs, FpsMilli, Hz, Px};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
pub enum Rotation {
    R0,
    R90,
    R180,
    R270,
}

/// From the display size after rotation; square = `Landscape`.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
pub enum Orientation {
    Portrait,
    Landscape,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
pub enum ContainerKind {
    Mp4,
    Mov,
    Other,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
pub enum VideoCodec {
    H264,
    Hevc,
    Av1,
    Vp9,
    ProRes,
    Other,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
pub enum AudioCodec {
    Aac,
    Mp3,
    Opus,
    Pcm,
    Other,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
pub struct ProbeInfo {
    pub container: ContainerKind,
    pub file_size: Bytes,
    pub duration: DurMs,
    pub video_tracks: u32,
    pub audio_tracks: u32,
    pub video: Option<VideoTrackInfo>,
    pub audio: Option<AudioTrackInfo>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
pub struct VideoTrackInfo {
    pub codec: VideoCodec,
    /// WebCodecs codec string, e.g. "avc1.640028".
    pub codec_string: String,
    pub coded_width: Px,
    pub coded_height: Px,
    pub rotation: Rotation,
    pub avg_fps: FpsMilli,
    pub max_fps: FpsMilli,
    pub is_vfr: bool,
    pub frame_count: u32,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
pub struct AudioTrackInfo {
    pub codec: AudioCodec,
    pub codec_string: String,
    pub sample_rate: Hz,
    pub channels: u32,
}

/// A validated clip; constructed only by `validate_probe()`.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
pub struct ClipInfo {
    pub duration: DurMs,
    /// After rotation.
    pub display_width: Px,
    /// After rotation.
    pub display_height: Px,
    pub rotation: Rotation,
    pub orientation: Orientation,
    pub is_vfr: bool,
    pub video_codec_string: String,
    pub audio_codec_string: String,
    pub audio_sample_rate: Hz,
    pub audio_channels: u32,
}

/// Serialized as its `REJECT_*` code; also an analytics enum.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, TS)]
pub enum RejectReason {
    #[serde(rename = "REJECT_CONTAINER")]
    Container,
    #[serde(rename = "REJECT_CORRUPT")]
    Corrupt,
    #[serde(rename = "REJECT_NO_VIDEO")]
    NoVideo,
    #[serde(rename = "REJECT_NO_AUDIO")]
    NoAudio,
    #[serde(rename = "REJECT_MULTI_AUDIO_TRACK")]
    MultiAudioTrack,
    #[serde(rename = "REJECT_VIDEO_CODEC")]
    VideoCodec,
    #[serde(rename = "REJECT_HEVC")]
    Hevc,
    #[serde(rename = "REJECT_AUDIO_CODEC")]
    AudioCodec,
    #[serde(rename = "REJECT_DURATION")]
    Duration,
    #[serde(rename = "REJECT_FILE_SIZE")]
    FileSize,
    #[serde(rename = "REJECT_RESOLUTION")]
    Resolution,
    #[serde(rename = "REJECT_FRAME_RATE")]
    FrameRate,
    #[serde(rename = "REJECT_DECODE_UNSUPPORTED")]
    DecodeUnsupported,
    #[serde(rename = "REJECT_NO_SPEECH")]
    NoSpeech,
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The 14 codes of v1implementation §6.4, in its order.
    const REJECT_CODES: [&str; 14] = [
        "REJECT_CONTAINER",
        "REJECT_CORRUPT",
        "REJECT_NO_VIDEO",
        "REJECT_NO_AUDIO",
        "REJECT_MULTI_AUDIO_TRACK",
        "REJECT_VIDEO_CODEC",
        "REJECT_HEVC",
        "REJECT_AUDIO_CODEC",
        "REJECT_DURATION",
        "REJECT_FILE_SIZE",
        "REJECT_RESOLUTION",
        "REJECT_FRAME_RATE",
        "REJECT_DECODE_UNSUPPORTED",
        "REJECT_NO_SPEECH",
    ];

    /// Position in declaration order. The match has no wildcard, so a new
    /// variant does not compile until it is given a place here.
    fn position(r: RejectReason) -> usize {
        match r {
            RejectReason::Container => 0,
            RejectReason::Corrupt => 1,
            RejectReason::NoVideo => 2,
            RejectReason::NoAudio => 3,
            RejectReason::MultiAudioTrack => 4,
            RejectReason::VideoCodec => 5,
            RejectReason::Hevc => 6,
            RejectReason::AudioCodec => 7,
            RejectReason::Duration => 8,
            RejectReason::FileSize => 9,
            RejectReason::Resolution => 10,
            RejectReason::FrameRate => 11,
            RejectReason::DecodeUnsupported => 12,
            RejectReason::NoSpeech => 13,
        }
    }

    #[test]
    fn reject_reason_serializes_as_its_code() {
        for (i, code) in REJECT_CODES.iter().enumerate() {
            let json = format!("\"{code}\"");
            let reason: RejectReason = serde_json::from_str(&json).unwrap();
            assert_eq!(position(reason), i, "{code} is out of order");
            assert_eq!(serde_json::to_string(&reason).unwrap(), json);
        }
    }

    #[test]
    fn reject_reason_rejects_other_spellings() {
        for bad in [
            "\"Container\"",
            "\"container\"",
            "\"reject_container\"",
            "\"REJECT_UNKNOWN\"",
        ] {
            assert!(
                serde_json::from_str::<RejectReason>(bad).is_err(),
                "{bad} was accepted"
            );
        }
    }

    #[test]
    fn reject_reason_typescript_is_the_union_of_the_14_codes() {
        let union: Vec<String> = REJECT_CODES
            .iter()
            .map(|code| format!("\"{code}\""))
            .collect();
        assert_eq!(
            RejectReason::inline(&ts_rs::Config::default()),
            union.join(" | ")
        );
    }

    fn json<T: Serialize>(v: &T) -> String {
        serde_json::to_string(v).unwrap()
    }

    #[test]
    fn plain_enums_serialize_as_snake_case() {
        assert_eq!(json(&Rotation::R0), "\"r0\"");
        assert_eq!(json(&Rotation::R270), "\"r270\"");
        assert_eq!(json(&Orientation::Portrait), "\"portrait\"");
        assert_eq!(json(&Orientation::Landscape), "\"landscape\"");
        assert_eq!(json(&ContainerKind::Mp4), "\"mp4\"");
        assert_eq!(json(&VideoCodec::H264), "\"h264\"");
        assert_eq!(json(&VideoCodec::ProRes), "\"pro_res\"");
        assert_eq!(json(&AudioCodec::Aac), "\"aac\"");
        assert_eq!(
            serde_json::from_str::<Rotation>("\"r90\"").unwrap(),
            Rotation::R90
        );
        assert_eq!(
            serde_json::from_str::<VideoCodec>("\"hevc\"").unwrap(),
            VideoCodec::Hevc
        );
    }

    fn probe() -> ProbeInfo {
        ProbeInfo {
            container: ContainerKind::Mov,
            file_size: Bytes::new(12_345_678),
            duration: DurMs::new(60_000),
            video_tracks: 1,
            audio_tracks: 1,
            video: Some(VideoTrackInfo {
                codec: VideoCodec::H264,
                codec_string: "avc1.640028".to_owned(),
                coded_width: Px::new(1920),
                coded_height: Px::new(1080),
                rotation: Rotation::R90,
                avg_fps: FpsMilli::new(29_970),
                max_fps: FpsMilli::new(30_000),
                is_vfr: false,
                frame_count: 1798,
            }),
            audio: None,
        }
    }

    #[test]
    fn probe_info_keeps_rust_field_names() {
        let value = serde_json::to_value(probe()).unwrap();
        assert_eq!(
            value,
            serde_json::json!({
                "container": "mov",
                "file_size": 12_345_678,
                "duration": 60_000,
                "video_tracks": 1,
                "audio_tracks": 1,
                "video": {
                    "codec": "h264",
                    "codec_string": "avc1.640028",
                    "coded_width": 1920,
                    "coded_height": 1080,
                    "rotation": "r90",
                    "avg_fps": 29_970,
                    "max_fps": 30_000,
                    "is_vfr": false,
                    "frame_count": 1798,
                },
                "audio": null,
            })
        );
        assert_eq!(serde_json::from_value::<ProbeInfo>(value).unwrap(), probe());
    }

    #[test]
    fn clip_info_and_audio_track_round_trip() {
        let clip = ClipInfo {
            duration: DurMs::new(60_000),
            display_width: Px::new(1080),
            display_height: Px::new(1920),
            rotation: Rotation::R90,
            orientation: Orientation::Portrait,
            is_vfr: true,
            video_codec_string: "avc1.640028".to_owned(),
            audio_codec_string: "mp4a.40.2".to_owned(),
            audio_sample_rate: Hz::new(48_000),
            audio_channels: 2,
        };
        let json = serde_json::to_string(&clip).unwrap();
        assert!(json.contains(r#""orientation":"portrait""#));
        assert!(json.contains(r#""audio_sample_rate":48000"#));
        assert_eq!(serde_json::from_str::<ClipInfo>(&json).unwrap(), clip);

        let audio = AudioTrackInfo {
            codec: AudioCodec::Aac,
            codec_string: "mp4a.40.2".to_owned(),
            sample_rate: Hz::new(44_100),
            channels: 1,
        };
        let json = serde_json::to_string(&audio).unwrap();
        assert_eq!(
            json,
            r#"{"codec":"aac","codec_string":"mp4a.40.2","sample_rate":44100,"channels":1}"#
        );
        assert_eq!(
            serde_json::from_str::<AudioTrackInfo>(&json).unwrap(),
            audio
        );
    }
}
