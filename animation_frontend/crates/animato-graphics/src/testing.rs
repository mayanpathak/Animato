//! Test fixtures: the app's font files, registered in a fixed order.

use crate::fonts::{register, set_fallback};

pub(crate) const INTER: u16 = 0;
pub(crate) const MONO: u16 = 1;
pub(crate) const EMOJI: u16 = 2;

static FILES: [&[u8]; 5] = [
    include_bytes!("../../../public/fonts/Inter-Variable.ttf"),
    include_bytes!("../../../public/fonts/JetBrainsMono-Variable.ttf"),
    include_bytes!("../../../public/fonts/NotoEmoji-Variable.ttf"),
    include_bytes!("../../../public/fonts/Geist-Variable.ttf"),
    include_bytes!("../../../public/fonts/DejaVuSerif-Bold.ttf"),
];

/// Registers the five files on this thread (again is a no-op).
pub(crate) fn fonts() {
    for (i, file) in FILES.iter().enumerate() {
        let r = register(file.to_vec()).unwrap();
        assert_eq!(usize::from(r.face), i);
    }
    set_fallback(EMOJI).unwrap();
}
