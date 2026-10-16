import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, Check, Sparkles } from 'lucide-react'
import { buttonClass } from '@/components/ui/button'
import { UnderlineTabs } from '@/components/ui/tabs'
import { cn } from '@/lib/cn'
import { ease } from '@/lib/motion'
import { useSession } from '@/stores/session'
import { container, SectionHeading } from '../components/SectionHeading'
import { USE_CASES, type UseCaseId } from '../data'

export function UseCases() {
  const [value, setValue] = useState<UseCaseId>('educators')
  const user = useSession((s) => s.user)
  const uc = USE_CASES.find((u) => u.id === value) ?? USE_CASES[0]
  const tryHref = `${user ? '/app/create' : '/signup'}?prompt=${encodeURIComponent(uc.prompt)}`

  return (
    <section aria-labelledby="usecases-title" className="py-24 sm:py-32">
      <div className={container}>
        <SectionHeading
          id="usecases-title"
          eyebrow="Use cases"
          title="Built for people who explain things."
          body="Different jobs, same loop: describe it, render it, finish it in the browser."
        />
        <div data-reveal className="mx-auto mt-12 max-w-5xl">
          <UnderlineTabs
            label="Use cases"
            items={USE_CASES.map((u) => ({ value: u.id, label: u.label }))}
            value={value}
            onChange={setValue}
            className="justify-start sm:justify-center"
          />
          <div role="tabpanel" aria-label={uc.label} className="relative mt-10 min-h-[22rem]">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={uc.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.32, ease: ease.outExpo }}
                className="grid gap-8 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] md:gap-12"
              >
                <div className="min-w-0">
                  <h3 className="font-display text-2xl font-semibold tracking-tighter text-balance text-fg sm:text-3xl">
                    {uc.headline}
                  </h3>
                  <p className="mt-4 text-base text-fg-muted">{uc.body}</p>
                  <ul className="mt-6 space-y-2.5">
                    {uc.points.map((p) => (
                      <li key={p} className="flex gap-2.5 text-sm text-fg-muted">
                        <Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="min-w-0 rounded-2xl border border-line-strong bg-surface-1 p-5 shadow-md">
                  <p className="flex items-center gap-2 font-mono text-2xs tracking-widest text-fg-subtle uppercase">
                    <Sparkles className="size-3.5 text-accent" aria-hidden /> Example prompt
                  </p>
                  <p className="mt-3 text-base text-fg">“{uc.prompt}”</p>
                  <div className="mt-5 rounded-xl border border-line bg-surface-2/60 p-4">
                    <p className="text-xs text-fg-subtle">Best engine</p>
                    <p
                      className={cn(
                        'mt-1 font-display text-lg font-semibold',
                        uc.engine === 'Manim' ? 'text-status-rendering' : 'text-accent',
                      )}
                    >
                      {uc.engine}
                    </p>
                    <p className="mt-1 text-sm text-fg-muted">{uc.engineWhy}</p>
                  </div>
                  <Link to={tryHref} className={buttonClass('secondary', 'md', 'mt-5 w-full')}>
                    Try this prompt <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  )
}
