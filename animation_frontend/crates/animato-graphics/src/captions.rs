//! Captions: which words are shown together, when, and how (plan 9.3).
//!
//! Chunks follow the same rule as the captions list in the app
//! (`chunkRanges` in `model/transcript.ts`): at most `max_words` words, and a
//! chunk always ends after a word marked `break_after`. On top of that a
//! chunk ends before a word that would need more than `max_lines` lines.

use std::collections::HashMap;

use crate::SceneError;
use crate::display_list::{DrawCmd, FontId, Rect, Rgba, Stroke};
use crate::doc::{Align, CaptionStyle, Case, Highlight, Seconds, Transcript};
use crate::layout::{ShapedRun, shape, width};
use crate::text::{self, Block, Metrics, Motion, Placement};

/// A chunk is shown this long before its first word starts,
pub const LEAD: Seconds = 0.08;
/// and this long after its last word ends.
pub const TAIL: Seconds = 0.12;

#[derive(Clone, Debug, PartialEq)]
pub struct Chunk {
    /// Start and end of each word.
    pub times: Vec<(Seconds, Seconds)>,
    /// Shown from `show.0` up to, not including, `show.1`.
    pub show: (Seconds, Seconds),
    pub block: Block,
    pub at: Placement,
}

impl Chunk {
    pub fn visible_at(&self, t: Seconds) -> bool {
        self.show.0 <= t && t < self.show.1
    }

    /// The chunk's words, as shown.
    pub fn text(&self) -> String {
        self.block
            .lines
            .iter()
            .flat_map(|l| l.words.iter())
            .map(|w| w.runs.iter().map(|r| r.text.as_str()).collect::<String>())
            .collect::<Vec<_>>()
            .join(" ")
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct Captions {
    pub chunks: Vec<Chunk>,
    pub style: CaptionStyle,
    pub highlight: Highlight,
    /// Background padding, in design pixels.
    pub pad: f32,
}

pub fn build(
    transcript: &Transcript,
    style: &CaptionStyle,
    font: FontId,
    area: Rect,
    max_words: u32,
    max_lines: u32,
    highlight: Highlight,
) -> Result<Captions, SceneError> {
    let max_words = max_words.max(1) as usize;
    let max_lines = max_lines.max(1) as usize;
    let metrics = Metrics::of(font, style.size, 1.15)?;
    let pad = if style.background.is_some() {
        style.size * 0.22
    } else {
        0.0
    };
    let room = (area.w - pad * 2.0 - style.stroke.map_or(0.0, |s| s.width)).max(1.0);

    // Each distinct word is shaped once.
    let mut cache: HashMap<String, Vec<ShapedRun>> = HashMap::new();
    let mut words = Vec::new();
    for w in &transcript.words {
        let text = match style.case {
            Case::AsIs => w.text.trim().to_owned(),
            Case::Upper => w.text.trim().to_uppercase(),
        };
        if text.is_empty() || !(w.start.is_finite() && w.end.is_finite()) {
            continue;
        }
        let runs = match cache.get(&text) {
            Some(runs) => runs.clone(),
            None => {
                let runs = shape(&text, font, style.size)?;
                cache.insert(text.clone(), runs.clone());
                runs
            }
        };
        words.push((runs, w.start, w.end.max(w.start), w.break_after));
    }

    // Groups of word indices.
    let mut groups: Vec<Vec<usize>> = Vec::new();
    let mut widths: Vec<f32> = Vec::new();
    for (i, (runs, ..)) in words.iter().enumerate() {
        let w = width(runs);
        let starts = match groups.last() {
            None => true,
            Some(group) => {
                let prev = &words[*group.last().expect("groups are never empty")];
                widths.push(w);
                let too_many_lines = text::line_count(&widths, metrics.space, room) > max_lines;
                widths.pop();
                group.len() >= max_words || prev.3 || too_many_lines
            }
        };
        if starts {
            groups.push(Vec::new());
            widths.clear();
        }
        groups.last_mut().expect("pushed above").push(i);
        widths.push(w);
    }

    let mut chunks: Vec<Chunk> = Vec::with_capacity(groups.len());
    for group in groups {
        let times: Vec<(Seconds, Seconds)> =
            group.iter().map(|&i| (words[i].1, words[i].2)).collect();
        let shaped: Vec<Vec<ShapedRun>> = group.iter().map(|&i| words[i].0.clone()).collect();
        let block = text::block(vec![shaped], &metrics, room);
        let inner = Rect {
            x: area.x + pad,
            y: area.y + pad,
            w: area.w - pad * 2.0,
            h: area.h - pad * 2.0,
        };
        let at = text::place(&block, inner, Align::Center);
        // Shown from a little before its first word to a little after its
        // last, never while the chunk before is still up, which stays at
        // least until its own last word has ended.
        let mut start = (times[0].0 - LEAD).max(0.0);
        if let Some(before) = chunks.last_mut() {
            let last_end = before.times.last().map_or(0.0, |t| t.1);
            let hand_over = start.max(last_end).min(before.show.1);
            before.show.1 = hand_over.max(before.show.0);
            start = start.max(before.show.1);
        }
        let end = times[times.len() - 1].1 + TAIL;
        chunks.push(Chunk {
            times,
            show: (start, end.max(start)),
            block,
            at,
        });
    }
    Ok(Captions {
        chunks,
        style: style.clone(),
        highlight,
        pad,
    })
}

impl Captions {
    /// Adds what is shown at `t`: the chunk's line backgrounds, then its
    /// words, the one being spoken in the active colour.
    pub fn draw(&self, t: Seconds, out: &mut Vec<DrawCmd>) {
        let Some(chunk) = self.chunks.iter().find(|c| c.visible_at(t)) else {
            return;
        };
        if let Some(bg) = self.style.background {
            for i in 0..chunk.block.lines.len() {
                let rect = chunk.at.line_rect(&chunk.block, i, self.pad);
                out.push(DrawCmd::FillRect {
                    rect,
                    radius: self.pad.min(rect.h / 2.0),
                    paint: crate::display_list::Paint::Solid(bg),
                });
            }
        }
        let stroke = self.style.stroke.map(|s| Stroke {
            width: s.width,
            color: s.color,
        });
        let active: Rgba = match (self.highlight, self.style.active_color) {
            (Highlight::Word, Some(c)) => c,
            _ => self.style.color,
        };
        let fill = |i: usize| {
            let (s, e) = chunk.times[i];
            if s <= t && t < e {
                active
            } else {
                self.style.color
            }
        };
        text::draw(
            &chunk.block,
            &chunk.at,
            &Motion::NONE,
            usize::MAX,
            stroke,
            fill,
            out,
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::doc::Word;
    use crate::testing::{INTER, fonts};

    fn style() -> CaptionStyle {
        CaptionStyle {
            font: "Inter".into(),
            size: 54.0,
            weight: 700,
            color: Rgba {
                r: 255,
                g: 255,
                b: 255,
                a: 255,
            },
            active_color: Some(Rgba {
                r: 255,
                g: 214,
                b: 10,
                a: 255,
            }),
            background: Some(Rgba {
                r: 0,
                g: 0,
                b: 0,
                a: 180,
            }),
            stroke: None,
            case: Case::AsIs,
        }
    }

    fn transcript(words: &[(&str, f64, f64, bool)]) -> Transcript {
        Transcript {
            words: words
                .iter()
                .map(|w| Word {
                    text: w.0.into(),
                    start: w.1,
                    end: w.2,
                    break_after: w.3,
                })
                .collect(),
        }
    }

    const AREA: Rect = Rect {
        x: 60.0,
        y: 1500.0,
        w: 900.0,
        h: 220.0,
    };

    fn build_with(t: &Transcript, max_words: u32) -> Captions {
        fonts();
        build(
            t,
            &style(),
            FontId {
                face: INTER,
                weight: 700,
            },
            AREA,
            max_words,
            2,
            Highlight::Word,
        )
        .unwrap()
    }

    #[test]
    fn chunks_end_at_max_words_and_at_marked_breaks_like_the_app_list() {
        let t = transcript(&[
            ("Hello", 0.0, 0.3, false),
            ("there.", 0.35, 0.6, true),
            ("This", 0.8, 1.0, false),
            ("is", 1.05, 1.2, false),
            ("a", 1.25, 1.3, false),
            ("test", 1.35, 1.6, false),
        ]);
        let c = build_with(&t, 3);
        let texts: Vec<String> = c.chunks.iter().map(Chunk::text).collect();
        assert_eq!(texts, ["Hello there.", "This is a", "test"]);
        for pair in c.chunks.windows(2) {
            assert!(pair[0].show.1 <= pair[1].show.0);
        }
    }

    #[test]
    fn exactly_the_spoken_word_is_in_the_active_colour() {
        let t = transcript(&[
            ("we", 1.0, 1.2, false),
            ("made", 1.25, 1.5, false),
            ("it", 1.6, 1.8, false),
        ]);
        let c = build_with(&t, 7);
        let active = style().active_color.unwrap();
        let at = |t: f64| {
            let mut out = Vec::new();
            c.draw(t, &mut out);
            out.into_iter()
                .filter_map(|cmd| match cmd {
                    DrawCmd::GlyphRun { fill, text, .. } => (fill == active).then_some(text),
                    _ => None,
                })
                .collect::<Vec<String>>()
        };
        assert_eq!(at(1.3), ["made"]);
        assert_eq!(at(1.7), ["it"]);
        assert!(at(1.52).is_empty());
        assert!(at(5.0).is_empty());
    }

    #[test]
    fn a_long_chunk_breaks_before_a_third_line_and_stays_in_its_box() {
        let words: Vec<(&str, f64, f64, bool)> = (0..12)
            .map(|i| {
                (
                    "internationalization",
                    i as f64 * 0.3,
                    i as f64 * 0.3 + 0.25,
                    false,
                )
            })
            .collect();
        let c = build_with(&transcript(&words), 12);
        assert!(c.chunks.len() > 1);
        for chunk in &c.chunks {
            assert!(chunk.block.lines.len() <= 2);
            let r = chunk.at.block_rect(&chunk.block, c.pad);
            assert!(
                r.x >= AREA.x - 0.01 && r.right() <= AREA.right() + 0.01,
                "{r:?}"
            );
            assert!(
                r.y >= AREA.y - 0.01 && r.bottom() <= AREA.bottom() + 0.01,
                "{r:?}"
            );
        }
    }
}
