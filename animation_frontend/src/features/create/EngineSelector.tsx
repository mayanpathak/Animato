import { useId, useRef, type KeyboardEvent } from 'react'
import { motion } from 'motion/react'
import { Clapperboard, Sigma, Wand2, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import { spring } from '@/lib/motion'
import type { Library } from '@/lib/api/types'
import { pickEngine, type Engine } from './prompt'

const ENGINES: { value: Engine; title: string; body: string; icon: LucideIcon }[] = [
  { value: 'auto', title: 'Auto', body: 'Reads your prompt and picks the right renderer.', icon: Wand2 },
  { value: 'manim', title: 'Manim', body: 'Maths, physics, algorithms and precise diagrams.', icon: Sigma },
  {
    value: 'remotion',
    title: 'Remotion',
    body: 'Motion graphics, typography, product and social.',
    icon: Clapperboard,
  },
]

const NAME: Record<Library, string> = { manim: 'Manim', remotion: 'Remotion' }

export function EngineSelector({
  value,
  onChange,
  prompt,
}: {
  value: Engine
  onChange: (e: Engine) => void
  prompt: string
}) {
  const id = useId()
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const auto = pickEngine(prompt)

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = ENGINES.findIndex((x) => x.value === value)
    let next = -1
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % ENGINES.length
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + ENGINES.length) % ENGINES.length
    if (next < 0) return
    e.preventDefault()
    onChange(ENGINES[next].value)
    refs.current[next]?.focus()
  }

  return (
    <div>
      <div
        role="radiogroup"
        aria-label="Render engine"
        onKeyDown={onKey}
        className="grid gap-2 sm:grid-cols-3"
      >
        {ENGINES.map((engine, index) => {
          const active = engine.value === value
          const Icon = engine.icon
          return (
            <button
              key={engine.value}
              ref={(el) => {
                refs.current[index] = el
              }}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={active ? 0 : -1}
              data-testid={`create-engine-${engine.value}`}
              onClick={() => onChange(engine.value)}
              className={cn(
                'relative flex items-start gap-3 rounded-xl border p-3 text-left transition-colors duration-150',
                active
                  ? 'border-transparent'
                  : 'border-line bg-surface-1 hover:border-line-strong hover:bg-surface-2',
              )}
            >
              {active ? (
                <motion.span
                  layoutId={`engine-${id}`}
                  transition={spring.layout}
                  className="absolute inset-0 rounded-xl border border-accent/40 bg-accent-soft shadow-[0_0_0_1px_var(--color-accent-ring)_inset]"
                />
              ) : null}
              <span
                className={cn(
                  'relative grid size-8 shrink-0 place-items-center rounded-lg border',
                  active
                    ? 'border-accent/30 bg-surface-2 text-accent'
                    : 'border-line bg-surface-2 text-fg-subtle',
                )}
              >
                <Icon className="size-4" />
              </span>
              <span className="relative min-w-0">
                <span className="block text-sm font-medium text-fg">{engine.title}</span>
                <span className="mt-0.5 block text-xs leading-snug text-fg-subtle">{engine.body}</span>
              </span>
            </button>
          )
        })}
      </div>
      <p className="mt-2 min-h-5 text-xs text-fg-subtle" aria-live="polite">
        {value === 'auto' ? (
          <>
            Auto picked <span className="font-medium text-fg">{NAME[auto.library]}</span>
            {auto.reason ? (
              <>
                {' '}
                because your prompt mentions <span className="font-mono text-accent">“{auto.reason}”</span>.
              </>
            ) : (
              ' — no maths or science terms found.'
            )}
          </>
        ) : value === 'manim' ? (
          'Manim renders vector scenes from Python: best when accuracy matters more than flair.'
        ) : (
          'Remotion renders React compositions: best for typography, brand and social formats.'
        )}
      </p>
    </div>
  )
}
