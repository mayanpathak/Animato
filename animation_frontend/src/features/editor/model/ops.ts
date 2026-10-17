// Pure edits on Timeline v2. Data operations come from @tooscut/render-engine
// (binary-search insertion, sorted-by-start invariant, split, trims, moves);
// these wrappers add what Animato's clips carry on top: playback speed (the
// engine's in-points assume speed 1) and seconds at the UI boundary.
// P9 turns each of these into a serialisable command.
import {
  addClip,
  moveClip,
  moveClipToTrack,
  removeClip,
  sortClipsByStartTime,
  splitClip,
  trimClipLeft,
  trimClipRight,
} from '@tooscut/render-engine'
import type { MediaAsset } from '@/lib/local/models'
import {
  defaultTransform,
  MAIN_AUDIO,
  MAIN_VIDEO,
  toFrames,
  toSeconds,
  type GraphicItemV2,
  type MediaClipV2,
  type TimelineV2,
  type TitleItem,
} from './timelineV2'

export function mediaClipFor(
  tl: TimelineV2,
  asset: MediaAsset,
  startSeconds: number,
  trackId: string,
  id: string,
): MediaClipV2 {
  const seconds = asset.kind === 'image' ? 3 : asset.duration
  return {
    id,
    type: 'media',
    trackId,
    startTime: toFrames(tl, Math.max(0, startSeconds)),
    duration: Math.max(1, toFrames(tl, seconds)),
    inPoint: 0,
    assetId: asset.id,
    name: asset.name,
    speed: 1,
    volume: 1,
    fadeIn: 0,
    fadeOut: 0,
    transform: defaultTransform(),
    color: { brightness: 1, contrast: 1, saturation: 1 },
    crop: { top: 0, right: 0, bottom: 0, left: 0 },
    audio: { normalizeGain: 1, gate: false, eq: { low: 0, mid: 0, high: 0 }, duck: asset.kind === 'audio' },
  }
}

export function trackEnd(tl: TimelineV2, trackId: string): number {
  let end = 0
  for (const c of tl.clips) if (c.trackId === trackId) end = Math.max(end, c.startTime + c.duration)
  return toSeconds(tl, end)
}

/** Appends an asset to the end of its lane (video/image → main video, audio → music). */
export function appendAsset(tl: TimelineV2, asset: MediaAsset, id: string): TimelineV2 {
  const trackId = asset.kind === 'audio' ? MAIN_AUDIO : MAIN_VIDEO
  return insertClip(tl, mediaClipFor(tl, asset, trackEnd(tl, trackId), trackId, id))
}

export function insertClip(tl: TimelineV2, clip: MediaClipV2): TimelineV2 {
  return { ...tl, clips: addClip(tl.clips, clip) }
}

export function findMedia(tl: TimelineV2, id: string): MediaClipV2 | undefined {
  return tl.clips.find((c) => c.id === id)
}

export function splitAt(tl: TimelineV2, id: string, atSeconds: number, rightId: string): TimelineV2 {
  const clip = findMedia(tl, id)
  if (!clip) return tl
  const at = toFrames(tl, atSeconds)
  const parts = splitClip(clip, at, clip.id, rightId)
  if (!parts) return tl
  const leftFrames = parts.left.duration
  // Source advances `speed` frames per timeline frame.
  parts.right.inPoint = clip.inPoint + Math.round(leftFrames * clip.speed)
  parts.left.fadeOut = 0
  parts.right.fadeIn = 0
  return { ...tl, clips: addClip(addClip(removeClip(tl.clips, id), parts.left), parts.right) }
}

export function trimTo(tl: TimelineV2, id: string, edge: 'start' | 'end', toSeconds_: number): TimelineV2 {
  const clip = findMedia(tl, id)
  if (!clip) return tl
  const to = toFrames(tl, toSeconds_)
  if (edge === 'end') {
    const duration = Math.max(1, to - clip.startTime)
    return { ...tl, clips: trimClipRight(tl.clips, id, duration) }
  }
  const start = Math.max(0, Math.min(to, clip.startTime + clip.duration - 1))
  const trimmed = trimClipLeft(tl.clips, id, start)
  // trimClipLeft moves the in-point one source frame per timeline frame; scale by speed.
  const delta = start - clip.startTime
  return {
    ...tl,
    clips: trimmed.map((c) =>
      c.id === id ? { ...c, inPoint: Math.max(0, clip.inPoint + Math.round(delta * clip.speed)) } : c,
    ),
  }
}

export function removeMedia(tl: TimelineV2, id: string): TimelineV2 {
  return { ...tl, clips: removeClip(tl.clips, id) }
}

/** Removes a clip and pulls everything after it on the same lane back by its length. */
export function rippleDelete(tl: TimelineV2, id: string): TimelineV2 {
  const clip = findMedia(tl, id)
  if (!clip) return tl
  const gap = clip.duration
  const end = clip.startTime + clip.duration
  const clips = removeClip(tl.clips, id).map((c) =>
    c.trackId === clip.trackId && c.startTime >= end ? { ...c, startTime: c.startTime - gap } : c,
  )
  return { ...tl, clips: sortClipsByStartTime(clips) }
}

export function moveMedia(tl: TimelineV2, id: string, startSeconds: number, trackId?: string): TimelineV2 {
  let clips = moveClip(tl.clips, id, Math.max(0, toFrames(tl, startSeconds)))
  if (trackId) {
    const clip = clips.find((c) => c.id === id)
    const target = tl.tracks.find((t) => t.id === trackId)
    const fromTrack = clip ? tl.tracks.find((t) => t.id === clip.trackId) : undefined
    // Clips move between lanes of the same type only.
    if (clip && target && fromTrack && target.type === fromTrack.type)
      clips = moveClipToTrack(clips, id, trackId)
  }
  return { ...tl, clips }
}

export function updateMedia(tl: TimelineV2, id: string, patch: Partial<MediaClipV2>): TimelineV2 {
  return { ...tl, clips: tl.clips.map((c) => (c.id === id ? { ...c, ...patch, id: c.id } : c)) }
}

/** The same source span plays faster or slower, so the clip length changes. */
export function setSpeed(tl: TimelineV2, id: string, speed: number): TimelineV2 {
  const clip = findMedia(tl, id)
  if (!clip) return tl
  const s = Math.max(0.25, Math.min(4, speed))
  const duration = Math.max(1, Math.round((clip.duration * clip.speed) / s))
  return updateMedia(tl, id, { speed: s, duration })
}

export function duplicateMedia(tl: TimelineV2, id: string, newId: string): TimelineV2 {
  const clip = findMedia(tl, id)
  if (!clip) return tl
  const end = toFrames(tl, trackEnd(tl, clip.trackId))
  return insertClip(tl, { ...structuredClone(clip), id: newId, startTime: end })
}

// --------------------------------------------------------------- graphics

export function findGraphic(tl: TimelineV2, id: string): GraphicItemV2 | undefined {
  return tl.extraGraphics.find((g) => g.id === id)
}

export function addGraphic(tl: TimelineV2, item: GraphicItemV2): TimelineV2 {
  return { ...tl, extraGraphics: [...tl.extraGraphics.filter((g) => g.id !== item.id), item] }
}

export function updateGraphic(tl: TimelineV2, id: string, patch: Partial<GraphicItemV2>): TimelineV2 {
  return {
    ...tl,
    extraGraphics: tl.extraGraphics.map((g) =>
      g.id === id ? ({ ...g, ...patch, id, kind: g.kind } as GraphicItemV2) : g,
    ),
  }
}

export function removeGraphic(tl: TimelineV2, id: string): TimelineV2 {
  return { ...tl, extraGraphics: tl.extraGraphics.filter((g) => g.id !== id) }
}

export function moveTitle(tl: TimelineV2, id: string, startSeconds: number): TimelineV2 {
  const g = findGraphic(tl, id)
  if (!g || g.kind !== 'title') return tl
  const start = Math.max(0, startSeconds)
  return updateGraphic(tl, id, { start, end: start + (g.end - g.start) } as Partial<TitleItem>)
}

export function trimTitle(tl: TimelineV2, id: string, edge: 'start' | 'end', to: number): TimelineV2 {
  const g = findGraphic(tl, id)
  if (!g || g.kind !== 'title') return tl
  if (edge === 'end') return updateGraphic(tl, id, { end: Math.max(g.start + 0.1, to) } as Partial<TitleItem>)
  return updateGraphic(tl, id, { start: Math.max(0, Math.min(to, g.end - 0.1)) } as Partial<TitleItem>)
}

export function splitTitle(tl: TimelineV2, id: string, at: number, rightId: string): TimelineV2 {
  const g = findGraphic(tl, id)
  if (!g || g.kind !== 'title' || at <= g.start || at >= g.end) return tl
  return addGraphic(updateGraphic(tl, id, { end: at } as Partial<TitleItem>), {
    ...g,
    id: rightId,
    start: at,
  })
}
