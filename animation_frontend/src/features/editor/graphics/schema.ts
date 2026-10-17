// The graphics document (plan 8.4), mirrored from `crates/animato-graphics/
// src/doc.rs`. Rust reads the JSON that `buildGraphics` writes; the
// round-trip test (graphics.test.ts) runs the shared fixture through both.
//
// Units: times in seconds; boxes and gradient points as fractions of the
// canvas (of the item's box, for gradients); other lengths in design pixels,
// where the canvas's short side is 1080.
import { z } from 'zod'

export const hexColor = z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i, 'a #rrggbb(aa) colour')

const point = z.object({ x: z.number(), y: z.number() })
const stop = z.object({ offset: z.number(), color: hexColor })

export const paintSchema = z.union([
  z.object({ solid: hexColor }),
  z.object({ linear: z.object({ from: point, to: point, stops: z.array(stop) }) }),
  z.object({ radial: z.object({ center: point, radius: z.number(), stops: z.array(stop) }) }),
])

const box = z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() })
const layer = z.enum(['under', 'over'])
const strokeSpec = z.object({ width: z.number(), color: hexColor })
const shadowSpec = z.object({ color: hexColor, blur: z.number(), offsetY: z.number() })
const caseSchema = z.enum(['asIs', 'upper'])

export const motionSchema = z.object({
  kind: z.enum(['none', 'fade', 'rise', 'pop', 'typewriter']),
  duration: z.number().nonnegative(),
  easing: z.enum(['linear', 'easeOut', 'easeInOut', 'backOut']),
})

export const textStyleSchema = z.object({
  font: z.string(),
  size: z.number().positive(),
  weight: z.number().int().min(1).max(1000),
  color: hexColor,
  align: z.enum(['left', 'center', 'right']),
  lineHeight: z.number().positive(),
  background: hexColor.nullable(),
  stroke: strokeSpec.nullable(),
  case: caseSchema,
})

export const captionStyleSchema = z.object({
  font: z.string(),
  size: z.number().positive(),
  weight: z.number().int().min(1).max(1000),
  color: hexColor,
  activeColor: hexColor.nullable(),
  background: hexColor.nullable(),
  stroke: strokeSpec.nullable(),
  case: caseSchema,
})

const timed = { id: z.string(), start: z.number(), end: z.number() }

export const graphicItemSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('title'),
    ...timed,
    text: z.string(),
    style: textStyleSchema,
    box,
    enter: motionSchema,
    exit: motionSchema,
    layer,
  }),
  z.object({
    kind: z.literal('captions'),
    id: z.string(),
    style: captionStyleSchema,
    box,
    maxWords: z.number().int().positive(),
    maxLines: z.number().int().positive(),
    highlight: z.enum(['word', 'none']),
    layer,
  }),
  z.object({
    kind: z.literal('shape'),
    ...timed,
    shape: z.enum(['rect', 'roundRect', 'ellipse']),
    box,
    radius: z.number(),
    fill: paintSchema,
    stroke: strokeSpec.nullable(),
    shadow: shadowSpec.nullable(),
    enter: motionSchema,
    exit: motionSchema,
    layer,
  }),
  z.object({
    kind: z.literal('image'),
    ...timed,
    imageId: z.string(),
    box,
    fit: z.enum(['contain', 'cover']),
    opacity: z.number().min(0).max(1),
    layer,
  }),
  z.object({
    kind: z.literal('progress'),
    id: z.string(),
    box,
    color: hexColor,
    track: hexColor,
    layer,
  }),
  z.object({
    kind: z.literal('endCard'),
    id: z.string(),
    duration: z.number().positive(),
    headline: z.string(),
    sub: z.string(),
    logo: z.boolean(),
    background: paintSchema,
    font: z.string(),
    color: hexColor,
    layer,
  }),
  z.object({
    kind: z.literal('watermark'),
    id: z.string(),
    corner: z.enum(['br', 'bl', 'tr', 'tl']),
    text: z.string(),
    layer,
  }),
])

export const graphicsDocSchema = z.object({
  version: z.literal(1),
  canvas: z.object({ width: z.number().int().positive(), height: z.number().int().positive() }),
  duration: z.number().nonnegative(),
  fonts: z.array(z.object({ family: z.string(), source: z.string() })),
  images: z.array(z.object({ id: z.string(), width: z.number().int(), height: z.number().int() })),
  items: z.array(graphicItemSchema),
})

/** The transcript as the graphics scene reads it (plan 9.2): words in seconds. */
export const graphicsTranscriptSchema = z.object({
  words: z.array(
    z.object({
      text: z.string(),
      start: z.number(),
      end: z.number(),
      breakAfter: z.boolean().optional(),
    }),
  ),
})

export type GraphicsDoc = z.infer<typeof graphicsDocSchema>
export type GraphicItem = z.infer<typeof graphicItemSchema>
export type Paint = z.infer<typeof paintSchema>
export type Motion = z.infer<typeof motionSchema>
export type TextStyle = z.infer<typeof textStyleSchema>
export type GraphicsTranscript = z.infer<typeof graphicsTranscriptSchema>

// ------------------------------------------------------------- display lists
// What `GraphicsScene.frame_at` returns (crates/animato-graphics/src/
// display_list.rs), for the Canvas2D fallback. Lengths in canvas pixels.

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export type PathEl =
  | { MoveTo: [number, number] }
  | { LineTo: [number, number] }
  | { QuadTo: [number, number, number, number] }
  | { CurveTo: [number, number, number, number, number, number] }
  | 'Close'

export type DrawCmd =
  | { cmd: 'fillRect'; rect: Rect; radius: number; paint: Paint }
  | { cmd: 'fillPath'; path: PathEl[]; paint: Paint }
  | {
      cmd: 'glyphRun'
      font: { face: number; weight: number }
      family: string
      size: number
      fill: string
      stroke: { width: number; color: string } | null
      transform: { m: [number, number, number, number, number, number] }
      text: string
    }
  | { cmd: 'pushLayer'; opacity: number; clip: Rect | null }
  | { cmd: 'popLayer' }
  | {
      cmd: 'strokePath'
      path: PathEl[]
      width: number
      paint: Paint
      join: CanvasLineJoin
      cap: 'butt' | 'round' | 'square'
    }
  | { cmd: 'image'; imageId: string; rect: Rect; opacity: number }
  | { cmd: 'blurredRoundedRect'; rect: Rect; radius: number; stdDev: number; color: string }

export interface FrameGraphics {
  under: { cmds: DrawCmd[] }
  over: { cmds: DrawCmd[] }
}
