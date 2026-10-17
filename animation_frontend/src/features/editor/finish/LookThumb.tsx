// A small live picture of a look (plan 6.6 §2): the look's real graphics
// document, laid out by animato-graphics (WASM) and drawn with the same
// display lists the Canvas2D fallback draws, over a frame of the video.
import { useEffect, useRef } from 'react'
import type { MediaAsset } from '@/lib/local/models'
import { buildGraphics, mainSourceAspect, mainVideoBox } from '../graphics/build'
import { drawDisplayList } from '../graphics/draw2d'
import { ensureFonts } from '../graphics/fonts'
import { lookBackdrop, type BrandRender } from '../graphics/looks'
import type { FrameGraphics } from '../graphics/schema'
import { loadWasm } from '../engine/wasm'
import { setLook } from '../model/finish'
import { aspectOf, type LookId, type TimelineV2 } from '../model/timelineV2'

const HEIGHT = 112

async function loadImage(url: string): Promise<ImageBitmap | null> {
  try {
    return await createImageBitmap(await (await fetch(url)).blob())
  } catch {
    return null
  }
}

async function paint(
  canvas: HTMLCanvasElement,
  tl: TimelineV2,
  brand: BrandRender | null,
  assets: Map<string, MediaAsset>,
  poster: string | null,
) {
  const wasm = await loadWasm()
  const doc = buildGraphics(tl, { canvas: { width: canvas.width, height: canvas.height }, brand, assets })
  await ensureFonts(wasm, doc, null)
  const scene = new wasm.GraphicsScene()
  scene.set(JSON.stringify(doc), 'null')
  // A moment in: the title has entered.
  const g = JSON.parse(scene.frame_at(1.2)) as FrameGraphics
  scene.free()
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const images = new Map<string, CanvasImageSource>()
  if (brand?.logo && brand.logoUrl) {
    const logo = await loadImage(brand.logoUrl)
    if (logo) images.set(brand.logo.id, logo)
  }
  const frame = poster ? await loadImage(poster) : null
  const W = canvas.width
  const H = canvas.height
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, W, H)
  drawDisplayList(ctx, g.under.cmds, images)
  if (frame) {
    const box = mainVideoBox(tl, assets)
    if (lookBackdrop(tl.finish?.look ?? 'clean', aspectOf(tl), mainSourceAspect(tl, assets))) {
      const k = Math.max(W / frame.width, H / frame.height) * 1.06
      ctx.save()
      ctx.filter = 'brightness(0.32) saturate(0.7)'
      ctx.drawImage(
        frame,
        (W - frame.width * k) / 2,
        (H - frame.height * k) / 2,
        frame.width * k,
        frame.height * k,
      )
      ctx.restore()
    }
    ctx.drawImage(frame, box.x * W, box.y * H, box.w * W, box.h * H)
  }
  drawDisplayList(ctx, g.over.cmds, images)
}

export function LookThumb({
  look,
  timeline,
  brand,
  assets,
  poster,
}: {
  look: LookId
  timeline: TimelineV2
  brand: BrandRender | null
  assets: Map<string, MediaAsset>
  poster: string | null
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const width = Math.round((HEIGHT * timeline.width) / timeline.height)
  // What the picture depends on; the canvas is redrawn only when it changes.
  const key = JSON.stringify([
    look,
    timeline.width,
    timeline.height,
    timeline.finish?.title,
    brand?.kitId,
    brand?.logo?.id,
    poster,
  ])
  useEffect(() => {
    const canvas = ref.current
    if (!canvas || !timeline.finish) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(HEIGHT * dpr)
    // The look's own captions are not part of the thumbnail (no transcript).
    void paint(canvas, setLook(timeline, look), brand, assets, poster).catch(() => undefined)
    // `key` lists what the picture depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return (
    <canvas
      ref={ref}
      aria-hidden
      className="block rounded-md bg-black"
      style={{ width, height: HEIGHT }}
      data-testid={`look-thumb-${look}`}
    />
  )
}
