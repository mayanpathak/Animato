//! What one frame draws, as a list any backend can read: Vello
//! (`animato-overlay`) or the Canvas2D fallback (`drawDisplayList` in TS).
//! Every length is in pixels of the output canvas. Variants are only ever
//! appended (plan 8.5), so stored snapshots keep their meaning.

use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
pub struct Rect {
    pub x: f32,
    pub y: f32,
    pub w: f32,
    pub h: f32,
}

/// Straight alpha. In JSON a CSS hex string (`doc.rs`).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub struct Rgba {
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub a: u8,
}

impl Rgba {
    pub const TRANSPARENT: Rgba = Rgba {
        r: 0,
        g: 0,
        b: 0,
        a: 0,
    };

    /// The colour with its alpha multiplied by `k` (0..=1).
    pub fn faded(self, k: f32) -> Rgba {
        let a = (f32::from(self.a) * k.clamp(0.0, 1.0)).round() as u8;
        Rgba { a, ..self }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
pub struct Point {
    pub x: f32,
    pub y: f32,
}

#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
pub struct Stop {
    pub offset: f32,
    pub color: Rgba,
}

/// How an area is filled.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Paint {
    Solid(Rgba),
    Linear {
        from: Point,
        to: Point,
        stops: Vec<Stop>,
    },
    Radial {
        center: Point,
        radius: f32,
        stops: Vec<Stop>,
    },
}

impl Paint {
    /// The paint with every colour's alpha multiplied by `k`.
    pub fn faded(&self, k: f32) -> Paint {
        let stops = |stops: &[Stop]| {
            stops
                .iter()
                .map(|s| Stop {
                    offset: s.offset,
                    color: s.color.faded(k),
                })
                .collect()
        };
        match self {
            Paint::Solid(c) => Paint::Solid(c.faded(k)),
            Paint::Linear { from, to, stops: s } => Paint::Linear {
                from: *from,
                to: *to,
                stops: stops(s),
            },
            Paint::Radial {
                center,
                radius,
                stops: s,
            } => Paint::Radial {
                center: *center,
                radius: *radius,
                stops: stops(s),
            },
        }
    }

    fn scale(&mut self, k: f32) {
        match self {
            Paint::Solid(_) => {}
            Paint::Linear { from, to, .. } => {
                *from = from.scaled(k);
                *to = to.scaled(k);
            }
            Paint::Radial { center, radius, .. } => {
                *center = center.scaled(k);
                *radius *= k;
            }
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
pub enum PathEl {
    MoveTo(f32, f32),
    LineTo(f32, f32),
    QuadTo(f32, f32, f32, f32),
    CurveTo(f32, f32, f32, f32, f32, f32),
    Close,
}

/// A glyph of a run. `x` and `y` are the glyph's origin on the baseline, in
/// the run's own space: the run's `transform` puts them on the canvas.
#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
pub struct PositionedGlyph {
    pub id: u32,
    pub x: f32,
    pub y: f32,
}

/// The outline of a glyph run. `width` is the whole width of the stroke, half
/// of it on each side of the glyph's edge.
#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
pub struct Stroke {
    pub width: f32,
    pub color: Rgba,
}

/// `a b c d e f`, column-major 2x3: a point `(x, y)` goes to
/// `(a*x + c*y + e, b*x + d*y + f)`.
#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
pub struct Affine {
    pub m: [f32; 6],
}

/// A registered font file (`fonts::register`) at one weight. Glyph ids and
/// positions of a run hold for this weight of this file.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct FontId {
    pub face: u16,
    pub weight: u16,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Join {
    Miter,
    Round,
    Bevel,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Cap {
    Butt,
    Round,
    Square,
}

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
pub struct DisplayList {
    pub cmds: Vec<DrawCmd>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "cmd", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum DrawCmd {
    FillRect {
        rect: Rect,
        radius: f32,
        paint: Paint,
    },
    FillPath {
        path: Vec<PathEl>,
        paint: Paint,
    },
    /// Stroked first, then filled over the stroke: the half of the stroke
    /// that lies outside each glyph is what shows. `text` is what the
    /// Canvas2D fallback draws, with `family` and `weight`.
    GlyphRun {
        font: FontId,
        family: String,
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
    StrokePath {
        path: Vec<PathEl>,
        width: f32,
        paint: Paint,
        join: Join,
        cap: Cap,
    },
    /// An image registered by id, drawn into `rect` (already fitted).
    Image {
        image_id: String,
        rect: Rect,
        opacity: f32,
    },
    /// A soft shadow: a rounded rectangle blurred by `std_dev`.
    BlurredRoundedRect {
        rect: Rect,
        radius: f32,
        std_dev: f32,
        color: Rgba,
    },
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

impl Point {
    fn scaled(self, k: f32) -> Point {
        Point {
            x: self.x * k,
            y: self.y * k,
        }
    }
}

impl Rect {
    pub fn scaled(self, k: f32) -> Rect {
        Rect {
            x: self.x * k,
            y: self.y * k,
            w: self.w * k,
            h: self.h * k,
        }
    }

    pub fn right(&self) -> f32 {
        self.x + self.w
    }

    pub fn bottom(&self) -> f32 {
        self.y + self.h
    }

    /// The part of `self` inside `outer`.
    pub fn clamped(self, outer: Rect) -> Rect {
        let x = self.x.clamp(outer.x, outer.right());
        let y = self.y.clamp(outer.y, outer.bottom());
        Rect {
            x,
            y,
            w: (self.right().min(outer.right()) - x).max(0.0),
            h: (self.bottom().min(outer.bottom()) - y).max(0.0),
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
    pub fn scale(&mut self, k: f32) {
        match self {
            DrawCmd::FillRect {
                rect,
                radius,
                paint,
            } => {
                *rect = rect.scaled(k);
                *radius *= k;
                paint.scale(k);
            }
            DrawCmd::FillPath { path, paint } => {
                for el in path.iter_mut() {
                    *el = el.scaled(k);
                }
                paint.scale(k);
            }
            DrawCmd::StrokePath {
                path, width, paint, ..
            } => {
                for el in path.iter_mut() {
                    *el = el.scaled(k);
                }
                *width *= k;
                paint.scale(k);
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
            DrawCmd::PushLayer { clip, .. } => *clip = clip.map(|rect| rect.scaled(k)),
            DrawCmd::PopLayer => {}
            DrawCmd::Image { rect, .. } => *rect = rect.scaled(k),
            DrawCmd::BlurredRoundedRect {
                rect,
                radius,
                std_dev,
                ..
            } => {
                *rect = rect.scaled(k);
                *radius *= k;
                *std_dev *= k;
            }
        }
    }
}
