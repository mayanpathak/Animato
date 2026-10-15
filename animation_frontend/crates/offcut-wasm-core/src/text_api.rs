//! The export of `offcut-text`: the words a recognizer returned, as a
//! transcript with its sentences and its numbers.

use offcut_text::RawWord;
use offcut_types::ErrorCode;
use wasm_bindgen::JsValue;
use wasm_bindgen::prelude::wasm_bindgen;

use crate::{failure, to_js};

/// `raw` is an array of `{ text, startMs, endMs, confidence }` (TS §16.2),
/// with whole milliseconds. Anything else is a fault of the caller.
#[wasm_bindgen]
pub fn normalize_transcript(raw: JsValue, model_version: &str) -> Result<JsValue, JsValue> {
    let raw: Vec<RawWord> = serde_wasm_bindgen::from_value(raw)
        .map_err(|_| failure(ErrorCode::Internal, "RawWords"))?;
    to_js(&offcut_text::normalize_transcript(raw, model_version))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The shape the worker sends, read natively: the binding itself needs
    /// a JavaScript engine.
    #[test]
    fn a_raw_word_is_read_in_camel_case_and_nothing_else() {
        let words: Vec<RawWord> =
            serde_json::from_str(r#"[{"text":"ten","startMs":120,"endMs":300,"confidence":0.5}]"#)
                .unwrap();
        assert_eq!(
            words,
            [RawWord {
                text: "ten".to_owned(),
                start_ms: 120,
                end_ms: 300,
                confidence: 0.5,
            }]
        );

        let refused = [
            // The Rust names, a field too many, a field too few, a time that is not whole.
            r#"[{"text":"ten","start_ms":120,"end_ms":300,"confidence":0.5}]"#,
            r#"[{"text":"ten","startMs":120,"endMs":300,"confidence":0.5,"speaker":1}]"#,
            r#"[{"text":"ten","startMs":120,"endMs":300}]"#,
            r#"[{"text":"ten","startMs":120.5,"endMs":300,"confidence":0.5}]"#,
            r#"[{"text":"ten","startMs":-1,"endMs":300,"confidence":0.5}]"#,
        ];
        for json in refused {
            assert!(
                serde_json::from_str::<Vec<RawWord>>(json).is_err(),
                "{json}"
            );
        }
    }
}
