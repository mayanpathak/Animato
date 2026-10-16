// Pure functions shared by the preview and the exporter: what is on screen at
// time t (layer plan) and what the audio engine should mix (audio timeline).
// Media layers are built by @tooscut/render-engine (visibility by binary
// search, keyframes evaluated in TypeScript, z-order from track index).
// Titles and captions become text layers here until Vello draws the graphics
// document (P5).
import {
  buildRenderFrame,
  createEasedKeyframe,
  createLinearKeyframe,
  EvaluatorManager,
  getVisibleClips,
  KeyframeEvaluator,
  type KeyframeTracks,
  type TimelineClip,
} from '@tooscut/render-engine'
import type { MediaAsset } from '@/lib/local/models'
import {
  captionsItem,
  toFrames,
  toSeconds,
  type MediaClipV2,
  type TimelineV2,
  type TitleItem,
} from '../model/timelineV2'
import { captionAt, type Transcript } from '../model/transcript'

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

/** Clip fades as an opacity keyframe track in clip-local frames. */
function fadeKeyframes(c: MediaClipV2): KeyframeTracks | undefined {
  if (c.fadeIn <= 0 && c.fadeOut <= 0) return undefined
  const keys = []
  if (c.fadeIn > 0) keys.push(createEasedKeyframe(0, 0, 'EaseOut'), createLinearKeyframe(c.fadeIn, 1))
  else keys.push(createLinearKeyframe(0, 1))
  if (c.fadeOut > 0)
    keys.push(
      createEasedKeyframe(Math.max(c.fadeIn, c.duration - c.fadeOut), 1, 'EaseIn'),
      createLinearKeyframe(c.duration, 0),
    )
  return { tracks: [{ property: 'opacity', keyframes: keys }] }
}

// One evaluator cache per worker; render-engine recreates entries when keyframes change.
const evaluators = new EvaluatorManager()
const fadeCache = new WeakMap<MediaClipV2, KeyframeTracks | undefined>()

function asTimelineClip(c: MediaClipV2): TimelineClip {
  if (!fadeCache.has(c)) fadeCache.set(c, fadeKeyframes(c))
  return {
    id: c.id,
    assetId: c.id, // the layer key: one texture per clip
    trackId: c.trackId,
    startTime: c.startTime,
    duration: c.duration,
    inPoint: c.inPoint,
    // Normalised: x/y are fractions of the frame, scale is relative to "fit".
    transform: {
      x: c.transform.x,
      y: c.transform.y,
      scale_x: c.transform.scale,
      scale_y: c.transform.scale,
      rotation: c.transform.rotation,
    },
    effects: {
      opacity: c.transform.opacity,
      brightness: c.color.brightness,
      contrast: c.color.contrast,
      saturation: c.color.saturation,
    },
    crop: c.crop,
    keyframes: fadeCache.get(c),
  }
}

/** Source seconds shown by a clip at timeline second t. */
export function sourceTime(tl: TimelineV2, c: MediaClipV2, t: number): number {
  return toSeconds(tl, c.inPoint) + (t - toSeconds(tl, c.startTime)) * c.speed
}

function titleMotion(g: TitleItem, local: number): { opacity: number; offsetY: number; scale: number } {
  const duration = g.end - g.start
  const outStart = Math.max(0, duration - 0.3)
  const fade = new KeyframeEvaluator({
    tracks: [
      {
        property: 'v',
        keyframes: [
          createEasedKeyframe(0, 0, 'EaseOut'),
          createLinearKeyframe(0.4, 1),
          createEasedKeyframe(outStart, 1, 'EaseIn'),
          createLinearKeyframe(duration, 0),
        ],
      },
    ],
  }).evaluate('v', local)
  const one = (keys: ReturnType<typeof createLinearKeyframe>[]) =>
    new KeyframeEvaluator({ tracks: [{ property: 'v', keyframes: keys }] }).evaluate('v', local)
  switch (g.enter) {
    case 'fade':
      return { opacity: fade, offsetY: 0, scale: 1 }
    case 'rise':
      return {
        opacity: fade,
        offsetY: one([createEasedKeyframe(0, 48, 'EaseOut'), createLinearKeyframe(0.6, 0)]),
        scale: 1,
      }
    case 'pop':
      return {
        opacity: fade,
        offsetY: 0,
        scale: one([
          createEasedKeyframe(0, 0.82, 'EaseOut'),
          createEasedKeyframe(0.35, 1.04, 'EaseInOut'),
          createLinearKeyframe(0.5, 1),
        ]),
      }
    default:
      return { opacity: 1, offsetY: 0, scale: 1 }
  }
}

export function planFrame(
  tl: TimelineV2,
  t: number,
  assets: Map<string, MediaAsset>,
  transcript?: Transcript | null,
): FramePlan {
  const frame = toFrames(tl, t)
  const byId = new Map(tl.clips.map((c) => [c.id, c]))
  const visual = tl.tracks.filter((tr) => tr.type === 'video' && !tr.hidden)
  const visualIds = new Set(visual.map((tr) => tr.id))
  const candidates = getVisibleClips(tl.clips, frame).filter((c) => {
    const kind = assets.get(c.assetId)?.kind
    return visualIds.has(c.trackId) && (kind === 'video' || kind === 'image')
  })
  const rendered = buildRenderFrame({
    mediaClips: candidates.map(asTimelineClip),
    tracks: visual.map((tr) => ({ id: tr.id, index: tr.index, type: 'video' as const })),
    timelineTime: frame,
    width: tl.width,
    height: tl.height,
    evaluatorManager: evaluators,
  })
  const media: MediaLayer[] = []
  for (const layer of rendered.media_layers) {
    const c = byId.get(layer.texture_id)
    if (!c) continue
    const asset = assets.get(c.assetId)
    media.push({
      key: c.id,
      assetId: c.assetId,
      kind: asset?.kind === 'image' ? 'image' : 'video',
      sourceTime: sourceTime(tl, c, t),
      x: layer.transform.x,
      y: layer.transform.y,
      scale: layer.transform.scale_x,
      rotation: layer.transform.rotation,
      opacity: layer.effects.opacity,
      brightness: layer.effects.brightness,
      contrast: layer.effects.contrast,
      saturation: layer.effects.saturation,
      crop: layer.crop ?? c.crop,
      z: layer.z_index * 10,
    })
  }

  const texts: TextLayer[] = []
  tl.extraGraphics.forEach((g, i) => {
    if (g.kind !== 'title' || t < g.start || t >= g.end) return
    texts.push({
      key: g.id,
      text: g.text,
      font: g.font,
      size: g.size,
      weight: g.weight,
      color: g.color,
      background: g.background,
      align: g.align,
      x: g.x,
      y: g.y,
      z: 1000 + i,
      ...titleMotion(g, t - g.start),
    })
  })
  const cap = captionsItem(tl)
  const line = cap ? captionAt(transcript, t, cap.maxWords) : null
  if (cap && line)
    texts.push({
      key: cap.id,
      text: line.text,
      font: cap.font,
      size: cap.size,
      weight: 600,
      color: cap.color,
      background: cap.background,
      align: 'Center',
      x: 0.5,
      y: cap.y,
      opacity: 1,
      offsetY: 0,
      scale: 1,
      z: 2000,
    })
  return { time: t, width: tl.width, height: tl.height, background: tl.background, media, texts }
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

/** Volume keyframes (clip-local seconds) that dip a clip while any voice plays. */
function duckKeys(
  start: number,
  duration: number,
  voices: [number, number][],
  gain: number,
): EngineKeyframe[] | null {
  const k = (time: number, value: number): EngineKeyframe => ({
    time,
    value,
    interpolation: 'Linear',
    easing: { preset: 'Linear' },
  })
  const keys: EngineKeyframe[] = []
  for (const [a, b] of voices) {
    const from = a - start
    const to = b - start
    if (to <= 0 || from >= duration) continue
    keys.push(
      k(Math.max(0, from - 0.25), 1),
      k(Math.max(0, from), gain),
      k(Math.min(duration, to), gain),
      k(Math.min(duration, to + 0.4), 1),
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

/** The Rust audio engine's timeline (seconds), from Timeline v2. */
export function buildAudioTimeline(tl: TimelineV2, assets: Map<string, MediaAsset>): AudioTimeline {
  const s = (f: number) => toSeconds(tl, f)
  const role = new Map(tl.tracks.map((t) => [t.id, t]))
  const voices: [number, number][] = tl.clips
    .filter((c) => role.get(c.trackId)?.role === 'voice' && !role.get(c.trackId)?.muted)
    .map((c) => [s(c.startTime), s(c.startTime + c.duration)])
  const duckGain = 10 ** (tl.audio.ducking.amountDb / 20)
  const clips: AudioTimeline['clips'] = []
  for (const c of tl.clips) {
    const asset = assets.get(c.assetId)
    if (!asset?.hasAudio) continue
    const track = role.get(c.trackId)
    const effects: Record<string, unknown> = {}
    if (c.audio.gate) effects.noiseGate = { threshold: -45, attack: 2, release: 120 }
    if (c.audio.eq.low || c.audio.eq.mid || c.audio.eq.high)
      effects.eq = { lowGain: c.audio.eq.low, midGain: c.audio.eq.mid, highGain: c.audio.eq.high }
    const start = s(c.startTime)
    const duration = s(c.duration)
    const ducks =
      tl.audio.ducking.enabled && c.audio.duck && track?.role !== 'voice'
        ? duckKeys(start, duration, voices, duckGain)
        : null
    clips.push({
      id: c.id,
      sourceId: c.assetId,
      trackId: c.trackId,
      startTime: start,
      duration,
      inPoint: s(c.inPoint),
      speed: c.speed,
      gain: c.volume * c.audio.normalizeGain,
      fadeIn: s(c.fadeIn),
      fadeOut: s(c.fadeOut),
      ...(ducks ? { keyframes: { tracks: [{ property: 'volume', keyframes: ducks }] } } : {}),
      ...(Object.keys(effects).length ? { effects } : {}),
    })
  }
  return {
    clips,
    tracks: tl.tracks.map((t) => ({ id: t.id, volume: t.volume, pan: 0, mute: t.muted, solo: false })),
    crossTransitions: [],
  }
}

/** Assets whose audio the engine needs. */
export function audioAssetIds(tl: TimelineV2, assets: Map<string, MediaAsset>): string[] {
  const ids = new Set<string>()
  for (const c of tl.clips) if (assets.get(c.assetId)?.hasAudio) ids.add(c.assetId)
  return [...ids]
}
