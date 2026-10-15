//! A value that changes over time, given as keys. The value at `t` is
//! computed from `t` alone: nothing is carried from one frame to the next.

use offcut_types::TimeMs;

use crate::easing::{Easing, ease};

/// `keys` are in time order.
#[derive(Clone, Debug, PartialEq)]
pub struct Track {
    pub keys: Vec<(TimeMs, f32)>,
    pub easing: Easing,
}

/// Before the first key its value, after the last key its value, between two
/// keys the eased value. A track without keys is 0.0.
pub fn eval(track: &Track, t: TimeMs) -> f32 {
    let Some(&(first_at, first)) = track.keys.first() else {
        return 0.0;
    };
    if t <= first_at {
        return first;
    }
    let mut from = (first_at, first);
    for &(at, value) in track.keys.iter().skip(1) {
        if t < at {
            let length = at.get().saturating_sub(from.0.get());
            let passed = t.get().saturating_sub(from.0.get());
            // `length` is above 0 here: `from.0 <= t < at`.
            let x = passed as f32 / length as f32;
            return from.1 + (value - from.1) * ease(track.easing, x);
        }
        from = (at, value);
    }
    from.1
}
