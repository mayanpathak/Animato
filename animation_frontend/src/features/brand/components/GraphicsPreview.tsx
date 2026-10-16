// The kit as the video draws it (plan 6.8): a title card, a caption and an
// end card, laid out by animato-graphics (WASM) with the kit's own fonts,
// colours and logo, and painted with the graphics display lists.
import { useEffect, useRef } from 'react'
import type { BrandKit } from '@/lib/local/models'
import { brandRender } from '@/features/editor/finish/brand'
import { drawDisplayList } from '@/features/editor/graphics/draw2d'
import { ensureFonts } from '@/features/editor/graphics/fonts'
import { brandColors, type BrandRender } from '@/features/editor/graphics/looks'
import type {
  FrameGraphics,
  GraphicItem,
  GraphicsDoc,
  GraphicsTranscript,
} from '@/features/editor/graphics/schema'
import { loadWasm } from '@/features/editor/engine/wasm'

const W = 640
const H = 360

/** `#rrggbb` mixed toward black by `k` (0..1): white text stays legible on it. */
function darken(hex: string, k: number): string {
  const h = hex.replace('#', '').slice(0, 6).padEnd(6, '0')
  const c = [0, 2, 4].map((i) => Math.round(parseInt(h.slice(i, i + 2), 16) * (1 - k)))
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

function fontsOf(brand: BrandRender, families: string[]): GraphicsDoc['fonts'] {
  return families.flatMap((family) => {
    const own = brand.fonts?.find((f) => f.family === family)
    return own ? [own] : [{ family, source: `builtin:${family}` }]
  })
}

function docs(
  kit: BrandKit,
  brand: BrandRender,
): { doc: GraphicsDoc; t: number; words: GraphicsTranscript | null }[] {
  const c = brandColors(brand)
  const heading = kit.headingFont
  const body = kit.bodyFont
  const base = (items: GraphicItem[], duration: number): GraphicsDoc => ({
    version: 1,
    canvas: { width: W * 2, height: H * 2 },
    duration,
    fonts: fontsOf(brand, [heading, body]),
    images: brand.logo ? [brand.logo] : [],
    items,
  })
  const words: GraphicsTranscript = {
    words: ['Captions', 'in', 'your', 'brand', 'colours'].map((text, i) => ({
      text,
      start: i * 0.3,
      end: i * 0.3 + 0.28,
    })),
  }
  return [
    {
      t: 1.5,
      words: null,
      doc: base(
        [
          {
            kind: 'shape',
            id: 'bg',
            start: 0,
            end: 10,
            shape: 'rect',
            box: { x: 0, y: 0, w: 1, h: 1 },
            radius: 0,
            fill: {
              linear: {
                from: { x: 0, y: 0 },
                to: { x: 1, y: 1 },
                stops: [
                  { offset: 0, color: c.primary.slice(0, 7) },
                  { offset: 1, color: darken(c.primary, 0.45) },
                ],
              },
            },
            stroke: null,
            shadow: null,
            enter: { kind: 'none', duration: 0, easing: 'easeOut' },
            exit: { kind: 'none', duration: 0, easing: 'easeOut' },
            layer: 'under',
          },
          {
            kind: 'title',
            id: 't',
            start: 0,
            end: 10,
            text: kit.name || 'Your headline',
            style: {
              font: heading,
              size: 110,
              weight: 800,
              color: '#ffffff',
              align: 'center',
              lineHeight: 1.08,
              background: null,
              stroke: null,
              case: 'asIs',
            },
            box: { x: 0.08, y: 0.3, w: 0.84, h: 0.4 },
            enter: { kind: 'none', duration: 0, easing: 'easeOut' },
            exit: { kind: 'none', duration: 0, easing: 'easeOut' },
            layer: 'over',
          },
          ...(brand.logo
            ? [
                {
                  kind: 'image' as const,
                  id: 'logo',
                  start: 0,
                  end: 10,
                  imageId: brand.logo.id,
                  box: { x: 0.06, y: 0.08, w: 0.2, h: 0.12 },
                  fit: 'contain' as const,
                  opacity: 1,
                  layer: 'over' as const,
                },
              ]
            : []),
        ],
        10,
      ),
    },
    {
      t: 0.95,
      words,
      doc: base(
        [
          {
            kind: 'captions',
            id: 'c',
            style: {
              font: body,
              size: 64,
              weight: 700,
              color: '#ffffff',
              activeColor: c.accent,
              background: `${c.primary.slice(0, 7)}e6`,
              stroke: null,
              case: 'asIs',
            },
            box: { x: 0.05, y: 0.4, w: 0.9, h: 0.2 },
            maxWords: 5,
            maxLines: 2,
            highlight: 'word',
            layer: 'over',
          },
        ],
        10,
      ),
    },
    {
      t: 9.5,
      words: null,
      doc: base(
        [
          {
            kind: 'endCard',
            id: 'e',
            duration: 2,
            headline: 'Follow for more',
            sub: '@yourhandle',
            logo: Boolean(brand.logo),
            background: { solid: c.primary },
            font: heading,
            color: '#ffffff',
            layer: 'over',
          },
        ],
        10,
      ),
    },
  ]
}

async function paint(canvases: HTMLCanvasElement[], kit: BrandKit) {
  const wasm = await loadWasm()
  const brand = await brandRender(kit)
  const images = new Map<string, CanvasImageSource>()
  if (brand.logo && brand.logoUrl)
    images.set(brand.logo.id, await createImageBitmap(await (await fetch(brand.logoUrl)).blob()))
  const scene = new wasm.GraphicsScene()
  try {
    for (const [i, { doc, t, words }] of docs(kit, brand).entries()) {
      const canvas = canvases[i]
      if (!canvas) continue
      await ensureFonts(wasm, doc, words)
      scene.set(JSON.stringify(doc), JSON.stringify(words))
      const g = JSON.parse(scene.frame_at(t)) as FrameGraphics
      const ctx = canvas.getContext('2d')
      if (!ctx) continue
      ctx.fillStyle = '#16161c'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      drawDisplayList(ctx, g.under.cmds, images)
      drawDisplayList(ctx, g.over.cmds, images)
    }
  } finally {
    scene.free()
  }
}

const LABELS = ['Title card', 'Captions', 'End card']

export function GraphicsPreview({ kit }: { kit: BrandKit }) {
  const refs = useRef<(HTMLCanvasElement | null)[]>([])
  const key = JSON.stringify([
    kit.name,
    kit.colors,
    kit.headingFont,
    kit.bodyFont,
    kit.logoDataUrl?.length,
    kit.fonts,
  ])
  useEffect(() => {
    const t = setTimeout(() => {
      void paint(
        refs.current.filter((c): c is HTMLCanvasElement => Boolean(c)),
        kit,
      ).catch(() => undefined)
    }, 120)
    return () => clearTimeout(t)
    // `key` lists what the pictures depend on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return (
    <figure className="m-0 space-y-3" data-testid="brand-graphics-preview">
      {LABELS.map((label, i) => (
        <div key={label}>
          <canvas
            ref={(el) => {
              refs.current[i] = el
            }}
            width={W * 2}
            height={H * 2}
            className="block aspect-video w-full rounded-xl border border-line-strong bg-surface-2"
            role="img"
            aria-label={`${label} in ${kit.name}`}
          />
          <figcaption className="mt-1.5 text-2xs text-fg-subtle">{label}</figcaption>
        </div>
      ))}
    </figure>
  )
}
