//! The source frame: copied into a texture, then drawn to the target turned
//! and cropped. A `VideoFrame` is read here and never closed (TS §19.6).

use offcut_scene::CropRect;
use offcut_types::Rotation;
use web_sys::VideoFrame;

use crate::RenderError;

/// The texture a frame is copied into, with what draws it.
struct FrameTexture {
    texture: wgpu::Texture,
    bind_group: wgpu::BindGroup,
    width: u32,
    height: u32,
}

pub(crate) struct VideoPass {
    pipeline: wgpu::RenderPipeline,
    layout: wgpu::BindGroupLayout,
    sampler: wgpu::Sampler,
    placement: wgpu::Buffer,
    /// Made for the first frame, and again only for a frame of another size.
    frame: Option<FrameTexture>,
}

const FRAME_FORMAT: wgpu::TextureFormat = wgpu::TextureFormat::Rgba8Unorm;
/// Two `vec4<f32>`: the `Placement` of `shaders/video.wgsl`.
const PLACEMENT_BYTES: usize = 32;

/// The shader of both passes. Each pipeline uses the entry points it names.
pub(crate) fn shader(device: &wgpu::Device) -> wgpu::ShaderModule {
    device.create_shader_module(wgpu::ShaderModuleDescriptor {
        label: Some("video.wgsl"),
        source: wgpu::ShaderSource::Wgsl(include_str!("shaders/video.wgsl").into()),
    })
}

/// A sampler that reads between pixels and does not wrap.
pub(crate) fn linear_sampler(device: &wgpu::Device) -> wgpu::Sampler {
    device.create_sampler(&wgpu::SamplerDescriptor {
        label: Some("linear"),
        mag_filter: wgpu::FilterMode::Linear,
        min_filter: wgpu::FilterMode::Linear,
        ..Default::default()
    })
}

/// One triangle over the whole target, with the fragment entry point `entry`.
pub(crate) fn whole_target_pipeline(
    device: &wgpu::Device,
    shader: &wgpu::ShaderModule,
    layout: &wgpu::BindGroupLayout,
    entry: &str,
    target: wgpu::TextureFormat,
    blend: Option<wgpu::BlendState>,
) -> wgpu::RenderPipeline {
    let pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
        label: Some(entry),
        bind_group_layouts: &[Some(layout)],
        immediate_size: 0,
    });
    device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
        label: Some(entry),
        layout: Some(&pipeline_layout),
        vertex: wgpu::VertexState {
            module: shader,
            entry_point: Some("whole_target"),
            compilation_options: wgpu::PipelineCompilationOptions::default(),
            buffers: &[],
        },
        primitive: wgpu::PrimitiveState::default(),
        depth_stencil: None,
        multisample: wgpu::MultisampleState::default(),
        fragment: Some(wgpu::FragmentState {
            module: shader,
            entry_point: Some(entry),
            compilation_options: wgpu::PipelineCompilationOptions::default(),
            targets: &[Some(wgpu::ColorTargetState {
                format: target,
                blend,
                write_mask: wgpu::ColorWrites::ALL,
            })],
        }),
        multiview_mask: None,
        cache: None,
    })
}

pub(crate) fn texture_entry(binding: u32) -> wgpu::BindGroupLayoutEntry {
    wgpu::BindGroupLayoutEntry {
        binding,
        visibility: wgpu::ShaderStages::FRAGMENT,
        ty: wgpu::BindingType::Texture {
            sample_type: wgpu::TextureSampleType::Float { filterable: true },
            view_dimension: wgpu::TextureViewDimension::D2,
            multisampled: false,
        },
        count: None,
    }
}

pub(crate) fn sampler_entry(binding: u32) -> wgpu::BindGroupLayoutEntry {
    wgpu::BindGroupLayoutEntry {
        binding,
        visibility: wgpu::ShaderStages::FRAGMENT,
        ty: wgpu::BindingType::Sampler(wgpu::SamplerBindingType::Filtering),
        count: None,
    }
}

/// The six numbers that say where a point `(u, v)` of the target lies in the
/// frame's texture: `(a*u + c*v + e, b*u + d*v + f)`, as `[a, b, c, d, e, f]`.
/// Both are measured from 0,0 at the top-left to 1,1 at the bottom-right.
///
/// `crop` is in display pixels: of the frame as it is shown, after its
/// rotation. `frame` is the size of the frame as it is stored, before it. A
/// frame turned a quarter is as wide on the display as it is high in store.
pub(crate) fn placement(crop: CropRect, rotation: Rotation, frame: (u32, u32)) -> [f32; 6] {
    let (stored_w, stored_h) = (frame.0.max(1) as f32, frame.1.max(1) as f32);
    let (display_w, display_h) = match rotation {
        Rotation::R0 | Rotation::R180 => (stored_w, stored_h),
        Rotation::R90 | Rotation::R270 => (stored_h, stored_w),
    };
    // The crop as shares of the display: where it starts and how far it goes.
    let (x, w) = (crop.x / display_w, crop.w / display_w);
    let (y, h) = (crop.y / display_h, crop.h / display_h);
    // A display point `(du, dv) = (x + u*w, y + v*h)` in the stored frame:
    // R0 `(du, dv)`; R90, shown turned a quarter clockwise, `(dv, 1 - du)`;
    // R180 `(1 - du, 1 - dv)`; R270 `(1 - dv, du)`.
    match rotation {
        Rotation::R0 => [w, 0.0, 0.0, h, x, y],
        Rotation::R90 => [0.0, -w, h, 0.0, y, 1.0 - x],
        Rotation::R180 => [-w, 0.0, 0.0, -h, 1.0 - x, 1.0 - y],
        Rotation::R270 => [0.0, w, -h, 0.0, 1.0 - y, x],
    }
}

/// Copies the frame into `texture`, which is `size` large. The copy exists
/// in a browser only.
#[cfg(target_arch = "wasm32")]
fn import(
    queue: &wgpu::Queue,
    frame: &VideoFrame,
    texture: &wgpu::Texture,
    size: (u32, u32),
) -> Result<(), RenderError> {
    // Rust's `Clone`: a second handle to the same JavaScript object, which
    // closes nothing when it is dropped. `frame.clone()` would be the
    // browser's `VideoFrame.clone()`, a new frame that somebody must close.
    let handle: VideoFrame = Clone::clone(frame);
    let source = wgpu::CopyExternalImageSourceInfo {
        source: wgpu::ExternalImageSource::VideoFrame(handle),
        origin: wgpu::Origin2d::ZERO,
        flip_y: false,
    };
    let destination = wgpu::CopyExternalImageDestInfo {
        texture,
        mip_level: 0,
        origin: wgpu::Origin3d::ZERO,
        aspect: wgpu::TextureAspect::All,
        color_space: wgpu::PredefinedColorSpace::Srgb,
        premultiplied_alpha: false,
    };
    let extent = wgpu::Extent3d {
        width: size.0,
        height: size.1,
        depth_or_array_layers: 1,
    };
    queue.copy_external_image_to_texture(&source, destination, extent);
    Ok(())
}

/// V4: an image in memory takes the place of the frame (`render_to_image`).
#[cfg(not(target_arch = "wasm32"))]
fn import(
    _queue: &wgpu::Queue,
    _frame: &VideoFrame,
    _texture: &wgpu::Texture,
    _size: (u32, u32),
) -> Result<(), RenderError> {
    Err(RenderError::FrameImport)
}

impl VideoPass {
    pub fn new(
        device: &wgpu::Device,
        shader: &wgpu::ShaderModule,
        target: wgpu::TextureFormat,
    ) -> VideoPass {
        let layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("video"),
            entries: &[
                texture_entry(0),
                sampler_entry(1),
                wgpu::BindGroupLayoutEntry {
                    binding: 2,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Uniform,
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
            ],
        });
        let placement = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("placement"),
            size: PLACEMENT_BYTES as u64,
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });
        VideoPass {
            pipeline: whole_target_pipeline(device, shader, &layout, "video", target, None),
            layout,
            sampler: linear_sampler(device),
            placement,
            frame: None,
        }
    }

    /// The texture for frames of this size, with its bind group.
    fn frame_texture(&self, device: &wgpu::Device, width: u32, height: u32) -> FrameTexture {
        let texture = device.create_texture(&wgpu::TextureDescriptor {
            label: Some("frame"),
            size: wgpu::Extent3d {
                width,
                height,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: FRAME_FORMAT,
            // What the browser asks of the destination of an external copy,
            // and what sampling it needs.
            usage: wgpu::TextureUsages::COPY_DST
                | wgpu::TextureUsages::RENDER_ATTACHMENT
                | wgpu::TextureUsages::TEXTURE_BINDING,
            view_formats: &[],
        });
        let view = texture.create_view(&wgpu::TextureViewDescriptor::default());
        let bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("video"),
            layout: &self.layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: wgpu::BindingResource::TextureView(&view),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: wgpu::BindingResource::Sampler(&self.sampler),
                },
                wgpu::BindGroupEntry {
                    binding: 2,
                    resource: self.placement.as_entire_binding(),
                },
            ],
        });
        FrameTexture {
            texture,
            bind_group,
            width,
            height,
        }
    }

    /// Takes `frame` in and sets where it is drawn. The frame stays the caller's.
    pub fn load(
        &mut self,
        device: &wgpu::Device,
        queue: &wgpu::Queue,
        frame: &VideoFrame,
        crop: CropRect,
        rotation: Rotation,
    ) -> Result<(), RenderError> {
        // A frame that was closed has no size.
        let (width, height) = (frame.display_width(), frame.display_height());
        if width == 0 || height == 0 {
            return Err(RenderError::FrameImport);
        }
        let fits = self
            .frame
            .as_ref()
            .is_some_and(|held| (held.width, held.height) == (width, height));
        if !fits {
            self.frame = Some(self.frame_texture(device, width, height));
        }
        let Some(held) = self.frame.as_ref() else {
            return Err(RenderError::FrameImport);
        };
        import(queue, frame, &held.texture, (held.width, held.height))?;

        let [a, b, c, d, e, f] = placement(crop, rotation, (width, height));
        let mut bytes = [0u8; PLACEMENT_BYTES];
        let values = [a, b, c, d, e, f, 0.0, 0.0];
        for (slot, value) in bytes.as_chunks_mut::<4>().0.iter_mut().zip(values) {
            *slot = value.to_le_bytes();
        }
        queue.write_buffer(&self.placement, 0, &bytes);
        Ok(())
    }

    /// Draws the frame that was loaded over the whole target.
    pub fn draw(&self, pass: &mut wgpu::RenderPass<'_>) {
        let Some(held) = self.frame.as_ref() else {
            return;
        };
        pass.set_pipeline(&self.pipeline);
        pass.set_bind_group(0, &held.bind_group, &[]);
        pass.draw(0..3, 0..1);
    }
}

#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;

    use wgpu::naga;

    use super::*;

    /// No frame is drawn before a browser runs this crate, so the shader is
    /// read here by the compiler the browser build uses: it must be valid,
    /// and each entry point must use the bindings its pipeline gives it and
    /// no other.
    #[test]
    fn the_shader_is_valid_and_each_entry_point_uses_the_bindings_of_its_pipeline() {
        let module = naga::front::wgsl::parse_str(include_str!("shaders/video.wgsl")).unwrap();
        let flags = naga::valid::ValidationFlags::all();
        let info = naga::valid::Validator::new(flags, naga::valid::Capabilities::empty())
            .validate(&module)
            .unwrap();

        let used: BTreeMap<&str, Vec<u32>> = module
            .entry_points
            .iter()
            .enumerate()
            .map(|(index, entry)| {
                let uses = info.get_entry_point(index);
                let mut bindings: Vec<u32> = module
                    .global_variables
                    .iter()
                    .filter(|(handle, _)| !uses[*handle].is_empty())
                    .map(|(_, global)| {
                        let binding = global.binding.as_ref().unwrap();
                        assert_eq!(binding.group, 0);
                        binding.binding
                    })
                    .collect();
                bindings.sort_unstable();
                (entry.name.as_str(), bindings)
            })
            .collect();
        let expected = BTreeMap::from([
            ("whole_target", vec![]),
            // The frame, the sampler and the placement: the layout of `VideoPass::new`.
            ("video", vec![0, 1, 2]),
            // The sampler and the overlay: the layout of `Compositor::new`.
            ("over", vec![1, 3]),
        ]);
        assert_eq!(used, expected);
        let stages: Vec<naga::ShaderStage> = module.entry_points.iter().map(|e| e.stage).collect();
        assert_eq!(stages[0], naga::ShaderStage::Vertex);
        assert_eq!(stages[1..], [naga::ShaderStage::Fragment; 2]);
    }

    /// Where the four corners of the target lie in the stored frame.
    fn corners(m: [f32; 6]) -> [(f32, f32); 4] {
        let [a, b, c, d, e, f] = m;
        [(0.0, 0.0), (1.0, 0.0), (0.0, 1.0), (1.0, 1.0)]
            .map(|(u, v)| (a * u + c * v + e, b * u + d * v + f))
    }

    fn whole(width: f32, height: f32) -> CropRect {
        CropRect {
            x: 0.0,
            y: 0.0,
            w: width,
            h: height,
        }
    }

    #[test]
    fn a_frame_is_turned_as_its_rotation_says_and_cropped_in_display_pixels() {
        // Stored 1920 x 1080. Unturned, the target shows the frame as it is.
        let stored = (1920, 1080);
        let upright = corners(placement(whole(1920.0, 1080.0), Rotation::R0, stored));
        assert_eq!(upright, [(0.0, 0.0), (1.0, 0.0), (0.0, 1.0), (1.0, 1.0)]);

        // Shown turned a quarter clockwise, the display is 1080 x 1920: its
        // top-left is the stored frame's bottom-left, its top-right the
        // stored frame's top-left.
        let quarter = corners(placement(whole(1080.0, 1920.0), Rotation::R90, stored));
        assert_eq!(quarter, [(0.0, 1.0), (0.0, 0.0), (1.0, 1.0), (1.0, 0.0)]);
        let half = corners(placement(whole(1920.0, 1080.0), Rotation::R180, stored));
        assert_eq!(half, [(1.0, 1.0), (0.0, 1.0), (1.0, 0.0), (0.0, 0.0)]);
        let three = corners(placement(whole(1080.0, 1920.0), Rotation::R270, stored));
        assert_eq!(three, [(1.0, 0.0), (1.0, 1.0), (0.0, 0.0), (0.0, 1.0)]);

        // The centre strip of a landscape clip (the crop of the scene crate).
        let strip = CropRect {
            x: 656.25,
            y: 0.0,
            w: 607.5,
            h: 1080.0,
        };
        let [left, right, ..] = corners(placement(strip, Rotation::R0, stored));
        assert_eq!(left, (656.25 / 1920.0, 0.0));
        assert!((right.0 - 1263.75 / 1920.0).abs() < 1e-6 && right.1 == 0.0);

        // A crop of a turned frame is measured on the display: the top 960
        // rows of the 1080 x 1920 display are the left half of the stored frame.
        let top = CropRect {
            x: 0.0,
            y: 0.0,
            w: 1080.0,
            h: 960.0,
        };
        let [top_left, top_right, bottom_left, bottom_right] =
            corners(placement(top, Rotation::R90, stored));
        assert_eq!((top_left, top_right), ((0.0, 1.0), (0.0, 0.0)));
        assert_eq!((bottom_left, bottom_right), ((0.5, 1.0), (0.5, 0.0)));
    }
}
