//! Detected visual events (PS §12.5).

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::ids::{EventId, WordIdx, WordRange};
use crate::transcript::Quantity;
use crate::units::{Confidence, Span, TimeMs};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
pub enum EventKind {
    NumberReveal,
    ListReveal,
    FromTo,
    KeywordPop,
}

/// `at` is the time at which the item was spoken.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
pub struct ListItem {
    pub ordinal: u8,
    pub text: String,
    pub at: TimeMs,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum EventParams {
    NumberReveal {
        value: Quantity,
        label: Option<String>,
    },
    ListReveal {
        count: u8,
        header: String,
        items: Vec<ListItem>,
    },
    FromTo {
        from: Quantity,
        to: Quantity,
        label: Option<String>,
    },
    KeywordPop {
        word: WordIdx,
    },
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
pub struct DetectedEvent {
    pub id: EventId,
    pub kind: EventKind,
    pub span: Span,
    pub anchors: WordRange,
    pub params: EventParams,
    /// Always at least the kind's threshold; lower ones are never constructed.
    pub confidence: Confidence,
    pub enabled: bool,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::transcript::Unit;

    fn quantity(value: f64, display: &str) -> Quantity {
        Quantity {
            value,
            unit: Unit::Milliseconds,
            display: display.to_owned(),
        }
    }

    #[test]
    fn event_kind_serializes_as_snake_case() {
        let cases = [
            (EventKind::NumberReveal, "number_reveal"),
            (EventKind::ListReveal, "list_reveal"),
            (EventKind::FromTo, "from_to"),
            (EventKind::KeywordPop, "keyword_pop"),
        ];
        for (kind, name) in cases {
            let json = serde_json::to_string(&kind).unwrap();
            assert_eq!(json, format!("\"{name}\""));
            assert_eq!(serde_json::from_str::<EventKind>(&json).unwrap(), kind);
        }
    }

    #[test]
    fn event_params_are_tagged_with_kind() {
        let cases = [
            (
                EventParams::NumberReveal {
                    value: quantity(800.0, "800 ms"),
                    label: None,
                },
                serde_json::json!({
                    "kind": "number_reveal",
                    "value": { "value": 800.0, "unit": "milliseconds", "display": "800 ms" },
                    "label": null,
                }),
            ),
            (
                EventParams::ListReveal {
                    count: 2,
                    header: "2 REASONS".to_owned(),
                    items: vec![
                        ListItem {
                            ordinal: 1,
                            text: "it is fast".to_owned(),
                            at: TimeMs::new(1_000),
                        },
                        ListItem {
                            ordinal: 2,
                            text: "it is private".to_owned(),
                            at: TimeMs::new(2_500),
                        },
                    ],
                },
                serde_json::json!({
                    "kind": "list_reveal",
                    "count": 2,
                    "header": "2 REASONS",
                    "items": [
                        { "ordinal": 1, "text": "it is fast", "at": 1_000 },
                        { "ordinal": 2, "text": "it is private", "at": 2_500 },
                    ],
                }),
            ),
            (
                EventParams::FromTo {
                    from: quantity(800.0, "800 ms"),
                    to: quantity(120.0, "120 ms"),
                    label: Some("latency".to_owned()),
                },
                serde_json::json!({
                    "kind": "from_to",
                    "from": { "value": 800.0, "unit": "milliseconds", "display": "800 ms" },
                    "to": { "value": 120.0, "unit": "milliseconds", "display": "120 ms" },
                    "label": "latency",
                }),
            ),
            (
                EventParams::KeywordPop {
                    word: WordIdx::new(7),
                },
                serde_json::json!({ "kind": "keyword_pop", "word": 7 }),
            ),
        ];
        for (params, expected) in cases {
            let value = serde_json::to_value(&params).unwrap();
            assert_eq!(value, expected);
            assert_eq!(
                serde_json::from_value::<EventParams>(value).unwrap(),
                params
            );
        }
    }

    #[test]
    fn event_params_reject_an_unknown_or_missing_kind() {
        assert!(serde_json::from_str::<EventParams>(r#"{"kind":"warning","word":7}"#).is_err());
        assert!(serde_json::from_str::<EventParams>(r#"{"kind":"KeywordPop","word":7}"#).is_err());
        assert!(serde_json::from_str::<EventParams>(r#"{"word":7}"#).is_err());
    }

    #[test]
    fn event_params_typescript_is_a_union_tagged_with_kind() {
        let ts = EventParams::inline(&ts_rs::Config::default());
        for kind in ["number_reveal", "list_reveal", "from_to", "keyword_pop"] {
            assert!(
                ts.contains(&format!(r#""kind": "{kind}""#)),
                "{kind} is missing from {ts}"
            );
        }
        assert_eq!(ts.matches(r#""kind": "#).count(), 4, "{ts}");
        assert!(ts.contains("label: string | null"), "{ts}");
        assert!(ts.contains("word: WordIdx"), "{ts}");
    }

    #[test]
    fn detected_event_keeps_rust_field_names() {
        let event = DetectedEvent {
            id: EventId::new(42),
            kind: EventKind::KeywordPop,
            span: Span::new(TimeMs::new(1_000), TimeMs::new(1_400)).unwrap(),
            anchors: WordRange {
                start: WordIdx::new(7),
                end: WordIdx::new(8),
            },
            params: EventParams::KeywordPop {
                word: WordIdx::new(7),
            },
            confidence: Confidence::new(1.0).unwrap(),
            enabled: true,
        };
        let value = serde_json::to_value(&event).unwrap();
        assert_eq!(
            value,
            serde_json::json!({
                "id": "42",
                "kind": "keyword_pop",
                "span": { "start": 1_000, "end": 1_400 },
                "anchors": { "start": 7, "end": 8 },
                "params": { "kind": "keyword_pop", "word": 7 },
                "confidence": 1.0,
                "enabled": true,
            })
        );
        assert_eq!(
            serde_json::from_value::<DetectedEvent>(value).unwrap(),
            event
        );
    }
}
