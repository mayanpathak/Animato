//! Where one sentence ends and the next begins (TS §17.2).

use offcut_types::{DurMs, Sentence, Word, WordIdx, WordRange};

/// A silence this long between two words starts a new sentence.
pub const SENTENCE_GAP: DurMs = DurMs::new(700);
/// V3: a sentence with more words than this is split at its longest gap.
pub const SENTENCE_MAX_WORDS: usize = 40;

/// The sentences of `words`: every word is in exactly one, in order. A
/// sentence ends after a word that ends in `.`, `?` or `!`, and before a word
/// that starts at least [`SENTENCE_GAP`] after the one before it ended.
pub fn segment_sentences(words: &[Word]) -> Vec<Sentence> {
    let mut sentences = Vec::new();
    let mut first: Option<(u32, &Word)> = None;
    let mut following = words.iter().skip(1);
    for (index, word) in (0u32..).zip(words) {
        let (start, opened) = *first.get_or_insert((index, word));
        let next = following.next();
        let stops = word.text.ends_with(['.', '?', '!']);
        let pause = next.is_some_and(|next| {
            next.start_ms
                .duration_since(word.end_ms)
                .is_some_and(|gap| gap >= SENTENCE_GAP)
        });
        if stops || pause || next.is_none() {
            sentences.push(Sentence {
                words: WordRange {
                    start: WordIdx::new(start),
                    end: WordIdx::new(index.saturating_add(1)),
                },
                start_ms: opened.start_ms,
                end_ms: word.end_ms,
            });
            first = None;
        }
    }
    sentences
}

#[cfg(test)]
mod tests {
    use offcut_types::{Confidence, TimeMs};

    use super::*;

    fn word(text: &str, start: u32, end: u32) -> Word {
        Word {
            text: text.to_owned(),
            start_ms: TimeMs::new(start),
            end_ms: TimeMs::new(end),
            confidence: Confidence::new(1.0).unwrap(),
        }
    }

    #[test]
    fn a_full_stop_and_a_pause_of_700_ms_each_end_a_sentence() {
        let words = [
            word("Hi.", 0, 400),
            word("There", 500, 900),
            word("now", 1_700, 2_000),
        ];
        let sentences = segment_sentences(&words);
        let ranges: Vec<(u32, u32, u32, u32)> = sentences
            .iter()
            .map(|s| {
                (
                    s.words.start.get(),
                    s.words.end.get(),
                    s.start_ms.get(),
                    s.end_ms.get(),
                )
            })
            .collect();
        assert_eq!(
            ranges,
            [(0, 1, 0, 400), (1, 2, 500, 900), (2, 3, 1_700, 2_000)]
        );

        // 699 ms is not a pause; 700 ms is. A question mark ends a sentence too.
        let words = [
            word("so", 0, 300),
            word("then", 999, 1_200),
            word("why?", 1_900, 2_200),
            word("because", 2_300, 2_600),
        ];
        let sentences = segment_sentences(&words);
        let ends: Vec<u32> = sentences.iter().map(|s| s.words.end.get()).collect();
        assert_eq!(ends, [2, 3, 4]);
        assert_eq!(sentences[0].end_ms, TimeMs::new(1_200));
        assert!(segment_sentences(&[]).is_empty());
    }
}
