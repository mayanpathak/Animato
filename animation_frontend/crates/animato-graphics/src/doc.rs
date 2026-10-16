//! The graphics document (plan 8.4): everything Vello draws over and under
//! the video, as data. TS builds it (`buildGraphics`) and checks it with the
//! zod mirror in `src/features/editor/graphics/schema.ts`; JSON field names
//! are camelCase on both sides.
//!
//! Units: times in seconds; boxes and paint points as fractions of the
//! canvas (or of the item's box, for paint); every other length in design
//! pixels, where the canvas's short side is 1080.

use serde::de::Error as _;
use serde::{Deserialize, Deserializer, Serialize, Serializer};

use crate::display_list::{Paint, Rgba};

pub type Seconds = f64;

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphicsDoc {
    pub version: u32,
    pub canvas: Canvas,
    /// The length of the video: the end card and the progress bar read it.
    pub duration: Seconds,
    #[serde(default)]
    pub fonts: Vec<FontRef>,
    #[serde(default)]
    pub images: Vec<ImageRef>,
    pub items: Vec<GraphicItem>,
}

#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
pub struct Canvas {
    pub width: u32,
    pub height: u32,
}

/// A font the document uses: the family it is asked for by, and where the
/// app loads the file from (`builtin:<file>` or `opfs:<asset id>`).
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct FontRef {
    pub family: String,
    pub source: String,
}

/// An image registered with the renderer by `id` (logos), and its size.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct ImageRef {
    pub id: String,
    pub width: u32,
    pub height: u32,
}

/// Fractions of the canvas: 0,0 is the top-left corner, 1,1 the bottom-right.
#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
pub struct Box {
    pub x: f32,
    pub y: f32,
    pub w: f32,
    pub h: f32,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Layer {
    Under,
    #[default]
    Over,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Align {
    Left,
    #[default]
    Center,
    Right,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Case {
    #[default]
    AsIs,
    Upper,
}

#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
pub struct StrokeSpec {
    pub width: f32,
    pub color: Rgba,
}

#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShadowSpec {
    pub color: Rgba,
    pub blur: f32,
    #[serde(default)]
    pub offset_y: f32,
}

fn default_weight() -> u16 {
    700
}

fn default_line_height() -> f32 {
    1.15
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextStyle {
    pub font: String,
    pub size: f32,
    #[serde(default = "default_weight")]
    pub weight: u16,
    pub color: Rgba,
    #[serde(default)]
    pub align: Align,
    #[serde(default = "default_line_height")]
    pub line_height: f32,
    #[serde(default)]
    pub background: Option<Rgba>,
    #[serde(default)]
    pub stroke: Option<StrokeSpec>,
    #[serde(default)]
    pub case: Case,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptionStyle {
    pub font: String,
    pub size: f32,
    #[serde(default = "default_weight")]
    pub weight: u16,
    pub color: Rgba,
    /// The word being spoken, when `highlight` is `word`.
    #[serde(default)]
    pub active_color: Option<Rgba>,
    #[serde(default)]
    pub background: Option<Rgba>,
    #[serde(default)]
    pub stroke: Option<StrokeSpec>,
    #[serde(default)]
    pub case: Case,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum MotionKind {
    #[default]
    None,
    Fade,
    Rise,
    Pop,
    Typewriter,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum EasingId {
    Linear,
    #[default]
    EaseOut,
    EaseInOut,
    BackOut,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Serialize, Deserialize)]
pub struct Motion {
    pub kind: MotionKind,
    pub duration: Seconds,
    #[serde(default)]
    pub easing: EasingId,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ShapeKind {
    Rect,
    RoundRect,
    Ellipse,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Fit {
    #[default]
    Contain,
    Cover,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Highlight {
    Word,
    #[default]
    None,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub enum Corner {
    #[default]
    #[serde(rename = "br")]
    BottomRight,
    #[serde(rename = "bl")]
    BottomLeft,
    #[serde(rename = "tr")]
    TopRight,
    #[serde(rename = "tl")]
    TopLeft,
}

fn one() -> f32 {
    1.0
}

fn white() -> Rgba {
    Rgba {
        r: 255,
        g: 255,
        b: 255,
        a: 255,
    }
}

fn inter() -> String {
    "Inter".to_owned()
}

fn max_lines() -> u32 {
    2
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum GraphicItem {
    Title {
        id: String,
        start: Seconds,
        end: Seconds,
        text: String,
        style: TextStyle,
        #[serde(rename = "box")]
        area: Box,
        #[serde(default)]
        enter: Motion,
        #[serde(default)]
        exit: Motion,
        #[serde(default)]
        layer: Layer,
    },
    /// Reads the transcript passed next to the document.
    Captions {
        id: String,
        style: CaptionStyle,
        #[serde(rename = "box")]
        area: Box,
        max_words: u32,
        #[serde(default = "max_lines")]
        max_lines: u32,
        #[serde(default)]
        highlight: Highlight,
        #[serde(default)]
        layer: Layer,
    },
    Shape {
        id: String,
        start: Seconds,
        end: Seconds,
        shape: ShapeKind,
        #[serde(rename = "box")]
        area: Box,
        #[serde(default)]
        radius: f32,
        /// Points of a gradient are fractions of the box.
        fill: Paint,
        #[serde(default)]
        stroke: Option<StrokeSpec>,
        #[serde(default)]
        shadow: Option<ShadowSpec>,
        #[serde(default)]
        enter: Motion,
        #[serde(default)]
        exit: Motion,
        layer: Layer,
    },
    Image {
        id: String,
        start: Seconds,
        end: Seconds,
        image_id: String,
        #[serde(rename = "box")]
        area: Box,
        #[serde(default)]
        fit: Fit,
        #[serde(default = "one")]
        opacity: f32,
        layer: Layer,
    },
    Progress {
        id: String,
        #[serde(rename = "box")]
        area: Box,
        color: Rgba,
        track: Rgba,
        #[serde(default)]
        layer: Layer,
    },
    /// The last `duration` seconds of the video.
    EndCard {
        id: String,
        duration: Seconds,
        headline: String,
        sub: String,
        #[serde(default)]
        logo: bool,
        background: Paint,
        #[serde(default = "inter")]
        font: String,
        #[serde(default = "white")]
        color: Rgba,
        #[serde(default)]
        layer: Layer,
    },
    Watermark {
        id: String,
        #[serde(default)]
        corner: Corner,
        text: String,
        #[serde(default)]
        layer: Layer,
    },
}

/// The voice transcript (plan 9.2), as the scene reads it: words in seconds.
/// A line of captions ends after a word marked `breakAfter`.
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
pub struct Transcript {
    pub words: Vec<Word>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Word {
    pub text: String,
    pub start: Seconds,
    pub end: Seconds,
    #[serde(default)]
    pub break_after: bool,
}

// Colours are `#rrggbb` or `#rrggbbaa` in JSON, as CSS writes them.
impl Serialize for Rgba {
    fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        let Rgba { r, g, b, a } = *self;
        if a == 255 {
            s.serialize_str(&format!("#{r:02x}{g:02x}{b:02x}"))
        } else {
            s.serialize_str(&format!("#{r:02x}{g:02x}{b:02x}{a:02x}"))
        }
    }
}

impl<'de> Deserialize<'de> for Rgba {
    fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Rgba, D::Error> {
        let text = String::deserialize(d)?;
        parse_hex(&text).ok_or_else(|| D::Error::custom(format!("not a colour: {text:?}")))
    }
}

/// `#rgb`, `#rrggbb` or `#rrggbbaa`.
pub fn parse_hex(text: &str) -> Option<Rgba> {
    let hex = text.strip_prefix('#')?;
    let byte = |i: usize| u8::from_str_radix(hex.get(i..i + 2)?, 16).ok();
    match hex.len() {
        3 => {
            let n = |i: usize| u8::from_str_radix(hex.get(i..=i)?, 16).ok().map(|v| v * 17);
            Some(Rgba {
                r: n(0)?,
                g: n(1)?,
                b: n(2)?,
                a: 255,
            })
        }
        6 => Some(Rgba {
            r: byte(0)?,
            g: byte(2)?,
            b: byte(4)?,
            a: 255,
        }),
        8 => Some(Rgba {
            r: byte(0)?,
            g: byte(2)?,
            b: byte(4)?,
            a: byte(6)?,
        }),
        _ => None,
    }
}
