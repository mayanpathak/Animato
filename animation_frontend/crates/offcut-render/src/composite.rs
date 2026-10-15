//! One render pass to the canvas: the source frame, then the overlay over it.

use crate::RenderError;
use crate::gpu::Gpu;
use crate::video_pass::{
    VideoPass, linear_sampler, sampler_entry, texture_entry, whole_target_pipeline,
};

pub(crate) struct Compositor {
    pipeline: wgpu::RenderPipeline,
    layout: wgpu::BindGroupLayout,
    sampler: wgpu::Sampler,
    /// The overlay texture as the pipeline reads it. Made again when the
    /// overlay texture is.
    overlay: wgpu::BindGroup,
}

/// What the overlay's fragment shader writes is premultiplied by its alpha:
/// the colour is added to what is left of the frame under it.
const PREMULTIPLIED: wgpu::BlendState = wgpu::BlendState::PREMULTIPLIED_ALPHA_BLENDING;

fn bind(
    device: &wgpu::Device,
    layout: &wgpu::BindGroupLayout,
    sampler: &wgpu::Sampler,
    overlay: &wgpu::TextureView,
) -> wgpu::BindGroup {
    device.create_bind_group(&wgpu::BindGroupDescriptor {
        label: Some("overlay"),
        layout,
        entries: &[
            wgpu::BindGroupEntry {
                binding: 1,
                resource: wgpu::BindingResource::Sampler(sampler),
            },
            wgpu::BindGroupEntry {
                binding: 3,
                resource: wgpu::BindingResource::TextureView(overlay),
            },
        ],
    })
}

impl Compositor {
    pub fn new(
        device: &wgpu::Device,
        shader: &wgpu::ShaderModule,
        target: wgpu::TextureFormat,
        overlay: &wgpu::TextureView,
    ) -> Compositor {
        let layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("overlay"),
            entries: &[sampler_entry(1), texture_entry(3)],
        });
        let sampler = linear_sampler(device);
        Compositor {
            pipeline: whole_target_pipeline(
                device,
                shader,
                &layout,
                "over",
                target,
                Some(PREMULTIPLIED),
            ),
            overlay: bind(device, &layout, &sampler, overlay),
            layout,
            sampler,
        }
    }

    /// Reads from another overlay texture: the one of a new size.
    pub fn set_overlay(&mut self, device: &wgpu::Device, overlay: &wgpu::TextureView) {
        self.overlay = bind(device, &self.layout, &self.sampler, overlay);
    }

    /// Draws the frame `video` holds, then the overlay when there is one to
    /// draw, to the canvas, and presents it.
    pub fn present(
        &self,
        gpu: &Gpu,
        video: &VideoPass,
        with_overlay: bool,
    ) -> Result<(), RenderError> {
        let target = gpu.target()?;
        let view = target
            .texture
            .create_view(&wgpu::TextureViewDescriptor::default());
        let mut encoder = gpu
            .device
            .create_command_encoder(&wgpu::CommandEncoderDescriptor {
                label: Some("frame"),
            });
        {
            let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("frame"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: &view,
                    depth_slice: None,
                    resolve_target: None,
                    ops: wgpu::Operations {
                        load: wgpu::LoadOp::Clear(wgpu::Color::BLACK),
                        store: wgpu::StoreOp::Store,
                    },
                })],
                depth_stencil_attachment: None,
                timestamp_writes: None,
                occlusion_query_set: None,
                multiview_mask: None,
            });
            video.draw(&mut pass);
            if with_overlay {
                pass.set_pipeline(&self.pipeline);
                pass.set_bind_group(0, &self.overlay, &[]);
                pass.draw(0..3, 0..1);
            }
        }
        gpu.queue.submit([encoder.finish()]);
        gpu.queue.present(target);
        Ok(())
    }
}
