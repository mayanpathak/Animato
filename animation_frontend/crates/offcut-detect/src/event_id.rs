//! The id of an event: a hash of what it is and where it is, so that the same
//! event has the same id every time it is detected (TS §17.6). Ids are stored
//! from V3 on: the nine bytes below never change (D-47).

use offcut_types::{EventId, EventKind, WordRange};

const FNV_OFFSET: u64 = 0xcbf2_9ce4_8422_2325;
const FNV_PRIME: u64 = 0x0000_0100_0000_01b3;

/// FNV-1a, 64 bits.
fn fnv1a_64(bytes: &[u8]) -> u64 {
    bytes.iter().fold(FNV_OFFSET, |hash, byte| {
        (hash ^ u64::from(*byte)).wrapping_mul(FNV_PRIME)
    })
}

/// The kind as one byte, then the first anchor word and the word after the
/// last, each as four bytes, lowest first.
pub fn event_id(kind: EventKind, anchors: WordRange) -> EventId {
    let kind: u8 = match kind {
        EventKind::NumberReveal => 0,
        EventKind::ListReveal => 1,
        EventKind::FromTo => 2,
        EventKind::KeywordPop => 3,
    };
    let [s0, s1, s2, s3] = anchors.start.get().to_le_bytes();
    let [e0, e1, e2, e3] = anchors.end.get().to_le_bytes();
    EventId::new(fnv1a_64(&[kind, s0, s1, s2, s3, e0, e1, e2, e3]))
}

#[cfg(test)]
mod tests {
    use offcut_types::WordIdx;

    use super::*;

    fn anchors(start: u32, end: u32) -> WordRange {
        WordRange {
            start: WordIdx::new(start),
            end: WordIdx::new(end),
        }
    }

    #[test]
    fn the_id_of_a_number_at_words_5_to_6_is_the_fnv_1a_64_of_its_nine_bytes() {
        // The hash itself, against its published test values.
        assert_eq!(fnv1a_64(b""), 0xcbf2_9ce4_8422_2325);
        assert_eq!(fnv1a_64(b"a"), 0xaf63_dc4c_8601_ec8c);
        assert_eq!(fnv1a_64(b"foobar"), 0x8594_4171_f739_67e8);

        let bytes = [0x00, 0x05, 0x00, 0x00, 0x00, 0x06, 0x00, 0x00, 0x00];
        let id = event_id(EventKind::NumberReveal, anchors(5, 6));
        assert_eq!(id.get(), fnv1a_64(&bytes));
        // Worked out by another program, so that a change of the layout shows.
        assert_eq!(id.get(), 0x8b13_f71d_9a4f_303c);
        assert_eq!(id.get(), 10_021_625_302_344_478_780);

        // The word numbers are four bytes each, lowest byte first.
        let wide = [0x00, 0x01, 0x02, 0x03, 0x04, 0x00, 0x00, 0x00, 0x80];
        let id = event_id(EventKind::NumberReveal, anchors(0x0403_0201, 0x8000_0000));
        assert_eq!(id.get(), fnv1a_64(&wide));
    }

    #[test]
    fn the_same_anchors_with_another_kind_have_another_id() {
        let kinds = [
            EventKind::NumberReveal,
            EventKind::ListReveal,
            EventKind::FromTo,
            EventKind::KeywordPop,
        ];
        let ids: Vec<u64> = kinds
            .iter()
            .map(|kind| event_id(*kind, anchors(5, 6)).get())
            .collect();
        for (i, id) in ids.iter().enumerate() {
            assert!(ids.iter().skip(i + 1).all(|other| other != id), "{ids:?}");
        }
        assert_eq!(ids[1], 13_081_232_829_397_450_927);
        // Other anchors, another id; the same anchors, the same id.
        assert_ne!(event_id(kinds[0], anchors(5, 7)).get(), ids[0]);
        assert_ne!(event_id(kinds[0], anchors(6, 5)).get(), ids[0]);
        assert_eq!(event_id(kinds[0], anchors(5, 6)).get(), ids[0]);
    }
}
