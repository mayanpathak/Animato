//! Draws `animato-graphics` display lists with Vello into textures on a
//! device shared with the video compositor (plan 8.1, 8.3).

mod overlay;

pub use overlay::{Images, OVERLAY_FORMAT, Overlay};

#[derive(Clone, Copy, Debug, PartialEq, Eq, thiserror::Error)]
pub enum RenderError {
    #[error("the overlay could not be drawn")]
    Overlay,
    #[error("a font of the display list is not registered")]
    Font,
    #[error("the image is not RGBA of its size")]
    Image,
}
