//! Limits copied from the product spec (TS §10.2). Nothing else lives in this file.

use crate::units::{Bytes, DurMs, ExportCount, FpsMilli, Px};

pub const MAX_CLIP_DURATION: DurMs = DurMs::new(90_000); // PS §9.4
pub const MAX_FILE_SIZE: Bytes = Bytes::new(500_000_000); // PS §9.4, MB read as 10^6 B (derived)
pub const MAX_LONG_SIDE: Px = Px::new(1920); // PS §9.4
pub const MAX_INPUT_FPS: FpsMilli = FpsMilli::new(60_000); // PS §9.4
pub const INPUT_FPS_TOLERANCE: FpsMilli = FpsMilli::new(500); // (assumption, M1.1) 60.5 fps accepted
pub const OUTPUT_FPS: u32 = 30; // PS §9.4
pub const CREATOR_WIDTH: Px = Px::new(1080); // PS §9.4
pub const CREATOR_HEIGHT: Px = Px::new(1920);
pub const FREE_WIDTH: Px = Px::new(720); // PS §9.4
pub const FREE_HEIGHT: Px = Px::new(1280);
pub const FREE_EXPORTS_PER_MONTH: ExportCount = ExportCount::new(3); // PS §11
pub const CREATOR_FAIR_USE_PER_MONTH: ExportCount = ExportCount::new(100); // PS §11 (soft; never blocks)
pub const ENTITLEMENT_OFFLINE_TTL_SECS: i64 = 7 * 24 * 3600; // PS §11
pub const MIN_DEVICE_MEMORY_GB: u32 = 4; // PS §9.3
pub const CAPABILITY_CHECK_BUDGET: DurMs = DurMs::new(3_000); // PS §9.3
pub const DETECTOR_PRECISION_TARGET: f32 = 0.90; // PS §8, §20.1
pub const PREVIEW_MAX_DRIFT: DurMs = DurMs::new(80); // PS §20.1
pub const LOUDNESS_TOLERANCE_LU: f32 = 1.0; // PS §20.1
pub const ANALYTICS_RETENTION_DAYS: u32 = 90; // PS §16
pub const MIN_WORDS: u32 = 3; // (assumption, E-2) below this → REJECT_NO_SPEECH
pub const MAX_RECENT_CLIPS: u32 = 5; // (assumption, M2.1)
