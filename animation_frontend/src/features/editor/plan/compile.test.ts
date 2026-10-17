// Plan 13.4 fixtures: each plan compiles to commands that apply cleanly, or to
// warnings; one Undo reverts a whole plan.
import { beforeEach, describe, expect, it } from 'vitest'
import type { MediaAsset, Project, VideoAsset } from '@/lib/local/models'
import type { CoreEngine } from '@/wasm/engine'
import { useEditor } from '../store'
import { applyCommands } from '../model/commands'
import { startFinish } from '../model/finish'
import { mediaClipFor } from '../model/ops'
import {
  BROLL_VIDEO,
  captionsItem,
  emptyTimelineV2,
  MAIN_AUDIO,
  MAIN_VIDEO,
  withDefaultTracks,
  type TimelineV2,
} from '../model/timelineV2'
import type { Transcript } from '../model/transcript'
import { compileEditPlan, type IdSource, type PlanVideo } from './compile'
import { parseEditPlan, type EditPlanV0 } from './schema'

const main = {
  id: 'm',
  kind: 'video',
  name: 'main.mp4',
  duration: 10,
  width: 1920,
  height: 1080,
} as MediaAsset
const clip1 = {
  id: 'b1',
  kind: 'video',
  name: 'chart.mp4',
  duration: 4,
  width: 854,
  height: 480,
} as MediaAsset
const clip2 = {
  id: 'b2',
  kind: 'image',
  name: 'logo.png',
  duration: 0,
  width: 512,
  height: 512,
} as MediaAsset
const song = { id: 's', kind: 'audio', name: 'song.mp3', duration: 30, hasAudio: true } as MediaAsset
const oldSong = { id: 's0', kind: 'audio', name: 'old.mp3', duration: 30, hasAudio: true } as MediaAsset
const media = new Map([main, clip1, clip2, song, oldSong].map((a) => [a.id, a]))

const refs: VideoAsset[] = [
  { assetId: 'm', role: 'main', label: 'Main', note: '' },
  { assetId: 'b1', role: 'broll', label: 'Clip 1', note: 'rainfall chart' },
  { assetId: 'b2', role: 'broll', label: 'Clip 2', note: '' },
  { assetId: 's', role: 'music', label: 'Music', note: '' },
]

// Ten words, half a second each, from 0.5 s: "w0".."w9".
const transcript: Transcript = {
  version: 1,
  source: { assetId: 'timeline-mix', model: 'fixture' },
  language: 'en',
  words: Array.from({ length: 10 }, (_, i) => ({
    text: `w${i}`,
    start: 0.5 + i * 0.5,
    end: 0.9 + i * 0.5,
    confidence: 1,
  })),
  edited: false,
}

function timeline(withFinish = true): TimelineV2 {
  const tl = withDefaultTracks(emptyTimelineV2())
  tl.clips = [
    mediaClipFor(tl, main, 0, MAIN_VIDEO, 'c-main'),
    mediaClipFor(tl, oldSong, 0, MAIN_AUDIO, 'c-old'),
  ]
  return withFinish ? startFinish(tl, { title: 'Hook', watermark: true }) : tl
}

function ids(): IdSource {
  let c = 0
  let g = 0
  return { clip: () => `new${++c}`, graphic: () => `gfx${++g}` }
}

function video(withFinish = true): PlanVideo {
  return { timeline: timeline(withFinish), transcript, assets: refs, media }
}

function plan(p: Partial<EditPlanV0>): EditPlanV0 {
  return { version: 0, summary: 'Test', ...p }
}

function run(p: EditPlanV0, v = video()) {
  const out = compileEditPlan(p, v, ids())
  const doc = applyCommands({ timeline: v.timeline, transcript: v.transcript }, out.commands, {
    assets: media,
  })
  return { ...out, tl: doc.timeline }
}

const at = (tl: TimelineV2, id: string) => tl.clips.find((c) => c.id === id)

describe('compileEditPlan (plan 13.4 fixtures)', () => {
  it('1. a cutaway at a word lands on the B-roll track, silent, at that word', () => {
    const r = run(
      plan({ inserts: [{ asset: 'Clip 1', at: { word: 3, edge: 'start' }, duration: 2, mode: 'cutaway' }] }),
    )
    expect(r.warnings).toEqual([])
    expect(at(r.tl, 'new1')).toMatchObject({ trackId: BROLL_VIDEO, startTime: 60, duration: 60, volume: 0 })
    expect(r.label).toBe('AI edit: Test')
  })

  it('2. a cutaway at a time with a fade, labels matched without case', () => {
    const r = run(
      plan({
        inserts: [
          { asset: 'clip 1', at: { t: 5 }, duration: 1, inPoint: 1, mode: 'cutaway', transition: 'fade' },
        ],
      }),
    )
    expect(at(r.tl, 'new1')).toMatchObject({
      startTime: 150,
      inPoint: 30,
      duration: 30,
      fadeIn: 9,
      fadeOut: 9,
    })
  })

  it('3. an overlay sits small in a corner', () => {
    const r = run(plan({ inserts: [{ asset: 'Clip 2', at: { t: 1 }, duration: 2, mode: 'overlay' }] }))
    expect(at(r.tl, 'new1')?.transform.scale).toBe(0.4)
  })

  it('4. music replaces the old bed, with its volume and ducking', () => {
    const r = run(plan({ music: { asset: 'Music', volume: 0.6, duck: true } }))
    expect(at(r.tl, 'c-old')).toBeUndefined()
    // Never longer than the video.
    expect(at(r.tl, 'new1')).toMatchObject({
      trackId: MAIN_AUDIO,
      volume: 0.6,
      duration: 300,
      audio: { duck: true },
    })
    expect(run(plan({ music: null })).tl.clips.some((c) => c.trackId === MAIN_AUDIO)).toBe(false)
  })

  it('5. keep ranges cut the main clip, and later anchors follow the cut', () => {
    const r = run(
      plan({
        keep: [
          { from: { t: 0 }, to: { word: 1, edge: 'end' } },
          { from: { word: 6, edge: 'start' }, to: { t: 8 } },
        ],
        inserts: [{ asset: 'Clip 1', at: { word: 7, edge: 'start' }, duration: 1, mode: 'cutaway' }],
      }),
    )
    expect(r.warnings).toEqual([])
    const mains = r.tl.clips.filter((c) => c.trackId === MAIN_VIDEO)
    expect(mains.map((c) => [c.startTime, c.inPoint, c.duration])).toEqual([
      [0, 0, 42],
      [42, 105, 135],
    ])
    // Word 7 starts at 4.0 s in the source: 1.4 s kept before, plus 0.5 s into the second range.
    expect(at(r.tl, 'new3')?.startTime).toBe(57)
  })

  it('6. an unknown label is a warning, not a crash; known labels are listed', () => {
    const r = run(plan({ inserts: [{ asset: 'Clip 9', at: { t: 1 }, duration: 1, mode: 'cutaway' }] }))
    expect(r.commands).toEqual([])
    expect(r.warnings[0]).toMatch(/No asset is called "Clip 9".*Main, Clip 1, Clip 2, Music/)
  })

  it('7. out-of-range times are clamped or skipped, with warnings', () => {
    const r = run(
      plan({
        keep: [{ from: { t: 8 }, to: { t: 40 } }],
        inserts: [{ asset: 'Clip 1', at: { t: 1 }, duration: 3, mode: 'cutaway' }],
      }),
    )
    expect(r.warnings).toContain('Keep 1 was clamped to the clip: 8–10 s.')
    // Second 1 of the source was cut away.
    expect(r.warnings).toContain('Insert 1 falls in a part that was cut, skipped.')
    const long = run(plan({ inserts: [{ asset: 'Clip 1', at: { t: 9 }, duration: 3, mode: 'cutaway' }] }))
    expect(long.warnings).toContain('Insert 1 was shortened to 1 s to fit.')
  })

  it('8. an empty plan changes nothing and says so', () => {
    const r = run(plan({}))
    expect(r.commands).toEqual([])
    expect(r.warnings).toEqual(['The plan changes nothing.'])
  })

  it('9. a word index past the transcript is a warning', () => {
    const r = run(
      plan({ inserts: [{ asset: 'Clip 1', at: { word: 40, edge: 'start' }, duration: 1, mode: 'cutaway' }] }),
    )
    expect(r.commands).toEqual([])
    expect(r.warnings[0]).toBe('Insert 1: word 40 does not exist (the transcript has 10 words).')
  })

  it('10. a title from 0 s is the Finish title; a later one is a title graphic', () => {
    const first = run(plan({ title: { text: 'Why it rains', start: 0, end: 2.5 } }))
    expect(first.tl.finish?.title).toMatchObject({ enabled: true, text: 'Why it rains', duration: 2.5 })
    const later = run(plan({ title: { text: 'Part two', start: 4, end: 6 } }))
    expect(later.tl.extraGraphics.find((g) => g.id === 'gfx1')).toMatchObject({
      kind: 'title',
      text: 'Part two',
    })
  })

  it('11. format, look and caption style; captions off keeps the look', () => {
    const r = run(plan({ format: '9:16', look: 'bold', captions: { style: 'minimal' } }))
    expect([r.tl.width, r.tl.height]).toEqual([1080, 1920])
    expect(r.tl.finish).toMatchObject({ look: 'bold', captions: { style: 'minimal', enabled: true } })
    const off = run(plan({ look: 'bold', captions: null }), {
      ...video(),
      timeline: withCaptions(timeline()),
    })
    expect(off.tl.finish).toMatchObject({ look: 'bold', captions: { enabled: false } })
  })

  it('12. what is not built yet is a warning: zoom transitions, emphasis, looks before Finish', () => {
    const r = run(
      plan({
        inserts: [{ asset: 'Clip 1', at: { t: 1 }, duration: 1, mode: 'cutaway', transition: 'zoom' }],
        emphasis: [{ word: 2, kind: 'pop' }],
      }),
    )
    expect(r.warnings).toEqual([
      'Insert 1: the zoom transition is not available yet; it cuts.',
      'Word emphasis is not available yet; it was left out.',
    ])
    expect(run(plan({ look: 'minimal' }), video(false)).warnings).toEqual([
      'Looks apply in Finish; this video has not been opened there yet.',
    ])
  })

  it('13. the schema refuses what is not a plan, with readable reasons', () => {
    const bad = parseEditPlan({ version: 1, summary: '', inserts: [{ asset: 'Clip 1', at: { t: -1 } }] })
    expect('errors' in bad && bad.errors.length).toBeGreaterThan(2)
    const good = parseEditPlan(JSON.parse(JSON.stringify(plan({ look: 'bold' }))))
    expect('plan' in good).toBe(true)
  })
})

function withCaptions(tl: TimelineV2): TimelineV2 {
  return applyCommands({ timeline: tl, transcript: null }, [{ type: 'transcript.set', transcript }], {
    assets: media,
  }).timeline
}

describe('a plan in the editor', () => {
  beforeEach(() => {
    useEditor
      .getState()
      .load({ id: 'v', assets: refs } as Project, timeline(), [...media.values()], {} as CoreEngine)
    useEditor.getState().setTranscript(transcript)
  })

  it('is one step: one Undo reverts the whole plan', () => {
    const s = useEditor.getState()
    const before = s.timeline
    const out = compileEditPlan(
      plan({
        summary: 'Rain cutaway and music',
        keep: [{ from: { t: 0 }, to: { t: 6 } }],
        inserts: [{ asset: 'Clip 1', at: { word: 2, edge: 'start' }, duration: 2, mode: 'cutaway' }],
        music: { asset: 'Music', volume: 0.5, duck: true },
        look: 'bold',
      }),
      { timeline: s.timeline!, transcript: s.transcript, assets: s.project!.assets!, media: s.assets },
    )
    s.run(out.label, out.commands)
    const after = useEditor.getState()
    expect(after.timeline).not.toEqual(before)
    expect(after.past.at(-1)?.label).toBe('AI edit: Rain cutaway and music')
    expect(captionsItem(after.timeline!)).toBeTruthy()
    after.undo()
    expect(useEditor.getState().timeline).toEqual(before)
  })
})
