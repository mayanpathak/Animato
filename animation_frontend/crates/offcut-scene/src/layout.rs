//! Text shaping through parley: from a string to glyphs with positions.

use parley::{FontFamily, FontFamilyName, FontWeight, Layout, PositionedLayoutItem, StyleProperty};

use crate::SceneError;
use crate::display_list::{FontId, PositionedGlyph};
use crate::fonts::{self, Fonts};

/// Glyphs of one font, one after the other on a baseline. A glyph's `x` is
/// measured from the start of the run; `width` is where the next run starts.
#[derive(Clone, Debug, PartialEq)]
pub struct ShapedRun {
    pub font: FontId,
    pub size: f32,
    pub glyphs: Vec<PositionedGlyph>,
    pub width: f32,
    pub ascent: f32,
    pub descent: f32,
    pub text: String,
}

/// `text` set in `font` at `size`. A character the font has no glyph for is
/// set in Noto Emoji, so the result may be several runs; a character that
/// font lacks too is left out and takes no room (TS §19.6).
pub fn shape(text: &str, font: FontId, size: f32) -> Result<Vec<ShapedRun>, SceneError> {
    if !(size.is_finite() && size > 0.0) {
        return Err(SceneError::Layout);
    }
    if text.is_empty() {
        return Ok(Vec::new());
    }
    fonts::with(|fonts| shape_with(fonts, text, font, size))
}

/// `text` laid out in `font` at `size`, with Noto Emoji behind it for what
/// the font lacks.
fn lay_out(fonts: &mut Fonts, text: &str, font: FontId, size: f32) -> Layout<()> {
    let stack = [
        FontFamilyName::named(&fonts.faces.face(font).family),
        FontFamilyName::named(&fonts.faces.emoji.family),
    ];
    // A scale of 1 and no rounding: a scene is laid out in logical pixels.
    let mut builder = fonts
        .layout_cx
        .ranged_builder(&mut fonts.font_cx, text, 1.0, false);
    builder.push_default(StyleProperty::FontFamily(FontFamily::from(&stack[..])));
    builder.push_default(StyleProperty::FontSize(size));
    builder.push_default(StyleProperty::FontWeight(FontWeight::new(fonts::weight(
        font,
    ))));
    let mut layout: Layout<()> = builder.build(text);
    layout.break_all_lines(None);
    layout
}

/// A character every text font has, and one the emoji font has.
const TEXT_PROBE: &str = "A";
const EMOJI_PROBE: &str = "\u{1F600}";

/// Where `font` stands on the axes of its file: the weight of
/// `fonts::weight`, as the numbers the font's own tables turn it into. All
/// three files are variable fonts, so a glyph id alone does not say which
/// outline was measured: a backend draws a run with these beside it.
pub fn normalized_coords(font: FontId) -> Result<Vec<i16>, SceneError> {
    let probe = match font {
        FontId::Inter700 | FontId::Inter900 | FontId::JetBrainsMono700 => TEXT_PROBE,
        FontId::NotoEmoji => EMOJI_PROBE,
    };
    fonts::with(|fonts| {
        let layout = lay_out(fonts, probe, font, 16.0);
        for line in layout.lines() {
            for item in line.items() {
                let PositionedLayoutItem::GlyphRun(glyph_run) = item else {
                    continue;
                };
                let run = glyph_run.run();
                if fonts.faces.font_of(run.font().data.id(), font) == Some(font) {
                    return Ok(run.normalized_coords().to_vec());
                }
            }
        }
        Err(SceneError::Font)
    })
}

fn shape_with(
    fonts: &mut Fonts,
    text: &str,
    font: FontId,
    size: f32,
) -> Result<Vec<ShapedRun>, SceneError> {
    let layout = lay_out(fonts, text, font, size);

    let mut runs = Vec::new();
    for line in layout.lines() {
        for item in line.items() {
            let PositionedLayoutItem::GlyphRun(glyph_run) = item else {
                continue;
            };
            let run = glyph_run.run();
            let Some(used) = fonts.faces.font_of(run.font().data.id(), font) else {
                return Err(SceneError::Font);
            };
            // A cluster is one or more characters and the glyphs that draw
            // them. Glyph 0 is the font's "no such character" box: a cluster
            // that holds one is left out, its text with it.
            let mut width = 0.0f32;
            let mut glyphs = Vec::new();
            for cluster in run.visual_clusters() {
                if cluster.glyphs().any(|glyph| glyph.id == 0) {
                    continue;
                }
                for glyph in cluster.glyphs() {
                    glyphs.push(PositionedGlyph {
                        id: glyph.id,
                        x: width + glyph.x,
                        y: glyph.y,
                    });
                    width += glyph.advance;
                }
            }
            if glyphs.is_empty() {
                continue;
            }
            let shown: String = run
                .clusters()
                .filter(|cluster| cluster.glyphs().all(|glyph| glyph.id != 0))
                .filter_map(|cluster| text.get(cluster.text_range()))
                .collect();
            let metrics = run.metrics();
            runs.push(ShapedRun {
                font: used,
                size,
                glyphs,
                width,
                ascent: metrics.ascent,
                descent: metrics.descent,
                text: shown,
            });
        }
    }
    Ok(runs)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_coordinates_of_a_font_are_those_of_its_weight() {
        let fonts = [
            FontId::Inter700,
            FontId::Inter900,
            FontId::JetBrainsMono700,
            FontId::NotoEmoji,
        ];
        let coords: Vec<Vec<i16>> = fonts
            .iter()
            .map(|font| normalized_coords(*font).unwrap())
            .collect();
        for (font, coords) in fonts.iter().zip(&coords) {
            // No file has 700 or 900 as its default weight, so every font is
            // away from the default on one axis at least.
            assert!(
                coords.iter().any(|coord| *coord != 0),
                "{font:?} {coords:?}"
            );
            assert_eq!(normalized_coords(*font).unwrap(), *coords);
        }
        // One file, two weights: the two differ.
        assert_ne!(coords[0], coords[1]);
        // 900 is the end of Inter's weight axis and 700 the end of Noto
        // Emoji's: 1.0, which a font writes as 16384.
        assert!(coords[1].contains(&16384), "{:?}", coords[1]);
        assert!(coords[3].contains(&16384), "{:?}", coords[3]);
    }
}
