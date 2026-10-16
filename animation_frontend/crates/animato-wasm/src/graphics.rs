//! The graphics layer and the frame renderer (plan 8.1, 8.6, 8.7).
//!
//! - `register_font` / `set_fallback_font`: fonts are loaded by the app and
//!   registered here; nothing is embedded in the module.
//! - `GraphicsScene`: a graphics document laid out once, then `frame_at(t)`
//!   as JSON display lists. Needs no GPU: the Canvas2D fallback draws them.
//! - `FrameRenderer`: one WebGPU device shared by Vello and the video
//!   compositor. Per frame: Vello draws `under` (texture U) and `over`
//!   (texture O), the compositor clears to the background, draws U, the video
//!   layers, then O, and the frame is read back as RGBA.

use animato_graphics::{build_scene, fonts, parse_doc, parse_transcript, FrameGraphics, Scene};
use serde::Serialize;
use wasm_bindgen::prelude::*;

fn js_err(e: impl std::fmt::Display) -> JsValue {
    JsValue::from_str(&e.to_string())
}

#[derive(Serialize)]
struct Registered {
    face: u16,
    family: String,
}

/// Registers a TTF/OTF font for graphics. Returns `{face, family}` as JSON;
/// `family` is the name the Canvas2D fallback registers the same file under.
#[wasm_bindgen]
pub fn register_font(bytes: Vec<u8>) -> Result<String, JsValue> {
    let r = fonts::register(bytes).map_err(js_err)?;
    serde_json::to_string(&Registered {
        face: r.face,
        family: r.family,
    })
    .map_err(js_err)
}

/// The face that draws characters a font lacks (Noto Emoji).
#[wasm_bindgen]
pub fn set_fallback_font(face: u16) -> Result<(), JsValue> {
    fonts::set_fallback(face).map_err(js_err)
}

/// The document as Rust reads it, written back as JSON: an error names what
/// does not parse. The TS round-trip test runs the shared fixture through it.
#[wasm_bindgen]
pub fn parse_graphics_doc(doc_json: &str) -> Result<String, JsValue> {
    let doc = parse_doc(doc_json).map_err(js_err)?;
    serde_json::to_string(&doc).map_err(js_err)
}

fn scene_from(doc_json: &str, transcript_json: &str) -> Result<Scene, JsValue> {
    let doc = parse_doc(doc_json).map_err(js_err)?;
    let transcript = parse_transcript(transcript_json).map_err(js_err)?;
    build_scene(&doc, transcript.as_ref()).map_err(js_err)
}

/// A graphics document laid out for its canvas, read frame by frame.
#[wasm_bindgen]
#[derive(Default)]
pub struct GraphicsScene {
    scene: Option<Scene>,
}

#[wasm_bindgen]
impl GraphicsScene {
    #[wasm_bindgen(constructor)]
    pub fn new() -> GraphicsScene {
        GraphicsScene::default()
    }

    /// Lays out `doc_json` with `transcript_json` (`null` for none).
    pub fn set(&mut self, doc_json: &str, transcript_json: &str) -> Result<(), JsValue> {
        self.scene = Some(scene_from(doc_json, transcript_json)?);
        Ok(())
    }

    pub fn clear(&mut self) {
        self.scene = None;
    }

    /// `{under: {cmds}, over: {cmds}}` at `t` seconds, as JSON.
    pub fn frame_at(&self, t: f64) -> Result<String, JsValue> {
        let frame = self
            .scene
            .as_ref()
            .map(|s| s.frame_at(t))
            .unwrap_or_default();
        serde_json::to_string(&frame).map_err(js_err)
    }
}

#[cfg(target_arch = "wasm32")]
pub use gpu::FrameRenderer;

/// Outside a browser there is no WebGPU: the type exists so the crate builds.
#[cfg(not(target_arch = "wasm32"))]
pub struct FrameRenderer;

#[cfg(target_arch = "wasm32")]
mod gpu {
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::Arc;

    use animato_overlay::{Images, Overlay};
    use tooscut_compositor::{Compositor, Overlays, RenderFrame};
    use wasm_bindgen::prelude::*;
    use web_sys::ImageBitmap;

    use super::{js_err, scene_from, FrameGraphics, Scene};

    #[wasm_bindgen]
    pub struct FrameRenderer {
        compositor: Compositor,
        under: Overlay,
        over: Overlay,
        images: Images,
        scene: Option<Scene>,
        lost: Arc<AtomicBool>,
        adapter: String,
    }

    #[wasm_bindgen]
    impl FrameRenderer {
        /// A renderer on a new WebGPU device, drawing `width` x `height`
        /// frames. Fails where WebGPU or Vello's compute shaders are not
        /// available; the app then uses Canvas2D.
        pub async fn create(width: u32, height: u32) -> Result<FrameRenderer, JsValue> {
            let mut desc = wgpu::InstanceDescriptor::new_without_display_handle();
            desc.backends = wgpu::Backends::BROWSER_WEBGPU;
            let instance = wgpu::Instance::new(desc);
            let adapter = instance
                .request_adapter(&wgpu::RequestAdapterOptions::default())
                .await
                .map_err(|_| JsValue::from_str("no WebGPU adapter"))?;
            let (device, queue) = adapter
                .request_device(&wgpu::DeviceDescriptor {
                    label: Some("animato-frame-renderer"),
                    required_features: wgpu::Features::empty(),
                    required_limits: wgpu::Limits::default(),
                    ..Default::default()
                })
                .await
                .map_err(js_err)?;
            let lost = Arc::new(AtomicBool::new(false));
            let flag = Arc::clone(&lost);
            device.set_device_lost_callback(move |_reason, _message| {
                flag.store(true, Ordering::Relaxed)
            });
            let info = adapter.get_info();
            let adapter = if info.name.is_empty() {
                format!("{:?}", info.backend)
            } else {
                info.name
            };
            let (device, queue) = (Arc::new(device), Arc::new(queue));
            let under = Overlay::new(&device, width, height).map_err(js_err)?;
            let over = Overlay::new(&device, width, height).map_err(js_err)?;
            let compositor = Compositor::new(device, queue, width, height).map_err(js_err)?;
            Ok(FrameRenderer {
                compositor,
                under,
                over,
                images: Images::default(),
                scene: None,
                lost,
                adapter,
            })
        }

        #[wasm_bindgen(getter)]
        pub fn width(&self) -> u32 {
            self.compositor.width()
        }

        #[wasm_bindgen(getter)]
        pub fn height(&self) -> u32 {
            self.compositor.height()
        }

        /// The adapter's name, for the performance badge.
        #[wasm_bindgen(getter)]
        pub fn adapter(&self) -> String {
            self.adapter.clone()
        }

        /// Set when the device was lost; the app makes a new renderer.
        pub fn is_lost(&self) -> bool {
            self.lost.load(Ordering::Relaxed)
        }

        pub fn resize(&mut self, width: u32, height: u32) {
            if width == 0 || height == 0 {
                return;
            }
            self.compositor.resize(width, height);
            let device = Arc::clone(self.compositor.device());
            self.under.resize(&device, width, height);
            self.over.resize(&device, width, height);
        }

        /// Lays out a graphics document for this renderer's frames.
        pub fn set_graphics(
            &mut self,
            doc_json: &str,
            transcript_json: &str,
        ) -> Result<(), JsValue> {
            self.scene = Some(scene_from(doc_json, transcript_json)?);
            Ok(())
        }

        pub fn clear_graphics(&mut self) {
            self.scene = None;
        }

        /// Registers a straight-alpha RGBA image (a logo) for `image` items.
        pub fn register_image(
            &mut self,
            id: &str,
            width: u32,
            height: u32,
            rgba: Vec<u8>,
        ) -> Result<(), JsValue> {
            self.images.insert(id, width, height, rgba).map_err(js_err)
        }

        pub fn remove_image(&mut self, id: &str) {
            self.images.remove(id);
        }

        /// Uploads a video frame or image for the media layer `key`.
        pub fn upload_bitmap(&mut self, bitmap: &ImageBitmap, key: &str) -> Result<(), JsValue> {
            self.compositor.upload_bitmap(bitmap, key).map_err(js_err)
        }

        pub fn clear_texture(&mut self, key: &str) {
            self.compositor.clear_texture(key);
        }

        pub fn clear_all_textures(&mut self) {
            self.compositor.clear_all_textures();
        }

        /// Draws the frame at `t`: graphics `under`, the video layers of
        /// `frame` (a render-engine `RenderFrame`), graphics `over`, on a
        /// background of `r, g, b` (0..=1). Returns RGBA pixels.
        pub async fn render(
            &mut self,
            t: f64,
            frame: JsValue,
            r: f64,
            g: f64,
            b: f64,
        ) -> Result<Vec<u8>, JsValue> {
            let frame: RenderFrame = serde_wasm_bindgen::from_value(frame).map_err(js_err)?;
            let graphics: FrameGraphics = self
                .scene
                .as_ref()
                .map(|s| s.frame_at(t))
                .unwrap_or_default();
            let device = Arc::clone(self.compositor.device());
            let queue = Arc::clone(self.compositor.queue());
            let drew_under = self
                .under
                .render(&device, &queue, &graphics.under, &self.images)
                .map_err(js_err)?;
            let drew_over = self
                .over
                .render(&device, &queue, &graphics.over, &self.images)
                .map_err(js_err)?;
            let overlays = Overlays {
                under: drew_under.then(|| self.under.view()),
                over: drew_over.then(|| self.over.view()),
            };
            let clear = wgpu::Color { r, g, b, a: 1.0 };
            self.compositor
                .render_frame_to_pixels(&frame, clear, overlays)
                .await
                .map_err(js_err)
        }
    }
}
