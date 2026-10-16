// Compositing backends, both running inside a worker (plan 8.6, 8.7).
// - "webgpu": animato-wasm's FrameRenderer. One WebGPU device: Vello draws
//   the graphics under and over the video, the Rust compositor draws the
//   video layers, and the frame is read back.
// - "canvas2d": the 2D canvas draws the video layers and the same graphics
//   display lists (GraphicsScene, no GPU), when WebGPU is unavailable.
import { recordCall } from '@/wasm/stats'
import { drawDisplayList } from '../graphics/draw2d'
import { ensureFonts } from '../graphics/fonts'
import type { FrameGraphics, GraphicsDoc, GraphicsTranscript } from '../graphics/schema'
import type { FramePlan, MediaLayer } from './compose'
import { loadWasm, type Wasm } from './wasm'

export interface LayerSource {
  image: VideoFrame | ImageBitmap
  width: number
  height: number
}

export interface CompositorBackend {
  readonly name: 'webgpu' | 'canvas2d'
  readonly label: string
  readonly width: number
  readonly height: number
  resize(width: number, height: number): void
  /** Lays out the graphics drawn with every frame (null: none). Loads their fonts first. */
  setGraphics(doc: GraphicsDoc | null, transcript: GraphicsTranscript | null): Promise<void>
  /** Composites the plan and returns the picture for the visible canvas. */
  draw(plan: FramePlan, sources: Map<string, LayerSource>): Promise<ImageBitmap>
  /** Composites the plan and returns it as a VideoFrame (for export). */
  capture(
    plan: FramePlan,
    sources: Map<string, LayerSource>,
    timestampUs: number,
    durationUs: number,
  ): Promise<VideoFrame>
  /** True when the GPU device is gone and a new backend is needed. */
  lost(): boolean
  dispose(): void
}

function fit(src: LayerSource, w: number, h: number): number {
  return Math.min(w / Math.max(1, src.width), h / Math.max(1, src.height))
}

/** `#rrggbb` → 0..1 floats. */
function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h.slice(0, 6)
  const v = (i: number) => (parseInt(full.slice(i, i + 2), 16) || 0) / 255
  return [v(0), v(2), v(4)]
}

// ---------------------------------------------------------------------------
// WebGPU (Rust: compositor + Vello on one device)
// ---------------------------------------------------------------------------

type FrameRenderer = Awaited<ReturnType<Wasm['FrameRenderer']['create']>>

class GpuCompositor implements CompositorBackend {
  readonly name = 'webgpu' as const
  readonly label = 'Rust/WASM · WebGPU + Vello'
  private textures = new Set<string>()
  private readonly r: FrameRenderer
  private readonly wasm: Wasm
  private w: number
  private h: number
  private isLost = false
  /**
   * Every call into the renderer, in order. `render` holds the Rust object
   * across an await; a second call meanwhile would alias it, which
   * wasm-bindgen rightly refuses.
   */
  private queue: Promise<unknown> = Promise.resolve()

  constructor(r: FrameRenderer, wasm: Wasm) {
    this.r = r
    this.wasm = wasm
    this.w = r.width
    this.h = r.height
  }

  private run<T>(fn: () => T | Promise<T>): Promise<T> {
    const p = this.queue.then(fn)
    this.queue = p.catch(() => undefined)
    return p
  }

  get width() {
    return this.w
  }
  get height() {
    return this.h
  }

  resize(width: number, height: number) {
    this.w = width
    this.h = height
    void this.run(() => this.r.resize(width, height))
  }

  async setGraphics(doc: GraphicsDoc | null, transcript: GraphicsTranscript | null) {
    if (!doc) return this.run(() => this.r.clear_graphics())
    await ensureFonts(this.wasm, doc, transcript)
    await this.run(() => {
      const t0 = performance.now()
      this.r.set_graphics(JSON.stringify(doc), JSON.stringify(transcript))
      recordCall({
        category: 'graphics',
        name: 'scene-build',
        backend: 'Rust/WASM',
        ms: performance.now() - t0,
      })
    })
  }

  private async frame(plan: FramePlan, sources: Map<string, LayerSource>) {
    const W = this.r.width
    const H = this.r.height
    const used = new Set<string>()
    const media_layers = []
    for (const l of plan.media) {
      const src = sources.get(l.key)
      if (!src) continue
      // copyExternalImageToTexture takes ImageBitmaps; VideoFrames are converted.
      const bitmap = src.image instanceof ImageBitmap ? src.image : await createImageBitmap(src.image)
      this.r.upload_bitmap(bitmap, l.key)
      if (bitmap !== src.image) bitmap.close()
      used.add(l.key)
      const s = fit(src, W, H) * l.scale
      media_layers.push({
        texture_id: l.key,
        transform: {
          x: l.x * W,
          y: l.y * H,
          scale_x: s,
          scale_y: s,
          rotation: l.rotation,
          anchor_x: 0.5,
          anchor_y: 0.5,
        },
        effects: {
          opacity: l.opacity,
          brightness: l.brightness,
          contrast: l.contrast,
          saturation: l.saturation,
          hue_rotate: 0,
          blur: 0,
        },
        z_index: l.z,
        crop: l.crop,
      })
    }
    for (const id of this.textures) if (!used.has(id)) this.r.clear_texture(id)
    this.textures = used
    // Text is Vello's: the compositor's text layers stay empty.
    return {
      media_layers,
      text_layers: [],
      shape_layers: [],
      line_layers: [],
      timeline_time: plan.time,
      width: W,
      height: H,
    }
  }

  private pixels(plan: FramePlan, sources: Map<string, LayerSource>, name: string) {
    return this.run(async () => {
      const t0 = performance.now()
      const [r, g, b] = rgb(plan.background || '#000000')
      const pixels = await this.r.render(plan.time, await this.frame(plan, sources), r, g, b)
      this.isLost = this.r.is_lost()
      recordCall({ category: 'composite', name, backend: this.label, ms: performance.now() - t0 })
      return { pixels, width: this.r.width, height: this.r.height }
    })
  }

  // Frames are rendered to a texture and read back: presenting to an
  // OffscreenCanvas surface from a worker lost the device (DESIGN_NOTES).
  async draw(plan: FramePlan, sources: Map<string, LayerSource>) {
    const { pixels, width, height } = await this.pixels(plan, sources, 'webgpu')
    return createImageBitmap(new ImageData(new Uint8ClampedArray(pixels), width, height))
  }

  async capture(plan: FramePlan, sources: Map<string, LayerSource>, timestamp: number, duration: number) {
    const { pixels, width, height } = await this.pixels(plan, sources, 'webgpu-readback')
    return new VideoFrame(pixels, {
      format: 'RGBA',
      codedWidth: width,
      codedHeight: height,
      timestamp,
      duration,
    })
  }

  lost() {
    return this.isLost
  }

  dispose() {
    void this.run(() => {
      this.r.clear_all_textures()
      this.r.free()
    })
  }
}

// ---------------------------------------------------------------------------
// Canvas2D fallback
// ---------------------------------------------------------------------------

class Canvas2DCompositor implements CompositorBackend {
  readonly name = 'canvas2d' as const
  readonly label = 'Canvas2D fallback'
  readonly canvas: OffscreenCanvas
  private readonly ctx: OffscreenCanvasRenderingContext2D
  private readonly wasm: Wasm
  private readonly scene: InstanceType<Wasm['GraphicsScene']>
  private readonly images = new Map<string, CanvasImageSource>()
  private hasGraphics = false

  constructor(canvas: OffscreenCanvas, wasm: Wasm) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) throw new Error('2D canvas unavailable')
    this.ctx = ctx
    this.wasm = wasm
    this.scene = new wasm.GraphicsScene()
  }

  get width() {
    return this.canvas.width
  }
  get height() {
    return this.canvas.height
  }

  resize(width: number, height: number) {
    this.canvas.width = width
    this.canvas.height = height
  }

  async setGraphics(doc: GraphicsDoc | null, transcript: GraphicsTranscript | null) {
    this.hasGraphics = Boolean(doc?.items.length)
    if (!doc) return this.scene.clear()
    await ensureFonts(this.wasm, doc, transcript)
    const t0 = performance.now()
    this.scene.set(JSON.stringify(doc), JSON.stringify(transcript))
    recordCall({
      category: 'graphics',
      name: 'scene-build',
      backend: 'Rust/WASM',
      ms: performance.now() - t0,
    })
  }

  private drawMedia(l: MediaLayer, src: LayerSource) {
    const { ctx } = this
    const W = this.canvas.width
    const H = this.canvas.height
    const s = fit(src, W, H) * l.scale
    const cw = src.width * (1 - l.crop.left - l.crop.right)
    const ch = src.height * (1 - l.crop.top - l.crop.bottom)
    ctx.save()
    ctx.globalAlpha = Math.max(0, Math.min(1, l.opacity))
    ctx.filter = `brightness(${l.brightness}) contrast(${l.contrast}) saturate(${l.saturation})`
    ctx.translate(l.x * W, l.y * H)
    ctx.rotate((l.rotation * Math.PI) / 180)
    ctx.scale(s, s)
    // Cropped edges stay in place, as in the GPU compositor.
    const ox = -src.width / 2 + src.width * l.crop.left
    const oy = -src.height / 2 + src.height * l.crop.top
    ctx.drawImage(src.image, src.width * l.crop.left, src.height * l.crop.top, cw, ch, ox, oy, cw, ch)
    ctx.restore()
  }

  private paint(plan: FramePlan, sources: Map<string, LayerSource>) {
    const t0 = performance.now()
    const { ctx } = this
    let graphics: FrameGraphics | null = null
    if (this.hasGraphics) {
      const g0 = performance.now()
      graphics = JSON.parse(this.scene.frame_at(plan.time)) as FrameGraphics
      recordCall({ category: 'graphics', name: 'frame-at', backend: 'Rust/WASM', ms: performance.now() - g0 })
    }
    ctx.fillStyle = plan.background || '#000000'
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
    if (graphics) drawDisplayList(ctx, graphics.under.cmds, this.images)
    for (const l of plan.media) {
      const src = sources.get(l.key)
      if (src) this.drawMedia(l, src)
    }
    if (graphics) drawDisplayList(ctx, graphics.over.cmds, this.images)
    recordCall({ category: 'composite', name: 'canvas2d', backend: this.label, ms: performance.now() - t0 })
  }

  async draw(plan: FramePlan, sources: Map<string, LayerSource>) {
    this.paint(plan, sources)
    return this.canvas.transferToImageBitmap()
  }

  async capture(plan: FramePlan, sources: Map<string, LayerSource>, timestamp: number, duration: number) {
    this.paint(plan, sources)
    return new VideoFrame(this.canvas, { timestamp, duration, alpha: 'discard' })
  }

  lost() {
    return false
  }

  dispose() {
    this.scene.free()
  }
}

/**
 * The best available compositor at `width` x `height`: WebGPU (compositor +
 * Vello) when it starts, otherwise Canvas2D. `force` picks one.
 */
export async function createCompositor(
  width: number,
  height: number,
  force?: 'webgpu' | 'canvas2d',
): Promise<CompositorBackend> {
  const wasm = await loadWasm()
  if (force !== 'canvas2d' && 'gpu' in navigator) {
    try {
      const r = await wasm.FrameRenderer.create(width, height)
      return new GpuCompositor(r, wasm)
    } catch (e) {
      if (force === 'webgpu') throw e
    }
  }
  return new Canvas2DCompositor(new OffscreenCanvas(width, height), wasm)
}
