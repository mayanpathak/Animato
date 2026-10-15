//! NumberReveal: a spoken number, shown large while it is said (TS §19.5).

use offcut_text::format_quantity;
use offcut_types::{OUTPUT_FPS, Quantity, Span, TimeMs};

use crate::SceneError;
use crate::anim::{self, eval};
use crate::display_list::{Affine, DrawCmd, Rgba, Stroke};
use crate::easing::{Easing, ease};
use crate::layout::{ShapedRun, shape};
use crate::safe_area::EVENT_ZONE;
use crate::styles::StyleSpec;

/// The size of the number, in logical pixels, when it fits.
pub const VALUE_SIZE: f32 = 200.0;
/// A number that would have to be smaller than this is not shown (TS §19.7).
pub const MIN_VALUE_SIZE: f32 = 96.0;
pub const LABEL_SIZE: f32 = 48.0;
/// A whole number from here on counts up; a smaller one scales in.
pub const COUNT_UP_FROM: f64 = 10.0;
pub const COUNT_UP_MS: u32 = 500;
pub const SCALE_IN_MS: u32 = 200;
pub const SCALE_IN_FROM: f32 = 0.8;
/// How long the number stays after its last word has ended,
pub const HOLD_MS: u32 = 1_200;
/// and how long it then takes to fade.
pub const FADE_MS: u32 = 200;

/// A text shaped once: its runs and what they measure together.
#[derive(Clone, Debug, PartialEq)]
struct Text {
    runs: Vec<ShapedRun>,
    width: f32,
    ascent: f32,
    descent: f32,
}

/// A NumberReveal laid out. `draw` shapes nothing: every text it can show
/// was shaped here.
#[derive(Clone, Debug, PartialEq)]
pub struct Track {
    span: Span,
    /// The number as it is at each output frame of the count-up; empty for a
    /// number that scales in.
    counting: Vec<Text>,
    value: Text,
    label: Option<Text>,
    scale: anim::Track,
    opacity: anim::Track,
    fill: Rgba,
    stroke: Option<Stroke>,
    /// The top of the number's box and of the label's, in logical pixels.
    value_top: f32,
    label_top: f32,
    label_scale: f32,
}

fn text(string: &str, style: &StyleSpec, size: f32) -> Result<Text, SceneError> {
    let runs = shape(string, style.font, size)?;
    Ok(Text {
        width: runs.iter().map(|run| run.width).sum(),
        ascent: runs.iter().map(|run| run.ascent).fold(0.0, f32::max),
        descent: runs.iter().map(|run| run.descent).fold(0.0, f32::max),
        runs,
    })
}

/// The number at each frame of its count-up, as text. Empty when it does
/// not count up.
fn count_up(value: &Quantity, easing: Easing) -> Vec<String> {
    let counts = value.value.is_finite() && value.value.fract() == 0.0;
    if !counts || value.value < COUNT_UP_FROM {
        return Vec::new();
    }
    // One per output frame that starts inside the window.
    let frames = (COUNT_UP_MS * OUTPUT_FPS).div_ceil(1_000);
    (0..frames)
        .map(|frame| {
            let x = frame as f32 / frames as f32;
            let shown = (value.value * f64::from(ease(easing, x))).round();
            format_quantity(shown, &value.unit)
        })
        .collect()
}

/// `None` when there is nothing to draw, or the number would have to be
/// smaller than `MIN_VALUE_SIZE` to fit the zone.
pub fn layout(
    value: &Quantity,
    label: Option<&str>,
    span: Span,
    style: &StyleSpec,
) -> Result<Option<Track>, SceneError> {
    let stroke = (style.stroke_width > 0.0).then_some(Stroke {
        width: style.stroke_width,
        color: style.stroke_color,
    });
    let room = EVENT_ZONE.w - style.stroke_width.max(0.0);
    let strings = count_up(value, style.easing);

    // One size for the whole reveal: the size at which the widest text it
    // shows fits. A count-up passes texts that are wider than its end.
    let at_full = |string: &str| text(string, style, VALUE_SIZE).map(|text| text.width);
    let mut widest = at_full(&value.display)?;
    if widest <= 0.0 {
        return Ok(None);
    }
    for string in &strings {
        widest = widest.max(at_full(string)?);
    }
    let size = if widest > room {
        VALUE_SIZE * room / widest
    } else {
        VALUE_SIZE
    };
    if size < MIN_VALUE_SIZE {
        return Ok(None);
    }

    let shown = text(&value.display, style, size)?;
    let mut counting = Vec::with_capacity(strings.len());
    for string in &strings {
        counting.push(text(string, style, size)?);
    }
    let label = match label.map(str::trim).filter(|label| !label.is_empty()) {
        Some(label) => Some(text(label, style, LABEL_SIZE)?).filter(|text| text.width > 0.0),
        None => None,
    };

    let value_height = shown.ascent + shown.descent;
    let label_height = label.as_ref().map_or(0.0, |l| l.ascent + l.descent);
    let value_top = EVENT_ZONE.y + (EVENT_ZONE.h - value_height - label_height) / 2.0;
    let enter = if counting.is_empty() {
        vec![
            (span.start, SCALE_IN_FROM),
            (after(span.start, SCALE_IN_MS), 1.0),
        ]
    } else {
        vec![(span.start, 1.0)]
    };
    let hold_end = after(span.end, HOLD_MS);
    Ok(Some(Track {
        span,
        counting,
        label_scale: label
            .as_ref()
            .map_or(1.0, |l| if l.width > room { room / l.width } else { 1.0 }),
        value: shown,
        label,
        scale: anim::Track {
            keys: enter,
            easing: style.easing,
        },
        opacity: anim::Track {
            keys: vec![(hold_end, 1.0), (after(hold_end, FADE_MS), 0.0)],
            easing: Easing::Linear,
        },
        fill: style.fill,
        stroke,
        value_top,
        label_top: value_top + value_height,
    }))
}

fn after(t: TimeMs, ms: u32) -> TimeMs {
    TimeMs::new(t.get().saturating_add(ms))
}

/// Shown from the start of its first word until the fade has ended.
pub fn visible_at(track: &Track, t: TimeMs) -> bool {
    track.span.start <= t && t < after(after(track.span.end, HOLD_MS), FADE_MS)
}

/// Adds the reveal as it looks at `t`; nothing outside its time.
pub fn draw(track: &Track, t: TimeMs, out: &mut Vec<DrawCmd>) {
    if !visible_at(track, t) {
        return;
    }
    let since = t.get().saturating_sub(track.span.start.get());
    let frame = (u64::from(since) * u64::from(OUTPUT_FPS) / 1_000) as usize;
    let shown = if since < COUNT_UP_MS {
        track.counting.get(frame).unwrap_or(&track.value)
    } else {
        &track.value
    };

    let opacity = eval(&track.opacity, t);
    let fading = opacity < 1.0;
    if fading {
        out.push(DrawCmd::PushLayer {
            opacity,
            clip: None,
        });
    }
    let centre_x = EVENT_ZONE.x + EVENT_ZONE.w / 2.0;
    // The number grows from the middle of its own box.
    let height = track.value.ascent + track.value.descent;
    let pivot_y = track.value_top + height / 2.0;
    let scale = eval(&track.scale, t);
    let baseline = pivot_y + scale * (track.value.ascent - height / 2.0);
    runs(track, shown, scale, centre_x, baseline, out);
    if let Some(label) = &track.label {
        let baseline = track.label_top + label.ascent;
        runs(track, label, track.label_scale, centre_x, baseline, out);
    }
    if fading {
        out.push(DrawCmd::PopLayer);
    }
}

/// `text` at `scale`, centred on `centre_x`, on `baseline`.
fn runs(
    track: &Track,
    text: &Text,
    scale: f32,
    centre_x: f32,
    baseline: f32,
    out: &mut Vec<DrawCmd>,
) {
    let mut x = -text.width / 2.0;
    for run in &text.runs {
        out.push(DrawCmd::GlyphRun {
            font: run.font,
            size: run.size,
            glyphs: run.glyphs.clone(),
            fill: track.fill,
            stroke: track.stroke,
            transform: Affine::scale_then_translate(scale, centre_x + x * scale, baseline),
            text: run.text.clone(),
        });
        x += run.width;
    }
}

#[cfg(test)]
mod tests {
    use offcut_types::{EditState, StyleId, Unit};

    use super::*;
    use crate::styles::spec;
    use crate::testing::{build, clip, number_event, profile, transcript, word};
    use crate::{SceneInput, build_scene};

    fn quantity(value: f64, unit: Unit, display: &str) -> Quantity {
        Quantity {
            value,
            unit,
            display: display.to_owned(),
        }
    }

    fn span(start: u32, end: u32) -> Span {
        Span::new(TimeMs::new(start), TimeMs::new(end)).unwrap()
    }

    /// What is drawn at `t`: the texts of the runs, and the opacity of the layer.
    fn at(track: &Track, t: u32) -> (Vec<String>, Option<f32>) {
        let mut out = Vec::new();
        draw(track, TimeMs::new(t), &mut out);
        let mut layer = None;
        let mut texts = Vec::new();
        for cmd in out {
            match cmd {
                DrawCmd::GlyphRun { text, .. } => texts.push(text),
                DrawCmd::PushLayer { opacity, clip } => {
                    assert_eq!(clip, None);
                    layer = Some(opacity);
                }
                DrawCmd::PopLayer => {}
                DrawCmd::FillRect { .. } | DrawCmd::FillPath { .. } => {
                    panic!("a number draws glyph runs only")
                }
            }
        }
        (texts, layer)
    }

    #[test]
    fn ten_thousand_dollars_counts_up_holds_and_goes() {
        let style = spec(StyleId::Clean);
        let value = quantity(10_000.0, Unit::Usd, "$10k");
        let track = layout(&value, None, span(2_000, 2_400), &style)
            .unwrap()
            .unwrap();

        assert_eq!(at(&track, 1_900), (vec![], None));
        assert_eq!(at(&track, 1_999), (vec![], None));
        // The first frame of the count-up, and one a tenth of a second in.
        assert_eq!(at(&track, 2_000), (vec!["$0".to_owned()], None));
        assert_eq!(at(&track, 2_100), (vec!["$4,880".to_owned()], None));
        assert_eq!(at(&track, 2_499).0, ["$9,997"]);
        // The end of the count-up is the display of the quantity.
        assert_eq!(at(&track, 2_500), (vec!["$10k".to_owned()], None));
        assert_eq!(at(&track, 2_600), (vec!["$10k".to_owned()], None));
        // Held for 1,200 ms after the last word, then gone in 200 ms.
        assert_eq!(at(&track, 3_600), (vec!["$10k".to_owned()], None));
        assert_eq!(at(&track, 3_700), (vec!["$10k".to_owned()], Some(0.5)));
        assert_eq!(at(&track, 3_800), (vec![], None));
        assert_eq!(at(&track, 3_900), (vec![], None));
        // At most 16 texts: 15 frames of counting and the end.
        assert_eq!(track.counting.len(), 15);

        // A number below 10, or one that is not whole, scales in: 0.8 to 1 in 200 ms.
        for small in [
            quantity(3.0, Unit::None, "3"),
            quantity(12.5, Unit::Percent, "12.5%"),
        ] {
            let track = layout(&small, None, span(2_000, 2_400), &style)
                .unwrap()
                .unwrap();
            assert!(track.counting.is_empty());
            let scale_at = |t: u32| {
                let mut out = Vec::new();
                draw(&track, TimeMs::new(t), &mut out);
                match out.as_slice() {
                    [DrawCmd::GlyphRun { transform, .. }] => transform.m[0],
                    other => panic!("{other:?}"),
                }
            };
            assert_eq!(scale_at(2_000), 0.8);
            assert!(scale_at(2_100) > 0.8 && scale_at(2_100) < 1.0);
            assert_eq!(scale_at(2_200), 1.0);
            assert_eq!(scale_at(3_000), 1.0);
        }

        // A label is a second row under the number. V2 detects none.
        let labelled = layout(&value, Some("in sales"), span(2_000, 2_400), &style)
            .unwrap()
            .unwrap();
        assert_eq!(at(&labelled, 2_600).0, ["$10k", "in sales"]);
    }

    #[test]
    fn a_number_that_cannot_fit_at_96_lp_is_dropped() {
        let style = spec(StyleId::Clean);
        let long = "123,456,789,012,345,678";
        let value = quantity(1.234_567_890_123_456_7e20, Unit::None, long);
        assert_eq!(layout(&value, None, span(2_000, 2_400), &style), Ok(None));

        let transcript = transcript(&[word("so", 1_000, 1_200), word("much", 1_300, 1_600)]);
        let events = [number_event(value, 2_000, 2_400)];
        let edit = EditState::default();
        let (clip, profile) = (clip(1080, 1920, 10_000), profile(1080));
        let scene = build_scene(SceneInput {
            transcript: &transcript,
            events: &events,
            edit: &edit,
            clip: &clip,
            profile: &profile,
        })
        .unwrap();
        assert_eq!(scene.summary().visual_moments, 0);
        assert!(scene.frame_at(TimeMs::new(2_600)).cmds.is_empty());

        // One that fits is counted, and one a little too wide is made smaller.
        let fits = [number_event(
            quantity(10_000.0, Unit::Usd, "$10k"),
            2_000,
            2_400,
        )];
        assert_eq!(build(&transcript, &fits, 1080).summary().visual_moments, 1);
        let wide = quantity(250_000.0, Unit::Usd, "$250k");
        let track = layout(&wide, None, span(2_000, 2_400), &style)
            .unwrap()
            .unwrap();
        assert!(track.value.runs[0].size < VALUE_SIZE);
        assert!(track.value.runs[0].size > MIN_VALUE_SIZE);
        let room = EVENT_ZONE.w - style.stroke_width;
        assert!(track.counting.iter().all(|text| text.width <= room + 0.01));
    }
}
