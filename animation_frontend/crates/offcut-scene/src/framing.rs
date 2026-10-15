//! Which part of the source frame is shown. This is the only place the crop
//! rectangle is worked out (TS §19.3).

use offcut_types::{ClipInfo, CropOffset};

use crate::CropRect;

/// The 9:16 part of the clip's frame, in source display pixels. A frame
/// wider than 9:16 loses its sides; a narrower one loses top and bottom.
pub fn crop_rect(clip: &ClipInfo, offset: CropOffset) -> CropRect {
    // V2 centres every clip (BP §4.1 C). V4: `let offset = offset.get();`
    let (offset, _unused) = (0.0f32, offset);
    let display_w = clip.display_width.get() as f32;
    let display_h = clip.display_height.get() as f32;
    // `display_w / display_h > 9 / 16`, in whole numbers.
    let wider = u64::from(clip.display_width.get()) * 16 > u64::from(clip.display_height.get()) * 9;
    if wider {
        let w = display_h * 9.0 / 16.0;
        CropRect {
            x: (display_w - w) / 2.0 * (1.0 + offset),
            y: 0.0,
            w,
            h: display_h,
        }
    } else {
        let h = display_w * 16.0 / 9.0;
        CropRect {
            x: 0.0,
            y: (display_h - h) / 2.0,
            w: display_w,
            h,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::testing::clip;

    #[test]
    fn a_1920x1080_clip_is_cropped_to_its_centre_strip_at_any_offset() {
        for offset in [-1.0, -0.25, 0.0, 0.5, 1.0] {
            let crop = crop_rect(&clip(1920, 1080, 60_000), CropOffset::new(offset).unwrap());
            let expected = CropRect {
                x: 656.25,
                y: 0.0,
                w: 607.5,
                h: 1080.0,
            };
            assert_eq!(crop, expected, "offset {offset}");
        }
        // A square is wider than 9:16 too.
        let crop = crop_rect(&clip(1080, 1080, 60_000), CropOffset::new(0.0).unwrap());
        assert_eq!(
            (crop.x, crop.y, crop.w, crop.h),
            (236.25, 0.0, 607.5, 1080.0)
        );
    }

    #[test]
    fn a_1080x1920_clip_keeps_the_whole_frame() {
        let whole = CropRect {
            x: 0.0,
            y: 0.0,
            w: 1080.0,
            h: 1920.0,
        };
        assert_eq!(
            crop_rect(&clip(1080, 1920, 60_000), CropOffset::new(0.0).unwrap()),
            whole
        );
        assert_eq!(
            crop_rect(&clip(1080, 1920, 60_000), CropOffset::new(1.0).unwrap()),
            whole
        );

        // Narrower than 9:16: the top and the bottom go.
        let crop = crop_rect(&clip(900, 1920, 60_000), CropOffset::new(0.0).unwrap());
        assert_eq!(
            (crop.x, crop.y, crop.w, crop.h),
            (0.0, 160.0, 900.0, 1600.0)
        );
    }
}
