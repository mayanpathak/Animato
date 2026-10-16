// Timeline v2 (plan 10.2): the editor document on @tooscut/render-engine's
// model. Tracks are render-engine track pairs; media clips are render-engine
// EditableClips, so every time on a clip (startTime, duration, inPoint, fades)
// is an integer frame count at `fps`. Titles and captions are not clips: they
// are graphics items (plan 8.4) timed in seconds, drawn over the video.
import type { CrossTransitionRef, EditableClip, EditableTrack } from '@tooscut/render-engine'

export type Seconds = number
export type Frames = number

export type TrackRole = 'main' | 'broll' | 'voice' | 'music'

export interface TrackV2 extends EditableTrack {
  /** What the lane is for: main video, B-roll, voiceover, music (plan 13.2 asset roles). */
  role: TrackRole
  hidden: boolean
}

export interface Transform {
  /** Centre position as a fraction of the frame (0.5 = middle). */
  x: number
  y: number
  /** Relative to "fit inside the frame" (1 = fitted). */
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
  /** Linear gain from loudness normalisation (1 = unchanged). */
  normalizeGain: number
  gate: boolean
  eq: { low: number; mid: number; high: number }
  /** Dip under voice (music and background beds). */
  duck: boolean
}

export interface MediaClipV2 extends EditableClip {
  type: 'media'
  assetId: string
  name: string
  /** Source seconds per timeline second. */
  speed: number
  volume: number
  fadeIn: Frames
  fadeOut: Frames
  transform: Transform
  color: ColorAdjust
  crop: Crop
  audio: AudioFx
}

export type TitleMotion = 'none' | 'fade' | 'rise' | 'pop'

/** A title graphic (plan 8.4 `title`). Drawn by the compositor today, by Vello from P5. */
export interface TitleItem {
  kind: 'title'
  id: string
  start: Seconds
  end: Seconds
  text: string
  font: string
  /** Design pixels: the canvas's short side is 1080 (plan 8.4). */
  size: number
  weight: number
  color: string
  background: string | null
  align: 'Left' | 'Center' | 'Right'
  /** Centre, as fractions of the frame. */
  x: number
  y: number
  enter: TitleMotion
  layer: 'over'
}

/** The captions graphic (plan 8.4 `captions`): reads the video's transcript. */
export interface CaptionsItem {
  kind: 'captions'
  id: string
  font: string
  size: number
  color: string
  background: string | null
  /** Vertical centre as a fraction of the frame. */
  y: number
  maxWords: number
  highlight: 'word' | 'none'
  layer: 'over'
}

export type GraphicItemV2 = TitleItem | CaptionsItem

export interface TimelineV2 {
  version: 2
  width: number
  height: number
  fps: number
  background: string
  tracks: TrackV2[]
  /** Media clips, sorted by startTime (render-engine invariant). */
  clips: MediaClipV2[]
  crossTransitions: CrossTransitionRef[]
  /** User edits to look-generated graphics, by item id (filled from P6). */
  graphicsOverrides: Record<string, Record<string, unknown>>
  /** Graphics the user added by hand (titles), plus the captions item. */
  extraGraphics: GraphicItemV2[]
  audio: { ducking: { enabled: boolean; amountDb: number } }
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

export const MAIN_VIDEO = 'trk_v1'
export const MAIN_AUDIO = 'trk_a1'
export const VOICE_VIDEO = 'trk_v_voice'
export const VOICE_AUDIO = 'trk_a_voice'

/** Two render-engine track pairs: the main pair and a voice pair (its video half stays empty). */
export function defaultTracks(): TrackV2[] {
  const t = (
    id: string,
    index: number,
    type: 'video' | 'audio',
    pairedTrackId: string,
    role: TrackRole,
    name: string,
  ): TrackV2 => ({
    id,
    index,
    type,
    pairedTrackId,
    role,
    name,
    muted: false,
    locked: false,
    volume: 1,
    hidden: false,
  })
  return [
    t(MAIN_VIDEO, 0, 'video', MAIN_AUDIO, 'main', 'Video'),
    t(MAIN_AUDIO, 0, 'audio', MAIN_VIDEO, 'music', 'Music & audio'),
    t(VOICE_VIDEO, 1, 'video', VOICE_AUDIO, 'voice', 'Voice video'),
    t(VOICE_AUDIO, 1, 'audio', VOICE_VIDEO, 'voice', 'Voice'),
  ]
}

export function defaultCaptions(): CaptionsItem {
  return {
    kind: 'captions',
    id: 'gfx_captions',
    font: 'Inter',
    size: 54,
    color: '#ffffff',
    background: '#000000b3',
    y: 0.86,
    maxWords: 7,
    highlight: 'none',
    layer: 'over',
  }
}

export function emptyTimelineV2(aspect: AspectKey = '16:9'): TimelineV2 {
  const { width, height } = ASPECT_PRESETS[aspect]
  return {
    version: 2,
    width,
    height,
    fps: 30,
    background: '#000000',
    tracks: defaultTracks(),
    clips: [],
    crossTransitions: [],
    graphicsOverrides: {},
    extraGraphics: [],
    audio: { ducking: { enabled: true, amountDb: -12 } },
  }
}

// ----------------------------------------------------------------- time units

export function toFrames(tl: Pick<TimelineV2, 'fps'>, s: Seconds): Frames {
  return Math.round(s * tl.fps)
}

export function toSeconds(tl: Pick<TimelineV2, 'fps'>, f: Frames): Seconds {
  return f / tl.fps
}

export function clipStart(tl: TimelineV2, c: MediaClipV2): Seconds {
  return toSeconds(tl, c.startTime)
}

export function clipEnd(tl: TimelineV2, c: MediaClipV2): Seconds {
  return toSeconds(tl, c.startTime + c.duration)
}

/** End of the last media clip or title, in seconds. */
export function timelineDurationV2(tl: TimelineV2): Seconds {
  let end = 0
  for (const c of tl.clips) end = Math.max(end, clipEnd(tl, c))
  for (const g of tl.extraGraphics) if (g.kind === 'title') end = Math.max(end, g.end)
  return end
}

export function trackOf(tl: TimelineV2, id: string): TrackV2 | undefined {
  return tl.tracks.find((t) => t.id === id)
}

export function clipId(): string {
  return `clp_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`
}

export function graphicId(): string {
  return `gfx_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`
}

export function captionsItem(tl: TimelineV2): CaptionsItem | null {
  return (tl.extraGraphics.find((g) => g.kind === 'captions') as CaptionsItem | undefined) ?? null
}

export function aspectOf(tl: Pick<TimelineV2, 'width' | 'height'>): AspectKey {
  const r = tl.width / tl.height
  return r > 1.2 ? '16:9' : r < 0.8 ? '9:16' : '1:1'
}
