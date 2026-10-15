//! One clip being drawn: its source file, its scene and the renderer
//! (TS §19.6). The session reads video samples for the decoder, builds the
//! scene and draws frames. It closes no `VideoFrame`: the caller does.

use std::collections::BTreeMap;

use js_sys::{Object, Reflect, Uint8Array};
use offcut_mp4::demux::Demuxer;
use offcut_mp4::reader::RandomAccess;
use offcut_mp4::{ContainerError, IoError};
// The scene crate, through the renderer: this crate does not depend on it (D-61).
use offcut_render::scene::{Scene, SceneError, SceneInput, build_scene};
use offcut_render::{RenderError, Renderer};
use offcut_types::{
    Bytes, ClipInfo, CropOffset, DetectedEvent, EditState, ErrorCode, EventId, ExportProfile, Px,
    StyleId, TimeMs, Transcript,
};
use serde::Deserialize;
use wasm_bindgen::JsValue;
use wasm_bindgen::prelude::wasm_bindgen;
use web_sys::{
    FileSystemReadWriteOptions, FileSystemSyncAccessHandle, OffscreenCanvas, VideoFrame,
};

use crate::{failure, from_js, to_plain, word_edits};

/// How much of the file one call into the browser fetches for a small read.
/// A call costs about 0.4 ms whatever its size (measured in Prompt 37), and a
/// clip's video frames after a keyframe are a few kilobytes each.
const WINDOW_BYTES: usize = 1 << 20;

/// A file in OPFS, read where the demuxer asks, through one window of bytes
/// read ahead. The file must not change while this is open. The core bundle
/// has its own: the two bundles share no binding code (D-30).
pub struct JsRandomAccess {
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

/// The variant's name: the `detail` of a failure.
fn container_name(error: ContainerError) -> &'static str {
    match error {
        ContainerError::NotIsoBmff => "NotIsoBmff",
        ContainerError::Fragmented => "Fragmented",
        ContainerError::Truncated => "Truncated",
        ContainerError::Malformed(_) => "Malformed",
        ContainerError::Unsupported(_) => "Unsupported",
        ContainerError::Io(IoError::Read) => "Read",
        ContainerError::Io(IoError::Write) => "Write",
        ContainerError::Io(IoError::OutOfBounds) => "OutOfBounds",
    }
}

/// What a failure of the renderer is to the app (v2implementation §12).
fn render_failure(error: RenderError) -> (ErrorCode, &'static str) {
    match error {
        RenderError::NoAdapter => (ErrorCode::GpuInit, "NoAdapter"),
        RenderError::DeviceRequest => (ErrorCode::GpuInit, "DeviceRequest"),
        RenderError::Surface => (ErrorCode::GpuInit, "Surface"),
        RenderError::DeviceLost => (ErrorCode::GpuLost, "DeviceLost"),
        RenderError::FrameImport => (ErrorCode::Internal, "FrameImport"),
        RenderError::Overlay => (ErrorCode::Internal, "Overlay"),
    }
}

fn scene_error_name(error: SceneError) -> &'static str {
    match error {
        SceneError::Font => "Font",
        SceneError::Layout => "Layout",
    }
}

fn render_error(error: RenderError) -> JsValue {
    let (code, detail) = render_failure(error);
    failure(code, detail)
}

/// The user's choices as JavaScript holds them: the keys of `word_edits` are
/// strings there.
#[derive(Deserialize)]
struct EditInput {
    word_edits: BTreeMap<String, String>,
    event_overrides: BTreeMap<EventId, bool>,
    style: StyleId,
    crop_offset: CropOffset,
}

/// A `SceneInput` by value: everything but the clip, which the session has.
#[derive(Deserialize)]
struct SceneInputValue {
    transcript: Transcript,
    events: Vec<DetectedEvent>,
    edit: EditInput,
    profile: ExportProfile,
}

#[wasm_bindgen]
pub struct RenderSession {
    clip: ClipInfo,
    demuxer: Demuxer<JsRandomAccess>,
    /// The bytes of the last sample read, kept so that each read does not allocate.
    sample: Vec<u8>,
    scene: Option<Scene>,
    renderer: Option<Renderer>,
}

impl RenderSession {
    /// Opens the demuxer on the source. No GPU work yet. The clip was
    /// accepted before a session is opened, so a file that does not open is
    /// a failure, never a rejection.
    pub async fn open(clip: ClipInfo, source: JsRandomAccess) -> Result<RenderSession, JsValue> {
        let demuxer = Demuxer::open(source).map_err(|error| {
            let code = match error {
                ContainerError::Io(_) => ErrorCode::StorageIo,
                ContainerError::NotIsoBmff
                | ContainerError::Fragmented
                | ContainerError::Truncated
                | ContainerError::Malformed(_)
                | ContainerError::Unsupported(_) => ErrorCode::Internal,
            };
            failure(code, container_name(error))
        })?;
        Ok(RenderSession {
            clip,
            demuxer,
            sample: Vec::new(),
            scene: None,
            renderer: None,
        })
    }
}

/// A session on the clip `clip` (a `ClipInfo`), whose file is open on
/// `source`. JavaScript cannot pass the two Rust types `RenderSession::open`
/// takes, so this reads them and calls it.
#[wasm_bindgen]
pub async fn open_session(
    clip: JsValue,
    source: FileSystemSyncAccessHandle,
) -> Result<RenderSession, JsValue> {
    let clip: ClipInfo = from_js(clip, "ClipInfo")?;
    let size = source
        .get_size()
        .map_err(|_| failure(ErrorCode::StorageIo, "Read"))?;
    RenderSession::open(clip, JsRandomAccess::new(source, Bytes::new(size as u64))).await
}

#[wasm_bindgen]
impl RenderSession {
    /// `input` is `{ transcript, events, edit, profile }`; the clip is the
    /// one the session was opened with. Builds the scene and keeps it in
    /// place of the one before. The renderer is not touched.
    pub fn set_scene(&mut self, input: JsValue) -> Result<(), JsValue> {
        let input: SceneInputValue = from_js(input, "SceneInput")?;
        let word_edits = word_edits(input.edit.word_edits)
            .ok_or_else(|| failure(ErrorCode::Internal, "SceneInput"))?;
        let edit = EditState {
            word_edits,
            event_overrides: input.edit.event_overrides,
            style: input.edit.style,
            crop_offset: input.edit.crop_offset,
        };
        let scene = build_scene(SceneInput {
            transcript: &input.transcript,
            events: &input.events,
            edit: &edit,
            clip: &self.clip,
            profile: &input.profile,
        })
        .map_err(|error| failure(ErrorCode::Internal, scene_error_name(error)))?;
        self.scene = Some(scene);
        Ok(())
    }

    /// Draws to `canvas` from now on, at `width` by `height`. The first call
    /// makes the renderer; a later one gives it the new canvas, on the same
    /// device. JavaScript gets a promise.
    pub async fn attach_canvas(
        &mut self,
        canvas: OffscreenCanvas,
        width: u32,
        height: u32,
    ) -> Result<(), JsValue> {
        let (width, height) = (Px::new(width), Px::new(height));
        match self.renderer.as_mut() {
            Some(renderer) => renderer
                .set_canvas(canvas, width, height)
                .map_err(render_error),
            None => {
                let renderer = Renderer::new(canvas, width, height)
                    .await
                    .map_err(render_error)?;
                self.renderer = Some(renderer);
                Ok(())
            }
        }
    }

    /// Draws `frame` with what the scene shows at `t_ms` over it. The frame
    /// stays the caller's.
    pub fn render_frame(&mut self, frame: &VideoFrame, t_ms: u32) -> Result<(), JsValue> {
        let Some(scene) = self.scene.as_ref() else {
            return Err(failure(ErrorCode::Internal, "NoScene"));
        };
        let Some(renderer) = self.renderer.as_mut() else {
            return Err(failure(ErrorCode::Internal, "NoCanvas"));
        };
        let list = scene.frame_at(TimeMs::new(t_ms));
        renderer
            .render(frame, scene.crop(), self.clip.rotation, &list)
            .map_err(render_error)
    }

    /// The number of output frames of the scene; 0 before a scene is set.
    pub fn frame_count(&self) -> u32 {
        self.scene.as_ref().map_or(0, Scene::frame_count)
    }

    /// The `ChangeSummary` of the scene; `null` before a scene is set.
    pub fn summary(&self) -> JsValue {
        let summary = self.scene.as_ref().map(Scene::summary);
        // Three plain fields always serialize.
        summary
            .and_then(|summary| to_plain(&summary).ok())
            .unwrap_or(JsValue::NULL)
    }

    // The four calls a video decoder is fed through (D-30).

    /// The raw `avcC` payload.
    pub fn video_description(&self) -> Option<Vec<u8>> {
        self.demuxer.video_decoder_description().map(<[u8]>::to_vec)
    }

    /// Whether the clip's video says it is full-range. A decoder that reads
    /// it as limited-range must be told so (v2implementation D-70). `false`
    /// also when the stream does not say.
    pub fn video_full_range(&self) -> bool {
        self.demuxer
            .video_decoder_description()
            .and_then(offcut_mp4::sps::full_range)
            == Some(true)
    }

    pub fn video_sample_count(&self) -> u32 {
        self.demuxer.video_sample_count()
    }

    /// `{ data: Uint8Array, ptsUs: number, durationUs: number, isKeyframe: boolean }`.
    pub fn read_video_sample(&mut self, index: u32) -> Result<JsValue, JsValue> {
        let meta = self
            .demuxer
            .read_video_sample(index, &mut self.sample)
            .map_err(|error| failure(ErrorCode::DecodeVideo, container_name(error)))?;
        let fields = [
            (
                "data",
                JsValue::from(Uint8Array::from(self.sample.as_slice())),
            ),
            ("ptsUs", JsValue::from_f64(meta.pts.get() as f64)),
            ("durationUs", JsValue::from_f64(meta.duration.get() as f64)),
            ("isKeyframe", JsValue::from_bool(meta.is_keyframe)),
        ];
        let sample = Object::new();
        for (name, value) in fields {
            Reflect::set(&sample, &JsValue::from_str(name), &value)
                .map_err(|_| failure(ErrorCode::Internal, "Serialize"))?;
        }
        Ok(sample.into())
    }

    /// The number of the last keyframe at or before `t_ms`: where decoding
    /// starts to show that time.
    pub fn keyframe_at_or_before(&self, t_ms: u32) -> u32 {
        self.demuxer.keyframe_at_or_before(TimeMs::new(t_ms))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_failure_of_the_renderer_has_the_code_of_the_plan_and_its_own_name() {
        let cases = [
            (RenderError::NoAdapter, ErrorCode::GpuInit, "NoAdapter"),
            (
                RenderError::DeviceRequest,
                ErrorCode::GpuInit,
                "DeviceRequest",
            ),
            (RenderError::Surface, ErrorCode::GpuInit, "Surface"),
            (RenderError::DeviceLost, ErrorCode::GpuLost, "DeviceLost"),
            (RenderError::FrameImport, ErrorCode::Internal, "FrameImport"),
            (RenderError::Overlay, ErrorCode::Internal, "Overlay"),
        ];
        for (error, code, name) in cases {
            assert_eq!(render_failure(error), (code, name));
        }
        // A detail is the name of the variant and nothing of what it carries.
        assert_eq!(
            container_name(ContainerError::Malformed("stts")),
            "Malformed"
        );
        assert_eq!(container_name(ContainerError::Io(IoError::Read)), "Read");
        assert_eq!(scene_error_name(SceneError::Font), "Font");
        assert_eq!(scene_error_name(SceneError::Layout), "Layout");
    }
}
