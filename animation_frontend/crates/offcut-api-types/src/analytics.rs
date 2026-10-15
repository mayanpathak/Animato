//! The analytics allowlist: the only events the client may send and the only
//! properties each may carry. Every property is an enum, a `bool` or a `u32`;
//! no event can carry free text. The integer caps are enforced by the server.

use offcut_types::{
    AnonId, ErrorCode, EventKind, FailureStage, Orientation, PipelineStage, RejectReason, StyleId,
    UnsupportedReason,
};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

pub const MAX_EVENTS_PER_BATCH: usize = 50; // TS §22.1
pub const MAX_DURATION_MS: u32 = 3_600_000; // TS §22.6
pub const MAX_COUNT: u32 = 10_000; // TS §22.6

/// Declares the prop enums: each is a closed set of values, serialized as
/// `snake_case` strings. One line per enum, as in the table of v1implementation §7.2.
macro_rules! prop_enums {
    ($($name:ident: $($value:ident),+;)+) => {$(
        #[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, TS)]
        #[serde(rename_all = "snake_case")]
        pub enum $name {
            $($value),+
        }
    )+};
}

prop_enums! {
    HeroVariant: Outcome, Privacy;
    CheckResult: Pass, Fail;
    GpuVendor: Intel, Amd, Nvidia, Apple, Qualcomm, Other, Unknown;
    MemoryBucket: Lt4, Gb4, Gb8plus, Unknown;
    Platform: Windows, Macos, Linux, Chromeos, Android, Other, Unknown;
    DurationBucket: Lt30, Lt60, Lte90;
    ClipSource: User, Sample;
    DownloadOutcome: Ok, Failed, HashMismatch;
    AsrBackend: Webgpu, Wasm;
    ReviewActionKind: WordEdit, EventToggle, Style, CropOffset;
    ExportedAs: Free, Creator;
    PostExportAnswer: Yes, SmallEdits, No;
    PromptPlacement: AfterExport, LimitReached;
    PromptAction: Shown, Clicked, Dismissed;
    SigninStep: LinkRequested, Completed;
    CheckoutStep: Started, ReturnedSuccess, ReturnedCancel;
}

/// One variant per row of TS §22.6. A variant without props serializes as
/// `{"name":"preview_played"}`, with no `props` key.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
#[serde(tag = "name", content = "props", rename_all = "snake_case")]
#[serde(deny_unknown_fields)]
pub enum AnalyticsEvent {
    LandingView {
        hero_variant: HeroVariant,
    },
    CapabilityCheck {
        result: CheckResult,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        unsupported_reason: Option<UnsupportedReason>,
        gpu_vendor: GpuVendor,
        memory_bucket: MemoryBucket,
        platform: Platform,
    },
    ClipAccepted {
        duration_bucket: DurationBucket,
        orientation: Orientation,
        source: ClipSource,
    },
    ClipRejected {
        reject_reason: RejectReason,
    },
    ModelDownload {
        outcome: DownloadOutcome,
        duration_ms: u32,
        resumed: bool,
    },
    StageTiming {
        stage: PipelineStage,
        duration_ms: u32,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        asr_backend: Option<AsrBackend>,
    },
    PipelineDone {
        total_ms: u32,
        n_number: u32,
        n_list: u32,
        n_from_to: u32,
        n_keyword: u32,
    },
    PreviewPlayed,
    ReviewAction {
        action: ReviewActionKind,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        event_kind: Option<EventKind>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        enabled: Option<bool>,
    },
    ExportStarted {
        profile: ExportedAs,
    },
    ExportDone {
        total_ms: u32,
        profile: ExportedAs,
        word_edits: u32,
        events_kept: u32,
        events_disabled: u32,
        style: StyleId,
        crop_adjusted: bool,
        from_cache: bool,
    },
    ExportFailed {
        error_code: ErrorCode,
        stage: FailureStage,
    },
    JobCancelled {
        stage: FailureStage,
    },
    PostExportAnswer {
        answer: PostExportAnswer,
    },
    UpgradePrompt {
        placement: PromptPlacement,
        action: PromptAction,
    },
    SigninStep {
        step: SigninStep,
    },
    CheckoutStep {
        step: CheckoutStep,
    },
    ClientError {
        error_code: ErrorCode,
        stage: FailureStage,
    },
    LocalDataCleared,
}

impl AnalyticsEvent {
    /// The event's name on the wire and in the `analytics_events` table.
    pub fn name(&self) -> &'static str {
        match self {
            Self::LandingView { .. } => "landing_view",
            Self::CapabilityCheck { .. } => "capability_check",
            Self::ClipAccepted { .. } => "clip_accepted",
            Self::ClipRejected { .. } => "clip_rejected",
            Self::ModelDownload { .. } => "model_download",
            Self::StageTiming { .. } => "stage_timing",
            Self::PipelineDone { .. } => "pipeline_done",
            Self::PreviewPlayed => "preview_played",
            Self::ReviewAction { .. } => "review_action",
            Self::ExportStarted { .. } => "export_started",
            Self::ExportDone { .. } => "export_done",
            Self::ExportFailed { .. } => "export_failed",
            Self::JobCancelled { .. } => "job_cancelled",
            Self::PostExportAnswer { .. } => "post_export_answer",
            Self::UpgradePrompt { .. } => "upgrade_prompt",
            Self::SigninStep { .. } => "signin_step",
            Self::CheckoutStep { .. } => "checkout_step",
            Self::ClientError { .. } => "client_error",
            Self::LocalDataCleared => "local_data_cleared",
        }
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
#[serde(deny_unknown_fields)]
pub struct EventsBatch {
    pub anon_id: AnonId,
    pub events: Vec<AnalyticsEvent>,
}

/// One row of the "what leaves your device" table on the settings page.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct EventDoc {
    pub name: &'static str,
    pub description: &'static str,
}

const fn doc(name: &'static str, description: &'static str) -> EventDoc {
    EventDoc { name, description }
}

/// One entry per event, in the order of the enum. Each description is one
/// plain-language sentence, shown to the user as written.
#[rustfmt::skip]
pub const ANALYTICS_EVENT_DOCS: &[EventDoc] = &[
    doc("landing_view", "That the landing page was opened, and which of our headlines it showed."),
    doc("capability_check", "Whether this browser can run Offcut and, if not, why, with the maker of the graphics chip, a rough memory size and the operating system family."),
    doc("clip_accepted", "That a clip was accepted, with its rough length, its orientation and whether it was your own clip or the sample."),
    doc("clip_rejected", "That a clip could not be used, and which rule it broke."),
    doc("model_download", "Whether the speech model downloaded, how long that took and whether the download was resumed."),
    doc("stage_timing", "How long each processing stage took."),
    doc("pipeline_done", "How long processing took in total, and how many numbers, lists, comparisons and keywords were found."),
    doc("preview_played", "That the preview was played."),
    doc("review_action", "That you changed something while reviewing, and what kind of change it was, never the words themselves."),
    doc("export_started", "That an export started, and whether it was a free or a Creator export."),
    doc("export_done", "That an export finished, with how long it took, how many words you edited, how many visual moments you kept or turned off, the caption style and whether you moved the crop."),
    doc("export_failed", "That an export failed, with the error code and the stage it failed in."),
    doc("job_cancelled", "That you cancelled a job, and at which stage."),
    doc("post_export_answer", "Your answer to the one question we ask after an export."),
    doc("upgrade_prompt", "That an upgrade prompt was shown, clicked or dismissed, and where it appeared."),
    doc("signin_step", "That a sign-in link was requested or that sign-in was completed, never the email address."),
    doc("checkout_step", "That checkout was started, completed or cancelled."),
    doc("client_error", "That something went wrong, with the error code and the stage it happened in."),
    doc("local_data_cleared", "That you cleared the data Offcut keeps in this browser."),
];

#[cfg(test)]
mod tests {
    use super::*;

    /// One sample per variant, in enum order, exactly as the client sends it.
    const SAMPLES: [&str; 19] = [
        r#"{"name":"landing_view","props":{"hero_variant":"outcome"}}"#,
        r#"{"name":"capability_check","props":{"result":"fail","unsupported_reason":"UNSUPPORTED_WEBGPU","gpu_vendor":"intel","memory_bucket":"gb8plus","platform":"windows"}}"#,
        r#"{"name":"clip_accepted","props":{"duration_bucket":"lt60","orientation":"portrait","source":"user"}}"#,
        r#"{"name":"clip_rejected","props":{"reject_reason":"REJECT_HEVC"}}"#,
        r#"{"name":"model_download","props":{"outcome":"hash_mismatch","duration_ms":41000,"resumed":true}}"#,
        r#"{"name":"stage_timing","props":{"stage":"asr","duration_ms":18000,"asr_backend":"webgpu"}}"#,
        r#"{"name":"pipeline_done","props":{"total_ms":52000,"n_number":2,"n_list":1,"n_from_to":1,"n_keyword":3}}"#,
        r#"{"name":"preview_played"}"#,
        r#"{"name":"review_action","props":{"action":"event_toggle","event_kind":"from_to","enabled":false}}"#,
        r#"{"name":"export_started","props":{"profile":"free"}}"#,
        r#"{"name":"export_done","props":{"total_ms":88000,"profile":"creator","word_edits":2,"events_kept":4,"events_disabled":1,"style":"bold","crop_adjusted":true,"from_cache":false}}"#,
        r#"{"name":"export_failed","props":{"error_code":"E_ENCODE_VIDEO","stage":"render_encode"}}"#,
        r#"{"name":"job_cancelled","props":{"stage":"model"}}"#,
        r#"{"name":"post_export_answer","props":{"answer":"small_edits"}}"#,
        r#"{"name":"upgrade_prompt","props":{"placement":"limit_reached","action":"clicked"}}"#,
        r#"{"name":"signin_step","props":{"step":"link_requested"}}"#,
        r#"{"name":"checkout_step","props":{"step":"returned_success"}}"#,
        r#"{"name":"client_error","props":{"error_code":"E_WORKER_CRASH","stage":"import"}}"#,
        r#"{"name":"local_data_cleared"}"#,
    ];

    fn parse(json: &str) -> serde_json::Result<AnalyticsEvent> {
        serde_json::from_str(json)
    }

    #[test]
    fn each_variant_round_trips_in_the_name_props_shape() {
        for (sample, doc) in SAMPLES.iter().zip(ANALYTICS_EVENT_DOCS) {
            let event = parse(sample).unwrap();
            assert_eq!(event.name(), doc.name);
            let written = serde_json::to_string(&event).unwrap();
            assert_eq!(written, *sample);
            assert_eq!(parse(&written).unwrap(), event);

            let value: serde_json::Value = serde_json::from_str(sample).unwrap();
            let keys: Vec<&str> = value
                .as_object()
                .unwrap()
                .keys()
                .map(|k| k.as_str())
                .collect();
            assert!(keys == ["name", "props"] || keys == ["name"], "{sample}");
            assert_eq!(value["name"], doc.name);
        }
    }

    #[test]
    fn names_match_the_docs_in_order_without_duplicates() {
        assert_eq!(ANALYTICS_EVENT_DOCS.len(), SAMPLES.len());
        let union = AnalyticsEvent::inline(&ts_rs::Config::default());
        assert_eq!(
            union.matches(r#""name": "#).count(),
            ANALYTICS_EVENT_DOCS.len(),
            "{union}"
        );

        let mut seen = std::collections::BTreeSet::new();
        let mut last = 0;
        for doc in ANALYTICS_EVENT_DOCS {
            assert!(seen.insert(doc.name), "{} appears twice", doc.name);
            let at = union.find(&format!(r#""name": "{}""#, doc.name)).unwrap();
            assert!(at >= last, "{} is out of enum order", doc.name);
            last = at;

            let text = doc.description;
            let one_sentence = text.ends_with('.') && text.matches('.').count() == 1;
            assert!(one_sentence && !text.contains('\n'), "{text}");
        }
    }

    #[test]
    fn optional_props_may_be_left_out() {
        for json in [
            r#"{"name":"capability_check","props":{"result":"pass","gpu_vendor":"unknown","memory_bucket":"lt4","platform":"other"}}"#,
            r#"{"name":"stage_timing","props":{"stage":"mux","duration_ms":900}}"#,
            r#"{"name":"review_action","props":{"action":"style"}}"#,
        ] {
            assert_eq!(serde_json::to_string(&parse(json).unwrap()).unwrap(), json);
        }
    }

    #[test]
    fn anything_off_the_allowlist_is_rejected() {
        for json in [
            // An unknown prop, an unknown event name, an unknown key beside name and props.
            r#"{"name":"landing_view","props":{"hero_variant":"outcome","extra":1}}"#,
            r#"{"name":"page_scrolled","props":{}}"#,
            r#"{"name":"landing_view","props":{"hero_variant":"outcome"},"ts":1700000000}"#,
            // Free text or a number where an enum is expected.
            r#"{"name":"landing_view","props":{"hero_variant":"my clip about taxes"}}"#,
            r#"{"name":"landing_view","props":{"hero_variant":7}}"#,
            r#"{"name":"clip_rejected","props":{"reject_reason":"hevc"}}"#,
            // Text where a number or a boolean is expected; a number that is not a u32.
            r#"{"name":"model_download","props":{"outcome":"ok","duration_ms":"fast","resumed":true}}"#,
            r#"{"name":"model_download","props":{"outcome":"ok","duration_ms":1,"resumed":"yes"}}"#,
            r#"{"name":"model_download","props":{"outcome":"ok","duration_ms":-1,"resumed":true}}"#,
            r#"{"name":"model_download","props":{"outcome":"ok","duration_ms":4294967296,"resumed":true}}"#,
            // A missing prop, missing props, a missing name.
            r#"{"name":"landing_view","props":{}}"#,
            r#"{"name":"landing_view"}"#,
            r#"{"props":{"hero_variant":"outcome"}}"#,
            // Props on an event that has none.
            r#"{"name":"preview_played","props":{"note":"hi"}}"#,
            r#"{"name":"preview_played","props":"free text"}"#,
        ] {
            assert!(parse(json).is_err(), "{json} was accepted");
        }
    }

    #[test]
    fn prop_enums_have_exactly_the_values_of_the_spec() {
        let cfg = ts_rs::Config::default();
        // v1implementation §7.2, row for row.
        #[rustfmt::skip]
        let table = [
            (HeroVariant::inline(&cfg), "outcome, privacy"),
            (CheckResult::inline(&cfg), "pass, fail"),
            (GpuVendor::inline(&cfg), "intel, amd, nvidia, apple, qualcomm, other, unknown"),
            (MemoryBucket::inline(&cfg), "lt4, gb4, gb8plus, unknown"),
            (Platform::inline(&cfg), "windows, macos, linux, chromeos, android, other, unknown"),
            (DurationBucket::inline(&cfg), "lt30, lt60, lte90"),
            (ClipSource::inline(&cfg), "user, sample"),
            (DownloadOutcome::inline(&cfg), "ok, failed, hash_mismatch"),
            (AsrBackend::inline(&cfg), "webgpu, wasm"),
            (ReviewActionKind::inline(&cfg), "word_edit, event_toggle, style, crop_offset"),
            (ExportedAs::inline(&cfg), "free, creator"),
            (PostExportAnswer::inline(&cfg), "yes, small_edits, no"),
            (PromptPlacement::inline(&cfg), "after_export, limit_reached"),
            (PromptAction::inline(&cfg), "shown, clicked, dismissed"),
            (SigninStep::inline(&cfg), "link_requested, completed"),
            (CheckoutStep::inline(&cfg), "started, returned_success, returned_cancel"),
        ];
        assert_eq!(table.len(), 16);
        for (union, values) in table {
            assert_eq!(union.replace('"', "").replace(" | ", ", "), values);
        }
    }

    #[test]
    fn events_batch_round_trips_and_denies_unknown_fields() {
        let id = "0190f3a2-7b1c-7def-8a55-0123456789ab";
        let events = format!("[{},{}]", SAMPLES[0], SAMPLES[7]);
        let json = format!(r#"{{"anon_id":"{id}","events":{events}}}"#);
        let batch: EventsBatch = serde_json::from_str(&json).unwrap();
        assert_eq!(batch.events.len(), 2);
        assert_eq!(serde_json::to_string(&batch).unwrap(), json);

        for bad in [
            format!(r#"{{"anon_id":"{id}","events":{events},"user_id":"{id}"}}"#),
            format!(r#"{{"anon_id":"me","events":{events}}}"#),
            format!(r#"{{"events":{events}}}"#),
            format!(
                r#"{{"anon_id":"{id}","events":[{},{{"name":"x"}}]}}"#,
                SAMPLES[0]
            ),
        ] {
            assert!(
                serde_json::from_str::<EventsBatch>(&bad).is_err(),
                "{bad} was accepted"
            );
        }
    }

    #[test]
    fn no_event_can_carry_text() {
        // The owned-text type must not be named anywhere above the tests, and
        // no prop may be typed as text in the generated TypeScript.
        let code = include_str!("analytics.rs")
            .split("#[cfg(test)]")
            .next()
            .unwrap();
        assert!(!code.contains(concat!("Str", "ing")));
        let union = AnalyticsEvent::inline(&ts_rs::Config::default());
        assert!(
            !union.contains(": string") && !union.contains("unknown"),
            "{union}"
        );
    }
}
