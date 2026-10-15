//! SHA-256 of bytes that arrive in pieces, for checking a downloaded model
//! file against the manifest.

use sha2::{Digest, Sha256};
use wasm_bindgen::prelude::wasm_bindgen;

#[wasm_bindgen]
#[derive(Default)]
pub struct Sha256Stream {
    hasher: Sha256,
}

#[wasm_bindgen]
impl Sha256Stream {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Sha256Stream {
        Sha256Stream::default()
    }

    pub fn update(&mut self, chunk: &[u8]) {
        self.hasher.update(chunk);
    }

    /// The digest as 64 lower-case hex digits. The stream is used up.
    pub fn finalize_hex(self) -> String {
        self.hasher
            .finalize()
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_digest_of_abc_in_two_pieces_is_the_known_one_in_lower_case() {
        let mut stream = Sha256Stream::new();
        stream.update(b"a");
        stream.update(b"bc");
        assert_eq!(
            stream.finalize_hex(),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
        let empty = Sha256Stream::new().finalize_hex();
        assert_eq!(
            empty,
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );
    }
}
