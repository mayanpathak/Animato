// Local export: composite every frame, encode with WebCodecs (VideoEncoder /
// AudioEncoder), mix audio offline with the Rust audio engine, and mux with
// mediabunny straight into an OPFS file. Runs in a worker.
import { EncodedAudioPacketSource, EncodedPacket, EncodedVideoPacketSource, Mp4OutputFormat, Output, StreamTarget, WebMOutputFormat } from 'mediabunny'
import type { MediaAsset } from '@/lib/local/models'
import { fileHandle, removeFile } from '@/lib/local/opfs'
import { recordCall } from '@/wasm/stats'
import type { Timeline } from '../model/timeline'
import { timelineDuration } from '../model/timeline'
import { audioAssetIds, buildAudioTimeline, planFrame } from './compose'
import { createCompositor } from './compositor'
import { MIX_RATE } from './decode'
import { SourcePool } from './sources'
import { loadWasm } from './wasm'

export type ExportFormat = 'mp4' | 'webm'
export type ExportQuality = 'draft' | 'standard' | 'high'

export interface ExportOptions {
  timeline: Timeline
  assets: MediaAsset[]
  width: number
  height: number
  fps: number
  format: ExportFormat
  quality: ExportQuality
  path: string
  /** Force a compositor (tests); default picks WebGPU when available. */
  compositor?: 'webgpu' | 'canvas2d'
}

export interface ExportResult {
  path: string
  size: number
  duration: number
  frames: number
  videoCodec: string
  audioCodec: string | null
  compositor: string
}

export interface ExportProgress {
  frame: number
  frames: number
  fps: number
}

type MbVideoCodec = 'avc' | 'vp9' | 'av1' | 'vp8'
type MbAudioCodec = 'aac' | 'opus'

function vp9Level(w: number, h: number): string {
  const px = w * h
  return px <= 1280 * 720 ? '31' : px <= 2048 * 1152 ? '41' : '51'
}

async function pickVideoCodec(format: ExportFormat, width: number, height: number, bitrate: number, fps: number) {
  const big = width * height > 2048 * 1152
  const candidates: [MbVideoCodec, string][] =
    format === 'mp4'
      ? [
          ['avc', big ? 'avc1.640033' : 'avc1.640028'],
          ['vp9', `vp09.00.${vp9Level(width, height)}.08`],
          ['av1', big ? 'av01.0.12M.08' : 'av01.0.08M.08'],
        ]
      : [
          ['vp9', `vp09.00.${vp9Level(width, height)}.08`],
          ['av1', big ? 'av01.0.12M.08' : 'av01.0.08M.08'],
          ['vp8', 'vp8'],
        ]
  for (const [name, codec] of candidates) {
    const config: VideoEncoderConfig = {
      codec,
      width,
      height,
      bitrate,
      framerate: fps,
      latencyMode: 'quality',
      ...(name === 'avc' ? { avc: { format: 'avc' as const } } : {}),
    }
    const support = await VideoEncoder.isConfigSupported(config).catch(() => null)
    if (support?.supported) return { name, config }
  }
  throw new Error(`This browser cannot encode ${format.toUpperCase()} at ${width}×${height}. Try WebM or a lower resolution.`)
}

async function pickAudioCodec(format: ExportFormat) {
  const candidates: [MbAudioCodec, string][] = format === 'mp4' ? [['aac', 'mp4a.40.2'], ['opus', 'opus']] : [['opus', 'opus']]
  for (const [name, codec] of candidates) {
    const config: AudioEncoderConfig = { codec, sampleRate: MIX_RATE, numberOfChannels: 2, bitrate: 160_000 }
    const support = await AudioEncoder.isConfigSupported(config).catch(() => null)
    if (support?.supported) return { name, config }
  }
  return null
}

const BITS_PER_PIXEL: Record<ExportQuality, number> = { draft: 0.05, standard: 0.1, high: 0.18 }

export async function runExport(opts: ExportOptions, progress: (p: ExportProgress) => void, signal: AbortSignal): Promise<ExportResult> {
  const wasm = await loadWasm()
  const { timeline, width, height, fps } = opts
  const assets = new Map(opts.assets.map((a) => [a.id, a]))
  const duration = timelineDuration(timeline)
  if (duration <= 0) throw new Error('The timeline is empty.')
  const frames = Math.max(1, Math.round(duration * fps))
  const bitrate = Math.round(width * height * fps * BITS_PER_PIXEL[opts.quality])

  const video = await pickVideoCodec(opts.format, width, height, bitrate, fps)
  const audioIds = audioAssetIds(timeline, assets)
  const audio = audioIds.length ? await pickAudioCodec(opts.format) : null

  // Output straight into OPFS: the file is never held whole in memory.
  const writable = await (await fileHandle(opts.path, true)).createWritable()
  const output = new Output({
    format: opts.format === 'mp4' ? new Mp4OutputFormat({ fastStart: false }) : new WebMOutputFormat(),
    target: new StreamTarget(writable as unknown as WritableStream),
  })
  const videoTrack = new EncodedVideoPacketSource(video.name)
  output.addVideoTrack(videoTrack, { frameRate: fps })
  const audioTrack = audio ? new EncodedAudioPacketSource(audio.name) : null
  if (audioTrack) output.addAudioTrack(audioTrack)
  await output.start()

  let muxChain: Promise<void> = Promise.resolve()
  let failure: Error | null = null
  const fail = (e: unknown) => {
    failure ??= e instanceof Error ? e : new Error(String(e))
  }

  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      muxChain = muxChain.then(() => videoTrack.add(EncodedPacket.fromEncodedChunk(chunk), meta)).catch(fail)
    },
    error: fail,
  })
  encoder.configure(video.config)

  const canvas = new OffscreenCanvas(width, height)
  const compositor = await createCompositor(canvas, opts.compositor)
  const pool = new SourcePool()
  pool.setAssets(assets)
  const kf = (keys: { time: number; value: number; ease?: string }[], t: number) => wasm.keyframe_value(JSON.stringify(keys), t)
  const frameUs = 1e6 / fps
  const started = performance.now()

  try {
    for (let i = 0; i < frames; i++) {
      if (signal.aborted) throw new DOMException('Export cancelled', 'AbortError')
      if (failure) throw failure
      const t = i / fps
      const plan = planFrame(timeline, t, assets, kf)
      const sources = await pool.gather(plan)
      const frame = await compositor.capture(plan, sources, Math.round(i * frameUs), Math.round(frameUs))
      pool.release(sources)
      const t0 = performance.now()
      encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 })
      frame.close()
      recordCall({ category: 'encode', name: `video-${video.name}`, backend: 'WebCodecs', ms: performance.now() - t0 })
      while (encoder.encodeQueueSize > 6) await new Promise((r) => setTimeout(r, 2))
      if (i % 3 === 0 || i === frames - 1) progress({ frame: i + 1, frames, fps: (i + 1) / ((performance.now() - started) / 1000) })
    }
    await encoder.flush()

    if (audio && audioTrack) {
      const engine = new wasm.AudioEngine(MIX_RATE)
      for (const id of audioIds) {
        const pcm = await readPcm(id)
        if (pcm) engine.upload_audio(id, pcm, MIX_RATE, 2)
      }
      engine.set_timeline(JSON.stringify(buildAudioTimeline(timeline, assets)))
      engine.seek(0)
      engine.set_playing(true)
      const aEncoder = new AudioEncoder({
        output: (chunk, meta) => {
          muxChain = muxChain.then(() => audioTrack.add(EncodedPacket.fromEncodedChunk(chunk), meta)).catch(fail)
        },
        error: fail,
      })
      aEncoder.configure(audio.config)
      const total = Math.round(duration * MIX_RATE)
      const block = 1024
      const t0 = performance.now()
      for (let at = 0; at < total; at += block) {
        if (signal.aborted) throw new DOMException('Export cancelled', 'AbortError')
        const n = Math.min(block, total - at)
        const buf = new Float32Array(n * 2)
        engine.render(buf, n)
        const data = new AudioData({ format: 'f32', sampleRate: MIX_RATE, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round((at / MIX_RATE) * 1e6), data: buf })
        aEncoder.encode(data)
        data.close()
        while (aEncoder.encodeQueueSize > 16) await new Promise((r) => setTimeout(r, 1))
      }
      await aEncoder.flush()
      aEncoder.close()
      engine.free()
      recordCall({ category: 'audio', name: 'offline-mix', backend: 'Rust/WASM', ms: performance.now() - t0 })
      recordCall({ category: 'encode', name: `audio-${audio.name}`, backend: 'WebCodecs', ms: 0 })
    }

    await muxChain
    if (failure) throw failure
    await output.finalize()
    const size = (await (await fileHandle(opts.path)).getFile()).size
    return {
      path: opts.path,
      size,
      duration,
      frames,
      videoCodec: String(video.config.codec),
      audioCodec: audio ? String(audio.config.codec) : null,
      compositor: compositor.label,
    }
  } catch (e) {
    await output.cancel().catch(() => undefined)
    await removeFile(opts.path)
    throw e
  } finally {
    if (encoder.state !== 'closed') encoder.close()
    pool.close()
    compositor.dispose()
  }
}

async function readPcm(assetId: string): Promise<Float32Array | null> {
  try {
    const file = await (await fileHandle(`pcm/${assetId}.f32`)).getFile()
    return new Float32Array(await file.arrayBuffer())
  } catch {
    return null
  }
}
