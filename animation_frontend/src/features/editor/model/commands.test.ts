import { beforeEach, describe, expect, it } from 'vitest'
import type { MediaAsset, Project } from '@/lib/local/models'
import type { CoreEngine } from '@/wasm/engine'
import { useEditor } from '../store'
import { applyCommands, type Command, type Doc } from './commands'
import { startFinish } from './finish'
import { mediaClipFor } from './ops'
import {
  captionsItem,
  emptyTimelineV2,
  MAIN_AUDIO,
  MAIN_VIDEO,
  VOICE_AUDIO,
  type TimelineV2,
} from './timelineV2'

const main = { id: 'a1', kind: 'video', name: 'r.mp4', duration: 8, width: 854, height: 480 } as MediaAsset
const broll = { id: 'a2', kind: 'video', name: 'b.mp4', duration: 4, width: 854, height: 480 } as MediaAsset
const music = { id: 'a3', kind: 'audio', name: 'm.mp3', duration: 20, hasAudio: true } as MediaAsset
const assets = new Map([main, broll, music].map((a) => [a.id, a]))

function start(): TimelineV2 {
  const tl = emptyTimelineV2('16:9')
  tl.clips = [mediaClipFor(tl, main, 0, MAIN_VIDEO, 'c1')]
  return startFinish(tl, { title: 'T', watermark: true })
}

const words = {
  version: 1 as const,
  source: { assetId: 'timeline-mix', model: 'test' },
  language: 'en',
  words: [
    { text: 'Hello', start: 0.2, end: 0.5, confidence: 1 },
    { text: 'there', start: 0.6, end: 0.9, confidence: 1 },
  ],
  edited: false,
}

describe('commands (plan 13.1)', () => {
  beforeEach(() => {
    useEditor.getState().load({ id: 'v' } as Project, start(), [main, broll, music], {} as CoreEngine)
  })

  it('are pure: the input document is untouched and the same list gives the same result', () => {
    const doc: Doc = { timeline: start(), transcript: null }
    const frozen = JSON.stringify(doc)
    const cmds: Command[] = [
      { type: 'clip.add', id: 'c2', assetId: 'a2', trackId: MAIN_VIDEO, start: 'end' },
      { type: 'clip.split', id: 'c1', at: 3, newId: 'c3' },
      { type: 'transcript.set', transcript: words },
    ]
    const a = applyCommands(doc, cmds, { assets })
    const b = applyCommands(doc, cmds, { assets })
    expect(JSON.stringify(doc)).toBe(frozen)
    expect(a).toEqual(b)
    expect(a.timeline.clips.map((c) => c.id).sort()).toEqual(['c1', 'c2', 'c3'])
    expect(captionsItem(a.timeline)).toBeTruthy()
  })

  it('unknown assets and ids change nothing', () => {
    const doc: Doc = { timeline: start(), transcript: null }
    const out = applyCommands(
      doc,
      [
        { type: 'clip.add', id: 'x', assetId: 'missing', trackId: MAIN_VIDEO, start: 0 },
        { type: 'clip.update', id: 'missing', patch: { speed: 2 } },
        { type: 'clip.remove', id: 'missing' },
      ],
      { assets },
    )
    expect(out.timeline).toEqual(doc.timeline)
  })

  it('every store edit records commands that replay, from JSON, to the same document', () => {
    const s = useEditor.getState()
    const before: Doc = { timeline: s.timeline!, transcript: s.transcript }
    s.addAssetAt(broll, 'video', 2)
    s.addAssetAt(music, 'audio', 0)
    s.split(5)
    s.select(null)
    s.updateClip('c1', { volume: 0.5 })
    s.setTranscript(words)
    s.setLook('bold')
    s.setFormat('9:16')
    s.updateFinish((f) => ({ ...f, watermark: false }), 'Watermark')
    s.addText('title')
    s.updateTrack(VOICE_AUDIO, { muted: true })
    s.chooseTake('job-2', broll)
    s.trim(useEditor.getState().timeline!.clips.find((c) => c.trackId === MAIN_AUDIO)!.id, 'end', 6)

    const after = useEditor.getState()
    const log = JSON.parse(JSON.stringify(after.past.flatMap((h) => h.commands))) as Command[]
    expect(log.length).toBeGreaterThanOrEqual(13)
    const replayed = applyCommands(before, log, { assets: after.assets, brand: after.brand })
    expect(replayed.timeline).toEqual(after.timeline)
    expect(replayed.transcript).toEqual(after.transcript)
  })

  it('a coalesced drag is one undo step that still records every command', () => {
    const s = useEditor.getState()
    const depth = s.past.length
    for (const v of [0.9, 0.8, 0.7]) s.updateClip('c1', { volume: v }, 'drag')
    const { past } = useEditor.getState()
    expect(past.length).toBe(depth + 1)
    expect(past[past.length - 1].commands).toHaveLength(3)
    useEditor.getState().undo()
    expect(useEditor.getState().timeline).toEqual(start())
  })
})
