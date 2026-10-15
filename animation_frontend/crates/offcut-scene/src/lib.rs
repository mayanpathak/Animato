//! From a transcript, its events and the user's choices to what each output
//! frame draws (TS §19). A scene is built once; `frame_at` is then a pure
//! function of the scene and a time. Nothing here touches a GPU, a pixel or
//! a decoder, reads a clock, or moves a timestamp (INV-5).

pub mod anim;
pub mod captions;
pub mod display_list;
pub mod easing;
pub mod events;
pub mod fonts;
pub mod framing;
pub mod layout;
pub mod safe_area;
pub mod styles;

use offcut_types::{
    ChangeSummary, ClipInfo, DetectedEvent, DurMs, EditState, ExportProfile, OUTPUT_FPS, TimeMs,
    Transcript,
};
use serde::Serialize;
use thiserror::Error;

use crate::captions::Chunk;
pub use crate::display_list::{
    Affine, DisplayList, DrawCmd, FontId, PathEl, PositionedGlyph, Rect, Rgba, Stroke,
};
use crate::events::EventTrack;
use crate::styles::StyleSpec;

/// Why a scene cannot be built. Both are `E_INTERNAL` to the caller: the
/// fonts are part of the program.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Error)]
pub enum SceneError {
    #[error("an embedded font could not be read")]
    Font,
    #[error("text could not be laid out")]
    Layout,
}

pub struct SceneInput<'a> {
    pub transcript: &'a Transcript,
    pub events: &'a [DetectedEvent],
    pub edit: &'a EditState,
    pub clip: &'a ClipInfo,
    pub profile: &'a ExportProfile,
}

/// In source display pixels.
#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
pub struct CropRect {
    pub x: f32,
    pub y: f32,
    pub w: f32,
    pub h: f32,
}

/// Everything that is drawn over one clip, laid out in logical pixels.
#[derive(Clone, Debug, PartialEq)]
pub struct Scene {
    duration: DurMs,
    crop: CropRect,
    /// Output pixels per logical pixel.
    scale: f32,
    style: StyleSpec,
    chunks: Vec<Chunk>,
    tracks: Vec<EventTrack>,
}

pub fn build_scene(input: SceneInput<'_>) -> Result<Scene, SceneError> {
    let crop = framing::crop_rect(input.clip, input.edit.crop_offset);
    let style = styles::spec(input.edit.style);

    let words = captions::words(input.transcript, &input.edit.word_edits);
    let chunks = captions::chunk(&words, &input.transcript.sentences, &style)?;

    let mut tracks = Vec::new();
    for event in input.events {
        // The user's choice for this event, when there is one (TS §10.8).
        let enabled = input
            .edit
            .event_overrides
            .get(&event.id)
            .copied()
            .unwrap_or(event.enabled);
        if !enabled {
            continue;
        }
        if let Some(track) = events::layout(event, &style)? {
            tracks.push(track);
        }
    }

    // V4: the watermark, when `profile.watermark` is set.
    let scale = input.profile.width.get() as f32 / safe_area::CANVAS_WIDTH;
    Ok(Scene {
        duration: input.clip.duration,
        crop,
        scale,
        style,
        chunks,
        tracks,
    })
}

impl Scene {
    /// The length of the clip, always.
    pub fn duration(&self) -> DurMs {
        self.duration
    }

    /// `ceil(duration_ms * OUTPUT_FPS / 1000)`: 2,700 for 90 s.
    pub fn frame_count(&self) -> u32 {
        let frames = (u64::from(self.duration.get()) * u64::from(OUTPUT_FPS)).div_ceil(1_000);
        u32::try_from(frames).unwrap_or(u32::MAX)
    }

    /// The same for every frame of the scene.
    pub fn crop(&self) -> CropRect {
        self.crop
    }

    /// What is drawn at `t`, in pixels of the output canvas: the caption
    /// chunk that is shown, then every event that is shown.
    pub fn frame_at(&self, t: TimeMs) -> DisplayList {
        let mut cmds = Vec::new();
        if let Some(chunk) = self.chunks.iter().find(|chunk| chunk.visible_at(t)) {
            captions::draw(chunk, t, &self.style, &mut cmds);
        }
        for track in &self.tracks {
            events::draw(track, t, &mut cmds);
        }
        for cmd in &mut cmds {
            cmd.scale(self.scale);
        }
        DisplayList { cmds }
    }

    /// V2 cleans no voice and emphasizes no caption word (D-22). An event
    /// that could not be placed is not counted (TS §19.7).
    pub fn summary(&self) -> ChangeSummary {
        ChangeSummary {
            voice_cleaned: false,
            captions_emphasized: 0,
            visual_moments: u32::try_from(self.tracks.len()).unwrap_or(u32::MAX),
        }
    }
}

#[cfg(test)]
pub(crate) mod testing {
    use offcut_text::{RawWord, normalize_transcript};
    use offcut_types::{
        BitsPerSec, Confidence, EventId, EventKind, EventParams, Orientation, ProfileKind, Px,
        Quantity, Rotation, Span, WordIdx, WordRange,
    };

    use super::*;
    use crate::layout::shape;

    pub(crate) fn word(text: &str, start_ms: u32, end_ms: u32) -> RawWord {
        RawWord {
            text: text.to_owned(),
            start_ms,
            end_ms,
            confidence: 1.0,
        }
    }

    /// A transcript as the pipeline builds it, sentences and numbers included.
    pub(crate) fn transcript(words: &[RawWord]) -> Transcript {
        normalize_transcript(words.to_vec(), "test")
    }

    pub(crate) fn clip(width: u32, height: u32, duration_ms: u32) -> ClipInfo {
        ClipInfo {
            duration: DurMs::new(duration_ms),
            display_width: Px::new(width),
            display_height: Px::new(height),
            rotation: Rotation::R0,
            orientation: if width > height {
                Orientation::Landscape
            } else {
                Orientation::Portrait
            },
            is_vfr: false,
            video_codec_string: "avc1.640028".to_owned(),
            audio_codec_string: "mp4a.40.2".to_owned(),
            audio_sample_rate: offcut_types::Hz::new(48_000),
            audio_channels: 2,
        }
    }

    pub(crate) fn profile(width: u32) -> ExportProfile {
        ExportProfile {
            kind: ProfileKind::Creator,
            width: Px::new(width),
            height: Px::new(width * 16 / 9),
            watermark: false,
            video_bitrate: BitsPerSec::new(8_000_000),
            audio_bitrate: BitsPerSec::new(160_000),
        }
    }

    pub(crate) fn number_event(value: Quantity, start: u32, end: u32) -> DetectedEvent {
        DetectedEvent {
            id: EventId::new(u64::from(start)),
            kind: EventKind::NumberReveal,
            span: Span::new(TimeMs::new(start), TimeMs::new(end)).unwrap(),
            anchors: WordRange {
                start: WordIdx::new(0),
                end: WordIdx::new(1),
            },
            params: EventParams::NumberReveal { value, label: None },
            confidence: Confidence::new(1.0).unwrap(),
            enabled: true,
        }
    }

    /// A scene of a 10 s portrait clip, with no edits.
    pub(crate) fn build(transcript: &Transcript, events: &[DetectedEvent], width: u32) -> Scene {
        build_scene(SceneInput {
            transcript,
            events,
            edit: &EditState::default(),
            clip: &clip(1080, 1920, 10_000),
            profile: &profile(width),
        })
        .unwrap()
    }

    /// The box a command draws in, on the canvas. For a glyph run it is the
    /// box of its line (ascent to descent, start to end) and its stroke.
    pub(crate) fn bounds(cmd: &DrawCmd) -> Option<Rect> {
        let corners: Vec<(f32, f32)> = match cmd {
            DrawCmd::GlyphRun {
                font,
                size,
                stroke,
                transform,
                text,
                ..
            } => {
                let runs = shape(text, *font, *size).unwrap();
                assert_eq!(runs.len(), 1, "{text:?}");
                let pad = stroke.map_or(0.0, |stroke| stroke.width / 2.0);
                let (left, right) = (-pad, runs[0].width + pad);
                let (top, bottom) = (-runs[0].ascent - pad, runs[0].descent + pad);
                [(left, top), (right, top), (left, bottom), (right, bottom)]
                    .map(|(x, y)| transform.apply(x, y))
                    .to_vec()
            }
            DrawCmd::FillRect { rect, .. } => {
                vec![(rect.x, rect.y), (rect.x + rect.w, rect.y + rect.h)]
            }
            DrawCmd::FillPath { .. } => panic!("V2 draws no path"),
            DrawCmd::PushLayer { .. } | DrawCmd::PopLayer => return None,
        };
        let fold = |pick: fn(&(f32, f32)) -> f32, by: fn(f32, f32) -> f32, from: f32| {
            corners.iter().map(pick).fold(from, by)
        };
        let (x, y) = (
            fold(|c| c.0, f32::min, f32::MAX),
            fold(|c| c.1, f32::min, f32::MAX),
        );
        let (right, bottom) = (
            fold(|c| c.0, f32::max, f32::MIN),
            fold(|c| c.1, f32::max, f32::MIN),
        );
        Some(Rect {
            x,
            y,
            w: right - x,
            h: bottom - y,
        })
    }
}

#[cfg(test)]
mod tests {
    use offcut_types::{FrameIdx, Quantity, Unit};

    use super::testing::*;
    use super::*;
    use crate::safe_area::SAFE_AREA;

    /// Captions with a long and a wide word, a pause, a number that counts
    /// up through texts wider than its end, and one that scales in.
    fn busy() -> (Transcript, Vec<DetectedEvent>) {
        let texts = [
            "we",
            "spent",
            "three",
            "long",
            "months",
            "building",
            "something",
            "WWWWWWWWWWWWWWWWWW",
            "internationalization",
            "nobody",
            "wanted.",
        ];
        let mut words: Vec<_> = (0u32..)
            .zip(texts)
            .map(|(i, text)| word(text, 500 + i * 300, 750 + i * 300))
            .collect();
        words.push(word("It", 6_000, 6_200));
        words.push(word("made", 6_250, 6_500));
        words.push(word("$250,000", 6_550, 7_000));
        words.push(word("here.", 7_050, 7_300));
        let quantity = |value: f64, unit: Unit, display: &str| Quantity {
            value,
            unit,
            display: display.to_owned(),
        };
        let events = vec![
            number_event(quantity(40.0, Unit::Percent, "40%"), 1_000, 1_400),
            number_event(quantity(3.0, Unit::None, "3"), 3_500, 3_800),
            number_event(quantity(250_000.0, Unit::Usd, "$250k"), 6_550, 7_000),
        ];
        (transcript(&words), events)
    }

    fn frames(scene: &Scene) -> Vec<DisplayList> {
        (0..scene.frame_count())
            .map(|frame| scene.frame_at(FrameIdx::new(frame).to_time_ms()))
            .collect()
    }

    #[test]
    fn a_60_000_ms_clip_has_1_800_frames_and_a_20_033_ms_clip_601() {
        let empty = transcript(&[]);
        let count = |duration_ms: u32| {
            let scene = build_scene(SceneInput {
                transcript: &empty,
                events: &[],
                edit: &EditState::default(),
                clip: &clip(1080, 1920, duration_ms),
                profile: &profile(1080),
            })
            .unwrap();
            assert_eq!(scene.duration(), DurMs::new(duration_ms));
            scene.frame_count()
        };
        assert_eq!(count(60_000), 1_800);
        assert_eq!(count(20_033), 601);
        assert_eq!(count(90_000), 2_700);
        assert_eq!(count(74_705), 2_242);
        assert_eq!(count(0), 0);
        assert_eq!(count(1), 1);
    }

    #[test]
    fn every_command_of_every_frame_is_inside_the_safe_area() {
        let (transcript, events) = busy();
        let scene = build(&transcript, &events, 1080);
        assert_eq!(scene.summary().visual_moments, 3);
        let (right, bottom) = (SAFE_AREA.x + SAFE_AREA.w, SAFE_AREA.y + SAFE_AREA.h);
        let mut drawn = 0;
        for (frame, list) in frames(&scene).iter().enumerate() {
            for cmd in &list.cmds {
                let Some(b) = bounds(cmd) else { continue };
                drawn += 1;
                let inside = b.x >= SAFE_AREA.x - 0.01
                    && b.y >= SAFE_AREA.y - 0.01
                    && b.x + b.w <= right + 0.01
                    && b.y + b.h <= bottom + 0.01;
                assert!(inside, "frame {frame}: {b:?} of {cmd:?}");
            }
        }
        assert!(drawn > 500, "{drawn}");
    }

    #[test]
    fn two_builds_of_one_input_draw_the_same_frames() {
        let (transcript, events) = busy();
        let (first, second) = (
            build(&transcript, &events, 1080),
            build(&transcript, &events, 1080),
        );
        assert_eq!(first, second);
        assert_eq!(frames(&first), frames(&second));
        // A frame is a function of the scene and the time: asked again, and
        // asked out of order, it is the same.
        let t = TimeMs::new(6_700);
        let before = first.frame_at(t);
        first.frame_at(TimeMs::new(100));
        assert_eq!(first.frame_at(t), before);
        assert!(!before.cmds.is_empty());
    }

    #[test]
    fn at_a_profile_width_of_540_every_coordinate_is_half() {
        let (transcript, events) = busy();
        let full = frames(&build(&transcript, &events, 1080));
        let half = frames(&build(&transcript, &events, 540));
        assert_eq!(full.len(), half.len());
        let mut runs = 0;
        for (full, half) in full.iter().zip(&half) {
            assert_eq!(full.cmds.len(), half.cmds.len());
            for pair in full.cmds.iter().zip(&half.cmds) {
                match pair {
                    (
                        DrawCmd::GlyphRun {
                            font,
                            size,
                            glyphs,
                            fill,
                            stroke,
                            transform,
                            text,
                        },
                        DrawCmd::GlyphRun {
                            font: font_h,
                            size: size_h,
                            glyphs: glyphs_h,
                            fill: fill_h,
                            stroke: stroke_h,
                            transform: transform_h,
                            text: text_h,
                        },
                    ) => {
                        runs += 1;
                        assert_eq!((font, fill, text), (font_h, fill_h, text_h));
                        assert_eq!(*size_h, size / 2.0);
                        assert_eq!(stroke_h.map(|s| s.width), stroke.map(|s| s.width / 2.0));
                        assert_eq!(glyphs.len(), glyphs_h.len());
                        for (glyph, glyph_h) in glyphs.iter().zip(glyphs_h) {
                            assert_eq!(glyph_h.id, glyph.id);
                            // Where the glyph lands on the canvas.
                            let at = transform.apply(glyph.x, glyph.y);
                            let at_h = transform_h.apply(glyph_h.x, glyph_h.y);
                            assert!((at_h.0 - at.0 / 2.0).abs() < 0.001, "{at:?} {at_h:?}");
                            assert!((at_h.1 - at.1 / 2.0).abs() < 0.001, "{at:?} {at_h:?}");
                        }
                    }
                    (
                        DrawCmd::PushLayer { opacity, clip },
                        DrawCmd::PushLayer {
                            opacity: opacity_h,
                            clip: clip_h,
                        },
                    ) => assert_eq!((opacity, clip), (opacity_h, clip_h)),
                    (DrawCmd::PopLayer, DrawCmd::PopLayer) => {}
                    other => panic!("{other:?}"),
                }
            }
        }
        assert!(runs > 500, "{runs}");
    }
}
