// /app/new (plan 6.4): turn an idea into a good prompt fast, with smart,
// remembered defaults. Two interactions from N to a posted job: type, ⌘↵.
import { useLayoutEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronDown } from 'lucide-react'
import { ROUTES } from '@/app/nav'
import { Button } from '@/components/ui/button'
import { Kbd, Switch } from '@/components/ui/misc'
import { Tabs } from '@/components/ui/tabs'
import { formatWait } from '@/lib/api/http'
import { cn } from '@/lib/cn'
import { quotaLine } from '@/lib/entitlements'
import { useBrandKits } from '@/lib/local/hooks'
import { duration, ease } from '@/lib/motion'
import { useRenderWait } from '@/lib/quota'
import { useTitle } from '@/lib/useTitle'
import { charCount, PROMPT_MAX, promptError, sanitizeEngine, sanitizePrompt } from '@/lib/validation'
import { STARTERS } from './starters'
import { useCreatePrefs } from './createPrefs'
import {
  buildServerPrompt,
  enhancePrompt,
  LENGTHS,
  pickEngine,
  resolveLibrary,
  serverPromptError,
  STYLE_IDS,
  type Engine,
  type LengthId,
  type StyleId,
} from './prompt'
import { useStartVideo } from './useStartVideo'

const ENGINE_ITEMS: { value: Engine; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'manim', label: 'Explainer' },
  { value: 'remotion', label: 'Motion' },
]

const COUNTER_FROM = 1600

export default function CreatePage() {
  useTitle('New video')
  const [params] = useSearchParams()
  const prefs = useCreatePrefs()
  const [prompt, setPrompt] = useState(() => sanitizePrompt(params.get('prompt')))
  const [engine, setEngine] = useState<Engine>(() =>
    params.get('engine') ? sanitizeEngine(params.get('engine')) : prefs.engine,
  )
  const [touched, setTouched] = useState(false)
  const [undo, setUndo] = useState<string | null>(null)
  const [showSent, setShowSent] = useState(false)
  const box = useRef<HTMLTextAreaElement>(null)
  const { start, pending, error, clearError } = useStartVideo()
  const wait = useRenderWait()
  const kits = useBrandKits()
  const kit = kits.data?.[0] ?? null
  const useBrand = prefs.useBrand && Boolean(kit)
  const options = useMemo(
    () => ({ length: prefs.length, style: prefs.style, useBrand }),
    [prefs.length, prefs.style, useBrand],
  )

  // The textarea grows with its content between a floor and a ceiling.
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 120), 420)}px`
  }, [prompt])

  const library = resolveLibrary(engine, prompt)
  const auto = pickEngine(prompt)
  const serverPrompt = useMemo(() => buildServerPrompt(prompt, options, kit), [prompt, options, kit])
  const count = charCount(prompt)
  const localError = promptError(prompt.trim()) ?? serverPromptError(serverPrompt)
  const shownError = error ?? (touched ? localError : null)

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    setTouched(true)
    if (localError || pending || wait > 0) {
      box.current?.focus()
      return
    }
    prefs.set({ engine })
    void start(prompt, engine, options)
  }

  const engineHint =
    engine === 'auto' && prompt.trim()
      ? auto.reason
        ? `Picked Explainer because you mentioned “${auto.reason}”.`
        : 'Picked Motion: no maths or science words found.'
      : null

  return (
    <div className="mx-auto max-w-3xl px-4 pt-8 pb-24 sm:px-6 sm:pt-14">
      <h1 className="font-display text-4xl font-semibold tracking-tighter sm:text-5xl">
        What should we animate?
      </h1>

      <form onSubmit={submit} className="mt-8" aria-label="New video">
        <div className="rounded-2xl border border-line bg-surface-1 shadow-inner-highlight focus-within:border-line-strong">
          <label htmlFor="create-prompt" className="sr-only">
            Describe your video
          </label>
          <textarea
            ref={box}
            id="create-prompt"
            data-testid="create-prompt"
            autoFocus
            value={prompt}
            maxLength={PROMPT_MAX}
            placeholder="Show why the derivative of sin(x) is cos(x)"
            aria-invalid={shownError ? true : undefined}
            aria-describedby={shownError ? 'create-error' : undefined}
            onChange={(e) => {
              setPrompt(e.target.value)
              setUndo(null)
              if (error) clearError()
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                submit()
              }
            }}
            className="block w-full resize-none bg-transparent px-5 pt-5 pb-3 text-lg leading-8 text-fg placeholder:text-fg-faint focus:outline-none"
          />
          <div className="flex flex-wrap items-center gap-3 px-4 pb-4">
            {undo !== null ? (
              <button
                type="button"
                className="text-sm text-fg underline underline-offset-4 hover:text-accent"
                onClick={() => {
                  setPrompt(undo)
                  setUndo(null)
                }}
              >
                Undo tidy-up
              </button>
            ) : (
              <button
                type="button"
                data-testid="create-tidy"
                disabled={!prompt.trim()}
                className="text-sm text-fg-subtle underline-offset-4 hover:text-fg hover:underline disabled:opacity-40"
                onClick={() => {
                  const next = enhancePrompt(prompt, library, options)
                  if (next.trim() === prompt.trim()) return
                  setUndo(prompt)
                  setPrompt(next)
                }}
              >
                Tidy up my prompt
              </button>
            )}
            {count > COUNTER_FROM ? (
              <span
                className={cn(
                  'font-mono text-xs tabular-nums',
                  count > PROMPT_MAX ? 'text-status-failed' : 'text-fg-subtle',
                )}
                data-testid="create-counter"
              >
                {count}/{PROMPT_MAX}
              </span>
            ) : null}
            <span
              className="ml-auto hidden items-center gap-1 text-xs text-fg-subtle sm:inline-flex"
              aria-hidden
            >
              <Kbd>⌘</Kbd>
              <Kbd>↵</Kbd>
            </span>
            <Button type="submit" size="lg" loading={pending} disabled={wait > 0} data-testid="create-submit">
              {wait > 0 ? `Next render in ${formatWait(wait)}` : 'Generate'}
            </Button>
          </div>
        </div>
        <AnimatePresence initial={false}>
          {shownError ? (
            <motion.p
              id="create-error"
              role="alert"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: duration.fast }}
              className="mt-3 px-1 text-sm text-status-failed"
            >
              {shownError}
            </motion.p>
          ) : null}
        </AnimatePresence>
        <p className="mt-3 px-1 text-sm text-fg-subtle">{quotaLine()}</p>

        <div className="mt-10 grid gap-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm text-fg-muted">Engine</span>
            <div className="flex flex-col items-start gap-1.5 sm:items-end">
              <Tabs<Engine>
                label="Engine"
                value={engine}
                onChange={setEngine}
                items={ENGINE_ITEMS.map((i) => ({ value: i.value, label: i.label }))}
              />
              <span className="min-h-5 text-xs text-fg-subtle" data-testid="engine-hint">
                {engineHint ??
                  (engine === 'manim'
                    ? 'Manim: maths, science, algorithms, exact diagrams.'
                    : engine === 'remotion'
                      ? 'Remotion: titles, stats, product teasers, kinetic type.'
                      : 'Auto picks the engine from your words.')}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm text-fg-muted">Length</span>
            <Tabs<LengthId>
              label="Length"
              value={prefs.length}
              onChange={(length) => prefs.set({ length })}
              items={LENGTHS.map((l) => ({ value: l.id, label: `${l.label} ~${l.seconds} s` }))}
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm text-fg-muted">Style</span>
            <Tabs<StyleId>
              label="Style"
              value={prefs.style}
              onChange={(style) => prefs.set({ style })}
              items={STYLE_IDS.map((s) => ({ value: s, label: s }))}
            />
          </div>
          {kit ? (
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-fg-muted">Use my brand colours</span>
              <Switch
                label="Use my brand colours"
                checked={prefs.useBrand}
                onChange={(useBrand) => prefs.set({ useBrand })}
              />
            </div>
          ) : null}
        </div>

        <div className="mt-8 border-t border-line pt-4">
          <button
            type="button"
            onClick={() => setShowSent((v) => !v)}
            aria-expanded={showSent}
            className="flex w-full items-center gap-2 text-left text-sm text-fg-subtle hover:text-fg"
          >
            What we send
            <ChevronDown className={cn('ml-auto size-4 transition-transform', showSent && 'rotate-180')} />
          </button>
          <AnimatePresence initial={false}>
            {showSent ? (
              <motion.pre
                data-testid="create-sent-preview"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: duration.base, ease: ease.outExpo }}
                className="mt-3 overflow-hidden font-mono text-xs leading-relaxed break-words whitespace-pre-wrap text-fg-muted"
              >
                {`${serverPrompt}\n\nEngine: ${library}`}
              </motion.pre>
            ) : null}
          </AnimatePresence>
        </div>
      </form>

      <section aria-labelledby="starters-h" className="mt-14">
        <h2 id="starters-h" className="text-sm text-fg-muted">
          Or start from one of these
        </h2>
        <div className="no-scrollbar -mx-4 mt-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
          {STARTERS.map((s) => (
            <button
              key={s.id}
              type="button"
              data-testid="starter"
              onClick={() => {
                setPrompt(s.prompt)
                setEngine(s.library)
                setUndo(null)
                clearError()
                box.current?.focus()
              }}
              className="flex w-60 shrink-0 snap-start flex-col justify-start rounded-xl border border-line bg-surface-1 p-4 text-left shadow-inner-highlight transition-[transform,border-color,box-shadow] duration-[var(--duration-fast)] hover:-translate-y-px hover:border-line-strong hover:shadow-md"
            >
              <span className="text-xs text-fg-subtle">{s.library === 'manim' ? 'Explainer' : 'Motion'}</span>
              <span className="mt-1 block font-medium text-fg">{s.title}</span>
              <span className="mt-1.5 line-clamp-3 block text-sm text-fg-muted">{s.prompt}</span>
            </button>
          ))}
        </div>
      </section>

      <p className="mt-10 text-sm text-fg-subtle">
        Formats (vertical, square), titles and captions come after the render, in{' '}
        <Link to={ROUTES.videos} className="text-fg underline underline-offset-4">
          your video
        </Link>
        .
      </p>
    </div>
  )
}
