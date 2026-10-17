//! Animato's graphics: from a graphics document and a transcript to what
//! each output frame draws over and under the video (plan 8.1, 8.4).
//!
//! A scene is built once per document change; `frame_at` is then a pure
//! function of the scene and a time. Nothing here touches a GPU, a pixel or a
//! decoder, or reads a clock. Descends from `offcut-scene` (display list,
//! parley layout, fonts, easing, caption chunking); Animato's inputs replace
//! Offcut's.

pub mod captions;
pub mod display_list;
pub mod doc;
pub mod easing;
pub mod fonts;
mod items;
pub mod layout;
pub mod safe_area;
pub mod text;

use serde::Serialize;
use thiserror::Error;

pub use crate::display_list::{
    Affine, Cap, DisplayList, DrawCmd, FontId, Join, Paint, PathEl, Point, PositionedGlyph, Rect,
    Rgba, Stop, Stroke,
};
use crate::doc::Layer;
pub use crate::doc::{GraphicsDoc, Transcript};
use crate::items::Prepared;

#[derive(Clone, Debug, PartialEq, Eq, Error)]
pub enum SceneError {
    #[error("no font is registered for the text")]
    Font,
    #[error("text could not be laid out")]
    Layout,
    #[error("the graphics document is not valid: {0}")]
    Document(String),
}

/// What one frame draws: `under` before the video layers, `over` after them.
#[derive(Clone, Debug, Default, PartialEq, Serialize)]
pub struct FrameGraphics {
    pub under: DisplayList,
    pub over: DisplayList,
}

/// A document laid out for one canvas size.
#[derive(Clone, Debug, PartialEq)]
pub struct Scene {
    /// Output pixels per design pixel: the canvas's short side over 1080.
    scale: f32,
    items: Vec<(Layer, Prepared)>,
}

/// Reads a document from JSON.
pub fn parse_doc(json: &str) -> Result<GraphicsDoc, SceneError> {
    serde_json::from_str(json).map_err(|e| SceneError::Document(e.to_string()))
}

/// Reads a transcript from JSON (`null` reads as none).
pub fn parse_transcript(json: &str) -> Result<Option<Transcript>, SceneError> {
    serde_json::from_str(json).map_err(|e| SceneError::Document(e.to_string()))
}

pub fn build_scene(
    doc: &GraphicsDoc,
    transcript: Option<&Transcript>,
) -> Result<Scene, SceneError> {
    let (w, h) = (
        doc.canvas.width.max(1) as f32,
        doc.canvas.height.max(1) as f32,
    );
    let scale = w.min(h) / 1080.0;
    let ctx = items::Context {
        canvas: (w / scale, h / scale),
        safe: safe_area::safe_area(w / scale, h / scale),
        duration: doc.duration,
        images: &doc.images,
        transcript,
    };
    let mut prepared = Vec::with_capacity(doc.items.len());
    for item in &doc.items {
        if let Some(p) = items::prepare(item, &ctx)? {
            prepared.push(p);
        }
    }
    Ok(Scene {
        scale,
        items: prepared,
    })
}

impl Scene {
    /// What is drawn at `t` seconds, in pixels of the output canvas.
    pub fn frame_at(&self, t: f64) -> FrameGraphics {
        let mut under = Vec::new();
        let mut over = Vec::new();
        for (layer, item) in &self.items {
            let out = match layer {
                Layer::Under => &mut under,
                Layer::Over => &mut over,
            };
            item.draw(t, out);
        }
        for cmd in under.iter_mut().chain(over.iter_mut()) {
            cmd.scale(self.scale);
        }
        FrameGraphics {
            under: DisplayList { cmds: under },
            over: DisplayList { cmds: over },
        }
    }
}

#[cfg(test)]
pub(crate) mod testing;

#[cfg(test)]
mod tests;
