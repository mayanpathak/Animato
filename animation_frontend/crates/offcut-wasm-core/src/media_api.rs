//! The exports of `offcut-mp4` and `offcut-dsp`: open a file through a
//! synchronous OPFS handle, probe and validate it, read its audio samples,
//! resample PCM. A rejection is a value; a failure is `{ code, detail }`.

use js_sys::{Object, Reflect, Uint8Array};
use offcut_dsp::resample::resample_mono;
use offcut_mp4::demux::Demuxer;
use offcut_mp4::probe::probe;
use offcut_mp4::reader::RandomAccess;
use offcut_mp4::validate::validate_probe;
use offcut_mp4::{ContainerError, IoError};
use offcut_types::{Bytes, ClipInfo, ErrorCode, Hz, RejectReason};
use serde::Serialize;
use wasm_bindgen::JsValue;
use wasm_bindgen::prelude::wasm_bindgen;
use web_sys::{FileSystemReadWriteOptions, FileSystemSyncAccessHandle};

use crate::{failure, to_js};

/// How much of the file one call into the browser fetches for a small read.
/// A call costs about 0.4 ms whatever its size (measured in Prompt 37), and a
/// clip's audio frames lie a few kilobytes apart between its video frames:
/// read one at a time, 75 seconds of audio spent 1.3 s in 3,493 calls.
const WINDOW_BYTES: usize = 1 << 20;

/// A file in OPFS, read where the demuxer asks, through one window of bytes
/// read ahead. The file must not change while this is open.
struct JsRandomAccess {
    handle: FileSystemSyncAccessHandle,
    len: Bytes,
    /// The bytes of the file from `window_at` on.
    window: Vec<u8>,
    window_at: u64,
}

impl JsRandomAccess {
    fn new(handle: FileSystemSyncAccessHandle, len: Bytes) -> Self {
        Self {
            handle,
            len,
            window: Vec::new(),
            window_at: 0,
        }
    }

    /// One read from the file. Fewer bytes than asked for is a failure: the
    /// file ends before the box said it would.
    fn read_exact(
        handle: &FileSystemSyncAccessHandle,
        at: u64,
        buf: &mut [u8],
    ) -> Result<(), IoError> {
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

    /// The part of the window that holds `len` bytes from `at`, if it holds them all.
    fn in_window(&self, at: u64, len: usize) -> Option<&[u8]> {
        let start = usize::try_from(at.checked_sub(self.window_at)?).ok()?;
        self.window.get(start..start.checked_add(len)?)
    }
}

impl RandomAccess for JsRandomAccess {
    fn len(&self) -> Bytes {
        self.len
    }

    fn read_at(&mut self, offset: Bytes, buf: &mut [u8]) -> Result<(), IoError> {
        if buf.is_empty() {
            return Ok(());
        }
        let at = offset.get();
        // A read as large as the window gains nothing from it.
        if buf.len() >= WINDOW_BYTES {
            return Self::read_exact(&self.handle, at, buf);
        }
        if self.in_window(at, buf.len()).is_none() {
            // The window moves to start at this read. It ends with the file,
            // but is never shorter than the read, so that a read past the end
            // fails as it would without a window.
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

/// `{ ok: ClipInfo }`, the accepting half of `probe_and_validate`.
#[derive(Serialize)]
struct Accepted {
    ok: ClipInfo,
}

/// `{ rejected: RejectReason }` (TS §11.3: a rejection is a value).
#[derive(Serialize)]
struct Rejected {
    rejected: RejectReason,
}

/// What a file that does not open becomes (v2implementation §6.1).
#[derive(Debug, PartialEq, Eq)]
enum OpenFailure {
    Rejected(RejectReason),
    Failed(ErrorCode, &'static str),
}

fn classify(error: ContainerError) -> OpenFailure {
    match error {
        ContainerError::NotIsoBmff | ContainerError::Fragmented => {
            OpenFailure::Rejected(RejectReason::Container)
        }
        ContainerError::Truncated
        | ContainerError::Malformed(_)
        | ContainerError::Unsupported(_) => OpenFailure::Rejected(RejectReason::Corrupt),
        ContainerError::Io(io) => OpenFailure::Failed(ErrorCode::StorageIo, io_name(io)),
    }
}

/// The variant's name: the `detail` of a failure.
fn container_name(error: ContainerError) -> &'static str {
    match error {
        ContainerError::NotIsoBmff => "NotIsoBmff",
        ContainerError::Fragmented => "Fragmented",
        ContainerError::Truncated => "Truncated",
        ContainerError::Malformed(_) => "Malformed",
        ContainerError::Unsupported(_) => "Unsupported",
        ContainerError::Io(io) => io_name(io),
    }
}

fn io_name(error: IoError) -> &'static str {
    match error {
        IoError::Read => "Read",
        IoError::Write => "Write",
        IoError::OutOfBounds => "OutOfBounds",
    }
}

#[wasm_bindgen]
pub struct DemuxerHandle {
    demuxer: Demuxer<JsRandomAccess>,
    /// The bytes of the last sample read, kept so that each read does not allocate.
    sample: Vec<u8>,
}

/// Throws `{ rejected }` for a file that is not an MP4 or MOV this version
/// reads, and `{ code, detail }` when the file itself cannot be read.
#[wasm_bindgen]
pub fn open_demuxer(handle: FileSystemSyncAccessHandle) -> Result<DemuxerHandle, JsValue> {
    let size = handle
        .get_size()
        .map_err(|_| failure(ErrorCode::StorageIo, io_name(IoError::Read)))?;
    let reader = JsRandomAccess::new(handle, Bytes::new(size as u64));
    match Demuxer::open(reader) {
        Ok(demuxer) => Ok(DemuxerHandle {
            demuxer,
            sample: Vec::new(),
        }),
        Err(error) => Err(match classify(error) {
            OpenFailure::Rejected(rejected) => to_js(&Rejected { rejected })?,
            OpenFailure::Failed(code, detail) => failure(code, detail),
        }),
    }
}

/// `{ ok: ClipInfo }` or `{ rejected: RejectReason }`.
#[wasm_bindgen]
pub fn probe_and_validate(
    d: &DemuxerHandle,
    file_size: f64,
    decode_supported: bool,
) -> Result<JsValue, JsValue> {
    let info = probe(&d.demuxer, Bytes::new(file_size as u64));
    match validate_probe(&info, decode_supported) {
        Ok(ok) => to_js(&Accepted { ok }),
        Err(rejected) => to_js(&Rejected { rejected }),
    }
}

#[wasm_bindgen]
pub fn resample(input: &[f32], from_hz: u32, to_hz: u32) -> Vec<f32> {
    resample_mono(input, Hz::new(from_hz), Hz::new(to_hz))
}

#[wasm_bindgen]
impl DemuxerHandle {
    /// The `ProbeInfo`, for the decoder question that comes before validation.
    pub fn probe(&self, file_size: f64) -> Result<JsValue, JsValue> {
        to_js(&probe(&self.demuxer, Bytes::new(file_size as u64)))
    }

    /// The raw `avcC` payload.
    pub fn video_description(&self) -> Option<Vec<u8>> {
        self.demuxer.video_decoder_description().map(<[u8]>::to_vec)
    }

    /// The `AudioSpecificConfig`.
    pub fn audio_description(&self) -> Option<Vec<u8>> {
        self.demuxer.audio_decoder_description().map(<[u8]>::to_vec)
    }

    pub fn audio_sample_count(&self) -> u32 {
        self.demuxer.audio_sample_count()
    }

    /// `{ data: Uint8Array, ptsUs: number, durationUs: number }`. The clip was
    /// accepted before this is called, so a failure is an error, never a rejection.
    pub fn read_audio_sample(&mut self, index: u32) -> Result<JsValue, JsValue> {
        let meta = self
            .demuxer
            .read_audio_sample(index, &mut self.sample)
            .map_err(|error| failure(ErrorCode::DecodeAudio, container_name(error)))?;
        let fields = [
            (
                "data",
                JsValue::from(Uint8Array::from(self.sample.as_slice())),
            ),
            ("ptsUs", JsValue::from_f64(meta.pts.get() as f64)),
            ("durationUs", JsValue::from_f64(meta.duration.get() as f64)),
        ];
        let sample = Object::new();
        for (name, value) in fields {
            Reflect::set(&sample, &JsValue::from_str(name), &value)
                .map_err(|_| failure(ErrorCode::Internal, "Serialize"))?;
        }
        Ok(sample.into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_file_that_does_not_open_is_a_rejection_unless_the_bytes_cannot_be_read() {
        let container = OpenFailure::Rejected(RejectReason::Container);
        let corrupt = OpenFailure::Rejected(RejectReason::Corrupt);
        assert_eq!(classify(ContainerError::NotIsoBmff), container);
        assert_eq!(classify(ContainerError::Fragmented), container);
        assert_eq!(classify(ContainerError::Truncated), corrupt);
        assert_eq!(classify(ContainerError::Malformed("stts")), corrupt);
        assert_eq!(classify(ContainerError::Unsupported("elst")), corrupt);
        let io = classify(ContainerError::Io(IoError::Read));
        assert_eq!(io, OpenFailure::Failed(ErrorCode::StorageIo, "Read"));

        // A detail is the name of the variant and nothing of what it carries.
        assert_eq!(
            container_name(ContainerError::Malformed("stts")),
            "Malformed"
        );
        assert_eq!(
            container_name(ContainerError::Io(IoError::OutOfBounds)),
            "OutOfBounds"
        );
    }
}
