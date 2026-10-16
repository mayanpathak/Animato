import { describe, expect, it } from 'vitest'
import type { MediaAsset } from '@/lib/local/models'
import { migrateTimeline } from './migrate'
import { appendAsset, moveMedia, rippleDelete, setSpeed, splitAt, splitTitle, trimTo } from './ops'
import { emptyTimeline, type Timeline } from './timelineV1'
import {
  captionsItem,
  emptyTimelineV2,
  MAIN_AUDIO,
  MAIN_VIDEO,
  timelineDurationV2,
  VOICE_AUDIO,
} from './timelineV2'
import { captionAt, cuesFromTranscript, editChunk, removeChunk, transcriptFromCues } from './transcript'

function v1Fixture(): Timeline {
  const t = emptyTimeline('9:16')
  const media = (id: string, start: number, duration: number, offset = 0, speed = 1) => ({
    id,
    type: 'media' as const,
    assetId: `a_${id}`,
    name: `${id}.mp4`,
    start,
    duration,
    offset,
    speed,
    volume: 0.8,
    fadeIn: 0.5,
    fadeOut: 0,
    transform: { x: 0.5, y: 0.4, scale: 1.2, rotation: 0, opacity: 1 },
    color: { brightness: 1, contrast: 1.1, saturation: 1 },
    crop: { top: 0, right: 0, bottom: 0, left: 0 },
    audio: { normalizeGain: 1.5, gate: true, eq: { low: 0, mid: 0, high: 0 }, duck: false },
  })
  t.tracks.find((x) => x.kind === 'video')!.clips.push(media('v1', 0, 4, 1, 2), media('v2', 4, 2))
  t.tracks
    .find((x) => x.kind === 'audio')!
    .clips.push({
      ...media('m1', 0, 6),
      audio: { normalizeGain: 1, gate: false, eq: { low: 0, mid: 0, high: 0 }, duck: true },
    })
  t.tracks.find((x) => x.kind === 'voice')!.clips.push(media('vo', 1, 3))
  t.tracks
    .find((x) => x.kind === 'text')!
    .clips.push({
      id: 'tx',
      type: 'text',
      start: 0.5,
      duration: 2,
      text: 'Hello',
      font: 'Inter',
      size: 100,
      weight: 700,
      color: '#ffffff',
      x: 0.5,
      y: 0.4,
      align: 'Center',
      background: null,
      animation: 'rise',
    })
  t.tracks
    .find((x) => x.kind === 'caption')!
    .clips.push(
      { id: 'c1', type: 'caption', start: 1, duration: 1, text: 'two words' },
      { id: 'c2', type: 'caption', start: 2, duration: 1.5, text: 'and three more' },
    )
  return t
}

describe('Timeline v1 → v2 migration (plan 10.2)', () => {
  it('keeps media timing exactly in frames and maps lanes to track pairs', () => {
    const { timeline } = migrateTimeline(v1Fixture())
    expect(timeline.version).toBe(2)
    expect([timeline.width, timeline.height, timeline.fps]).toEqual([1080, 1920, 30])
    const byId = new Map(timeline.clips.map((c) => [c.id, c]))
    expect(byId.get('v1')).toMatchObject({
      trackId: MAIN_VIDEO,
      startTime: 0,
      duration: 120,
      inPoint: 30,
      speed: 2,
      fadeIn: 15,
    })
    expect(byId.get('v2')).toMatchObject({ startTime: 120, duration: 60 })
    expect(byId.get('m1')).toMatchObject({ trackId: MAIN_AUDIO })
    expect(byId.get('vo')).toMatchObject({ trackId: VOICE_AUDIO, startTime: 30 })
    expect(byId.get('v1')?.transform.scale).toBe(1.2)
    // render-engine invariant: sorted by start.
    expect(timeline.clips.map((c) => c.startTime)).toEqual(
      [...timeline.clips.map((c) => c.startTime)].sort((a, b) => a - b),
    )
  })

  it('turns text clips into titles and caption clips into a transcript + captions item', () => {
    const { timeline, transcript } = migrateTimeline(v1Fixture())
    const title = timeline.extraGraphics.find((g) => g.kind === 'title')
    expect(title).toMatchObject({ id: 'tx', start: 0.5, end: 2.5, text: 'Hello', enter: 'rise' })
    expect(captionsItem(timeline)).toMatchObject({ y: 0.86 })
    expect(transcript?.edited).toBe(true)
    expect(transcript?.words.map((w) => w.text)).toEqual(['two', 'words', 'and', 'three', 'more'])
    expect(transcript?.words[1]).toMatchObject({ start: 1.5, end: 2 })
    expect(timelineDurationV2(timeline)).toBe(6)
  })

  it('a timeline without captions migrates without a transcript', () => {
    const { transcript, timeline } = migrateTimeline(emptyTimeline())
    expect(transcript).toBeNull()
    expect(timeline.clips).toEqual([])
  })
})

const asset = (id: string, duration: number, kind: MediaAsset['kind'] = 'video') =>
  ({ id, name: `${id}.webm`, kind, duration }) as MediaAsset

describe('v2 operations', () => {
  it('split at a time respects speed when setting the right in-point', () => {
    let tl = appendAsset(emptyTimelineV2(), asset('a', 6), 'c1')
    tl = setSpeed(tl, 'c1', 2) // 6 s of source in 3 s
    expect(tl.clips[0].duration).toBe(90)
    tl = splitAt(tl, 'c1', 1, 'c2')
    const right = tl.clips.find((c) => c.id === 'c2')!
    expect(right).toMatchObject({ startTime: 30, duration: 60, inPoint: 60 })
  })

  it('trim start moves the in-point by speed × frames; trim end shortens', () => {
    let tl = appendAsset(emptyTimelineV2(), asset('a', 6), 'c1')
    tl = setSpeed(tl, 'c1', 2)
    tl = trimTo(tl, 'c1', 'start', 1)
    expect(tl.clips[0]).toMatchObject({ startTime: 30, inPoint: 60, duration: 60 })
    tl = trimTo(tl, 'c1', 'end', 2.5)
    expect(tl.clips[0].duration).toBe(45)
  })

  it('ripple delete closes the gap on the same lane only', () => {
    let tl = appendAsset(emptyTimelineV2(), asset('a', 2), 'c1')
    tl = appendAsset(tl, asset('b', 2), 'c2')
    tl = appendAsset(tl, asset('m', 5, 'audio'), 'm1')
    tl = rippleDelete(tl, 'c1')
    expect(tl.clips.find((c) => c.id === 'c2')?.startTime).toBe(0)
    expect(tl.clips.find((c) => c.id === 'm1')?.startTime).toBe(0)
    expect(tl.clips.map((c) => c.id)).not.toContain('c1')
  })

  it('moves keep the sorted invariant and only change lane within the same type', () => {
    let tl = appendAsset(emptyTimelineV2(), asset('a', 2), 'c1')
    tl = appendAsset(tl, asset('b', 2), 'c2')
    tl = moveMedia(tl, 'c2', 0)
    tl = moveMedia(tl, 'c1', 3, MAIN_AUDIO)
    expect(tl.clips.map((c) => c.id)).toEqual(['c2', 'c1'])
    expect(tl.clips.find((c) => c.id === 'c1')?.trackId).toBe(MAIN_VIDEO)
  })

  it('titles split at a time', () => {
    let tl = emptyTimelineV2()
    tl = {
      ...tl,
      extraGraphics: [
        {
          kind: 'title',
          id: 't',
          start: 0,
          end: 4,
          text: 'x',
          font: 'Inter',
          size: 80,
          weight: 700,
          color: '#fff',
          background: null,
          align: 'Center',
          x: 0.5,
          y: 0.5,
          enter: 'fade',
          layer: 'over',
        },
      ],
    }
    tl = splitTitle(tl, 't', 1.5, 't2')
    expect(tl.extraGraphics.map((g) => (g.kind === 'title' ? [g.start, g.end] : null))).toEqual([
      [0, 1.5],
      [1.5, 4],
    ])
  })
})

describe('transcript', () => {
  const tr = transcriptFromCues([{ start: 0, end: 2, text: 'one two three four' }], {
    assetId: 'v',
    model: 'test',
  })
  it('shows the chunk holding t with the active word', () => {
    expect(captionAt(tr, 0.6, 3)).toEqual({ text: 'one two three', activeIndex: 1 })
    expect(captionAt(tr, 1.7, 3)).toEqual({ text: 'four', activeIndex: 0 })
    expect(captionAt(tr, 3, 3)).toBeNull()
  })
  it('turns back into cues', () => {
    expect(cuesFromTranscript(tr, 2)).toEqual([
      { start: 0, end: 1, text: 'one two' },
      { start: 1, end: 2, text: 'three four' },
    ])
  })
  it('keeps SRT cue boundaries as caption lines, through edits and deletes', () => {
    const srt = transcriptFromCues(
      [
        { start: 0, end: 1, text: 'Hello there' },
        { start: 1.2, end: 2, text: 'General Kenobi' },
      ],
      { assetId: 'srt', model: 'srt' },
    )
    expect(cuesFromTranscript(srt, 7).map((c) => c.text)).toEqual(['Hello there', 'General Kenobi'])
    expect(captionAt(srt, 0.2, 7)?.text).toBe('Hello there')
    const edited = editChunk(srt, 0, 7, 'Why hello there')
    expect(cuesFromTranscript(edited, 7).map((c) => c.text)).toEqual(['Why hello there', 'General Kenobi'])
    expect(cuesFromTranscript(removeChunk(edited, 0, 7), 7).map((c) => c.text)).toEqual(['General Kenobi'])
  })
})
