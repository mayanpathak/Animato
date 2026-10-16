// WebCodecs decoding inside workers: random-access video frames for preview,
// thumbnails and export, and whole-track audio decoding to PCM.
import { recordCall } from '@/wasm/stats'
import type { AudioStream, EncodedSample, VideoStream } from './demux'
import { loadWasm } from './wasm'

const LOOKAHEAD_US = 1_500_000

/** Returns the frame shown at a given time, decoding forward from keyframes as needed. */
export class FrameDecoder {
  private decoder: VideoDecoder | null = null
  private samples: AsyncGenerator<EncodedSample> | null = null
  private queue: VideoFrame[] = []
  private current: VideoFrame | null = null
  private fedUs = -Infinity
  private ended = false
  private waiter: (() => void) | null = null
  private error: Error | null = null
  private readonly stream: VideoStream
  private busy: Promise<unknown> = Promise.resolve()

  constructor(stream: VideoStream) {
    this.stream = stream
  }

  private createDecoder(): VideoDecoder {
    const d = new VideoDecoder({
      output: (frame) => {
        this.queue.push(frame)
        this.queue.sort((a, b) => a.timestamp - b.timestamp)
        this.waiter?.()
      },
      error: (e) => {
        this.error = e instanceof Error ? e : new Error(String(e))
        this.waiter?.()
      },
    })
    d.configure({ ...this.stream.config, hardwareAcceleration: 'prefer-software', optimizeForLatency: true })
    return d
  }

  private reset(t: number): void {
    if (this.decoder && this.decoder.state !== 'closed') this.decoder.close()
    this.decoder = this.createDecoder()
    void this.samples?.return(undefined)
    this.samples = this.stream.samplesFrom(t)
    for (const f of this.queue) f.close()
    this.queue = []
    this.current?.close()
    this.current = null
    this.fedUs = -Infinity
    this.ended = false
    this.error = null
  }

  private waitForOutput(ms = 1500): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.waiter = null
        resolve()
      }, ms)
      this.waiter = () => {
        clearTimeout(timer)
        this.waiter = null
        resolve()
      }
    })
  }

  /** A clone of the frame visible at `t` seconds (caller closes it), or null. */
  frameAt(t: number): Promise<VideoFrame | null> {
    const run = this.busy.then(() => this.frameAtInner(t))
    this.busy = run.catch(() => undefined)
    return run
  }

  private async frameAtInner(t: number): Promise<VideoFrame | null> {
    const t0 = performance.now()
    const target = Math.max(0, t) * 1e6
    const halfFrame = 500_000 / (this.stream.fps || 30)
    const tooFarBack = this.current !== null && target + halfFrame < this.current.timestamp
    const tooFarAhead = target > this.fedUs + LOOKAHEAD_US && !this.ended
    if (!this.decoder || this.decoder.state === 'closed' || tooFarBack || (tooFarAhead && this.current !== null) || this.error) {
      this.reset(t)
    }
    const decoder = this.decoder as VideoDecoder
    let flushed = false
    for (let guard = 0; guard < 100_000; guard++) {
      while (this.queue.length && this.queue[0].timestamp <= target + halfFrame) {
        this.current?.close()
        this.current = this.queue.shift() as VideoFrame
      }
      if (this.queue.length || this.error) break
      if (this.ended) {
        if (flushed) break
        flushed = true
        await decoder.flush().catch(() => undefined)
        continue
      }
      const next = await (this.samples as AsyncGenerator<EncodedSample>).next()
      if (next.done) {
        this.ended = true
        continue
      }
      const s = next.value
      decoder.decode(new EncodedVideoChunk({ type: s.key ? 'key' : 'delta', timestamp: s.timestampUs, duration: s.durationUs, data: s.data }))
      this.fedUs = Math.max(this.fedUs, s.timestampUs)
      if (decoder.decodeQueueSize > 4 || s.timestampUs > target + halfFrame) await this.waitForOutput(200)
    }
    recordCall({ category: 'decode', name: 'video-frame', backend: 'WebCodecs', ms: performance.now() - t0 })
    return this.current ? this.current.clone() : null
  }

  close(): void {
    this.decoder?.state !== 'closed' && this.decoder?.close()
    void this.samples?.return(undefined)
    for (const f of this.queue) f.close()
    this.queue = []
    this.current?.close()
    this.current = null
  }
}

export const MIX_RATE = 48_000

export interface DecodedAudio {
  /** Interleaved stereo at 48 kHz. */
  pcm: Float32Array
  sampleRate: number
  duration: number
}

/** Decodes a whole audio track to interleaved stereo at 48 kHz (resampled with offcut-dsp). */
export async function decodeAudio(stream: AudioStream, signal?: AbortSignal): Promise<DecodedAudio> {
  const t0 = performance.now()
  const left: Float32Array[] = []
  const right: Float32Array[] = []
  let rate = stream.sampleRate
  let failure: Error | null = null
  const decoder = new AudioDecoder({
    output: (data) => {
      rate = data.sampleRate
      const n = data.numberOfFrames
      const l = new Float32Array(n)
      data.copyTo(l, { planeIndex: 0, format: 'f32-planar' })
      let r = l
      if (data.numberOfChannels > 1) {
        r = new Float32Array(n)
        data.copyTo(r, { planeIndex: 1, format: 'f32-planar' })
      }
      left.push(l)
      right.push(r)
      data.close()
    },
    error: (e) => {
      failure = e instanceof Error ? e : new Error(String(e))
    },
  })
  decoder.configure(stream.config)
  for await (const s of stream.samples()) {
    if (signal?.aborted || failure) break
    decoder.decode(new EncodedAudioChunk({ type: 'key', timestamp: s.timestampUs, duration: s.durationUs, data: s.data }))
    if (decoder.decodeQueueSize > 32) await new Promise((r) => setTimeout(r, 0))
  }
  await decoder.flush().catch(() => undefined)
  decoder.close()
  if (failure) throw failure

  const join = (parts: Float32Array[]) => {
    const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0))
    let o = 0
    for (const p of parts) {
      out.set(p, o)
      o += p.length
    }
    return out
  }
  let l: Float32Array = join(left)
  let r: Float32Array = join(right)
  recordCall({ category: 'decode', name: 'audio-track', backend: 'WebCodecs', ms: performance.now() - t0 })
  if (rate !== MIX_RATE && l.length) {
    const wasm = await loadWasm()
    const t1 = performance.now()
    l = wasm.resample(l, rate, MIX_RATE)
    r = wasm.resample(r, rate, MIX_RATE)
    recordCall({ category: 'dsp', name: 'resample', backend: 'Rust/WASM', ms: performance.now() - t1 })
  }
  const pcm = new Float32Array(l.length * 2)
  for (let i = 0; i < l.length; i++) {
    pcm[i * 2] = l[i]
    pcm[i * 2 + 1] = r[i]
  }
  return { pcm, sampleRate: MIX_RATE, duration: l.length / MIX_RATE }
}

/** RMS level of interleaved PCM in dBFS (a simple loudness measure). */
export function rmsDb(pcm: Float32Array): number {
  let sum = 0
  for (let i = 0; i < pcm.length; i++) sum += pcm[i] * pcm[i]
  const rms = Math.sqrt(sum / Math.max(1, pcm.length))
  return rms > 0 ? 20 * Math.log10(rms) : -120
}
