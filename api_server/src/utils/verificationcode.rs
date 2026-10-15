use rand::{rngs::OsRng, Rng};

/// 6-digit email verification code from the operating system's secure
/// random source, zero-padded so codes such as `004821` are possible.
pub fn generate_verification_code() -> String {
    format!("{:06}", OsRng.gen_range(0..1_000_000))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn codes_are_six_digits_and_can_start_with_zero() {
        let codes: Vec<String> = (0..1000).map(|_| generate_verification_code()).collect();

        for code in &codes {
            assert_eq!(code.len(), 6, "code is not 6 characters long");
            assert!(code.chars().all(|c| c.is_ascii_digit()), "code has a non-digit");
        }

        assert!(
            codes.iter().any(|code| code.starts_with('0')),
            "no code out of 1,000 started with 0"
        );
    }
}
