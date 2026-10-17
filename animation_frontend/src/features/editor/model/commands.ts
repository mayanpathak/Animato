// Every edit is a command (plan 13.1): plain JSON objects, applied by one
// pure function. The editor store records them with each undo step, and the
// edit-plan compiler (section 13.4) produces them, so a future AI edit is a
// list of these and nothing else. New ids are chosen by whoever builds the
// command, never while applying it, so replaying a list gives the same result.
import type { MediaAsset } from '@/lib/local/models'
import type { BrandRender } from '../graphics/looks'
import * as finishOps from './finish'
import {
  addGraphic,
  duplicateMedia,
  findGraphic,
  findMedia,
  insertClip,
  mediaClipFor,
  moveMedia,
  moveTitle,
  removeGraphic,
  removeMedia,
  rippleDelete,
  setSpeed,
  splitAt,
  splitTitle,
  trackEnd,
  trimTitle,
  trimTo,
  updateGraphic,
  updateMedia,
} from './ops'
import {
  captionsItem,
  defaultCaptions,
  MAIN_AUDIO,
  MAIN_VIDEO,
  toFrames,
  type AspectKey,
  type CaptionStyleId,
  type FinishSettings,
  type GraphicItemV2,
  type LookId,
  type MediaClipV2,
  type TimelineV2,
  type TrackV2,
} from './timelineV2'
import type { Transcript } from './transcript'

export interface Doc {
  timeline: TimelineV2
  transcript: Transcript | null
}

/** What commands may read but never change: the media library and the brand. */
export interface CommandContext {
  assets: Map<string, MediaAsset>
  brand?: BrandRender | null
}

export type Command =
  /** An asset on a track at `start` seconds; `start: 'end'` appends after the track's last clip. */
  | {
      type: 'clip.add'
      id: string
      assetId: string
      trackId: string
      start: number | 'end'
      /** Seconds into the source where the clip starts, and how long it runs (both clamped to the media). */
      inPoint?: number
      duration?: number
    }
  | { type: 'clip.split'; id: string; at: number; newId: string }
  | { type: 'clip.trim'; id: string; edge: 'start' | 'end'; to: number }
  | { type: 'clip.remove'; id: string }
  | { type: 'clip.rippleDelete'; id: string }
  | { type: 'clip.duplicate'; id: string; newId: string }
  | { type: 'clip.move'; id: string; start: number; trackId?: string }
  | { type: 'clip.update'; id: string; patch: Partial<MediaClipV2> }
  | { type: 'clip.speed'; id: string; speed: number }
  /** Replaces every clip on a track with one asset from 0 s (a new take, the user's own main clip). */
  | { type: 'track.replace'; trackId: string; id: string; assetId: string }
  | { type: 'track.update'; id: string; patch: Partial<TrackV2> }
  | { type: 'graphic.add'; item: GraphicItemV2 }
  | { type: 'graphic.update'; id: string; patch: Partial<GraphicItemV2> }
  /** Sets the words captions follow; adds the captions item when there is none. */
  | { type: 'transcript.set'; transcript: Transcript | null }
  | { type: 'timeline.update'; patch: Partial<Pick<TimelineV2, 'audio' | 'background' | 'fps'>> }
  | { type: 'finish.set'; finish: FinishSettings }
  | { type: 'finish.look'; look: LookId }
  | { type: 'finish.captionStyle'; style: CaptionStyleId }
  | { type: 'finish.format'; aspect: AspectKey }
  /** A whole saved document (session restore). */
  | { type: 'doc.restore'; timeline: TimelineV2; transcript: Transcript | null }

export type CommandType = Command['type']

/** The timeline with a captions item, styled by Finish when the video has Finish settings. */
function withCaptions(tl: TimelineV2, ctx: CommandContext): TimelineV2 {
  if (captionsItem(tl)) return tl
  const added = addGraphic(tl, defaultCaptions())
  return added.finish
    ? finishOps.setCaptionStyle(added, added.finish.captions.style, { assets: ctx.assets, brand: ctx.brand })
    : added
}

function onTimeline(d: Doc, timeline: TimelineV2): Doc {
  return timeline === d.timeline ? d : { ...d, timeline }
}

/** One command. Unknown ids and assets leave the document as it was. */
export function applyCommand(d: Doc, c: Command, ctx: CommandContext): Doc {
  const tl = d.timeline
  const finishCtx = { assets: ctx.assets, brand: ctx.brand }
  switch (c.type) {
    case 'clip.add': {
      const asset = ctx.assets.get(c.assetId)
      if (!asset) return d
      const start = c.start === 'end' ? trackEnd(tl, c.trackId) : c.start
      const clip = mediaClipFor(tl, asset, start, c.trackId, c.id)
      if (c.inPoint !== undefined || c.duration !== undefined) {
        const length = clip.duration
        const inPoint = Math.min(Math.max(0, toFrames(tl, c.inPoint ?? 0)), length - 1)
        const rest = length - inPoint
        clip.inPoint = inPoint
        clip.duration =
          c.duration === undefined ? rest : Math.max(1, Math.min(rest, toFrames(tl, c.duration)))
      }
      return onTimeline(d, insertClip(tl, clip))
    }
    case 'clip.split':
      return onTimeline(
        d,
        findMedia(tl, c.id) ? splitAt(tl, c.id, c.at, c.newId) : splitTitle(tl, c.id, c.at, c.newId),
      )
    case 'clip.trim':
      return onTimeline(
        d,
        findMedia(tl, c.id) ? trimTo(tl, c.id, c.edge, c.to) : trimTitle(tl, c.id, c.edge, c.to),
      )
    case 'clip.remove':
      return onTimeline(d, findMedia(tl, c.id) ? removeMedia(tl, c.id) : removeGraphic(tl, c.id))
    case 'clip.rippleDelete':
      return onTimeline(d, findMedia(tl, c.id) ? rippleDelete(tl, c.id) : removeGraphic(tl, c.id))
    case 'clip.duplicate': {
      if (findMedia(tl, c.id)) return onTimeline(d, duplicateMedia(tl, c.id, c.newId))
      const g = findGraphic(tl, c.id)
      if (g?.kind !== 'title') return d
      const span = g.end - g.start
      return onTimeline(d, addGraphic(tl, { ...g, id: c.newId, start: g.end, end: g.end + span }))
    }
    case 'clip.move':
      return onTimeline(
        d,
        findMedia(tl, c.id)
          ? moveMedia(tl, c.id, Math.round(c.start * 1000) / 1000, c.trackId)
          : moveTitle(tl, c.id, c.start),
      )
    case 'clip.update':
      return onTimeline(d, updateMedia(tl, c.id, c.patch))
    case 'clip.speed':
      return onTimeline(d, setSpeed(tl, c.id, c.speed))
    case 'track.replace': {
      const asset = ctx.assets.get(c.assetId)
      if (!asset) return d
      const kept = tl.clips.filter((x) => x.trackId !== c.trackId)
      const base = { ...tl, clips: kept }
      return onTimeline(d, insertClip(base, mediaClipFor(base, asset, 0, c.trackId, c.id)))
    }
    case 'track.update':
      return onTimeline(d, {
        ...tl,
        tracks: tl.tracks.map((t) => (t.id === c.id ? { ...t, ...c.patch, id: c.id } : t)),
      })
    case 'graphic.add':
      return onTimeline(d, addGraphic(tl, c.item))
    case 'graphic.update':
      return onTimeline(d, updateGraphic(tl, c.id, c.patch))
    case 'transcript.set':
      return {
        timeline: c.transcript ? withCaptions(tl, ctx) : tl,
        transcript: c.transcript,
      }
    case 'timeline.update':
      return onTimeline(d, { ...tl, ...c.patch })
    case 'finish.set':
      return onTimeline(
        d,
        finishOps.updateFinish(tl, () => c.finish),
      )
    case 'finish.look':
      return onTimeline(d, finishOps.setLook(tl, c.look, finishCtx))
    case 'finish.captionStyle':
      return onTimeline(d, finishOps.setCaptionStyle(tl, c.style, finishCtx))
    case 'finish.format':
      return onTimeline(d, finishOps.setFormat(tl, c.aspect, finishCtx))
    case 'doc.restore':
      return { timeline: c.timeline, transcript: c.transcript }
  }
}

/** Commands in order: the pure core of every edit (plan 13.1). */
export function applyCommands(d: Doc, commands: readonly Command[], ctx: CommandContext): Doc {
  return commands.reduce((doc, c) => applyCommand(doc, c, ctx), d)
}

/** The track an asset lands on by default: audio on music, anything else on the main video track. */
export function defaultTrackFor(asset: Pick<MediaAsset, 'kind'>): string {
  return asset.kind === 'audio' ? MAIN_AUDIO : MAIN_VIDEO
}
