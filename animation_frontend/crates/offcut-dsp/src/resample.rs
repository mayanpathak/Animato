//! Changing the sample rate of mono audio. The rate changes and the duration
//! does not: sample `i` of the output is time `i / to` of the input.

use offcut_types::Hz;
use rubato::audioadapter_buffers::direct::InterleavedSlice;
use rubato::{Fft, FixedSync, Resampler};

/// Frames per call of the resampler. Fixed, so that the same input always
/// gives the same output.
const CHUNK_FRAMES: usize = 1_024;

/// `output.len() == round(input.len() x to / from)`, exactly. The delay of
/// the resampler's filter is trimmed from the head and the tail is padded
/// with silence. Empty input, or a rate of 0, gives an empty vector.
pub fn resample_mono(input: &[f32], from: Hz, to: Hz) -> Vec<f32> {
    let (from, to) = (from.get() as usize, to.get() as usize);
    if input.is_empty() || from == 0 || to == 0 {
        return Vec::new();
    }
    if from == to {
        return input.to_vec();
    }
    // Rounded to nearest, in integers.
    let wanted = (input.len() as u128 * to as u128 + from as u128 / 2) / from as u128;
    let wanted = usize::try_from(wanted).unwrap_or(usize::MAX);

    // Neither step fails for rates above 0 and a buffer of its own length.
    // If one ever did, the answer is still of the promised length: silence.
    let mut output = resampled(input, from, to).unwrap_or_default();
    output.resize(wanted, 0.0);
    output
}

/// The whole clip through the resampler, with its start-up delay removed.
fn resampled(input: &[f32], from: usize, to: usize) -> Option<Vec<f32>> {
    let mut resampler = Fft::<f32>::new(from, to, CHUNK_FRAMES, 1, FixedSync::Input).ok()?;
    let frames = InterleavedSlice::new(input, 1, input.len()).ok()?;
    let output = resampler.process_all(&frames, input.len(), None).ok()?;
    Some(output.take_data())
}

#[cfg(test)]
mod tests {
    use proptest::prelude::*;

    use super::*;

    fn hz(rate: u32) -> Hz {
        Hz::new(rate)
    }

    fn peak(samples: &[f32]) -> (usize, f32) {
        let mut best = (0, 0.0f32);
        for (i, &sample) in samples.iter().enumerate() {
            if sample.abs() > best.1 {
                best = (i, sample.abs());
            }
        }
        best
    }

    proptest! {
        #![proptest_config(ProptestConfig::with_cases(48))]
        #[test]
        fn the_output_length_is_the_rounded_input_length_times_the_rate_ratio(
            len in 0usize..=200_000,
            (from, to) in prop_oneof![Just((44_100u32, 48_000u32)), Just((48_000, 16_000)), Just((48_000, 48_000))],
        ) {
            let output = resample_mono(&vec![0.25; len], hz(from), hz(to));
            let expected = (len as f64 * f64::from(to) / f64::from(from)).round() as usize;
            prop_assert_eq!(output.len(), expected);
        }
    }

    #[test]
    fn a_1_khz_sine_keeps_its_level_and_its_phase() {
        // One second at 48 kHz, starting at phase 0 and rising.
        let input: Vec<f32> = (0..48_000)
            .map(|i| (std::f32::consts::TAU * 1_000.0 * i as f32 / 48_000.0).sin())
            .collect();
        let output = resample_mono(&input, hz(48_000), hz(16_000));
        assert_eq!(output.len(), 16_000);

        // Away from the two ends, where the filter has no neighbours to read.
        let middle = &output[2_000..14_000];
        let level = peak(middle).1;
        assert!((level - 1.0).abs() < 0.01, "peak {level}");
        // The sine falls through 0 every millisecond after a half period:
        // 0.5 ms is output sample 8, and the crossings are 16 samples apart.
        let crossing = (1..64)
            .find(|&i| output[2_000 + i - 1] > 0.0 && output[2_000 + i] <= 0.0)
            .unwrap();
        let expected = 8; // 2,000 is a multiple of 16
        assert!(
            (crossing as i64 - expected).abs() <= 1,
            "first falling crossing {crossing} samples after 2,000"
        );
    }

    #[test]
    fn an_impulse_stays_where_it_was_in_time() {
        let mut input = vec![0.0f32; 48_000];
        input[4_800] = 1.0;
        let output = resample_mono(&input, hz(48_000), hz(16_000));
        let at = peak(&output).0;
        assert!((1_599..=1_601).contains(&at), "peak at {at}");
    }

    #[test]
    fn the_same_input_twice_gives_byte_identical_output() {
        let input: Vec<f32> = (0..30_000)
            .map(|i| ((i * 7_919) % 2_003) as f32 / 2_003.0 - 0.5)
            .collect();
        let first = resample_mono(&input, hz(44_100), hz(48_000));
        let second = resample_mono(&input, hz(44_100), hz(48_000));
        let bytes = |samples: &[f32]| {
            samples
                .iter()
                .flat_map(|s| s.to_le_bytes())
                .collect::<Vec<u8>>()
        };
        assert_eq!(bytes(&first), bytes(&second));
        assert_eq!(first.len(), 32_653); // round(30,000 x 48,000 / 44,100)

        // The special cases of the length rule.
        assert_eq!(resample_mono(&input, hz(48_000), hz(48_000)), input);
        assert!(resample_mono(&[], hz(48_000), hz(16_000)).is_empty());
        assert!(resample_mono(&input, hz(0), hz(16_000)).is_empty());
        assert!(resample_mono(&input, hz(48_000), hz(0)).is_empty());
    }
}
