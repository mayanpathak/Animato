import { useRef } from 'react'
import { cn } from '@/lib/cn'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { container, SectionHeading } from '../components/SectionHeading'
import { EditVignette, ExportVignette, GenerateVignette, PromptVignette } from '../components/Vignettes'
import { gsap, useGSAP } from '../lib/gsap'

const STEPS = [
  {
    title: 'Prompt',
    body: 'Describe the scene in plain English. Pick Manim for math and algorithms, or Remotion for product, motion graphics and data viz.',
    Vignette: PromptVignette,
  },
  {
    title: 'Generate',
    body: 'Your prompt is planned and rendered on our servers. Follow it live from queued to planning, rendering, encoding and ready, with an ETA.',
    Vignette: GenerateVignette,
  },
  {
    title: 'Edit in your browser',
    body: 'Trim, split, re-time, add animated text, record a voiceover and caption it on-device. The editor runs locally, so it never waits on a server.',
    Vignette: EditVignette,
  },
  {
    title: 'Export locally',
    body: 'Encode MP4 or WebM with WebCodecs on your own machine, in 16:9, 9:16 or 1:1, with captions burned in if you want them.',
    Vignette: ExportVignette,
  },
]

const PIN_QUERY = '(prefers-reduced-motion: no-preference) and (min-width: 768px)'

function StepText({ index, className }: { index: number; className?: string }) {
  const step = STEPS[index]
  return (
    <div className={className}>
      <p className="font-mono text-xs text-accent">0{index + 1}</p>
      <h3 className="mt-1 font-display text-xl font-semibold tracking-tight text-fg">{step.title}</h3>
      <p className="mt-2 text-base text-fg-muted">{step.body}</p>
    </div>
  )
}

/** Small screens and reduced motion: a plain list, no pinning. */
function StackedSteps({ className }: { className?: string }) {
  return (
    <ol className={cn('mt-12 grid gap-12 md:grid-cols-2 md:gap-x-10 md:gap-y-16', className)}>
      {STEPS.map(({ title, Vignette }, i) => (
        <li key={title} data-reveal className="min-w-0">
          <StepText index={i} />
          <Vignette className="mt-5" />
        </li>
      ))}
    </ol>
  )
}

export function HowItWorks() {
  const ref = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()

  useGSAP(
    () => {
      if (reduced) return
      const mm = gsap.matchMedia()
      mm.add(PIN_QUERY, () => {
        const pin = ref.current?.querySelector<HTMLElement>('.hiw-pin')
        if (!pin) return
        const steps = gsap.utils.toArray<HTMLElement>('.hiw-step')
        const vigs = gsap.utils.toArray<HTMLElement>('.hiw-vig')
        gsap.set(steps.slice(1), { opacity: 0.35 })
        gsap.set(vigs.slice(1), { opacity: 0, y: 32 })
        const tl = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: {
            trigger: pin,
            start: 'top top',
            end: () => `+=${Math.round(window.innerHeight * 2.4)}`,
            pin: true,
            scrub: 0.6,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
        })
        tl.fromTo('.hiw-progress', { scaleY: 0 }, { scaleY: 1, duration: 3.4 }, 0)
        for (let i = 1; i < STEPS.length; i++) {
          const at = i - 0.3
          tl.to(vigs[i - 1], { opacity: 0, y: -32, duration: 0.5, ease: 'power2.in' }, at)
            .to(vigs[i], { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }, at + 0.25)
            .to(steps[i - 1], { opacity: 0.35, duration: 0.4 }, at)
            .to(steps[i], { opacity: 1, duration: 0.4 }, at + 0.2)
        }
        tl.to({}, { duration: 0.4 })
      })
      return () => mm.revert()
    },
    { scope: ref, dependencies: [reduced], revertOnUpdate: true },
  )

  const heading = (id?: string) => (
    <SectionHeading
      id={id}
      eyebrow="How it works"
      title="From a sentence to a finished cut."
      body="Rendering happens on our servers. Everything after that happens on your machine."
    />
  )

  return (
    <section ref={ref} aria-labelledby="how-title" className="relative">
      {reduced ? (
        <div className={cn(container, 'py-24 sm:py-32')}>
          {heading('how-title')}
          <StackedSteps />
        </div>
      ) : (
        <>
          <div className={cn(container, 'py-24 md:hidden')}>
            {heading('how-title')}
            <StackedSteps />
          </div>
          <div className="hiw-pin hidden min-h-[100dvh] items-center py-20 md:flex">
            <div className={container}>
              {heading('how-title-pinned')}
              <div className="mt-12 grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] items-center gap-10 lg:gap-16">
                <div className="relative pl-6">
                  <div className="absolute top-0 bottom-0 left-0 w-px bg-line-strong" aria-hidden>
                    <div className="hiw-progress h-full w-full origin-top bg-gradient-accent" />
                  </div>
                  <ol className="space-y-7">
                    {STEPS.map((s, i) => (
                      <li key={s.title} className="hiw-step">
                        <StepText index={i} />
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="relative h-[340px] lg:h-[360px]">
                  {STEPS.map(({ title, Vignette }) => (
                    <div key={title} className="hiw-vig absolute inset-x-0 top-1/2 -translate-y-1/2">
                      <Vignette />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
