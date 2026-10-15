//! The visuals of detected events (TS §19.5). V2 draws NumberReveal only.

pub mod number_reveal;

use offcut_types::{DetectedEvent, EventParams, TimeMs};

use crate::SceneError;
use crate::display_list::DrawCmd;
use crate::styles::StyleSpec;

/// An event laid out: everything `draw` needs, so that drawing a frame
/// shapes no text. V4 adds three variants.
#[derive(Clone, Debug, PartialEq)]
pub enum EventTrack {
    NumberReveal(number_reveal::Track),
}

/// `None` for an event that is not drawn: a kind V2 has no visual for, or a
/// number that cannot fit (TS §19.7).
pub fn layout(e: &DetectedEvent, style: &StyleSpec) -> Result<Option<EventTrack>, SceneError> {
    match &e.params {
        EventParams::NumberReveal { value, label } => {
            let track = number_reveal::layout(value, label.as_deref(), e.span, style)?;
            Ok(track.map(EventTrack::NumberReveal))
        }
        // V4: the visuals of TS §19.5 for these three.
        EventParams::ListReveal { .. } => Ok(None),
        EventParams::FromTo { .. } => Ok(None),
        EventParams::KeywordPop { .. } => Ok(None),
    }
}

/// Adds what the event shows at `t`; nothing outside its time.
pub fn draw(track: &EventTrack, t: TimeMs, out: &mut Vec<DrawCmd>) {
    match track {
        EventTrack::NumberReveal(track) => number_reveal::draw(track, t, out),
    }
}
