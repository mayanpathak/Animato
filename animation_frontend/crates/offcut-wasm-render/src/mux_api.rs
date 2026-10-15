//! The export of the MP4 muxer of `offcut-mp4`: encoded samples in, a file
//! written through the sink it is given.

use js_sys::{Function, Reflect, Uint8Array};
use offcut_mp4::mux::{AudioTrackSpec, Mp4Muxer, MuxSink, VideoTrackSpec};
use offcut_mp4::{IoError, MuxError};
use offcut_types::{Bytes, ErrorCode, FrameIdx, Hz, Micros, Px};
use wasm_bindgen::prelude::wasm_bindgen;
use wasm_bindgen::{JsCast, JsValue};

use crate::failure;

// The audio of an export is always this (TS §21.2).
const AUDIO_SAMPLE_RATE: Hz = Hz::new(48_000);
const AUDIO_CHANNELS: u32 = 2;

/// The object the file is written through: its `writeAt(offset, data)`.
struct JsMuxSink {
    sink: JsValue,
    write_at: Function,
}

impl MuxSink for JsMuxSink {
    /// A throw of `writeAt` is a write that failed.
    fn write_at(&mut self, offset: Bytes, data: &[u8]) -> Result<(), IoError> {
        let offset = JsValue::from_f64(offset.get() as f64);
        let data = Uint8Array::from(data);
        self.write_at
            .call2(&self.sink, &offset, &data)
            .map(|_| ())
            .map_err(|_| IoError::Write)
    }
}

/// The variant's name: the `detail` of a failure.
fn mux_error_name(error: MuxError) -> &'static str {
    match error {
        MuxError::Io(IoError::Read) => "Read",
        MuxError::Io(IoError::Write) => "Write",
        MuxError::Io(IoError::OutOfBounds) => "OutOfBounds",
        MuxError::BadConfig(_) => "BadConfig",
        MuxError::OutOfOrder => "OutOfOrder",
        MuxError::MoovOverflow => "MoovOverflow",
    }
}

fn mux_failure(error: MuxError) -> JsValue {
    failure(ErrorCode::Mux, mux_error_name(error))
}

#[wasm_bindgen]
pub struct Mp4MuxerHandle {
    muxer: Mp4Muxer<JsMuxSink>,
}

#[wasm_bindgen]
impl Mp4MuxerHandle {
    /// `sink` is an object with `writeAt(offset, data)`. `avcc` is the raw
    /// `avcC` payload of the video encoder and `asc` the
    /// `AudioSpecificConfig` of the audio encoder.
    #[wasm_bindgen(constructor)]
    pub fn new(
        sink: JsValue,
        width: u32,
        height: u32,
        avcc: &[u8],
        frame_count_hint: u32,
        asc: &[u8],
    ) -> Result<Mp4MuxerHandle, JsValue> {
        let write_at = Reflect::get(&sink, &JsValue::from_str("writeAt"))
            .ok()
            .and_then(|value| value.dyn_into::<Function>().ok())
            .ok_or_else(|| failure(ErrorCode::Internal, "Sink"))?;
        let video = VideoTrackSpec {
            width: Px::new(width),
            height: Px::new(height),
            avcc: avcc.to_vec(),
            frame_count_hint,
        };
        let audio = AudioTrackSpec {
            sample_rate: AUDIO_SAMPLE_RATE,
            channels: AUDIO_CHANNELS,
            asc: asc.to_vec(),
        };
        let muxer =
            Mp4Muxer::new(JsMuxSink { sink, write_at }, video, audio).map_err(mux_failure)?;
        Ok(Mp4MuxerHandle { muxer })
    }

    pub fn add_video_sample(
        &mut self,
        data: &[u8],
        frame: u32,
        is_keyframe: bool,
    ) -> Result<(), JsValue> {
        self.muxer
            .add_video_sample(data, FrameIdx::new(frame), is_keyframe)
            .map_err(mux_failure)
    }

    /// The times are in microseconds, as an encoder gives them.
    pub fn add_audio_sample(
        &mut self,
        data: &[u8],
        pts_us: f64,
        duration_us: f64,
    ) -> Result<(), JsValue> {
        let (pts, duration) = (Micros::new(pts_us as i64), Micros::new(duration_us as i64));
        self.muxer
            .add_audio_sample(data, pts, duration)
            .map_err(mux_failure)
    }

    /// Writes what makes the file whole and returns its size in bytes. The
    /// muxer is used up.
    pub fn finalize(self) -> Result<f64, JsValue> {
        let bytes = self.muxer.finalize().map_err(mux_failure)?;
        Ok(bytes.get() as f64)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_detail_of_a_mux_failure_is_the_name_of_its_variant() {
        let names = [
            (MuxError::Io(IoError::Write), "Write"),
            (MuxError::Io(IoError::Read), "Read"),
            (MuxError::Io(IoError::OutOfBounds), "OutOfBounds"),
            // What a variant carries is not passed on.
            (MuxError::BadConfig("avcc"), "BadConfig"),
            (MuxError::OutOfOrder, "OutOfOrder"),
            (MuxError::MoovOverflow, "MoovOverflow"),
        ];
        for (error, name) in names {
            assert_eq!(mux_error_name(error), name);
        }
        let code = serde_json::to_value(ErrorCode::Mux).unwrap();
        assert_eq!(code, "E_MUX");
    }
}
