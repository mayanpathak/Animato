//! MP4/MOV demuxing straight from OPFS, through `offcut-mp4`.
//!
//! The file is read where the demuxer asks, through a synchronous OPFS
//! handle, so a large clip is never loaded into memory. Only available in a
//! dedicated worker (where `createSyncAccessHandle` exists). Samples come out
//! as `{ data, ptsUs, durationUs, isKeyframe }` for WebCodecs.

use js_sys::{Object, Reflect, Uint8Array};
use offcut_mp4::demux::{Demuxer, SampleMeta};
use offcut_mp4::probe::probe;
use offcut_mp4::reader::RandomAccess;
use offcut_mp4::{ContainerError, IoError};
use offcut_types::{Bytes, TimeMs};
use wasm_bindgen::prelude::*;
use web_sys::{FileSystemReadWriteOptions, FileSystemSyncAccessHandle};

/// Bytes read ahead per call into the browser: samples sit close together,
/// and each call has a fixed cost.
const WINDOW_BYTES: usize = 1 << 20;

struct OpfsReader {
    handle: FileSystemSyncAccessHandle,
    len: Bytes,
    window: Vec<u8>,
    window_at: u64,
}

impl OpfsReader {
    fn read_exact(handle: &FileSystemSyncAccessHandle, at: u64, buf: &mut [u8]) -> Result<(), IoError> {
        let options = FileSystemReadWriteOptions::new();
        options.set_at(at as f64);
        let read = handle
            .read_with_u8_array_and_options(buf, &options)
            .map_err(|_| IoError::Read)?;
        if read == buf.len() as f64 {
            Ok(())
        } else {
            Err(IoError::Read)
        }
    }

    fn in_window(&self, at: u64, len: usize) -> Option<&[u8]> {
        let start = usize::try_from(at.checked_sub(self.window_at)?).ok()?;
        self.window.get(start..start.checked_add(len)?)
    }
}

impl RandomAccess for OpfsReader {
    fn len(&self) -> Bytes {
        self.len
    }

    fn read_at(&mut self, offset: Bytes, buf: &mut [u8]) -> Result<(), IoError> {
        if buf.is_empty() {
            return Ok(());
        }
        let at = offset.get();
        if buf.len() >= WINDOW_BYTES {
            return Self::read_exact(&self.handle, at, buf);
        }
        if self.in_window(at, buf.len()).is_none() {
            let left = usize::try_from(self.len.get().saturating_sub(at)).unwrap_or(usize::MAX);
            self.window.clear();
            self.window.resize(left.min(WINDOW_BYTES).max(buf.len()), 0);
            self.window_at = at;
            if let Err(error) = Self::read_exact(&self.handle, at, &mut self.window) {
                self.window.clear();
                return Err(error);
            }
        }
        let bytes = self.in_window(at, buf.len()).ok_or(IoError::Read)?;
        buf.copy_from_slice(bytes);
        Ok(())
    }
}

fn container_error(error: ContainerError) -> JsValue {
    JsValue::from_str(&format!("mp4: {error:?}"))
}

fn sample_to_js(meta: SampleMeta, data: &[u8]) -> Result<JsValue, JsValue> {
    let out = Object::new();
    Reflect::set(&out, &"data".into(), &Uint8Array::from(data))?;
    Reflect::set(&out, &"ptsUs".into(), &(meta.pts.get() as f64).into())?;
    Reflect::set(&out, &"dtsUs".into(), &(meta.dts.get() as f64).into())?;
    Reflect::set(&out, &"durationUs".into(), &(meta.duration.get() as f64).into())?;
    Reflect::set(&out, &"isKeyframe".into(), &meta.is_keyframe.into())?;
    Ok(out.into())
}

/// An open MP4/MOV file in OPFS.
#[wasm_bindgen]
pub struct Mp4Demuxer {
    inner: Demuxer<OpfsReader>,
    size: Bytes,
    buf: Vec<u8>,
}

#[wasm_bindgen]
impl Mp4Demuxer {
    /// Opens the file behind `handle`. Fails for fragmented or non-ISO-BMFF
    /// files (the caller then falls back to another demuxer).
    pub fn open(handle: FileSystemSyncAccessHandle) -> Result<Mp4Demuxer, JsValue> {
        let size = handle.get_size().map_err(|_| JsValue::from_str("mp4: size"))?;
        let len = Bytes::new(size as u64);
        let reader = OpfsReader { handle, len, window: Vec::new(), window_at: 0 };
        let inner = Demuxer::open(reader).map_err(container_error)?;
        Ok(Mp4Demuxer { inner, size: len, buf: Vec::new() })
    }

    /// The probe of the file: container, duration, codecs (WebCodecs codec
    /// strings), size and frame rate.
    pub fn info(&self) -> Result<JsValue, JsValue> {
        let info = probe(&self.inner, self.size);
        serde_wasm_bindgen::to_value(&info).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// The `description` for `VideoDecoder.configure` (avcC / hvcC / av1C).
    pub fn video_description(&self) -> Option<Vec<u8>> {
        self.inner.video_decoder_description().map(<[u8]>::to_vec)
    }

    /// The `description` for `AudioDecoder.configure` (AudioSpecificConfig).
    pub fn audio_description(&self) -> Option<Vec<u8>> {
        self.inner.audio_decoder_description().map(<[u8]>::to_vec)
    }

    pub fn video_sample_count(&self) -> u32 {
        self.inner.video_sample_count()
    }

    pub fn audio_sample_count(&self) -> u32 {
        self.inner.audio_sample_count()
    }

    /// Video sample `index` in decode order.
    pub fn read_video_sample(&mut self, index: u32) -> Result<JsValue, JsValue> {
        let meta = self.inner.read_video_sample(index, &mut self.buf).map_err(container_error)?;
        sample_to_js(meta, &self.buf)
    }

    /// Audio sample `index`.
    pub fn read_audio_sample(&mut self, index: u32) -> Result<JsValue, JsValue> {
        let meta = self.inner.read_audio_sample(index, &mut self.buf).map_err(container_error)?;
        sample_to_js(meta, &self.buf)
    }

    /// Index of the last keyframe shown at or before `t_ms`.
    pub fn keyframe_at_or_before(&self, t_ms: u32) -> u32 {
        self.inner.keyframe_at_or_before(TimeMs::new(t_ms))
    }
}
