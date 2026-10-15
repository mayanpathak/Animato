//! JavaScript bindings for the render WASM bundle: the session that draws a
//! clip, the detector, the export profile and the MP4 muxer, and the
//! conversion of their values. This crate installs the panic hook. It holds
//! no product rule and does not branch on a domain value beyond decoding an
//! argument and mapping an error to a code (TS §2).

mod detect_api;
mod mux_api;
mod profile_api;
mod session;

use std::collections::BTreeMap;
use std::panic::{self, PanicHookInfo};
use std::sync::Once;

use offcut_types::{ErrorCode, WordIdx};
use serde::Serialize;
use serde::de::DeserializeOwned;
use serde_wasm_bindgen::Serializer;
use wasm_bindgen::JsValue;
use wasm_bindgen::prelude::wasm_bindgen;

/// Every error thrown for a panic starts with this code. A worker recognises
/// a crash by it, reports `E_WORKER_CRASH` and is replaced (TS §11.3).
const CRASH_CODE: &str = "E_WORKER_CRASH";

/// Runs when the module is instantiated. Installs the panic hook; calling it
/// again does nothing.
#[wasm_bindgen(start)]
pub fn init() {
    static HOOK: Once = Once::new();
    HOOK.call_once(|| panic::set_hook(Box::new(throw_crash)));
}

/// What a fallible export throws (TS §11.1).
#[derive(Serialize)]
struct Failure {
    code: ErrorCode,
    detail: &'static str,
}

/// The plain object `{ code, detail }`. `detail` is the name of an enum
/// variant or of an argument: never content of a file, a token or text of a
/// transcript.
pub(crate) fn failure(code: ErrorCode, detail: &'static str) -> JsValue {
    let failure = Failure { code, detail };
    // A struct of two strings always serializes; the code alone is the fallback.
    to_plain(&failure).unwrap_or_else(|_| JsValue::from_str("E_INTERNAL"))
}

/// A Rust value as the plain JavaScript value the generated types describe:
/// maps as objects, `None` as `null`, wide integers as numbers (D-31).
pub(crate) fn to_plain<T: Serialize>(value: &T) -> Result<JsValue, serde_wasm_bindgen::Error> {
    value.serialize(&Serializer::json_compatible())
}

/// A value for JavaScript, or the failure every serialization problem becomes.
pub(crate) fn to_js<T: Serialize>(value: &T) -> Result<JsValue, JsValue> {
    to_plain(value).map_err(|_| failure(ErrorCode::Internal, "Serialize"))
}

/// An argument read into its Rust type. One that has another shape is the
/// caller's fault, and the caller is the app's own worker: `E_INTERNAL`,
/// with the name of the argument.
pub(crate) fn from_js<T: DeserializeOwned>(
    value: JsValue,
    name: &'static str,
) -> Result<T, JsValue> {
    serde_wasm_bindgen::from_value(value).map_err(|_| failure(ErrorCode::Internal, name))
}

/// The word edits of JavaScript, `{ "3": "text" }`, by word. The key of a
/// JavaScript object is a string, also when it stands for a number. `None`
/// for a key that is not a word number as JavaScript writes one.
pub(crate) fn word_edits(by_key: BTreeMap<String, String>) -> Option<BTreeMap<WordIdx, String>> {
    by_key
        .into_iter()
        .map(|(key, text)| {
            let word = key.parse::<u32>().ok().filter(|n| n.to_string() == key)?;
            Some((WordIdx::new(word), text))
        })
        .collect()
}

/// The panic hook: turns a panic into a JavaScript exception. It writes
/// nothing to the console.
fn throw_crash(info: &PanicHookInfo<'_>) {
    let location = info.location();
    let location = location.map(|at| (at.file(), at.line(), at.column()));
    wasm_bindgen::throw_str(&crash_message(location, panic_text(info)));
}

/// What the panic said. Only in debug builds: the text of a panic can quote
/// the data that caused it, and a release build must not carry that further.
fn panic_text<'a>(info: &'a PanicHookInfo<'_>) -> Option<&'a str> {
    if cfg!(debug_assertions) {
        info.payload_as_str()
    } else {
        None
    }
}

/// `E_WORKER_CRASH`, then where the panic happened and what it said, as far
/// as each is known.
fn crash_message(location: Option<(&str, u32, u32)>, text: Option<&str>) -> String {
    let mut message = CRASH_CODE.to_owned();
    if let Some((file, line, column)) = location {
        message.push_str(&format!(" at {file}:{line}:{column}"));
    }
    if let Some(text) = text {
        message.push_str(&format!(": {text}"));
    }
    message
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_crash_message_always_starts_with_the_code() {
        let at = Some(("src/lib.rs", 12, 5));
        let cases = [
            (None, None, "E_WORKER_CRASH"),
            (at, None, "E_WORKER_CRASH at src/lib.rs:12:5"),
            (None, Some("boom"), "E_WORKER_CRASH: boom"),
            (at, Some("boom"), "E_WORKER_CRASH at src/lib.rs:12:5: boom"),
        ];
        for (location, text, expected) in cases {
            let message = crash_message(location, text);
            assert_eq!(message, expected);
            assert!(message.starts_with(CRASH_CODE));
        }
        let code = serde_json::to_value(ErrorCode::WorkerCrash).unwrap();
        assert_eq!(code, CRASH_CODE);
    }

    #[test]
    fn word_edits_are_read_by_word_number_and_nothing_else_is_a_key() {
        let edits = |pairs: &[(&str, &str)]| {
            word_edits(
                pairs
                    .iter()
                    .map(|(key, text)| ((*key).to_owned(), (*text).to_owned()))
                    .collect(),
            )
        };
        let read = edits(&[("0", "Hi"), ("12", ""), ("4294967295", "last")]).unwrap();
        let words: Vec<(u32, &str)> = read
            .iter()
            .map(|(word, text)| (word.get(), text.as_str()))
            .collect();
        assert_eq!(words, [(0, "Hi"), (12, ""), (u32::MAX, "last")]);
        assert_eq!(edits(&[]), Some(BTreeMap::new()));
        // A key JavaScript would not write for a word number.
        for key in ["", "-1", "1.5", "01", "+1", " 1", "one", "4294967296"] {
            assert_eq!(edits(&[("3", "ok"), (key, "x")]), None, "{key:?}");
        }
    }
}
