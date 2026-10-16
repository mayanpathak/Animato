// Compositing backends, both running inside a worker on an OffscreenCanvas.
// - "webgpu": the Rust `tooscut-compositor` crate (wgpu → WebGPU), text via glyphon.
// - "canvas2d": a 2D-canvas compositor with the same interface, used when
//   WebGPU (or the GPU compositor) is unavailable.
import { recordCall } from '@/wasm/stats'
import { parseColor, type FramePlan, type MediaLayer, type TextLayer } from './compose'
import { loadWasm } from './wasm'

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
  readonly canvas: OffscreenCanvas
  resize(width: number, height: number): void
  draw(plan: FramePlan, sources: Map<string, LayerSource>): Promise<void>
  /** Composites the plan and returns it as a VideoFrame (for export). */
  capture(plan: FramePlan, sources: Map<string, LayerSource>, timestampUs: number, durationUs: number): Promise<VideoFrame>
  dispose(): void
}

const FONT_FILES: { family: string; url: string; weight: string }[] = [
  { family: 'Inter', url: '/fonts/Inter-Regular.otf', weight: '400' },
  { family: 'Inter', url: '/fonts/Inter-Bold.otf', weight: '700' },
  { family: 'DejaVu Serif', url: '/fonts/DejaVuSerif-Bold.ttf', weight: '700' },
]

/** The GPU text renderer ships Inter and DejaVu Serif; other names map onto them. */
export function gpuFamily(font: string): string {
  return /serif/i.test(font) && !/sans/i.test(font) ? 'DejaVu Serif' : 'Inter'
}

const fontBytes = new Map<string, Promise<ArrayBuffer>>()
function fetchFont(url: string): Promise<ArrayBuffer> {
  if (!fontBytes.has(url)) fontBytes.set(url, fetch(url).then((r) => r.arrayBuffer()))
  return fontBytes.get(url) as Promise<ArrayBuffer>
}

function fit(src: LayerSource, w: number, h: number): number {
  return Math.min(w / Math.max(1, src.width), h / Math.max(1, src.height))
}

/** The text box in canvas percentages, sized to the text so backgrounds hug it. */
function textBox(t: TextLayer, W: number, H: number) {
  const px = (t.size * t.scale * H) / 1080
  const lines = t.text.split('\n')
  const longest = Math.max(...lines.map((l) => l.length))
  const widthPct = Math.min(90, ((longest * px * 0.56 + px) / W) * 100)
  const heightPct = Math.min(90, ((lines.length * px * 1.25 + px * 0.6) / H) * 100)
  const cx = t.align === 'Left' ? 5 + widthPct / 2 : t.align === 'Right' ? 95 - widthPct / 2 : t.x * 100
  const cy = t.y * 100 + (t.offsetY / 1080) * 100
  return { x: cx - widthPct / 2, y: cy - heightPct / 2, width: widthPct, height: heightPct }
}

// ---------------------------------------------------------------------------
// WebGPU (Rust)
// ---------------------------------------------------------------------------

type Wasm = Awaited<ReturnType<typeof loadWasm>>
type RustCompositor = Awaited<ReturnType<Wasm['Compositor']['from_offscreen_canvas']>>

class GpuCompositor implements CompositorBackend {
  readonly name = 'webgpu' as const
  readonly label = 'Rust/WASM · WebGPU'
  private textures = new Set<string>()
  private readonly c: RustCompositor
  readonly canvas: OffscreenCanvas

  constructor(c: RustCompositor, canvas: OffscreenCanvas) {
    this.c = c
    this.canvas = canvas
  }

  get width() {
    return this.canvas.width
  }
  get height() {
    return this.canvas.height
  }

  resize(width: number, height: number) {
    this.c.resize(width, height)
  }

  private async frame(plan: FramePlan, sources: Map<string, LayerSource>) {
    const W = this.canvas.width
    const H = this.canvas.height
    const used = new Set<string>()
    const media_layers = []
    for (const l of plan.media) {
      const src = sources.get(l.key)
      if (!src) continue
      // copyExternalImageToTexture takes ImageBitmaps; VideoFrames are converted.
      const bitmap = src.image instanceof ImageBitmap ? src.image : await createImageBitmap(src.image)
      this.c.upload_bitmap(bitmap, l.key)
      if (bitmap !== src.image) bitmap.close()
      used.add(l.key)
      const s = fit(src, W, H) * l.scale
      media_layers.push({
        texture_id: l.key,
        transform: { x: l.x * W, y: l.y * H, scale_x: s, scale_y: s, rotation: l.rotation, anchor_x: 0.5, anchor_y: 0.5 },
        effects: { opacity: l.opacity, brightness: l.brightness, contrast: l.contrast, saturation: l.saturation, hue_rotate: 0, blur: 0 },
        z_index: l.z,
        crop: l.crop,
      })
    }
    for (const id of this.textures) if (!used.has(id)) this.c.clear_texture(id)
    this.textures = used
    const text_layers = plan.texts.map((t) => {
      const bg = t.background ? parseColor(t.background) : null
      return {
        id: t.key,
        text: t.text,
        box: textBox(t, W, H),
        style: {
          font_family: gpuFamily(t.font),
          font_size: t.size * t.scale,
          font_weight: t.weight,
          italic: false,
          color: parseColor(t.color),
          text_align: t.align,
          vertical_align: 'Middle',
          line_height: 1.2,
          letter_spacing: 0,
          ...(bg ? { background_color: bg, background_padding: 14, background_border_radius: 10 } : {}),
        },
        z_index: t.z,
        opacity: t.opacity,
      }
    })
    return { media_layers, text_layers, shape_layers: [], line_layers: [], timeline_time: plan.time, width: W, height: H }
  }

  async draw(plan: FramePlan, sources: Map<string, LayerSource>) {
    const t0 = performance.now()
    this.c.render_layers(await this.frame(plan, sources))
    recordCall({ category: 'composite', name: 'webgpu', backend: this.label, ms: performance.now() - t0 })
  }

  async capture(plan: FramePlan, sources: Map<string, LayerSource>, timestamp: number, duration: number) {
    const t0 = performance.now()
    const pixels = await this.c.render_to_pixels(await this.frame(plan, sources))
    recordCall({ category: 'composite', name: 'webgpu-readback', backend: this.label, ms: performance.now() - t0 })
    return new VideoFrame(pixels, { format: 'RGBA', codedWidth: this.canvas.width, codedHeight: this.canvas.height, timestamp, duration })
  }

  dispose() {
    this.c.clear_all_textures()
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

  constructor(canvas: OffscreenCanvas) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) throw new Error('2D canvas unavailable')
    this.ctx = ctx
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

  private drawText(t: TextLayer) {
    const { ctx } = this
    const W = this.canvas.width
    const H = this.canvas.height
    const px = (t.size * t.scale * H) / 1080
    const family = /serif/i.test(t.font) && !/sans/i.test(t.font) ? `'DejaVu Serif', serif` : `'Inter', sans-serif`
    ctx.save()
    ctx.globalAlpha = Math.max(0, Math.min(1, t.opacity))
    ctx.font = `${t.weight} ${px}px ${family}`
    ctx.textBaseline = 'middle'
    const lines = t.text.split('\n')
    const lineH = px * 1.2
    const widths = lines.map((line) => ctx.measureText(line).width)
    const maxW = Math.max(...widths)
    const boxLeft = W * 0.05
    const boxW = W * 0.9
    const cy = t.y * H + (t.offsetY * H) / 1080
    const top = cy - (lineH * lines.length) / 2
    const left = t.align === 'Left' ? boxLeft : t.align === 'Right' ? boxLeft + boxW - maxW : boxLeft + (boxW - maxW) / 2
    if (t.background) {
      const pad = (14 * H) / 1080
      const [r, g, b, a] = parseColor(t.background)
      ctx.fillStyle = `rgba(${r * 255},${g * 255},${b * 255},${a})`
      ctx.beginPath()
      ctx.roundRect(left - pad, top - pad, maxW + pad * 2, lineH * lines.length + pad * 2, (10 * H) / 1080)
      ctx.fill()
    }
    const [r, g, b, a] = parseColor(t.color)
    ctx.fillStyle = `rgba(${r * 255},${g * 255},${b * 255},${a})`
    lines.forEach((line, i) => {
      const x = t.align === 'Left' ? left : t.align === 'Right' ? left + maxW - widths[i] : left + (maxW - widths[i]) / 2
      ctx.fillText(line, x, top + lineH * (i + 0.5))
    })
    ctx.restore()
  }

  async draw(plan: FramePlan, sources: Map<string, LayerSource>) {
    const t0 = performance.now()
    const { ctx } = this
    ctx.fillStyle = plan.background || '#000000'
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
    for (const l of plan.media) {
      const src = sources.get(l.key)
      if (src) this.drawMedia(l, src)
    }
    for (const t of plan.texts) this.drawText(t)
    recordCall({ category: 'composite', name: 'canvas2d', backend: this.label, ms: performance.now() - t0 })
  }

  async capture(plan: FramePlan, sources: Map<string, LayerSource>, timestamp: number, duration: number) {
    await this.draw(plan, sources)
    return new VideoFrame(this.canvas, { timestamp, duration, alpha: 'discard' })
  }

  dispose() {}
}

async function loadCanvasFonts(): Promise<void> {
  const fonts = (self as unknown as { fonts?: FontFaceSet }).fonts
  if (!fonts) return
  await Promise.all(
    FONT_FILES.map(async (f) => {
      const face = new FontFace(f.family, await fetchFont(f.url), { weight: f.weight })
      await face.load()
      fonts.add(face)
    }),
  )
}

/**
 * Creates the best available compositor on `canvas`: the Rust WebGPU
 * compositor when WebGPU works, otherwise Canvas2D. `force` picks one.
 */
export async function createCompositor(canvas: OffscreenCanvas, force?: 'webgpu' | 'canvas2d'): Promise<CompositorBackend> {
  if (force !== 'canvas2d' && 'gpu' in navigator) {
    try {
      const adapter = await (navigator as Navigator & { gpu: { requestAdapter(): Promise<unknown> } }).gpu.requestAdapter()
      if (adapter) {
        const wasm = await loadWasm()
        const c = await wasm.Compositor.from_offscreen_canvas(canvas)
        await Promise.all(
          FONT_FILES.map(async (f) => {
            c.load_font(f.family, new Uint8Array(await fetchFont(f.url)))
          }),
        )
        return new GpuCompositor(c, canvas)
      }
    } catch (e) {
      if (force === 'webgpu') throw e
    }
  }
  await loadCanvasFonts().catch(() => undefined)
  return new Canvas2DCompositor(canvas)
}
