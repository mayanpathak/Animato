//! The overlay: a display list drawn by Vello into a texture as large as the
//! target. This file reads a list command by command and knows nothing of
//! what the commands mean.

use std::collections::BTreeMap;
use std::collections::btree_map::Entry;
use std::sync::Arc;

use offcut_scene::fonts;
use offcut_scene::layout::normalized_coords;
use offcut_scene::{Affine, DisplayList, DrawCmd, FontId, PathEl, Rect, Rgba};
use vello::kurbo;
use vello::peniko::{Blob, Color, Fill, FontData, Mix};

use crate::RenderError;

/// What Vello renders into: this format, and written by a compute shader.
const OVERLAY_FORMAT: wgpu::TextureFormat = wgpu::TextureFormat::Rgba8Unorm;

/// A font as Vello takes it: the file, and where on its axes the font stands.
struct Face {
    data: FontData,
    coords: Vec<i16>,
}

pub(crate) struct Overlay {
    renderer: vello::Renderer,
    /// Kept between frames for its allocations; emptied before each.
    scene: vello::Scene,
    view: wgpu::TextureView,
    width: u32,
    height: u32,
    /// Each font is read on its first use.
    faces: BTreeMap<FontId, Face>,
}

fn texture_view(device: &wgpu::Device, width: u32, height: u32) -> wgpu::TextureView {
    let texture = device.create_texture(&wgpu::TextureDescriptor {
        label: Some("overlay"),
        size: wgpu::Extent3d {
            width,
            height,
            depth_or_array_layers: 1,
        },
        mip_level_count: 1,
        sample_count: 1,
        dimension: wgpu::TextureDimension::D2,
        format: OVERLAY_FORMAT,
        usage: wgpu::TextureUsages::STORAGE_BINDING | wgpu::TextureUsages::TEXTURE_BINDING,
        view_formats: &[],
    });
    texture.create_view(&wgpu::TextureViewDescriptor::default())
}

fn color(c: Rgba) -> Color {
    Color::from_rgba8(c.r, c.g, c.b, c.a)
}

fn affine(a: &Affine) -> kurbo::Affine {
    kurbo::Affine::new(a.m.map(f64::from))
}

fn rect(r: &Rect) -> kurbo::Rect {
    let (x, y) = (f64::from(r.x), f64::from(r.y));
    kurbo::Rect::new(x, y, x + f64::from(r.w), y + f64::from(r.h))
}

fn path(elements: &[PathEl]) -> kurbo::BezPath {
    let point = |x: f32, y: f32| kurbo::Point::new(f64::from(x), f64::from(y));
    let mut path = kurbo::BezPath::new();
    for element in elements {
        match *element {
            PathEl::MoveTo(x, y) => path.move_to(point(x, y)),
            PathEl::LineTo(x, y) => path.line_to(point(x, y)),
            PathEl::QuadTo(a, b, x, y) => path.quad_to(point(a, b), point(x, y)),
            PathEl::CurveTo(a, b, c, d, x, y) => {
                path.curve_to(point(a, b), point(c, d), point(x, y));
            }
            PathEl::Close => path.close_path(),
        }
    }
    path
}

impl Overlay {
    pub fn new(device: &wgpu::Device, width: u32, height: u32) -> Result<Overlay, RenderError> {
        let options = vello::RendererOptions {
            use_cpu: false,
            // The one method `render` asks for.
            antialiasing_support: vello::AaSupport::area_only(),
            num_init_threads: None,
            pipeline_cache: None,
        };
        let renderer = vello::Renderer::new(device, options).map_err(|_| RenderError::Overlay)?;
        Ok(Overlay {
            renderer,
            scene: vello::Scene::new(),
            view: texture_view(device, width, height),
            width,
            height,
            faces: BTreeMap::new(),
        })
    }

    pub fn view(&self) -> &wgpu::TextureView {
        &self.view
    }

    /// A texture of the new size. The caller asks only when the size changed.
    pub fn resize(&mut self, device: &wgpu::Device, width: u32, height: u32) {
        self.view = texture_view(device, width, height);
        self.width = width;
        self.height = height;
    }

    /// The file and the axis coordinates of `font`, read once.
    fn face(faces: &mut BTreeMap<FontId, Face>, font: FontId) -> Result<&Face, RenderError> {
        if let Entry::Vacant(slot) = faces.entry(font) {
            let coords = normalized_coords(font).map_err(|_| RenderError::Overlay)?;
            let data = FontData::new(Blob::new(Arc::new(fonts::bytes(font))), 0);
            slot.insert(Face { data, coords });
        }
        faces.get(&font).ok_or(RenderError::Overlay)
    }

    /// Draws `list` into the overlay texture, over nothing: where the list
    /// draws nothing the texture is transparent.
    pub fn render(
        &mut self,
        device: &wgpu::Device,
        queue: &wgpu::Queue,
        list: &DisplayList,
    ) -> Result<(), RenderError> {
        self.scene.reset();
        let whole = kurbo::Rect::new(0.0, 0.0, f64::from(self.width), f64::from(self.height));
        let mut layers = 0u32;
        for cmd in &list.cmds {
            match cmd {
                DrawCmd::FillRect {
                    rect: r,
                    radius,
                    color: c,
                } => {
                    let shape = kurbo::RoundedRect::from_rect(rect(r), f64::from(*radius));
                    self.scene.fill(
                        Fill::NonZero,
                        kurbo::Affine::IDENTITY,
                        color(*c),
                        None,
                        &shape,
                    );
                }
                DrawCmd::FillPath { path: p, color: c } => {
                    let shape = path(p);
                    self.scene.fill(
                        Fill::NonZero,
                        kurbo::Affine::IDENTITY,
                        color(*c),
                        None,
                        &shape,
                    );
                }
                DrawCmd::GlyphRun {
                    font,
                    size,
                    glyphs,
                    fill,
                    stroke,
                    transform,
                    text: _,
                } => {
                    let face = Self::face(&mut self.faces, *font)?;
                    let glyphs = || {
                        glyphs.iter().map(|glyph| vello::Glyph {
                            id: glyph.id,
                            x: glyph.x,
                            y: glyph.y,
                        })
                    };
                    // The stroke first and the fill over it (D-68): a stroke
                    // lies half inside the outline, and drawn last it
                    // would cover that much of each letter.
                    if let Some(stroke) = stroke {
                        let style = kurbo::Stroke::new(f64::from(stroke.width));
                        self.scene
                            .draw_glyphs(&face.data)
                            .font_size(*size)
                            .normalized_coords(&face.coords)
                            .transform(affine(transform))
                            .brush(color(stroke.color))
                            .draw(&style, glyphs());
                    }
                    self.scene
                        .draw_glyphs(&face.data)
                        .font_size(*size)
                        .normalized_coords(&face.coords)
                        .transform(affine(transform))
                        .brush(color(*fill))
                        .draw(Fill::NonZero, glyphs());
                }
                DrawCmd::PushLayer { opacity, clip } => {
                    let clip = clip.as_ref().map_or(whole, rect);
                    self.scene.push_layer(
                        Fill::NonZero,
                        Mix::Normal,
                        *opacity,
                        kurbo::Affine::IDENTITY,
                        &clip,
                    );
                    layers = layers.saturating_add(1);
                }
                DrawCmd::PopLayer => {
                    // A pop without a push would close a layer that is not there.
                    if layers > 0 {
                        self.scene.pop_layer();
                        layers -= 1;
                    }
                }
            }
        }
        // A list that leaves a layer open is closed here, so that it cannot
        // reach into the next frame.
        for _ in 0..layers {
            self.scene.pop_layer();
        }

        let params = vello::RenderParams {
            base_color: Color::TRANSPARENT,
            width: self.width,
            height: self.height,
            antialiasing_method: vello::AaConfig::Area,
        };
        self.renderer
            .render_to_texture(device, queue, &self.scene, &self.view, &params)
            .map_err(|_| RenderError::Overlay)
    }
}
