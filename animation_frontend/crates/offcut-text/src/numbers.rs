//! Reading a number out of tokens, and writing one for a caption. This is
//! the only parser of spoken quantities and the only formatter (TS §17.1).
//!
//! V2 reads digits, `$`, `%` and plain cardinals in words up to 999,999.
//! Anything else is not a number yet: the parser says so and never guesses.
//! V3: millions and above, "point" decimals, the suffixes k, m, b and
//! "grand", currency words, "percent", multipliers and units.

use offcut_types::{Quantity, Unit};

use crate::tokenize::{Token, TokenKind};

/// A cardinal in words is at most this many tokens long:
/// "nine hundred and ninety nine thousand nine hundred and ninety nine".
const MAX_CARDINAL_TOKENS: usize = 11;

/// The quantity that starts at the first token, and how many tokens it is.
/// `None` when the tokens do not start with a quantity this version reads.
pub fn parse_quantity(tokens: &[Token]) -> Option<(usize, Quantity)> {
    let first = tokens.first()?;
    match first.kind {
        TokenKind::Digits => {
            let (value, unit) = digits(&first.text)?;
            let (used, value) = with_split_groups(tokens, first, value);
            Some((used, quantity(value, unit)))
        }
        TokenKind::Word => {
            let spelled: Vec<&str> = tokens
                .iter()
                .take(MAX_CARDINAL_TOKENS)
                .take_while(|token| token.kind == TokenKind::Word)
                .map(|token| token.text.as_str())
                .collect();
            let (used, value) = cardinal(&spelled)?;
            // "three point five" is not three. V3 reads the decimal.
            if tokens
                .get(used)
                .is_some_and(|next| next.kind == TokenKind::Word && next.text == "point")
            {
                return None;
            }
            Some((used, quantity(f64::from(value), Unit::None)))
        }
        TokenKind::Punct => None,
    }
}

fn quantity(value: f64, unit: Unit) -> Quantity {
    Quantity {
        value,
        display: format_quantity(value, &unit),
        unit,
    }
}

/// Digits with thousands separators and at most one decimal point: `10,000`,
/// `3.5`. A separator must have groups of three digits after it.
pub(crate) fn parse_decimal(text: &str) -> Option<f64> {
    let (whole, fraction) = match text.split_once('.') {
        Some((whole, fraction)) => (whole, Some(fraction)),
        None => (text, None),
    };
    let all_digits = |part: &str| !part.is_empty() && part.bytes().all(|b| b.is_ascii_digit());
    if fraction.is_some_and(|fraction| !all_digits(fraction)) {
        return None;
    }
    let mut groups = whole.split(',');
    let head = groups.next()?;
    let mut grouped = false;
    for group in groups {
        if group.len() != 3 || !all_digits(group) {
            return None;
        }
        grouped = true;
    }
    if !all_digits(head) || (grouped && head.len() > 3) {
        return None;
    }
    text.replace(',', "").parse().ok()
}

/// A `Digits` token: the number, and the unit its sign gives it.
fn digits(text: &str) -> Option<(f64, Unit)> {
    let (text, dollars) = match text.strip_prefix('$') {
        Some(rest) => (rest, true),
        None => (text, false),
    };
    let (text, percent) = match text.strip_suffix('%') {
        Some(rest) => (rest, true),
        None => (text, false),
    };
    let unit = match (dollars, percent) {
        (false, false) => Unit::None,
        (true, false) => Unit::Usd,
        (false, true) => Unit::Percent,
        (true, true) => return None,
    };
    Some((parse_decimal(text)?, unit))
}

/// A recognizer may write `$12,000` as two words, `$12` and `,000`: it starts
/// a new word at the separator. A word that begins with a comma and exactly
/// three digits, straight after a whole number, is the next group of that
/// number (D-42). Nothing else that is written begins a word that way.
/// Returns the tokens used and the value.
fn with_split_groups(tokens: &[Token], first: &Token, value: f64) -> (usize, f64) {
    // A number with a decimal part, or with a sign after it, has ended.
    if first.text.contains('.') || first.text.ends_with('%') {
        return (1, value);
    }
    let (mut used, mut value, mut word) = (1usize, value, first.word);
    while let (Some(comma), Some(group)) = (tokens.get(used), tokens.get(used.saturating_add(1))) {
        let starts_next_word =
            comma.word == group.word && comma.word.get() == word.get().saturating_add(1);
        let is_group = comma.kind == TokenKind::Punct
            && comma.text == ","
            && group.kind == TokenKind::Digits
            && group.text.len() == 3
            && group.text.bytes().all(|b| b.is_ascii_digit());
        let Some(digits) = group
            .text
            .parse::<f64>()
            .ok()
            .filter(|_| starts_next_word && is_group)
        else {
            break;
        };
        value = value * 1_000.0 + digits;
        used = used.saturating_add(2);
        word = group.word;
    }
    (used, value)
}

const UNITS: [&str; 9] = [
    "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
];
const TEENS: [&str; 10] = [
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
];
const TENS: [&str; 8] = [
    "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety",
];

/// The place of `word` in `names`, counted from `first` in steps of `step`.
fn named(names: &[&str], word: &str, first: u32, step: u32) -> Option<u32> {
    (0u32..)
        .zip(names)
        .find(|(_, name)| **name == word)
        .map(|(index, _)| first.saturating_add(index.saturating_mul(step)))
}

fn unit(word: &str) -> Option<u32> {
    named(&UNITS, word, 1, 1)
}

fn tens(word: &str) -> Option<u32> {
    named(&TENS, word, 20, 10)
}

/// One to nineteen: what can stand before "hundred".
fn below_20(word: &str) -> Option<u32> {
    unit(word).or_else(|| named(&TEENS, word, 10, 1))
}

/// 1 to 99: "five", "fifteen", "fifty", "fifty five", "fifty-five".
fn below_100(words: &[&str]) -> Option<(usize, u32)> {
    let first = *words.first()?;
    if let Some((left, right)) = first.split_once('-') {
        return Some((1, tens(left)?.saturating_add(unit(right)?)));
    }
    if let Some(value) = tens(first) {
        return Some(match words.get(1).and_then(|word| unit(word)) {
            Some(ones) => (2, value.saturating_add(ones)),
            None => (1, value),
        });
    }
    below_20(first).map(|value| (1, value))
}

/// The number, if any, that follows an optional "and".
fn after_and(words: &[&str], read: fn(&[&str]) -> Option<(usize, u32)>) -> Option<(usize, u32)> {
    let skipped = usize::from(words.first() == Some(&"and"));
    let (used, value) = read(words.get(skipped..)?)?;
    Some((skipped.saturating_add(used), value))
}

/// 1 to 1,999: a number below 100, or one to nineteen hundreds with or
/// without one after them ("two hundred and fifty", "fifteen hundred").
fn hundreds(words: &[&str]) -> Option<(usize, u32)> {
    let first = *words.first()?;
    let (Some(count), Some(&"hundred")) = (below_20(first), words.get(1)) else {
        return below_100(words);
    };
    let value = count.saturating_mul(100);
    Some(match after_and(words.get(2..)?, below_100) {
        Some((used, rest)) => (used.saturating_add(2), value.saturating_add(rest)),
        None => (2, value),
    })
}

/// A cardinal from zero to 999,999 at the start of `words`, and how many
/// words it is. An "and" that no number follows is not part of it.
fn cardinal(words: &[&str]) -> Option<(usize, u32)> {
    if words.first() == Some(&"zero") {
        return Some((1, 0));
    }
    let (used, value) = hundreds(words)?;
    if value >= 1_000 || words.get(used) != Some(&"thousand") {
        return Some((used, value));
    }
    let (used, value) = (used.saturating_add(1), value.saturating_mul(1_000));
    Some(match after_and(words.get(used..)?, hundreds) {
        Some((more, rest)) if rest < 1_000 => {
            (used.saturating_add(more), value.saturating_add(rest))
        }
        Some(_) | None => (used, value),
    })
}

/// A number as a caption shows it. Whole thousands of dollars are written
/// short (`$10k`); every other number is written out, grouped by thousands,
/// with at most two decimals (assumption, M1.3).
pub fn format_quantity(value: f64, unit: &Unit) -> String {
    let plain = plain(value);
    match unit {
        Unit::Usd => match whole_thousands(value) {
            Some(thousands) => format!("${thousands}k"),
            None => format!("${plain}"),
        },
        Unit::Percent => format!("{plain}%"),
        // V3 gives each of these its suffix.
        Unit::None
        | Unit::Eur
        | Unit::Gbp
        | Unit::Inr
        | Unit::Milliseconds
        | Unit::Seconds
        | Unit::Minutes
        | Unit::Hours
        | Unit::Days
        | Unit::Weeks
        | Unit::Months
        | Unit::Years
        | Unit::Times
        | Unit::Bytes
        | Unit::Kilobytes
        | Unit::Megabytes
        | Unit::Gigabytes
        | Unit::Count { .. } => plain,
    }
}

/// `Some(10)` for 10,000: a whole number of thousands from 1 to 999.
fn whole_thousands(value: f64) -> Option<u32> {
    let whole = (1_000.0..=999_000.0).contains(&value) && value % 1_000.0 == 0.0;
    whole.then_some((value / 1_000.0) as u32)
}

/// Grouped by thousands, with up to two decimals and no trailing zero.
fn plain(value: f64) -> String {
    if !value.is_finite() {
        return "0".to_owned();
    }
    let rounded = format!("{:.2}", value.abs());
    let (whole, fraction) = rounded.split_once('.').unwrap_or((&rounded, ""));
    let fraction = fraction.trim_end_matches('0');
    let is_zero = fraction.is_empty() && whole.bytes().all(|b| b == b'0');

    let mut out = String::new();
    if value < 0.0 && !is_zero {
        out.push('-');
    }
    let mut left = whole.len();
    for digit in whole.chars() {
        out.push(digit);
        left = left.saturating_sub(1);
        if left > 0 && left.is_multiple_of(3) {
            out.push(',');
        }
    }
    if !fraction.is_empty() {
        out.push('.');
        out.push_str(fraction);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tokenize::tests::tokens_of;

    /// The quantity at the start of these words: tokens used, value, unit, display.
    fn read(texts: &[&str]) -> Option<(usize, f64, Unit, String)> {
        parse_quantity(&tokens_of(texts)).map(|(used, q)| (used, q.value, q.unit, q.display))
    }

    fn some(
        used: usize,
        value: f64,
        unit: Unit,
        display: &str,
    ) -> Option<(usize, f64, Unit, String)> {
        Some((used, value, unit, display.to_owned()))
    }

    #[test]
    fn forty_percent_is_one_digits_token_with_its_sign() {
        let tokens = tokens_of(&["40%"]);
        assert_eq!(tokens.len(), 1);
        assert_eq!(tokens[0].kind, TokenKind::Digits);
        assert_eq!(read(&["40%"]), some(1, 40.0, Unit::Percent, "40%"));

        // Digits without a sign, with separators, with a decimal point.
        assert_eq!(read(&["10,000"]), some(1, 10_000.0, Unit::None, "10,000"));
        assert_eq!(read(&["3.5"]), some(1, 3.5, Unit::None, "3.5"));
        assert_eq!(
            read(&["1234567"]),
            some(1, 1_234_567.0, Unit::None, "1,234,567")
        );
        // Not numbers: a separator in the wrong place, two points, both signs.
        for not_a_number in ["1,00", "10,0000", "1.2.3", "$40%"] {
            assert_eq!(read(&[not_a_number]), None, "{not_a_number}");
        }
        for not_a_decimal in [
            "", ",500", "5,", ".5", "5.", "1,2345", "1234,567", "1e3", "-5",
        ] {
            assert_eq!(parse_decimal(not_a_decimal), None, "{not_a_decimal}");
        }
        assert_eq!(parse_decimal("999,999.25"), Some(999_999.25));
    }

    #[test]
    fn ten_thousand_in_words_is_two_tokens_and_10_000() {
        assert_eq!(
            read(&["ten", "thousand", "people"]),
            some(2, 10_000.0, Unit::None, "10,000")
        );
    }

    #[test]
    fn two_hundred_and_fifty_is_four_tokens() {
        assert_eq!(
            read(&["two", "hundred", "and", "fifty"]),
            some(4, 250.0, Unit::None, "250")
        );
        // An "and" that no number follows is left where it is.
        assert_eq!(
            read(&["two", "hundred", "and", "then"]),
            some(2, 200.0, Unit::None, "200")
        );
        assert_eq!(
            read(&["one", "thousand", "and", "so"]),
            some(2, 1_000.0, Unit::None, "1,000")
        );
    }

    #[test]
    fn three_is_3_with_no_unit() {
        assert_eq!(read(&["three"]), some(1, 3.0, Unit::None, "3"));

        // The whole range, built from every kind of word.
        let cases: [(&[&str], usize, f64); 10] = [
            (&["zero"], 1, 0.0),
            (&["nineteen"], 1, 19.0),
            (&["forty", "two"], 2, 42.0),
            (&["forty-two"], 1, 42.0),
            (&["nine", "hundred", "ninety", "nine"], 4, 999.0),
            (&["fifteen", "hundred"], 2, 1_500.0),
            (&["one", "thousand", "and", "five"], 4, 1_005.0),
            (&["twelve", "thousand"], 2, 12_000.0),
            (
                &["three", "hundred", "thousand", "two", "hundred"],
                5,
                300_200.0,
            ),
            (
                &[
                    "nine", "hundred", "and", "ninety", "nine", "thousand", "nine", "hundred",
                    "and", "ninety", "nine",
                ],
                11,
                999_999.0,
            ),
        ];
        for (texts, used, value) in cases {
            let found = read(texts).map(|(used, value, ..)| (used, value));
            assert_eq!(found, Some((used, value)), "{texts:?}");
        }
        // Words that are not a number, and words a number needs something before.
        let not_numbers: [&[&str]; 4] = [&["hundred"], &["thousand"], &["and", "five"], &["hello"]];
        for texts in not_numbers {
            assert_eq!(read(texts), None, "{texts:?}");
        }
        // Read out one after the other, each word is a number of its own.
        assert_eq!(
            read(&["one", "two", "three"]),
            some(1, 1.0, Unit::None, "1")
        );
    }

    #[test]
    fn what_v3_will_read_is_not_guessed_at() {
        // "ten" is read; "million" is left for V3.
        assert_eq!(read(&["ten", "million"]), some(1, 10.0, Unit::None, "10"));
        assert_eq!(read(&["three", "point", "five"]), None);
        assert_eq!(read(&["2k"]), None);
        assert_eq!(read(&["percent"]), None);
        assert_eq!(read(&["."]), None);
        assert_eq!(read(&[]), None);
    }

    #[test]
    fn a_number_the_recognizer_split_at_its_separator_is_one_number() {
        // The reference clip's amount, as the recognizer wrote it: two words.
        assert_eq!(read(&["$12", ",000"]), some(3, 12_000.0, Unit::Usd, "$12k"));
        assert_eq!(
            read(&["$12", ",000", "in", "sales."]),
            some(3, 12_000.0, Unit::Usd, "$12k")
        );
        assert_eq!(
            read(&["3", ",000", ",000."]),
            some(5, 3_000_000.0, Unit::None, "3,000,000")
        );
        assert_eq!(
            read(&["1,250", ",500"]),
            some(3, 1_250_500.0, Unit::None, "1,250,500")
        );

        // A comma that ends a word is a comma: the number after it is another number.
        assert_eq!(read(&["12,", "000"]), some(1, 12.0, Unit::None, "12"));
        // Not a group of three digits, a number that had ended, a group in a later word.
        assert_eq!(read(&["$12", ",00"]), some(1, 12.0, Unit::Usd, "$12"));
        assert_eq!(read(&["$12", ",0000"]), some(1, 12.0, Unit::Usd, "$12"));
        assert_eq!(read(&["1.5", ",000"]), some(1, 1.5, Unit::None, "1.5"));
        assert_eq!(read(&["40%", ",000"]), some(1, 40.0, Unit::Percent, "40%"));
        assert_eq!(read(&["$12.", ",000"]), some(1, 12.0, Unit::Usd, "$12"));
        assert_eq!(
            read(&["$12", "and", ",000"]),
            some(1, 12.0, Unit::Usd, "$12")
        );
    }

    #[test]
    fn dollars_are_short_only_in_whole_thousands() {
        assert_eq!(read(&["$10,000"]), some(1, 10_000.0, Unit::Usd, "$10k"));
        assert_eq!(read(&["$1,500"]), some(1, 1_500.0, Unit::Usd, "$1,500"));
        assert_eq!(read(&["$950"]), some(1, 950.0, Unit::Usd, "$950"));

        assert_eq!(format_quantity(999_000.0, &Unit::Usd), "$999k");
        assert_eq!(format_quantity(1_000_000.0, &Unit::Usd), "$1,000,000");
        assert_eq!(format_quantity(12.5, &Unit::Usd), "$12.5");
        // Up to two decimals, without a zero at the end; a unit V3 names has no suffix yet.
        assert_eq!(format_quantity(1_234.5, &Unit::None), "1,234.5");
        assert_eq!(format_quantity(0.126, &Unit::None), "0.13");
        assert_eq!(format_quantity(2.999, &Unit::None), "3");
        assert_eq!(format_quantity(7.10, &Unit::Percent), "7.1%");
        assert_eq!(format_quantity(-1_500.0, &Unit::None), "-1,500");
        assert_eq!(format_quantity(-0.001, &Unit::None), "0");
        assert_eq!(format_quantity(f64::NAN, &Unit::None), "0");
        assert_eq!(format_quantity(800.0, &Unit::Milliseconds), "800");
    }
}
