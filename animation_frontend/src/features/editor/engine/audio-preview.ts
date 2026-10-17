// Main-thread host of the AudioWorklet mixer. Also the preview clock: while
// playing, time follows the AudioContext so picture stays in sync with sound.
import workletUrl from './audio.worklet.ts?worker&url'
import wasmUrl from '@/wasm/pkg/animato_wasm_bg.wasm?url'
import type { MediaAsset } from '@/lib/local/models'
import { recordCall } from '@/wasm/stats'
import type { TimelineV2 } from '../model/timelineV2'
import { readPcm } from '../media/client'
import { audioAssetIds, buildAudioTimeline } from './compose'

export class AudioPreview {
  private ctx: AudioContext | null = null
  private node: AudioWorkletNode | null = null
  private ready: Promise<void> | null = null
  private uploaded = new Set<string>()
  private lastJson = ''
  private startedAt = 0
  private startTime = 0
  playing = false
  available = true

  private ensure(): Promise<void> {
    this.ready ??= (async () => {
      const t0 = performance.now()
      const ctx = new AudioContext({ sampleRate: 48000, latencyHint: 'interactive' })
      await ctx.audioWorklet.addModule(workletUrl)
      const module = await WebAssembly.compileStreaming(fetch(wasmUrl))
      const node = new AudioWorkletNode(ctx, 'animato-mixer', { numberOfInputs: 0, outputChannelCount: [2] })
      node.connect(ctx.destination)
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Audio engine did not start')), 8000)
        node.port.onmessage = (e) => {
          if (e.data?.type === 'ready') {
            clearTimeout(timer)
            resolve()
          } else if (e.data?.type === 'messageerror') {
            void fetch(wasmUrl)
              .then((r) => r.arrayBuffer())
              .then((bytes) => node.port.postMessage({ type: 'init-bytes', bytes }, [bytes]))
              .catch(reject)
          } else if (e.data?.type === 'error') {
            clearTimeout(timer)
            reject(new Error(`Audio engine failed to start: ${String(e.data.message)}`))
          }
        }
        node.port.postMessage({ type: 'init', module })
      })
      this.ctx = ctx
      this.node = node
      recordCall({
        category: 'audio',
        name: 'worklet-init',
        backend: 'Rust/WASM · AudioWorklet',
        ms: performance.now() - t0,
      })
    })().catch((e) => {
      this.available = false
      throw e
    })
    return this.ready
  }

  /** Sends PCM for new sources and the current mix to the worklet. */
  async sync(tl: TimelineV2, assets: Map<string, MediaAsset>): Promise<void> {
    if (!this.node) return
    for (const id of audioAssetIds(tl, assets)) {
      if (this.uploaded.has(id)) continue
      this.uploaded.add(id)
      const pcm = await readPcm(id)
      if (pcm) this.node.port.postMessage({ type: 'upload', id, pcm }, [pcm.buffer])
    }
    const json = JSON.stringify(buildAudioTimeline(tl, assets))
    if (json !== this.lastJson) {
      this.lastJson = json
      this.node.port.postMessage({ type: 'timeline', json })
    }
  }

  async play(at: number, tl: TimelineV2, assets: Map<string, MediaAsset>): Promise<void> {
    try {
      await this.ensure()
      await this.ctx?.resume()
      await this.sync(tl, assets)
      this.node?.port.postMessage({ type: 'play', at })
    } catch {
      // No audio device or worklet support: picture still plays, on the wall clock.
    }
    this.startTime = at
    this.startedAt =
      this.ctx && this.ctx.state === 'running' ? this.ctx.currentTime : performance.now() / 1000
    this.playing = true
  }

  pause(): void {
    this.node?.port.postMessage({ type: 'pause' })
    this.playing = false
  }

  /** Current playback time in seconds. */
  now(): number {
    if (!this.playing) return this.startTime
    const clock = this.ctx && this.ctx.state === 'running' ? this.ctx.currentTime : performance.now() / 1000
    return this.startTime + (clock - this.startedAt)
  }

  close(): void {
    void this.ctx?.close()
    this.ctx = null
    this.node = null
    this.ready = null
    this.uploaded.clear()
    this.lastJson = ''
  }
}
