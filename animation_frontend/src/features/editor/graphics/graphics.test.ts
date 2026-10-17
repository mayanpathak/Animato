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
import type { MediaAsset } from '@/lib/local/models'
import { mediaClipFor } from '../model/ops'
import {
  ASPECT_PRESETS,
  defaultCaptions,
  defaultFinish,
  emptyTimelineV2,
  MAIN_VIDEO,
  type TimelineV2,
} from '../model/timelineV2'
import { transcriptFromCues } from '../model/transcript'
import { buildGraphics, graphicsTranscript, mainVideoBox, toHex } from './build'
import { captionPreset, fittedVideo, lookBackdrop, lookCaptionStyle, type BrandSnapshot } from './looks'
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

/** Finish with only the watermark on: no hook title. */
function watermarked(tl: TimelineV2): TimelineV2 {
  return { ...tl, finish: defaultFinish('', { watermark: true }) }
}

describe('buildGraphics', () => {
  it('maps titles and captions to a document Rust reads', () => {
    const doc = buildGraphics(watermarked(timeline()))
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
    scene.set(JSON.stringify(buildGraphics(watermarked(timeline()))), JSON.stringify(graphicsTranscript(tr)))
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

describe('looks', () => {
  const LOOK_IDS = ['clean', 'bold', 'minimal', 'brand'] as const
  const FORMATS = ['16:9', '9:16', '1:1'] as const
  const brand: BrandSnapshot = {
    kitId: 'kit_1',
    colors: ['#c2410c', '#111827', '#facc15'],
    headingFont: 'Geist',
    logo: { id: 'logo_kit_1', width: 400, height: 120 },
  }

  function finished(look: (typeof LOOK_IDS)[number], aspect: (typeof FORMATS)[number]): TimelineV2 {
    const tl = { ...emptyTimelineV2(aspect), ...ASPECT_PRESETS[aspect] }
    tl.clips = [mediaClipFor(tl, asset, 0, MAIN_VIDEO, 'clp_main')]
    const finish = defaultFinish('Fourier Epicycles', { watermark: true })
    finish.look = look
    finish.brand.kitId = 'kit_1'
    finish.endCard.enabled = true
    const preset = captionPreset(lookCaptionStyle(look), look, aspect, mainVideoBox(tl, assets), brand)
    tl.extraGraphics = [{ ...defaultCaptions(), ...preset }]
    return { ...tl, finish }
  }
  const asset = {
    id: 'a_main',
    kind: 'video',
    name: 'render.mp4',
    duration: 8,
    width: 854,
    height: 480,
  } as MediaAsset
  const assets = new Map([[asset.id, asset]])

  it.each(LOOK_IDS.flatMap((l) => FORMATS.map((f) => [l, f] as const)))(
    '%s in %s: valid, laid out by Rust, title drawn, watermark clear of captions',
    (look, aspect) => {
      const doc = buildGraphics(finished(look, aspect), { brand, assets, canvas: ASPECT_PRESETS[aspect] })
      expect(graphicsDocSchema.parse(doc)).toEqual(doc)
      expect(doc.duration).toBe(10) // 8 s of video + the 2 s end card
      const scene = new GraphicsScene()
      scene.set(
        JSON.stringify(doc),
        JSON.stringify(
          graphicsTranscript(
            transcriptFromCues([{ start: 0.5, end: 2, text: 'one two three' }], { assetId: 'a', model: 't' }),
          ),
        ),
      )
      const runs = runsAt(scene, 1.5)
      // Minimal shows no title in 16:9 (plan 7.3).
      if (!(look === 'minimal' && aspect === '16:9'))
        expect(runs.join(' ').toLowerCase()).toContain('fourier')
      expect(runs.join(' ').toLowerCase()).toContain('two')
      expect(runsAt(scene, 9).join(' ')).toContain('Follow')
      scene.free()

      const cap = doc.items.find((i) => i.kind === 'captions')
      if (cap && cap.kind === 'captions') {
        // The watermark pill sits in the bottom 4% of the safe area; captions end above it.
        const safeBottom = aspect === '9:16' ? 1 - 420 / 1920 : 0.95
        expect(cap.box.y + cap.box.h).toBeLessThanOrEqual(safeBottom - 0.035)
      }
      for (const item of doc.items)
        if ('box' in item) {
          expect(item.box.x).toBeGreaterThanOrEqual(0)
          expect(item.box.y).toBeGreaterThanOrEqual(0)
          expect(item.box.x + item.box.w).toBeLessThanOrEqual(1.0001)
          expect(item.box.y + item.box.h).toBeLessThanOrEqual(1.0001)
        }
    },
  )

  it('Brand without a kit falls back to Clean, and a kit only counts when Finish names it', () => {
    const tl = finished('brand', '9:16')
    const none = buildGraphics(tl, { assets })
    expect(none.items.some((i) => i.id === 'gfx_brand_bg')).toBe(false)
    const other = buildGraphics(tl, { assets, brand: { ...brand, kitId: 'kit_2' } })
    expect(other.images).toEqual([])
    const branded = buildGraphics(tl, { assets, brand })
    expect(branded.items.some((i) => i.id === 'gfx_brand_bg')).toBe(true)
    expect(branded.images).toEqual([brand.logo])
  })

  it('a 16:9 render in 9:16 sits in the middle third', () => {
    const box = fittedVideo(16 / 9, '9:16')
    expect(box.x).toBe(0)
    expect(box.w).toBe(1)
    expect(box.h).toBeCloseTo(0.316, 3)
    expect(box.y + box.h / 2).toBeCloseTo(0.5, 6)
    expect(lookBackdrop('clean', '9:16', 16 / 9)).toBe(true)
    expect(lookBackdrop('minimal', '9:16', 16 / 9)).toBe(false)
    expect(lookBackdrop('clean', '16:9', 16 / 9)).toBe(false)
  })
})
