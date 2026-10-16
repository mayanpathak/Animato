// Timeline v1 → v2 (plan 10.2). Runs once on load; the caller keeps the v1
// document as a backup on the record. Media keeps its timing exactly (seconds
// → frames at the timeline's fps); text clips become title graphics; caption
// clips become a transcript (words spread across each cue) and the captions item.
import type { Timeline as TimelineV1, MediaClip, TextClip, CaptionClip } from './timeline'
import {
  defaultCaptions,
  defaultTracks,
  MAIN_AUDIO,
  MAIN_VIDEO,
  VOICE_AUDIO,
  type GraphicItemV2,
  type MediaClipV2,
  type TimelineV2,
} from './timelineV2'
import { transcriptFromCues, type Transcript } from './transcript'

export function isV2(t: { version: number }): t is TimelineV2 {
  return t.version === 2
}

export function migrateTimeline(v1: TimelineV1): { timeline: TimelineV2; transcript: Transcript | null } {
  const fps = v1.fps || 30
  const f = (s: number) => Math.round(s * fps)
  const tracks = defaultTracks()
  const mainVideo = tracks.find((t) => t.id === MAIN_VIDEO)!
  const v1Video = v1.tracks.find((t) => t.kind === 'video')
  if (v1Video) {
    mainVideo.muted = v1Video.muted
    mainVideo.hidden = v1Video.hidden
    mainVideo.volume = v1Video.volume
  }
  for (const kind of ['audio', 'voice'] as const) {
    const src = v1.tracks.find((t) => t.kind === kind)
    const dst = tracks.find((t) => t.id === (kind === 'audio' ? MAIN_AUDIO : VOICE_AUDIO))!
    if (src) {
      dst.muted = src.muted
      dst.hidden = src.hidden
      dst.volume = src.volume
    }
  }

  const clips: MediaClipV2[] = []
  const graphics: GraphicItemV2[] = []
  const cues: { start: number; end: number; text: string }[] = []
  for (const track of v1.tracks) {
    for (const c of track.clips) {
      if (c.type === 'media') {
        const m = c as MediaClip
        clips.push({
          id: m.id,
          type: 'media',
          trackId: track.kind === 'audio' ? MAIN_AUDIO : track.kind === 'voice' ? VOICE_AUDIO : MAIN_VIDEO,
          startTime: f(m.start),
          duration: Math.max(1, f(m.duration)),
          inPoint: f(m.offset),
          assetId: m.assetId,
          name: m.name,
          speed: m.speed,
          volume: m.volume,
          fadeIn: f(m.fadeIn),
          fadeOut: f(m.fadeOut),
          transform: { ...m.transform },
          color: { ...m.color },
          crop: { ...m.crop },
          audio: structuredClone(m.audio),
        })
      } else if (c.type === 'text') {
        const t = c as TextClip
        graphics.push({
          kind: 'title',
          id: t.id,
          start: t.start,
          end: t.start + t.duration,
          text: t.text,
          font: t.font,
          size: t.size,
          weight: t.weight,
          color: t.color,
          background: t.background,
          align: t.align,
          x: t.x,
          y: t.y,
          enter: t.animation,
          layer: 'over',
        })
      } else {
        const cap = c as CaptionClip
        cues.push({ start: cap.start, end: cap.start + cap.duration, text: cap.text })
      }
    }
  }
  clips.sort((a, b) => a.startTime - b.startTime)

  let transcript: Transcript | null = null
  if (cues.length) {
    cues.sort((a, b) => a.start - b.start)
    transcript = transcriptFromCues(cues, { assetId: '', model: 'migrated-v1-captions' })
    const s = v1.captionStyle
    graphics.push({
      ...defaultCaptions(),
      font: s.font,
      size: s.size,
      color: s.color,
      background: s.background,
      y: s.y,
    })
  }

  return {
    timeline: {
      version: 2,
      width: v1.width,
      height: v1.height,
      fps,
      background: v1.background,
      tracks,
      clips,
      crossTransitions: [],
      graphicsOverrides: {},
      extraGraphics: graphics,
      audio: { ducking: { ...v1.ducking } },
    },
    transcript,
  }
}
