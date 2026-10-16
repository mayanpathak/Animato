//! Main compositor implementation.
//!
//! Draws the video layers of a frame (media, shapes, lines) on a device it is
//! given, into its own texture, and reads the result back. Text and every
//! other 2D graphic are drawn by Vello (`animato-overlay`) on the same device;
//! the compositor draws the two overlay textures it is handed, one under the
//! layers and one over them.

use std::sync::Arc;

use bytemuck::cast_slice;
use wgpu::{
    util::DeviceExt, BindGroup, BindGroupDescriptor, BindGroupEntry, BindGroupLayout,
    BindingResource, Buffer, BufferDescriptor, BufferUsages, CommandEncoderDescriptor, Device,
    LoadOp, Operations, Queue, RenderPassColorAttachment, RenderPassDescriptor, RenderPipeline,
    StoreOp, TextureViewDescriptor,
};

use crate::color_grading_uniforms::ColorGradingUniforms;
use crate::error::{CompositorError, Result};
use crate::overlay::OverlayPass;
use crate::pipeline::{
    create_bind_group_layout, create_color_grading_bind_group_layout, create_pipeline,
};
use crate::shape_pipeline::{create_shape_bind_group_layout, create_shape_pipeline, ShapeUniforms};
use crate::texture::{TextureInfo, TextureManager};
use crate::uniforms::LayerUniforms;
use tooscut_types::{LineLayerData, MediaLayerData, RenderFrame, ShapeLayerData, TransitionEffect};

#[cfg(target_arch = "wasm32")]
use web_sys::ImageBitmap;

/// The format of the compositor's target: RGBA bytes, as read back for
/// `VideoFrame`s and `ImageData`. Values are sRGB-encoded; nothing converts.
pub const TARGET_FORMAT: wgpu::TextureFormat = wgpu::TextureFormat::Rgba8Unorm;

/// Convert f32 to IEEE 754 half-precision (f16) stored as u16.
fn f32_to_f16(value: f32) -> u16 {
    let bits = value.to_bits();
    let sign = (bits >> 16) & 0x8000;
    let exponent = ((bits >> 23) & 0xFF) as i32;
    let mantissa = bits & 0x7FFFFF;

    if exponent == 0xFF {
        // Inf/NaN
        return (sign | 0x7C00 | if mantissa != 0 { 0x200 } else { 0 }) as u16;
    }

    let exp = exponent - 127 + 15;
    if exp >= 31 {
        // Overflow → Inf
        return (sign | 0x7C00) as u16;
    }
    if exp <= 0 {
        // Underflow → 0
        return sign as u16;
    }

    (sign | ((exp as u32) << 10) | (mantissa >> 13)) as u16
}

/// A renderable item with its z-index for sorting.
#[derive(Debug)]
enum RenderItem<'a> {
    Media(&'a MediaLayerData),
    Shape(&'a ShapeLayerData),
    Line(&'a LineLayerData),
}

impl RenderItem<'_> {
    fn z_index(&self) -> i32 {
        match self {
            RenderItem::Media(m) => m.z_index,
            RenderItem::Shape(s) => s.z_index,
            RenderItem::Line(l) => l.z_index,
        }
    }
}

/// GPU video compositor on a shared device.
pub struct Compositor {
    device: Arc<Device>,
    queue: Arc<Queue>,
    // Media layer rendering
    pipeline: RenderPipeline,
    bind_group_layout: BindGroupLayout,
    // Color grading
    color_grading_bind_group_layout: BindGroupLayout,
    default_cg_bind_group: BindGroup,
    lut_sampler: wgpu::Sampler,
    /// Identity 2x2x2 LUT texture (passthrough) used when no LUT is loaded.
    default_lut_texture_view: wgpu::TextureView,
    /// Currently loaded 3D LUT texture, keyed by lut_id.
    active_lut: Option<(String, wgpu::TextureView)>,
    // Shape/line rendering
    shape_pipeline: RenderPipeline,
    shape_bind_group_layout: BindGroupLayout,
    /// Draws an overlay texture over the whole target.
    overlay: OverlayPass,
    // Textures
    textures: TextureManager,
    width: u32,
    height: u32,
    // Render target and its readback buffer, both of the current size.
    render_texture: Option<wgpu::Texture>,
    readback_buffer: Option<(Buffer, u64)>,
}

/// The two overlay textures of a frame: Vello's `under` and `over` layers.
#[derive(Clone, Copy, Default)]
pub struct Overlays<'a> {
    pub under: Option<&'a wgpu::TextureView>,
    pub over: Option<&'a wgpu::TextureView>,
}

impl Compositor {
    /// A compositor on `device`, drawing `width` x `height` frames.
    pub fn new(device: Arc<Device>, queue: Arc<Queue>, width: u32, height: u32) -> Result<Self> {
        // Media layer pipeline with color grading support
        let bind_group_layout = create_bind_group_layout(&device);
        let color_grading_bind_group_layout = create_color_grading_bind_group_layout(&device);
        log::info!("[compositor] Creating pipeline...");
        let pipeline = create_pipeline(
            &device,
            &bind_group_layout,
            &color_grading_bind_group_layout,
            TARGET_FORMAT,
        )?;
        log::info!("[compositor] Pipeline created OK");

        // LUT sampler (linear filtering for smooth LUT interpolation)
        let lut_sampler = device.create_sampler(&wgpu::SamplerDescriptor {
            label: Some("lut_sampler"),
            mag_filter: wgpu::FilterMode::Linear,
            min_filter: wgpu::FilterMode::Linear,
            ..Default::default()
        });

        // Default identity LUT (2x2x2, each texel = its own coordinate) in f16
        let default_lut_f32: [f32; 32] = [
            0.0, 0.0, 0.0, 1.0, 1.0, 0.0, 0.0, 1.0, 0.0, 1.0, 0.0, 1.0, 1.0, 1.0, 0.0, 1.0, 0.0,
            0.0, 1.0, 1.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0,
        ];
        let default_lut_data: Vec<u16> = default_lut_f32.iter().map(|&f| f32_to_f16(f)).collect();
        let default_lut_texture = device.create_texture_with_data(
            &queue,
            &wgpu::TextureDescriptor {
                label: Some("default_lut_3d"),
                size: wgpu::Extent3d {
                    width: 2,
                    height: 2,
                    depth_or_array_layers: 2,
                },
                mip_level_count: 1,
                sample_count: 1,
                dimension: wgpu::TextureDimension::D3,
                format: wgpu::TextureFormat::Rgba16Float,
                usage: wgpu::TextureUsages::TEXTURE_BINDING | wgpu::TextureUsages::COPY_DST,
                view_formats: &[],
            },
            wgpu::util::TextureDataOrder::default(),
            cast_slice(&default_lut_data),
        );
        let default_lut_texture_view =
            default_lut_texture.create_view(&wgpu::TextureViewDescriptor::default());

        // Create cached default color grading bind group (no-op)
        let default_cg_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("default_cg_buffer"),
            contents: cast_slice(&[ColorGradingUniforms::default()]),
            usage: BufferUsages::UNIFORM,
        });
        let default_cg_bind_group = device.create_bind_group(&BindGroupDescriptor {
            label: Some("default_cg_bind_group"),
            layout: &color_grading_bind_group_layout,
            entries: &[
                BindGroupEntry {
                    binding: 0,
                    resource: default_cg_buffer.as_entire_binding(),
                },
                BindGroupEntry {
                    binding: 1,
                    resource: BindingResource::TextureView(&default_lut_texture_view),
                },
                BindGroupEntry {
                    binding: 2,
                    resource: BindingResource::Sampler(&lut_sampler),
                },
            ],
        });

        let textures = TextureManager::new(&device);

        // Shape/line pipeline
        let shape_bind_group_layout = create_shape_bind_group_layout(&device);
        let shape_pipeline =
            create_shape_pipeline(&device, &shape_bind_group_layout, TARGET_FORMAT);

        let overlay = OverlayPass::new(&device, TARGET_FORMAT);

        Ok(Self {
            device,
            queue,
            pipeline,
            bind_group_layout,
            color_grading_bind_group_layout,
            default_cg_bind_group,
            lut_sampler,
            default_lut_texture_view,
            active_lut: None,
            shape_pipeline,
            shape_bind_group_layout,
            overlay,
            textures,
            width: width.max(1),
            height: height.max(1),
            render_texture: None,
            readback_buffer: None,
        })
    }

    pub fn device(&self) -> &Arc<Device> {
        &self.device
    }

    pub fn queue(&self) -> &Arc<Queue> {
        &self.queue
    }

    pub fn width(&self) -> u32 {
        self.width
    }

    pub fn height(&self) -> u32 {
        self.height
    }

    /// A new output size. The render target and readback buffer follow on the next frame.
    pub fn resize(&mut self, width: u32, height: u32) {
        if width == 0 || height == 0 {
            return;
        }
        self.width = width;
        self.height = height;
    }

    /// Uploads an `ImageBitmap` with `copy_external_image_to_texture`.
    #[cfg(target_arch = "wasm32")]
    pub fn upload_bitmap(&mut self, bitmap: &ImageBitmap, texture_id: &str) -> Result<()> {
        self.textures
            .upload_bitmap(&self.device, &self.queue, texture_id, bitmap)
    }

    /// Uploads RGBA pixels.
    pub fn upload_rgba(
        &mut self,
        texture_id: &str,
        width: u32,
        height: u32,
        data: &[u8],
    ) -> Result<()> {
        self.textures
            .upload(&self.device, &self.queue, texture_id, width, height, data)
    }

    pub fn clear_texture(&mut self, texture_id: &str) {
        self.textures.remove(texture_id);
    }

    pub fn clear_all_textures(&mut self) {
        self.textures.clear();
    }

    /// Uploads a 3D LUT: `size^3 * 4` RGBA floats.
    pub fn upload_lut(&mut self, lut_id: &str, size: u32, data: &[f32]) -> Result<()> {
        self.upload_lut_internal(lut_id, size, data)
    }

    /// Back to the identity (passthrough) LUT.
    pub fn remove_lut(&mut self) {
        self.active_lut = None;
    }

    /// Upload a 3D LUT texture from RGBA float data.
    fn upload_lut_internal(&mut self, lut_id: &str, size: u32, data: &[f32]) -> Result<()> {
        let expected = (size * size * size * 4) as usize;
        if data.len() != expected {
            return Err(CompositorError::Serialization(format!(
                "LUT data size mismatch: expected {} floats, got {}",
                expected,
                data.len()
            )));
        }

        // Convert f32 RGBA data to f16 RGBA for GPU (Rgba16Float supports filtering)
        let f16_data: Vec<u16> = data.iter().map(|&f| f32_to_f16(f)).collect();

        let texture = self.device.create_texture(&wgpu::TextureDescriptor {
            label: Some("lut_3d"),
            size: wgpu::Extent3d {
                width: size,
                height: size,
                depth_or_array_layers: size,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D3,
            format: wgpu::TextureFormat::Rgba16Float,
            usage: wgpu::TextureUsages::TEXTURE_BINDING | wgpu::TextureUsages::COPY_DST,
            view_formats: &[],
        });

        let bytes_per_row = size * 4 * 2; // width * 4 channels * 2 bytes per f16
        self.queue.write_texture(
            wgpu::TexelCopyTextureInfo {
                texture: &texture,
                mip_level: 0,
                origin: wgpu::Origin3d::ZERO,
                aspect: wgpu::TextureAspect::All,
            },
            cast_slice(&f16_data),
            wgpu::TexelCopyBufferLayout {
                offset: 0,
                bytes_per_row: Some(bytes_per_row),
                rows_per_image: Some(size),
            },
            wgpu::Extent3d {
                width: size,
                height: size,
                depth_or_array_layers: size,
            },
        );

        let view = texture.create_view(&wgpu::TextureViewDescriptor::default());
        self.active_lut = Some((lut_id.to_string(), view));

        log::info!(
            "[compositor] Uploaded 3D LUT '{}' ({}x{}x{})",
            lut_id,
            size,
            size,
            size
        );
        Ok(())
    }

    /// Ensure the render texture exists and matches the current size.
    fn ensure_render_texture(&mut self) {
        let stale = self
            .render_texture
            .as_ref()
            .is_none_or(|t| t.size().width != self.width || t.size().height != self.height);
        if stale {
            self.render_texture = Some(self.device.create_texture(&wgpu::TextureDescriptor {
                label: Some("render_texture"),
                size: wgpu::Extent3d {
                    width: self.width,
                    height: self.height,
                    depth_or_array_layers: 1,
                },
                mip_level_count: 1,
                sample_count: 1,
                dimension: wgpu::TextureDimension::D2,
                format: TARGET_FORMAT,
                usage: wgpu::TextureUsages::RENDER_ATTACHMENT | wgpu::TextureUsages::COPY_SRC,
                view_formats: &[],
            }));
        }
        let bytes_per_row = (self.width * 4).div_ceil(256) * 256;
        let size = u64::from(bytes_per_row) * u64::from(self.height);
        if self
            .readback_buffer
            .as_ref()
            .is_none_or(|(_, s)| *s != size)
        {
            let buffer = self.device.create_buffer(&BufferDescriptor {
                label: Some("readback_buffer"),
                size,
                usage: BufferUsages::COPY_DST | BufferUsages::MAP_READ,
                mapped_at_creation: false,
            });
            self.readback_buffer = Some((buffer, size));
        }
    }

    /// Draws `under`, the frame's layers in z order, then `over`, into `view`.
    fn render_to_view(
        &mut self,
        encoder: &mut wgpu::CommandEncoder,
        view: &wgpu::TextureView,
        frame: &RenderFrame,
        clear_color: wgpu::Color,
        overlays: Overlays<'_>,
    ) {
        let mut items: Vec<RenderItem> = Vec::new();
        items.extend(frame.media_layers.iter().map(RenderItem::Media));
        items.extend(frame.shape_layers.iter().map(RenderItem::Shape));
        items.extend(frame.line_layers.iter().map(RenderItem::Line));
        // Stable: items of one z keep the frame's order.
        items.sort_by_key(|item| item.z_index());
        let under = overlays.under.map(|v| self.overlay.bind(&self.device, v));
        let over = overlays.over.map(|v| self.overlay.bind(&self.device, v));

        // Every draw has its own uniform buffer, so one pass holds them all.
        let mut render_pass = encoder.begin_render_pass(&RenderPassDescriptor {
            label: Some("compositor_render_pass"),
            color_attachments: &[Some(RenderPassColorAttachment {
                view,
                depth_slice: None,
                resolve_target: None,
                ops: Operations {
                    load: LoadOp::Clear(clear_color),
                    store: StoreOp::Store,
                },
            })],
            depth_stencil_attachment: None,
            timestamp_writes: None,
            occlusion_query_set: None,
            multiview_mask: None,
        });
        if let Some(group) = &under {
            self.overlay.draw(&mut render_pass, group);
        }
        for item in &items {
            match item {
                RenderItem::Media(layer) => {
                    if let Some(texture_info) = self.textures.get(&layer.texture_id) {
                        self.render_media_layer(&mut render_pass, layer, texture_info);
                    }
                }
                RenderItem::Shape(shape) => self.render_shape(&mut render_pass, shape),
                RenderItem::Line(line) => self.render_line(&mut render_pass, line),
            }
        }
        if let Some(group) = &over {
            self.overlay.draw(&mut render_pass, group);
        }
    }

    /// Renders a frame (with its overlays) and returns its RGBA pixels.
    pub async fn render_frame_to_pixels(
        &mut self,
        frame: &RenderFrame,
        clear_color: wgpu::Color,
        overlays: Overlays<'_>,
    ) -> Result<Vec<u8>> {
        let (width, height) = (self.width, self.height);
        self.ensure_render_texture();
        let bytes_per_row = (width * 4).div_ceil(256) * 256;

        let mut encoder = self
            .device
            .create_command_encoder(&CommandEncoderDescriptor {
                label: Some("frame_encoder"),
            });
        let render_texture = self.render_texture.clone().expect("made above");
        let view = render_texture.create_view(&TextureViewDescriptor::default());
        self.render_to_view(&mut encoder, &view, frame, clear_color, overlays);

        let (readback_buffer, _) = self.readback_buffer.as_ref().expect("made above");
        encoder.copy_texture_to_buffer(
            wgpu::TexelCopyTextureInfo {
                texture: &render_texture,
                mip_level: 0,
                origin: wgpu::Origin3d::ZERO,
                aspect: wgpu::TextureAspect::All,
            },
            wgpu::TexelCopyBufferInfo {
                buffer: readback_buffer,
                layout: wgpu::TexelCopyBufferLayout {
                    offset: 0,
                    bytes_per_row: Some(bytes_per_row),
                    rows_per_image: Some(height),
                },
            },
            wgpu::Extent3d {
                width,
                height,
                depth_or_array_layers: 1,
            },
        );
        self.queue.submit(std::iter::once(encoder.finish()));

        // On WebGPU the map callback fires from the browser's own promise; on
        // native backends a poll drives it.
        let buffer_slice = readback_buffer.slice(..);
        let (tx, rx) = futures::channel::oneshot::channel();
        buffer_slice.map_async(wgpu::MapMode::Read, move |result| {
            let _ = tx.send(result);
        });
        #[cfg(not(target_arch = "wasm32"))]
        let _ = self.device.poll(wgpu::PollType::wait_indefinitely());
        rx.await
            .map_err(|_| CompositorError::BufferMap("Channel closed".into()))?
            .map_err(|e| CompositorError::BufferMap(e.to_string()))?;

        // Remove the row padding.
        let mapped = buffer_slice
            .get_mapped_range()
            .map_err(|e| CompositorError::BufferMap(e.to_string()))?;
        let mut result = Vec::with_capacity((width * height * 4) as usize);
        for y in 0..height {
            let start = (y * bytes_per_row) as usize;
            result.extend_from_slice(&mapped[start..start + (width * 4) as usize]);
        }
        drop(mapped);
        readback_buffer.unmap();
        Ok(result)
    }

    /// Calculate the combined transition effect for a media layer.
    ///
    /// Combines transition_in, transition_out, and cross_transition effects.
    /// Returns the merged TransitionEffect (opacity multiplier, offsets, scale, rotation).
    fn calculate_transition_effect(
        layer: &MediaLayerData,
        canvas_width: f32,
        canvas_height: f32,
    ) -> TransitionEffect {
        let mut effect = TransitionEffect::NONE;

        // Apply transition in (direction = 1.0 for "in")
        if let Some(ref t_in) = layer.transition_in {
            let e = TransitionEffect::calculate(
                t_in.transition.transition_type,
                t_in.eased_progress(),
                canvas_width,
                canvas_height,
                1.0,
            );
            // Skip opacity for wipe transitions — shader handles wipe masking
            if !t_in.transition.transition_type.is_wipe() {
                effect.opacity *= e.opacity;
            }
            effect.x_offset += e.x_offset;
            effect.y_offset += e.y_offset;
            effect.scale_x *= e.scale_x;
            effect.scale_y *= e.scale_y;
            effect.rotation += e.rotation;
        }

        // Apply transition out: invert progress so 0→1 means disappearing.
        // TransitionEffect::calculate is designed for "in" (0=invisible, 1=visible),
        // so we pass (1 - progress) to reverse the effect direction.
        if let Some(ref t_out) = layer.transition_out {
            let e = TransitionEffect::calculate(
                t_out.transition.transition_type,
                1.0 - t_out.eased_progress(),
                canvas_width,
                canvas_height,
                -1.0,
            );
            // Skip opacity for wipe transitions — shader handles wipe masking
            if !t_out.transition.transition_type.is_wipe() {
                effect.opacity *= e.opacity;
            }
            effect.x_offset += e.x_offset;
            effect.y_offset += e.y_offset;
            effect.scale_x *= e.scale_x;
            effect.scale_y *= e.scale_y;
            effect.rotation += e.rotation;
        }

        // Apply cross-transition
        if let Some(ref ct) = layer.cross_transition {
            if ct.cross_transition.transition_type.is_wipe() {
                // Wipe transitions use shader-based masking on the incoming clip.
                // The outgoing clip stays fully visible underneath; the incoming
                // clip renders on top with a wipe mask that progressively covers it.
                // No opacity modification needed here.
            } else {
                // Dissolve/Fade: opacity-based blending
                effect.opacity *= ct.opacity();
            }
        }

        effect
    }

    /// Render a media layer.
    fn render_media_layer<'a>(
        &'a self,
        render_pass: &mut wgpu::RenderPass<'a>,
        layer: &MediaLayerData,
        texture_info: &'a TextureInfo,
    ) {
        render_pass.set_pipeline(&self.pipeline);

        let cw = self.width as f32;
        let ch = self.height as f32;

        // Calculate transition effect (modifies transform + opacity)
        let t_effect = Self::calculate_transition_effect(layer, cw, ch);

        // Apply transition to a copy of the transform
        let mut transform = layer.transform;
        transform.x += t_effect.x_offset;
        transform.y += t_effect.y_offset;
        transform.scale_x *= t_effect.scale_x;
        transform.scale_y *= t_effect.scale_y;
        transform.rotation += t_effect.rotation;

        // Calculate transform matrix with transition-modified transform
        let matrix = transform.to_matrix(
            self.width,
            self.height,
            texture_info.width as f32,
            texture_info.height as f32,
        );

        // Apply transition opacity to effects
        let mut effects = layer.effects;
        effects.opacity *= t_effect.opacity;

        // Build uniforms
        let mut uniforms = LayerUniforms::from_matrix(matrix)
            .with_effects(&effects)
            .with_texture_size(texture_info.width, texture_info.height);

        if let Some(crop) = &layer.crop {
            uniforms = uniforms.with_crop(crop);
        }

        // Set wipe transition uniforms for shader-based wipe masking.
        // Priority: cross-transition wipe > clip transition-in wipe > clip transition-out wipe
        if let Some(ref ct) = layer.cross_transition {
            if ct.cross_transition.transition_type.is_wipe() && !ct.is_outgoing {
                uniforms = uniforms.with_transition(
                    ct.cross_transition.transition_type.to_transition_type(),
                    ct.eased_progress(),
                );
            }
        } else if let Some(ref t_in) = layer.transition_in {
            if t_in.transition.transition_type.is_wipe() {
                // For transition-in: progress 0→1 reveals the clip
                uniforms = uniforms
                    .with_transition(t_in.transition.transition_type, t_in.eased_progress());
            }
        } else if let Some(ref t_out) = layer.transition_out {
            if t_out.transition.transition_type.is_wipe() {
                // For transition-out: progress 0→1 hides the clip, so invert
                uniforms = uniforms.with_transition(
                    t_out.transition.transition_type,
                    1.0 - t_out.eased_progress(),
                );
            }
        }

        // Create a per-layer uniform buffer with data immediately available.
        // Using create_buffer_init ensures each layer has its own uniform data,
        // preventing later layers from overwriting earlier layers' uniforms
        // (which happens with queue.write_buffer on a shared buffer since
        // all writes execute before the render pass).
        let uniform_buffer = self
            .device
            .create_buffer_init(&wgpu::util::BufferInitDescriptor {
                label: Some("layer_uniform_buffer"),
                contents: cast_slice(&[uniforms]),
                usage: BufferUsages::UNIFORM | BufferUsages::COPY_DST,
            });

        // Create bind group for this layer
        let bind_group = self.device.create_bind_group(&BindGroupDescriptor {
            label: Some("layer_bind_group"),
            layout: &self.bind_group_layout,
            entries: &[
                BindGroupEntry {
                    binding: 0,
                    resource: uniform_buffer.as_entire_binding(),
                },
                BindGroupEntry {
                    binding: 1,
                    resource: BindingResource::TextureView(&texture_info.view),
                },
                BindGroupEntry {
                    binding: 2,
                    resource: BindingResource::Sampler(self.textures.sampler()),
                },
            ],
        });

        render_pass.set_bind_group(0, &bind_group, &[]);

        // Set color grading bind group (group 1)
        if let Some(cg) = &layer.color_grading {
            let cg_uniforms = ColorGradingUniforms::from_color_grading(cg);
            let cg_buffer = self
                .device
                .create_buffer_init(&wgpu::util::BufferInitDescriptor {
                    label: Some("cg_uniform_buffer"),
                    contents: cast_slice(&[cg_uniforms]),
                    usage: BufferUsages::UNIFORM | BufferUsages::COPY_DST,
                });

            // Use active LUT texture if loaded, otherwise default
            let has_active_lut = self.active_lut.is_some();
            let lut_view = self
                .active_lut
                .as_ref()
                .map(|(_, view)| view)
                .unwrap_or(&self.default_lut_texture_view);
            if cg_uniforms.flags & crate::color_grading_uniforms::FLAG_LUT_ENABLED != 0 {
                log::info!(
                    "[compositor] LUT enabled, active_lut={}, lut_mix={}",
                    has_active_lut,
                    cg_uniforms.lut_mix
                );
            }

            let cg_bind_group = self.device.create_bind_group(&BindGroupDescriptor {
                label: Some("cg_bind_group"),
                layout: &self.color_grading_bind_group_layout,
                entries: &[
                    BindGroupEntry {
                        binding: 0,
                        resource: cg_buffer.as_entire_binding(),
                    },
                    BindGroupEntry {
                        binding: 1,
                        resource: BindingResource::TextureView(lut_view),
                    },
                    BindGroupEntry {
                        binding: 2,
                        resource: BindingResource::Sampler(&self.lut_sampler),
                    },
                ],
            });
            render_pass.set_bind_group(1, &cg_bind_group, &[]);
        } else {
            render_pass.set_bind_group(1, &self.default_cg_bind_group, &[]);
        }

        render_pass.draw(0..6, 0..1); // Triangle list (6 vertices, 2 triangles)
    }

    /// Render a shape layer.
    fn render_shape<'a>(&'a self, render_pass: &mut wgpu::RenderPass<'a>, shape: &ShapeLayerData) {
        render_pass.set_pipeline(&self.shape_pipeline);

        let uniforms = ShapeUniforms::from_shape(shape, self.width, self.height);

        // Create a new buffer with the uniform data immediately available
        // (using create_buffer_init ensures data is ready for this draw call)
        let uniform_buffer = self
            .device
            .create_buffer_init(&wgpu::util::BufferInitDescriptor {
                label: Some("shape_uniform_buffer"),
                contents: cast_slice(&[uniforms]),
                usage: BufferUsages::UNIFORM | BufferUsages::COPY_DST,
            });

        let bind_group = self.device.create_bind_group(&BindGroupDescriptor {
            label: Some("shape_bind_group"),
            layout: &self.shape_bind_group_layout,
            entries: &[BindGroupEntry {
                binding: 0,
                resource: uniform_buffer.as_entire_binding(),
            }],
        });

        render_pass.set_bind_group(0, &bind_group, &[]);
        render_pass.draw(0..6, 0..1); // Triangle list (6 vertices, 2 triangles)
    }

    /// Render a line layer.
    fn render_line<'a>(&'a self, render_pass: &mut wgpu::RenderPass<'a>, line: &LineLayerData) {
        render_pass.set_pipeline(&self.shape_pipeline);

        let uniforms = ShapeUniforms::from_line(line, self.width, self.height);

        // Create a new buffer with the uniform data immediately available
        let uniform_buffer = self
            .device
            .create_buffer_init(&wgpu::util::BufferInitDescriptor {
                label: Some("line_uniform_buffer"),
                contents: cast_slice(&[uniforms]),
                usage: BufferUsages::UNIFORM | BufferUsages::COPY_DST,
            });

        let bind_group = self.device.create_bind_group(&BindGroupDescriptor {
            label: Some("line_bind_group"),
            layout: &self.shape_bind_group_layout,
            entries: &[BindGroupEntry {
                binding: 0,
                resource: uniform_buffer.as_entire_binding(),
            }],
        });

        render_pass.set_bind_group(0, &bind_group, &[]);
        render_pass.draw(0..4, 0..1); // Triangle strip
    }
}
