//! The pipeline's stages, in the order of the PS §20.2 budget rows.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
pub enum PipelineStage {
    ProbeAudio,
    Asr,
    AudioChain,
    DetectScene,
    RenderEncode,
    Mux,
}

#[cfg(test)]
mod tests {
    use super::*;

    const ALL: [(PipelineStage, &str); 6] = [
        (PipelineStage::ProbeAudio, "probe_audio"),
        (PipelineStage::Asr, "asr"),
        (PipelineStage::AudioChain, "audio_chain"),
        (PipelineStage::DetectScene, "detect_scene"),
        (PipelineStage::RenderEncode, "render_encode"),
        (PipelineStage::Mux, "mux"),
    ];

    #[test]
    fn serializes_as_snake_case() {
        for (stage, name) in ALL {
            let json = serde_json::to_string(&stage).unwrap();
            assert_eq!(json, format!("\"{name}\""));
            assert_eq!(serde_json::from_str::<PipelineStage>(&json).unwrap(), stage);
        }
    }

    #[test]
    fn rejects_other_spellings() {
        assert!(serde_json::from_str::<PipelineStage>("\"ProbeAudio\"").is_err());
        assert!(serde_json::from_str::<PipelineStage>("\"probeAudio\"").is_err());
        assert!(serde_json::from_str::<PipelineStage>("\"import\"").is_err());
    }

    #[test]
    fn typescript_is_the_union_of_the_six_strings() {
        let union: Vec<String> = ALL.iter().map(|(_, name)| format!("\"{name}\"")).collect();
        assert_eq!(
            PipelineStage::inline(&ts_rs::Config::default()),
            union.join(" | ")
        );
    }
}
