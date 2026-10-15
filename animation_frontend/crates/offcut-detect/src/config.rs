//! The numbers the detector decides by. This is the only file that holds a
//! threshold (TS §17.4); all of them are (assumption), tuned at M1.3.

/// All four thresholds are here from the start, so that V3 adds fields and
/// renames none.
#[derive(Clone, Debug, PartialEq)]
pub struct DetectorConfig {
    pub threshold_from_to: f32,
    pub threshold_list: f32,
    pub threshold_number: f32,
    pub threshold_keyword: f32,
    /// What every number starts with.
    pub number_base: f32,
    /// Added for a currency, a percent sign or a unit.
    pub number_unit_bonus: f32,
    /// Added for a magnitude of at least 1,000.
    pub number_magnitude_bonus: f32,
    /// Added when one of the words was said with emphasis.
    pub number_energy_bonus: f32,
    /// An overlay is on the screen this long before its first word (TS §17.5),
    pub overlay_lead_ms: u32,
    /// and a number this long after its last: the hold and the fade of TS §19.5.
    pub number_hold_ms: u32,
}

impl Default for DetectorConfig {
    fn default() -> Self {
        Self {
            threshold_from_to: 0.85,
            threshold_list: 0.85,
            threshold_number: 0.80,
            threshold_keyword: 0.80,
            number_base: 0.50,
            number_unit_bonus: 0.30,
            number_magnitude_bonus: 0.20,
            number_energy_bonus: 0.10,
            overlay_lead_ms: 150,
            number_hold_ms: 1_400,
        }
    }
}
