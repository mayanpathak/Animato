import { beforeEach, describe, expect, it } from 'vitest'
import type { MediaAsset, Project } from '@/lib/local/models'
import type { CoreEngine } from '@/wasm/engine'
import { useEditor } from '../store'
import { addAssetRef, nextLabel, syncAssetRefs, updateAssetRef } from './assetRefs'
import { mediaClipFor } from './ops'
import {
  BROLL_VIDEO,
  emptyTimelineV2,
  MAIN_AUDIO,
  MAIN_VIDEO,
  VOICE_AUDIO,
  withDefaultTracks,
} from './timelineV2'

const v = (id: string, duration = 8) =>
  ({ id, kind: 'video', name: `${id}.mp4`, duration, width: 854, height: 480 }) as MediaAsset
const a = (id: string) =>
  ({ id, kind: 'audio', name: `${id}.mp3`, duration: 20, hasAudio: true }) as MediaAsset

describe('asset roles and labels (plan 13.2)', () => {
  it('labels: Clip 1, Clip 2 for B-roll; Music, Music 2 for the rest', () => {
    let refs = addAssetRef([], 'b1', 'broll')
    refs = addAssetRef(refs, 'b2', 'broll')
    refs = addAssetRef(refs, 'm1', 'music')
    refs = addAssetRef(refs, 'm2', 'music')
    expect(refs.map((r) => r.label)).toEqual(['Clip 1', 'Clip 2', 'Music', 'Music 2'])
    expect(nextLabel(refs, 'voice')).toBe('Voice')
    // Known assets keep their ref.
    expect(addAssetRef(refs, 'b1', 'music')).toEqual(refs)
  })

  it('labels stay when clips are added and removed; Main follows the main track', () => {
    const tl = emptyTimelineV2()
    tl.clips = [
      mediaClipFor(tl, v('main1'), 0, MAIN_VIDEO, 'c1'),
      mediaClipFor(tl, a('song'), 0, MAIN_AUDIO, 'c2'),
      mediaClipFor(tl, a('take'), 1, VOICE_AUDIO, 'c3'),
    ]
    const refs = syncAssetRefs(updateAssetRef(addAssetRef([], 'b1', 'broll'), 'b1', { note: 'chart' }), tl)
    expect(refs.map((r) => [r.label, r.role])).toEqual([
      ['Clip 1', 'broll'],
      ['Main', 'main'],
      ['Music', 'music'],
      ['Voice', 'voice'],
    ])
    expect(syncAssetRefs(refs, tl)).toBe(refs)
    // A new take replaces the main clip: "Main" names it; the B-roll slot and its note stay.
    const next = { ...tl, clips: [mediaClipFor(tl, v('main2'), 0, MAIN_VIDEO, 'c9'), tl.clips[1]] }
    const after = syncAssetRefs(refs, next)
    expect(after.map((r) => [r.assetId, r.label])).toEqual([
      ['b1', 'Clip 1'],
      ['song', 'Music'],
      ['main2', 'Main'],
    ])
    expect(after[0].note).toBe('chart')
  })
})

describe('B-roll (plan 6.6)', () => {
  beforeEach(() => {
    const tl = withDefaultTracks(emptyTimelineV2())
    tl.clips = [mediaClipFor(tl, v('main1'), 0, MAIN_VIDEO, 'c1')]
    useEditor.getState().load({ id: 'v' } as Project, tl, [v('main1')], {} as CoreEngine)
  })

  it('a slot gets the next label; Insert at playhead puts it above the main clip, silent, undoable', () => {
    const s = useEditor.getState()
    s.addBrollSlot(v('b1', 3))
    s.addBrollSlot(v('b2', 3))
    s.setPlayhead(2)
    const id = s.insertBroll(v('b2', 3))
    const st = useEditor.getState()
    expect(st.project?.assets?.map((r) => r.label)).toEqual(['Main', 'Clip 1', 'Clip 2'])
    const clip = st.timeline!.clips.find((c) => c.id === id)!
    expect(clip).toMatchObject({ trackId: BROLL_VIDEO, startTime: 60, volume: 0 })
    expect(st.past.at(-1)?.label).toBe('Insert Clip 2')
    st.undo()
    expect(useEditor.getState().timeline!.clips).toHaveLength(1)
    // Slots outlive the undo: they are records, not edits.
    expect(useEditor.getState().project?.assets).toHaveLength(3)
  })
})
