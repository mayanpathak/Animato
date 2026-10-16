import type { PointerEvent } from 'react'
import { cn } from '@/lib/cn'
import { container, SectionHeading } from '../components/SectionHeading'
import { FEATURES } from '../data'

function trackPointer(e: PointerEvent<HTMLElement>) {
  const r = e.currentTarget.getBoundingClientRect()
  e.currentTarget.style.setProperty('--x', `${e.clientX - r.left}px`)
  e.currentTarget.style.setProperty('--y', `${e.clientY - r.top}px`)
}

export function Features() {
  return (
    <section id="features" aria-labelledby="features-title" className="scroll-mt-20 py-24 sm:py-32">
      <div className={container}>
        <SectionHeading
          id="features-title"
          eyebrow="Features"
          title="Generate on our servers. Finish on your machine."
          body="Two rendering engines for the first draft, and a complete editor for everything after it."
        />
        <ul className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }, i) => (
            <li
              key={title}
              data-reveal
              onPointerMove={trackPointer}
              className={cn(
                'group relative bg-canvas p-6 transition-colors duration-300 hover:bg-surface-1 sm:p-7',
                i === FEATURES.length - 1 && 'sm:col-span-2',
              )}
            >
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{
                  background:
                    'radial-gradient(280px circle at var(--x, 50%) var(--y, 50%), var(--color-accent-soft), transparent 70%)',
                }}
              />
              <div className="relative">
                <span className="grid size-10 place-items-center rounded-xl border border-line-strong bg-surface-2 text-accent shadow-inner-highlight transition-shadow duration-300 group-hover:shadow-glow">
                  <Icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-5 font-display text-base font-semibold tracking-tight text-fg">{title}</h3>
                <p className="mt-1.5 text-sm text-fg-muted">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
