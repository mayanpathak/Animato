// Finish (plan 6.6) as pure edits on Timeline v2. The store wraps each one in
// a single undoable step. Looks and caption styles write their caption
// preset into the timeline's captions item, so the fine-tune inspector and
// Finish edit the same captions.
import type { MediaAsset } from '@/lib/local/models'
import { mainVideoBox } from '../graphics/build'
import { captionPreset, lookCaptionStyle, type BrandSnapshot } from '../graphics/looks'
import {
  ASPECT_PRESETS,
  aspectOf,
  captionsItem,
  defaultFinish,
  type AspectKey,
  type CaptionStyleId,
  type CaptionsItem,
  type FinishSettings,
  type GraphicItemV2,
  type LookId,
  type TimelineV2,
} from './timelineV2'

export interface FinishContext {
  assets?: Map<string, MediaAsset>
  brand?: BrandSnapshot | null
}

/** The captions item with the preset of `style` for the timeline's current look and format. */
function withCaptionPreset(tl: TimelineV2, style: CaptionStyleId, ctx: FinishContext): GraphicItemV2[] {
  const cap = captionsItem(tl)
  if (!cap || !tl.finish) return tl.extraGraphics
  const preset = captionPreset(
    style,
    tl.finish.look,
    aspectOf(tl),
    mainVideoBox(tl, ctx.assets),
    ctx.brand ?? null,
  )
  return tl.extraGraphics.map((g) => (g.id === cap.id ? ({ ...g, ...preset } as CaptionsItem) : g))
}

/**
 * Finish defaults for a video seen in Finish for the first time: the derived
 * title, the watermark per entitlements, the video's format, and the look's
 * caption preset. A timeline that already has them is returned unchanged.
 */
export function startFinish(
  tl: TimelineV2,
  opts: { title: string; watermark: boolean; format?: AspectKey },
  ctx: FinishContext = {},
): TimelineV2 {
  if (tl.finish) return tl
  const sized = opts.format ? { ...tl, ...ASPECT_PRESETS[opts.format] } : tl
  const next = { ...sized, finish: defaultFinish(opts.title, { watermark: opts.watermark }) }
  return { ...next, extraGraphics: withCaptionPreset(next, next.finish.captions.style, ctx) }
}

export function updateFinish(tl: TimelineV2, patch: (f: FinishSettings) => FinishSettings): TimelineV2 {
  return tl.finish ? { ...tl, finish: patch(tl.finish) } : tl
}

/** A look, and the caption style it starts with. */
export function setLook(tl: TimelineV2, look: LookId, ctx: FinishContext = {}): TimelineV2 {
  if (!tl.finish) return tl
  const style = lookCaptionStyle(look)
  const next = { ...tl, finish: { ...tl.finish, look, captions: { ...tl.finish.captions, style } } }
  return { ...next, extraGraphics: withCaptionPreset(next, style, ctx) }
}

export function setCaptionStyle(tl: TimelineV2, style: CaptionStyleId, ctx: FinishContext = {}): TimelineV2 {
  if (!tl.finish) return tl
  const next = { ...tl, finish: { ...tl.finish, captions: { ...tl.finish.captions, style } } }
  return { ...next, extraGraphics: withCaptionPreset(next, style, ctx) }
}

/** A format: the canvas size, and captions placed for it. Titles follow by themselves (looks are per format). */
export function setFormat(tl: TimelineV2, aspect: AspectKey, ctx: FinishContext = {}): TimelineV2 {
  const next = { ...tl, ...ASPECT_PRESETS[aspect] }
  return next.finish
    ? { ...next, extraGraphics: withCaptionPreset(next, next.finish.captions.style, ctx) }
    : next
}
