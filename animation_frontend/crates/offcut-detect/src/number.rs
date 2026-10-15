//! NumberReveal candidates: every number that was spoken, with a score for
//! how much it deserves to be shown large (TS §17.4).

use std::collections::BTreeMap;

use offcut_text::{Token, tokenize};
use offcut_types::{
    EventKind, EventParams, NormalizedSpan, Prosody, Span, Transcript, Unit, WordRange,
};

use crate::config::DetectorConfig;

/// A magnitude from here on earns the magnitude bonus.
const LARGE: f64 = 1_000.0;
/// A word said this much louder than its sentence earns the energy bonus.
const EMPHASIS_Z: f32 = 1.0;

/// Something that may become an event. `score` is not yet compared with a
/// threshold, and a candidate is not an event until it is.
#[derive(Clone, Debug, PartialEq)]
pub struct Candidate {
    pub kind: EventKind,
    pub anchors: WordRange,
    pub span: Span,
    pub score: f32,
    pub params: EventParams,
}

/// One candidate for each number of the transcript whose words are still
/// what was transcribed. `toks` are the effective tokens: with the user's
/// edits. A number with an edited or hidden word is left out.
pub fn find(toks: &[Token], t: &Transcript, p: &Prosody, cfg: &DetectorConfig) -> Vec<Candidate> {
    t.numbers
        .iter()
        .filter(|number| unedited(toks, t, number.words))
        .filter_map(|number| candidate(t, p, cfg, number))
        .collect()
}

/// Whether the tokens of these words are the tokens of what was transcribed.
/// V3: a number with an edit is read again from its new text.
fn unedited(toks: &[Token], t: &Transcript, words: WordRange) -> bool {
    let Some(spoken) = t
        .words
        .get(words.start.get() as usize..words.end.get() as usize)
    else {
        return false;
    };
    let from = toks.partition_point(|token| token.word < words.start);
    let to = toks.partition_point(|token| token.word < words.end);
    let effective = toks.get(from..to).unwrap_or(&[]);
    let original = tokenize(spoken, &BTreeMap::new());
    effective.len() == original.len()
        && effective
            .iter()
            .zip(&original)
            .all(|(now, then)| now.kind == then.kind && now.text == then.text)
}

fn candidate(
    t: &Transcript,
    p: &Prosody,
    cfg: &DetectorConfig,
    number: &NormalizedSpan,
) -> Option<Candidate> {
    let range = number.words.start.get() as usize..number.words.end.get() as usize;
    let words = t.words.get(range.clone())?;
    let (first, last) = (words.first()?, words.last()?);

    let mut score = cfg.number_base;
    if number.quantity.unit != Unit::None {
        score += cfg.number_unit_bonus;
    }
    if number.quantity.value.abs() >= LARGE {
        score += cfg.number_magnitude_bonus;
    }
    let emphasized = p
        .per_word
        .get(range)
        .is_some_and(|said| said.iter().any(|word| word.energy_z >= EMPHASIS_Z));
    if emphasized {
        score += cfg.number_energy_bonus;
    }
    // A number is never more certain than the least certain of its words.
    let heard = words
        .iter()
        .map(|word| word.confidence.get())
        .fold(1.0f32, f32::min);
    let score = score.min(1.0) * heard;

    Some(Candidate {
        kind: EventKind::NumberReveal,
        anchors: number.words,
        span: Span::new(first.start_ms, last.end_ms)?,
        score,
        params: EventParams::NumberReveal {
            value: number.quantity.clone(),
            // V3: the words that say what the number counts (D-49).
            label: None,
        },
    })
}
