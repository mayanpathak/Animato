// Main-thread access to the timeline core of the animato-wasm module
// (crates/animato-wasm). Workers import src/wasm/pkg directly for decode,
// compositing, audio and encoding.
import type { Timeline } from '@/features/editor/model/timeline'
import { recordCall, type EngineCategory } from './stats'

export interface CoreFunctions {
  engine_version(): string
  seconds_to_timecode(seconds: number, fps: number): string
  timecode_to_seconds(tc: string, fps: number): number
  snap(time: number, targets: Float64Array, threshold: number): number
  split_clip(timeline: string, clipId: string, at: number, newId: string): string
  trim_clip(timeline: string, clipId: string, edge: string, to: number): string
  ripple_delete(timeline: string, clipId: string): string
  parse_srt(text: string): string
  to_srt(cuesJson: string): string
  captions_from_words(wordsJson: string): string
  waveform_peaks(pcm: Float32Array, buckets: number): Float32Array
  keyframe_value(keysJson: string, time: number): number
}

export interface Cue {
  start: number
  end: number
  text: string
}

export interface TimedWord {
  text: string
  startMs: number
  endMs: number
  confidence: number
}

export interface CoreEngine {
  backend: 'wasm' | 'ts'
  version: string
  secondsToTimecode(seconds: number, fps: number): string
  timecodeToSeconds(tc: string, fps: number): number
  snap(time: number, targets: number[], threshold: number): number
  splitClip(t: Timeline, clipId: string, at: number, newId: string): Timeline
  trimClip(t: Timeline, clipId: string, edge: 'start' | 'end', to: number): Timeline
  rippleDelete(t: Timeline, clipId: string): Timeline
  parseSrt(text: string): Cue[]
  toSrt(cues: Cue[]): string
  captionsFromWords(words: TimedWord[]): Cue[]
  waveformPeaks(pcm: Float32Array, buckets: number): Float32Array
  keyframeValue(keys: { time: number; value: number; ease?: string }[], time: number): number
}

function wrap(fns: CoreFunctions, backend: 'wasm' | 'ts'): CoreEngine {
  const timed = <T>(category: EngineCategory, name: string, run: () => T): T => {
    const t0 = performance.now()
    const out = run()
    recordCall({
      category,
      name,
      backend: backend === 'wasm' ? 'Rust/WASM' : 'TS fallback',
      ms: performance.now() - t0,
    })
    return out
  }
  return {
    backend,
    version: fns.engine_version(),
    secondsToTimecode: (s, fps) => fns.seconds_to_timecode(s, fps),
    timecodeToSeconds: (tc, fps) => fns.timecode_to_seconds(tc, fps),
    snap: (time, targets, threshold) =>
      timed('timeline', 'snap', () => fns.snap(time, Float64Array.from(targets), threshold)),
    splitClip: (t, id, at, newId) =>
      timed(
        'timeline',
        'split',
        () => JSON.parse(fns.split_clip(JSON.stringify(t), id, at, newId)) as Timeline,
      ),
    trimClip: (t, id, edge, to) =>
      timed('timeline', 'trim', () => JSON.parse(fns.trim_clip(JSON.stringify(t), id, edge, to)) as Timeline),
    rippleDelete: (t, id) =>
      timed(
        'timeline',
        'ripple-delete',
        () => JSON.parse(fns.ripple_delete(JSON.stringify(t), id)) as Timeline,
      ),
    parseSrt: (text) => timed('captions', 'parse-srt', () => JSON.parse(fns.parse_srt(text)) as Cue[]),
    toSrt: (cues) => timed('captions', 'to-srt', () => fns.to_srt(JSON.stringify(cues))),
    captionsFromWords: (words) =>
      timed(
        'captions',
        'normalize-transcript',
        () => JSON.parse(fns.captions_from_words(JSON.stringify(words))) as Cue[],
      ),
    waveformPeaks: (pcm, buckets) => timed('dsp', 'waveform-peaks', () => fns.waveform_peaks(pcm, buckets)),
    keyframeValue: (keys, time) => fns.keyframe_value(JSON.stringify(keys), time),
  }
}

let loading: Promise<CoreEngine> | null = null

/** Loads the WASM module once; falls back to the TS twin if it cannot load. */
export function loadEngine(): Promise<CoreEngine> {
  loading ??= (async () => {
    try {
      const mod = await import('./pkg/animato_wasm.js')
      await mod.default()
      return wrap(mod as unknown as CoreFunctions, 'wasm')
    } catch (error) {
      console.warn('animato-wasm failed to load; using the TypeScript fallback for timeline math.', error)
      const { fallback } = await import('./fallback')
      return wrap(fallback, 'ts')
    }
  })()
  return loading
}
