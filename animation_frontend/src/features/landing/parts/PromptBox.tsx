// The landing hero's prompt box (plan 6.1): the product's front door.
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { PROMPT_MAX, promptError } from '@/lib/validation'
import type { Engine } from '@/features/create/prompt'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { HERO_CHIPS, HERO_PROMPTS } from '../content'
import { useLandingGenerate } from './useLandingGenerate'

const ENGINE_LABEL: Record<Engine, string> = { auto: 'Auto', manim: 'Explainer', remotion: 'Motion' }
const ORDER: Engine[] = ['auto', 'manim', 'remotion']

export function PromptBox({
  initialPrompt = '',
  initialEngine = 'auto',
  chips = false,
  testId = 'hero-prompt',
}: {
  initialPrompt?: string
  initialEngine?: Engine
  chips?: boolean
  testId?: string
}) {
  const [prompt, setPrompt] = useState(initialPrompt)
  const [engine, setEngine] = useState<Engine>(initialEngine)
  const [focused, setFocused] = useState(false)
  const [hint, setHint] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const reduced = useReducedMotion()
  const box = useRef<HTMLTextAreaElement>(null)
  const generate = useLandingGenerate()

  // The placeholder cycles through real examples every 4 s and stops on focus.
  useEffect(() => {
    if (focused || prompt || reduced) return
    const t = window.setInterval(() => setHint((h) => (h + 1) % HERO_PROMPTS.length), 4000)
    return () => window.clearInterval(t)
  }, [focused, prompt, reduced])

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    const text = prompt.trim()
    const problem = promptError(text)
    if (problem) {
      setError(text ? problem : 'Describe your idea first.')
      box.current?.focus()
      return
    }
    generate(text, engine)
  }

  return (
    <div className="w-full">
      <form onSubmit={submit} aria-label="Describe your video" data-testid={testId}>
        <div
          className={cn(
            'rounded-2xl border bg-surface-1 shadow-lg shadow-inner-highlight transition-[border-color] duration-[var(--duration-base)]',
            focused ? 'border-line-strong' : 'border-line',
          )}
        >
          <label htmlFor={`${testId}-input`} className="sr-only">
            Describe your video
          </label>
          <textarea
            ref={box}
            id={`${testId}-input`}
            data-testid={`${testId}-input`}
            rows={2}
            value={prompt}
            maxLength={PROMPT_MAX}
            placeholder={HERO_PROMPTS[hint]}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onChange={(e) => {
              setPrompt(e.target.value)
              setError(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit()
              }
            }}
            className="block w-full resize-none bg-transparent px-5 pt-4 text-[17px] leading-7 text-fg placeholder:text-fg-subtle focus:outline-none sm:text-lg"
          />
          <div className="flex items-center gap-2 px-3 pt-1 pb-3">
            <button
              type="button"
              aria-label={`Engine: ${ENGINE_LABEL[engine]}. Change engine`}
              onClick={() => setEngine(ORDER[(ORDER.indexOf(engine) + 1) % ORDER.length])}
              className="h-9 rounded-full bg-surface-2 px-3.5 text-sm text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg"
            >
              {ENGINE_LABEL[engine]}
            </button>
            <Button
              type="submit"
              size="lg"
              className="ml-auto rounded-full"
              rightIcon={<ArrowUp />}
              data-testid={`${testId}-generate`}
            >
              Generate
            </Button>
          </div>
        </div>
        {error ? (
          <p role="alert" className="mt-2 px-1 text-sm text-status-failed">
            {error}
          </p>
        ) : null}
      </form>
      {chips ? (
        <div className="mt-4 flex flex-wrap gap-2" aria-label="Try an example">
          {HERO_CHIPS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setPrompt(s.prompt)
                setEngine(s.library)
                setError(null)
                box.current?.focus()
              }}
              className="h-9 rounded-full border border-line px-3.5 text-sm text-fg-muted transition-colors hover:border-line-strong hover:text-fg"
            >
              {s.title}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
