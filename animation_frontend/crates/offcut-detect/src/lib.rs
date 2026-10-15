//! Which moments of a transcript become visual events. V2 finds NumberReveal
//! only. An event below its kind's threshold is never made (INV-6), and
//! nothing here lays out or draws.

pub mod config;
pub mod event_id;
pub mod number;

use std::collections::BTreeMap;

use offcut_text::tokenize;
use offcut_types::{Confidence, DetectedEvent, Prosody, Transcript, WordIdx};

pub use crate::config::DetectorConfig;
pub use crate::event_id::event_id;
use crate::number::Candidate;

/// The events of a transcript, in the order they are spoken. `edits` are the
/// user's word edits: detection reads the text as edited (TS §17.2). The
/// same inputs give the same events, with the same ids.
pub fn detect(
    t: &Transcript,
    p: &Prosody,
    edits: &BTreeMap<WordIdx, String>,
    cfg: &DetectorConfig,
) -> Vec<DetectedEvent> {
    let toks = tokenize(&t.words, edits);
    let mut cands = number::find(&toks, t, p, cfg);
    cands.retain(|c| c.score >= cfg.threshold_number);
    cands.sort_by_key(|c| c.span.start);

    // V3: `exclusions::apply`, the filter by kind and `resolve::resolve`
    // take the place of the threshold above and of this rule (D-49): two
    // overlays are never on the screen at once, and the earlier one stays.
    let mut kept: Vec<Candidate> = Vec::new();
    for cand in cands {
        let shown_from = cand.span.start.get().saturating_sub(cfg.overlay_lead_ms);
        let free = kept.last().is_none_or(|before| {
            shown_from > before.span.end.get().saturating_add(cfg.number_hold_ms)
        });
        if free {
            kept.push(cand);
        }
    }

    kept.into_iter()
        .filter_map(|c| {
            Some(DetectedEvent {
                id: event_id(c.kind, c.anchors),
                kind: c.kind,
                span: c.span,
                anchors: c.anchors,
                params: c.params,
                // A score is within 0 to 1; one that is not makes no event.
                confidence: Confidence::new(c.score)?,
                enabled: true,
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use offcut_text::{RawWord, normalize_transcript};
    use offcut_types::{EventKind, EventParams, Unit, WordProsody};

    use super::*;

    /// `(text, start, end, confidence)`.
    type Spoken<'a> = (&'a str, u32, u32, f32);

    fn transcript(words: &[Spoken<'_>]) -> Transcript {
        let raw = words
            .iter()
            .map(|(text, start_ms, end_ms, confidence)| RawWord {
                text: (*text).to_owned(),
                start_ms: *start_ms,
                end_ms: *end_ms,
                confidence: *confidence,
            })
            .collect();
        normalize_transcript(raw, "test")
    }

    /// No word stands out: what V2 measures (D-22).
    fn flat(t: &Transcript) -> Prosody {
        let neutral = WordProsody {
            energy_z: 0.0,
            pitch_z: 0.0,
        };
        Prosody {
            per_word: vec![neutral; t.words.len()],
        }
    }

    fn events(words: &[Spoken<'_>]) -> Vec<DetectedEvent> {
        let t = transcript(words);
        detect(&t, &flat(&t), &BTreeMap::new(), &DetectorConfig::default())
    }

    #[test]
    fn ten_thousand_dollars_at_confidence_0_9_is_one_number_reveal() {
        let spoken = [
            ("we", 1_000, 1_200, 1.0),
            ("made", 1_250, 1_500, 1.0),
            ("$10,000", 1_600, 2_300, 0.9),
            ("there.", 2_400, 2_700, 1.0),
        ];
        let found = events(&spoken);
        assert_eq!(found.len(), 1);
        let event = &found[0];
        assert_eq!(event.kind, EventKind::NumberReveal);
        assert_eq!(event.confidence.get(), 0.9);
        assert!(event.enabled);
        assert_eq!(
            (event.span.start.get(), event.span.end.get()),
            (1_600, 2_300)
        );
        assert_eq!((event.anchors.start.get(), event.anchors.end.get()), (2, 3));
        assert_eq!(event.id, event_id(EventKind::NumberReveal, event.anchors));
        match &event.params {
            EventParams::NumberReveal { value, label } => {
                assert_eq!(value.display, "$10k");
                assert_eq!((value.value, &value.unit), (10_000.0, &Unit::Usd));
                assert_eq!(*label, None);
            }
            EventParams::ListReveal { .. }
            | EventParams::FromTo { .. }
            | EventParams::KeywordPop { .. } => panic!("{:?}", event.params),
        }

        // The amount as the recognizer writes it for the reference clip: two words.
        let split = events(&[
            ("about", 62_300, 62_600, 1.0),
            ("$12", 62_660, 63_100, 1.0),
            (",000", 63_100, 63_540, 1.0),
            ("in", 63_600, 63_700, 1.0),
        ]);
        assert_eq!(split.len(), 1);
        assert_eq!(
            (split[0].span.start.get(), split[0].span.end.get()),
            (62_660, 63_540)
        );
        assert_eq!(
            (split[0].anchors.start.get(), split[0].anchors.end.get()),
            (1, 3)
        );

        // A number whose word was edited or hidden is not shown; an edit
        // somewhere else changes nothing.
        let t = transcript(&spoken);
        let with = |word: u32, text: &str| {
            let edits = BTreeMap::from([(WordIdx::new(word), text.to_owned())]);
            detect(&t, &flat(&t), &edits, &DetectorConfig::default())
        };
        assert_eq!(with(2, "$20,000"), []);
        assert_eq!(with(2, ""), []);
        assert_eq!(with(1, "earned"), found);
    }

    #[test]
    fn ten_thousand_in_words_has_no_unit_and_is_no_event() {
        let found = events(&[
            ("about", 1_000, 1_300, 1.0),
            ("ten", 1_400, 1_600, 1.0),
            ("thousand", 1_650, 2_100, 1.0),
            ("people", 2_200, 2_600, 1.0),
        ]);
        assert_eq!(found, []);
        // A bare number in digits scores the same 0.70, and a small one 0.50.
        assert_eq!(events(&[("3000", 1_000, 1_500, 1.0)]), []);
        assert_eq!(events(&[("three", 1_000, 1_500, 1.0)]), []);
        // Nothing spoken, nothing found.
        assert_eq!(events(&[]), []);
    }

    #[test]
    fn forty_percent_is_an_event_at_confidence_1_and_none_at_0_99() {
        let sure = events(&[("40%", 1_000, 1_500, 1.0)]);
        assert_eq!(sure.len(), 1);
        assert_eq!(sure[0].confidence.get(), 0.80);
        assert_eq!(events(&[("40%", 1_000, 1_500, 0.99)]), []);
        // The least certain word of a number counts.
        let split = [("$12", 1_000, 1_300, 1.0), (",000", 1_300, 1_600, 0.7)];
        assert_eq!(events(&split), []);
    }

    #[test]
    fn of_two_amounts_600_ms_apart_only_the_earlier_one_is_kept() {
        let found = events(&[
            ("$5,000", 1_000, 1_300, 1.0),
            ("or", 1_400, 1_600, 1.0),
            ("$7,000", 1_900, 2_200, 1.0),
        ]);
        assert_eq!(found.len(), 1);
        assert_eq!(found[0].span.start.get(), 1_000);

        // The first is shown until 1,300 + 1,400 = 2,700; the second from
        // 150 ms before its first word. They may not meet.
        let starts = |second: u32| -> Vec<u32> {
            events(&[
                ("$5,000", 1_000, 1_300, 1.0),
                ("$7,000", second, second + 300, 1.0),
            ])
            .iter()
            .map(|event| event.span.start.get())
            .collect()
        };
        assert_eq!(starts(2_850), [1_000]);
        assert_eq!(starts(2_851), [1_000, 2_851]);
    }

    #[test]
    fn two_amounts_5_s_apart_are_both_kept_in_time_order() {
        let found = events(&[
            ("$5,000", 1_000, 1_300, 1.0),
            ("and", 3_000, 3_200, 1.0),
            ("$7,000", 6_000, 6_300, 1.0),
        ]);
        let starts: Vec<u32> = found.iter().map(|event| event.span.start.get()).collect();
        assert_eq!(starts, [1_000, 6_000]);
        assert_ne!(found[0].id, found[1].id);
    }

    /// Numbers of every score, some certain and some not.
    fn mixed() -> Transcript {
        let texts = [
            "$5,000", "three", "40%", "$12", ",000", "900", "$8", "25%", "$90,000", "1,200",
        ];
        let words: Vec<Spoken<'_>> = (0u32..)
            .zip(texts)
            .map(|(i, text)| {
                let confidence = [1.0, 0.95, 0.85, 0.6][i as usize % 4];
                (text, i * 4_000, i * 4_000 + 500, confidence)
            })
            .collect();
        transcript(&words)
    }

    #[test]
    fn no_returned_event_is_below_the_threshold_of_its_kind() {
        let t = mixed();
        let cfg = DetectorConfig::default();
        let found = detect(&t, &flat(&t), &BTreeMap::new(), &cfg);
        assert!(!found.is_empty());
        assert!(found.len() < t.numbers.len());
        for event in &found {
            assert!(event.confidence.get() >= cfg.threshold_number, "{event:?}");
        }
        // A word said with emphasis lifts a number over the line, and only then.
        let said = [("70%", 1_000, 1_500, 0.9)];
        assert_eq!(events(&said), []);
        let t = transcript(&said);
        let loud = Prosody {
            per_word: vec![WordProsody {
                energy_z: 1.0,
                pitch_z: 0.0,
            }],
        };
        let found = detect(&t, &loud, &BTreeMap::new(), &cfg);
        assert_eq!(found.len(), 1);
        assert!(found[0].confidence.get() >= cfg.threshold_number);
    }

    #[test]
    fn the_same_inputs_twice_give_the_same_events_and_the_same_ids() {
        let t = mixed();
        let cfg = DetectorConfig::default();
        let first = detect(&t, &flat(&t), &BTreeMap::new(), &cfg);
        let second = detect(&t, &flat(&t), &BTreeMap::new(), &cfg);
        assert_eq!(first, second);
        let ids = |events: &[DetectedEvent]| events.iter().map(|e| e.id).collect::<Vec<_>>();
        assert_eq!(ids(&first), ids(&second));
        // A transcript built again from the same words gives them too.
        let again = mixed();
        assert_eq!(detect(&again, &flat(&again), &BTreeMap::new(), &cfg), first);
    }
}
