// Timeline v2 → graphics document (plan 8.4). P5 maps what the editor has
// today: hand-made titles and the captions item. Looks (P6) add their own
// items through the same function, and keep user edits by item id.
import type { MediaAsset } from '@/lib/local/models'
import {
  aspectOf,
  captionsItem,
  MAIN_VIDEO,
  outputDuration,
  timelineDurationV2,
  type CaptionsItem,
  type TimelineV2,
  type TitleItem,
} from '../model/timelineV2'
import type { Transcript } from '../model/transcript'
import { builtinFont } from './fonts'
import { endCardItem, fittedVideo, lookItems, type BrandSnapshot, type Box } from './looks'
import type { GraphicItem, GraphicsDoc, GraphicsTranscript, Motion } from './schema'

/** CSS-ish colours to `#rrggbb(aa)`; anything unreadable becomes `fallback`. */
export function toHex(color: string | null | undefined, fallback = '#ffffff'): string {
  if (!color) return fallback
  const c = color.trim()
  if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(c)) return c.toLowerCase()
  if (/^#[0-9a-f]{4}$/i.test(c))
    return `#${c
      .slice(1)
      .split('')
      .map((x) => x + x)
      .join('')}`.toLowerCase()
  const m = c.match(/^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:[ ,/]+([\d.]+%?))?\s*\)$/i)
  if (!m) return fallback
  const byte = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, '0')
  const alpha = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4])
  const a = alpha >= 1 ? '' : byte(alpha * 255)
  return `#${byte(+m[1])}${byte(+m[2])}${byte(+m[3])}${a}`
}

const NONE: Motion = { kind: 'none', duration: 0, easing: 'easeOut' }

/** Design pixels of the canvas: its short side is 1080. */
function designSize(tl: TimelineV2): { w: number; h: number } {
  const k = Math.min(tl.width, tl.height) / 1080
  return { w: tl.width / k, h: tl.height / k }
}

function titleItem(tl: TimelineV2, g: TitleItem): GraphicItem {
  const { h } = designSize(tl)
  // Room for four lines; Rust scales a longer block down to fit.
  const boxH = Math.min(0.9, (g.size * 1.2 * 4 + g.size) / h)
  const w = 0.84
  const x = g.align === 'Center' ? Math.max(0, Math.min(1 - w, g.x - w / 2)) : (1 - w) / 2
  const enter: Motion =
    g.enter === 'none'
      ? NONE
      : {
          kind: g.enter,
          duration: g.enter === 'pop' ? 0.35 : 0.45,
          easing: g.enter === 'pop' ? 'backOut' : 'easeOut',
        }
  return {
    kind: 'title',
    id: g.id,
    start: g.start,
    end: g.end,
    text: g.text,
    style: {
      font: g.font,
      size: g.size,
      weight: g.weight,
      color: toHex(g.color),
      align: g.align === 'Left' ? 'left' : g.align === 'Right' ? 'right' : 'center',
      lineHeight: 1.15,
      background: g.background ? toHex(g.background, '#000000b3') : null,
      stroke: null,
      case: 'asIs',
    },
    box: { x, y: Math.max(0, Math.min(1 - boxH, g.y - boxH / 2)), w, h: boxH },
    enter,
    exit: g.enter === 'none' ? NONE : { kind: 'fade', duration: 0.25, easing: 'easeInOut' },
    layer: 'over',
  }
}

export interface BuildOptions {
  /** The size frames are drawn at (preview or export); the timeline's own size otherwise. */
  canvas?: { width: number; height: number }
  /** The brand kit the Finish choices refer to (colours, font, logo). */
  brand?: BrandSnapshot | null
  /** Media of the timeline: the main clip's size places titles around the video. */
  assets?: Map<string, MediaAsset>
}

/** The line the watermark shows (plan 12.1, D2). */
export const WATERMARK_TEXT = 'Made with Animato'

/** Width over height of the main video (16:9 when there is none: workers render 16:9). */
export function mainSourceAspect(tl: TimelineV2, assets?: Map<string, MediaAsset>): number {
  const main = tl.clips.find((c) => c.trackId === MAIN_VIDEO)
  const a = main ? assets?.get(main.assetId) : undefined
  return a && a.width > 0 && a.height > 0 ? a.width / a.height : 16 / 9
}

/** Where the main video sits, as fractions of the canvas. */
export function mainVideoBox(tl: TimelineV2, assets?: Map<string, MediaAsset>): Box {
  const main = tl.clips.find((c) => c.trackId === MAIN_VIDEO)
  const t = main?.transform
  return fittedVideo(mainSourceAspect(tl, assets), aspectOf(tl), t?.scale ?? 1, t?.x ?? 0.5, t?.y ?? 0.5)
}

function captionsDocItem(tl: TimelineV2, cap: CaptionsItem): GraphicItem {
  const { h } = designSize(tl)
  const boxH = Math.min(0.4, (cap.size * 1.15 * 2 + cap.size) / h)
  return {
    kind: 'captions',
    id: cap.id,
    style: {
      font: cap.font,
      size: cap.size,
      weight: cap.weight ?? 700,
      color: toHex(cap.color),
      activeColor: cap.highlight === 'word' ? toHex(cap.activeColor ?? '#ffd60a', '#ffd60a') : null,
      background: cap.background ? toHex(cap.background, '#000000b3') : null,
      stroke: cap.stroke ? { width: cap.stroke.width, color: toHex(cap.stroke.color, '#000000') } : null,
      case: cap.case ?? 'asIs',
    },
    box: { x: 0.05, y: Math.max(0, Math.min(1 - boxH, cap.y - boxH / 2)), w: 0.9, h: boxH },
    maxWords: cap.maxWords,
    maxLines: 2,
    highlight: cap.highlight,
    layer: 'over',
  }
}

/**
 * The graphics document of a timeline: the look's items (Finish), the
 * titles added by hand, captions (drawn only when a transcript is passed to
 * the scene), the end card and the watermark, in that order.
 */
export function buildGraphics(tl: TimelineV2, opts: BuildOptions = {}): GraphicsDoc {
  const items: GraphicItem[] = []
  const finish = tl.finish
  const brand = finish && opts.brand && opts.brand.kitId === finish.brand.kitId ? opts.brand : null
  const look = finish
    ? {
        aspect: aspectOf(tl),
        video: mainVideoBox(tl, opts.assets),
        finish,
        brand,
        duration: timelineDurationV2(tl),
      }
    : null
  if (look) items.push(...lookItems(look))
  for (const g of tl.extraGraphics) if (g.kind === 'title') items.push(titleItem(tl, g))
  const cap = captionsItem(tl)
  if (cap && (finish?.captions.enabled ?? true)) items.push(captionsDocItem(tl, cap))
  const card = look ? endCardItem(look) : null
  if (card) items.push(card)
  if (finish?.watermark)
    items.push({ kind: 'watermark', id: 'gfx_watermark', corner: 'br', text: WATERMARK_TEXT, layer: 'over' })

  const families = new Set<string>(['Inter'])
  for (const item of items) {
    if ('style' in item) families.add(item.style.font)
    if (item.kind === 'endCard') families.add(item.font)
  }
  const usesLogo = items.some(
    (i) => (i.kind === 'image' && i.imageId === brand?.logo?.id) || (i.kind === 'endCard' && i.logo),
  )
  return {
    version: 1,
    canvas: opts.canvas ?? { width: tl.width, height: tl.height },
    duration: outputDuration(tl),
    fonts: [...families].flatMap((family) => {
      const f = builtinFont(family)
      return f ? [{ family, source: `builtin:${f.file}` }] : []
    }),
    images: usesLogo && brand?.logo ? [brand.logo] : [],
    items,
  }
}

/** The transcript as the scene reads it, or null when there is none. */
export function graphicsTranscript(t: Transcript | null | undefined): GraphicsTranscript | null {
  if (!t?.words.length) return null
  return {
    words: t.words.map((w) => ({
      text: w.text,
      start: w.start,
      end: w.end,
      ...(w.breakAfter ? { breakAfter: true } : {}),
    })),
  }
}
