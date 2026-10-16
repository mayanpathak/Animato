//! Scene-level tests on the shared fixture (`src/features/editor/graphics/
//! fixtures`): JSON round trip, determinism, scaling, containment, snapshots
//! and the timing budgets of plan 8.9.

use std::time::Instant;

use crate::layout::{shape, width};
use crate::testing::fonts;
use crate::*;

const DOC: &str = include_str!("../../../src/features/editor/graphics/fixtures/sample-doc.json");
const TRANSCRIPT: &str =
    include_str!("../../../src/features/editor/graphics/fixtures/sample-transcript.json");

fn doc_at(width: u32, height: u32) -> GraphicsDoc {
    let mut doc = parse_doc(DOC).unwrap();
    doc.canvas.width = width;
    doc.canvas.height = height;
    doc
}

fn transcript() -> Transcript {
    parse_transcript(TRANSCRIPT).unwrap().unwrap()
}

fn scene(width: u32, height: u32) -> Scene {
    fonts();
    build_scene(&doc_at(width, height), Some(&transcript())).unwrap()
}

/// Every 1/30 s of the fixture's 12 s.
fn times() -> impl Iterator<Item = f64> {
    (0..360).map(|f| f64::from(f) / 30.0)
}

fn all_cmds(f: &FrameGraphics) -> impl Iterator<Item = &DrawCmd> {
    f.under.cmds.iter().chain(f.over.cmds.iter())
}

#[test]
fn the_document_survives_a_json_round_trip() {
    let doc = parse_doc(DOC).unwrap();
    let again = serde_json::to_string(&doc).unwrap();
    assert_eq!(parse_doc(&again).unwrap(), doc);
    // And the JSON itself is the same document as the fixture's (numbers
    // compared as numbers; the fixture spells out every optional field).
    let a: serde_json::Value = serde_json::from_str(DOC).unwrap();
    let b: serde_json::Value = serde_json::from_str(&again).unwrap();
    assert_eq!(round_floats(a, 1e6), round_floats(b, 1e6));
}

#[test]
fn every_item_kind_draws_something() {
    let s = scene(1080, 1920);
    let mut kinds = std::collections::BTreeSet::new();
    for t in times() {
        for cmd in all_cmds(&s.frame_at(t)) {
            kinds.insert(
                serde_json::to_value(cmd).unwrap()["cmd"]
                    .as_str()
                    .unwrap()
                    .to_owned(),
            );
        }
    }
    let kinds: Vec<&str> = kinds.iter().map(String::as_str).collect();
    assert_eq!(
        kinds,
        [
            "blurredRoundedRect",
            "fillPath",
            "fillRect",
            "glyphRun",
            "image",
            "popLayer",
            "pushLayer",
            "strokePath"
        ]
    );
}

#[test]
fn two_builds_draw_the_same_frames_in_any_order() {
    let (a, b) = (scene(1080, 1920), scene(1080, 1920));
    assert_eq!(a, b);
    let before = a.frame_at(2.0);
    a.frame_at(11.5);
    a.frame_at(0.1);
    assert_eq!(a.frame_at(2.0), before);
    assert!(!before.over.cmds.is_empty());
}

#[test]
fn at_half_the_canvas_every_coordinate_is_half() {
    let full = scene(1080, 1920);
    let half = scene(540, 960);
    for t in times() {
        let (f, h) = (full.frame_at(t), half.frame_at(t));
        let (mut f, mut h): (Vec<_>, Vec<_>) = (
            all_cmds(&f).cloned().collect(),
            all_cmds(&h).cloned().collect(),
        );
        assert_eq!(f.len(), h.len(), "t={t}");
        for cmd in &mut f {
            cmd.scale(0.5);
        }
        for (a, b) in f.iter_mut().zip(h.iter_mut()) {
            // Positions agree to a hundredth of a pixel.
            let round = |v: serde_json::Value| round_floats(v, 100.0);
            assert_eq!(
                round(serde_json::to_value(&*a).unwrap()),
                round(serde_json::to_value(&*b).unwrap()),
                "t={t}"
            );
        }
    }
}

fn round_floats(v: serde_json::Value, k: f64) -> serde_json::Value {
    use serde_json::Value;
    match v {
        Value::Number(n) => n
            .as_f64()
            .map_or(Value::Number(n), |f| serde_json::json!((f * k).round() / k)),
        Value::Array(a) => Value::Array(a.into_iter().map(|v| round_floats(v, k)).collect()),
        Value::Object(o) => Value::Object(
            o.into_iter()
                .map(|(key, v)| (key, round_floats(v, k)))
                .collect(),
        ),
        other => other,
    }
}

/// Where a glyph run's line box lies on the canvas.
fn run_bounds(cmd: &DrawCmd) -> Option<Rect> {
    let DrawCmd::GlyphRun {
        font,
        size,
        transform,
        text,
        stroke,
        ..
    } = cmd
    else {
        return None;
    };
    let runs = shape(text, *font, *size / transform.m[0]).unwrap();
    let k = transform.m[0];
    let pad = stroke.map_or(0.0, |s| s.width / 2.0);
    let ascent = runs.iter().map(|r| r.ascent).fold(0.0, f32::max);
    let descent = runs.iter().map(|r| r.descent).fold(0.0, f32::max);
    let (x, y) = transform.apply(0.0, 0.0);
    Some(Rect {
        x: x - pad,
        y: y - ascent * k - pad,
        w: width(&runs) * k + pad * 2.0,
        h: (ascent + descent) * k + pad * 2.0,
    })
}

#[test]
fn text_stays_in_the_safe_area_in_every_format() {
    for (w, h) in [(1080, 1920), (1920, 1080), (1080, 1080)] {
        let s = scene(w, h);
        let safe = safe_area::safe_area(w as f32, h as f32);
        let mut runs = 0;
        for t in times() {
            // The end card's own text is checked too; its background is the canvas.
            for cmd in all_cmds(&s.frame_at(t)) {
                let Some(b) = run_bounds(cmd) else { continue };
                runs += 1;
                let inside = b.x >= safe.x - 1.0
                    && b.y >= safe.y - 1.0
                    && b.right() <= safe.right() + 1.0
                    && b.bottom() <= safe.bottom() + 1.0;
                assert!(inside, "{w}x{h} t={t}: {b:?} outside {safe:?}: {cmd:?}");
            }
        }
        assert!(runs > 300, "{runs}");
    }
}

#[test]
fn the_captions_highlight_the_spoken_word_and_the_end_card_takes_the_last_two_seconds() {
    let s = scene(1080, 1920);
    let yellow = doc::parse_hex("#ffd60a").unwrap();
    let words_at = |t: f64| -> Vec<(String, bool)> {
        s.frame_at(t)
            .over
            .cmds
            .iter()
            .filter_map(|c| match c {
                DrawCmd::GlyphRun { text, fill, .. } => Some((text.clone(), *fill == yellow)),
                _ => None,
            })
            .collect()
    };
    let at = words_at(1.3);
    assert!(at.contains(&("ball".to_owned(), true)), "{at:?}");
    assert!(at.contains(&("Imagine".to_owned(), false)), "{at:?}");
    // The end card covers the canvas from 10 s.
    let end = s.frame_at(11.0);
    assert!(
        end.over
            .cmds
            .iter()
            .any(|c| matches!(c, DrawCmd::GlyphRun { text, .. } if text == "yours"))
    );
    assert!(
        !s.frame_at(9.0)
            .over
            .cmds
            .iter()
            .any(|c| matches!(c, DrawCmd::GlyphRun { text, .. } if text == "yours"))
    );
}

/// Snapshots of the display lists per format at fixed times. Set
/// `UPDATE_SNAPSHOTS=1` to write them after an intended change.
#[test]
fn display_lists_match_their_snapshots() {
    for (name, w, h) in [
        ("9x16", 1080, 1920),
        ("16x9", 1920, 1080),
        ("1x1", 1080, 1080),
    ] {
        let s = scene(w, h);
        let frames: Vec<(f64, FrameGraphics)> = [0.0, 0.7, 1.3, 4.5, 7.0, 11.0]
            .iter()
            .map(|&t| (t, s.frame_at(t)))
            .collect();
        let json = round_floats(serde_json::to_value(&frames).unwrap(), 1000.0);
        let text = serde_json::to_string_pretty(&json).unwrap() + "\n";
        let path = format!("{}/snapshots/{name}.json", env!("CARGO_MANIFEST_DIR"));
        if std::env::var_os("UPDATE_SNAPSHOTS").is_some() {
            std::fs::create_dir_all(format!("{}/snapshots", env!("CARGO_MANIFEST_DIR"))).unwrap();
            std::fs::write(&path, &text).unwrap();
            continue;
        }
        let stored = std::fs::read_to_string(&path)
            .unwrap_or_else(|_| panic!("{path} missing: run with UPDATE_SNAPSHOTS=1"));
        assert!(
            stored == text,
            "{name}: the display lists changed; check them and run with UPDATE_SNAPSHOTS=1"
        );
    }
}

/// Plan 8.9: a scene builds in 8 ms and `frame_at` takes under 1 ms. Timed in
/// release builds only (`cargo test --release`); debug builds print.
#[test]
fn scene_build_and_frame_at_are_within_budget() {
    fonts();
    let doc = doc_at(1080, 1920);
    let tr = transcript();
    build_scene(&doc, Some(&tr)).unwrap(); // shaping caches warm
    let t0 = Instant::now();
    let runs = 20;
    let mut s = None;
    for _ in 0..runs {
        s = Some(build_scene(&doc, Some(&tr)).unwrap());
    }
    let build_ms = t0.elapsed().as_secs_f64() * 1000.0 / f64::from(runs);
    let s = s.unwrap();
    let t0 = Instant::now();
    let n = times().count() as f64;
    for t in times() {
        std::hint::black_box(s.frame_at(t));
    }
    let frame_ms = t0.elapsed().as_secs_f64() * 1000.0 / n;
    println!("scene build {build_ms:.3} ms, frame_at {frame_ms:.4} ms");
    if !cfg!(debug_assertions) {
        assert!(build_ms <= 8.0, "build {build_ms} ms");
        assert!(frame_ms <= 1.0, "frame_at {frame_ms} ms");
    }
}
