//! The device, the queue and the canvas a frame is presented on. One adapter
//! and one device per renderer.

use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use web_sys::OffscreenCanvas;

use crate::RenderError;

pub(crate) struct Gpu {
    instance: wgpu::Instance,
    adapter: wgpu::Adapter,
    pub device: wgpu::Device,
    pub queue: wgpu::Queue,
    surface: wgpu::Surface<'static>,
    config: wgpu::SurfaceConfiguration,
    /// Set by the device when it is lost; the next `render` reports it.
    lost: Arc<AtomicBool>,
}

/// The surface of a canvas. A canvas exists in a browser only.
#[cfg(target_arch = "wasm32")]
fn canvas_surface(
    instance: &wgpu::Instance,
    canvas: OffscreenCanvas,
) -> Result<wgpu::Surface<'static>, RenderError> {
    instance
        .create_surface(wgpu::SurfaceTarget::OffscreenCanvas(canvas))
        .map_err(|_| RenderError::Surface)
}

/// V4: an image in memory takes the place of the canvas (`render_to_image`).
#[cfg(not(target_arch = "wasm32"))]
fn canvas_surface(
    _instance: &wgpu::Instance,
    _canvas: OffscreenCanvas,
) -> Result<wgpu::Surface<'static>, RenderError> {
    Err(RenderError::Surface)
}

/// How a surface of this size is set up. The format is one without a
/// conversion to sRGB on writing: what is drawn is sRGB-encoded already.
fn configuration(
    surface: &wgpu::Surface<'_>,
    adapter: &wgpu::Adapter,
    width: u32,
    height: u32,
) -> Result<wgpu::SurfaceConfiguration, RenderError> {
    if width == 0 || height == 0 {
        return Err(RenderError::Surface);
    }
    let mut config = surface
        .get_default_config(adapter, width, height)
        .ok_or(RenderError::Surface)?;
    let formats = surface.get_capabilities(adapter).formats;
    if let Some(plain) = formats.iter().find(|format| !format.is_srgb()) {
        config.format = *plain;
    }
    Ok(config)
}

impl Gpu {
    pub async fn new(canvas: OffscreenCanvas, width: u32, height: u32) -> Result<Gpu, RenderError> {
        // A build without a graphics backend for its platform has no adapter.
        if wgpu::Instance::enabled_backend_features().is_empty() {
            return Err(RenderError::NoAdapter);
        }
        let instance = wgpu::Instance::new(wgpu::InstanceDescriptor::new_without_display_handle());
        let surface = canvas_surface(&instance, canvas)?;
        let adapter = instance
            .request_adapter(&wgpu::RequestAdapterOptions {
                // No preference for one GPU over another: the browser picks
                // the adapter, as it does for the rest of the page.
                compatible_surface: Some(&surface),
                ..Default::default()
            })
            .await
            .map_err(|_| RenderError::NoAdapter)?;
        let (device, queue) = adapter
            .request_device(&wgpu::DeviceDescriptor {
                label: Some("offcut-render"),
                required_features: wgpu::Features::empty(),
                required_limits: wgpu::Limits::default(),
                ..Default::default()
            })
            .await
            .map_err(|_| RenderError::DeviceRequest)?;

        let lost = Arc::new(AtomicBool::new(false));
        let flag = Arc::clone(&lost);
        device.set_device_lost_callback(move |_reason, _message| {
            flag.store(true, Ordering::Relaxed);
        });

        let config = configuration(&surface, &adapter, width, height)?;
        surface.configure(&device, &config);
        Ok(Gpu {
            instance,
            adapter,
            device,
            queue,
            surface,
            config,
            lost,
        })
    }

    pub fn is_lost(&self) -> bool {
        self.lost.load(Ordering::Relaxed)
    }

    pub fn format(&self) -> wgpu::TextureFormat {
        self.config.format
    }

    pub fn size(&self) -> (u32, u32) {
        (self.config.width, self.config.height)
    }

    /// Sets the surface up again when the size is another one.
    pub fn resize(&mut self, width: u32, height: u32) -> Result<(), RenderError> {
        if (width, height) == self.size() {
            return Ok(());
        }
        if width == 0 || height == 0 {
            return Err(RenderError::Surface);
        }
        self.config.width = width;
        self.config.height = height;
        self.surface.configure(&self.device, &self.config);
        Ok(())
    }

    /// Another canvas on the same device. Its surface must take the format
    /// the pipelines were built for.
    pub fn set_canvas(
        &mut self,
        canvas: OffscreenCanvas,
        width: u32,
        height: u32,
    ) -> Result<(), RenderError> {
        let surface = canvas_surface(&self.instance, canvas)?;
        let config = configuration(&surface, &self.adapter, width, height)?;
        if config.format != self.config.format {
            return Err(RenderError::Surface);
        }
        surface.configure(&self.device, &config);
        self.surface = surface;
        self.config = config;
        Ok(())
    }

    /// The texture the next frame is drawn to.
    pub fn target(&self) -> Result<wgpu::SurfaceTexture, RenderError> {
        match self.surface.get_current_texture() {
            wgpu::CurrentSurfaceTexture::Success(texture)
            | wgpu::CurrentSurfaceTexture::Suboptimal(texture) => Ok(texture),
            wgpu::CurrentSurfaceTexture::Lost => Err(RenderError::DeviceLost),
            wgpu::CurrentSurfaceTexture::Timeout
            | wgpu::CurrentSurfaceTexture::Occluded
            | wgpu::CurrentSurfaceTexture::Outdated
            | wgpu::CurrentSurfaceTexture::Validation => Err(RenderError::Surface),
        }
    }
}
