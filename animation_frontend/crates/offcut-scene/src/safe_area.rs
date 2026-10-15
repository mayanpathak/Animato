//! The logical canvas and where on it things may be drawn (TS §19.1). This is
//! the only file that holds these numbers. All layout is in logical pixels
//! (lp); the insets are (assumption, E-2).

use crate::display_list::Rect;

pub const CANVAS_WIDTH: f32 = 1080.0;
pub const CANVAS_HEIGHT: f32 = 1920.0;

pub const INSET_TOP: f32 = 250.0;
pub const INSET_BOTTOM: f32 = 420.0;
pub const INSET_LEFT: f32 = 60.0;
pub const INSET_RIGHT: f32 = 120.0;

/// No glyph run and no rectangle leaves this (TS §19.6).
pub const SAFE_AREA: Rect = Rect {
    x: INSET_LEFT,
    y: INSET_TOP,
    w: CANVAS_WIDTH - INSET_LEFT - INSET_RIGHT,
    h: CANVAS_HEIGHT - INSET_TOP - INSET_BOTTOM,
};

/// y 860 to 1180, as wide as the safe area.
pub const EVENT_ZONE: Rect = Rect {
    x: SAFE_AREA.x,
    y: 860.0,
    w: SAFE_AREA.w,
    h: 320.0,
};

/// y 1220 to 1500, as wide as the safe area.
pub const CAPTION_ZONE: Rect = Rect {
    x: SAFE_AREA.x,
    y: 1220.0,
    w: SAFE_AREA.w,
    h: 280.0,
};

/// The bottom-left corner of the safe area, as `(x, y)`.
pub const WATERMARK_ANCHOR: (f32, f32) = (SAFE_AREA.x, SAFE_AREA.y + SAFE_AREA.h);
