// Editor state on Timeline v2. Every change to the document goes through
// `apply`, which keeps an undo/redo stack (slider drags coalesce into one
// entry). Clip data operations come from @tooscut/render-engine (model/ops.ts);
// snapping and timecode stay in Rust (src/wasm/engine.ts).
import * as finishOps from './model/finish'
import type { BrandRender } from './graphics/looks'
import { create } from 'zustand'
import type { MediaAsset, Project } from '@/lib/local/models'
import type { CoreEngine, Cue } from '@/wasm/engine'
import { recordCall } from '@/wasm/stats'
import {
  addGraphic,
  appendAsset,
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
  trimTitle,
  trimTo,
  updateGraphic,
  updateMedia,
} from './model/ops'
import {
  captionsItem,
  clipEnd,
  clipId,
  clipStart,
  defaultCaptions,
  graphicId,
  MAIN_AUDIO,
  MAIN_VIDEO,
  outputDuration,
  VOICE_AUDIO,
  type AspectKey,
  type CaptionStyleId,
  type CaptionsItem,
  type FinishSettings,
  type LookId,
  type GraphicItemV2,
  type MediaClipV2,
  type TimelineV2,
  type TitleItem,
  type TrackV2,
} from './model/timelineV2'
import { transcriptFromCues, type Transcript } from './model/transcript'

const HISTORY_LIMIT = 150
const COALESCE_MS = 600

interface Doc {
  timeline: TimelineV2
  transcript: Transcript | null
}

interface HistoryEntry extends Doc {
  label: string
}

/** Where an asset lands: the main video lane, the music lane or the voice lane. */
export type Lane = 'video' | 'audio' | 'voice'

const LANE_TRACK: Record<Lane, string> = { video: MAIN_VIDEO, audio: MAIN_AUDIO, voice: VOICE_AUDIO }

export interface EditorState {
  project: Project | null
  timeline: TimelineV2 | null
  transcript: Transcript | null
  assets: Map<string, MediaAsset>
  /** The brand kit Finish refers to, ready for the renderer (not part of undo). */
  brand: BrandRender | null
  engine: CoreEngine | null
  selection: string | null
  playhead: number
  playing: boolean
  /** Pixels per second on the timeline. */
  zoom: number
  snapping: boolean
  past: HistoryEntry[]
  future: HistoryEntry[]
  lastLabel: string | null
  lastAt: number
  coalesceKey: string | null
  revision: number

  load(project: Project, timeline: TimelineV2, assets: MediaAsset[], engine: CoreEngine): void
  reset(): void
  setAssets(assets: MediaAsset[]): void
  setBrand(brand: BrandRender | null): void
  apply(label: string, fn: (d: Doc) => Doc, coalesceKey?: string): void
  undo(): void
  redo(): void
  select(id: string | null): void
  setPlayhead(t: number): void
  setPlaying(p: boolean): void
  setZoom(z: number): void
  toggleSnapping(): void

  addAsset(asset: MediaAsset): void
  addAssetAt(asset: MediaAsset, lane: Lane, start: number): string
  split(at?: number): void
  trim(id: string, edge: 'start' | 'end', to: number, coalesceKey?: string): void
  remove(id: string): void
  rippleDelete(id: string): void
  duplicate(id: string): void
  move(id: string, start: number, trackId?: string, coalesceKey?: string): void
  updateClip(id: string, patch: Partial<MediaClipV2>, coalesceKey?: string): void
  updateGraphic(id: string, patch: Partial<TitleItem> | Partial<CaptionsItem>, coalesceKey?: string): void
  updateTrack(id: string, patch: Partial<TrackV2>): void
  setSpeed(id: string, speed: number): void
  addText(preset: 'title' | 'lower-third' | 'subtitle', brand?: { font?: string; color?: string }): void
  setCaptions(cues: Cue[], source: { assetId: string; model: string }): void
  setTranscript(transcript: Transcript | null): void
  updateTimeline(patch: Partial<TimelineV2>, label: string, coalesceKey?: string): void
  /** Finish (plan 6.6): each call is one undo step. */
  updateFinish(patch: (f: FinishSettings) => FinishSettings, label: string, coalesceKey?: string): void
  setLook(look: LookId): void
  setCaptionStyle(style: CaptionStyleId): void
  setFormat(aspect: AspectKey): void
  /** Makes a take's render the main clip (takes strip, plan 6.6). */
  chooseTake(jobId: string, asset: MediaAsset): void
  snapTargets(excludeId?: string): number[]
}

function timed<T>(name: string, run: () => T): T {
  const t0 = performance.now()
  const out = run()
  recordCall({ category: 'timeline', name, backend: 'TS · render-engine', ms: performance.now() - t0 })
  return out
}

/** The timeline with a captions item, styled by Finish when the video has Finish settings. */
function withCaptions(tl: TimelineV2, s: Pick<EditorState, 'assets' | 'brand'>): TimelineV2 {
  if (captionsItem(tl)) return tl
  const added = addGraphic(tl, defaultCaptions())
  return added.finish
    ? finishOps.setCaptionStyle(added, added.finish.captions.style, { assets: s.assets, brand: s.brand })
    : added
}

export const useEditor = create<EditorState>((set, get) => ({
  project: null,
  timeline: null,
  transcript: null,
  assets: new Map(),
  brand: null,
  engine: null,
  selection: null,
  playhead: 0,
  playing: false,
  zoom: 80,
  snapping: true,
  past: [],
  future: [],
  lastLabel: null,
  lastAt: 0,
  coalesceKey: null,
  revision: 0,

  load: (project, timeline, assets, engine) =>
    set({
      project,
      timeline,
      transcript: project.transcript ?? null,
      assets: new Map(assets.map((a) => [a.id, a])),
      engine,
      selection: null,
      playhead: 0,
      playing: false,
      past: [],
      future: [],
      lastLabel: null,
      coalesceKey: null,
      revision: 0,
    }),

  reset: () =>
    set({
      project: null,
      timeline: null,
      transcript: null,
      brand: null,
      selection: null,
      past: [],
      future: [],
      playing: false,
    }),

  setAssets: (assets) => set({ assets: new Map(assets.map((a) => [a.id, a])) }),
  setBrand: (brand) => set({ brand }),

  apply: (label, fn, coalesceKey) => {
    const { timeline, transcript, past, coalesceKey: lastKey, lastAt } = get()
    if (!timeline) return
    const next = fn({ timeline, transcript })
    const now = Date.now()
    const merge = coalesceKey !== undefined && coalesceKey === lastKey && now - lastAt < COALESCE_MS
    set({
      timeline: next.timeline,
      transcript: next.transcript,
      past: merge ? past : [...past, { label, timeline, transcript }].slice(-HISTORY_LIMIT),
      future: [],
      lastLabel: label,
      lastAt: now,
      coalesceKey: coalesceKey ?? null,
      revision: get().revision + 1,
    })
  },

  undo: () => {
    const { past, future, timeline, transcript } = get()
    const prev = past[past.length - 1]
    if (!prev || !timeline) return
    set({
      timeline: prev.timeline,
      transcript: prev.transcript,
      past: past.slice(0, -1),
      future: [{ label: prev.label, timeline, transcript }, ...future],
      lastLabel: `Undo ${prev.label}`,
      coalesceKey: null,
      revision: get().revision + 1,
    })
  },

  redo: () => {
    const { past, future, timeline, transcript } = get()
    const next = future[0]
    if (!next || !timeline) return
    set({
      timeline: next.timeline,
      transcript: next.transcript,
      past: [...past, { label: next.label, timeline, transcript }],
      future: future.slice(1),
      lastLabel: `Redo ${next.label}`,
      coalesceKey: null,
      revision: get().revision + 1,
    })
  },

  select: (selection) => set({ selection }),
  setPlayhead: (t) => {
    const tl = get().timeline
    const max = tl ? Math.max(outputDuration(tl), 0) : 0
    set({ playhead: Math.max(0, Math.min(t, max)) })
  },
  setPlaying: (playing) => set({ playing }),
  setZoom: (zoom) => set({ zoom: Math.max(10, Math.min(600, zoom)) }),
  toggleSnapping: () => set({ snapping: !get().snapping }),

  addAsset: (asset) => {
    set({ assets: new Map(get().assets).set(asset.id, asset) })
    get().apply(`Add ${asset.name}`, (d) => ({ ...d, timeline: appendAsset(d.timeline, asset, clipId()) }))
  },

  addAssetAt: (asset, lane, start) => {
    set({ assets: new Map(get().assets).set(asset.id, asset) })
    const id = clipId()
    const trackId = asset.kind === 'audio' ? LANE_TRACK[lane === 'video' ? 'audio' : lane] : MAIN_VIDEO
    get().apply(`Add ${asset.name}`, (d) => ({
      ...d,
      timeline: insertClip(d.timeline, mediaClipFor(d.timeline, asset, start, trackId, id)),
    }))
    return id
  },

  split: (at) => {
    const { selection, playhead, timeline } = get()
    if (!timeline) return
    const t = at ?? playhead
    // The selected clip or title, or everything under the playhead.
    const under = [
      ...timeline.clips
        .filter((c) => t > clipStart(timeline, c) && t < clipEnd(timeline, c))
        .map((c) => c.id),
      ...timeline.extraGraphics
        .filter((g) => g.kind === 'title' && t > g.start && t < g.end)
        .map((g) => g.id),
    ]
    const targets = selection ? [selection] : under
    if (!targets.length) return
    get().apply('Split', (d) =>
      timed('split', () => ({
        ...d,
        timeline: targets.reduce(
          (tl, id) => (findMedia(tl, id) ? splitAt(tl, id, t, clipId()) : splitTitle(tl, id, t, graphicId())),
          d.timeline,
        ),
      })),
    )
  },

  trim: (id, edge, to, coalesceKey) => {
    get().apply(
      edge === 'start' ? 'Trim start' : 'Trim end',
      (d) =>
        timed('trim', () => ({
          ...d,
          timeline: findMedia(d.timeline, id)
            ? trimTo(d.timeline, id, edge, to)
            : trimTitle(d.timeline, id, edge, to),
        })),
      coalesceKey,
    )
  },

  remove: (id) => {
    get().apply('Delete', (d) => ({
      ...d,
      timeline: findMedia(d.timeline, id) ? removeMedia(d.timeline, id) : removeGraphic(d.timeline, id),
    }))
    set({ selection: null })
  },

  rippleDelete: (id) => {
    if (!get().timeline || !findMedia(get().timeline as TimelineV2, id)) return get().remove(id)
    get().apply('Ripple delete', (d) =>
      timed('ripple-delete', () => ({ ...d, timeline: rippleDelete(d.timeline, id) })),
    )
    set({ selection: null })
  },

  duplicate: (id) => {
    const tl = get().timeline
    if (!tl) return
    const newId = findMedia(tl, id) ? clipId() : graphicId()
    get().apply('Duplicate', (d) => {
      if (findMedia(d.timeline, id)) return { ...d, timeline: duplicateMedia(d.timeline, id, newId) }
      const g = findGraphic(d.timeline, id)
      if (g?.kind !== 'title') return d
      const span = g.end - g.start
      return { ...d, timeline: addGraphic(d.timeline, { ...g, id: newId, start: g.end, end: g.end + span }) }
    })
    set({ selection: newId })
  },

  move: (id, start, trackId, coalesceKey) => {
    get().apply(
      'Move',
      (d) => ({
        ...d,
        timeline: findMedia(d.timeline, id)
          ? moveMedia(d.timeline, id, Math.round(start * 1000) / 1000, trackId)
          : moveTitle(d.timeline, id, start),
      }),
      coalesceKey,
    )
  },

  updateClip: (id, patch, coalesceKey) => {
    get().apply('Edit clip', (d) => ({ ...d, timeline: updateMedia(d.timeline, id, patch) }), coalesceKey)
  },

  updateGraphic: (id, patch, coalesceKey) => {
    get().apply(
      'Edit graphic',
      (d) => ({ ...d, timeline: updateGraphic(d.timeline, id, patch as Partial<GraphicItemV2>) }),
      coalesceKey,
    )
  },

  updateTrack: (id, patch) => {
    get().apply('Edit track', (d) => ({
      ...d,
      timeline: {
        ...d.timeline,
        tracks: d.timeline.tracks.map((t) => (t.id === id ? { ...t, ...patch, id } : t)),
      },
    }))
  },

  setSpeed: (id, speed) => {
    get().apply('Change speed', (d) => ({ ...d, timeline: setSpeed(d.timeline, id, speed) }), `speed-${id}`)
  },

  addText: (preset, brand) => {
    const { playhead } = get()
    const id = graphicId()
    const item: TitleItem = {
      kind: 'title',
      id,
      start: playhead,
      end: playhead + 3,
      text:
        preset === 'title'
          ? 'Your headline here'
          : preset === 'lower-third'
            ? 'Name Surname · Role'
            : 'Subtitle text',
      font: brand?.font ?? 'Inter',
      size: preset === 'title' ? 110 : preset === 'lower-third' ? 54 : 64,
      weight: preset === 'subtitle' ? 600 : 700,
      color: brand?.color ?? '#ffffff',
      x: 0.5,
      y: preset === 'title' ? 0.42 : preset === 'lower-third' ? 0.8 : 0.7,
      align: preset === 'lower-third' ? 'Left' : 'Center',
      background: preset === 'lower-third' ? '#07070acc' : null,
      enter: preset === 'title' ? 'rise' : 'fade',
      layer: 'over',
    }
    get().apply('Add text', (d) => ({ ...d, timeline: addGraphic(d.timeline, item) }))
    set({ selection: id })
  },

  /** Captions from timed cues (SRT import): a transcript plus the captions item. */
  setCaptions: (cues, source) => {
    get().apply('Captions', (d) => ({
      timeline: withCaptions(d.timeline, get()),
      transcript: cues.length ? transcriptFromCues(cues, source) : null,
    }))
  },

  setTranscript: (transcript) => {
    get().apply('Captions', (d) => ({
      timeline: transcript ? withCaptions(d.timeline, get()) : d.timeline,
      transcript,
    }))
  },

  updateTimeline: (patch, label, coalesceKey) =>
    get().apply(label, (d) => ({ ...d, timeline: { ...d.timeline, ...patch } }), coalesceKey),

  updateFinish: (patch, label, coalesceKey) =>
    get().apply(label, (d) => ({ ...d, timeline: finishOps.updateFinish(d.timeline, patch) }), coalesceKey),

  setLook: (look) => {
    const { assets, brand } = get()
    get().apply('Change look', (d) => ({
      ...d,
      timeline: finishOps.setLook(d.timeline, look, { assets, brand }),
    }))
  },

  setCaptionStyle: (style) => {
    const { assets, brand } = get()
    get().apply('Caption style', (d) => ({
      ...d,
      timeline: finishOps.setCaptionStyle(d.timeline, style, { assets, brand }),
    }))
  },

  chooseTake: (jobId, asset) => {
    const { project } = get()
    set({ assets: new Map(get().assets).set(asset.id, asset) })
    get().apply('Use take', (d) => {
      const kept = d.timeline.clips.filter((c) => c.trackId !== MAIN_VIDEO)
      const main = mediaClipFor(d.timeline, asset, 0, MAIN_VIDEO, clipId())
      return { ...d, timeline: insertClip({ ...d.timeline, clips: kept }, main) }
    })
    if (project) set({ project: { ...project, selectedTake: jobId } })
  },

  setFormat: (aspect) => {
    const { assets, brand } = get()
    get().apply('Change format', (d) => ({
      ...d,
      timeline: finishOps.setFormat(d.timeline, aspect, { assets, brand }),
    }))
  },

  snapTargets: (excludeId) => {
    const { timeline, playhead } = get()
    if (!timeline) return []
    const out = [0, playhead]
    for (const c of timeline.clips)
      if (c.id !== excludeId) out.push(clipStart(timeline, c), clipEnd(timeline, c))
    for (const g of timeline.extraGraphics)
      if (g.kind === 'title' && g.id !== excludeId) out.push(g.start, g.end)
    return out
  },
}))

export type Selected =
  { kind: 'media'; clip: MediaClipV2; track: TrackV2 } | { kind: 'title'; item: TitleItem }

export function selectedItem(s: Pick<EditorState, 'timeline' | 'selection'>): Selected | null {
  if (!s.timeline || !s.selection) return null
  const clip = findMedia(s.timeline, s.selection)
  if (clip) {
    const track = s.timeline.tracks.find((t) => t.id === clip.trackId)
    return track ? { kind: 'media', clip, track } : null
  }
  const g = findGraphic(s.timeline, s.selection)
  return g?.kind === 'title' ? { kind: 'title', item: g } : null
}
