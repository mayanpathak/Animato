// Import pipeline, off the UI thread: hash (Rust sha2), probe and demux (Rust
// offcut-mp4 or mediabunny), real thumbnails (WebCodecs), PCM extraction
// (WebCodecs + offcut-dsp resample) and waveform peaks (Rust).
import { fileHandle } from '@/lib/local/opfs'
import type { MediaAsset, MediaKind } from '@/lib/local/models'
import { recordCall, useEngineStats } from '@/wasm/stats'
import { decodeAudio, FrameDecoder, MIX_RATE, rmsDb } from './decode'
import { openMedia } from './demux'
import { serve } from './rpc'
import { loadWasm } from './wasm'

export interface ImportRequest {
  id: string
  path: string
  name: string
  mime: string
  owner: string
  jobId: string | null
  size: number
}

const AUDIO_EXT = /\.(mp3|wav|m4a|aac|ogg|oga|opus|flac)$/i
const IMAGE_EXT = /\.(png|jpe?g|webp|gif|avif)$/i

function kindOf(name: string, mime: string): MediaKind {
  if (mime.startsWith('image/') || IMAGE_EXT.test(name)) return 'image'
  if (mime.startsWith('audio/') || AUDIO_EXT.test(name)) return 'audio'
  return 'video'
}

async function sha256(path: string): Promise<string> {
  const wasm = await loadWasm()
  const t0 = performance.now()
  const sync = await (await fileHandle(path)).createSyncAccessHandle({ mode: 'read-only' })
  try {
    const size = sync.getSize()
    const hasher = new wasm.Sha256Stream()
    const buf = new Uint8Array(1 << 20)
    for (let at = 0; at < size; ) {
      const n = sync.read(buf, { at })
      if (n <= 0) break
      hasher.update(buf.subarray(0, n))
      at += n
    }
    const hex = hasher.finalize_hex()
    recordCall({ category: 'demux', name: 'sha256', backend: 'Rust/WASM', ms: performance.now() - t0 })
    return hex
  } finally {
    sync.close()
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

const THUMB_W = 192

async function thumbnailOf(source: CanvasImageSource, w: number, h: number): Promise<string> {
  const height = Math.max(1, Math.round((THUMB_W * h) / Math.max(1, w)))
  const canvas = new OffscreenCanvas(THUMB_W, height)
  const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D
  ctx.drawImage(source, 0, 0, THUMB_W, height)
  return blobToDataUrl(await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.72 }))
}

async function writePcm(id: string, pcm: Float32Array): Promise<void> {
  const sync = await (await fileHandle(`pcm/${id}.f32`, true)).createSyncAccessHandle()
  try {
    sync.truncate(0)
    sync.write(pcm, { at: 0 })
    sync.flush()
  } finally {
    sync.close()
  }
}

async function waveform(pcm: Float32Array, duration: number): Promise<number[]> {
  const wasm = await loadWasm()
  const t0 = performance.now()
  const frames = pcm.length / 2
  const mono = new Float32Array(frames)
  for (let i = 0; i < frames; i++) mono[i] = (pcm[i * 2] + pcm[i * 2 + 1]) / 2
  // Peaks need far fewer samples than 48 kHz: downsample with offcut-dsp first.
  const low = wasm.resample(mono, MIX_RATE, 8000)
  const buckets = Math.max(1, Math.round(duration * 100))
  const peaks = wasm.waveform_peaks(low, buckets)
  recordCall({ category: 'dsp', name: 'waveform-peaks', backend: 'Rust/WASM', ms: performance.now() - t0 })
  return Array.from(peaks, (v) => Math.round(v * 1000) / 1000)
}

async function importAsset(req: ImportRequest, progress: (p: unknown) => void, signal: AbortSignal): Promise<MediaAsset> {
  const kind = kindOf(req.name, req.mime)
  progress({ stage: 'probe', fraction: 0 })
  const hash = await sha256(req.path)
  const base = {
    id: req.id,
    owner: req.owner,
    name: req.name,
    kind,
    mime: req.mime,
    size: req.size,
    path: req.path,
    sha256: hash,
    createdAt: Date.now(),
    jobId: req.jobId,
  }

  if (kind === 'image') {
    const file = await (await fileHandle(req.path)).getFile()
    const bitmap = await createImageBitmap(file)
    const thumb = await thumbnailOf(bitmap, bitmap.width, bitmap.height)
    const asset: MediaAsset = {
      ...base,
      duration: 0,
      width: bitmap.width,
      height: bitmap.height,
      hasAudio: false,
      videoCodec: null,
      audioCodec: null,
      demuxer: 'image',
      thumbnails: [thumb],
      waveform: [],
    }
    bitmap.close()
    return asset
  }

  const media = await openMedia(req.path, req.name)
  try {
    if (!media.video && !media.audio) throw new Error('This file has no video or audio this browser can decode.')
    if (kind === 'video' && !media.video) throw new Error('This browser cannot decode the video in this file.')
    const thumbnails: string[] = []
    if (media.video) {
      progress({ stage: 'thumbnails', fraction: 0 })
      const decoder = new FrameDecoder(media.video)
      const count = Math.min(16, Math.max(1, Math.ceil(media.duration)))
      for (let i = 0; i < count && !signal.aborted; i++) {
        const t = ((i + 0.5) / count) * media.duration
        const frame = await decoder.frameAt(t)
        if (frame) {
          thumbnails.push(await thumbnailOf(frame, frame.displayWidth, frame.displayHeight))
          frame.close()
        }
        progress({ stage: 'thumbnails', fraction: (i + 1) / count })
      }
      decoder.close()
    }
    let peaks: number[] = []
    let hasAudio = false
    if (media.audio) {
      progress({ stage: 'waveform', fraction: 0 })
      const audio = await decodeAudio(media.audio, signal)
      if (audio.pcm.length) {
        hasAudio = true
        await writePcm(req.id, audio.pcm)
        peaks = await waveform(audio.pcm, audio.duration)
      }
      progress({ stage: 'waveform', fraction: 1 })
    }
    return {
      ...base,
      kind: media.video ? kind : 'audio',
      duration: media.duration,
      width: media.video?.width ?? 0,
      height: media.video?.height ?? 0,
      hasAudio,
      videoCodec: media.video ? String(media.video.config.codec) : null,
      audioCodec: media.audio ? String(media.audio.config.codec) : null,
      demuxer: media.demuxer,
      thumbnails,
      waveform: peaks,
    }
  } finally {
    media.close()
  }
}

/** RMS loudness of a region of an asset's cached PCM. */
async function measureLoudness(assetId: string, from: number, duration: number): Promise<number> {
  const file = await (await fileHandle(`pcm/${assetId}.f32`)).getFile()
  const startByte = Math.max(0, Math.floor(from * MIX_RATE) * 8)
  const endByte = Math.min(file.size, startByte + Math.ceil(duration * MIX_RATE) * 8)
  const buf = await file.slice(startByte, endByte).arrayBuffer()
  return rmsDb(new Float32Array(buf))
}

serve({
  import: (args, ctx) => importAsset(args[0] as ImportRequest, ctx.progress, ctx.signal),
  measureLoudness: (args) => measureLoudness(args[0] as string, args[1] as number, args[2] as number),
})

// Mirror worker-side engine calls to the page so the UI badge and tests see them.
useEngineStats.subscribe((s) => {
  if (s.last) (self as unknown as { postMessage(m: unknown): void }).postMessage({ event: 'engine-call', payload: s.last })
})
