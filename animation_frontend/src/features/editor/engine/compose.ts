// Pure functions shared by the preview and the exporter: what is on screen at
// time t (layer plan) and what the audio engine should mix (audio timeline).
// Fades, text animations and ducking are keyframes evaluated by the Rust
// `tooscut-keyframe` crate (passed in as `kf`).
import type { MediaAsset } from '@/lib/local/models'
import type { CaptionStyle, Clip, MediaClip, TextClip, Timeline } from '../model/timeline'

export type KeyframeFn = (keys: { time: number; value: number; ease?: string }[], time: number) => number

export interface MediaLayer {
  key: string
  assetId: string
  kind: 'video' | 'image'
  sourceTime: number
  x: number
  y: number
  scale: number
  rotation: number
  opacity: number
  brightness: number
  contrast: number
  saturation: number
  crop: { top: number; right: number; bottom: number; left: number }
  z: number
}

export interface TextLayer {
  key: string
  text: string
  font: string
  /** Pixels at 1080p; backends scale by output height. */
  size: number
  weight: number
  color: string
  background: string | null
  align: 'Left' | 'Center' | 'Right'
  x: number
  y: number
  opacity: number
  offsetY: number
  scale: number
  z: number
}

export interface FramePlan {
  time: number
  width: number
  height: number
  background: string
  media: MediaLayer[]
  texts: TextLayer[]
}

const active = (c: Clip, t: number) => t >= c.start && t < c.start + c.duration

function fadeOpacity(c: MediaClip, local: number, kf: KeyframeFn): number {
  if (c.fadeIn <= 0 && c.fadeOut <= 0) return 1
  const keys: { time: number; value: number; ease?: string }[] = []
  if (c.fadeIn > 0) keys.push({ time: 0, value: 0, ease: 'easeOut' }, { time: c.fadeIn, value: 1 })
  else keys.push({ time: 0, value: 1 })
  if (c.fadeOut > 0)
    keys.push(
      { time: Math.max(c.fadeIn, c.duration - c.fadeOut), value: 1, ease: 'easeIn' },
      { time: c.duration, value: 0 },
    )
  return kf(keys, local)
}

function textMotion(
  c: TextClip,
  local: number,
  kf: KeyframeFn,
): { opacity: number; offsetY: number; scale: number } {
  const outStart = Math.max(0, c.duration - 0.3)
  const fade = kf(
    [
      { time: 0, value: 0, ease: 'easeOut' },
      { time: 0.4, value: 1 },
      { time: outStart, value: 1, ease: 'easeIn' },
      { time: c.duration, value: 0 },
    ],
    local,
  )
  switch (c.animation) {
    case 'fade':
      return { opacity: fade, offsetY: 0, scale: 1 }
    case 'rise':
      return {
        opacity: fade,
        offsetY: kf(
          [
            { time: 0, value: 48, ease: 'easeOut' },
            { time: 0.6, value: 0 },
          ],
          local,
        ),
        scale: 1,
      }
    case 'pop':
      return {
        opacity: fade,
        offsetY: 0,
        scale: kf(
          [
            { time: 0, value: 0.82, ease: 'easeOut' },
            { time: 0.35, value: 1.04, ease: 'easeInOut' },
            { time: 0.5, value: 1 },
          ],
          local,
        ),
      }
    default:
      return { opacity: 1, offsetY: 0, scale: 1 }
  }
}

export function sourceTime(c: MediaClip, t: number): number {
  return c.offset + (t - c.start) * c.speed
}

export function planFrame(
  tl: Timeline,
  t: number,
  assets: Map<string, MediaAsset>,
  kf: KeyframeFn,
): FramePlan {
  const media: MediaLayer[] = []
  const texts: TextLayer[] = []
  const n = tl.tracks.length
  tl.tracks.forEach((track, index) => {
    if (track.hidden) return
    const z = (n - index) * 10
    for (const c of track.clips) {
      if (!active(c, t)) continue
      const local = t - c.start
      if (c.type === 'media') {
        const asset = assets.get(c.assetId)
        if (!asset || asset.kind === 'audio' || track.kind === 'audio' || track.kind === 'voice') continue
        media.push({
          key: c.id,
          assetId: c.assetId,
          kind: asset.kind === 'image' ? 'image' : 'video',
          sourceTime: sourceTime(c, t),
          x: c.transform.x,
          y: c.transform.y,
          scale: c.transform.scale,
          rotation: c.transform.rotation,
          opacity: c.transform.opacity * fadeOpacity(c, local, kf),
          brightness: c.color.brightness,
          contrast: c.color.contrast,
          saturation: c.color.saturation,
          crop: c.crop,
          z,
        })
      } else if (c.type === 'text') {
        const m = textMotion(c, local, kf)
        texts.push({
          key: c.id,
          text: c.text,
          font: c.font,
          size: c.size,
          weight: c.weight,
          color: c.color,
          background: c.background,
          align: c.align,
          x: c.x,
          y: c.y,
          z: z + 1000,
          ...m,
        })
      } else {
        texts.push(captionLayer(c.id, c.text, tl.captionStyle, z + 2000))
      }
    }
  })
  media.sort((a, b) => a.z - b.z)
  texts.sort((a, b) => a.z - b.z)
  return { time: t, width: tl.width, height: tl.height, background: tl.background, media, texts }
}

function captionLayer(key: string, text: string, s: CaptionStyle, z: number): TextLayer {
  return {
    key,
    text,
    font: s.font,
    size: s.size,
    weight: 600,
    color: s.color,
    background: s.background,
    align: 'Center',
    x: 0.5,
    y: s.y,
    opacity: 1,
    offsetY: 0,
    scale: 1,
    z,
  }
}

/** Parses #rgb, #rrggbb or #rrggbbaa into 0..1 floats. */
export function parseColor(hex: string | null | undefined): [number, number, number, number] {
  const h = (hex ?? '#ffffff').replace('#', '')
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h
  const v = (i: number) => parseInt(full.slice(i, i + 2), 16) / 255
  return [v(0), v(2), v(4), full.length >= 8 ? v(6) : 1]
}

// ---------------------------------------------------------------------------
// Audio
// ---------------------------------------------------------------------------

interface EngineKeyframe {
  time: number
  value: number
  interpolation: 'Linear'
  easing: { preset: 'Linear' }
}

export interface AudioTimeline {
  clips: {
    id: string
    sourceId: string
    trackId: string
    startTime: number
    duration: number
    inPoint: number
    speed: number
    gain: number
    fadeIn: number
    fadeOut: number
    keyframes?: { tracks: { property: string; keyframes: EngineKeyframe[] }[] }
    effects?: Record<string, unknown>
  }[]
  tracks: { id: string; volume: number; pan: number; mute: boolean; solo: boolean }[]
  crossTransitions: []
}

/** Volume keyframes that dip a clip while any voice clip plays (auto-ducking). */
function duckKeys(c: MediaClip, voices: [number, number][], gain: number): EngineKeyframe[] | null {
  const k = (time: number, value: number): EngineKeyframe => ({
    time,
    value,
    interpolation: 'Linear',
    easing: { preset: 'Linear' },
  })
  const keys: EngineKeyframe[] = []
  for (const [a, b] of voices) {
    const from = a - c.start
    const to = b - c.start
    if (to <= 0 || from >= c.duration) continue
    keys.push(
      k(Math.max(0, from - 0.25), 1),
      k(Math.max(0, from), gain),
      k(Math.min(c.duration, to), gain),
      k(Math.min(c.duration, to + 0.4), 1),
    )
  }
  if (!keys.length) return null
  keys.sort((x, y) => x.time - y.time)
  // Overlapping dips: keep the lower value at equal times.
  const merged: EngineKeyframe[] = []
  for (const key of keys) {
    const last = merged[merged.length - 1]
    if (last && Math.abs(last.time - key.time) < 1e-6) last.value = Math.min(last.value, key.value)
    else merged.push({ ...key })
  }
  return merged
}

export function buildAudioTimeline(tl: Timeline, assets: Map<string, MediaAsset>): AudioTimeline {
  const voices: [number, number][] = tl.tracks
    .filter((t) => t.kind === 'voice' && !t.muted)
    .flatMap((t) => t.clips.map((c) => [c.start, c.start + c.duration] as [number, number]))
  const duckGain = 10 ** (tl.ducking.amountDb / 20)
  const clips: AudioTimeline['clips'] = []
  for (const track of tl.tracks) {
    for (const c of track.clips) {
      if (c.type !== 'media') continue
      const asset = assets.get(c.assetId)
      if (!asset?.hasAudio) continue
      const effects: Record<string, unknown> = {}
      if (c.audio.gate) effects.noiseGate = { threshold: -45, attack: 2, release: 120 }
      if (c.audio.eq.low || c.audio.eq.mid || c.audio.eq.high)
        effects.eq = { lowGain: c.audio.eq.low, midGain: c.audio.eq.mid, highGain: c.audio.eq.high }
      const ducks =
        tl.ducking.enabled && c.audio.duck && track.kind !== 'voice' ? duckKeys(c, voices, duckGain) : null
      clips.push({
        id: c.id,
        sourceId: c.assetId,
        trackId: track.id,
        startTime: c.start,
        duration: c.duration,
        inPoint: c.offset,
        speed: c.speed,
        gain: c.volume * c.audio.normalizeGain,
        fadeIn: c.fadeIn,
        fadeOut: c.fadeOut,
        ...(ducks ? { keyframes: { tracks: [{ property: 'volume', keyframes: ducks }] } } : {}),
        ...(Object.keys(effects).length ? { effects } : {}),
      })
    }
  }
  return {
    clips,
    tracks: tl.tracks.map((t) => ({ id: t.id, volume: t.volume, pan: 0, mute: t.muted, solo: false })),
    crossTransitions: [],
  }
}

/** Assets whose PCM the audio engine needs. */
export function audioAssetIds(tl: Timeline, assets: Map<string, MediaAsset>): string[] {
  const ids = new Set<string>()
  for (const t of tl.tracks)
    for (const c of t.clips) if (c.type === 'media' && assets.get(c.assetId)?.hasAudio) ids.add(c.assetId)
  return [...ids]
}
