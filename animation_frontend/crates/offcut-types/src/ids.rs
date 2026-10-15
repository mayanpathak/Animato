//! Id types. No function here generates an id: generation needs randomness or
//! a clock, so it happens in TypeScript (`crypto.randomUUID()`) and in the server.

use serde::de::Error as _;
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use ts_rs::TS;
use uuid::Uuid;

/// v4, created on import (in the browser).
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize, TS)]
#[serde(transparent)]
pub struct ClipId(#[ts(type = "string")] Uuid);

/// v7, created per export; the usage-receipt idempotency key.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize, TS)]
#[serde(transparent)]
pub struct ExportId(#[ts(type = "string")] Uuid);

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize, TS)]
#[serde(transparent)]
pub struct UserId(#[ts(type = "string")] Uuid);

/// Per-browser analytics id.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize, TS)]
#[serde(transparent)]
pub struct AnonId(#[ts(type = "string")] Uuid);

/// Stable hash, TS §17.6. Serialized as a decimal string, because a JavaScript
/// number cannot hold 64 bits.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, TS)]
pub struct EventId(#[ts(type = "string")] u64);

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize, TS)]
#[serde(transparent)]
pub struct WordIdx(u32);

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize, TS)]
#[serde(transparent)]
pub struct SentenceIdx(u32);

/// Half-open: `start` is included, `end` is not.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize, TS)]
pub struct WordRange {
    pub start: WordIdx,
    pub end: WordIdx,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize, TS)]
#[serde(transparent)]
pub struct JobId(u32);

macro_rules! id {
    ($($name:ident: $inner:ty),+ $(,)?) => {$(
        impl $name {
            pub const fn new(v: $inner) -> Self {
                Self(v)
            }

            pub const fn get(self) -> $inner {
                self.0
            }
        }
    )+};
}

id! {
    ClipId: Uuid,
    ExportId: Uuid,
    UserId: Uuid,
    AnonId: Uuid,
    EventId: u64,
    WordIdx: u32,
    SentenceIdx: u32,
    JobId: u32,
}

impl Serialize for EventId {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.collect_str(&self.0)
    }
}

impl<'de> Deserialize<'de> for EventId {
    /// Accepts only the form `serialize` writes: decimal digits, no sign, no
    /// leading zeros. One id then has exactly one string.
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let s = String::deserialize(deserializer)?;
        let canonical = s.parse::<u64>().ok().filter(|v| v.to_string() == s);
        canonical.map(Self).ok_or_else(|| {
            D::Error::custom("an event id must be a u64 written as a decimal string")
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const UUID: &str = "0190f3a2-7b1c-7def-8a55-0123456789ab";

    #[test]
    fn uuid_id_round_trips_as_a_hyphenated_string() {
        let id = ClipId::new(Uuid::parse_str(UUID).unwrap());
        let json = serde_json::to_string(&id).unwrap();
        assert_eq!(json, format!("\"{UUID}\""));
        assert_eq!(serde_json::from_str::<ClipId>(&json).unwrap(), id);
        assert_eq!(id.get().to_string(), UUID);
        assert!(serde_json::from_str::<ClipId>("\"not-a-uuid\"").is_err());
    }

    #[test]
    fn integer_id_round_trips_as_a_bare_number() {
        let json = serde_json::to_string(&WordIdx::new(7)).unwrap();
        assert_eq!(json, "7");
        assert_eq!(
            serde_json::from_str::<WordIdx>(&json).unwrap(),
            WordIdx::new(7)
        );
        assert_eq!(serde_json::to_string(&JobId::new(3)).unwrap(), "3");
    }

    #[test]
    fn event_id_round_trips_as_a_decimal_string() {
        let id = EventId::new(u64::MAX);
        let json = serde_json::to_string(&id).unwrap();
        assert_eq!(json, "\"18446744073709551615\"");
        assert_eq!(serde_json::from_str::<EventId>(&json).unwrap(), id);
        assert_eq!(
            serde_json::from_str::<EventId>("\"0\"").unwrap(),
            EventId::new(0)
        );
    }

    #[test]
    fn event_id_rejects_every_other_form() {
        for bad in [
            "42",
            "\"\"",
            "\"+42\"",
            "\"-1\"",
            "\"042\"",
            "\"4 2\"",
            "\"0x2a\"",
            "\"18446744073709551616\"",
        ] {
            assert!(
                serde_json::from_str::<EventId>(bad).is_err(),
                "{bad} was accepted"
            );
        }
    }

    #[test]
    fn event_id_works_as_a_map_key() {
        let mut map = std::collections::BTreeMap::new();
        map.insert(EventId::new(42), true);
        let json = serde_json::to_string(&map).unwrap();
        assert_eq!(json, r#"{"42":true}"#);
        let back: std::collections::BTreeMap<EventId, bool> = serde_json::from_str(&json).unwrap();
        assert_eq!(back, map);
    }

    #[test]
    fn word_range_round_trips_with_rust_field_names() {
        let range = WordRange {
            start: WordIdx::new(2),
            end: WordIdx::new(5),
        };
        let json = serde_json::to_string(&range).unwrap();
        assert_eq!(json, r#"{"start":2,"end":5}"#);
        assert_eq!(serde_json::from_str::<WordRange>(&json).unwrap(), range);
    }

    #[test]
    fn typescript_names_and_shapes() {
        let cfg = ts_rs::Config::default();
        assert_eq!(ClipId::name(&cfg), "ClipId");
        assert_eq!(ClipId::inline(&cfg), "string");
        assert_eq!(EventId::inline(&cfg), "string");
        assert_eq!(WordIdx::inline(&cfg), "number");
    }
}
