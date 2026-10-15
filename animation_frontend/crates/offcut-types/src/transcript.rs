//! The transcript of a clip (PS §12.5). Every time in it is the time at which
//! the word was spoken in the recording; there is no time-map type.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::ids::WordRange;
use crate::units::{Confidence, TimeMs};

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
pub struct Word {
    pub text: String,
    pub start_ms: TimeMs,
    pub end_ms: TimeMs,
    pub confidence: Confidence,
}

/// `words` is a range, because sentences never overlap.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
pub struct Sentence {
    pub words: WordRange,
    pub start_ms: TimeMs,
    pub end_ms: TimeMs,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
pub enum Unit {
    None,
    Usd,
    Eur,
    Gbp,
    Inr,
    Percent,
    Milliseconds,
    Seconds,
    Minutes,
    Hours,
    Days,
    Weeks,
    Months,
    Years,
    Times,
    Bytes,
    Kilobytes,
    Megabytes,
    Gigabytes,
    Count { noun: String },
}

/// `display` is the caption form: "$10k", "800 ms", "10,000".
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
pub struct Quantity {
    pub value: f64,
    pub unit: Unit,
    pub display: String,
}

/// A run of spoken words that is one quantity: "ten thousand" → 10,000.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
pub struct NormalizedSpan {
    pub words: WordRange,
    pub quantity: Quantity,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
pub struct Transcript {
    pub words: Vec<Word>,
    pub sentences: Vec<Sentence>,
    pub numbers: Vec<NormalizedSpan>,
    pub model_version: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ids::WordIdx;

    fn range(start: u32, end: u32) -> WordRange {
        WordRange {
            start: WordIdx::new(start),
            end: WordIdx::new(end),
        }
    }

    #[test]
    fn unit_without_data_is_a_snake_case_string() {
        let cases = [
            (Unit::None, "none"),
            (Unit::Usd, "usd"),
            (Unit::Percent, "percent"),
            (Unit::Milliseconds, "milliseconds"),
            (Unit::Times, "times"),
            (Unit::Gigabytes, "gigabytes"),
        ];
        for (unit, name) in cases {
            let json = serde_json::to_string(&unit).unwrap();
            assert_eq!(json, format!("\"{name}\""));
            assert_eq!(serde_json::from_str::<Unit>(&json).unwrap(), unit);
        }
    }

    #[test]
    fn unit_count_carries_its_noun() {
        let unit = Unit::Count {
            noun: "events".to_owned(),
        };
        let json = serde_json::to_string(&unit).unwrap();
        assert_eq!(json, r#"{"count":{"noun":"events"}}"#);
        assert_eq!(serde_json::from_str::<Unit>(&json).unwrap(), unit);
        assert!(serde_json::from_str::<Unit>("\"count\"").is_err());
    }

    #[test]
    fn unit_typescript_has_19_strings_and_one_object() {
        let ts = Unit::inline(&ts_rs::Config::default());
        assert!(
            ts.starts_with(r#""none" | "usd" | "eur" | "gbp" | "inr" | "percent" | "#),
            "{ts}"
        );
        assert!(
            ts.ends_with(r#""gigabytes" | { "count": { noun: string, } }"#),
            "{ts}"
        );
        assert_eq!(ts.matches(" | ").count(), 19, "{ts}");
    }

    #[test]
    fn transcript_keeps_rust_field_names() {
        let transcript = Transcript {
            words: vec![Word {
                text: "ten".to_owned(),
                start_ms: TimeMs::new(120),
                end_ms: TimeMs::new(300),
                confidence: Confidence::new(0.5).unwrap(),
            }],
            sentences: vec![Sentence {
                words: range(0, 1),
                start_ms: TimeMs::new(120),
                end_ms: TimeMs::new(300),
            }],
            numbers: vec![NormalizedSpan {
                words: range(0, 1),
                quantity: Quantity {
                    value: 10.0,
                    unit: Unit::Usd,
                    display: "$10".to_owned(),
                },
            }],
            model_version: "test-model".to_owned(),
        };
        let value = serde_json::to_value(&transcript).unwrap();
        assert_eq!(
            value,
            serde_json::json!({
                "words": [{ "text": "ten", "start_ms": 120, "end_ms": 300, "confidence": 0.5 }],
                "sentences": [{ "words": { "start": 0, "end": 1 }, "start_ms": 120, "end_ms": 300 }],
                "numbers": [{
                    "words": { "start": 0, "end": 1 },
                    "quantity": { "value": 10.0, "unit": "usd", "display": "$10" },
                }],
                "model_version": "test-model",
            })
        );
        assert_eq!(
            serde_json::from_value::<Transcript>(value).unwrap(),
            transcript
        );
    }

    #[test]
    fn word_with_a_bad_confidence_is_rejected() {
        let json = r#"{"text":"ten","start_ms":0,"end_ms":1,"confidence":1.5}"#;
        assert!(serde_json::from_str::<Word>(json).is_err());
    }
}
