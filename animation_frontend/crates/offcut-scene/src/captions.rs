//! Captions: which words are shown together, when, and where (TS §19.4).
//! Every time here is a transcript time, used as it is (INV-5).

use std::collections::BTreeMap;

use offcut_types::{Sentence, Span, TimeMs, Transcript, WordIdx};

use crate::SceneError;
use crate::display_list::{Affine, DrawCmd, Stroke};
use crate::layout::{ShapedRun, shape};
use crate::safe_area::CAPTION_ZONE;
use crate::styles::{Case, StyleSpec};

/// A pause this long between two words starts a new chunk.
pub const CHUNK_GAP_MS: u32 = 350;
/// A chunk is shown this long before its first word starts,
pub const CHUNK_LEAD_MS: u32 = 80;
/// and this long after its last word ends.
pub const CHUNK_TAIL_MS: u32 = 120;

/// One word of a caption. A number that was spoken in several words is one
/// caption word; `word` is the first transcript word it stands for.
#[derive(Clone, Debug, PartialEq)]
pub struct CaptionWord {
    pub text: String,
    pub start: TimeMs,
    pub end: TimeMs,
    pub word: WordIdx,
}

/// A word of a line: its runs, and where it starts, measured from the start
/// of the line. `word` is its place in the chunk's `words`.
#[derive(Clone, Debug, PartialEq)]
pub struct LineWord {
    pub word: usize,
    pub x: f32,
    pub runs: Vec<ShapedRun>,
}

/// A line on the canvas, in logical pixels: the left end of its baseline,
/// and the scale that makes a line too wide for the zone fit it.
#[derive(Clone, Debug, PartialEq)]
pub struct Line {
    pub words: Vec<LineWord>,
    pub x: f32,
    pub baseline: f32,
    pub width: f32,
    pub scale: f32,
}

/// Words that are shown together. `show` includes its start and not its end.
#[derive(Clone, Debug, PartialEq)]
pub struct Chunk {
    pub words: Vec<CaptionWord>,
    pub show: Span,
    pub lines: Vec<Line>,
}

impl Chunk {
    pub fn visible_at(&self, t: TimeMs) -> bool {
        self.show.start <= t && t < self.show.end
    }
}

/// The words captions show (TS §17.2): an edit in place of what was
/// transcribed, no word that was edited to nothing, and one word carrying
/// the display of a number in place of the words it was spoken in. A number
/// with an edited word in it is shown as its words.
pub fn words(transcript: &Transcript, edits: &BTreeMap<WordIdx, String>) -> Vec<CaptionWord> {
    let count = u32::try_from(transcript.words.len()).unwrap_or(u32::MAX);
    let mut out = Vec::new();
    let mut index = 0u32;
    while index < count {
        let number = transcript.numbers.iter().find(|span| {
            let (start, end) = (span.words.start.get(), span.words.end.get());
            let edited = edits
                .range(span.words.start..span.words.end)
                .next()
                .is_some();
            start == index && end > start && end <= count && !edited
        });
        let first = transcript.words.get(index as usize);
        if let (Some(number), Some(first)) = (number, first) {
            let end = number.words.end.get();
            let last = transcript
                .words
                .get(end.saturating_sub(1) as usize)
                .unwrap_or(first);
            let display = &number.quantity.display;
            push(&mut out, display, first.start_ms, last.end_ms, index);
            index = end;
            continue;
        }
        if let Some(word) = first {
            let text = edits.get(&WordIdx::new(index)).unwrap_or(&word.text);
            push(&mut out, text, word.start_ms, word.end_ms, index);
        }
        index = index.saturating_add(1);
    }
    out
}

fn push(out: &mut Vec<CaptionWord>, text: &str, start: TimeMs, end: TimeMs, word: u32) {
    let text = text.trim();
    if text.is_empty() {
        return;
    }
    out.push(CaptionWord {
        text: text.to_owned(),
        start,
        end: end.max(start),
        word: WordIdx::new(word),
    });
}

/// A word of a chunk that is being put together: its text in the style's
/// case, and the line of the chunk it is on.
struct Placed<'a> {
    word: &'a CaptionWord,
    text: String,
    line: u32,
}

/// The chunks of `words`, each one shaped and placed. A new chunk starts at
/// a sentence boundary, after a pause of `CHUNK_GAP_MS`, when the chunk has
/// `max_words`, and when the word would need a line more than `max_lines`.
pub fn chunk(
    words: &[CaptionWord],
    sentences: &[Sentence],
    style: &StyleSpec,
) -> Result<Vec<Chunk>, SceneError> {
    let per_line = style.max_chars_per_line.max(1);
    let max_lines = style.max_lines.max(1);
    let max_words = style.max_words.max(1) as usize;
    let sentence_of = |word: &CaptionWord| sentences.partition_point(|s| s.words.end <= word.word);

    let mut groups: Vec<Vec<Placed<'_>>> = Vec::new();
    let (mut line, mut line_chars) = (0u32, 0u32);
    for word in words {
        let text = match style.case {
            Case::AsSpoken => word.text.clone(),
            Case::Upper => word.text.to_uppercase(),
        };
        let chars = u32::try_from(text.chars().count()).unwrap_or(u32::MAX);
        let fits = line_chars.saturating_add(1).saturating_add(chars) <= per_line;
        let before = groups
            .last()
            .and_then(|group| group.last().map(|placed| (placed.word, group.len())));
        let starts_chunk = before.is_none_or(|(prev, len)| {
            sentence_of(prev) != sentence_of(word)
                || word.start.get().saturating_sub(prev.end.get()) >= CHUNK_GAP_MS
                || len >= max_words
                || (!fits && line.saturating_add(1) >= max_lines)
        });
        if starts_chunk {
            groups.push(Vec::new());
            (line, line_chars) = (0, chars);
        } else if fits {
            line_chars = line_chars.saturating_add(1).saturating_add(chars);
        } else {
            (line, line_chars) = (line.saturating_add(1), chars);
        }
        if let Some(group) = groups.last_mut() {
            group.push(Placed { word, text, line });
        }
    }

    let space: f32 = shape(" ", style.font, style.size)?
        .iter()
        .map(|run| run.width)
        .sum();
    let mut chunks: Vec<Chunk> = Vec::with_capacity(groups.len());
    for group in &groups {
        let (Some(first), Some(last)) = (group.first(), group.last()) else {
            continue;
        };
        let lines = lines(group, space, style)?;
        // Shown from a little before its first word to a little after its
        // last, and never while the chunk before it is still shown. The
        // chunk before stays at least until its own last word has ended.
        let mut start = first.word.start.get().saturating_sub(CHUNK_LEAD_MS);
        if let Some(before) = chunks.last_mut() {
            let last_word_end = before.words.last().map_or(0, |word| word.end.get());
            let hand_over = start.max(last_word_end).min(before.show.end.get());
            before.show.end = TimeMs::new(hand_over.max(before.show.start.get()));
            start = start.max(before.show.end.get());
        }
        let end = last.word.end.get().saturating_add(CHUNK_TAIL_MS);
        chunks.push(Chunk {
            words: group.iter().map(|placed| placed.word.clone()).collect(),
            show: Span {
                start: TimeMs::new(start),
                end: TimeMs::new(end.max(start)),
            },
            lines,
        });
    }
    Ok(chunks)
}

/// The lines of one chunk: centred in the caption zone, one under the other.
fn lines(group: &[Placed<'_>], space: f32, style: &StyleSpec) -> Result<Vec<Line>, SceneError> {
    let mut lines: Vec<Line> = Vec::new();
    let (mut ascent, mut descent) = (0.0f32, 0.0f32);
    for (index, placed) in group.iter().enumerate() {
        let runs = shape(&placed.text, style.font, style.size)?;
        for run in &runs {
            ascent = ascent.max(run.ascent);
            descent = descent.max(run.descent);
        }
        while lines.len() <= placed.line as usize {
            lines.push(Line {
                words: Vec::new(),
                x: 0.0,
                baseline: 0.0,
                width: 0.0,
                scale: 1.0,
            });
        }
        let Some(line) = lines.get_mut(placed.line as usize) else {
            continue;
        };
        let x = if line.words.is_empty() {
            0.0
        } else {
            line.width + space
        };
        line.width = x + runs.iter().map(|run| run.width).sum::<f32>();
        line.words.push(LineWord {
            word: index,
            x,
            runs,
        });
    }

    let height = ascent + descent;
    let top = CAPTION_ZONE.y + (CAPTION_ZONE.h - height * lines.len() as f32) / 2.0;
    // The stroke of the outermost glyphs stays in the zone as well.
    let room = CAPTION_ZONE.w - style.stroke_width.max(0.0);
    for (index, line) in lines.iter_mut().enumerate() {
        line.scale = if line.width > room {
            room / line.width
        } else {
            1.0
        };
        line.x = CAPTION_ZONE.x + (CAPTION_ZONE.w - line.width * line.scale) / 2.0;
        line.baseline = top + height * index as f32 + ascent;
    }
    Ok(lines)
}

/// Adds the chunk as it looks at `t`: the word that is being spoken in the
/// active colour, the others in the fill colour.
pub fn draw(chunk: &Chunk, t: TimeMs, style: &StyleSpec, out: &mut Vec<DrawCmd>) {
    let stroke = (style.stroke_width > 0.0).then_some(Stroke {
        width: style.stroke_width,
        color: style.stroke_color,
    });
    for line in &chunk.lines {
        for placed in &line.words {
            let active = chunk
                .words
                .get(placed.word)
                .is_some_and(|word| word.start <= t && t < word.end);
            let fill = if active {
                style.active_color
            } else {
                style.fill
            };
            let mut x = placed.x;
            for run in &placed.runs {
                let left = line.x + x * line.scale;
                out.push(DrawCmd::GlyphRun {
                    font: run.font,
                    size: run.size,
                    glyphs: run.glyphs.clone(),
                    fill,
                    stroke,
                    transform: Affine::scale_then_translate(line.scale, left, line.baseline),
                    text: run.text.clone(),
                });
                x += run.width;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use offcut_types::StyleId;

    use super::*;
    use crate::styles::spec;
    use crate::testing::{transcript, word};

    fn chunks_of(timed: &[(&str, u32, u32)]) -> Vec<Chunk> {
        let spoken: Vec<_> = timed.iter().map(|w| word(w.0, w.1, w.2)).collect();
        let transcript = transcript(&spoken);
        let words = words(&transcript, &BTreeMap::new());
        chunk(&words, &transcript.sentences, &spec(StyleId::Clean)).unwrap()
    }

    #[test]
    fn twelve_words_in_one_sentence_make_chunks_of_at_most_5_words_and_2_lines_of_18_characters() {
        let texts = [
            "we",
            "spent",
            "three",
            "long",
            "months",
            "building",
            "something",
            "nobody",
            "wanted",
            "to",
            "use",
            "today.",
        ];
        let timed: Vec<(&str, u32, u32)> = (0u32..)
            .zip(texts)
            .map(|(i, text)| (text, i * 300, i * 300 + 250))
            .collect();
        let chunks = chunks_of(&timed);

        assert!(chunks.len() >= 3);
        for chunk in &chunks {
            assert!(chunk.words.len() <= 5, "{:?}", chunk.words);
            assert!(chunk.lines.len() <= 2);
            for line in &chunk.lines {
                let text: Vec<&str> = line
                    .words
                    .iter()
                    .map(|w| chunk.words[w.word].text.as_str())
                    .collect();
                assert!(text.join(" ").chars().count() <= 18, "{text:?}");
                assert!(line.x >= CAPTION_ZONE.x);
                assert!(line.x + line.width <= CAPTION_ZONE.x + CAPTION_ZONE.w);
            }
        }
        // The words keep their order. A number is shown as its display, also
        // one that was spoken as a word (TS §17.2).
        let shown: Vec<&str> = chunks
            .iter()
            .flat_map(|c| c.words.iter().map(|w| w.text.as_str()))
            .collect();
        let mut expected = texts;
        expected[2] = "3";
        assert_eq!(shown, expected);
        // The chunks never overlap in time.
        for pair in chunks.windows(2) {
            assert!(pair[0].show.start < pair[0].show.end);
            assert!(pair[0].show.end <= pair[1].show.start);
        }
    }

    #[test]
    fn words_a_pause_apart_are_two_chunks_and_nothing_shows_in_the_pause() {
        let chunks = chunks_of(&[("hello", 1_000, 1_300), ("again", 5_000, 5_300)]);
        assert_eq!(chunks.len(), 2);
        // 80 ms before the first word, 120 ms after the last; no time is moved.
        let shows: Vec<(u32, u32)> = chunks
            .iter()
            .map(|c| (c.show.start.get(), c.show.end.get()))
            .collect();
        assert_eq!(shows, [(920, 1_420), (4_920, 5_420)]);
        assert!(chunks.iter().all(|c| !c.visible_at(TimeMs::new(3_000))));
        assert!(chunks[0].visible_at(TimeMs::new(920)));
        assert!(!chunks[0].visible_at(TimeMs::new(1_420)));

        // 349 ms is not a pause; 350 ms is.
        assert_eq!(chunks_of(&[("one", 0, 300), ("two", 649, 900)]).len(), 1);
        assert_eq!(chunks_of(&[("one", 0, 300), ("two", 650, 900)]).len(), 2);
        // A full stop ends the chunk. The next one waits for its last word to end.
        let split = chunks_of(&[("Done.", 0, 300), ("Next", 320, 600)]);
        assert_eq!(split.len(), 2);
        assert_eq!(split[0].show.end.get(), 300);
        assert_eq!(split[1].show.start.get(), 300);
    }

    #[test]
    fn inside_a_chunk_exactly_one_glyph_run_uses_the_active_colour() {
        let style = spec(StyleId::Clean);
        let chunks = chunks_of(&[
            ("we", 1_000, 1_200),
            ("made", 1_250, 1_500),
            ("it", 1_600, 1_800),
        ]);
        assert_eq!(chunks.len(), 1);
        let active_at = |t: u32| {
            let mut out = Vec::new();
            draw(&chunks[0], TimeMs::new(t), &style, &mut out);
            assert_eq!(out.len(), 3);
            out.into_iter()
                .filter_map(|cmd| match cmd {
                    DrawCmd::GlyphRun {
                        fill, text, stroke, ..
                    } => {
                        assert_eq!(stroke.map(|s| s.width), Some(6.0));
                        (fill == style.active_color).then_some(text)
                    }
                    DrawCmd::FillRect { .. }
                    | DrawCmd::FillPath { .. }
                    | DrawCmd::PushLayer { .. }
                    | DrawCmd::PopLayer => panic!("a caption draws glyph runs only"),
                })
                .collect::<Vec<String>>()
        };
        assert_eq!(active_at(1_250), ["made"]);
        assert_eq!(active_at(1_499), ["made"]);
        assert_eq!(active_at(1_700), ["it"]);
        // Between two words, and before the first, no word is active.
        assert!(active_at(1_520).is_empty());
        assert!(active_at(950).is_empty());
    }
}
