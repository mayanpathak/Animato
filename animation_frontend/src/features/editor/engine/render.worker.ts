// Preview rendering and export, off the UI thread. The worker composites each
// frame (WebGPU: the Rust compositor and Vello on one device; or Canvas2D)
// and hands it to the visible canvas as an ImageBitmap.
import type { MediaAsset } from '@/lib/local/models'
import { useEngineStats } from '@/wasm/stats'
import type { TimelineV2 } from '../model/timelineV2'
import type { Transcript } from '../model/transcript'
import { buildGraphics, graphicsTranscript } from '../graphics/build'
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

async function init(canvas: OffscreenCanvas, width: number, height: number, force?: 'webgpu' | 'canvas2d') {
  await loadWasm()
  visible = canvas.getContext('bitmaprenderer')
  compositor = await createCompositor(width, height, force)
  return { backend: compositor.name, label: compositor.label }
}

async function syncGraphics() {
  if (!compositor || !timeline) return
  const doc = buildGraphics(timeline, { canvas: { width: compositor.width, height: compositor.height } })
  const words = graphicsTranscript(transcript)
  const key = JSON.stringify([doc, words])
  if (key === graphicsKey) return
  graphicsKey = key
  await compositor.setGraphics(doc, words)
}

async function setProject(
  t: TimelineV2,
  list: MediaAsset[],
  width: number,
  height: number,
  tr: Transcript | null,
) {
  timeline = t
  transcript = tr
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
    await syncGraphics()
  }
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
