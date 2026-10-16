// Timeline v1: the editor document before plan v2, kept only so stored
// projects can be migrated (model/migrate.ts). Times are in seconds on the timeline. A media clip
// plays its asset from `offset` (source seconds) at `speed`, so it consumes
// `duration * speed` seconds of source. The WASM engine's split/trim/ripple
// functions operate on exactly these fields (start, duration, offset, speed).

export type TrackKind = 'video' | 'text' | 'audio' | 'voice' | 'caption'

export interface Transform {
  /** Centre position, as a fraction of the frame (0.5 = middle). */
  x: number
  y: number
  scale: number
  rotation: number
  opacity: number
}

export interface ColorAdjust {
  brightness: number
  contrast: number
  saturation: number
}

export interface Crop {
  top: number
  right: number
  bottom: number
  left: number
}

export interface AudioFx {
  /** Linear gain from loudness normalization (1 = unchanged). */
  normalizeGain: number
  gate: boolean
  eq: { low: number; mid: number; high: number }
  /** Reduce this clip's level while a voice clip plays (music/background beds). */
  duck: boolean
}

interface ClipBase {
  id: string
  start: number
  duration: number
}

export interface MediaClip extends ClipBase {
  type: 'media'
  assetId: string
  name: string
  offset: number
  speed: number
  volume: number
  fadeIn: number
  fadeOut: number
  transform: Transform
  color: ColorAdjust
  crop: Crop
  audio: AudioFx
}

export type TextAnimation = 'none' | 'fade' | 'rise' | 'pop'

export interface TextClip extends ClipBase {
  type: 'text'
  text: string
  font: string
  size: number
  weight: number
  color: string
  x: number
  y: number
  align: 'Left' | 'Center' | 'Right'
  background: string | null
  animation: TextAnimation
}

export interface CaptionClip extends ClipBase {
  type: 'caption'
  text: string
}

export type Clip = MediaClip | TextClip | CaptionClip

export interface Track {
  id: string
  kind: TrackKind
  name: string
  muted: boolean
  hidden: boolean
  volume: number
  clips: Clip[]
}

export interface CaptionStyle {
  font: string
  size: number
  color: string
  background: string | null
  y: number
}

export interface Timeline {
  version: 1
  width: number
  height: number
  fps: number
  background: string
  tracks: Track[]
  captionStyle: CaptionStyle
  ducking: { enabled: boolean; amountDb: number }
}

export const ASPECT_PRESETS = {
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
} as const

export type AspectKey = keyof typeof ASPECT_PRESETS

export function defaultTransform(): Transform {
  return { x: 0.5, y: 0.5, scale: 1, rotation: 0, opacity: 1 }
}

export function emptyTimeline(aspect: AspectKey = '16:9'): Timeline {
  const { width, height } = ASPECT_PRESETS[aspect]
  return {
    version: 1,
    width,
    height,
    fps: 30,
    background: '#000000',
    tracks: [
      { id: 'trk_text', kind: 'text', name: 'Text', muted: false, hidden: false, volume: 1, clips: [] },
      { id: 'trk_video', kind: 'video', name: 'Video', muted: false, hidden: false, volume: 1, clips: [] },
      {
        id: 'trk_captions',
        kind: 'caption',
        name: 'Captions',
        muted: false,
        hidden: false,
        volume: 1,
        clips: [],
      },
      { id: 'trk_voice', kind: 'voice', name: 'Voice', muted: false, hidden: false, volume: 1, clips: [] },
      {
        id: 'trk_audio',
        kind: 'audio',
        name: 'Music & audio',
        muted: false,
        hidden: false,
        volume: 1,
        clips: [],
      },
    ],
    captionStyle: { font: 'Inter', size: 54, color: '#ffffff', background: '#000000b3', y: 0.86 },
    ducking: { enabled: true, amountDb: -12 },
  }
}

export function timelineDuration(t: Timeline): number {
  let end = 0
  for (const track of t.tracks) for (const c of track.clips) end = Math.max(end, c.start + c.duration)
  return end
}

export function findClip(t: Timeline, id: string): { track: Track; clip: Clip } | null {
  for (const track of t.tracks) {
    const clip = track.clips.find((c) => c.id === id)
    if (clip) return { track, clip }
  }
  return null
}

export function clipId(): string {
  return `clp_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`
}
