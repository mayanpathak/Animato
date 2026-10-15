//! The caption styles (TS §19.4). This is the only file that holds their
//! values; all of them are (assumption), reviewed in E-2.

use offcut_types::StyleId;

use crate::display_list::{FontId, Rgba};
use crate::easing::Easing;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Case {
    AsSpoken,
    Upper,
}

/// One row of the table of TS §19.4.
#[derive(Clone, Debug, PartialEq)]
pub struct StyleSpec {
    pub font: FontId,
    /// In logical pixels.
    pub size: f32,
    pub case: Case,
    pub max_chars_per_line: u32,
    pub max_lines: u32,
    pub max_words: u32,
    pub fill: Rgba,
    /// In logical pixels.
    pub stroke_width: f32,
    pub stroke_color: Rgba,
    /// The word that is being spoken.
    pub active_color: Rgba,
    /// A KeywordPop word (V4).
    pub pop_color: Rgba,
    pub easing: Easing,
    pub motion_ms: u32,
}

const WHITE: Rgba = Rgba {
    r: 255,
    g: 255,
    b: 255,
    a: 255,
};
const DARK: Rgba = Rgba {
    r: 16,
    g: 16,
    b: 20,
    a: 255,
};
const ACCENT: Rgba = Rgba {
    r: 255,
    g: 214,
    b: 10,
    a: 255,
};

fn clean() -> StyleSpec {
    StyleSpec {
        font: FontId::Inter700,
        size: 64.0,
        case: Case::AsSpoken,
        max_chars_per_line: 18,
        max_lines: 2,
        max_words: 5,
        fill: WHITE,
        stroke_width: 6.0,
        stroke_color: DARK,
        active_color: ACCENT,
        pop_color: ACCENT,
        easing: Easing::EaseOutCubic,
        motion_ms: 120,
    }
}

pub fn spec(id: StyleId) -> StyleSpec {
    match id {
        StyleId::Clean => clean(),
        // V4: the Bold row of TS §19.4.
        StyleId::Bold => clean(),
        // V4: the Tech row of TS §19.4.
        StyleId::Tech => clean(),
    }
}
