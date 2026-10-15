//! What one frame draws, as a list any backend can read (TS §19.2, D-29).
//! Every length is in pixels of the output canvas.

use serde::Serialize;

#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
pub struct Rect {
    pub x: f32,
    pub y: f32,
    pub w: f32,
    pub h: f32,
}

/// Straight alpha.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
pub struct Rgba {
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub a: u8,
}

#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
pub enum PathEl {
    MoveTo(f32, f32),
    LineTo(f32, f32),
    QuadTo(f32, f32, f32, f32),
    CurveTo(f32, f32, f32, f32, f32, f32),
    Close,
}

/// A glyph of a run. `x` and `y` are the glyph's origin on the baseline, in
/// the run's own space: the run's `transform` puts them on the canvas.
#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
pub struct PositionedGlyph {
    pub id: u32,
    pub x: f32,
    pub y: f32,
}

/// The outline of a glyph run. `width` is the whole width of the stroke, half
/// of it on each side of the glyph's edge.
#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
pub struct Stroke {
    pub width: f32,
    pub color: Rgba,
}

/// `a b c d e f`, column-major 2x3: a point `(x, y)` goes to
/// `(a*x + c*y + e, b*x + d*y + f)`.
#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
pub struct Affine {
    pub m: [f32; 6],
}

/// A font file at one weight. Closed, and the order is part of the snapshots
/// of V4: a member is never moved or removed.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize)]
pub enum FontId {
    Inter700,
    Inter900,
    JetBrainsMono700,
    NotoEmoji,
}

/// The Canvas2D seam: a backend that cannot draw glyphs by id draws `text`.
#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct DisplayList {
    pub cmds: Vec<DrawCmd>,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub enum DrawCmd {
    FillRect {
        rect: Rect,
        radius: f32,
        color: Rgba,
    },
    FillPath {
        path: Vec<PathEl>,
        color: Rgba,
    },
    /// Stroked first, then filled over the stroke (D-68): the half of the
    /// stroke that lies outside each glyph is what shows. `text` is kept for
    /// the Canvas2D seam.
    GlyphRun {
        font: FontId,
        size: f32,
        glyphs: Vec<PositionedGlyph>,
        fill: Rgba,
        stroke: Option<Stroke>,
        transform: Affine,
        text: String,
    },
    PushLayer {
        opacity: f32,
        clip: Option<Rect>,
    },
    PopLayer,
}

impl Affine {
    pub const IDENTITY: Affine = Affine {
        m: [1.0, 0.0, 0.0, 1.0, 0.0, 0.0],
    };

    /// A uniform scale by `k`, then a move by `(x, y)`.
    pub fn scale_then_translate(k: f32, x: f32, y: f32) -> Affine {
        Affine {
            m: [k, 0.0, 0.0, k, x, y],
        }
    }

    pub fn apply(&self, x: f32, y: f32) -> (f32, f32) {
        let [a, b, c, d, e, f] = self.m;
        (a * x + c * y + e, b * x + d * y + f)
    }
}

impl Rect {
    fn scaled(self, k: f32) -> Rect {
        Rect {
            x: self.x * k,
            y: self.y * k,
            w: self.w * k,
            h: self.h * k,
        }
    }
}

impl PathEl {
    fn scaled(self, k: f32) -> PathEl {
        match self {
            PathEl::MoveTo(x, y) => PathEl::MoveTo(x * k, y * k),
            PathEl::LineTo(x, y) => PathEl::LineTo(x * k, y * k),
            PathEl::QuadTo(a, b, x, y) => PathEl::QuadTo(a * k, b * k, x * k, y * k),
            PathEl::CurveTo(a, b, c, d, x, y) => {
                PathEl::CurveTo(a * k, b * k, c * k, d * k, x * k, y * k)
            }
            PathEl::Close => PathEl::Close,
        }
    }
}

impl DrawCmd {
    /// The command on a canvas `k` times the size: every length is multiplied,
    /// the translation of a transform too. An opacity, and the scale and
    /// rotation of a transform, are not lengths and stay.
    pub(crate) fn scale(&mut self, k: f32) {
        match self {
            DrawCmd::FillRect { rect, radius, .. } => {
                *rect = rect.scaled(k);
                *radius *= k;
            }
            DrawCmd::FillPath { path, .. } => {
                for el in path {
                    *el = el.scaled(k);
                }
            }
            DrawCmd::GlyphRun {
                size,
                glyphs,
                stroke,
                transform,
                ..
            } => {
                *size *= k;
                for glyph in glyphs {
                    glyph.x *= k;
                    glyph.y *= k;
                }
                if let Some(stroke) = stroke {
                    stroke.width *= k;
                }
                let [a, b, c, d, e, f] = transform.m;
                transform.m = [a, b, c, d, e * k, f * k];
            }
            DrawCmd::PushLayer { clip, .. } => {
                *clip = clip.map(|rect| rect.scaled(k));
            }
            DrawCmd::PopLayer => {}
        }
    }
}
