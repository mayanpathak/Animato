//! Unit types. A value's unit is part of its type, so a length cannot be passed
//! where a position is expected. Inner fields are private: construction goes
//! through `new` and the conversion functions in this file only.
//!
//! No unit converts from a bare integer, and there is no second timeline type (INV-5).

use serde::de::Error as _;
use serde::{Deserialize, Deserializer, Serialize};
use ts_rs::TS;

/// A position on the recording's timeline, in ms (the only timeline, INV-5).
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize, TS)]
#[serde(transparent)]
pub struct TimeMs(u32);

/// A length in ms.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize, TS)]
#[serde(transparent)]
pub struct DurMs(u32);

/// WebCodecs timestamps only.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize, TS)]
#[serde(transparent)]
pub struct Micros(#[ts(type = "number")] i64);

/// Output frame number at `OUTPUT_FPS`.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize, TS)]
#[serde(transparent)]
pub struct FrameIdx(u32);

/// PCM samples at a stated rate.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize, TS)]
#[serde(transparent)]
pub struct SampleCount(#[ts(type = "number")] u64);

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize, TS)]
#[serde(transparent)]
pub struct Hz(u32);

/// Frames per second x 1000 (59_940 = 59.94 fps).
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize, TS)]
#[serde(transparent)]
pub struct FpsMilli(u32);

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize, TS)]
#[serde(transparent)]
pub struct Px(u32);

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize, TS)]
#[serde(transparent)]
pub struct Bytes(#[ts(type = "number")] u64);

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize, TS)]
#[serde(transparent)]
pub struct BitsPerSec(u32);

/// Invariant `0.0..=1.0`, checked in `new` and when deserializing.
#[derive(Clone, Copy, Debug, PartialEq, PartialOrd, Serialize, TS)]
pub struct Confidence(f32);

/// Invariant: finite, checked in `new` and when deserializing.
#[derive(Clone, Copy, Debug, PartialEq, PartialOrd, Serialize, TS)]
pub struct Lufs(f32);

/// Invariant: finite, checked in `new` and when deserializing.
#[derive(Clone, Copy, Debug, PartialEq, PartialOrd, Serialize, TS)]
pub struct Dbfs(f32);

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize, TS)]
#[serde(transparent)]
pub struct UnixSecs(#[ts(type = "number")] i64);

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize, TS)]
#[serde(transparent)]
pub struct ExportCount(u32);

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize, TS)]
#[serde(transparent)]
pub struct UsdCents(u32);

/// A stretch of the timeline. Invariant `start <= end`; build it with [`Span::new`].
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize, TS)]
pub struct Span {
    pub start: TimeMs,
    pub end: TimeMs,
}

/// `new` and `get` for an integer unit. Both are `const` so `limits.rs` can use them.
macro_rules! int_unit {
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

int_unit! {
    TimeMs: u32,
    DurMs: u32,
    Micros: i64,
    FrameIdx: u32,
    SampleCount: u64,
    Hz: u32,
    FpsMilli: u32,
    Px: u32,
    Bytes: u64,
    BitsPerSec: u32,
    UnixSecs: i64,
    ExportCount: u32,
    UsdCents: u32,
}

/// `get`, and a `Deserialize` that goes through `new`, for an `f32` unit.
macro_rules! f32_unit {
    ($($name:ident: $expected:literal),+ $(,)?) => {$(
        impl $name {
            pub const fn get(self) -> f32 {
                self.0
            }
        }

        impl<'de> Deserialize<'de> for $name {
            fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
                let v = f32::deserialize(deserializer)?;
                Self::new(v).ok_or_else(|| D::Error::custom($expected))
            }
        }
    )+};
}

f32_unit! {
    Confidence: "a confidence must be a finite number in 0.0..=1.0",
    Lufs: "a LUFS value must be finite",
    Dbfs: "a dBFS value must be finite",
}

impl Confidence {
    /// `None` when `v` is not finite or is outside `0.0..=1.0`.
    pub fn new(v: f32) -> Option<Self> {
        (0.0..=1.0).contains(&v).then_some(Self(v))
    }
}

impl Lufs {
    /// `None` when `v` is not finite.
    pub fn new(v: f32) -> Option<Self> {
        v.is_finite().then_some(Self(v))
    }
}

impl Dbfs {
    /// `None` when `v` is not finite.
    pub fn new(v: f32) -> Option<Self> {
        v.is_finite().then_some(Self(v))
    }
}

impl Span {
    /// `None` when `start > end`.
    pub fn new(start: TimeMs, end: TimeMs) -> Option<Self> {
        (start <= end).then_some(Self { start, end })
    }
}

/// Output frames per second, as the divisor of the frame conversions.
/// A local copy of `limits::OUTPUT_FPS` would be a second source; this reads it.
const FPS: u64 = crate::limits::OUTPUT_FPS as u64;

impl FrameIdx {
    /// `n * 1000 / 30`, integer division. Saturates at `u32::MAX` ms, which no
    /// accepted clip reaches.
    pub fn to_time_ms(self) -> TimeMs {
        let ms = u64::from(self.0) * 1000 / FPS;
        TimeMs(u32::try_from(ms).unwrap_or(u32::MAX))
    }

    /// `n * 1_000_000 / 30`, integer division.
    pub fn to_micros(self) -> Micros {
        let micros = u64::from(self.0) * 1_000_000 / FPS;
        Micros(i64::try_from(micros).unwrap_or(i64::MAX))
    }
}

impl TimeMs {
    /// `ms * 1000`.
    pub fn to_micros(self) -> Micros {
        Micros(i64::from(self.0) * 1000)
    }

    /// Floor division by 1000. A negative input clamps to 0; an input past
    /// `u32::MAX` ms saturates.
    pub fn from_micros_floor(m: Micros) -> TimeMs {
        let ms = m.0.div_euclid(1000).max(0);
        TimeMs(u32::try_from(ms).unwrap_or(u32::MAX))
    }

    /// A position plus a length. `None` on overflow.
    pub fn checked_add(self, d: DurMs) -> Option<TimeMs> {
        self.0.checked_add(d.0).map(TimeMs)
    }

    /// The length from `earlier` to `self`. `None` when `earlier` is later than `self`.
    pub fn duration_since(self, earlier: TimeMs) -> Option<DurMs> {
        self.0.checked_sub(earlier.0).map(DurMs)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn frame_30_is_one_second() {
        assert_eq!(FrameIdx::new(30).to_time_ms(), TimeMs::new(1000));
    }

    #[test]
    fn frame_1_is_33_333_micros() {
        assert_eq!(FrameIdx::new(1).to_micros(), Micros::new(33_333));
    }

    #[test]
    fn confidence_above_one_is_rejected() {
        assert_eq!(Confidence::new(1.1), None);
        assert_eq!(Confidence::new(-0.1), None);
        assert_eq!(Confidence::new(0.0).map(Confidence::get), Some(0.0));
        assert_eq!(Confidence::new(1.0).map(Confidence::get), Some(1.0));
    }

    #[test]
    fn confidence_nan_is_rejected() {
        assert_eq!(Confidence::new(f32::NAN), None);
        assert_eq!(Confidence::new(f32::INFINITY), None);
        assert_eq!(Lufs::new(f32::NAN), None);
        assert_eq!(Dbfs::new(f32::NEG_INFINITY), None);
        assert_eq!(Lufs::new(-14.0).map(Lufs::get), Some(-14.0));
    }

    #[test]
    fn span_rejects_reversed_bounds() {
        let (a, b) = (TimeMs::new(100), TimeMs::new(200));
        assert_eq!(Span::new(b, a), None);
        assert_eq!(Span::new(a, b), Some(Span { start: a, end: b }));
        assert_eq!(Span::new(a, a), Some(Span { start: a, end: a }));
    }

    #[test]
    fn from_micros_floor_floors_and_clamps() {
        let floor = |m| TimeMs::from_micros_floor(Micros::new(m));
        assert_eq!(floor(1_999), TimeMs::new(1));
        assert_eq!(floor(2_000), TimeMs::new(2));
        assert_eq!(floor(999), TimeMs::new(0));
        assert_eq!(floor(-1), TimeMs::new(0));
        assert_eq!(floor(-5_000), TimeMs::new(0));
        assert_eq!(floor(i64::MAX), TimeMs::new(u32::MAX));
    }

    #[test]
    fn frame_conversions_do_not_overflow() {
        assert_eq!(FrameIdx::new(u32::MAX).to_time_ms(), TimeMs::new(u32::MAX));
        assert_eq!(
            FrameIdx::new(u32::MAX).to_micros(),
            Micros::new(i64::from(u32::MAX) * 1_000_000 / 30)
        );
        assert_eq!(
            TimeMs::new(u32::MAX).to_micros(),
            Micros::new(4_294_967_295_000)
        );
    }

    #[test]
    fn position_and_length_arithmetic() {
        let t = TimeMs::new(1_000);
        assert_eq!(t.checked_add(DurMs::new(500)), Some(TimeMs::new(1_500)));
        assert_eq!(TimeMs::new(u32::MAX).checked_add(DurMs::new(1)), None);
        assert_eq!(t.duration_since(TimeMs::new(400)), Some(DurMs::new(600)));
        assert_eq!(t.duration_since(TimeMs::new(1_001)), None);
    }

    #[test]
    fn integer_unit_round_trips_as_a_bare_number() {
        let json = serde_json::to_string(&DurMs::new(90_000)).unwrap();
        assert_eq!(json, "90000");
        assert_eq!(
            serde_json::from_str::<DurMs>(&json).unwrap(),
            DurMs::new(90_000)
        );

        let bytes = Bytes::new(500_000_000);
        assert_eq!(serde_json::to_string(&bytes).unwrap(), "500000000");
        assert_eq!(serde_json::from_str::<Bytes>("500000000").unwrap(), bytes);
    }

    #[test]
    fn span_round_trips_with_rust_field_names() {
        let span = Span::new(TimeMs::new(10), TimeMs::new(20)).unwrap();
        let json = serde_json::to_string(&span).unwrap();
        assert_eq!(json, r#"{"start":10,"end":20}"#);
        assert_eq!(serde_json::from_str::<Span>(&json).unwrap(), span);
    }

    #[test]
    fn confidence_deserializes_through_new() {
        let c = Confidence::new(0.5).unwrap();
        assert_eq!(serde_json::to_string(&c).unwrap(), "0.5");
        assert_eq!(serde_json::from_str::<Confidence>("0.5").unwrap(), c);
        assert!(serde_json::from_str::<Confidence>("1.1").is_err());
        assert!(serde_json::from_str::<Confidence>("-0.01").is_err());
        assert!(serde_json::from_str::<Confidence>("\"0.5\"").is_err());
    }

    #[test]
    fn loudness_units_round_trip() {
        let l = Lufs::new(-14.0).unwrap();
        assert_eq!(serde_json::to_string(&l).unwrap(), "-14.0");
        assert_eq!(serde_json::from_str::<Lufs>("-14.0").unwrap(), l);
        assert_eq!(
            serde_json::from_str::<Dbfs>("-1.5").unwrap(),
            Dbfs::new(-1.5).unwrap()
        );
    }

    #[test]
    fn typescript_names_and_shapes() {
        let cfg = ts_rs::Config::default();
        assert_eq!(TimeMs::name(&cfg), "TimeMs");
        assert_eq!(TimeMs::inline(&cfg), "number");
        assert_eq!(Bytes::inline(&cfg), "number");
        assert_eq!(Micros::inline(&cfg), "number");
        assert_eq!(Confidence::inline(&cfg), "number");
    }
}
