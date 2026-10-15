//! What a file says about itself, read from its boxes. `probe` never fails
//! and never looks at the expanded sample list, so every field is also right
//! for a track too long to expand.

use offcut_types::{
    AudioCodec, AudioTrackInfo, Bytes, ContainerKind, DurMs, FpsMilli, Hz, ProbeInfo, Px, Rotation,
    VideoCodec, VideoTrackInfo,
};

use crate::demux::{Demuxer, Track};
use crate::reader::RandomAccess;

pub fn probe<R: RandomAccess>(d: &Demuxer<R>, file_size: Bytes) -> ProbeInfo {
    let (video_tracks, audio_tracks) = d.track_counts();
    // The presented length of the video track; without one, of the audio track.
    let duration = d.video().or(d.audio()).map_or(0, duration_ms);
    ProbeInfo {
        container: if d.brand() == Some(*b"qt  ") {
            ContainerKind::Mov
        } else {
            ContainerKind::Mp4
        },
        file_size,
        duration: DurMs::new(duration),
        video_tracks,
        audio_tracks,
        video: d.video().map(|track| video_info(track, duration_ms(track))),
        audio: d.audio().map(audio_info),
    }
}

/// `presented` in milliseconds, to the nearest (v2implementation D-34).
fn duration_ms(track: &Track) -> u32 {
    let timescale = u128::from(track.table.timescale.max(1));
    let presented = u128::try_from(track.table.presented).unwrap_or(0);
    u32::try_from((presented * 1_000 + timescale / 2) / timescale).unwrap_or(u32::MAX)
}

fn fourcc_string(fourcc: [u8; 4]) -> String {
    String::from_utf8_lossy(&fourcc).into_owned()
}

fn video_info(track: &Track, duration_ms: u32) -> VideoTrackInfo {
    let entry = &track.entry;
    let codec = match &entry.fourcc {
        b"avc1" | b"avc3" => VideoCodec::H264,
        b"hvc1" | b"hev1" => VideoCodec::Hevc,
        b"av01" => VideoCodec::Av1,
        b"vp09" => VideoCodec::Vp9,
        b"apch" | b"apcn" | b"apcs" | b"apco" | b"ap4h" => VideoCodec::ProRes,
        _ => VideoCodec::Other,
    };
    // Profile, constraint flags and level: bytes 1 to 3 of `avcC`.
    let avc = entry.config.as_deref().and_then(|avcc| avcc.get(1..4));
    let codec_string = match (codec, avc) {
        (VideoCodec::H264, Some([profile, flags, level])) => {
            format!("avc1.{profile:02x}{flags:02x}{level:02x}")
        }
        _ => fourcc_string(entry.fourcc),
    };

    let frame_count = track.table.sample_count;
    let avg_fps = (u64::from(frame_count) * 1_000_000)
        .checked_div(u64::from(duration_ms))
        .unwrap_or(0);
    // The sample durations, from the runs of `stts`.
    let deltas = || {
        track
            .stts
            .iter()
            .filter(|&&(run, _)| run > 0)
            .map(|&(_, delta)| delta)
    };
    let timescale = u64::from(track.table.timescale);
    let shortest = deltas().filter(|&delta| delta > 0).min();
    let max_fps = shortest.map_or(0, |delta| timescale * 1_000 / u64::from(delta));
    let spread = u64::from(deltas().max().unwrap_or(0)) - u64::from(deltas().min().unwrap_or(0));

    VideoTrackInfo {
        codec,
        codec_string,
        coded_width: Px::new(u32::from(entry.width)),
        coded_height: Px::new(u32::from(entry.height)),
        rotation: rotation(&track.tkhd.matrix),
        avg_fps: FpsMilli::new(u32::try_from(avg_fps).unwrap_or(u32::MAX)),
        max_fps: FpsMilli::new(u32::try_from(max_fps).unwrap_or(u32::MAX)),
        // Two sample durations more than 1 ms apart (TS §15.4).
        is_vfr: spread * 1_000 > timescale,
        frame_count,
    }
}

/// From the 2x2 part of the track matrix, whose 1.0 is 65,536. Anything
/// that is not a quarter turn is read as no rotation.
fn rotation(matrix: &[i32; 9]) -> Rotation {
    const ONE: i32 = 0x0001_0000;
    const NEG: i32 = -ONE;
    let [a, b, _, c, d, ..] = *matrix;
    match (a, b, c, d) {
        (0, ONE, NEG, 0) => Rotation::R90,
        (NEG, 0, 0, NEG) => Rotation::R180,
        (0, NEG, ONE, 0) => Rotation::R270,
        _ => Rotation::R0,
    }
}

fn audio_info(track: &Track) -> AudioTrackInfo {
    let entry = &track.entry;
    let codec = match (&entry.fourcc, entry.object_type) {
        (b"mp4a", Some(0x40)) => AudioCodec::Aac,
        (b"mp4a", Some(0x69 | 0x6B)) | (b".mp3", _) => AudioCodec::Mp3,
        (b"Opus", _) => AudioCodec::Opus,
        (b"lpcm" | b"sowt" | b"twos", _) => AudioCodec::Pcm,
        _ => AudioCodec::Other,
    };
    let asc = entry.config.as_deref().and_then(audio_specific_config);
    let codec_string = match (codec, asc) {
        (AudioCodec::Aac, Some(asc)) => format!("mp4a.40.{}", asc.object_type),
        _ => fourcc_string(entry.fourcc),
    };
    // The decoder goes by its own config, so that is believed before the sample entry.
    let sample_rate = asc
        .and_then(|asc| asc.sample_rate)
        .unwrap_or(entry.sample_rate);
    let channels = asc.and_then(|asc| asc.channels).unwrap_or(entry.channels);
    AudioTrackInfo {
        codec,
        codec_string,
        sample_rate: Hz::new(sample_rate),
        channels,
    }
}

#[derive(Clone, Copy)]
struct AudioSpecificConfig {
    object_type: u32,
    sample_rate: Option<u32>,
    channels: Option<u32>,
}

/// The first fields of an `AudioSpecificConfig`: the audio object type, the
/// sampling frequency and the channel configuration.
fn audio_specific_config(bytes: &[u8]) -> Option<AudioSpecificConfig> {
    const RATES: [u32; 13] = [
        96_000, 88_200, 64_000, 48_000, 44_100, 32_000, 24_000, 22_050, 16_000, 12_000, 11_025,
        8_000, 7_350,
    ];
    let mut at = 0usize;
    // The next `n` bits, most significant first.
    let mut bits = |n: usize| -> Option<u32> {
        let mut value = 0u32;
        for _ in 0..n {
            let byte = *bytes.get(at / 8)?;
            value = (value << 1) | u32::from((byte >> (7 - at % 8)) & 1);
            at += 1;
        }
        Some(value)
    };

    let mut object_type = bits(5)?;
    if object_type == 31 {
        object_type = 32 + bits(6)?;
    }
    let sample_rate = match bits(4)? {
        15 => Some(bits(24)?),
        index => RATES.get(index as usize).copied(),
    };
    // 0 means the layout is described further on: left to the sample entry.
    let channels = match bits(4)? {
        0 => None,
        7 => Some(8),
        count => Some(count),
    };
    Some(AudioSpecificConfig {
        object_type,
        sample_rate,
        channels,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::demux::fixture::{audio, file, video};
    use crate::reader::MemReader;
    use crate::validate::validate_probe;
    use offcut_types::RejectReason;

    fn probe_file(bytes: Vec<u8>) -> ProbeInfo {
        let reader = MemReader(bytes);
        let size = reader.len();
        probe(&Demuxer::open(reader).unwrap(), size)
    }

    #[test]
    fn the_tkhd_matrices_of_the_four_quarter_turns() {
        const ONE: i32 = 0x1_0000;
        let turns = [
            ([ONE, 0, 0, ONE], Rotation::R0),
            ([0, ONE, -ONE, 0], Rotation::R90),
            ([-ONE, 0, 0, -ONE], Rotation::R180),
            ([0, -ONE, ONE, 0], Rotation::R270),
        ];
        for ([a, b, c, d], expected) in turns {
            let mut track = video(3);
            track.matrix = [a, b, 0, c, d, 0, 0, 0, 0x4000_0000];
            assert_eq!(probe_file(file(&[track])).video.unwrap().rotation, expected);
        }
    }

    #[test]
    fn avcc_bytes_64_00_28_give_the_codec_string_avc1_640028() {
        let p = probe_file(file(&[video(90), audio(b"mp4a", 141)]));
        let v = p.video.unwrap();
        assert_eq!(
            (v.codec, v.codec_string.as_str()),
            (VideoCodec::H264, "avc1.640028")
        );
        assert_eq!(
            (v.coded_width.get(), v.coded_height.get(), v.frame_count),
            (1280, 720, 90)
        );
        assert_eq!(
            (v.avg_fps.get(), v.max_fps.get(), v.is_vfr),
            (30_000, 30_000, false)
        );
        let a = p.audio.unwrap();
        assert_eq!(
            (a.codec, a.codec_string.as_str()),
            (AudioCodec::Aac, "mp4a.40.2")
        );
        assert_eq!((a.sample_rate.get(), a.channels), (48_000, 2));
        assert_eq!(
            (
                p.container,
                p.duration.get(),
                p.video_tracks,
                p.audio_tracks
            ),
            (ContainerKind::Mp4, 3_000, 1, 1)
        );
    }

    #[test]
    fn a_video_track_of_30_000_samples_opens_unresolved_and_is_too_long() {
        // One run of 30,000 frames at 30 fps: 1,000 seconds.
        let p = probe_file(file(&[video(30_000), audio(b"mp4a", 3)]));
        let v = p.video.as_ref().unwrap();
        assert_eq!(
            (p.duration.get(), v.avg_fps.get(), v.frame_count),
            (1_000_000, 30_000, 30_000)
        );
        // The clip is too long. It is not a corrupt file.
        assert_eq!(validate_probe(&p, true), Err(RejectReason::Duration));
    }

    #[test]
    fn an_lpcm_audio_track_of_4_320_000_samples_opens_and_is_the_wrong_codec() {
        // 90 seconds of PCM is one sample per audio frame.
        let p = probe_file(file(&[video(90), audio(b"lpcm", 4_320_000)]));
        assert_eq!(p.audio.as_ref().unwrap().codec, AudioCodec::Pcm);
        assert_eq!(validate_probe(&p, true), Err(RejectReason::AudioCodec));
    }
}
