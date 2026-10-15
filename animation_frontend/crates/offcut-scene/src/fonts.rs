//! The three font files a scene may use, embedded (TS §19.4). No other font
//! is ever read: the collection is built without the fonts of the machine.

use std::cell::RefCell;
use std::sync::Arc;

use parley::fontique::{Blob, Collection, CollectionOptions, SourceCache};
use parley::{FontContext, LayoutContext};

use crate::SceneError;
use crate::display_list::FontId;

static INTER: &[u8] = include_bytes!("../assets/fonts/Inter-Variable.ttf");
static JETBRAINS_MONO: &[u8] = include_bytes!("../assets/fonts/JetBrainsMono-Variable.ttf");
static NOTO_EMOJI: &[u8] = include_bytes!("../assets/fonts/NotoEmoji-Variable.ttf");

/// The file of a font, for a backend that draws glyphs by id.
pub fn bytes(id: FontId) -> &'static [u8] {
    match id {
        FontId::Inter700 | FontId::Inter900 => INTER,
        FontId::JetBrainsMono700 => JETBRAINS_MONO,
        FontId::NotoEmoji => NOTO_EMOJI,
    }
}

/// The value of the weight axis a font id stands for. All three files are
/// variable fonts; glyph ids and positions of a run hold for this weight.
pub fn weight(id: FontId) -> f32 {
    match id {
        FontId::Inter700 | FontId::JetBrainsMono700 => 700.0,
        FontId::Inter900 => 900.0,
        // Its axis ends at 700, the weight every style asks for or more.
        FontId::NotoEmoji => 700.0,
    }
}

/// One registered file: the name of its family, and the id of its data, by
/// which a shaped run says which file it used.
pub(crate) struct Face {
    pub family: String,
    blob: u64,
}

/// What shaping needs. Built once per thread and used by every scene on it:
/// the result of a shaping call does not depend on the calls before it.
pub(crate) struct Fonts {
    pub font_cx: FontContext,
    pub layout_cx: LayoutContext<()>,
    pub faces: Faces,
}

pub(crate) struct Faces {
    inter: Face,
    mono: Face,
    pub emoji: Face,
}

impl Fonts {
    fn new() -> Result<Fonts, SceneError> {
        let options = CollectionOptions {
            shared: false,
            system_fonts: false,
        };
        let mut collection = Collection::new(options);
        let inter = register(&mut collection, INTER)?;
        let mono = register(&mut collection, JETBRAINS_MONO)?;
        let emoji = register(&mut collection, NOTO_EMOJI)?;
        Ok(Fonts {
            font_cx: FontContext {
                collection,
                source_cache: SourceCache::default(),
            },
            layout_cx: LayoutContext::new(),
            faces: Faces { inter, mono, emoji },
        })
    }
}

impl Faces {
    pub fn face(&self, id: FontId) -> &Face {
        match id {
            FontId::Inter700 | FontId::Inter900 => &self.inter,
            FontId::JetBrainsMono700 => &self.mono,
            FontId::NotoEmoji => &self.emoji,
        }
    }

    /// Which font a run was shaped with, from the id of its data. `asked` is
    /// the font the text was to be set in. `None` for data that is not ours.
    pub fn font_of(&self, blob: u64, asked: FontId) -> Option<FontId> {
        if blob == self.emoji.blob {
            Some(FontId::NotoEmoji)
        } else if blob == self.face(asked).blob {
            Some(asked)
        } else {
            None
        }
    }
}

fn register(collection: &mut Collection, file: &'static [u8]) -> Result<Face, SceneError> {
    let data = Blob::new(Arc::new(file));
    let blob = data.id();
    let families = collection.register_fonts(data, None);
    let (family, _) = families.first().ok_or(SceneError::Font)?;
    let family = collection.family_name(*family).ok_or(SceneError::Font)?;
    Ok(Face {
        family: family.to_owned(),
        blob,
    })
}

thread_local! {
    static FONTS: RefCell<Option<Fonts>> = const { RefCell::new(None) };
}

/// Runs `f` with the fonts of this thread, building them on the first call.
pub(crate) fn with<T>(
    f: impl FnOnce(&mut Fonts) -> Result<T, SceneError>,
) -> Result<T, SceneError> {
    FONTS.with(|cell| {
        let mut slot = cell.try_borrow_mut().map_err(|_| SceneError::Font)?;
        let fonts = match slot.as_mut() {
            Some(fonts) => fonts,
            None => slot.insert(Fonts::new()?),
        };
        f(fonts)
    })
}
