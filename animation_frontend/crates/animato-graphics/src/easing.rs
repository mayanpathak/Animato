//! Easing curves: how far a motion has come, given how much of its time has passed.

use crate::doc::EasingId;

const BACK_OVERSHOOT: f32 = 1.70158;

/// `x` is the share of the time that has passed, read as within `0.0..=1.0`.
/// The result is 0.0 at 0.0 and 1.0 at 1.0; `BackOut` passes 1.0 on the way.
pub fn ease(e: EasingId, x: f32) -> f32 {
    let x = if x.is_nan() { 0.0 } else { x.clamp(0.0, 1.0) };
    match e {
        EasingId::Linear => x,
        EasingId::EaseOut => 1.0 - (1.0 - x).powi(3),
        EasingId::EaseInOut => {
            if x < 0.5 {
                4.0 * x * x * x
            } else {
                1.0 - (-2.0 * x + 2.0).powi(3) / 2.0
            }
        }
        EasingId::BackOut => {
            let back = x - 1.0;
            1.0 + (BACK_OVERSHOOT + 1.0) * back.powi(3) + BACK_OVERSHOOT * back.powi(2)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_curve_starts_at_0_and_ends_at_1() {
        for e in [
            EasingId::Linear,
            EasingId::EaseOut,
            EasingId::EaseInOut,
            EasingId::BackOut,
        ] {
            assert!(ease(e, 0.0).abs() < 1e-6, "{e:?}");
            assert!((ease(e, 1.0) - 1.0).abs() < 1e-6, "{e:?}");
            assert_eq!(ease(e, f32::NAN), ease(e, 0.0));
        }
        assert!(ease(EasingId::BackOut, 0.8) > 1.0);
    }
}
