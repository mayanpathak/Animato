//! The fonts a scene may use, registered at run time (plan 8.8): the
//! built-in files the app serves from `public/fonts`, and brand-kit fonts
//! from OPFS. Nothing is embedded in the module and the machine's own fonts
//! are never read, so a frame looks the same on every device.

use std::cell::RefCell;
use std::sync::Arc;

use parley::fontique::{Blob, Collection, CollectionOptions, SourceCache};
use parley::{FontContext, LayoutContext};

use crate::SceneError;

/// One registered file: the name of its family, the id of its data (by which
/// a shaped run says which file it used) and the bytes (for a backend that
/// draws glyphs by id).
pub(crate) struct Face {
    pub family: String,
    blob: u64,
    data: Arc<Vec<u8>>,
}

/// What shaping needs. Built once per thread and used by every scene on it:
/// the result of a shaping call does not depend on the calls before it.
pub(crate) struct Fonts {
    pub font_cx: FontContext,
    pub layout_cx: LayoutContext<()>,
    pub faces: Vec<Face>,
    /// The face that draws what the asked font lacks (Noto Emoji).
    pub fallback: Option<u16>,
}

/// What `register` tells the caller: the face's index and its family name,
/// by which the Canvas2D fallback registers the same file with `FontFace`.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Registered {
    pub face: u16,
    pub family: String,
}

impl Fonts {
    fn new() -> Fonts {
        let collection = Collection::new(CollectionOptions {
            shared: false,
            system_fonts: false,
        });
        Fonts {
            font_cx: FontContext {
                collection,
                source_cache: SourceCache::default(),
            },
            layout_cx: LayoutContext::new(),
            faces: Vec::new(),
            fallback: None,
        }
    }

    pub fn face(&self, face: u16) -> Result<&Face, SceneError> {
        self.faces.get(usize::from(face)).ok_or(SceneError::Font)
    }

    /// Which face a run was shaped with, from the id of its data.
    pub fn face_of(&self, blob: u64) -> Option<u16> {
        self.faces
            .iter()
            .position(|f| f.blob == blob)
            .and_then(|i| u16::try_from(i).ok())
    }
}

thread_local! {
    static FONTS: RefCell<Option<Fonts>> = const { RefCell::new(None) };
}

/// Runs `f` with the fonts of this thread.
pub(crate) fn with<T>(
    f: impl FnOnce(&mut Fonts) -> Result<T, SceneError>,
) -> Result<T, SceneError> {
    FONTS.with(|cell| {
        let mut slot = cell.try_borrow_mut().map_err(|_| SceneError::Font)?;
        f(slot.get_or_insert_with(Fonts::new))
    })
}

/// Registers a TTF/OTF file. The same bytes registered twice give the same
/// face. WOFF and WOFF2 are not read (plan 8.8): the caller says so first.
pub fn register(bytes: Vec<u8>) -> Result<Registered, SceneError> {
    with(|fonts| {
        if let Some(i) = fonts.faces.iter().position(|f| *f.data == bytes) {
            let face = u16::try_from(i).map_err(|_| SceneError::Font)?;
            return Ok(Registered {
                face,
                family: fonts.faces[i].family.clone(),
            });
        }
        let data = Arc::new(bytes);
        let blob = Blob::new(Arc::clone(&data) as Arc<dyn AsRef<[u8]> + Send + Sync>);
        let id = blob.id();
        let families = fonts.font_cx.collection.register_fonts(blob, None);
        let (family, _) = families.first().ok_or(SceneError::Font)?;
        let family = fonts
            .font_cx
            .collection
            .family_name(*family)
            .ok_or(SceneError::Font)?
            .to_owned();
        let face = u16::try_from(fonts.faces.len()).map_err(|_| SceneError::Font)?;
        fonts.faces.push(Face {
            family: family.clone(),
            blob: id,
            data,
        });
        Ok(Registered { face, family })
    })
}

/// Makes `face` the one that draws characters the asked font has no glyph for.
pub fn set_fallback(face: u16) -> Result<(), SceneError> {
    with(|fonts| {
        fonts.face(face)?;
        fonts.fallback = Some(face);
        Ok(())
    })
}

/// The file of a face, for a backend that draws glyphs by id.
pub fn bytes(face: u16) -> Option<Arc<Vec<u8>>> {
    with(|fonts| Ok(Arc::clone(&fonts.face(face)?.data))).ok()
}

/// The face registered for a family name, case-insensitively. A variable
/// file names itself "Inter Variable": asked for "Inter", it is found by that
/// prefix when no face is named "Inter" exactly.
pub fn find(family: &str) -> Option<u16> {
    with(|fonts| {
        let exact = fonts
            .faces
            .iter()
            .position(|f| f.family.eq_ignore_ascii_case(family));
        let prefix = || {
            let lower = format!("{} ", family.to_ascii_lowercase());
            fonts
                .faces
                .iter()
                .position(|f| f.family.to_ascii_lowercase().starts_with(&lower))
        };
        Ok(exact.or_else(prefix).and_then(|i| u16::try_from(i).ok()))
    })
    .ok()
    .flatten()
}

/// The family name of a face.
pub fn family(face: u16) -> Option<String> {
    with(|fonts| Ok(fonts.face(face)?.family.clone())).ok()
}
