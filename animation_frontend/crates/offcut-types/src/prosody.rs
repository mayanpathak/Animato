//! How each word was said, measured against its own sentence.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// Both values are z-scores against the word's sentence.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
pub struct WordProsody {
    pub energy_z: f32,
    pub pitch_z: f32,
}

/// `per_word.len()` equals `transcript.words.len()`.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
pub struct Prosody {
    pub per_word: Vec<WordProsody>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prosody_keeps_rust_field_names() {
        let prosody = Prosody {
            per_word: vec![
                WordProsody {
                    energy_z: 1.5,
                    pitch_z: -0.25,
                },
                WordProsody {
                    energy_z: 0.0,
                    pitch_z: 2.0,
                },
            ],
        };
        let json = serde_json::to_string(&prosody).unwrap();
        assert_eq!(
            json,
            r#"{"per_word":[{"energy_z":1.5,"pitch_z":-0.25},{"energy_z":0.0,"pitch_z":2.0}]}"#
        );
        assert_eq!(serde_json::from_str::<Prosody>(&json).unwrap(), prosody);
    }
}
