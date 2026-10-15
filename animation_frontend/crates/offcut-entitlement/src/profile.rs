//! From claims to the size, the watermark and the bitrates of an export.
//! This is the only place an `ExportProfile` is built (INV-9): nothing else
//! chooses a size or a watermark flag.

use offcut_types::limits::{CREATOR_HEIGHT, CREATOR_WIDTH, FREE_HEIGHT, FREE_WIDTH};
use offcut_types::{BitsPerSec, ExportProfile, Plan, ProfileKind, Px, UnixSecs};

use crate::claims::EntitlementClaims;

// TS §21.2; all three are (assumption, TE-4).
pub const CREATOR_VIDEO_BITRATE: BitsPerSec = BitsPerSec::new(8_000_000);
pub const FREE_VIDEO_BITRATE: BitsPerSec = BitsPerSec::new(4_000_000);
pub const AUDIO_BITRATE: BitsPerSec = BitsPerSec::new(160_000);
// The preview is half the Creator size (TS §20.3). It is drawn, never encoded.
pub const PREVIEW_WIDTH: Px = Px::new(540);
pub const PREVIEW_HEIGHT: Px = Px::new(960);

/// The profile these claims give at the time `now`, which the caller reads
/// from its clock. Claims come from `verify_token` and from nowhere else.
/// No claims is the preview. Creator claims that have run out give the Free
/// profile, as Free claims do.
pub fn export_profile(claims: Option<&EntitlementClaims>, now: UnixSecs) -> ExportProfile {
    let Some(claims) = claims else {
        return ExportProfile {
            kind: ProfileKind::Preview,
            width: PREVIEW_WIDTH,
            height: PREVIEW_HEIGHT,
            watermark: false,
            video_bitrate: BitsPerSec::new(0),
            audio_bitrate: BitsPerSec::new(0),
        };
    };
    let paid = match claims.plan {
        Plan::Creator => now <= claims.period_end && now <= claims.exp,
        Plan::Free => false,
    };
    if paid {
        ExportProfile {
            kind: ProfileKind::Creator,
            width: CREATOR_WIDTH,
            height: CREATOR_HEIGHT,
            watermark: false,
            video_bitrate: CREATOR_VIDEO_BITRATE,
            audio_bitrate: AUDIO_BITRATE,
        }
    } else {
        ExportProfile {
            kind: ProfileKind::Free,
            width: FREE_WIDTH,
            height: FREE_HEIGHT,
            watermark: true,
            video_bitrate: FREE_VIDEO_BITRATE,
            audio_bitrate: AUDIO_BITRATE,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::testing::{EXP, IAT, PERIOD_END, claims};

    fn at(claims: &EntitlementClaims, now: i64) -> ExportProfile {
        export_profile(Some(claims), UnixSecs::new(now))
    }

    fn free() -> ExportProfile {
        ExportProfile {
            kind: ProfileKind::Free,
            width: Px::new(720),
            height: Px::new(1280),
            watermark: true,
            video_bitrate: BitsPerSec::new(4_000_000),
            audio_bitrate: BitsPerSec::new(160_000),
        }
    }

    #[test]
    fn without_claims_the_profile_is_the_preview() {
        let preview = ExportProfile {
            kind: ProfileKind::Preview,
            width: Px::new(540),
            height: Px::new(960),
            watermark: false,
            video_bitrate: BitsPerSec::new(0),
            audio_bitrate: BitsPerSec::new(0),
        };
        for now in [i64::MIN, 0, IAT, i64::MAX] {
            assert_eq!(export_profile(None, UnixSecs::new(now)), preview);
        }
    }

    #[test]
    fn creator_claims_before_both_ends_give_1080x1920_without_a_watermark() {
        let creator = ExportProfile {
            kind: ProfileKind::Creator,
            width: Px::new(1080),
            height: Px::new(1920),
            watermark: false,
            video_bitrate: BitsPerSec::new(8_000_000),
            audio_bitrate: BitsPerSec::new(160_000),
        };
        let claims = claims(Plan::Creator, 3);
        assert_eq!(at(&claims, IAT), creator);
        assert_eq!(at(&claims, EXP - 1), creator);
        // The last second of each end still counts.
        assert_eq!(at(&claims, EXP), creator);
        let mut short_period = claims.clone();
        short_period.period_end = UnixSecs::new(IAT + 100);
        assert_eq!(at(&short_period, IAT + 100), creator);
        // A token is not refused for a time before it was issued.
        assert_eq!(at(&claims, 0), creator);
    }

    #[test]
    fn creator_claims_past_either_end_give_the_free_profile() {
        let claims = claims(Plan::Creator, 3);
        // Past `exp`, inside the period.
        const { assert!(EXP < PERIOD_END) };
        assert_eq!(at(&claims, EXP + 1), free());
        assert_eq!(at(&claims, PERIOD_END), free());
        // Past the period, before `exp`.
        let mut ended = claims.clone();
        ended.period_end = UnixSecs::new(IAT + 100);
        assert_eq!(at(&ended, IAT + 101), free());
        assert_eq!(at(&claims, i64::MAX), free());
    }

    #[test]
    fn free_claims_give_the_free_profile() {
        for remaining in [0, 2, 3] {
            let claims = claims(Plan::Free, remaining);
            assert_eq!(at(&claims, IAT), free());
            assert_eq!(at(&claims, EXP + 1), free());
        }
        // The sizes are the limits of the product, read and not written again.
        assert_eq!((free().width, free().height), (FREE_WIDTH, FREE_HEIGHT));
    }
}
