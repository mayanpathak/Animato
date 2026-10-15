//! The limits a clip must meet (PS §9.4), in the order of TS §15.2. This is
//! the only place a `ClipInfo` is made.

use offcut_types::limits::{INPUT_FPS_TOLERANCE, MAX_CLIP_DURATION, MAX_INPUT_FPS, MAX_LONG_SIDE};
use offcut_types::{
    AudioCodec, ClipInfo, ContainerKind, Orientation, ProbeInfo, RejectReason, Rotation, VideoCodec,
};

/// The eleven rules; the first one that fails gives the reason.
/// `decode_supported` is the browser's answer for this clip's video config.
/// The file-size rule is not here: the import checks it before any copy.
pub fn validate_probe(p: &ProbeInfo, decode_supported: bool) -> Result<ClipInfo, RejectReason> {
    // 1
    if p.container == ContainerKind::Other {
        return Err(RejectReason::Container);
    }
    // 2
    let Some(video) = p.video.as_ref().filter(|_| p.video_tracks > 0) else {
        return Err(RejectReason::NoVideo);
    };
    // 3
    if video.codec == VideoCodec::Hevc {
        return Err(RejectReason::Hevc);
    }
    // 4
    if video.codec != VideoCodec::H264 {
        return Err(RejectReason::VideoCodec);
    }
    // 5
    let Some(audio) = p.audio.as_ref().filter(|_| p.audio_tracks > 0) else {
        return Err(RejectReason::NoAudio);
    };
    // 6
    if p.audio_tracks > 1 {
        return Err(RejectReason::MultiAudioTrack);
    }
    // 7
    if audio.codec != AudioCodec::Aac {
        return Err(RejectReason::AudioCodec);
    }
    // 8
    if p.duration > MAX_CLIP_DURATION {
        return Err(RejectReason::Duration);
    }
    // 9: the size as shown, after the rotation.
    let (display_width, display_height) = match video.rotation {
        Rotation::R0 | Rotation::R180 => (video.coded_width, video.coded_height),
        Rotation::R90 | Rotation::R270 => (video.coded_height, video.coded_width),
    };
    if display_width.max(display_height) > MAX_LONG_SIDE {
        return Err(RejectReason::Resolution);
    }
    // 10
    if video.avg_fps.get()
        > MAX_INPUT_FPS
            .get()
            .saturating_add(INPUT_FPS_TOLERANCE.get())
    {
        return Err(RejectReason::FrameRate);
    }
    // 11
    if !decode_supported {
        return Err(RejectReason::DecodeUnsupported);
    }

    // A square clip is landscape (TS §10.3).
    let portrait = display_height > display_width;
    Ok(ClipInfo {
        duration: p.duration,
        display_width,
        display_height,
        rotation: video.rotation,
        orientation: if portrait {
            Orientation::Portrait
        } else {
            Orientation::Landscape
        },
        is_vfr: video.is_vfr,
        video_codec_string: video.codec_string.clone(),
        audio_codec_string: audio.codec_string.clone(),
        audio_sample_rate: audio.sample_rate,
        audio_channels: audio.channels,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use offcut_types::{AudioTrackInfo, Bytes, DurMs, FpsMilli, Hz, Px, VideoTrackInfo};

    /// A clip every rule accepts: 60 s of 1080x1920 H.264 at 30 fps with AAC.
    fn accepted() -> ProbeInfo {
        ProbeInfo {
            container: ContainerKind::Mp4,
            file_size: Bytes::new(40_000_000),
            duration: DurMs::new(60_000),
            video_tracks: 1,
            audio_tracks: 1,
            video: Some(VideoTrackInfo {
                codec: VideoCodec::H264,
                codec_string: "avc1.640028".to_owned(),
                coded_width: Px::new(1080),
                coded_height: Px::new(1920),
                rotation: Rotation::R0,
                avg_fps: FpsMilli::new(30_000),
                max_fps: FpsMilli::new(30_000),
                is_vfr: false,
                frame_count: 1_800,
            }),
            audio: Some(AudioTrackInfo {
                codec: AudioCodec::Aac,
                codec_string: "mp4a.40.2".to_owned(),
                sample_rate: Hz::new(48_000),
                channels: 2,
            }),
        }
    }

    /// `accepted()` with one change.
    fn with(change: impl FnOnce(&mut ProbeInfo)) -> ProbeInfo {
        let mut p = accepted();
        change(&mut p);
        p
    }

    fn video(p: &mut ProbeInfo) -> &mut VideoTrackInfo {
        p.video.as_mut().unwrap()
    }

    #[test]
    fn each_of_the_eleven_rules_violated_alone_gives_its_reason() {
        assert!(validate_probe(&accepted(), true).is_ok());
        let broken = [
            (
                with(|p| p.container = ContainerKind::Other),
                RejectReason::Container,
            ),
            (
                with(|p| (p.video_tracks, p.video) = (0, None)),
                RejectReason::NoVideo,
            ),
            (
                with(|p| video(p).codec = VideoCodec::Hevc),
                RejectReason::Hevc,
            ),
            (
                with(|p| video(p).codec = VideoCodec::Vp9),
                RejectReason::VideoCodec,
            ),
            (
                with(|p| (p.audio_tracks, p.audio) = (0, None)),
                RejectReason::NoAudio,
            ),
            (with(|p| p.audio_tracks = 2), RejectReason::MultiAudioTrack),
            (
                with(|p| p.audio.as_mut().unwrap().codec = AudioCodec::Mp3),
                RejectReason::AudioCodec,
            ),
            (
                with(|p| p.duration = DurMs::new(90_001)),
                RejectReason::Duration,
            ),
            (
                with(|p| video(p).coded_height = Px::new(1_921)),
                RejectReason::Resolution,
            ),
            (
                with(|p| video(p).avg_fps = FpsMilli::new(60_501)),
                RejectReason::FrameRate,
            ),
        ];
        for (p, reason) in broken {
            assert_eq!(validate_probe(&p, true), Err(reason));
        }
        assert_eq!(
            validate_probe(&accepted(), false),
            Err(RejectReason::DecodeUnsupported)
        );
    }

    #[test]
    fn of_two_violated_rules_the_earlier_one_wins() {
        // Rules 3 and 8; rules 7 and 9; rules 10 and 11.
        let p = with(|p| (video(p).codec, p.duration) = (VideoCodec::Hevc, DurMs::new(200_000)));
        assert_eq!(validate_probe(&p, true), Err(RejectReason::Hevc));
        let p = with(|p| {
            p.audio.as_mut().unwrap().codec = AudioCodec::Opus;
            video(p).coded_width = Px::new(4_000);
        });
        assert_eq!(validate_probe(&p, true), Err(RejectReason::AudioCodec));
        let p = with(|p| video(p).avg_fps = FpsMilli::new(120_000));
        assert_eq!(validate_probe(&p, false), Err(RejectReason::FrameRate));
    }

    #[test]
    fn exactly_90_000_ms_and_60_500_fps_milli_are_accepted() {
        let p = with(|p| {
            p.duration = DurMs::new(90_000);
            video(p).avg_fps = FpsMilli::new(60_500);
        });
        let clip = validate_probe(&p, true).unwrap();
        assert_eq!(clip.duration.get(), 90_000);
        // The long side at exactly the limit.
        assert!(validate_probe(&with(|p| video(p).coded_height = Px::new(1_920)), true).is_ok());
    }

    #[test]
    fn a_1920x1080_probe_turned_90_degrees_is_a_1080x1920_portrait_clip() {
        let landscape = |p: &mut ProbeInfo| {
            let v = video(p);
            (v.coded_width, v.coded_height) = (Px::new(1_920), Px::new(1_080));
        };
        let p = with(|p| {
            landscape(p);
            video(p).rotation = Rotation::R90;
        });
        let clip = validate_probe(&p, true).unwrap();
        assert_eq!(
            (clip.display_width.get(), clip.display_height.get()),
            (1_080, 1_920)
        );
        assert_eq!(
            (clip.orientation, clip.rotation),
            (Orientation::Portrait, Rotation::R90)
        );
        // Unturned it is landscape, and so is a square.
        assert_eq!(
            validate_probe(&with(landscape), true).unwrap().orientation,
            Orientation::Landscape
        );
        let square = with(|p| video(p).coded_height = Px::new(1_080));
        assert_eq!(
            validate_probe(&square, true).unwrap().orientation,
            Orientation::Landscape
        );
    }
}
