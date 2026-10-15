//! The shared code lists: error codes, unsupported reasons and failure stages.
//! The serialized string of each code is the contract; the Rust variant name is not.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::stage::PipelineStage;

/// Every `E_*` code, in the order of TS §11.2.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, TS)]
pub enum ErrorCode {
    #[serde(rename = "E_MODEL_DOWNLOAD")]
    ModelDownload,
    #[serde(rename = "E_MODEL_HASH")]
    ModelHash,
    #[serde(rename = "E_MODEL_STORAGE")]
    ModelStorage,
    #[serde(rename = "E_STORAGE_QUOTA")]
    StorageQuota,
    #[serde(rename = "E_STORAGE_IO")]
    StorageIo,
    #[serde(rename = "E_DECODE_AUDIO")]
    DecodeAudio,
    #[serde(rename = "E_DECODE_VIDEO")]
    DecodeVideo,
    #[serde(rename = "E_ASR_RUNTIME")]
    AsrRuntime,
    #[serde(rename = "E_ASR_OOM")]
    AsrOom,
    #[serde(rename = "E_DSP")]
    Dsp,
    #[serde(rename = "E_GPU_INIT")]
    GpuInit,
    #[serde(rename = "E_GPU_LOST")]
    GpuLost,
    #[serde(rename = "E_ENCODE_VIDEO")]
    EncodeVideo,
    #[serde(rename = "E_ENCODE_AUDIO")]
    EncodeAudio,
    #[serde(rename = "E_MUX")]
    Mux,
    #[serde(rename = "E_WORKER_CRASH")]
    WorkerCrash,
    #[serde(rename = "E_NET_OFFLINE")]
    NetOffline,
    #[serde(rename = "E_NET_TIMEOUT")]
    NetTimeout,
    #[serde(rename = "E_API_5XX")]
    Api5xx,
    #[serde(rename = "E_API_RATE_LIMITED")]
    ApiRateLimited,
    #[serde(rename = "E_AUTH_LINK_INVALID")]
    AuthLinkInvalid,
    #[serde(rename = "E_AUTH_LINK_EXPIRED")]
    AuthLinkExpired,
    #[serde(rename = "E_AUTH_SESSION_EXPIRED")]
    AuthSessionExpired,
    #[serde(rename = "E_AUTH_EMAIL_UNAVAILABLE")]
    AuthEmailUnavailable,
    #[serde(rename = "E_BILLING_UNAVAILABLE")]
    BillingUnavailable,
    #[serde(rename = "E_BILLING_PENDING")]
    BillingPending,
    #[serde(rename = "E_ENTITLEMENT_INVALID")]
    EntitlementInvalid,
    #[serde(rename = "E_ENTITLEMENT_EXPIRED")]
    EntitlementExpired,
    #[serde(rename = "E_INTERNAL")]
    Internal,
}

/// Why the browser cannot run Offcut, in the check order of TS §13.2.
/// The first failing check in this order is the reported reason.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, TS)]
pub enum UnsupportedReason {
    #[serde(rename = "UNSUPPORTED_MOBILE")]
    Mobile,
    #[serde(rename = "UNSUPPORTED_WEBCODECS")]
    WebCodecs,
    #[serde(rename = "UNSUPPORTED_THREADS")]
    Threads,
    #[serde(rename = "UNSUPPORTED_WASM_SIMD")]
    WasmSimd,
    #[serde(rename = "UNSUPPORTED_STORAGE")]
    Storage,
    #[serde(rename = "UNSUPPORTED_LOW_MEMORY")]
    LowMemory,
    #[serde(rename = "UNSUPPORTED_WEBGPU")]
    WebGpu,
    #[serde(rename = "UNSUPPORTED_H264_DECODE")]
    H264Decode,
    #[serde(rename = "UNSUPPORTED_H264_ENCODE")]
    H264Encode,
    #[serde(rename = "UNSUPPORTED_AAC_DECODE")]
    AacDecode,
    #[serde(rename = "UNSUPPORTED_AAC_ENCODE")]
    AacEncode,
}

/// Where a failure happened: the six pipeline stages, then five places outside the pipeline.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
pub enum FailureStage {
    ProbeAudio,
    Asr,
    AudioChain,
    DetectScene,
    RenderEncode,
    Mux,
    Import,
    Model,
    Preview,
    Storage,
    Api,
}

impl From<PipelineStage> for FailureStage {
    fn from(stage: PipelineStage) -> Self {
        match stage {
            PipelineStage::ProbeAudio => Self::ProbeAudio,
            PipelineStage::Asr => Self::Asr,
            PipelineStage::AudioChain => Self::AudioChain,
            PipelineStage::DetectScene => Self::DetectScene,
            PipelineStage::RenderEncode => Self::RenderEncode,
            PipelineStage::Mux => Self::Mux,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// TS §11.2, in its order.
    const ERROR_CODES: [&str; 29] = [
        "E_MODEL_DOWNLOAD",
        "E_MODEL_HASH",
        "E_MODEL_STORAGE",
        "E_STORAGE_QUOTA",
        "E_STORAGE_IO",
        "E_DECODE_AUDIO",
        "E_DECODE_VIDEO",
        "E_ASR_RUNTIME",
        "E_ASR_OOM",
        "E_DSP",
        "E_GPU_INIT",
        "E_GPU_LOST",
        "E_ENCODE_VIDEO",
        "E_ENCODE_AUDIO",
        "E_MUX",
        "E_WORKER_CRASH",
        "E_NET_OFFLINE",
        "E_NET_TIMEOUT",
        "E_API_5XX",
        "E_API_RATE_LIMITED",
        "E_AUTH_LINK_INVALID",
        "E_AUTH_LINK_EXPIRED",
        "E_AUTH_SESSION_EXPIRED",
        "E_AUTH_EMAIL_UNAVAILABLE",
        "E_BILLING_UNAVAILABLE",
        "E_BILLING_PENDING",
        "E_ENTITLEMENT_INVALID",
        "E_ENTITLEMENT_EXPIRED",
        "E_INTERNAL",
    ];

    /// TS §13.2, in its check order.
    const UNSUPPORTED_CODES: [&str; 11] = [
        "UNSUPPORTED_MOBILE",
        "UNSUPPORTED_WEBCODECS",
        "UNSUPPORTED_THREADS",
        "UNSUPPORTED_WASM_SIMD",
        "UNSUPPORTED_STORAGE",
        "UNSUPPORTED_LOW_MEMORY",
        "UNSUPPORTED_WEBGPU",
        "UNSUPPORTED_H264_DECODE",
        "UNSUPPORTED_H264_ENCODE",
        "UNSUPPORTED_AAC_DECODE",
        "UNSUPPORTED_AAC_ENCODE",
    ];

    const FAILURE_STAGES: [&str; 11] = [
        "probe_audio",
        "asr",
        "audio_chain",
        "detect_scene",
        "render_encode",
        "mux",
        "import",
        "model",
        "preview",
        "storage",
        "api",
    ];

    // Position in declaration order. None of the three matches has a wildcard,
    // so a new variant does not compile until it is given a place here.

    fn error_position(code: ErrorCode) -> usize {
        match code {
            ErrorCode::ModelDownload => 0,
            ErrorCode::ModelHash => 1,
            ErrorCode::ModelStorage => 2,
            ErrorCode::StorageQuota => 3,
            ErrorCode::StorageIo => 4,
            ErrorCode::DecodeAudio => 5,
            ErrorCode::DecodeVideo => 6,
            ErrorCode::AsrRuntime => 7,
            ErrorCode::AsrOom => 8,
            ErrorCode::Dsp => 9,
            ErrorCode::GpuInit => 10,
            ErrorCode::GpuLost => 11,
            ErrorCode::EncodeVideo => 12,
            ErrorCode::EncodeAudio => 13,
            ErrorCode::Mux => 14,
            ErrorCode::WorkerCrash => 15,
            ErrorCode::NetOffline => 16,
            ErrorCode::NetTimeout => 17,
            ErrorCode::Api5xx => 18,
            ErrorCode::ApiRateLimited => 19,
            ErrorCode::AuthLinkInvalid => 20,
            ErrorCode::AuthLinkExpired => 21,
            ErrorCode::AuthSessionExpired => 22,
            ErrorCode::AuthEmailUnavailable => 23,
            ErrorCode::BillingUnavailable => 24,
            ErrorCode::BillingPending => 25,
            ErrorCode::EntitlementInvalid => 26,
            ErrorCode::EntitlementExpired => 27,
            ErrorCode::Internal => 28,
        }
    }

    fn unsupported_position(reason: UnsupportedReason) -> usize {
        match reason {
            UnsupportedReason::Mobile => 0,
            UnsupportedReason::WebCodecs => 1,
            UnsupportedReason::Threads => 2,
            UnsupportedReason::WasmSimd => 3,
            UnsupportedReason::Storage => 4,
            UnsupportedReason::LowMemory => 5,
            UnsupportedReason::WebGpu => 6,
            UnsupportedReason::H264Decode => 7,
            UnsupportedReason::H264Encode => 8,
            UnsupportedReason::AacDecode => 9,
            UnsupportedReason::AacEncode => 10,
        }
    }

    fn stage_position(stage: FailureStage) -> usize {
        match stage {
            FailureStage::ProbeAudio => 0,
            FailureStage::Asr => 1,
            FailureStage::AudioChain => 2,
            FailureStage::DetectScene => 3,
            FailureStage::RenderEncode => 4,
            FailureStage::Mux => 5,
            FailureStage::Import => 6,
            FailureStage::Model => 7,
            FailureStage::Preview => 8,
            FailureStage::Storage => 9,
            FailureStage::Api => 10,
        }
    }

    fn union(names: &[&str]) -> String {
        let quoted: Vec<String> = names.iter().map(|name| format!("\"{name}\"")).collect();
        quoted.join(" | ")
    }

    #[test]
    fn error_code_has_29_codes_in_spec_order() {
        for (i, code) in ERROR_CODES.iter().enumerate() {
            let json = format!("\"{code}\"");
            let parsed: ErrorCode = serde_json::from_str(&json).unwrap();
            assert_eq!(error_position(parsed), i, "{code} is out of order");
            assert_eq!(serde_json::to_string(&parsed).unwrap(), json);
        }
        assert_eq!(
            ErrorCode::inline(&ts_rs::Config::default()),
            union(&ERROR_CODES)
        );
    }

    #[test]
    fn unsupported_reason_has_11_codes_in_check_order() {
        for (i, code) in UNSUPPORTED_CODES.iter().enumerate() {
            let json = format!("\"{code}\"");
            let parsed: UnsupportedReason = serde_json::from_str(&json).unwrap();
            assert_eq!(unsupported_position(parsed), i, "{code} is out of order");
            assert_eq!(serde_json::to_string(&parsed).unwrap(), json);
        }
        assert_eq!(
            UnsupportedReason::inline(&ts_rs::Config::default()),
            union(&UNSUPPORTED_CODES)
        );
    }

    #[test]
    fn failure_stage_has_11_snake_case_names() {
        for (i, name) in FAILURE_STAGES.iter().enumerate() {
            let json = format!("\"{name}\"");
            let parsed: FailureStage = serde_json::from_str(&json).unwrap();
            assert_eq!(stage_position(parsed), i, "{name} is out of order");
            assert_eq!(serde_json::to_string(&parsed).unwrap(), json);
        }
        assert_eq!(
            FailureStage::inline(&ts_rs::Config::default()),
            union(&FAILURE_STAGES)
        );
    }

    #[test]
    fn codes_reject_other_spellings() {
        for bad in [
            "\"MODEL_DOWNLOAD\"",
            "\"ModelDownload\"",
            "\"e_internal\"",
            "\"E_UNKNOWN\"",
        ] {
            assert!(
                serde_json::from_str::<ErrorCode>(bad).is_err(),
                "{bad} was accepted"
            );
        }
        for bad in [
            "\"Mobile\"",
            "\"unsupported_mobile\"",
            "\"UNSUPPORTED_SAFARI\"",
        ] {
            assert!(
                serde_json::from_str::<UnsupportedReason>(bad).is_err(),
                "{bad} was accepted"
            );
        }
        for bad in ["\"Api\"", "\"probeAudio\"", "\"export\""] {
            assert!(
                serde_json::from_str::<FailureStage>(bad).is_err(),
                "{bad} was accepted"
            );
        }
    }

    #[test]
    fn a_pipeline_stage_maps_to_the_failure_stage_of_the_same_name() {
        let stages = [
            PipelineStage::ProbeAudio,
            PipelineStage::Asr,
            PipelineStage::AudioChain,
            PipelineStage::DetectScene,
            PipelineStage::RenderEncode,
            PipelineStage::Mux,
        ];
        for (i, stage) in stages.into_iter().enumerate() {
            let failure = FailureStage::from(stage);
            assert_eq!(stage_position(failure), i);
            assert_eq!(
                serde_json::to_string(&failure).unwrap(),
                serde_json::to_string(&stage).unwrap()
            );
        }
    }
}
