// The Canvas2D fallback for graphics (plan 8.7): draws the display lists of
// animato-graphics with the 2D canvas API. Glyph runs are drawn as their
// text in the same font file, registered with FontFace (graphics/fonts.ts),
// so frames match Vello's up to text antialiasing and kerning details.
import type { DrawCmd, Paint, PathEl, Rect } from './schema'

type Ctx = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D

function fillStyle(ctx: Ctx, paint: Paint): string | CanvasGradient {
  if ('solid' in paint) return paint.solid
  if ('linear' in paint) {
    const { from, to, stops } = paint.linear
    const g = ctx.createLinearGradient(from.x, from.y, to.x, to.y)
    for (const s of stops) g.addColorStop(Math.max(0, Math.min(1, s.offset)), s.color)
    return g
  }
  const { center, radius, stops } = paint.radial
  const g = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, Math.max(0, radius))
  for (const s of stops) g.addColorStop(Math.max(0, Math.min(1, s.offset)), s.color)
  return g
}

function path2d(els: PathEl[]): Path2D {
  const p = new Path2D()
  for (const el of els) {
    if (el === 'Close') p.closePath()
    else if ('MoveTo' in el) p.moveTo(...el.MoveTo)
    else if ('LineTo' in el) p.lineTo(...el.LineTo)
    else if ('QuadTo' in el) p.quadraticCurveTo(...el.QuadTo)
    else p.bezierCurveTo(...el.CurveTo)
  }
  return p
}

function roundRect(ctx: Ctx, r: Rect, radius: number) {
  ctx.beginPath()
  ctx.roundRect(r.x, r.y, r.w, r.h, Math.max(0, Math.min(radius, r.w / 2, r.h / 2)))
}

/** Draws `cmds` over what the canvas holds. `images` are the registered images by id. */
export function drawDisplayList(ctx: Ctx, cmds: DrawCmd[], images: Map<string, CanvasImageSource>): void {
  let depth = 0
  ctx.save()
  for (const c of cmds) {
    switch (c.cmd) {
      case 'fillRect':
        ctx.fillStyle = fillStyle(ctx, c.paint)
        roundRect(ctx, c.rect, c.radius)
        ctx.fill()
        break
      case 'fillPath':
        ctx.fillStyle = fillStyle(ctx, c.paint)
        ctx.fill(path2d(c.path))
        break
      case 'strokePath':
        ctx.strokeStyle = fillStyle(ctx, c.paint)
        ctx.lineWidth = c.width
        ctx.lineJoin = c.join
        ctx.lineCap = c.cap
        ctx.stroke(path2d(c.path))
        break
      case 'glyphRun': {
        const [a, b, cc, d, e, f] = c.transform.m
        ctx.save()
        ctx.transform(a, b, cc, d, e, f)
        ctx.font = `${c.font.weight} ${c.size}px "${c.family}"`
        ctx.textBaseline = 'alphabetic'
        ctx.textAlign = 'left'
        if (c.stroke) {
          // Stroke first, fill over it, as Vello draws a run.
          ctx.lineJoin = 'round'
          ctx.lineWidth = c.stroke.width / Math.max(1e-6, Math.hypot(a, b))
          ctx.strokeStyle = c.stroke.color
          ctx.strokeText(c.text, 0, 0)
        }
        ctx.fillStyle = c.fill
        ctx.fillText(c.text, 0, 0)
        ctx.restore()
        break
      }
      case 'pushLayer':
        // Canvas has no group opacity: alpha applies per draw inside the layer.
        ctx.save()
        ctx.globalAlpha *= Math.max(0, Math.min(1, c.opacity))
        if (c.clip) {
          ctx.beginPath()
          ctx.rect(c.clip.x, c.clip.y, c.clip.w, c.clip.h)
          ctx.clip()
        }
        depth++
        break
      case 'popLayer':
        if (depth > 0) {
          ctx.restore()
          depth--
        }
        break
      case 'image': {
        const img = images.get(c.imageId)
        if (!img) break
        ctx.save()
        ctx.globalAlpha *= Math.max(0, Math.min(1, c.opacity))
        ctx.drawImage(img, c.rect.x, c.rect.y, c.rect.w, c.rect.h)
        ctx.restore()
        break
      }
      case 'blurredRoundedRect':
        ctx.save()
        ctx.filter = `blur(${Math.max(0, c.stdDev)}px)`
        ctx.fillStyle = c.color
        roundRect(ctx, c.rect, c.radius)
        ctx.fill()
        ctx.restore()
        break
    }
  }
  while (depth-- > 0) ctx.restore()
  ctx.restore()
}
