//! GPU video compositor using wgpu.
//!
//! Draws video and image layers, shapes and lines with transforms, effects,
//! colour grading and transitions, on a device it is given. Text and 2D
//! graphics are Vello's (`animato-overlay`); the compositor draws Vello's
//! overlay textures under and over the layers.

mod color_grading_uniforms;
mod compositor;
mod error;
mod overlay;
mod pipeline;
mod shape_pipeline;
mod texture;
mod uniforms;

pub use color_grading_uniforms::ColorGradingUniforms;
pub use compositor::{Compositor, Overlays, TARGET_FORMAT};
pub use error::CompositorError;

pub use tooscut_types::*;
