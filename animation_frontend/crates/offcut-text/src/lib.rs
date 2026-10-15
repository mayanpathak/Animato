//! The text of a transcript: tokens, sentences, and the numbers that were
//! spoken, read and written. Nothing here decides what becomes a visual
//! event, and a `Transcript` is never changed once it is built.

pub mod normalize;
pub mod numbers;
pub mod sentences;
pub mod tokenize;

pub use normalize::{RawWord, normalize_transcript};
pub use numbers::{format_quantity, parse_quantity};
pub use sentences::{SENTENCE_GAP, SENTENCE_MAX_WORDS, segment_sentences};
pub use tokenize::{Token, TokenKind, tokenize};
