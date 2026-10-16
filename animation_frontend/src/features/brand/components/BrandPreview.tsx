import type { CSSProperties } from 'react'
import type { BrandKit } from '@/lib/local/models'
import { fontCss, fontLabel } from '../lib'

function mix(color: string, pct: number): string {
  return `color-mix(in oklab, ${color} ${pct}%, transparent)`
}

/**
 * A style preview of the kit: a 16:9 mock frame with a title, subtitle,
 * caption bar and logo, drawn with the kit's fonts and colours. Not a video.
 */
export function BrandPreview({ kit }: { kit: BrandKit }) {
  const [primary = '#8b5cf6', secondary = primary, accent = secondary] = kit.colors
  const heading = fontCss(kit.headingFont)
  const body = fontCss(kit.bodyFont)
  const frame: CSSProperties = {
    containerType: 'inline-size',
    background: [
      `radial-gradient(60% 80% at 85% 10%, ${mix(primary, 45)}, transparent 70%)`,
      `radial-gradient(50% 70% at 10% 100%, ${mix(secondary, 32)}, transparent 70%)`,
      'var(--color-canvas)',
    ].join(', '),
  }

  return (
    <figure className="m-0">
      <div
        className="relative aspect-video w-full overflow-hidden rounded-xl border border-line-strong shadow-lg"
        style={frame}
        role="img"
        aria-label={`Style preview for ${kit.name}: title in ${fontLabel(kit.headingFont)}, body in ${fontLabel(kit.bodyFont)}`}
      >
        <div className="absolute inset-0 grid-bg opacity-30 [mask-image:linear-gradient(to_bottom,black,transparent)]" />

        <div className="absolute top-[6cqw] right-[6cqw] left-[6cqw] flex items-center justify-between">
          {kit.logoDataUrl ? (
            <img src={kit.logoDataUrl} alt="" className="h-[5cqw] max-w-[24cqw] object-contain object-left" />
          ) : (
            <span
              className="leading-none font-semibold text-white/90"
              style={{ fontFamily: heading, fontSize: '2.6cqw' }}
            >
              {kit.name}
            </span>
          )}
          <span
            className="rounded-full px-[1.4cqw] py-[0.6cqw] leading-none font-medium text-white"
            style={{
              fontFamily: body,
              fontSize: '1.6cqw',
              background: mix(accent, 30),
              border: `1px solid ${mix(accent, 60)}`,
            }}
          >
            Episode 04
          </span>
        </div>

        <div className="absolute top-[26%] left-[6cqw] max-w-[66cqw]">
          <p
            className="leading-snug font-semibold tracking-widest uppercase"
            style={{ fontFamily: body, fontSize: '1.7cqw', color: accent }}
          >
            Explainer
          </p>
          <h3
            className="mt-[1cqw] leading-[1.05] font-semibold text-white"
            style={{ fontFamily: heading, fontSize: '5.6cqw', letterSpacing: '-0.025em' }}
          >
            How light becomes motion
          </h3>
          <div
            className="mt-[1.6cqw] h-[0.55cqw] w-[16cqw] rounded-full"
            style={{ background: `linear-gradient(90deg, ${primary}, ${secondary})` }}
          />
          <p
            className="mt-[1.6cqw] leading-snug text-white/70"
            style={{ fontFamily: body, fontSize: '2.3cqw' }}
          >
            A subtitle set in {fontLabel(kit.bodyFont)}, the way your overlays will read.
          </p>
        </div>

        <div className="absolute inset-x-0 bottom-[4cqw] flex justify-center px-[6cqw]">
          <span
            className="rounded-[0.8cqw] bg-black/70 px-[1.8cqw] py-[0.8cqw] text-center leading-snug text-white"
            style={{ fontFamily: body, fontSize: '2.4cqw' }}
          >
            Captions pick up your <span style={{ color: primary }}>primary colour</span> for emphasis
          </span>
        </div>
      </div>

      <figcaption className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex -space-x-1">
          {kit.colors.map((c, i) => (
            <span
              key={`${c}-${i}`}
              className="size-5 rounded-full border-2 border-canvas"
              style={{ background: c }}
              title={c}
            />
          ))}
        </div>
        <span className="text-xs text-fg-subtle">
          <span style={{ fontFamily: heading }} className="text-fg">
            Aa
          </span>{' '}
          {fontLabel(kit.headingFont)} ·{' '}
          <span style={{ fontFamily: body }} className="text-fg">
            Aa
          </span>{' '}
          {fontLabel(kit.bodyFont)}
        </span>
        <span className="ml-auto text-2xs text-fg-subtle">Style preview, not a render</span>
      </figcaption>
    </figure>
  )
}
