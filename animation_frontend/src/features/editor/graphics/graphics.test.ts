// The graphics layer end to end in Node: the shared fixture through zod and
// Rust (round trip, plan 8.4), buildGraphics from a Timeline v2, and the
// scene's display lists and timings from the real WASM module.
import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  GraphicsScene,
  initSync,
  parse_graphics_doc,
  register_font,
  set_fallback_font,
} from '@/wasm/pkg/animato_wasm.js'
import { emptyTimelineV2, type TimelineV2 } from '../model/timelineV2'
import { transcriptFromCues } from '../model/transcript'
import { buildGraphics, graphicsTranscript, toHex } from './build'
import sampleDoc from './fixtures/sample-doc.json'
import sampleTranscript from './fixtures/sample-transcript.json'
import { graphicsDocSchema, graphicsTranscriptSchema, type FrameGraphics } from './schema'

beforeAll(() => {
  initSync({ module: readFileSync('src/wasm/pkg/animato_wasm_bg.wasm') })
  for (const file of ['Inter-Variable.ttf', 'Geist-Variable.ttf', 'NotoEmoji-Variable.ttf']) {
    const { face } = JSON.parse(register_font(readFileSync(`public/fonts/${file}`))) as { face: number }
    if (file.startsWith('Noto')) set_fallback_font(face)
  }
})

function runsAt(scene: GraphicsScene, t: number): string[] {
  const f = JSON.parse(scene.frame_at(t)) as FrameGraphics
  return [...f.under.cmds, ...f.over.cmds].flatMap((c) => (c.cmd === 'glyphRun' ? [c.text] : []))
}

describe('graphics document', () => {
  it('round-trips TS → JSON → Rust → JSON → TS unchanged', () => {
    const doc = graphicsDocSchema.parse(sampleDoc)
    const back = graphicsDocSchema.parse(JSON.parse(parse_graphics_doc(JSON.stringify(doc))))
    expect(back).toEqual(doc)
    expect(graphicsTranscriptSchema.parse(sampleTranscript).words).toHaveLength(13)
  })

  it('rejects what Rust would reject, with the reason', () => {
    expect(() => parse_graphics_doc(JSON.stringify({ ...sampleDoc, version: 'one' }))).toThrow(
      /expected u32 at line 1/,
    )
    expect(
      graphicsDocSchema.safeParse({ ...sampleDoc, items: [{ kind: 'title', color: 'red' }] }).success,
    ).toBe(false)
  })

  it('normalises colours to hex', () => {
    expect(toHex('#FFF')).toBe('#fff')
    expect(toHex('#07070acc')).toBe('#07070acc')
    expect(toHex('rgba(0, 0, 0, 0.5)')).toBe('#00000080')
    expect(toHex('rgb(255 128 0)')).toBe('#ff8000')
    expect(toHex('not a colour', '#000000')).toBe('#000000')
  })
})

function timeline(): TimelineV2 {
  const tl = emptyTimelineV2('9:16')
  tl.extraGraphics.push(
    {
      kind: 'title',
      id: 'gfx_t',
      start: 0,
      end: 3,
      text: 'Hello world',
      font: 'Inter',
      size: 110,
      weight: 700,
      color: '#ffffff',
      background: null,
      align: 'Center',
      x: 0.5,
      y: 0.42,
      enter: 'rise',
      layer: 'over',
    },
    {
      kind: 'captions',
      id: 'gfx_captions',
      font: 'Inter',
      size: 54,
      color: '#ffffff',
      background: '#000000b3',
      y: 0.86,
      maxWords: 7,
      highlight: 'word',
      layer: 'over',
    },
  )
  return tl
}

describe('buildGraphics', () => {
  it('maps titles and captions to a document Rust reads', () => {
    const doc = buildGraphics(timeline(), { watermark: 'Made with Animato' })
    expect(graphicsDocSchema.parse(doc)).toEqual(doc)
    expect(doc.items.map((i) => i.kind)).toEqual(['title', 'captions', 'watermark'])
    expect(doc.fonts).toEqual([{ family: 'Inter', source: 'builtin:Inter-Variable.ttf' }])
    expect(() => parse_graphics_doc(JSON.stringify(doc))).not.toThrow()
  })

  it('draws the title, the caption line and the watermark from WASM', () => {
    const tr = transcriptFromCues([{ start: 0.5, end: 1.5, text: 'Captions follow speech' }], {
      assetId: 'a',
      model: 'test',
    })
    const scene = new GraphicsScene()
    scene.set(
      JSON.stringify(buildGraphics(timeline(), { watermark: 'Made with Animato' })),
      JSON.stringify(graphicsTranscript(tr)),
    )
    const at = runsAt(scene, 1)
    expect(at).toEqual(expect.arrayContaining(['Hello', 'world', 'Captions', 'follow', 'speech', 'Animato']))
    // After the title and the captions, only the watermark is left.
    expect(runsAt(scene, 4)).toEqual(['Made', 'with', 'Animato'])
    // No transcript: no captions.
    scene.set(JSON.stringify(buildGraphics(timeline())), 'null')
    expect(runsAt(scene, 1)).toEqual(['Hello', 'world'])
    scene.free()
  })

  it('builds a scene and a frame within the plan 8.9 budgets (WASM in Node)', () => {
    const scene = new GraphicsScene()
    const doc = JSON.stringify(sampleDoc)
    const words = JSON.stringify(sampleTranscript)
    scene.set(doc, words) // warm the shaping caches
    let t0 = performance.now()
    for (let i = 0; i < 10; i++) scene.set(doc, words)
    const build = (performance.now() - t0) / 10
    t0 = performance.now()
    for (let f = 0; f < 360; f++) scene.frame_at(f / 30)
    const frame = (performance.now() - t0) / 360
    console.info(
      `graphics (WASM, Node): scene build ${build.toFixed(2)} ms, frame_at+JSON ${frame.toFixed(3)} ms`,
    )
    expect(build).toBeLessThan(8)
    expect(frame).toBeLessThan(1)
    scene.free()
  })
})
