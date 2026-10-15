//! The compositor: a source frame, turned and cropped, with a display list
//! drawn over it, on a canvas (TS §19). It draws what it is given. It does
//! not know what a scene means, it detects nothing, and it closes no
//! `VideoFrame`: the caller does (TS §19.6).

mod composite;
mod gpu;
mod vello_backend;
mod video_pass;

/// The scene crate, for the binding crate: it builds a scene and hands the
/// renderer its display lists, and depends on this crate only (D-61).
pub use offcut_scene as scene;

use offcut_scene::{CropRect, DisplayList};
use offcut_types::{Px, Rotation};
use thiserror::Error;

use crate::composite::Compositor;
use crate::gpu::Gpu;
use crate::vello_backend::Overlay;
use crate::video_pass::VideoPass;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Error)]
pub enum RenderError {
    #[error("no graphics adapter")]
    NoAdapter,
    #[error("the adapter gave no device")]
    DeviceRequest,
    #[error("the graphics device was lost")]
    DeviceLost,
    #[error("the canvas cannot be drawn to")]
    Surface,
    #[error("the video frame could not be read")]
    FrameImport,
    #[error("the overlay could not be drawn")]
    Overlay,
}

/// One device, and the textures of one output size. Textures are made when
/// the renderer is, and again only when a size changes (TS §31).
pub struct Renderer {
    gpu: Gpu,
    video: VideoPass,
    overlay: Overlay,
    compositor: Compositor,
}

impl Renderer {
    pub async fn new(
        canvas: web_sys::OffscreenCanvas,
        width: Px,
        height: Px,
    ) -> Result<Renderer, RenderError> {
        let gpu = Gpu::new(canvas, width.get(), height.get()).await?;
        let shader = video_pass::shader(&gpu.device);
        let video = VideoPass::new(&gpu.device, &shader, gpu.format());
        let overlay = Overlay::new(&gpu.device, width.get(), height.get())?;
        let compositor = Compositor::new(&gpu.device, &shader, gpu.format(), overlay.view());
        Ok(Renderer {
            gpu,
            video,
            overlay,
            compositor,
        })
    }

    /// The output is `width` by `height` from now on. The same size again
    /// allocates nothing.
    pub fn resize(&mut self, width: Px, height: Px) -> Result<(), RenderError> {
        let size = (width.get(), height.get());
        if size == self.gpu.size() {
            return Ok(());
        }
        self.gpu.resize(size.0, size.1)?;
        self.overlay.resize(&self.gpu.device, size.0, size.1);
        self.compositor
            .set_overlay(&self.gpu.device, self.overlay.view());
        Ok(())
    }

    /// Draws to another canvas, on the same device: the canvas of an export
    /// after the canvas of the preview. TS §19.2 has no such call, and the
    /// session of TS §19.2 attaches a canvas more than once.
    pub fn set_canvas(
        &mut self,
        canvas: web_sys::OffscreenCanvas,
        width: Px,
        height: Px,
    ) -> Result<(), RenderError> {
        let before = self.gpu.size();
        self.gpu.set_canvas(canvas, width.get(), height.get())?;
        if before != self.gpu.size() {
            self.overlay
                .resize(&self.gpu.device, width.get(), height.get());
            self.compositor
                .set_overlay(&self.gpu.device, self.overlay.view());
        }
        Ok(())
    }

    /// Draws `frame`, cropped to `crop` and turned by `rotation`, with `list`
    /// over it. The result is on the canvas. `crop` is in display pixels of
    /// the source (TS §19.7).
    pub fn render(
        &mut self,
        frame: &web_sys::VideoFrame,
        crop: CropRect,
        rotation: Rotation,
        list: &DisplayList,
    ) -> Result<(), RenderError> {
        if self.gpu.is_lost() {
            return Err(RenderError::DeviceLost);
        }
        self.video
            .load(&self.gpu.device, &self.gpu.queue, frame, crop, rotation)?;
        // A frame with nothing over it costs no overlay pass.
        let with_overlay = !list.cmds.is_empty();
        if with_overlay {
            self.overlay
                .render(&self.gpu.device, &self.gpu.queue, list)?;
        }
        self.compositor
            .present(&self.gpu, &self.video, with_overlay)
    }
}
