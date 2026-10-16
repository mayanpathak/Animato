// Local export: composite every frame, encode with WebCodecs (VideoEncoder /
// AudioEncoder), mix audio offline with the Rust audio engine (windowed decode,
// audioRender.ts), and mux with
// mediabunny straight into an OPFS file. Runs in a worker.
import {
  EncodedAudioPacketSource,
  EncodedPacket,
  EncodedVideoPacketSource,
  Mp4OutputFormat,
  Output,
  StreamTarget,
  WebMOutputFormat,
} from 'mediabunny'
import type { MediaAsset } from '@/lib/local/models'
import { fileHandle, readFile, removeFile } from '@/lib/local/opfs'
import { recordCall } from '@/wasm/stats'
import { outputDuration, type TimelineV2 } from '../model/timelineV2'
import type { Transcript } from '../model/transcript'
import { buildGraphics, graphicsTranscript } from '../graphics/build'
import type { BrandRender } from '../graphics/looks'
import { renderAudioWindowed } from './audioRender'
import { audioAssetIds, buildAudioTimeline, planFrame } from './compose'
import { createCompositor } from './compositor'
import { MIX_RATE } from './decode'
import { SourcePool } from './sources'
import { loadWasm } from './wasm'

export type ExportFormat = 'mp4' | 'webm'
export type ExportQuality = 'draft' | 'standard' | 'high'

export interface ExportOptions {
  timeline: TimelineV2
  transcript: Transcript | null
  assets: MediaAsset[]
  width: number
  height: number
  fps: number
  format: ExportFormat
  quality: ExportQuality
  path: string
  /** Force a compositor (tests); default picks WebGPU when available. */
  compositor?: 'webgpu' | 'canvas2d'
  /** The brand kit the Finish choices use (logo, colours, font). */
  brand?: BrandRender | null
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

async function pickVideoCodec(
  format: ExportFormat,
  width: number,
  height: number,
  bitrate: number,
  fps: number,
) {
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
  throw new Error(
    `This browser cannot encode ${format.toUpperCase()} at ${width}×${height}. Try WebM or a lower resolution.`,
  )
}

async function pickAudioCodec(format: ExportFormat) {
  const candidates: [MbAudioCodec, string][] =
    format === 'mp4'
      ? [
          ['aac', 'mp4a.40.2'],
          ['opus', 'opus'],
        ]
      : [['opus', 'opus']]
  for (const [name, codec] of candidates) {
    const config: AudioEncoderConfig = { codec, sampleRate: MIX_RATE, numberOfChannels: 2, bitrate: 160_000 }
    const support = await AudioEncoder.isConfigSupported(config).catch(() => null)
    if (support?.supported) return { name, config }
  }
  return null
}

const BITS_PER_PIXEL: Record<ExportQuality, number> = { draft: 0.05, standard: 0.1, high: 0.18 }

export async function runExport(
  opts: ExportOptions,
  progress: (p: ExportProgress) => void,
  signal: AbortSignal,
): Promise<ExportResult> {
  const wasm = await loadWasm()
  const { timeline, width, height, fps } = opts
  const assets = new Map(opts.assets.map((a) => [a.id, a]))
  const duration = outputDuration(timeline)
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

  const compositor = await createCompositor(width, height, opts.compositor)
  // Captions draw only when the export burns them in (opts.transcript set).
  if (opts.brand?.logo && opts.brand.logoUrl)
    await compositor.setImage(
      opts.brand.logo.id,
      await createImageBitmap(await (await fetch(opts.brand.logoUrl)).blob()),
    )
  await compositor.setGraphics(
    buildGraphics(timeline, { canvas: { width, height }, brand: opts.brand ?? null, assets }),
    graphicsTranscript(opts.transcript),
  )
  const pool = new SourcePool()
  pool.setAssets(assets)
  const frameUs = 1e6 / fps
  const started = performance.now()

  try {
    for (let i = 0; i < frames; i++) {
      if (signal.aborted) throw new DOMException('Export cancelled', 'AbortError')
      if (failure) throw failure
      const t = i / fps
      const plan = planFrame(timeline, t, assets)
      const sources = await pool.gather(plan)
      const frame = await compositor.capture(plan, sources, Math.round(i * frameUs), Math.round(frameUs))
      pool.release(sources)
      const t0 = performance.now()
      encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 })
      frame.close()
      recordCall({
        category: 'encode',
        name: `video-${video.name}`,
        backend: 'WebCodecs',
        ms: performance.now() - t0,
      })
      while (encoder.encodeQueueSize > 6) await new Promise((r) => setTimeout(r, 2))
      if (i % 3 === 0 || i === frames - 1)
        progress({ frame: i + 1, frames, fps: (i + 1) / ((performance.now() - started) / 1000) })
    }
    await encoder.flush()

    if (audio && audioTrack) {
      const engine = new wasm.AudioEngine(MIX_RATE)
      const aEncoder = new AudioEncoder({
        output: (chunk, meta) => {
          muxChain = muxChain
            .then(() => audioTrack.add(EncodedPacket.fromEncodedChunk(chunk), meta))
            .catch(fail)
        },
        error: fail,
      })
      aEncoder.configure(audio.config)
      const total = Math.round(duration * MIX_RATE)
      const t0 = performance.now()
      const sources = await Promise.all(
        audioIds
          .map((id) => assets.get(id))
          .filter((a): a is MediaAsset => Boolean(a))
          .map(async (a) => ({ sourceId: a.id, blob: await readFile(a.path) })),
      )
      let at = 0
      for await (const buf of renderAudioWindowed({
        engine,
        sources,
        timelineJson: JSON.stringify(buildAudioTimeline(timeline, assets)),
        totalSamples: total,
        sampleRate: MIX_RATE,
        signal,
      })) {
        const n = buf.length / 2
        const data = new AudioData({
          format: 'f32',
          sampleRate: MIX_RATE,
          numberOfFrames: n,
          numberOfChannels: 2,
          timestamp: Math.round((at / MIX_RATE) * 1e6),
          data: buf,
        })
        at += n
        aEncoder.encode(data)
        data.close()
        while (aEncoder.encodeQueueSize > 16) await new Promise((r) => setTimeout(r, 1))
      }
      await aEncoder.flush()
      aEncoder.close()
      engine.free()
      recordCall({
        category: 'audio',
        name: 'offline-mix',
        backend: 'Rust/WASM · windowed',
        ms: performance.now() - t0,
      })
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
