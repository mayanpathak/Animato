// Looks (plan 7.3): deterministic functions from (format, video rect, the
// Finish choices, brand, duration) to graphics items. Vello draws them.
// Boxes are fractions of the canvas; Rust keeps text inside the safe area.
import type { AspectKey, CaptionStyleId, CaptionsItem, FinishSettings, LookId } from '../model/timelineV2'
import type { GraphicItem, Motion, Paint } from './schema'

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

/** What a look needs to know about the brand kit in use. */
export interface BrandSnapshot {
  kitId: string
  colors: string[]
  headingFont: string
  /** The logo, registered with the renderer under this id. */
  logo: { id: string; width: number; height: number } | null
}

/** A snapshot plus the logo's pixels as a data URL, for the worker to register. */
export interface BrandRender extends BrandSnapshot {
  logoUrl: string | null
}

export interface LookInput {
  aspect: AspectKey
  /** Where the main video sits. */
  video: Box
  finish: FinishSettings
  brand: BrandSnapshot | null
  /** Length of the content, before the end card. */
  duration: number
}

export const LOOKS: { id: LookId; label: string; hint: string }[] = [
  { id: 'clean', label: 'Clean', hint: 'Title, then the video; sentence-case captions' },
  { id: 'bold', label: 'Bold', hint: 'Big hook title, punchy captions' },
  { id: 'minimal', label: 'Minimal', hint: 'Quiet title and a progress bar' },
  { id: 'brand', label: 'Brand', hint: 'Your colours, logo and font' },
]

export const CAPTION_STYLES: { id: CaptionStyleId; label: string }[] = [
  { id: 'clean', label: 'Clean' },
  { id: 'bold', label: 'Bold' },
  { id: 'minimal', label: 'Minimal' },
]

const NONE: Motion = { kind: 'none', duration: 0, easing: 'easeOut' }
const FADE_OUT: Motion = { kind: 'fade', duration: 0.3, easing: 'easeInOut' }
const DARK = '#0b0b0f'
const HIGHLIGHT = '#ffd60a'

/** Brand colours with sensible stand-ins: primary, secondary, accent. */
export function brandColors(brand: BrandSnapshot | null): {
  primary: string
  secondary: string
  accent: string
} {
  const [primary = '#2f7bf6', secondary = DARK, accent = HIGHLIGHT] = brand?.colors ?? []
  return { primary, secondary, accent }
}

/** Where a source of `sourceAspect` (w/h) sits in an `aspect` canvas when fitted and centred. */
export function fittedVideo(sourceAspect: number, aspect: AspectKey, scale = 1, cx = 0.5, cy = 0.5): Box {
  const canvas = aspect === '16:9' ? 16 / 9 : aspect === '9:16' ? 9 / 16 : 1
  const [w, h] = sourceAspect > canvas ? [1, canvas / sourceAspect] : [sourceAspect / canvas, 1]
  return { x: cx - (w * scale) / 2, y: cy - (h * scale) / 2, w: w * scale, h: h * scale }
}

/** Where captions sit, as the centre line of their box. Clear of the watermark corner. */
function captionsCentre(look: LookId, aspect: AspectKey, video: Box): number {
  if (aspect === '16:9') return look === 'minimal' ? 0.82 : 0.8
  if (aspect === '1:1') return Math.min(0.835, video.y + video.h + 0.06)
  if (look === 'bold') return 0.7
  return Math.min(0.7, video.y + video.h + 0.05)
}

/** The captions preset a style writes into the timeline's captions item (plan 9.3). */
export function captionPreset(
  style: CaptionStyleId,
  look: LookId,
  aspect: AspectKey,
  video: Box,
  brand: BrandSnapshot | null,
): Partial<CaptionsItem> {
  const size = style === 'bold' ? 64 : style === 'minimal' ? 40 : 52
  // Two lines plus padding, as buildGraphics sizes the box; it ends above the watermark.
  const designH = aspect === '9:16' ? 1920 : 1080
  const half = (size * 1.15 * 2 + size) / designH / 2
  const safeBottom = aspect === '9:16' ? 1 - 420 / 1920 : 0.95
  const y = Math.min(captionsCentre(look, aspect, video), safeBottom - 0.036 - half)
  const branded = look === 'brand' && brand
  const c = brandColors(brand)
  if (style === 'bold')
    return {
      font: branded ? brand.headingFont : 'Geist',
      size,
      weight: 900,
      color: '#ffffff',
      background: null,
      stroke: { width: 8, color: DARK },
      activeColor: branded ? c.accent : HIGHLIGHT,
      highlight: 'word',
      case: 'upper',
      maxWords: 3,
      y,
    }
  if (style === 'minimal')
    return {
      font: 'Inter',
      size,
      weight: 600,
      color: '#ffffff',
      background: null,
      stroke: null,
      activeColor: null,
      highlight: 'none',
      case: 'asIs',
      maxWords: 7,
      y,
    }
  return {
    font: branded ? brand.headingFont : 'Inter',
    size,
    weight: 700,
    color: '#ffffff',
    background: branded ? `${c.primary.slice(0, 7)}e6` : null,
    stroke: branded ? null : { width: 6, color: DARK },
    activeColor: branded ? c.accent : HIGHLIGHT,
    highlight: 'word',
    case: 'asIs',
    maxWords: 5,
    y,
  }
}

/** The caption style a look starts with. */
export function lookCaptionStyle(look: LookId): CaptionStyleId {
  return look === 'bold' ? 'bold' : look === 'minimal' ? 'minimal' : 'clean'
}

/** True when a look shows a dimmed, scaled copy of the video behind it (Clean and Bold, off-format). */
export function lookBackdrop(look: LookId, aspect: AspectKey, sourceAspect: number): boolean {
  const canvas = aspect === '16:9' ? 16 / 9 : aspect === '9:16' ? 9 / 16 : 1
  return (look === 'clean' || look === 'bold') && Math.abs(canvas - sourceAspect) > 0.05
}

function hookBox(input: LookInput, size: 'small' | 'large'): Box {
  const { aspect, video, finish } = input
  if (finish.title.position === 'center') return { x: 0.08, y: 0.36, w: 0.84, h: 0.28 }
  if (aspect === '16:9')
    return size === 'large' ? { x: 0.08, y: 0.3, w: 0.84, h: 0.4 } : { x: 0.06, y: 0.68, w: 0.6, h: 0.22 }
  // Above the video, between the safe top and the video's top edge.
  const top = aspect === '9:16' ? 0.14 : 0.04
  const bottom = Math.max(top + 0.08, video.y - 0.015)
  return { x: 0.08, y: top, w: 0.84, h: bottom - top }
}

/** The look's own items: hook title, bands, progress, logo. Captions, end card and watermark are added by buildGraphics. */
export function lookItems(input: LookInput): GraphicItem[] {
  const { finish, aspect, video, brand } = input
  const t = finish.title
  const items: GraphicItem[] = []
  const titleOn = t.enabled && t.text.trim().length > 0
  const titleEnd = Math.max(0.5, Math.min(t.duration, input.duration || t.duration))
  const look = finish.look === 'brand' && !brand ? 'clean' : finish.look
  const c = brandColors(brand)
  const logo = brand?.logo && finish.brand.logo ? brand.logo : null

  const title = (
    box: Box,
    style: {
      font: string
      size: number
      weight: number
      color?: string
      align?: 'left' | 'center' | 'right'
      background?: string | null
      upper?: boolean
      stroke?: { width: number; color: string } | null
    },
    enter: Motion,
  ): GraphicItem => ({
    kind: 'title',
    id: 'gfx_hook',
    start: 0,
    end: titleEnd,
    text: t.text,
    style: {
      font: style.font,
      size: style.size,
      weight: style.weight,
      color: style.color ?? '#ffffff',
      align: style.align ?? 'center',
      lineHeight: 1.08,
      background: style.background ?? null,
      stroke: style.stroke ?? null,
      case: style.upper ? 'upper' : 'asIs',
    },
    box,
    enter,
    exit: FADE_OUT,
    layer: 'over',
  })
  const shape = (
    id: string,
    box: Box,
    fill: Paint,
    layer: 'under' | 'over',
    end = input.duration,
  ): GraphicItem => ({
    kind: 'shape',
    id,
    start: 0,
    end: Math.max(0.01, end),
    shape: 'rect',
    box,
    radius: 0,
    fill,
    stroke: null,
    shadow: null,
    enter: NONE,
    exit: layer === 'over' ? FADE_OUT : NONE,
    layer,
  })
  const rise: Motion = { kind: 'rise', duration: 0.5, easing: 'easeOut' }

  if (look === 'clean') {
    if (titleOn)
      items.push(
        title(
          hookBox(input, 'small'),
          aspect === '16:9'
            ? { font: 'Inter', size: 60, weight: 800, align: 'left', background: `${DARK}cc` }
            : { font: 'Inter', size: 76, weight: 800 },
          rise,
        ),
      )
  } else if (look === 'bold') {
    if (titleOn) {
      if (aspect === '16:9')
        items.push(shape('gfx_scrim', { x: 0, y: 0, w: 1, h: 1 }, { solid: '#000000b3' }, 'over', titleEnd))
      if (aspect === '1:1')
        items.push(
          shape('gfx_band', { x: 0, y: 0, w: 1, h: Math.max(0.16, video.y) }, { solid: DARK }, 'under'),
        )
      items.push(
        title(
          aspect === '16:9' ? hookBox(input, 'large') : hookBox(input, 'small'),
          {
            font: 'Geist',
            size: aspect === '16:9' ? 128 : 104,
            weight: 900,
            upper: true,
            stroke: { width: 6, color: DARK },
          },
          { kind: 'pop', duration: 0.45, easing: 'backOut' },
        ),
      )
    }
  } else if (look === 'minimal') {
    if (titleOn && aspect !== '16:9')
      items.push(
        title(
          hookBox(input, 'small'),
          { font: 'Inter', size: 48, weight: 600 },
          { kind: 'fade', duration: 0.4, easing: 'easeOut' },
        ),
      )
    const bar =
      aspect === '16:9'
        ? { x: 0.05, y: 0.94, w: 0.9, h: 0.007 }
        : { x: 0.08, y: Math.min(0.76, video.y + video.h + 0.03), w: 0.84, h: 0.005 }
    items.push({
      kind: 'progress',
      id: 'gfx_progress',
      box: bar,
      color: '#ffffff',
      track: '#ffffff33',
      layer: 'over',
    })
  } else {
    // Brand.
    const font = brand?.headingFont ?? 'Inter'
    if (aspect === '16:9') {
      if (titleOn) {
        items.push(shape('gfx_band', { x: 0, y: 0.8, w: 1, h: 0.2 }, { solid: c.primary }, 'over', titleEnd))
        items.push(
          title(
            { x: logo ? 0.2 : 0.06, y: 0.81, w: logo ? 0.74 : 0.88, h: 0.18 },
            { font, size: 56, weight: 800, align: 'left' },
            rise,
          ),
        )
      }
    } else {
      items.push(shape('gfx_brand_bg', { x: 0, y: 0, w: 1, h: 1 }, { solid: c.primary }, 'under'))
      if (titleOn) items.push(title(hookBox(input, 'small'), { font, size: 72, weight: 800 }, rise))
    }
    if (logo) {
      const box =
        aspect === '16:9'
          ? titleOn
            ? { x: 0.05, y: 0.83, w: 0.12, h: 0.12 }
            : { x: 0.82, y: 0.06, w: 0.12, h: 0.1 }
          : { x: 0.35, y: aspect === '9:16' ? 0.07 : 0.03, w: 0.3, h: 0.05 }
      items.push({
        kind: 'image',
        id: 'gfx_logo',
        start: 0,
        end: Math.max(0.01, input.duration),
        imageId: logo.id,
        box,
        fit: 'contain',
        opacity: 1,
        layer: 'over',
      })
    }
  }
  return items
}

/** The end card's look: brand colours under the Brand look, dark otherwise. */
export function endCardItem(input: LookInput): GraphicItem | null {
  const card = input.finish.endCard
  if (!card.enabled || card.duration <= 0) return null
  const branded = input.finish.look === 'brand' && input.brand
  const c = brandColors(input.brand)
  return {
    kind: 'endCard',
    id: 'gfx_end_card',
    duration: card.duration,
    headline: card.headline,
    sub: card.sub,
    logo: Boolean(card.logo && input.brand?.logo && input.finish.brand.logo),
    background: { solid: branded ? c.primary : DARK },
    font: branded ? input.brand!.headingFont : 'Geist',
    color: '#ffffff',
    layer: 'over',
  }
}
