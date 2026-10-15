//! Easing curves: how far a motion has come, given how much of its time has passed.

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Easing {
    Linear,
    EaseOutCubic,
    /// Goes a little past the end and comes back.
    BackOut,
}

const BACK_OVERSHOOT: f32 = 1.70158;

/// `x` is the share of the time that has passed, read as within `0.0..=1.0`.
/// The result is 0.0 at 0.0 and 1.0 at 1.0; `BackOut` passes 1.0 on the way.
pub fn ease(e: Easing, x: f32) -> f32 {
    let x = if x.is_nan() { 0.0 } else { x.clamp(0.0, 1.0) };
    match e {
        Easing::Linear => x,
        Easing::EaseOutCubic => 1.0 - (1.0 - x).powi(3),
        Easing::BackOut => {
            let back = x - 1.0;
            1.0 + (BACK_OVERSHOOT + 1.0) * back.powi(3) + BACK_OVERSHOOT * back.powi(2)
        }
    }
}
