// Editor state on Timeline v2. Every change to the document is a list of
// serialisable commands (model/commands.ts) run through `run`, which keeps an
// undo/redo stack (slider drags coalesce into one entry) and records the
// commands of each step. Clip data operations come from
// @tooscut/render-engine (model/ops.ts); snapping and timecode stay in Rust.
import type { BrandRender } from './graphics/looks'
import { create } from 'zustand'
import type { MediaAsset, Project, VideoAsset } from '@/lib/local/models'
import type { CoreEngine, Cue } from '@/wasm/engine'
import { recordCall } from '@/wasm/stats'
import * as refs from './model/assetRefs'
import { applyCommands, defaultTrackFor, type Command, type Doc } from './model/commands'
import { findGraphic, findMedia } from './model/ops'
import {
  BROLL_VIDEO,
  clipEnd,
  clipId,
  clipStart,
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

export interface HistoryEntry extends Doc {
  label: string
  /** The commands that turned this document into the next one (plan 13.1). */
  commands: Command[]
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
  /** Runs commands as one undo step labelled `label`. */
  run(label: string, commands: Command[], coalesceKey?: string): void
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
  setTranscript(transcript: Transcript | null, coalesceKey?: string): void
  updateTimeline(
    patch: Partial<Pick<TimelineV2, 'audio' | 'background' | 'fps'>>,
    label: string,
    coalesceKey?: string,
  ): void
  /** Finish (plan 6.6): each call is one undo step. */
  updateFinish(patch: (f: FinishSettings) => FinishSettings, label: string, coalesceKey?: string): void
  setLook(look: LookId): void
  setCaptionStyle(style: CaptionStyleId): void
  setFormat(aspect: AspectKey): void
  /** Makes a take's render the main clip (takes strip, plan 6.6). */
  chooseTake(jobId: string, asset: MediaAsset): void
  snapTargets(excludeId?: string): number[]
  /** A B-roll slot for an asset (plan 6.6), without placing it. */
  addBrollSlot(asset: MediaAsset): void
  /** The asset on the B-roll track at the playhead, its own sound off (a cutaway keeps the main audio). */
  insertBroll(asset: MediaAsset, at?: number): string
  updateAssetRef(assetId: string, patch: Partial<Pick<VideoAsset, 'label' | 'note'>>): void
}

function timed<T>(name: string, run: () => T): T {
  const t0 = performance.now()
  const out = run()
  recordCall({ category: 'timeline', name, backend: 'TS · render-engine', ms: performance.now() - t0 })
  return out
}

/** Timings for the operations the performance badge shows. */
const TIMED: Partial<Record<Command['type'], string>> = {
  'clip.split': 'split',
  'clip.trim': 'trim',
  'clip.rippleDelete': 'ripple-delete',
}

/** The project with asset refs for what the timeline uses (same object when nothing changed). */
function withRefs(project: Project, tl: TimelineV2): Project {
  const next = refs.syncAssetRefs(project.assets, tl)
  return next === project.assets ? project : { ...project, assets: next }
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
      project: withRefs(project, timeline),
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

  run: (label, commands, coalesceKey) => {
    const { timeline, transcript, past, coalesceKey: lastKey, lastAt, assets, brand } = get()
    if (!timeline || !commands.length) return
    const name = commands.length === 1 ? TIMED[commands[0].type] : undefined
    const go = () => applyCommands({ timeline, transcript }, commands, { assets, brand })
    const next = name ? timed(name, go) : go()
    const now = Date.now()
    const merge = coalesceKey !== undefined && coalesceKey === lastKey && now - lastAt < COALESCE_MS
    const prev = past[past.length - 1]
    const project = get().project
    set({
      project: project && withRefs(project, next.timeline),
      timeline: next.timeline,
      transcript: next.transcript,
      past:
        merge && prev
          ? [...past.slice(0, -1), { ...prev, commands: [...prev.commands, ...commands] }]
          : [...past, { label, timeline, transcript, commands }].slice(-HISTORY_LIMIT),
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
    const project = get().project
    set({
      project: project && withRefs(project, prev.timeline),
      timeline: prev.timeline,
      transcript: prev.transcript,
      past: past.slice(0, -1),
      future: [{ label: prev.label, timeline, transcript, commands: prev.commands }, ...future],
      lastLabel: `Undo ${prev.label}`,
      coalesceKey: null,
      revision: get().revision + 1,
    })
  },

  redo: () => {
    const { past, future, timeline, transcript } = get()
    const next = future[0]
    if (!next || !timeline) return
    const project = get().project
    set({
      project: project && withRefs(project, next.timeline),
      timeline: next.timeline,
      transcript: next.transcript,
      past: [...past, { label: next.label, timeline, transcript, commands: next.commands }],
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
    get().run(`Add ${asset.name}`, [
      { type: 'clip.add', id: clipId(), assetId: asset.id, trackId: defaultTrackFor(asset), start: 'end' },
    ])
  },

  addAssetAt: (asset, lane, start) => {
    set({ assets: new Map(get().assets).set(asset.id, asset) })
    const id = clipId()
    const trackId = asset.kind === 'audio' ? LANE_TRACK[lane === 'video' ? 'audio' : lane] : MAIN_VIDEO
    get().run(`Add ${asset.name}`, [{ type: 'clip.add', id, assetId: asset.id, trackId, start }])
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
    get().run(
      'Split',
      targets.map((id) => ({
        type: 'clip.split',
        id,
        at: t,
        newId: findMedia(timeline, id) ? clipId() : graphicId(),
      })),
    )
  },

  trim: (id, edge, to, coalesceKey) => {
    get().run(
      edge === 'start' ? 'Trim start' : 'Trim end',
      [{ type: 'clip.trim', id, edge, to }],
      coalesceKey,
    )
  },

  remove: (id) => {
    get().run('Delete', [{ type: 'clip.remove', id }])
    set({ selection: null })
  },

  rippleDelete: (id) => {
    if (!get().timeline || !findMedia(get().timeline as TimelineV2, id)) return get().remove(id)
    get().run('Ripple delete', [{ type: 'clip.rippleDelete', id }])
    set({ selection: null })
  },

  duplicate: (id) => {
    const tl = get().timeline
    if (!tl) return
    const newId = findMedia(tl, id) ? clipId() : graphicId()
    get().run('Duplicate', [{ type: 'clip.duplicate', id, newId }])
    set({ selection: newId })
  },

  move: (id, start, trackId, coalesceKey) => {
    get().run('Move', [{ type: 'clip.move', id, start, trackId }], coalesceKey)
  },

  updateClip: (id, patch, coalesceKey) => {
    get().run('Edit clip', [{ type: 'clip.update', id, patch }], coalesceKey)
  },

  updateGraphic: (id, patch, coalesceKey) => {
    get().run(
      'Edit graphic',
      [{ type: 'graphic.update', id, patch: patch as Partial<GraphicItemV2> }],
      coalesceKey,
    )
  },

  updateTrack: (id, patch) => {
    get().run('Edit track', [{ type: 'track.update', id, patch }])
  },

  setSpeed: (id, speed) => {
    get().run('Change speed', [{ type: 'clip.speed', id, speed }], `speed-${id}`)
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
    get().run('Add text', [{ type: 'graphic.add', item }])
    set({ selection: id })
  },

  /** Captions from timed cues (SRT import): a transcript plus the captions item. */
  setCaptions: (cues, source) => {
    get().run('Captions', [
      { type: 'transcript.set', transcript: cues.length ? transcriptFromCues(cues, source) : null },
    ])
  },

  setTranscript: (transcript, coalesceKey) => {
    get().run('Captions', [{ type: 'transcript.set', transcript }], coalesceKey)
  },

  updateTimeline: (patch, label, coalesceKey) =>
    get().run(label, [{ type: 'timeline.update', patch }], coalesceKey),

  updateFinish: (patch, label, coalesceKey) => {
    const finish = get().timeline?.finish
    if (finish) get().run(label, [{ type: 'finish.set', finish: patch(finish) }], coalesceKey)
  },

  setLook: (look) => get().run('Change look', [{ type: 'finish.look', look }]),

  setCaptionStyle: (style) => get().run('Caption style', [{ type: 'finish.captionStyle', style }]),

  chooseTake: (jobId, asset) => {
    const { project } = get()
    set({ assets: new Map(get().assets).set(asset.id, asset) })
    get().run('Use take', [{ type: 'track.replace', trackId: MAIN_VIDEO, id: clipId(), assetId: asset.id }])
    if (project) set({ project: { ...project, selectedTake: jobId } })
  },

  setFormat: (aspect) => get().run('Change format', [{ type: 'finish.format', aspect }]),

  addBrollSlot: (asset) => {
    const { project } = get()
    set({ assets: new Map(get().assets).set(asset.id, asset) })
    if (project)
      set({ project: { ...project, assets: refs.addAssetRef(project.assets ?? [], asset.id, 'broll') } })
  },

  insertBroll: (asset, at) => {
    get().addBrollSlot(asset)
    const id = clipId()
    const main = get().timeline?.clips.find((c) => c.trackId === MAIN_VIDEO)
    get().run(`Insert ${refs.labelOf(get().project?.assets, asset.id) ?? asset.name}`, [
      { type: 'clip.add', id, assetId: asset.id, trackId: BROLL_VIDEO, start: at ?? get().playhead },
      // Same place and size as the main video, so the cutaway fits the look.
      { type: 'clip.update', id, patch: { volume: 0, ...(main ? { transform: main.transform } : {}) } },
    ])
    set({ selection: id })
    return id
  },

  updateAssetRef: (assetId, patch) => {
    const { project } = get()
    if (project)
      set({ project: { ...project, assets: refs.updateAssetRef(project.assets ?? [], assetId, patch) } })
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
