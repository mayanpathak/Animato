// UI-thread side of preview rendering: owns the render worker and coalesces
// render requests so a slow frame never queues up a backlog.
import type { MediaAsset } from '@/lib/local/models'
import { recordCall, type EngineCall } from '@/wasm/stats'
import type { TimelineV2 } from '../model/timelineV2'
import type { Transcript } from '../model/transcript'
import type { BrandRender } from '../graphics/looks'
import { connect, type RpcClient } from './rpc'

export interface PreviewInfo {
  backend: 'webgpu' | 'canvas2d'
  label: string
}

export function previewSize(tl: Pick<TimelineV2, 'width' | 'height'>): { width: number; height: number } {
  const scale = Math.min(1, 1280 / Math.max(tl.width, tl.height))
  return { width: Math.round((tl.width * scale) / 2) * 2, height: Math.round((tl.height * scale) / 2) * 2 }
}

export class PreviewRenderer {
  private rpc: RpcClient
  private inFlight = false
  private queued: number | null = null
  lastMs = 0

  private constructor(rpc: RpcClient) {
    this.rpc = rpc
  }

  static async create(
    canvas: HTMLCanvasElement,
    tl: TimelineV2,
    force?: 'webgpu' | 'canvas2d',
  ): Promise<{ renderer: PreviewRenderer; info: PreviewInfo }> {
    const rpc = connect(
      new Worker(new URL('./render.worker.ts', import.meta.url), { type: 'module', name: 'animato-render' }),
    )
    rpc.on('engine-call', (c) => recordCall(c as EngineCall))
    const offscreen = canvas.transferControlToOffscreen()
    const { width, height } = previewSize(tl)
    const info = await rpc.call<PreviewInfo>('init', [offscreen, width, height, force], {
      transfer: [offscreen],
    })
    return { renderer: new PreviewRenderer(rpc), info }
  }

  setProject(
    tl: TimelineV2,
    assets: MediaAsset[],
    transcript: Transcript | null,
    brand: BrandRender | null,
  ): Promise<void> {
    const { width, height } = previewSize(tl)
    return this.rpc.call('setProject', [tl, assets, width, height, transcript, brand])
  }

  /** Renders `time`; while a frame is in flight only the latest request is kept. */
  render(time: number): void {
    if (this.inFlight) {
      this.queued = time
      return
    }
    this.inFlight = true
    void this.rpc
      .call<{ ms: number } | null>('render', [time])
      .then((r) => {
        if (r) this.lastMs = r.ms
      })
      .catch(() => undefined)
      .finally(() => {
        this.inFlight = false
        if (this.queued !== null) {
          const next = this.queued
          this.queued = null
          this.render(next)
        }
      })
  }

  dispose(): void {
    this.rpc.terminate()
  }
}
