//! What an H.264 stream says of its own brightness range.
//!
//! A stream may say that its samples use the whole range from 0 to 255
//! ("full range"), where video ordinarily keeps to 16 to 235. A browser does
//! not always read that from the stream, and then shows the picture with too
//! much contrast, so the caller reads it here and tells the decoder
//! (v2implementation D-70).
//!
//! The answer is one bit of the sequence parameter set, behind fields of
//! varying length. Everything in front of it is read only to get past it.

/// The profiles whose sequence parameter set has the chroma format and the
/// scaling lists (ITU-T H.264, 7.3.2.1.1).
const PROFILES_WITH_CHROMA_INFO: [u32; 13] =
    [100, 110, 122, 244, 44, 83, 86, 118, 128, 138, 139, 134, 135];
/// `aspect_ratio_idc` for a sample aspect ratio written out as two numbers.
const EXTENDED_SAR: u32 = 255;
/// A NAL unit of this type is a sequence parameter set.
const NAL_SPS: u8 = 7;

/// The bits of a parameter set, most significant first.
struct Bits {
    bytes: Vec<u8>,
    at: usize,
}

impl Bits {
    /// The payload of a NAL unit, without the bytes that keep a start code
    /// from appearing in it: the `03` of every `00 00 03`.
    fn of_nal(payload: &[u8]) -> Bits {
        let mut bytes = Vec::with_capacity(payload.len());
        let mut zeros = 0;
        for &byte in payload {
            if zeros >= 2 && byte == 3 {
                zeros = 0;
                continue;
            }
            zeros = if byte == 0 { zeros + 1 } else { 0 };
            bytes.push(byte);
        }
        Bits { bytes, at: 0 }
    }

    /// The next `n` bits as a number. `None` past the end.
    fn bits(&mut self, n: u32) -> Option<u32> {
        let mut value = 0u32;
        for _ in 0..n {
            let byte = *self.bytes.get(self.at / 8)?;
            value = (value << 1) | u32::from((byte >> (7 - self.at % 8)) & 1);
            self.at += 1;
        }
        Some(value)
    }

    fn flag(&mut self) -> Option<bool> {
        Some(self.bits(1)? == 1)
    }

    /// An unsigned Exp-Golomb number, `ue(v)`.
    fn ue(&mut self) -> Option<u32> {
        let mut zeros = 0u32;
        while self.bits(1)? == 0 {
            zeros += 1;
            if zeros > 31 {
                return None;
            }
        }
        Some((1u32 << zeros) - 1 + self.bits(zeros)?)
    }

    /// A signed Exp-Golomb number, `se(v)`.
    fn se(&mut self) -> Option<i32> {
        let code = self.ue()?;
        let magnitude = i32::try_from(code.div_ceil(2)).ok()?;
        Some(if code % 2 == 1 { magnitude } else { -magnitude })
    }
}

/// Reads past one scaling list of `size` entries.
fn skip_scaling_list(bits: &mut Bits, size: u32) -> Option<()> {
    let (mut last, mut next) = (8i32, 8i32);
    for _ in 0..size {
        if next != 0 {
            next = (last + bits.se()? + 256).rem_euclid(256);
        }
        if next != 0 {
            last = next;
        }
    }
    Some(())
}

/// Whether the sequence parameter set in `nal` says "full range". `None`
/// when it says nothing of the range, or cannot be read.
fn full_range_of_sps(nal: &[u8]) -> Option<bool> {
    let (&header, payload) = nal.split_first()?;
    if header & 0x1f != NAL_SPS {
        return None;
    }
    let mut bits = Bits::of_nal(payload);
    let profile = bits.bits(8)?;
    bits.bits(16)?; // the constraint flags and the level
    bits.ue()?; // seq_parameter_set_id

    if PROFILES_WITH_CHROMA_INFO.contains(&profile) {
        let chroma_format = bits.ue()?;
        if chroma_format == 3 {
            bits.flag()?; // separate_colour_plane_flag
        }
        bits.ue()?; // bit_depth_luma_minus8
        bits.ue()?; // bit_depth_chroma_minus8
        bits.flag()?; // qpprime_y_zero_transform_bypass_flag
        if bits.flag()? {
            let lists = if chroma_format == 3 { 12 } else { 8 };
            for list in 0..lists {
                if bits.flag()? {
                    skip_scaling_list(&mut bits, if list < 6 { 16 } else { 64 })?;
                }
            }
        }
    }

    bits.ue()?; // log2_max_frame_num_minus4
    match bits.ue()? {
        0 => {
            bits.ue()?; // log2_max_pic_order_cnt_lsb_minus4
        }
        1 => {
            bits.flag()?; // delta_pic_order_always_zero_flag
            bits.se()?; // offset_for_non_ref_pic
            bits.se()?; // offset_for_top_to_bottom_field
            let cycle = bits.ue()?;
            if cycle > 255 {
                return None;
            }
            for _ in 0..cycle {
                bits.se()?; // offset_for_ref_frame
            }
        }
        _ => {}
    }
    bits.ue()?; // max_num_ref_frames
    bits.flag()?; // gaps_in_frame_num_value_allowed_flag
    bits.ue()?; // pic_width_in_mbs_minus1
    bits.ue()?; // pic_height_in_map_units_minus1
    if !bits.flag()? {
        bits.flag()?; // mb_adaptive_frame_field_flag
    }
    bits.flag()?; // direct_8x8_inference_flag
    if bits.flag()? {
        // The four sides of the cropping rectangle.
        for _ in 0..4 {
            bits.ue()?;
        }
    }

    // The video usability information, which a stream may leave out.
    if !bits.flag()? {
        return None;
    }
    if bits.flag()? && bits.bits(8)? == EXTENDED_SAR {
        bits.bits(32)?; // sar_width, sar_height
    }
    if bits.flag()? {
        bits.flag()?; // overscan_appropriate_flag
    }
    // video_signal_type_present_flag: without it the stream says nothing.
    if !bits.flag()? {
        return None;
    }
    bits.bits(3)?; // video_format
    bits.flag()
}

/// Whether the video of a clip says it is full-range, read from its `avcC`
/// payload. `Some(true)`: full range. `Some(false)`: the ordinary, limited
/// range. `None`: the stream does not say, or the bytes cannot be read; a
/// caller then leaves the question to the decoder.
pub fn full_range(avcc: &[u8]) -> Option<bool> {
    // Five bytes of versions and sizes, then the count of parameter sets in
    // the low five bits of the sixth, then the first set behind its length.
    let count = avcc.get(5)? & 0x1f;
    if count == 0 {
        return None;
    }
    let length = usize::from(u16::from_be_bytes([*avcc.get(6)?, *avcc.get(7)?]));
    full_range_of_sps(avcc.get(8..)?.get(..length)?)
}

#[cfg(test)]
mod tests {
    use super::*;

    // The `avcC` payloads of real files, each named for what `ffprobe` says of
    // the file. They hold a stream's settings and nothing of its picture.

    // The reference clip: a webcam recording. Main profile, `yuvj420p`,
    // `color_range=pc`, no colour description.
    const REFERENCE_CLIP: [u8; 41] = [
        0x01, 0x4d, 0x40, 0x1f, 0xff, 0xe1, 0x00, 0x19, 0x67, 0x4d, 0x40, 0x1f, 0xec, 0xc0, 0x28,
        0x02, 0xdd, 0x80, 0xb6, 0x40, 0x00, 0x00, 0x03, 0x00, 0x40, 0x00, 0x3a, 0x98, 0x03, 0xc6,
        0x0c, 0x66, 0x80, 0x01, 0x00, 0x05, 0x68, 0xe9, 0x7b, 0x2c, 0x80,
    ];
    // An export of Offcut, made by the browser's hardware encoder. High
    // profile, `yuv420p`; it has usability information and no signal type.
    const HARDWARE_EXPORT: [u8; 46] = [
        0x01, 0x64, 0x00, 0x32, 0xff, 0xe1, 0x00, 0x1b, 0x67, 0x64, 0x00, 0x32, 0xac, 0x2b, 0x70,
        0x22, 0x01, 0xe3, 0xcb, 0xe0, 0x22, 0x00, 0x00, 0x03, 0x00, 0x02, 0x00, 0x00, 0x03, 0x00,
        0x79, 0x1b, 0x43, 0x86, 0x5c, 0x01, 0x00, 0x04, 0x68, 0xee, 0x3c, 0xb0, 0xfd, 0xf8, 0xf8,
        0x00,
    ];
    // libx264, High profile, `yuvj420p`, `color_range=pc`, described as BT.709.
    const HIGH_FULL_DESCRIBED: [u8; 46] = [
        0x01, 0x64, 0x00, 0x20, 0xff, 0xe1, 0x00, 0x1b, 0x67, 0x64, 0x00, 0x20, 0xac, 0xd9, 0x40,
        0x50, 0x05, 0xbb, 0x01, 0x6e, 0x04, 0x04, 0x02, 0x80, 0x08, 0x8c, 0xa1, 0x82, 0x02, 0x11,
        0x90, 0x07, 0x8c, 0x18, 0xcb, 0x01, 0x00, 0x04, 0x68, 0xef, 0x8f, 0xcb, 0xfd, 0xf8, 0xf8,
        0x00,
    ];
    // libx264, High profile, `yuv420p`, `color_range=tv`, described as BT.709.
    const HIGH_LIMITED_DESCRIBED: [u8; 46] = [
        0x01, 0x64, 0x00, 0x20, 0xff, 0xe1, 0x00, 0x1b, 0x67, 0x64, 0x00, 0x20, 0xac, 0xd9, 0x40,
        0x50, 0x05, 0xbb, 0x01, 0x6a, 0x04, 0x04, 0x02, 0x80, 0x08, 0x8c, 0xa1, 0x82, 0x02, 0x11,
        0x90, 0x07, 0x8c, 0x18, 0xcb, 0x01, 0x00, 0x04, 0x68, 0xef, 0x8f, 0xcb, 0xfd, 0xf8, 0xf8,
        0x00,
    ];
    // libx264, High profile, `yuv420p`, no range and no colours stated.
    const HIGH_NOTHING_SAID: [u8; 43] = [
        0x01, 0x64, 0x00, 0x20, 0xff, 0xe1, 0x00, 0x18, 0x67, 0x64, 0x00, 0x20, 0xac, 0xd9, 0x40,
        0x50, 0x05, 0xbb, 0x01, 0x10, 0x01, 0x11, 0x94, 0x30, 0x40, 0x42, 0x32, 0x00, 0xf1, 0x83,
        0x19, 0x60, 0x01, 0x00, 0x04, 0x68, 0xef, 0x8f, 0xcb, 0xfd, 0xf8, 0xf8, 0x00,
    ];
    // libx264, Constrained Baseline, `yuvj420p`, `color_range=pc`.
    const BASELINE_FULL: [u8; 38] = [
        0x01, 0x42, 0xc0, 0x20, 0xff, 0xe1, 0x00, 0x17, 0x67, 0x42, 0xc0, 0x20, 0xda, 0x01, 0x40,
        0x16, 0xec, 0x05, 0xb2, 0x00, 0x22, 0x32, 0x86, 0x08, 0x08, 0x46, 0x40, 0x1e, 0x30, 0x65,
        0x40, 0x01, 0x00, 0x04, 0x68, 0xce, 0x0f, 0xc8,
    ];
    // libx264, High profile, `yuvj420p`, `color_range=pc`, with a sample
    // aspect ratio of 15:16 written out as two numbers.
    const HIGH_FULL_SAR: [u8; 47] = [
        0x01, 0x64, 0x00, 0x20, 0xff, 0xe1, 0x00, 0x1c, 0x67, 0x64, 0x00, 0x20, 0xac, 0xd9, 0x40,
        0x50, 0x05, 0xbb, 0xff, 0x00, 0x0f, 0x00, 0x10, 0x6c, 0x80, 0x08, 0x8c, 0xa1, 0x82, 0x02,
        0x11, 0x90, 0x07, 0x8c, 0x18, 0xcb, 0x01, 0x00, 0x04, 0x68, 0xef, 0x8f, 0xcb, 0xfd, 0xf8,
        0xf8, 0x00,
    ];

    #[test]
    fn the_reference_clip_says_full_range() {
        assert_eq!(full_range(&REFERENCE_CLIP), Some(true));
    }

    #[test]
    fn full_range_is_read_in_every_profile_and_behind_a_written_out_aspect_ratio() {
        assert_eq!(full_range(&HIGH_FULL_DESCRIBED), Some(true));
        assert_eq!(full_range(&BASELINE_FULL), Some(true));
        assert_eq!(full_range(&HIGH_FULL_SAR), Some(true));
    }

    #[test]
    fn a_stream_that_says_limited_range_is_not_full_range() {
        assert_eq!(full_range(&HIGH_LIMITED_DESCRIBED), Some(false));
    }

    #[test]
    fn a_stream_that_does_not_say_gives_none() {
        // No signal type: libx264 with nothing asked, and the browser's own encoder.
        assert_eq!(full_range(&HIGH_NOTHING_SAID), None);
        assert_eq!(full_range(&HARDWARE_EXPORT), None);
    }

    /// Writes bits, most significant first: a parameter set made by hand.
    struct Writer(Vec<bool>);

    impl Writer {
        fn bits(&mut self, value: u32, n: u32) {
            for shift in (0..n).rev() {
                self.0.push((value >> shift) & 1 == 1);
            }
        }

        fn ue(&mut self, value: u32) {
            let code = value + 1;
            let length = 32 - code.leading_zeros();
            self.bits(0, length - 1);
            self.bits(code, length);
        }

        fn se(&mut self, value: i32) {
            let magnitude = value.unsigned_abs();
            self.ue(if value > 0 {
                2 * magnitude - 1
            } else {
                2 * magnitude
            });
        }

        /// The bits as an `avcC` payload holding one parameter set.
        fn avcc(&self) -> Vec<u8> {
            let mut nal = vec![0x67u8];
            for chunk in self.0.chunks(8) {
                let byte = chunk
                    .iter()
                    .fold(0u8, |byte, &bit| (byte << 1) | u8::from(bit));
                nal.push(byte << (8 - chunk.len()));
            }
            let mut avcc = vec![0x01, 0x64, 0x00, 0x28, 0xff, 0xe1];
            avcc.extend_from_slice(&(nal.len() as u16).to_be_bytes());
            avcc.extend_from_slice(&nal);
            avcc
        }
    }

    /// A High-profile parameter set with everything that can stand in front
    /// of the range: scaling lists, a picture order count of type 1, fields,
    /// cropping, an aspect ratio and overscan information.
    fn long_way_round(full_range: bool) -> Vec<u8> {
        let mut w = Writer(Vec::new());
        w.bits(100, 8); // High
        w.bits(0, 16);
        w.ue(0);
        w.ue(1); // chroma_format_idc: 4:2:0
        w.ue(0);
        w.ue(0);
        w.bits(0, 1);
        w.bits(1, 1); // seq_scaling_matrix_present_flag
        for list in 0..8 {
            // The first list of each size is written out; the others are left to the defaults.
            let present = list == 0 || list == 6;
            w.bits(u32::from(present), 1);
            if present {
                let size = if list < 6 { 16 } else { 64 };
                for entry in 0..size {
                    // Five steps up from 8 to 13, then down to 0: after a 0
                    // the rest of the list is not written.
                    w.se(if entry == 5 { -13 } else { 1 });
                    if entry == 5 {
                        break;
                    }
                }
            }
        }
        w.ue(4);
        w.ue(1); // pic_order_cnt_type 1
        w.bits(0, 1);
        w.se(-3);
        w.se(2);
        w.ue(2);
        w.se(7);
        w.se(-7);
        w.ue(4);
        w.bits(0, 1);
        w.ue(119);
        w.ue(33);
        w.bits(0, 1); // frame_mbs_only_flag 0: fields
        w.bits(1, 1); // mb_adaptive_frame_field_flag
        w.bits(1, 1);
        w.bits(1, 1); // frame_cropping_flag
        for side in [0, 0, 0, 4] {
            w.ue(side);
        }
        w.bits(1, 1); // vui_parameters_present_flag
        w.bits(1, 1); // aspect_ratio_info_present_flag
        w.bits(1, 8); // 1:1
        w.bits(1, 1); // overscan_info_present_flag
        w.bits(0, 1);
        w.bits(1, 1); // video_signal_type_present_flag
        w.bits(5, 3);
        w.bits(u32::from(full_range), 1);
        w.bits(0, 1);
        w.avcc()
    }

    #[test]
    fn the_range_is_found_behind_scaling_lists_fields_and_cropping() {
        assert_eq!(full_range(&long_way_round(true)), Some(true));
        assert_eq!(full_range(&long_way_round(false)), Some(false));
    }

    #[test]
    fn the_bytes_that_guard_a_start_code_are_left_out() {
        // 00 00 03 01 in a NAL unit stands for 00 00 01.
        let mut bits = Bits::of_nal(&[0x00, 0x00, 0x03, 0x01, 0x00, 0x00, 0x03]);
        assert_eq!(bits.bits(24), Some(1));
        assert_eq!(bits.bits(16), Some(0));
        assert_eq!(bits.bits(1), None);
    }

    #[test]
    fn bytes_that_are_no_parameter_set_give_none_and_do_not_panic() {
        assert_eq!(full_range(&[]), None);
        assert_eq!(full_range(&[0x01, 0x64, 0x00, 0x28, 0xff, 0xe0]), None);
        // A length that runs past the end.
        assert_eq!(
            full_range(&[0x01, 0x64, 0x00, 0x28, 0xff, 0xe1, 0x00, 0x40, 0x67, 0x64]),
            None
        );
        // Not a sequence parameter set.
        assert_eq!(
            full_range(&[0x01, 0x64, 0x00, 0x28, 0xff, 0xe1, 0x00, 0x02, 0x68, 0xff]),
            None
        );
        // Every prefix of a real one: cut off anywhere, it is read to its end and no further.
        for end in 0..REFERENCE_CLIP.len() {
            let _ = full_range(&REFERENCE_CLIP[..end]);
        }
        // A parameter set of all zeros and of all ones.
        let _ = full_range(
            &[
                [0x01, 0x64, 0x00, 0x28, 0xff, 0xe1, 0x00, 0x20, 0x67].as_slice(),
                &[0x00; 32],
            ]
            .concat(),
        );
        let _ = full_range(
            &[
                [0x01, 0x64, 0x00, 0x28, 0xff, 0xe1, 0x00, 0x20, 0x67].as_slice(),
                &[0xff; 32],
            ]
            .concat(),
        );
    }
}
