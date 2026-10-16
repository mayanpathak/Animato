import { useRef } from 'react'
import { cn } from '@/lib/cn'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { container } from '../components/SectionHeading'
import { gsap, MEDIA, useGSAP } from '../lib/gsap'

const CUSTOMERS = [
  'Northwind',
  'Lumen Labs',
  'Orbital',
  'Paperplane',
  'Halcyon',
  'Vantage',
  'Meridian',
  'Foldline',
]

// Distinct type treatments so placeholder wordmarks read as different brands.
const STYLES = [
  'font-display font-semibold tracking-tight',
  'font-sans font-medium tracking-widest uppercase text-sm',
  'font-display font-bold italic tracking-tighter',
  'font-mono font-medium tracking-tight',
  'font-display font-light tracking-wide',
  'font-sans font-semibold tracking-tightest',
  'font-display font-medium tracking-widest uppercase text-sm',
  'font-mono font-semibold tracking-tighter',
]

interface Counter {
  value: number
  decimals: number
  suffix: string
  label: string
}

const COUNTERS: Counter[] = [
  { value: 2.4, decimals: 1, suffix: 'M', label: 'renders generated' },
  { value: 0, decimals: 0, suffix: ' bytes', label: 'uploaded to edit' },
  { value: 60, decimals: 0, suffix: ' fps', label: 'timeline preview' },
  { value: 4, decimals: 0, suffix: 'K', label: 'local export, where supported' },
]

const format = (c: Counter, v: number) => `${v.toFixed(c.decimals)}${c.suffix}`

function Wordmarks({ hidden }: { hidden?: boolean }) {
  return (
    <ul
      className="flex shrink-0 items-center gap-14 pr-14 sm:gap-20 sm:pr-20"
      aria-hidden={hidden || undefined}
    >
      {CUSTOMERS.map((name, i) => (
        <li key={name} className={cn('text-xl whitespace-nowrap text-fg-subtle', STYLES[i % STYLES.length])}>
          {name}
        </li>
      ))}
    </ul>
  )
}

export function LogoStrip() {
  const ref = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()

  useGSAP(
    () => {
      if (reduced) return
      const mm = gsap.matchMedia()
      mm.add(MEDIA.motion, () => {
        gsap.utils.toArray<HTMLElement>('[data-counter]').forEach((el, i) => {
          const c = COUNTERS[i]
          const state = { v: 0 }
          el.textContent = format(c, 0)
          gsap.to(state, {
            v: c.value,
            duration: 1.8,
            ease: 'expo.out',
            scrollTrigger: { trigger: el, start: 'top 92%', once: true },
            onUpdate: () => {
              el.textContent = format(c, state.v)
            },
          })
        })
        return () => {
          gsap.utils.toArray<HTMLElement>('[data-counter]').forEach((el, i) => {
            el.textContent = format(COUNTERS[i], COUNTERS[i].value)
          })
        }
      })
      return () => mm.revert()
    },
    { scope: ref, dependencies: [reduced], revertOnUpdate: true },
  )

  return (
    <section ref={ref} aria-labelledby="trusted-title" className="border-y border-line bg-surface-1/40 py-12">
      <h2 id="trusted-title" className="text-center text-xs font-medium tracking-wide text-fg-subtle">
        Teams who explain things for a living animate with Animato
      </h2>
      <div className="group relative mt-8 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
        <div className="flex w-max animate-marquee group-hover:[animation-play-state:paused]">
          <Wordmarks />
          <Wordmarks hidden />
        </div>
      </div>
      <dl className={cn(container, 'mt-12 grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-4')}>
        {COUNTERS.map((c) => (
          <div key={c.label} className="flex flex-col text-center">
            <dt className="order-2 mt-1 text-sm text-fg-muted">{c.label}</dt>
            <dd
              data-counter
              className="order-1 font-display text-3xl font-semibold tracking-tighter text-fg tabular-nums sm:text-4xl"
            >
              {format(c, c.value)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
