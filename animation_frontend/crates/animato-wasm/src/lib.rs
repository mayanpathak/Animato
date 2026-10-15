//! The WebAssembly module the Animato editor loads.
//!
//! Every function here has a TypeScript twin in
//! `animation_frontend/src/wasm/fallback.ts` with the same inputs and outputs,
//! so the app keeps working when the module is not built. Timelines and cue
//! lists cross the boundary as JSON strings: one copy each way, no generated
//! bindings to keep in step.

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use wasm_bindgen::prelude::*;

use offcut_text::{normalize_transcript, RawWord};
use offcut_types::Hz;
use tooscut_keyframe::{evaluate_keyframes, EasingPreset, Keyframe};

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
    let fps = if fps.is_finite() && fps >= 1.0 { fps.round() } else { 30.0 };
    let total = (seconds.max(0.0) * fps).round() as u64;
    let fps_u = fps as u64;
    let frames = total % fps_u;
    let secs = total / fps_u;
    format!("{:02}:{:02}:{:02}:{:02}", secs / 3600, (secs / 60) % 60, secs % 60, frames)
}

/// Seconds for an `HH:MM:SS:FF` (or `MM:SS:FF`) timecode, or `NaN`.
#[wasm_bindgen]
pub fn timecode_to_seconds(timecode: &str, fps: f64) -> f64 {
    let fps = if fps.is_finite() && fps >= 1.0 { fps.round() } else { 30.0 };
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
// Timeline operations
// ---------------------------------------------------------------------------
//
// A timeline is `{ "tracks": [ { "id", "clips": [ { "id", "start",
// "duration", "offset", "speed", ... } ] } ] }`, times in seconds. Unknown
// fields are carried through untouched.

const MIN_CLIP: f64 = 0.1;

fn parse_timeline(json: &str) -> Result<Value, JsValue> {
    let value: Value = serde_json::from_str(json).map_err(|e| JsValue::from_str(&e.to_string()))?;
    if !value.get("tracks").is_some_and(Value::is_array) {
        return Err(JsValue::from_str("timeline has no tracks array"));
    }
    Ok(value)
}

fn num(clip: &Map<String, Value>, key: &str, default: f64) -> f64 {
    clip.get(key).and_then(Value::as_f64).unwrap_or(default)
}

fn round6(v: f64) -> f64 {
    (v * 1e6).round() / 1e6
}

/// Finds `(track index, clip index)` of the clip with `clip_id`.
fn locate(timeline: &Value, clip_id: &str) -> Option<(usize, usize)> {
    let tracks = timeline["tracks"].as_array()?;
    for (ti, track) in tracks.iter().enumerate() {
        if let Some(clips) = track["clips"].as_array() {
            if let Some(ci) = clips.iter().position(|c| c["id"].as_str() == Some(clip_id)) {
                return Some((ti, ci));
            }
        }
    }
    None
}

fn to_string(value: &Value) -> Result<String, JsValue> {
    serde_json::to_string(value).map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Splits the clip at timeline time `at`. The right half gets `new_id`.
/// Returns the timeline unchanged when `at` is not inside the clip.
#[wasm_bindgen]
pub fn split_clip(timeline: &str, clip_id: &str, at: f64, new_id: &str) -> Result<String, JsValue> {
    let mut tl = parse_timeline(timeline)?;
    let Some((ti, ci)) = locate(&tl, clip_id) else { return to_string(&tl) };
    let clips = tl["tracks"][ti]["clips"].as_array_mut().expect("located");
    let clip = clips[ci].as_object().cloned().unwrap_or_default();
    let start = num(&clip, "start", 0.0);
    let duration = num(&clip, "duration", 0.0);
    let offset = num(&clip, "offset", 0.0);
    let speed = num(&clip, "speed", 1.0).max(0.01);
    if at <= start + MIN_CLIP || at >= start + duration - MIN_CLIP {
        return to_string(&tl);
    }
    let left_len = at - start;
    let mut left = clip.clone();
    left.insert("duration".into(), round6(left_len).into());
    left.insert("fadeOut".into(), 0.0.into());
    let mut right = clip;
    right.insert("id".into(), new_id.into());
    right.insert("start".into(), round6(at).into());
    right.insert("duration".into(), round6(duration - left_len).into());
    right.insert("offset".into(), round6(offset + left_len * speed).into());
    right.insert("fadeIn".into(), 0.0.into());
    clips[ci] = Value::Object(left);
    clips.insert(ci + 1, Value::Object(right));
    to_string(&tl)
}

/// Moves one edge of a clip to timeline time `to`. `edge` is `"start"` or
/// `"end"`. Trimming the start also advances the clip's source offset.
#[wasm_bindgen]
pub fn trim_clip(timeline: &str, clip_id: &str, edge: &str, to: f64) -> Result<String, JsValue> {
    let mut tl = parse_timeline(timeline)?;
    let Some((ti, ci)) = locate(&tl, clip_id) else { return to_string(&tl) };
    let clip = tl["tracks"][ti]["clips"][ci].as_object_mut().expect("located");
    let start = num(clip, "start", 0.0);
    let duration = num(clip, "duration", 0.0);
    let end = start + duration;
    let offset = num(clip, "offset", 0.0);
    let speed = num(clip, "speed", 1.0).max(0.01);
    match edge {
        "start" => {
            let lowest = (start - offset / speed).max(0.0);
            let new_start = to.clamp(lowest, end - MIN_CLIP);
            clip.insert("start".into(), round6(new_start).into());
            clip.insert("duration".into(), round6(end - new_start).into());
            clip.insert("offset".into(), round6(offset + (new_start - start) * speed).into());
        }
        "end" => {
            let new_end = to.max(start + MIN_CLIP);
            clip.insert("duration".into(), round6(new_end - start).into());
        }
        _ => return Err(JsValue::from_str("edge must be \"start\" or \"end\"")),
    }
    to_string(&tl)
}

/// Removes a clip and pulls every later clip on its track left to close the gap.
#[wasm_bindgen]
pub fn ripple_delete(timeline: &str, clip_id: &str) -> Result<String, JsValue> {
    let mut tl = parse_timeline(timeline)?;
    let Some((ti, ci)) = locate(&tl, clip_id) else { return to_string(&tl) };
    let clips = tl["tracks"][ti]["clips"].as_array_mut().expect("located");
    let removed = clips.remove(ci);
    let r_start = removed["start"].as_f64().unwrap_or(0.0);
    let gap = removed["duration"].as_f64().unwrap_or(0.0);
    for clip in clips.iter_mut() {
        if let Some(obj) = clip.as_object_mut() {
            let s = num(obj, "start", 0.0);
            if s >= r_start {
                obj.insert("start".into(), round6((s - gap).max(0.0)).into());
            }
        }
    }
    to_string(&tl)
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
        let Some(ti) = lines.iter().position(|l| l.contains("-->")) else { continue };
        let mut times = lines[ti].split("-->");
        let (Some(a), Some(b)) = (times.next(), times.next()) else { continue };
        let b = b.split_whitespace().next().unwrap_or("");
        let (Some(start), Some(end)) = (srt_time(a), srt_time(b)) else { continue };
        if end <= start {
            continue;
        }
        let body = lines[ti + 1..].join("\n");
        cues.push(Cue { start, end, text: body });
    }
    cues.sort_by(|a, b| a.start.total_cmp(&b.start));
    serde_json::to_string(&cues).map_err(|e| JsValue::from_str(&e.to_string()))
}

fn fmt_srt_time(t: f64) -> String {
    let ms = (t.max(0.0) * 1000.0).round() as u64;
    format!("{:02}:{:02}:{:02},{:03}", ms / 3_600_000, (ms / 60_000) % 60, (ms / 1000) % 60, ms % 1000)
}

/// SubRip text for JSON cues `[{start, end, text}]`.
#[wasm_bindgen]
pub fn to_srt(cues_json: &str) -> Result<String, JsValue> {
    let mut cues: Vec<Cue> = serde_json::from_str(cues_json).map_err(|e| JsValue::from_str(&e.to_string()))?;
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
    let raw: Vec<RawWord> = serde_json::from_str(words_json).map_err(|e| JsValue::from_str(&e.to_string()))?;
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
        *slot = pcm[from..to].iter().fold(0.0f32, |m, s| m.max(s.abs())).min(1.0);
    }
    out
}

/// Mono resampling with the FFT resampler from `offcut-dsp`.
#[wasm_bindgen]
pub fn resample(pcm: &[f32], from_hz: u32, to_hz: u32) -> Vec<f32> {
    if from_hz == 0 || to_hz == 0 {
        return Vec::new();
    }
    offcut_dsp::resample::resample_mono(pcm, Hz::new(from_hz), Hz::new(to_hz))
}

// ---------------------------------------------------------------------------
// Keyframes
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
struct SimpleKey {
    time: f64,
    value: f32,
    #[serde(default)]
    ease: String,
}

/// Value of a keyframed property at `time`, evaluated by `tooscut-keyframe`.
/// Input: `[{time, value, ease}]` where `ease` is `linear`, `step`,
/// `easeIn`, `easeOut` or `easeInOut`.
#[wasm_bindgen]
pub fn keyframe_value(keys_json: &str, time: f64) -> Result<f32, JsValue> {
    let keys: Vec<SimpleKey> = serde_json::from_str(keys_json).map_err(|e| JsValue::from_str(&e.to_string()))?;
    let mut frames: Vec<Keyframe> = keys
        .into_iter()
        .map(|k| match k.ease.as_str() {
            "step" => Keyframe::step(k.time, k.value),
            "easeIn" => Keyframe::eased(k.time, k.value, EasingPreset::EaseIn),
            "easeOut" => Keyframe::eased(k.time, k.value, EasingPreset::EaseOut),
            "easeInOut" => Keyframe::eased(k.time, k.value, EasingPreset::EaseInOut),
            _ => Keyframe::linear(k.time, k.value),
        })
        .collect();
    frames.sort_by(|a, b| a.time.total_cmp(&b.time));
    Ok(evaluate_keyframes(&frames, time))
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
    fn split_and_ripple() {
        let tl = r#"{"tracks":[{"id":"v","clips":[{"id":"a","start":0,"duration":4,"offset":0,"speed":1},{"id":"b","start":4,"duration":2,"offset":0,"speed":1}]}]}"#;
        let out: Value = serde_json::from_str(&split_clip(tl, "a", 1.5, "a2").unwrap()).unwrap();
        let clips = out["tracks"][0]["clips"].as_array().unwrap();
        assert_eq!(clips.len(), 3);
        assert_eq!(clips[1]["start"], 1.5);
        assert_eq!(clips[1]["offset"], 1.5);
        let rippled: Value = serde_json::from_str(&ripple_delete(tl, "a").unwrap()).unwrap();
        assert_eq!(rippled["tracks"][0]["clips"][0]["start"], 0.0);
    }

    #[test]
    fn srt_round_trip() {
        let cues = parse_srt("1\n00:00:01,000 --> 00:00:02,500\nHello\n\n2\n00:00:03,000 --> 00:00:04,000\nWorld\n").unwrap();
        let back = to_srt(&cues).unwrap();
        assert!(back.contains("00:00:01,000 --> 00:00:02,500\nHello"));
    }
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/// Animated GIF encoder for the editor's local export. Frames are RGBA,
/// quantized per frame with NeuQuant (the `gif` crate). Runs in a worker.
#[wasm_bindgen]
pub struct GifWriter {
    width: u16,
    height: u16,
    delay_cs: u16,
    speed: i32,
    encoder: Option<gif::Encoder<Vec<u8>>>,
}

#[wasm_bindgen]
impl GifWriter {
    /// `delay_cs`: frame delay in hundredths of a second. `speed`: 1 (best)
    /// to 30 (fastest) quantization.
    #[wasm_bindgen(constructor)]
    pub fn new(width: u16, height: u16, delay_cs: u16, speed: i32) -> Result<GifWriter, JsValue> {
        let mut encoder = gif::Encoder::new(Vec::new(), width, height, &[])
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        encoder
            .set_repeat(gif::Repeat::Infinite)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        Ok(GifWriter { width, height, delay_cs, speed: speed.clamp(1, 30), encoder: Some(encoder) })
    }

    /// Appends one RGBA frame of exactly `width * height * 4` bytes.
    pub fn add_frame(&mut self, rgba: &[u8]) -> Result<(), JsValue> {
        let expected = self.width as usize * self.height as usize * 4;
        if rgba.len() != expected {
            return Err(JsValue::from_str("frame size does not match"));
        }
        let mut pixels = rgba.to_vec();
        let mut frame = gif::Frame::from_rgba_speed(self.width, self.height, &mut pixels, self.speed);
        frame.delay = self.delay_cs;
        let encoder = self.encoder.as_mut().ok_or_else(|| JsValue::from_str("writer is finished"))?;
        encoder.write_frame(&frame).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// The finished file. The writer cannot be used afterwards.
    pub fn finish(&mut self) -> Result<Vec<u8>, JsValue> {
        let encoder = self.encoder.take().ok_or_else(|| JsValue::from_str("writer is finished"))?;
        encoder.into_inner().map_err(|e| JsValue::from_str(&e.to_string()))
    }
}

#[cfg(test)]
mod gif_tests {
    use super::*;

    #[test]
    fn writes_a_gif() {
        let mut w = GifWriter::new(4, 2, 10, 10).ok().unwrap();
        w.add_frame(&[255u8; 32]).ok().unwrap();
        let bytes = w.finish().ok().unwrap();
        assert_eq!(&bytes[..6], b"GIF89a");
    }
}
