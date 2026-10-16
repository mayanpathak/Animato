//! Words set in lines: shaping, wrapping to a width, and placing the lines
//! in a box. Titles, captions, the end card and the watermark share this.

use crate::SceneError;
use crate::display_list::{Affine, DrawCmd, FontId, Rect, Rgba, Stroke};
use crate::doc::Align;
use crate::layout::{ShapedRun, shape, width};

/// A word of a line, `x` from the start of the line. `index` counts words
/// across the whole block, in reading order.
#[derive(Clone, Debug, PartialEq)]
pub struct PlacedWord {
    pub index: usize,
    pub x: f32,
    pub width: f32,
    pub runs: Vec<ShapedRun>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct TextLine {
    pub words: Vec<PlacedWord>,
    pub width: f32,
}

/// Lines of one font and size, in design pixels.
#[derive(Clone, Debug, PartialEq)]
pub struct Block {
    pub lines: Vec<TextLine>,
    pub ascent: f32,
    pub descent: f32,
    /// Baseline to baseline.
    pub line_height: f32,
    pub space: f32,
}

impl Block {
    pub fn height(&self) -> f32 {
        if self.lines.is_empty() {
            0.0
        } else {
            self.line_height * (self.lines.len() - 1) as f32 + self.ascent + self.descent
        }
    }

    pub fn width(&self) -> f32 {
        self.lines.iter().map(|l| l.width).fold(0.0, f32::max)
    }

    pub fn word_count(&self) -> usize {
        self.lines.iter().map(|l| l.words.len()).sum()
    }
}

/// Sets `paragraphs` (each a list of words) in lines no wider than
/// `max_width`: a paragraph starts a line, and a word that does not fit on
/// the line goes to the next. A word wider than `max_width` has a line of
/// its own; the block is scaled to fit when it is drawn.
pub fn set(
    paragraphs: &[Vec<String>],
    font: FontId,
    size: f32,
    line_height: f32,
    max_width: f32,
) -> Result<Block, SceneError> {
    let mut shaped = Vec::with_capacity(paragraphs.len());
    for paragraph in paragraphs {
        let mut words = Vec::with_capacity(paragraph.len());
        for word in paragraph {
            words.push(shape(word, font, size)?);
        }
        shaped.push(words);
    }
    let metrics = Metrics::of(font, size, line_height)?;
    Ok(block(shaped, &metrics, max_width))
}

/// What lines of one font and size need besides their words.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Metrics {
    pub space: f32,
    pub ascent: f32,
    pub descent: f32,
    pub line_height: f32,
}

impl Metrics {
    pub fn of(font: FontId, size: f32, line_height: f32) -> Result<Metrics, SceneError> {
        let (mut ascent, mut descent) = (0.0f32, 0.0f32);
        for run in shape("Ag", font, size)? {
            ascent = ascent.max(run.ascent);
            descent = descent.max(run.descent);
        }
        Ok(Metrics {
            space: width(&shape(" ", font, size)?),
            ascent,
            descent,
            line_height: size * line_height,
        })
    }
}

/// How many lines `widths` take in `max_width`, set as `block` sets them.
pub fn line_count(widths: &[f32], space: f32, max_width: f32) -> usize {
    let mut lines = 0;
    let mut line = None::<f32>;
    for &w in widths {
        line = match line {
            Some(l) if l + space + w <= max_width => Some(l + space + w),
            _ => {
                lines += 1;
                Some(w)
            }
        };
    }
    lines
}

/// Lines from shaped words: see `set`.
pub fn block(paragraphs: Vec<Vec<Vec<ShapedRun>>>, m: &Metrics, max_width: f32) -> Block {
    let (mut ascent, mut descent) = (m.ascent, m.descent);
    let mut lines: Vec<TextLine> = Vec::new();
    let mut index = 0;
    for paragraph in paragraphs {
        let mut line = TextLine {
            words: Vec::new(),
            width: 0.0,
        };
        for runs in paragraph {
            for run in &runs {
                ascent = ascent.max(run.ascent);
                descent = descent.max(run.descent);
            }
            let w = width(&runs);
            let x = if line.words.is_empty() {
                0.0
            } else {
                line.width + m.space
            };
            if !line.words.is_empty() && x + w > max_width {
                lines.push(std::mem::replace(
                    &mut line,
                    TextLine {
                        words: Vec::new(),
                        width: 0.0,
                    },
                ));
                line.words.push(PlacedWord {
                    index,
                    x: 0.0,
                    width: w,
                    runs,
                });
                line.width = w;
            } else {
                line.words.push(PlacedWord {
                    index,
                    x,
                    width: w,
                    runs,
                });
                line.width = x + w;
            }
            index += 1;
        }
        lines.push(line);
    }
    Block {
        lines,
        ascent,
        descent,
        line_height: m.line_height,
        space: m.space,
    }
}

/// Words of a text: paragraphs at line breaks, words at spaces.
pub fn paragraphs(text: &str, upper: bool) -> Vec<Vec<String>> {
    let text = if upper {
        text.to_uppercase()
    } else {
        text.to_owned()
    };
    text.split('\n')
        .map(|p| p.split_whitespace().map(str::to_owned).collect())
        .collect()
}

/// Where a block goes: centred vertically in `area`, aligned horizontally,
/// and scaled down (never up) to fit it.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Placement {
    pub area: Rect,
    pub align: Align,
    pub scale: f32,
    /// The top of the first line's ascent.
    pub top: f32,
}

pub fn place(block: &Block, area: Rect, align: Align) -> Placement {
    let (w, h) = (block.width(), block.height());
    let scale = [1.0, area.w / w.max(1e-3), area.h / h.max(1e-3)]
        .into_iter()
        .fold(f32::MAX, f32::min)
        .max(0.0);
    let top = area.y + (area.h - h * scale) / 2.0;
    Placement {
        area,
        align,
        scale,
        top,
    }
}

impl Placement {
    /// The left end of `line`'s baseline, and the baseline's y.
    pub fn line_origin(&self, block: &Block, i: usize) -> (f32, f32) {
        let line = &block.lines[i];
        let w = line.width * self.scale;
        let x = match self.align {
            Align::Left => self.area.x,
            Align::Center => self.area.x + (self.area.w - w) / 2.0,
            Align::Right => self.area.right() - w,
        };
        (
            x,
            self.top + (block.ascent + block.line_height * i as f32) * self.scale,
        )
    }

    /// The box around a line's glyphs, padded by `pad` on every side.
    pub fn line_rect(&self, block: &Block, i: usize, pad: f32) -> Rect {
        let (x, baseline) = self.line_origin(block, i);
        let s = self.scale;
        Rect {
            x: x - pad,
            y: baseline - block.ascent * s - pad,
            w: block.lines[i].width * s + pad * 2.0,
            h: (block.ascent + block.descent) * s + pad * 2.0,
        }
    }

    /// The box around every line, padded by `pad`.
    pub fn block_rect(&self, block: &Block, pad: f32) -> Rect {
        let mut out: Option<Rect> = None;
        for i in 0..block.lines.len() {
            let r = self.line_rect(block, i, pad);
            out = Some(match out {
                None => r,
                Some(o) => {
                    let x = o.x.min(r.x);
                    let y = o.y.min(r.y);
                    Rect {
                        x,
                        y,
                        w: o.right().max(r.right()) - x,
                        h: o.bottom().max(r.bottom()) - y,
                    }
                }
            });
        }
        out.unwrap_or(Rect {
            x: self.area.x,
            y: self.area.y,
            w: 0.0,
            h: 0.0,
        })
    }
}

/// A motion applied to what is drawn: scale by `m` about `center`, then a
/// move down by `dy`.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Motion {
    pub m: f32,
    pub center: (f32, f32),
    pub dy: f32,
}

impl Motion {
    pub const NONE: Motion = Motion {
        m: 1.0,
        center: (0.0, 0.0),
        dy: 0.0,
    };

    pub fn point(&self, x: f32, y: f32) -> (f32, f32) {
        let (cx, cy) = self.center;
        (cx + (x - cx) * self.m, cy + (y - cy) * self.m + self.dy)
    }

    pub fn rect(&self, r: Rect) -> Rect {
        let (x, y) = self.point(r.x, r.y);
        Rect {
            x,
            y,
            w: r.w * self.m,
            h: r.h * self.m,
        }
    }
}

/// Draws the words of `block` with index below `shown`, each in the colour
/// `fill(index)`.
pub fn draw(
    block: &Block,
    at: &Placement,
    motion: &Motion,
    shown: usize,
    stroke: Option<Stroke>,
    fill: impl Fn(usize) -> Rgba,
    out: &mut Vec<DrawCmd>,
) {
    let k = at.scale * motion.m;
    let stroke = stroke.map(|s| Stroke {
        width: s.width * k,
        ..s
    });
    for i in 0..block.lines.len() {
        let (left, baseline) = at.line_origin(block, i);
        for word in &block.lines[i].words {
            if word.index >= shown {
                return;
            }
            let mut x = word.x;
            for run in &word.runs {
                let (px, py) = motion.point(left + x * at.scale, baseline);
                out.push(DrawCmd::GlyphRun {
                    font: run.font,
                    family: run.family.clone(),
                    size: run.size,
                    glyphs: run.glyphs.clone(),
                    fill: fill(word.index),
                    stroke,
                    transform: Affine::scale_then_translate(k, px, py),
                    text: run.text.clone(),
                });
                x += run.width;
            }
        }
    }
}
