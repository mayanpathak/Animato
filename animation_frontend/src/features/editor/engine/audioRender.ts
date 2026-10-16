// Offline audio mix for export, decoded in windows (plan 10.4 winner, merged
// from the Tooscut audio-render worker). Each 10 s timeline window decodes
// only the source regions its clips need into a windowed source in the Rust
// audio engine (at most 30 s buffered per source), then renders. Measured on
// a 60 s mix of a 300 s source: 794 ms and an 11.5 MB bound, against 1,664 ms
// and 115 MB of decoded PCM for whole-file decoding (docs/engine-bench-p4.json).
import { ALL_FORMATS, AudioSampleSink, BlobSource, Input, type AudioSample } from 'mediabunny'
import type { AudioEngine } from '@/wasm/pkg/animato_wasm.js'

const WINDOW_SECONDS = 10
const MAX_BUFFER_SECONDS = 30
const SOURCE_PADDING = 0.1

interface ClipInfo {
  sourceId: string
  startTime: number
  duration: number
  inPoint: number
  speed: number
}

interface SourceInfo {
  blob: Blob
  duration: number
  buffered: { start: number; end: number }[]
}

function interleave(sample: AudioSample): Float32Array {
  const channels = sample.numberOfChannels
  const frames = sample.numberOfFrames
  if (channels === 1) {
    const out = new Float32Array(sample.allocationSize({ format: 'f32', planeIndex: 0 }) / 4)
    sample.copyTo(out, { format: 'f32', planeIndex: 0 })
    return out
  }
  const planes: Float32Array[] = []
  for (let ch = 0; ch < channels; ch++) {
    const plane = new Float32Array(sample.allocationSize({ format: 'f32-planar', planeIndex: ch }) / 4)
    sample.copyTo(plane, { format: 'f32-planar', planeIndex: ch })
    planes.push(plane)
  }
  const out = new Float32Array(frames * channels)
  for (let i = 0; i < frames; i++)
    for (let ch = 0; ch < channels; ch++) out[i * channels + ch] = planes[ch][i]
  return out
}

/** Source regions (seconds) the clips need for one timeline window. */
export function neededRegions(
  clips: ClipInfo[],
  durations: Map<string, number>,
  windowStart: number,
  windowEnd: number,
): Map<string, { from: number; to: number }> {
  const regions = new Map<string, { from: number; to: number }>()
  for (const c of clips) {
    const end = c.startTime + c.duration
    if (c.startTime >= windowEnd || end <= windowStart) continue
    const a = Math.max(windowStart, c.startTime)
    const b = Math.min(windowEnd, end)
    const from = Math.max(0, c.inPoint + (a - c.startTime) * c.speed - SOURCE_PADDING)
    const to = Math.min(
      durations.get(c.sourceId) ?? Infinity,
      c.inPoint + (b - c.startTime) * c.speed + SOURCE_PADDING,
    )
    const prev = regions.get(c.sourceId)
    if (prev) {
      prev.from = Math.min(prev.from, from)
      prev.to = Math.max(prev.to, to)
    } else regions.set(c.sourceId, { from, to })
  }
  return regions
}

function covered(ranges: { start: number; end: number }[], from: number, to: number): boolean {
  return ranges.some((r) => r.start <= from + 0.001 && r.end >= to - 0.001)
}

function addRange(ranges: { start: number; end: number }[], start: number, end: number): void {
  const last = ranges[ranges.length - 1]
  if (last && start <= last.end + 0.01 && start >= last.start) {
    last.end = Math.max(last.end, end)
    return
  }
  ranges.push({ start, end })
  ranges.sort((x, y) => x.start - y.start)
  for (let i = 0; i < ranges.length - 1;) {
    if (ranges[i].end >= ranges[i + 1].start - 0.01) {
      ranges[i].end = Math.max(ranges[i].end, ranges[i + 1].end)
      ranges.splice(i + 1, 1)
    } else i++
  }
}

/**
 * Yields the mix as interleaved stereo blocks of up to `block` frames.
 * `engine` is a fresh Rust AudioEngine at `sampleRate`; the caller frees it.
 */
export async function* renderAudioWindowed(opts: {
  engine: AudioEngine
  sources: { sourceId: string; blob: Blob }[]
  timelineJson: string
  totalSamples: number
  sampleRate: number
  signal?: AbortSignal
  block?: number
}): AsyncGenerator<Float32Array<ArrayBuffer>> {
  const { engine, sampleRate, totalSamples, signal } = opts
  const block = opts.block ?? 1024
  const clips = (JSON.parse(opts.timelineJson) as { clips: ClipInfo[] }).clips
  const sources = new Map<string, SourceInfo>()
  for (const { sourceId, blob } of opts.sources) {
    const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(blob) })
    const track = await input.getPrimaryAudioTrack()
    if (!track || !(await track.canDecode())) continue
    const duration = (await input.computeDuration()) ?? 0
    engine.create_windowed_source(
      sourceId,
      track.sampleRate ?? sampleRate,
      track.numberOfChannels,
      duration,
      MAX_BUFFER_SECONDS,
    )
    sources.set(sourceId, { blob, duration, buffered: [] })
  }
  const durations = new Map([...sources].map(([id, s]) => [id, s.duration]))
  engine.set_timeline(opts.timelineJson)
  engine.seek(0)
  engine.set_playing(true)

  const totalSeconds = totalSamples / sampleRate
  let rendered = 0
  for (let w = 0; w < totalSeconds; w += WINDOW_SECONDS) {
    const wEnd = Math.min(w + WINDOW_SECONDS, totalSeconds)
    for (const [id, { from, to }] of neededRegions(clips, durations, w, wEnd)) {
      const source = sources.get(id)
      if (!source || covered(source.buffered, from, to)) continue
      const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(source.blob) })
      const track = await input.getPrimaryAudioTrack()
      if (!track) continue
      for await (const sample of new AudioSampleSink(track).samples(from, to)) {
        if (signal?.aborted) {
          sample.close()
          throw new DOMException('Export cancelled', 'AbortError')
        }
        const at = sample.timestamp
        const span = sample.numberOfFrames / sample.sampleRate
        engine.update_source_buffer(id, at, interleave(sample))
        sample.close()
        addRange(source.buffered, at, at + span)
      }
    }
    const until = Math.min(Math.ceil(wEnd * sampleRate), totalSamples)
    while (rendered < until) {
      if (signal?.aborted) throw new DOMException('Export cancelled', 'AbortError')
      const n = Math.min(block, until - rendered)
      const buf = new Float32Array(n * 2)
      engine.render(buf, n)
      rendered += n
      yield buf
    }
  }
}
