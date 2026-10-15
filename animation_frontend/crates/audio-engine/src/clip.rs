//! Audio clip - a slice of an audio source placed on the timeline.
//!
//! Reconstructed for Animato: the file in the imported tree was a copy of
//! `effects/reverb.rs`. The fields are the ones the mixer, the transition
//! code and their tests use.

use serde::Deserialize;
use tooscut_keyframe::evaluate_keyframes;
use tooscut_types::KeyframeTracks;

use crate::effects::AudioEffects;

/// A clip on an audio track.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioClip {
    /// Unique clip identifier.
    pub id: String,
    /// The uploaded source this clip plays.
    pub source_id: String,
    /// The track this clip sits on.
    pub track_id: String,
    /// Timeline time where the clip starts, in seconds.
    pub start_time: f64,
    /// Length on the timeline, in seconds.
    pub duration: f64,
    /// Source time at the clip's start, in seconds.
    #[serde(default)]
    pub in_point: f64,
    /// Playback speed (1.0 = normal).
    #[serde(default = "one_f64")]
    pub speed: f64,
    /// Linear gain (1.0 = unity).
    #[serde(default = "one_f32")]
    pub gain: f32,
    /// Fade-in length in seconds.
    #[serde(default)]
    pub fade_in: f64,
    /// Fade-out length in seconds.
    #[serde(default)]
    pub fade_out: f64,
    /// Keyframed properties: `volume` (multiplies gain) and effect params.
    #[serde(default)]
    pub keyframes: Option<KeyframeTracks>,
    /// Per-clip effects.
    #[serde(default)]
    pub effects: Option<AudioEffects>,
}

fn one_f64() -> f64 {
    1.0
}

fn one_f32() -> f32 {
    1.0
}

impl AudioClip {
    /// Timeline time where the clip ends.
    pub fn end_time(&self) -> f64 {
        self.start_time + self.duration
    }

    /// Whether the clip sounds at `timeline_time`.
    pub fn is_active_at(&self, timeline_time: f64) -> bool {
        timeline_time >= self.start_time && timeline_time < self.end_time()
    }

    /// Source time for a timeline time, accounting for in-point and speed.
    pub fn get_source_time(&self, timeline_time: f64) -> f64 {
        self.in_point + (timeline_time - self.start_time) * self.speed
    }

    /// Gain at `timeline_time`: clip gain, keyframed volume and the linear
    /// fade-in / fade-out envelope.
    pub fn calculate_gain(&self, timeline_time: f64) -> f32 {
        let local = timeline_time - self.start_time;
        let mut gain = self.gain;

        if let Some(track) = self.keyframes.as_ref().and_then(|k| k.get("volume")) {
            gain *= evaluate_keyframes(&track.keyframes, local);
        }

        if self.fade_in > 0.0 && local < self.fade_in {
            gain *= (local / self.fade_in).clamp(0.0, 1.0) as f32;
        }
        let remaining = self.end_time() - timeline_time;
        if self.fade_out > 0.0 && remaining < self.fade_out {
            gain *= (remaining / self.fade_out).clamp(0.0, 1.0) as f32;
        }

        gain.max(0.0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn clip() -> AudioClip {
        AudioClip {
            id: "c".into(),
            source_id: "s".into(),
            track_id: "t".into(),
            start_time: 2.0,
            duration: 4.0,
            in_point: 1.0,
            speed: 2.0,
            gain: 0.5,
            fade_in: 1.0,
            fade_out: 1.0,
            keyframes: None,
            effects: None,
        }
    }

    #[test]
    fn source_time_uses_in_point_and_speed() {
        assert_eq!(clip().get_source_time(3.0), 3.0);
    }

    #[test]
    fn fades_shape_the_gain() {
        let c = clip();
        assert_eq!(c.calculate_gain(2.0), 0.0);
        assert!((c.calculate_gain(2.5) - 0.25).abs() < 1e-6);
        assert!((c.calculate_gain(4.0) - 0.5).abs() < 1e-6);
        assert!((c.calculate_gain(5.5) - 0.25).abs() < 1e-6);
        assert!(!c.is_active_at(6.0));
    }
}
