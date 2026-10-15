//! The export of `offcut-detect`: the visual events of a transcript.

use std::collections::BTreeMap;

use offcut_detect::{DetectorConfig, detect as detect_events};
use offcut_types::{ErrorCode, Prosody, Transcript};
use wasm_bindgen::JsValue;
use wasm_bindgen::prelude::wasm_bindgen;

use crate::{failure, from_js, to_js, word_edits};

/// `DetectedEvent[]`, in the order the events are spoken. `edits` is the
/// user's word edits, `{ [word number]: text }`. The detector's settings are
/// its defaults: nothing outside the detector chooses a threshold.
#[wasm_bindgen]
pub fn detect(transcript: JsValue, prosody: JsValue, edits: JsValue) -> Result<JsValue, JsValue> {
    let transcript: Transcript = from_js(transcript, "Transcript")?;
    let prosody: Prosody = from_js(prosody, "Prosody")?;
    let edits: BTreeMap<String, String> = from_js(edits, "Edits")?;
    let edits = word_edits(edits).ok_or_else(|| failure(ErrorCode::Internal, "Edits"))?;
    let events = detect_events(&transcript, &prosody, &edits, &DetectorConfig::default());
    to_js(&events)
}
