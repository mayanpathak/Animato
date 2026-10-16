//! Where on the canvas titles, captions and the watermark may be drawn. On a
//! vertical canvas the platforms' own buttons and captions cover the top, the
//! bottom and the right edge (insets from offcut-scene's 1080x1920 layout:
//! 250 top, 420 bottom, 60 left, 120 right); elsewhere a 5% title-safe margin.

use crate::display_list::Rect;

/// The safe area of a `w` x `h` canvas, in the same units.
pub fn safe_area(w: f32, h: f32) -> Rect {
    let (top, bottom, left, right) = if h > w * 1.2 {
        (
            250.0 / 1920.0 * h,
            420.0 / 1920.0 * h,
            60.0 / 1080.0 * w,
            120.0 / 1080.0 * w,
        )
    } else {
        (0.05 * h, 0.05 * h, 0.05 * w, 0.05 * w)
    };
    Rect {
        x: left,
        y: top,
        w: w - left - right,
        h: h - top - bottom,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_vertical_canvas_keeps_clear_of_the_platform_ui() {
        let r = safe_area(1080.0, 1920.0);
        let got = [r.x, r.y, r.right(), r.bottom()].map(|v| (v * 100.0).round() / 100.0);
        assert_eq!(got, [60.0, 250.0, 960.0, 1500.0]);
        let wide = safe_area(1920.0, 1080.0);
        assert_eq!((wide.x, wide.y), (96.0, 54.0));
    }
}
