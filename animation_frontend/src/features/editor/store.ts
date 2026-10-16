// Editor state. Every change to the document goes through `apply`, which
// keeps an undo/redo stack (slider drags coalesce into one entry). Cut, trim
// and ripple operations run in the Rust/WASM engine (src/wasm/engine.ts).
import { create } from 'zustand'
import type { MediaAsset, Project } from '@/lib/local/models'
import type { CoreEngine, Cue } from '@/wasm/engine'
import { appendAsset, mediaClipFor } from './projects'
import {
  clipId,
  findClip,
  timelineDuration,
  type CaptionClip,
  type Clip,
  type TextClip,
  type Timeline,
  type TrackKind,
} from './model/timeline'

const HISTORY_LIMIT = 150
const COALESCE_MS = 600

interface HistoryEntry {
  label: string
  timeline: Timeline
}

export interface EditorState {
  project: Project | null
  timeline: Timeline | null
  assets: Map<string, MediaAsset>
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

  load(project: Project, assets: MediaAsset[], engine: CoreEngine): void
  reset(): void
  setAssets(assets: MediaAsset[]): void
  apply(label: string, fn: (t: Timeline) => Timeline, coalesceKey?: string): void
  undo(): void
  redo(): void
  select(id: string | null): void
  setPlayhead(t: number): void
  setPlaying(p: boolean): void
  setZoom(z: number): void
  toggleSnapping(): void

  addAsset(asset: MediaAsset): void
  addAssetAt(asset: MediaAsset, trackKind: TrackKind, start: number): string
  split(at?: number): void
  trim(id: string, edge: 'start' | 'end', to: number, coalesceKey?: string): void
  remove(id: string): void
  rippleDelete(id: string): void
  duplicate(id: string): void
  move(id: string, start: number, trackId?: string, coalesceKey?: string): void
  updateClip<T extends Clip>(id: string, patch: Partial<T>, coalesceKey?: string): void
  setSpeed(id: string, speed: number): void
  addText(preset: 'title' | 'lower-third' | 'subtitle', brand?: { font?: string; color?: string }): void
  setCaptions(cues: Cue[]): void
  updateTimeline(patch: Partial<Timeline>, label: string, coalesceKey?: string): void
  snapTargets(excludeId?: string): number[]
}

function cloneTimeline(t: Timeline): Timeline {
  return structuredClone(t)
}

export const useEditor = create<EditorState>((set, get) => ({
  project: null,
  timeline: null,
  assets: new Map(),
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

  load: (project, assets, engine) =>
    set({
      project,
      timeline: project.timeline,
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

  reset: () => set({ project: null, timeline: null, selection: null, past: [], future: [], playing: false }),

  setAssets: (assets) => set({ assets: new Map(assets.map((a) => [a.id, a])) }),

  apply: (label, fn, coalesceKey) => {
    const { timeline, past, coalesceKey: lastKey, lastAt } = get()
    if (!timeline) return
    const next = fn(cloneTimeline(timeline))
    const now = Date.now()
    const merge = coalesceKey !== undefined && coalesceKey === lastKey && now - lastAt < COALESCE_MS
    set({
      timeline: next,
      past: merge ? past : [...past, { label, timeline }].slice(-HISTORY_LIMIT),
      future: [],
      lastLabel: label,
      lastAt: now,
      coalesceKey: coalesceKey ?? null,
      revision: get().revision + 1,
    })
  },

  undo: () => {
    const { past, future, timeline } = get()
    const prev = past[past.length - 1]
    if (!prev || !timeline) return
    set({
      timeline: prev.timeline,
      past: past.slice(0, -1),
      future: [{ label: prev.label, timeline }, ...future],
      lastLabel: `Undo ${prev.label}`,
      coalesceKey: null,
      revision: get().revision + 1,
    })
  },

  redo: () => {
    const { past, future, timeline } = get()
    const next = future[0]
    if (!next || !timeline) return
    set({
      timeline: next.timeline,
      past: [...past, { label: next.label, timeline }],
      future: future.slice(1),
      lastLabel: `Redo ${next.label}`,
      coalesceKey: null,
      revision: get().revision + 1,
    })
  },

  select: (selection) => set({ selection }),
  setPlayhead: (t) => {
    const tl = get().timeline
    const max = tl ? Math.max(timelineDuration(tl), 0) : 0
    set({ playhead: Math.max(0, Math.min(t, max)) })
  },
  setPlaying: (playing) => set({ playing }),
  setZoom: (zoom) => set({ zoom: Math.max(10, Math.min(600, zoom)) }),
  toggleSnapping: () => set({ snapping: !get().snapping }),

  addAsset: (asset) => {
    set({ assets: new Map(get().assets).set(asset.id, asset) })
    get().apply(`Add ${asset.name}`, (t) => appendAsset(t, asset))
  },

  addAssetAt: (asset, trackKind, start) => {
    set({ assets: new Map(get().assets).set(asset.id, asset) })
    const id = clipId()
    get().apply(`Add ${asset.name}`, (t) => {
      const kind = asset.kind === 'audio' && trackKind !== 'voice' ? 'audio' : trackKind
      const track =
        t.tracks.find((tr) => tr.kind === kind) ??
        t.tracks.find((tr) => tr.kind === (asset.kind === 'audio' ? 'audio' : 'video'))
      if (!track) return t
      track.clips.push({ ...mediaClipFor(asset, Math.max(0, start)), id })
      return t
    })
    return id
  },

  split: (at) => {
    const { engine, selection, playhead, timeline } = get()
    if (!engine || !timeline) return
    const t = at ?? playhead
    // The selected clip, or every clip under the playhead.
    const targets = selection
      ? [selection]
      : timeline.tracks.flatMap((tr) =>
          tr.clips.filter((c) => t > c.start && t < c.start + c.duration).map((c) => c.id),
        )
    if (!targets.length) return
    get().apply('Split', (tl) => targets.reduce((acc, id) => engine.splitClip(acc, id, t, clipId()), tl))
  },

  trim: (id, edge, to, coalesceKey) => {
    const { engine } = get()
    if (!engine) return
    get().apply(
      edge === 'start' ? 'Trim start' : 'Trim end',
      (t) => engine.trimClip(t, id, edge, to),
      coalesceKey,
    )
  },

  remove: (id) => {
    get().apply('Delete', (t) => ({
      ...t,
      tracks: t.tracks.map((tr) => ({ ...tr, clips: tr.clips.filter((c) => c.id !== id) })),
    }))
    set({ selection: null })
  },

  rippleDelete: (id) => {
    const { engine } = get()
    if (!engine) return
    get().apply('Ripple delete', (t) => engine.rippleDelete(t, id))
    set({ selection: null })
  },

  duplicate: (id) => {
    const newId = clipId()
    get().apply('Duplicate', (t) => {
      const hit = findClip(t, id)
      if (!hit) return t
      const end = hit.track.clips.reduce((m, c) => Math.max(m, c.start + c.duration), 0)
      hit.track.clips.push({ ...structuredClone(hit.clip), id: newId, start: end })
      return t
    })
    set({ selection: newId })
  },

  move: (id, start, trackId, coalesceKey) => {
    get().apply(
      'Move',
      (t) => {
        const hit = findClip(t, id)
        if (!hit) return t
        hit.clip.start = Math.max(0, Math.round(start * 1000) / 1000)
        if (trackId && trackId !== hit.track.id) {
          const target = t.tracks.find((tr) => tr.id === trackId)
          const compatible =
            target &&
            (hit.clip.type === 'media'
              ? ['video', 'audio', 'voice'].includes(target.kind)
              : hit.clip.type === 'text'
                ? target.kind === 'text'
                : target.kind === 'caption')
          if (target && compatible) {
            hit.track.clips = hit.track.clips.filter((c) => c.id !== id)
            target.clips.push(hit.clip)
          }
        }
        return t
      },
      coalesceKey,
    )
  },

  updateClip: (id, patch, coalesceKey) => {
    get().apply(
      'Edit clip',
      (t) => {
        const hit = findClip(t, id)
        if (hit) Object.assign(hit.clip, patch)
        return t
      },
      coalesceKey,
    )
  },

  setSpeed: (id, speed) => {
    get().apply(
      'Change speed',
      (t) => {
        const hit = findClip(t, id)
        if (!hit || hit.clip.type !== 'media') return t
        const c = hit.clip
        const s = Math.max(0.25, Math.min(4, speed))
        // The same source span plays faster or slower, so the clip length changes.
        c.duration = Math.round(((c.duration * c.speed) / s) * 1000) / 1000
        c.speed = s
        return t
      },
      `speed-${id}`,
    )
  },

  addText: (preset, brand) => {
    const { playhead } = get()
    const id = clipId()
    const base: TextClip = {
      id,
      type: 'text',
      start: playhead,
      duration: 3,
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
      animation: preset === 'title' ? 'rise' : 'fade',
    }
    get().apply('Add text', (t) => {
      const track = t.tracks.find((tr) => tr.kind === 'text')
      track?.clips.push(base)
      return t
    })
    set({ selection: id })
  },

  setCaptions: (cues) => {
    get().apply('Captions', (t) => {
      const track = t.tracks.find((tr) => tr.kind === 'caption')
      if (track)
        track.clips = cues.map((c): CaptionClip => ({
          id: clipId(),
          type: 'caption',
          start: c.start,
          duration: Math.max(0.2, c.end - c.start),
          text: c.text,
        }))
      return t
    })
  },

  updateTimeline: (patch, label, coalesceKey) => get().apply(label, (t) => ({ ...t, ...patch }), coalesceKey),

  snapTargets: (excludeId) => {
    const { timeline, playhead } = get()
    if (!timeline) return []
    const out = [0, playhead]
    for (const tr of timeline.tracks)
      for (const c of tr.clips) if (c.id !== excludeId) out.push(c.start, c.start + c.duration)
    return out
  },
}))

export function selectedClip(s: EditorState): { clip: Clip; trackKind: TrackKind } | null {
  if (!s.timeline || !s.selection) return null
  const hit = findClip(s.timeline, s.selection)
  return hit ? { clip: hit.clip, trackKind: hit.track.kind } : null
}
