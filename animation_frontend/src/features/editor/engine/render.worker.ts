// Preview rendering and export, off the UI thread. The worker composites each
// frame (WebGPU: the Rust compositor and Vello on one device; or Canvas2D)
// and hands it to the visible canvas as an ImageBitmap.
import type { MediaAsset } from '@/lib/local/models'
import { useEngineStats } from '@/wasm/stats'
import type { TimelineV2 } from '../model/timelineV2'
import type { Transcript } from '../model/transcript'
import { buildGraphics, graphicsTranscript } from '../graphics/build'
import type { BrandRender } from '../graphics/looks'
import { planFrame } from './compose'
import { createCompositor, type CompositorBackend } from './compositor'
import { runExport, type ExportOptions, type ExportProgress } from './export'
import { serve } from './rpc'
import { SourcePool } from './sources'
import { loadWasm } from './wasm'

let visible: ImageBitmapRenderingContext | null = null
let compositor: CompositorBackend | null = null
let timeline: TimelineV2 | null = null
let transcript: Transcript | null = null
let assets = new Map<string, MediaAsset>()
const pool = new SourcePool()
/** The graphics document the compositor has, as JSON: rebuilt only when it changes. */
let graphicsKey = ''
/** The graphics being laid out; frames wait for it so none draws without them. */
let graphicsPending: Promise<void> = Promise.resolve()
let brand: BrandRender | null = null
/** Image ids the current compositor has. */
let registered = new Set<string>()

/** Decodes an image URL (a data URL from the brand kit). */
export async function loadBitmap(url: string): Promise<ImageBitmap> {
  return createImageBitmap(await (await fetch(url)).blob())
}

async function registerImages() {
  const logo = brand?.logo
  if (!compositor || !logo || !brand?.logoUrl || registered.has(logo.id)) return
  registered.add(logo.id)
  await compositor.setImage(logo.id, await loadBitmap(brand.logoUrl)).catch(() => registered.delete(logo.id))
}

async function init(canvas: OffscreenCanvas, width: number, height: number, force?: 'webgpu' | 'canvas2d') {
  await loadWasm()
  visible = canvas.getContext('bitmaprenderer')
  compositor = await createCompositor(width, height, force)
  return { backend: compositor.name, label: compositor.label }
}

async function syncGraphics() {
  if (!compositor || !timeline) return
  await registerImages()
  const doc = buildGraphics(timeline, {
    canvas: { width: compositor.width, height: compositor.height },
    brand,
    assets,
  })
  const words = graphicsTranscript(transcript)
  const key = JSON.stringify([doc, words])
  // The same document may still be loading its fonts for an earlier call:
  // wait for that instead of returning before it is in place.
  if (key === graphicsKey) return graphicsPending
  graphicsKey = key
  graphicsPending = compositor.setGraphics(doc, words).catch(() => {
    graphicsKey = ''
  })
  return graphicsPending
}

async function setProject(
  t: TimelineV2,
  list: MediaAsset[],
  width: number,
  height: number,
  tr: Transcript | null,
  b: BrandRender | null,
) {
  timeline = t
  transcript = tr
  brand = b
  assets = new Map(list.map((a) => [a.id, a]))
  pool.setAssets(assets)
  if (compositor && (compositor.width !== width || compositor.height !== height))
    compositor.resize(width, height)
  await syncGraphics()
}

async function render(time: number) {
  if (!compositor || !timeline || !visible) return null
  if (compositor.lost()) {
    // The GPU device went away (driver reset, tab in background too long):
    // carry on in Canvas2D rather than show nothing.
    const { width, height } = compositor
    compositor.dispose()
    compositor = await createCompositor(width, height, 'canvas2d')
    graphicsKey = ''
    registered = new Set()
    await syncGraphics()
  }
  await graphicsPending
  const t0 = performance.now()
  const plan = planFrame(timeline, time, assets)
  const sources = await pool.gather(plan)
  const bitmap = await compositor.draw(plan, sources)
  pool.release(sources)
  visible.transferFromImageBitmap(bitmap)
  return { ms: performance.now() - t0, label: compositor.label }
}

serve({
  init: (a) =>
    init(a[0] as OffscreenCanvas, a[1] as number, a[2] as number, a[3] as 'webgpu' | 'canvas2d' | undefined),
  setProject: (a) =>
    setProject(
      a[0] as TimelineV2,
      a[1] as MediaAsset[],
      a[2] as number,
      a[3] as number,
      a[4] as Transcript | null,
      (a[5] as BrandRender | null) ?? null,
    ),
  render: (a) => render(a[0] as number),
  export: (a, ctx) => runExport(a[0] as ExportOptions, (p: ExportProgress) => ctx.progress(p), ctx.signal),
})

useEngineStats.subscribe((s) => {
  if (s.last)
    (self as unknown as { postMessage(m: unknown): void }).postMessage({
      event: 'engine-call',
      payload: s.last,
    })
})
