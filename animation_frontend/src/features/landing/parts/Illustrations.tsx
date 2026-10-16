// Product illustrations drawn in the page (SVG and CSS). They show how the
// product works; they are not Animato renders and are labelled as such. Real
// renders replace them through SITE_MEDIA once they exist.
import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'
import { spring } from '@/lib/motion'
import { useReducedMotion } from '@/lib/useReducedMotion'

type Format = '16:9' | '9:16' | '1:1'
const SIZE: Record<Format, { w: number; h: number }> = {
  '16:9': { w: 480, h: 270 },
  '9:16': { w: 186, h: 330 },
  '1:1': { w: 300, h: 300 },
}
const CAPTION = ['the', 'slope', 'of', 'sine', 'is', 'cosine']

/** A sine curve with a sliding tangent: the kind of scene the explainer engine draws. */
function SineScene({ reduced }: { reduced: boolean }) {
  return (
    <svg
      viewBox="0 0 400 240"
      preserveAspectRatio="xMidYMid meet"
      className="absolute inset-0 size-full"
      aria-hidden
    >
      <line x1="20" y1="120" x2="380" y2="120" stroke="var(--color-line-strong)" strokeWidth="1" />
      <line x1="40" y1="30" x2="40" y2="210" stroke="var(--color-line-strong)" strokeWidth="1" />
      <path
        d="M40 120 C 80 40, 120 40, 160 120 S 240 200, 280 120 S 340 40, 380 80"
        fill="none"
        stroke="var(--color-fg)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <motion.g
        initial={false}
        animate={reduced ? { x: 0 } : { x: [0, 120, 240, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
      >
        <circle cx="100" cy="60" r="5" fill="var(--color-accent)" />
        <line x1="60" y1="60" x2="140" y2="60" stroke="var(--color-accent)" strokeWidth="2" />
      </motion.g>
    </svg>
  )
}

/** One scene re-laid out for 16:9, 9:16 and 1:1, with a title and captions. */
export function FormatIllustration() {
  const reduced = useReducedMotion()
  const formats: Format[] = ['16:9', '9:16', '1:1']
  const [i, setI] = useState(0)
  const [word, setWord] = useState(1)
  useEffect(() => {
    if (reduced) return
    const t = window.setInterval(() => setI((n) => (n + 1) % formats.length), 3200)
    const w = window.setInterval(() => setWord((n) => (n + 1) % CAPTION.length), 450)
    return () => {
      window.clearInterval(t)
      window.clearInterval(w)
    }
  }, [reduced, formats.length])
  const format = formats[i]
  const { w, h } = SIZE[format]
  const vertical = format === '9:16'
  return (
    <figure className="flex flex-col items-center">
      <div className="grid h-[340px] w-full place-items-center">
        <motion.div
          layout
          transition={spring.morph}
          style={{ width: w, height: h, maxWidth: '100%' }}
          className="relative overflow-hidden rounded-xl bg-surface-1 shadow-lg ring-1 ring-line"
        >
          <motion.p
            layout="position"
            className={cn(
              'absolute inset-x-0 z-10 px-4 text-center font-display font-semibold tracking-tight text-fg',
              vertical ? 'top-8 text-lg' : 'top-4 text-base',
            )}
          >
            Why sin′ = cos
          </motion.p>
          <motion.div
            layout
            className={cn('absolute inset-x-0', vertical ? 'top-[30%] h-[36%]' : 'top-[16%] bottom-[22%]')}
          >
            <SineScene reduced={reduced} />
          </motion.div>
          <motion.p
            layout="position"
            className={cn(
              'absolute inset-x-0 z-10 px-3 text-center text-sm font-medium',
              vertical ? 'bottom-[24%]' : 'bottom-3',
            )}
          >
            {CAPTION.map((t, n) => (
              <span key={t + n} className={n === word ? 'text-accent' : 'text-fg'}>
                {t}{' '}
              </span>
            ))}
          </motion.p>
        </motion.div>
      </div>
      <figcaption className="mt-4 flex gap-1.5" aria-label="Formats">
        {formats.map((f, n) => (
          <span
            key={f}
            className={cn(
              'rounded-full px-2.5 py-1 font-mono text-xs transition-colors',
              n === i ? 'bg-surface-3 text-fg' : 'text-fg-subtle',
            )}
          >
            {f}
          </span>
        ))}
      </figcaption>
    </figure>
  )
}

/** The render view's stage list, as the user sees it while waiting. */
export function StagesIllustration() {
  const stages = ['Queued', 'Writing the animation', 'Rendering frames', 'Finishing']
  return (
    <ol className="space-y-1 text-sm" aria-hidden>
      {stages.map((s, n) => (
        <li
          key={s}
          className={cn('flex items-center gap-2.5 rounded-control px-3 py-2', n === 2 && 'bg-surface-2')}
        >
          <span
            className={cn(
              'grid size-4 place-items-center rounded-full border',
              n < 2
                ? 'border-transparent bg-accent-fill text-white'
                : n === 2
                  ? 'border-accent'
                  : 'border-line-strong',
            )}
          >
            {n < 2 ? <Check className="size-2.5" strokeWidth={3} /> : null}
          </span>
          <span className={n > 2 ? 'text-fg-subtle' : 'text-fg'}>{s}</span>
        </li>
      ))}
    </ol>
  )
}

/** A caption line with the active word highlighted. */
export function CaptionIllustration() {
  const reduced = useReducedMotion()
  const words = ['Captions', 'are', 'made', 'on', 'your', 'device']
  const [word, setWord] = useState(0)
  useEffect(() => {
    if (reduced) return
    const t = window.setInterval(() => setWord((n) => (n + 1) % words.length), 420)
    return () => window.clearInterval(t)
  }, [reduced, words.length])
  return (
    <div
      className="grid aspect-video place-items-center rounded-xl bg-surface-1 ring-1 ring-line"
      aria-hidden
    >
      <div className="flex items-end gap-1">
        {Array.from({ length: 28 }, (_, n) => (
          <span
            key={n}
            className="w-1 rounded-full bg-fg-subtle"
            style={{ height: 6 + Math.round(Math.abs(Math.sin(n * 1.7)) * 26) }}
          />
        ))}
      </div>
      <p className="-mt-10 text-lg font-semibold">
        {words.map((w, n) => (
          <span key={w} className={n === word ? 'text-accent' : 'text-fg'}>
            {w}{' '}
          </span>
        ))}
      </p>
    </div>
  )
}
