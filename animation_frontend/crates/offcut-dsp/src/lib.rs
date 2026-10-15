//! Audio signal processing. V2 holds the resampler only; V3 adds the voice
//! chain and the prosody measure.

pub mod resample;

use thiserror::Error;

/// Why audio cannot be processed. Unused until the voice chain of V3.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Error)]
pub enum DspError {
    #[error("no samples")]
    Empty,
    #[error("a sample is not a finite number")]
    NonFinite,
}
