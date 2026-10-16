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
    pub family: String,
    pub size: f32,
    pub glyphs: Vec<PositionedGlyph>,
    pub width: f32,
    pub ascent: f32,
    pub descent: f32,
    pub text: String,
}

/// The width of runs set one after the other.
pub fn width(runs: &[ShapedRun]) -> f32 {
    runs.iter().map(|r| r.width).sum()
}

/// `text` set in `font` at `size`. A character the font has no glyph for is
/// set in the fallback face, so the result may be several runs; a character
/// that face lacks too is left out and takes no room.
pub fn shape(text: &str, font: FontId, size: f32) -> Result<Vec<ShapedRun>, SceneError> {
    if !(size.is_finite() && size > 0.0) {
        return Err(SceneError::Layout);
    }
    if text.is_empty() {
        return Ok(Vec::new());
    }
    fonts::with(|fonts| shape_with(fonts, text, font, size))
}

/// `text` laid out on one line in `font` at `size`, with the fallback behind it.
fn lay_out(
    fonts: &mut Fonts,
    text: &str,
    font: FontId,
    size: f32,
) -> Result<Layout<()>, SceneError> {
    let family = fonts.face(font.face)?.family.clone();
    let fallback = match fonts.fallback {
        Some(face) => Some(fonts.face(face)?.family.clone()),
        None => None,
    };
    let mut stack = vec![FontFamilyName::named(&family)];
    if let Some(fallback) = &fallback {
        stack.push(FontFamilyName::named(fallback));
    }
    // A scale of 1 and no rounding: a scene is laid out in design pixels.
    let mut builder = fonts
        .layout_cx
        .ranged_builder(&mut fonts.font_cx, text, 1.0, false);
    builder.push_default(StyleProperty::FontFamily(FontFamily::from(&stack[..])));
    builder.push_default(StyleProperty::FontSize(size));
    builder.push_default(StyleProperty::FontWeight(FontWeight::new(f32::from(
        font.weight,
    ))));
    let mut layout: Layout<()> = builder.build(text);
    layout.break_all_lines(None);
    Ok(layout)
}

/// Where `font` stands on the axes of its file, as the numbers the font's
/// own tables turn its weight into. A static file has no axes: empty. A
/// backend draws a run with these beside it, since a glyph id alone does not
/// say which outline of a variable font was measured.
pub fn normalized_coords(font: FontId) -> Result<Vec<i16>, SceneError> {
    fonts::with(|fonts| {
        // Any character the face has: its first run is in the face itself.
        for probe in ["A", "a", "0", "\u{1F600}", "\u{2022}"] {
            let layout = lay_out(fonts, probe, font, 16.0)?;
            for line in layout.lines() {
                for item in line.items() {
                    let PositionedLayoutItem::GlyphRun(glyph_run) = item else {
                        continue;
                    };
                    let run = glyph_run.run();
                    if fonts.face_of(run.font().data.id()) == Some(font.face) {
                        return Ok(run
                            .normalized_coords()
                            .iter()
                            .map(|c| c.to_bits())
                            .collect());
                    }
                }
            }
        }
        Ok(Vec::new())
    })
}

fn shape_with(
    fonts: &mut Fonts,
    text: &str,
    font: FontId,
    size: f32,
) -> Result<Vec<ShapedRun>, SceneError> {
    let layout = lay_out(fonts, text, font, size)?;

    let mut runs = Vec::new();
    for line in layout.lines() {
        for item in line.items() {
            let PositionedLayoutItem::GlyphRun(glyph_run) = item else {
                continue;
            };
            let run = glyph_run.run();
            let Some(face) = fonts.face_of(run.font().data.id()) else {
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
            let metrics = run.font_metrics();
            runs.push(ShapedRun {
                font: FontId {
                    face,
                    weight: font.weight,
                },
                family: fonts.face(face)?.family.clone(),
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
    use crate::testing::{EMOJI, INTER, MONO, fonts};

    #[test]
    fn the_coordinates_of_a_variable_font_are_those_of_its_weight() {
        fonts();
        let inter700 = normalized_coords(FontId {
            face: INTER,
            weight: 700,
        })
        .unwrap();
        let inter900 = normalized_coords(FontId {
            face: INTER,
            weight: 900,
        })
        .unwrap();
        let mono = normalized_coords(FontId {
            face: MONO,
            weight: 700,
        })
        .unwrap();
        let emoji = normalized_coords(FontId {
            face: EMOJI,
            weight: 700,
        })
        .unwrap();
        for coords in [&inter700, &inter900, &mono, &emoji] {
            assert!(coords.iter().any(|c| *c != 0), "{coords:?}");
        }
        assert_ne!(inter700, inter900);
        // 900 is the end of Inter's weight axis and 700 the end of Noto
        // Emoji's: 1.0, which a font writes as 16384.
        assert!(inter900.contains(&16384), "{inter900:?}");
        assert!(emoji.contains(&16384), "{emoji:?}");
    }

    #[test]
    fn a_character_the_font_lacks_is_set_in_the_fallback() {
        fonts();
        let runs = shape(
            "Hi \u{1F600}",
            FontId {
                face: INTER,
                weight: 700,
            },
            40.0,
        )
        .unwrap();
        let faces: Vec<u16> = runs.iter().map(|r| r.font.face).collect();
        assert_eq!(faces, [INTER, EMOJI]);
        assert_eq!(runs[1].text, "\u{1F600}");
        assert!(width(&runs) > 0.0);
    }

    #[test]
    fn a_family_is_found_by_its_own_name_or_without_its_variable_suffix() {
        fonts();
        assert_eq!(fonts::find("inter"), Some(INTER));
        assert_eq!(fonts::family(INTER).as_deref(), Some("Inter Variable"));
        assert_eq!(fonts::find("JetBrains Mono"), Some(MONO));
        assert_eq!(fonts::find("Comic Sans"), None);
    }
}
