//! The WebAssembly module the Animato editor loads: one module for the whole
//! editor (timecode and snapping, SRT, MP4 demuxing, the frame renderer with
//! the GPU compositor and Vello graphics, the audio mixer).
//!
//! Every function here has a TypeScript twin in
//! `animation_frontend/src/wasm/fallback.ts` with the same inputs and outputs,
//! so the app keeps working when the module is not built. Timelines and cue
//! lists cross the boundary as JSON strings: one copy each way, no generated
//! bindings to keep in step.

use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

use offcut_text::{normalize_transcript, RawWord};

mod demux;

pub use demux::Mp4Demuxer;
mod graphics;

pub use graphics::{FrameRenderer, GraphicsScene};
// Linked into this module so their wasm-bindgen exports ship with it:
// `AudioEngine` (mixer), and offcut-wasm-core's `probe_and_validate`,
// `open_demuxer`, `resample`, `normalize_transcript`, `Sha256Stream`.
pub use offcut_wasm_core as media_core;
pub use tooscut_audio_engine::AudioEngine;

/// Runs once when the module is instantiated.
#[wasm_bindgen(start)]
pub fn start() {
    console_error_panic_hook::set_once();
}

/// Version string shown in the editor's performance badge.
#[wasm_bindgen]
pub fn engine_version() -> String {
    format!("animato-wasm {}", env!("CARGO_PKG_VERSION"))
}

// ---------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------

/// `HH:MM:SS:FF` for a time in seconds at `fps`.
#[wasm_bindgen]
pub fn seconds_to_timecode(seconds: f64, fps: f64) -> String {
    let fps = if fps.is_finite() && fps >= 1.0 {
        fps.round()
    } else {
        30.0
    };
    let total = (seconds.max(0.0) * fps).round() as u64;
    let fps_u = fps as u64;
    let frames = total % fps_u;
    let secs = total / fps_u;
    format!(
        "{:02}:{:02}:{:02}:{:02}",
        secs / 3600,
        (secs / 60) % 60,
        secs % 60,
        frames
    )
}

/// Seconds for an `HH:MM:SS:FF` (or `MM:SS:FF`) timecode, or `NaN`.
#[wasm_bindgen]
pub fn timecode_to_seconds(timecode: &str, fps: f64) -> f64 {
    let fps = if fps.is_finite() && fps >= 1.0 {
        fps.round()
    } else {
        30.0
    };
    let parts: Option<Vec<u64>> = timecode.trim().split(':').map(|p| p.parse().ok()).collect();
    let Some(parts) = parts else { return f64::NAN };
    let (h, m, s, f) = match parts.as_slice() {
        [h, m, s, f] => (*h, *m, *s, *f),
        [m, s, f] => (0, *m, *s, *f),
        _ => return f64::NAN,
    };
    if m >= 60 || s >= 60 || (f as f64) >= fps {
        return f64::NAN;
    }
    (h * 3600 + m * 60 + s) as f64 + f as f64 / fps
}

/// The target nearest to `time` if it lies within `threshold`, else `time`.
#[wasm_bindgen]
pub fn snap(time: f64, targets: &[f64], threshold: f64) -> f64 {
    let mut best = time;
    let mut best_dist = threshold;
    for &t in targets {
        let d = (t - time).abs();
        if d <= best_dist {
            best = t;
            best_dist = d;
        }
    }
    best
}

// ---------------------------------------------------------------------------
// Subtitles
// ---------------------------------------------------------------------------

#[derive(Serialize, Deserialize)]
struct Cue {
    start: f64,
    end: f64,
    text: String,
}

fn srt_time(t: &str) -> Option<f64> {
    let t = t.trim().replace(',', ".");
    let mut parts = t.split(':');
    let h: f64 = parts.next()?.parse().ok()?;
    let m: f64 = parts.next()?.parse().ok()?;
    let s: f64 = parts.next()?.parse().ok()?;
    if parts.next().is_some() {
        return None;
    }
    Some(h * 3600.0 + m * 60.0 + s)
}

/// Cues from SubRip text, as JSON `[{start, end, text}]` in seconds.
/// Malformed blocks are skipped.
#[wasm_bindgen]
pub fn parse_srt(text: &str) -> Result<String, JsValue> {
    let normalized = text.replace("\r\n", "\n").replace('\r', "\n");
    let mut cues = Vec::new();
    for block in normalized.split("\n\n") {
        let lines: Vec<&str> = block.lines().filter(|l| !l.trim().is_empty()).collect();
        let Some(ti) = lines.iter().position(|l| l.contains("-->")) else {
            continue;
        };
        let mut times = lines[ti].split("-->");
        let (Some(a), Some(b)) = (times.next(), times.next()) else {
            continue;
        };
        let b = b.split_whitespace().next().unwrap_or("");
        let (Some(start), Some(end)) = (srt_time(a), srt_time(b)) else {
            continue;
        };
        if end <= start {
            continue;
        }
        let body = lines[ti + 1..].join("\n");
        cues.push(Cue {
            start,
            end,
            text: body,
        });
    }
    cues.sort_by(|a, b| a.start.total_cmp(&b.start));
    serde_json::to_string(&cues).map_err(|e| JsValue::from_str(&e.to_string()))
}

fn fmt_srt_time(t: f64) -> String {
    let ms = (t.max(0.0) * 1000.0).round() as u64;
    format!(
        "{:02}:{:02}:{:02},{:03}",
        ms / 3_600_000,
        (ms / 60_000) % 60,
        (ms / 1000) % 60,
        ms % 1000
    )
}

/// SubRip text for JSON cues `[{start, end, text}]`.
#[wasm_bindgen]
pub fn to_srt(cues_json: &str) -> Result<String, JsValue> {
    let mut cues: Vec<Cue> =
        serde_json::from_str(cues_json).map_err(|e| JsValue::from_str(&e.to_string()))?;
    cues.sort_by(|a, b| a.start.total_cmp(&b.start));
    let mut out = String::new();
    for (i, cue) in cues.iter().enumerate() {
        out.push_str(&format!(
            "{}\n{} --> {}\n{}\n\n",
            i + 1,
            fmt_srt_time(cue.start),
            fmt_srt_time(cue.end),
            cue.text.trim()
        ));
    }
    Ok(out)
}

/// Caption cues from timed words, one cue per sentence, using the transcript
/// normalizer from `offcut-text`. Input: `[{text, startMs, endMs, confidence}]`.
#[wasm_bindgen]
pub fn captions_from_words(words_json: &str) -> Result<String, JsValue> {
    let raw: Vec<RawWord> =
        serde_json::from_str(words_json).map_err(|e| JsValue::from_str(&e.to_string()))?;
    let transcript = normalize_transcript(raw, "animato-mock-asr");
    let cues: Vec<Cue> = transcript
        .sentences
        .iter()
        .map(|s| {
            let from = s.words.start.get() as usize;
            let to = (s.words.end.get() as usize).min(transcript.words.len());
            let text = transcript.words[from..to]
                .iter()
                .map(|w| w.text.as_str())
                .collect::<Vec<_>>()
                .join(" ");
            Cue {
                start: s.start_ms.get() as f64 / 1000.0,
                end: s.end_ms.get() as f64 / 1000.0,
                text,
            }
        })
        .collect();
    serde_json::to_string(&cues).map_err(|e| JsValue::from_str(&e.to_string()))
}

// ---------------------------------------------------------------------------
// Audio
// ---------------------------------------------------------------------------

/// Peak absolute amplitude of `pcm` in `buckets` equal slices, each in 0..=1.
#[wasm_bindgen]
pub fn waveform_peaks(pcm: &[f32], buckets: u32) -> Vec<f32> {
    let buckets = buckets.max(1) as usize;
    let mut out = vec![0.0f32; buckets];
    if pcm.is_empty() {
        return out;
    }
    let per = pcm.len() as f64 / buckets as f64;
    for (b, slot) in out.iter_mut().enumerate() {
        let from = (b as f64 * per) as usize;
        let to = (((b + 1) as f64 * per) as usize).clamp(from + 1, pcm.len());
        *slot = pcm[from..to]
            .iter()
            .fold(0.0f32, |m, s| m.max(s.abs()))
            .min(1.0);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn timecode_round_trip() {
        assert_eq!(seconds_to_timecode(61.5, 30.0), "00:01:01:15");
        assert!((timecode_to_seconds("00:01:01:15", 30.0) - 61.5).abs() < 1e-9);
        assert!(timecode_to_seconds("nope", 30.0).is_nan());
    }

    #[test]
    fn snapping() {
        assert_eq!(snap(1.02, &[0.0, 1.0, 2.0], 0.05), 1.0);
        assert_eq!(snap(1.2, &[0.0, 1.0, 2.0], 0.05), 1.2);
    }

    #[test]
    fn srt_round_trip() {
        let cues = parse_srt(
            "1\n00:00:01,000 --> 00:00:02,500\nHello\n\n2\n00:00:03,000 --> 00:00:04,000\nWorld\n",
        )
        .unwrap();
        let back = to_srt(&cues).unwrap();
        assert!(back.contains("00:00:01,000 --> 00:00:02,500\nHello"));
    }
}
