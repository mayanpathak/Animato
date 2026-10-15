#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::panic,
    clippy::indexing_slicing
)]
//! What the muxer writes, read back by the demuxer of the same crate: every
//! sample byte for byte, with its time and its keyframe flag
//! (v2implementation §23.2). The muxer and the demuxer never look inside a
//! sample, so the payloads are pseudo-random bytes from a fixed seed.

use offcut_mp4::MuxError;
use offcut_mp4::boxes::{self, BoxHeader};
use offcut_mp4::demux::Demuxer;
use offcut_mp4::mux::{AudioTrackSpec, MOOV_RESERVE, MemSink, Mp4Muxer, VideoTrackSpec};
use offcut_mp4::probe::probe;
use offcut_mp4::reader::MemReader;
use offcut_mp4::sample_table::read_elst;
use offcut_types::{
    AudioCodec, Bytes, ContainerKind, FpsMilli, FrameIdx, Hz, Micros, Px, VideoCodec,
};
use proptest::prelude::*;

/// H.264 High at level 4.0. The muxer only needs it not to be empty.
const AVCC: [u8; 8] = [0x01, 0x64, 0x00, 0x28, 0xFF, 0xE1, 0x00, 0x00];
/// AAC-LC, 48 kHz, two channels.
const ASC: [u8; 2] = [0x11, 0x90];
/// One AAC frame: 1,024 samples at 48 kHz, in whole microseconds.
const AAC_FRAME: Micros = Micros::new(21_333);

const IDENTITY: [i32; 9] = [0x1_0000, 0, 0, 0, 0x1_0000, 0, 0, 0, 0x4000_0000];

fn video_spec() -> VideoTrackSpec {
    VideoTrackSpec {
        width: Px::new(1080),
        height: Px::new(1920),
        avcc: AVCC.to_vec(),
        frame_count_hint: 90,
    }
}

fn audio_spec() -> AudioTrackSpec {
    AudioTrackSpec {
        sample_rate: Hz::new(48_000),
        channels: 2,
        asc: ASC.to_vec(),
    }
}

/// Bytes that look random and are the same on every run.
struct Seeded(u64);

impl Seeded {
    fn bytes(&mut self, len: usize) -> Vec<u8> {
        (0..len)
            .map(|_| {
                self.0 ^= self.0 << 13;
                self.0 ^= self.0 >> 7;
                self.0 ^= self.0 << 17;
                (self.0 >> 24) as u8
            })
            .collect()
    }
}

/// Where audio sample `i` starts when every sample before it is one AAC
/// frame and the first one starts at `first`.
fn audio_pts(first: Micros, i: u32) -> Micros {
    Micros::new(first.get() + i64::from(i) * 1_024 * 1_000_000 / 48_000)
}

struct Written {
    file: Vec<u8>,
    returned: Bytes,
    video: Vec<(Vec<u8>, bool)>,
    audio: Vec<Vec<u8>>,
}

/// Muxes `video` (payload size and keyframe flag per frame) and `audio`
/// (payload size per sample). The two tracks are written in turns, so that
/// their chunks lie between each other in the file.
fn mux(video: &[(usize, bool)], audio: &[usize], first_audio_pts: Micros) -> Written {
    let mut seeded = Seeded(0x9E37_79B9_7F4A_7C15);
    let mut sink = MemSink::default();
    let mut muxer = Mp4Muxer::new(&mut sink, video_spec(), audio_spec()).unwrap();
    let mut written = Written {
        file: Vec::new(),
        returned: Bytes::new(0),
        video: Vec::new(),
        audio: Vec::new(),
    };
    let (mut v, mut a) = (0u32, 0u32);
    while (v as usize) < video.len() || (a as usize) < audio.len() {
        // Video is a little ahead of audio, as an encoder's output is.
        let video_next = (a as usize) >= audio.len()
            || ((v as usize) < video.len() && u64::from(v) * 1_600 <= u64::from(a) * 1_024);
        if video_next {
            let (size, keyframe) = video[v as usize];
            let data = seeded.bytes(size);
            muxer
                .add_video_sample(&data, FrameIdx::new(v), keyframe)
                .unwrap();
            written.video.push((data, keyframe));
            v += 1;
        } else {
            let data = seeded.bytes(audio[a as usize]);
            muxer
                .add_audio_sample(&data, audio_pts(first_audio_pts, a), AAC_FRAME)
                .unwrap();
            written.audio.push(data);
            a += 1;
        }
    }
    written.returned = muxer.finalize().unwrap();
    written.file = sink.0;
    written
}

/// 90 frames with a keyframe every 60, and 141 audio samples: 3 s of each.
fn three_seconds(first_audio_pts: Micros) -> Written {
    let video: Vec<(usize, bool)> = (0..90).map(|n| (500 + n * 7, n % 60 == 0)).collect();
    let audio: Vec<usize> = (0..141).map(|i| 200 + i * 3).collect();
    mux(&video, &audio, first_audio_pts)
}

/// Reads every sample back and compares it with what was written.
fn assert_round_trip(w: &Written, first_audio_pts: Micros) {
    let mut d = Demuxer::open(MemReader(w.file.clone())).unwrap();
    assert_eq!(d.video_sample_count() as usize, w.video.len());
    assert_eq!(d.audio_sample_count() as usize, w.audio.len());
    assert_eq!(d.video_decoder_description(), Some(&AVCC[..]));
    assert_eq!(d.audio_decoder_description(), Some(&ASC[..]));

    let mut out = Vec::new();
    for (n, (data, keyframe)) in (0u32..).zip(&w.video) {
        let meta = d.read_video_sample(n, &mut out).unwrap();
        assert_eq!(&out, data, "the bytes of video sample {n}");
        assert_eq!(meta.pts, FrameIdx::new(n).to_micros(), "video sample {n}");
        assert_eq!(meta.dts, meta.pts);
        assert_eq!(meta.is_keyframe, *keyframe, "video sample {n}");
    }
    // The priming length, to the nearest tick of 1/48,000 s.
    let priming = (-first_audio_pts.get() * 48_000 + 500_000).div_euclid(1_000_000);
    for (i, data) in (0u32..).zip(&w.audio) {
        let meta = d.read_audio_sample(i, &mut out).unwrap();
        assert_eq!(&out, data, "the bytes of audio sample {i}");
        assert_eq!(meta.duration, AAC_FRAME, "audio sample {i}");
        let ticks = i64::from(i) * 1_024 - priming;
        assert_eq!(
            meta.pts.get(),
            (ticks * 1_000_000).div_euclid(48_000),
            "audio sample {i}"
        );
        assert!(meta.is_keyframe);
    }
}

fn top_level(file: &[u8]) -> Vec<BoxHeader> {
    let mut reader = MemReader(file.to_vec());
    let len = Bytes::new(file.len() as u64);
    let mut found = Vec::new();
    let mut at = 0u64;
    while at < len.get() {
        let header = boxes::read_header(&mut reader, Bytes::new(at), len).unwrap();
        at = header.end.get();
        found.push(header);
    }
    found
}

fn find(headers: &[BoxHeader], kind: &[u8; 4]) -> BoxHeader {
    *headers.iter().find(|h| &h.kind == kind).unwrap()
}

/// The two `trak` boxes: video, then audio.
fn traks(file: &[u8]) -> (MemReader, BoxHeader, BoxHeader) {
    let mut reader = MemReader(file.to_vec());
    let moov = find(&top_level(file), b"moov");
    let in_moov = boxes::children(&mut reader, &moov).unwrap();
    let traks: Vec<BoxHeader> = in_moov.into_iter().filter(|h| &h.kind == b"trak").collect();
    assert_eq!(traks.len(), 2);
    (reader, traks[0], traks[1])
}

/// The type of every box in the file, at every depth.
fn all_kinds(file: &[u8]) -> Vec<[u8; 4]> {
    const CONTAINERS: [&[u8; 4]; 7] = [
        b"moov", b"trak", b"edts", b"mdia", b"minf", b"dinf", b"stbl",
    ];
    let mut reader = MemReader(file.to_vec());
    let mut pending = top_level(file);
    let mut kinds = Vec::new();
    while let Some(header) = pending.pop() {
        kinds.push(header.kind);
        if CONTAINERS.contains(&&header.kind) {
            pending.extend(boxes::children(&mut reader, &header).unwrap());
        }
    }
    kinds
}

#[test]
fn ninety_frames_and_141_audio_samples_come_back_byte_for_byte() {
    let w = three_seconds(Micros::new(0));
    assert_round_trip(&w, Micros::new(0));

    let d = Demuxer::open(MemReader(w.file.clone())).unwrap();
    // A frame every 1/30 s, floored to microseconds; a keyframe every 60.
    assert_eq!(
        d.keyframe_at_or_before(offcut_types::TimeMs::new(2_500)),
        60
    );
    assert_eq!(FrameIdx::new(89).to_micros().get(), 2_966_666);
}

#[test]
fn the_file_probes_as_h264_at_30_fps_with_aac_at_48_khz() {
    let w = three_seconds(Micros::new(0));
    let d = Demuxer::open(MemReader(w.file.clone())).unwrap();
    let p = probe(&d, w.returned);

    assert_eq!(p.container, ContainerKind::Mp4);
    assert_eq!((p.video_tracks, p.audio_tracks), (1, 1));
    assert_eq!(p.duration.get(), 3_000);
    let video = p.video.unwrap();
    assert_eq!(video.codec, VideoCodec::H264);
    assert_eq!(video.codec_string, "avc1.640028");
    assert_eq!(
        (video.coded_width.get(), video.coded_height.get()),
        (1080, 1920)
    );
    assert_eq!(video.frame_count, 90);
    assert_eq!(video.avg_fps, FpsMilli::new(30_000));
    assert_eq!(video.max_fps, FpsMilli::new(30_000));
    assert!(!video.is_vfr);
    let audio = p.audio.unwrap();
    assert_eq!(audio.codec, AudioCodec::Aac);
    assert_eq!(audio.codec_string, "mp4a.40.2");
    assert_eq!((audio.sample_rate.get(), audio.channels), (48_000, 2));
}

#[test]
fn the_boxes_are_ftyp_then_moov_then_mdat() {
    let w = three_seconds(Micros::new(0));
    let order: Vec<[u8; 4]> = top_level(&w.file).iter().map(|h| h.kind).collect();
    // What is left of the space kept for `moov` is a `free` box.
    assert_eq!(order, [*b"ftyp", *b"moov", *b"free", *b"mdat"]);
}

#[test]
fn finalize_returns_the_length_of_the_file() {
    let w = three_seconds(Micros::new(0));
    assert_eq!(w.returned.get(), w.file.len() as u64);
    // `mdat` runs to the end of the file, and says so in its 64-bit size.
    let mdat = find(&top_level(&w.file), b"mdat");
    assert_eq!(mdat.end.get(), w.file.len() as u64);
    assert_eq!(mdat.body.get() - mdat.start.get(), 16);
}

#[test]
fn a_first_audio_sample_before_0_becomes_an_edit_of_its_length() {
    let first = Micros::new(-21_333);
    let w = three_seconds(first);
    let (mut reader, _, audio) = traks(&w.file);
    let elst = boxes::descend(&mut reader, &audio, &[*b"edts", *b"elst"])
        .unwrap()
        .unwrap();
    let edits = read_elst(&mut reader, &elst).unwrap();
    assert_eq!(edits.len(), 1);
    // 21,333 microseconds are 1,023.98 ticks of 1/48,000 s: 1,024.
    assert_eq!(edits[0].media_time, 1_024);
    // What is shown: 140 of the 141 frames, in milliseconds.
    assert_eq!(edits[0].segment_duration, 2_987);

    let mut d = Demuxer::open(MemReader(w.file.clone())).unwrap();
    let mut out = Vec::new();
    // 1,024 ticks before 0 are 21,333.3 microseconds, and the demuxer
    // rounds a time down.
    assert_eq!(d.read_audio_sample(0, &mut out).unwrap().pts.get(), -21_334);
    assert_eq!(d.read_audio_sample(1, &mut out).unwrap().pts.get(), 0);
    assert_round_trip(&w, first);
}

#[test]
fn a_first_audio_sample_at_0_writes_no_edit() {
    let w = three_seconds(Micros::new(0));
    let (mut reader, video, audio) = traks(&w.file);
    assert_eq!(boxes::child(&mut reader, &audio, b"edts").unwrap(), None);
    assert_eq!(boxes::child(&mut reader, &video, b"edts").unwrap(), None);
}

#[test]
fn ninety_seconds_fit_the_space_kept_for_moov() {
    let video: Vec<(usize, bool)> = (0..2_700).map(|n| (3_000, n % 60 == 0)).collect();
    let audio = vec![400usize; 4_220];
    let w = mux(&video, &audio, Micros::new(0));

    let top = top_level(&w.file);
    let (moov, mdat) = (find(&top, b"moov"), find(&top, b"mdat"));
    assert!(moov.end.get() <= mdat.start.get());
    // Written in turns, most samples are a chunk of their own, which is the
    // largest `moov` a clip of this length can have.
    assert!(moov.end.get() - moov.start.get() < MOOV_RESERVE);
    assert_eq!(mdat.start.get() - moov.start.get(), MOOV_RESERVE);

    let d = Demuxer::open(MemReader(w.file.clone())).unwrap();
    assert_eq!(probe(&d, w.returned).duration.get(), 90_000);
    assert_eq!(
        (d.video_sample_count(), d.audio_sample_count()),
        (2_700, 4_220)
    );
    assert_round_trip(&w, Micros::new(0));
}

#[test]
fn a_frame_out_of_its_turn_is_out_of_order() {
    let mut muxer = Mp4Muxer::new(MemSink::default(), video_spec(), audio_spec()).unwrap();
    assert_eq!(
        muxer.add_video_sample(&[1], FrameIdx::new(1), true),
        Err(MuxError::OutOfOrder)
    );
    muxer
        .add_video_sample(&[1], FrameIdx::new(0), true)
        .unwrap();
    assert_eq!(
        muxer.add_video_sample(&[1], FrameIdx::new(0), true),
        Err(MuxError::OutOfOrder)
    );

    // Audio may not go back in time either.
    muxer
        .add_audio_sample(&[1], Micros::new(21_333), AAC_FRAME)
        .unwrap();
    assert_eq!(
        muxer.add_audio_sample(&[1], Micros::new(0), AAC_FRAME),
        Err(MuxError::OutOfOrder)
    );
}

#[test]
fn a_first_frame_that_is_not_a_keyframe_is_a_bad_configuration() {
    let mut muxer = Mp4Muxer::new(MemSink::default(), video_spec(), audio_spec()).unwrap();
    assert!(matches!(
        muxer.add_video_sample(&[1], FrameIdx::new(0), false),
        Err(MuxError::BadConfig(_))
    ));
    // Nothing was recorded: the frame can still be given as a keyframe.
    muxer
        .add_video_sample(&[1], FrameIdx::new(0), true)
        .unwrap();
    muxer
        .add_video_sample(&[1], FrameIdx::new(1), false)
        .unwrap();
}

#[test]
fn an_empty_avcc_another_sample_rate_or_one_channel_is_a_bad_configuration() {
    let refused = |video: VideoTrackSpec, audio: AudioTrackSpec| {
        let mut sink = MemSink::default();
        let result = Mp4Muxer::new(&mut sink, video, audio).map(|_| ());
        // A refused configuration writes nothing.
        assert!(sink.0.is_empty());
        matches!(result, Err(MuxError::BadConfig(_)))
    };
    assert!(refused(
        VideoTrackSpec {
            avcc: Vec::new(),
            ..video_spec()
        },
        audio_spec()
    ));
    assert!(refused(
        video_spec(),
        AudioTrackSpec {
            sample_rate: Hz::new(44_100),
            ..audio_spec()
        }
    ));
    assert!(refused(
        video_spec(),
        AudioTrackSpec {
            channels: 1,
            ..audio_spec()
        }
    ));
    assert!(refused(
        video_spec(),
        AudioTrackSpec {
            asc: Vec::new(),
            ..audio_spec()
        }
    ));
    assert!(refused(
        VideoTrackSpec {
            width: Px::new(0),
            ..video_spec()
        },
        audio_spec()
    ));
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(48))]

    #[test]
    fn any_frames_with_any_sizes_and_keyframes_come_back(
        frames in prop::collection::vec((1usize..=2_000, any::<bool>()), 1..=300),
        audio in prop::collection::vec(1usize..=600, 0..=40),
    ) {
        let mut frames = frames;
        frames[0].1 = true;
        let w = mux(&frames, &audio, Micros::new(0));
        prop_assert_eq!(w.returned.get(), w.file.len() as u64);
        assert_round_trip(&w, Micros::new(0));
    }
}

#[test]
fn the_video_track_has_its_size_no_rotation_and_no_user_data() {
    let w = three_seconds(Micros::new(-21_333));
    let (mut reader, video, audio) = traks(&w.file);
    let tkhd = boxes::child(&mut reader, &video, b"tkhd").unwrap().unwrap();
    let tkhd = boxes::read_tkhd(&mut reader, &tkhd).unwrap();
    assert_eq!((tkhd.width >> 16, tkhd.height >> 16), (1080, 1920));
    assert_eq!(tkhd.matrix, IDENTITY);
    assert_eq!(tkhd.flags & 1, 1);

    let audio_tkhd = boxes::child(&mut reader, &audio, b"tkhd").unwrap().unwrap();
    assert_eq!(
        boxes::read_tkhd(&mut reader, &audio_tkhd).unwrap().matrix,
        IDENTITY
    );

    let kinds = all_kinds(&w.file);
    assert!(kinds.contains(b"stbl") && kinds.contains(b"elst"));
    for unwanted in [b"udta", b"meta", b"ilst", b"\xa9nam", b"\xa9xyz"] {
        assert!(!kinds.contains(unwanted), "found {unwanted:?}");
    }
    // The six tables of the video track, and no `ctts` before V5.
    let stbl = boxes::descend(&mut reader, &video, &[*b"mdia", *b"minf", *b"stbl"])
        .unwrap()
        .unwrap();
    let tables: Vec<[u8; 4]> = boxes::children(&mut reader, &stbl)
        .unwrap()
        .iter()
        .map(|h| h.kind)
        .collect();
    assert_eq!(
        tables,
        [*b"stsd", *b"stts", *b"stss", *b"stsc", *b"stsz", *b"co64"]
    );
}
