// Opening media files from OPFS inside a worker. MP4/MOV/M4A go through the
// Rust offcut-mp4 demuxer (animato-wasm `Mp4Demuxer`, reading through a
// synchronous OPFS handle); everything else (WebM, MP3, WAV, ...) and any MP4
// the Rust demuxer refuses (e.g. fragmented) goes through mediabunny.
import { ALL_FORMATS, BlobSource, EncodedPacketSink, Input, type EncodedPacket } from 'mediabunny'
import { fileHandle } from '@/lib/local/opfs'
import { recordCall } from '@/wasm/stats'
import { loadWasm } from './wasm'

export interface EncodedSample {
  data: Uint8Array
  timestampUs: number
  durationUs: number
  key: boolean
}

export interface VideoStream {
  config: VideoDecoderConfig
  width: number
  height: number
  fps: number
  /** Samples in decode order, from the keyframe at or before `t` (seconds). */
  samplesFrom(t: number): AsyncGenerator<EncodedSample>
}

export interface AudioStream {
  config: AudioDecoderConfig
  sampleRate: number
  channels: number
  samples(): AsyncGenerator<EncodedSample>
}

export interface OpenedMedia {
  demuxer: 'offcut-mp4' | 'mediabunny'
  duration: number
  video: VideoStream | null
  audio: AudioStream | null
  close(): void
}

const MP4ISH = /\.(mp4|m4v|mov|m4a|qt)$/i

interface RustProbe {
  container: string
  duration: number
  video: { codec: string; codec_string: string; coded_width: number; coded_height: number; avg_fps: number } | null
  audio: { codec: string; codec_string: string; sample_rate: number; channels: number } | null
}

interface RustSample {
  data: Uint8Array
  ptsUs: number
  durationUs: number
  isKeyframe: boolean
}

function audioCodecString(codec: string, codecString: string): string {
  if (codec === 'Opus' || codecString === 'Opus') return 'opus'
  if (codec === 'Mp3') return 'mp3'
  return codecString
}

async function openWithRust(path: string): Promise<OpenedMedia> {
  const wasm = await loadWasm()
  const handle = await fileHandle(path)
  const t0 = performance.now()
  // Read-only handles let the preview and export workers open the same file.
  const sync = await handle.createSyncAccessHandle({ mode: 'read-only' })
  let demuxer: ReturnType<Wasm['Mp4Demuxer']['open']>
  try {
    demuxer = wasm.Mp4Demuxer.open(sync)
  } catch (e) {
    sync.close()
    throw e
  }
  const info = demuxer.info() as RustProbe
  recordCall({ category: 'demux', name: 'offcut-mp4', backend: 'Rust/WASM', ms: performance.now() - t0 })
  let closed = false
  const vInfo = info.video
  const aInfo = info.audio

  const video: VideoStream | null =
    vInfo && demuxer.video_sample_count() > 0
      ? {
          config: {
            codec: vInfo.codec_string,
            codedWidth: vInfo.coded_width,
            codedHeight: vInfo.coded_height,
            // avcC is the decoder description for H.264; VP9 needs none.
            description: vInfo.codec === 'H264' || vInfo.codec === 'Av1' ? demuxer.video_description() ?? undefined : undefined,
          },
          width: vInfo.coded_width,
          height: vInfo.coded_height,
          fps: vInfo.avg_fps / 1000 || 30,
          async *samplesFrom(t: number) {
            const count = demuxer.video_sample_count()
            let i = demuxer.keyframe_at_or_before(Math.max(0, Math.floor(t * 1000)))
            for (; i < count && !closed; i++) {
              const s = demuxer.read_video_sample(i) as RustSample
              yield { data: s.data, timestampUs: s.ptsUs, durationUs: s.durationUs, key: s.isKeyframe }
            }
          },
        }
      : null

  const audio: AudioStream | null =
    aInfo && demuxer.audio_sample_count() > 0
      ? {
          config: {
            codec: audioCodecString(aInfo.codec, aInfo.codec_string),
            sampleRate: aInfo.sample_rate,
            numberOfChannels: aInfo.channels,
            description: aInfo.codec === 'Aac' ? demuxer.audio_description() ?? undefined : undefined,
          },
          sampleRate: aInfo.sample_rate,
          channels: aInfo.channels,
          async *samples() {
            const count = demuxer.audio_sample_count()
            for (let i = 0; i < count && !closed; i++) {
              const s = demuxer.read_audio_sample(i) as RustSample
              yield { data: s.data, timestampUs: s.ptsUs, durationUs: s.durationUs, key: true }
            }
          },
        }
      : null

  return {
    demuxer: 'offcut-mp4',
    duration: info.duration / 1000,
    video,
    audio,
    close() {
      if (closed) return
      closed = true
      demuxer.free()
      sync.close()
    },
  }
}

type Wasm = Awaited<ReturnType<typeof loadWasm>>

function fromPacket(p: EncodedPacket): EncodedSample {
  return { data: p.data, timestampUs: Math.round(p.timestamp * 1e6), durationUs: Math.round(p.duration * 1e6), key: p.type === 'key' }
}

async function openWithMediabunny(path: string): Promise<OpenedMedia> {
  const t0 = performance.now()
  const file = await (await fileHandle(path)).getFile()
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS })
  const [vTrack, aTrack, duration] = await Promise.all([
    input.getPrimaryVideoTrack(),
    input.getPrimaryAudioTrack(),
    input.computeDuration(),
  ])
  recordCall({ category: 'demux', name: 'mediabunny', backend: 'mediabunny', ms: performance.now() - t0 })
  let closed = false

  let video: VideoStream | null = null
  if (vTrack && (await vTrack.canDecode())) {
    const config = await vTrack.getDecoderConfig()
    const sink = new EncodedPacketSink(vTrack)
    const fpsStats = await vTrack.computePacketStats(60).catch(() => null)
    if (config) {
      video = {
        config,
        width: vTrack.displayWidth,
        height: vTrack.displayHeight,
        fps: fpsStats?.averagePacketRate || 30,
        async *samplesFrom(t: number) {
          let packet = (await sink.getKeyPacket(Math.max(0, t))) ?? (await sink.getFirstPacket())
          while (packet && !closed) {
            yield fromPacket(packet)
            packet = await sink.getNextPacket(packet)
          }
        },
      }
    }
  }

  let audio: AudioStream | null = null
  if (aTrack && (await aTrack.canDecode())) {
    const config = await aTrack.getDecoderConfig()
    const sink = new EncodedPacketSink(aTrack)
    if (config) {
      audio = {
        config,
        sampleRate: aTrack.sampleRate,
        channels: aTrack.numberOfChannels,
        async *samples() {
          for await (const p of sink.packets()) {
            if (closed) return
            yield fromPacket(p)
          }
        },
      }
    }
  }

  return {
    demuxer: 'mediabunny',
    duration,
    video,
    audio,
    close() {
      closed = true
      input.dispose()
    },
  }
}

export async function openMedia(path: string, name: string): Promise<OpenedMedia> {
  if (MP4ISH.test(name)) {
    try {
      return await openWithRust(path)
    } catch {
      // Fragmented MP4, an unusual box layout, or no sync handles: mediabunny reads it.
    }
  }
  return openWithMediabunny(path)
}
