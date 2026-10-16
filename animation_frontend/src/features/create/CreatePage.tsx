import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type RefObject } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { AlertCircle, ChevronDown, Copy, LayoutTemplate, Lightbulb, Sparkles, Wand2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/misc'
import { ApiError, errorMessage } from '@/lib/api/http'
import { STYLES, type VisualStyle } from '@/lib/api/types'
import { cn } from '@/lib/cn'
import { useBrandKits, useCreateJob } from '@/lib/local/hooks'
import { ease } from '@/lib/motion'
import { useTitle } from '@/lib/useTitle'
import { charCount, PROMPT_MAX, PROMPT_MIN, promptError } from '@/lib/validation'
import { toast } from '@/stores/toast'
import { TEMPLATES } from '@/features/templates/data'
import { clearPendingPrompt } from '@/features/auth/pendingPrompt'
import { EngineSelector } from './EngineSelector'
import { EnhanceDialog } from './EnhanceDialog'
import { OptionsPanel } from './OptionsPanel'
import {
  buildServerPrompt,
  enhancePrompt,
  EXAMPLES,
  resolveLibrary,
  serverPromptError,
  type AspectOption,
  type Engine,
  type StudioOptions,
} from './prompt'

const ENGINES: Engine[] = ['auto', 'manim', 'remotion']
const ASPECTS: AspectOption[] = ['16:9', '9:16', '1:1']

function initialState(params: URLSearchParams) {
  const template = TEMPLATES.find((t) => t.id === params.get('template')) ?? null
  const engineParam = params.get('engine') as Engine | null
  const engine: Engine =
    engineParam && ENGINES.includes(engineParam) ? engineParam : (template?.library ?? 'auto')
  const style = (STYLES as readonly string[]).includes(template?.style ?? '')
    ? (template?.style as VisualStyle)
    : 'Cinematic'
  const options: StudioOptions = {
    aspect: template && ASPECTS.includes(template.aspect) ? template.aspect : '16:9',
    duration: template ? Math.min(60, Math.max(5, Math.round(template.duration))) : 20,
    style,
    captions: false,
  }
  const prompt = params.get('prompt') ?? template?.prompt ?? ''
  return { template, engine, options, prompt: prompt.slice(0, PROMPT_MAX) }
}

/** The textarea grows with its content between a floor and a ceiling. */
function useAutoGrow(ref: RefObject<HTMLTextAreaElement | null>, value: string) {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 168), Math.round(window.innerHeight * 0.55))}px`
  }, [ref, value])
}

export default function CreatePage() {
  useTitle('Prompt Studio')
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [init] = useState(() => initialState(params))
  const [prompt, setPrompt] = useState(init.prompt)
  const [engine, setEngine] = useState<Engine>(init.engine)
  const [options, setOptions] = useState<StudioOptions>(init.options)
  const [template, setTemplate] = useState(init.template)
  // undefined = not chosen yet: defaults to the newest kit that appends itself to prompts.
  const [kitChoice, setKitChoice] = useState<string | null | undefined>(undefined)
  const [touched, setTouched] = useState(false)
  const [showSent, setShowSent] = useState(false)
  const [enhanced, setEnhanced] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const textarea = useRef<HTMLTextAreaElement>(null)

  const kits = useBrandKits()
  const createJob = useCreateJob()
  useAutoGrow(textarea, prompt)

  // A prompt carried through signup has arrived.
  useEffect(() => clearPendingPrompt(), [])

  const kitList = useMemo(() => kits.data ?? [], [kits.data])
  const brandKitId =
    kitChoice !== undefined ? kitChoice : (kitList.find((k) => k.appendToPrompts)?.id ?? null)
  const kit = kitList.find((k) => k.id === brandKitId) ?? null

  const library = resolveLibrary(engine, prompt)
  const serverPrompt = useMemo(() => buildServerPrompt(prompt, options, kit), [prompt, options, kit])
  const count = charCount(prompt)
  const localError = promptError(prompt.trim()) ?? serverPromptError(serverPrompt)
  const shownError = touched ? localError : null

  const patchOptions = (patch: Partial<StudioOptions>) => setOptions((o) => ({ ...o, ...patch }))

  const submit = async (e?: FormEvent) => {
    e?.preventDefault()
    setTouched(true)
    setSubmitError(null)
    if (localError || createJob.isPending) {
      textarea.current?.focus()
      return
    }
    try {
      const job = await createJob.mutateAsync({
        prompt: prompt.trim(),
        library,
        serverPrompt,
        options: {
          aspect: options.aspect,
          duration: options.duration,
          style: options.style,
          brandKitId: kit?.id ?? null,
        },
      })
      navigate(`/app/jobs/${job.id}`)
    } catch (err) {
      const message = errorMessage(err)
      setSubmitError(
        err instanceof ApiError && err.status === 403
          ? `${message}. Verify your email to start rendering.`
          : message,
      )
    }
  }

  const openEnhance = () => {
    const next = enhancePrompt(prompt, library, options)
    if (next.trim() === prompt.trim()) {
      toast.info('Already specific', 'The local rewrite found nothing to add to this prompt.')
      return
    }
    setEnhanced(next)
  }

  const copySent = async () => {
    try {
      await navigator.clipboard.writeText(serverPrompt)
      toast.success('Copied the exact prompt')
    } catch {
      toast.error('Could not copy', 'Your browser blocked clipboard access.')
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-7">
        <p className="flex items-center gap-2 text-xs font-medium tracking-widest text-accent uppercase">
          <Sparkles className="size-3.5" /> Prompt Studio
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tighter sm:text-4xl">
          What should we animate?
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-fg-muted">
          Describe the scene, the motion and how it ends. Animato writes the code, renders it, and you can cut
          it into a project afterwards.
        </p>
      </header>

      <form
        onSubmit={(e) => void submit(e)}
        noValidate
        className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]"
      >
        <div className="min-w-0 space-y-6">
          <motion.div
            layoutId="job-hero"
            transition={{ duration: 0.5, ease: ease.outExpo }}
            className={cn(
              'relative overflow-hidden rounded-2xl border bg-surface-1 shadow-inner-highlight transition-[border-color,box-shadow] duration-200 focus-within:border-accent/50 focus-within:shadow-glow',
              shownError ? 'border-status-failed/50' : 'border-line-strong',
            )}
          >
            <AnimatePresence initial={false}>
              {template ? (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex items-center gap-2 border-b border-line bg-surface-2/60 px-4 py-2 text-xs text-fg-muted">
                    <LayoutTemplate className="size-3.5 text-accent" />
                    <span className="min-w-0 truncate">
                      From template <span className="font-medium text-fg">{template.title}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setTemplate(null)}
                      aria-label="Dismiss template label"
                      className="ml-auto rounded p-0.5 text-fg-faint hover:text-fg"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
            <label htmlFor="create-prompt" className="sr-only">
              Prompt
            </label>
            <textarea
              id="create-prompt"
              ref={textarea}
              data-testid="create-prompt"
              autoFocus
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value)
                setSubmitError(null)
              }}
              onBlur={() => prompt.trim() && setTouched(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  void submit()
                }
              }}
              placeholder="e.g. Show how a Fourier series builds a square wave: add one harmonic at a time, plot the partial sum on axes, and end on the formula."
              aria-invalid={shownError ? true : undefined}
              aria-describedby="create-prompt-meta"
              maxLength={PROMPT_MAX * 2}
              className="block min-h-42 w-full resize-none bg-transparent px-5 pt-5 pb-3 font-display text-lg leading-relaxed tracking-tight text-fg placeholder:text-fg-faint focus:outline-none sm:text-xl"
            />
            <div
              id="create-prompt-meta"
              className="flex flex-wrap items-center gap-2 border-t border-line bg-surface-2/40 px-3 py-2.5 sm:px-4"
            >
              <Button
                variant="ghost"
                size="sm"
                onClick={openEnhance}
                disabled={charCount(prompt.trim()) < 3}
                leftIcon={<Wand2 className="size-3.5" />}
                data-testid="create-enhance"
              >
                Enhance
                <span className="hidden rounded border border-line px-1 text-2xs text-fg-faint sm:inline">
                  Local rewrite
                </span>
              </Button>
              <span
                className={cn(
                  'ml-auto font-mono text-2xs tabular-nums',
                  count > PROMPT_MAX
                    ? 'text-status-failed'
                    : count < PROMPT_MIN
                      ? 'text-fg-faint'
                      : 'text-fg-subtle',
                )}
                aria-live="polite"
              >
                {count < PROMPT_MIN && count > 0 ? `${PROMPT_MIN - count} more to go · ` : ''}
                {count}/{PROMPT_MAX}
              </span>
              <span className="hidden items-center gap-1 text-2xs text-fg-faint md:inline-flex">
                <Kbd>⌘</Kbd>
                <Kbd>↵</Kbd>
              </span>
              <Button
                type="submit"
                loading={createJob.isPending}
                leftIcon={<Sparkles className="size-4" />}
                data-testid="create-submit"
              >
                Generate
              </Button>
            </div>
          </motion.div>

          <AnimatePresence initial={false}>
            {shownError || submitError ? (
              <motion.div
                key={submitError ?? shownError}
                role="alert"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="-mt-3 flex items-start gap-2 rounded-lg border border-status-failed/30 bg-status-failed/10 px-3 py-2.5 text-sm"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-status-failed" />
                <span>{submitError ?? shownError}</span>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <section aria-labelledby="examples-h">
            <h2
              id="examples-h"
              className="mb-2.5 flex items-center gap-1.5 text-xs font-medium text-fg-subtle"
            >
              <Lightbulb className="size-3.5" /> Try an example
            </h2>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex.label}
                  type="button"
                  onClick={() => {
                    setPrompt(ex.prompt)
                    setTemplate(null)
                    setSubmitError(null)
                    textarea.current?.focus()
                  }}
                  className="group inline-flex h-8 items-center gap-2 rounded-full border border-line bg-surface-1 pr-3 pl-1.5 text-xs text-fg-muted transition-colors hover:border-line-strong hover:text-fg"
                >
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 font-mono text-[10px] tracking-wide uppercase',
                      ex.engine === 'manim'
                        ? 'bg-status-planning/10 text-status-planning'
                        : 'bg-status-rendering/10 text-status-rendering',
                    )}
                  >
                    {ex.engine === 'manim' ? 'Manim' : 'Remotion'}
                  </span>
                  {ex.label}
                </button>
              ))}
              <Link
                to="/app/templates"
                className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs text-accent hover:text-fg"
              >
                <LayoutTemplate className="size-3.5" /> Browse templates
              </Link>
            </div>
          </section>

          <section aria-labelledby="engine-h">
            <h2 id="engine-h" className="mb-2.5 text-xs font-medium text-fg-subtle">
              Render engine
            </h2>
            <EngineSelector value={engine} onChange={setEngine} prompt={prompt} />
          </section>

          <section
            data-testid="create-sent-preview"
            className="rounded-xl border border-line bg-surface-1/60"
          >
            <button
              type="button"
              onClick={() => setShowSent((v) => !v)}
              aria-expanded={showSent}
              aria-controls="create-sent-body"
              className="flex w-full items-center gap-2 rounded-xl px-4 py-3 text-left text-sm"
            >
              <span className="font-medium text-fg">What gets sent</span>
              <span className="hidden text-xs text-fg-subtle sm:inline">
                — the server takes only a prompt and an engine, so your options are written into the text.
              </span>
              <ChevronDown
                className={cn(
                  'ml-auto size-4 shrink-0 text-fg-subtle transition-transform duration-200',
                  showSent && 'rotate-180',
                )}
              />
            </button>
            <motion.div
              id="create-sent-body"
              initial={false}
              animate={{ height: showSent ? 'auto' : 0, opacity: showSent ? 1 : 0 }}
              transition={{ duration: 0.28, ease: ease.outExpo }}
              className="overflow-hidden"
              inert={!showSent}
            >
              <div className="border-t border-line px-4 pt-3 pb-4">
                <div className="mb-2 flex items-center gap-2 text-2xs text-fg-subtle">
                  <span className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono">
                    POST /api/jobs
                  </span>
                  <span className="font-mono">library: {library}</span>
                  <span
                    className={cn(
                      'ml-auto font-mono tabular-nums',
                      charCount(serverPrompt) > PROMPT_MAX ? 'text-status-failed' : 'text-fg-faint',
                    )}
                  >
                    {charCount(serverPrompt)}/{PROMPT_MAX}
                  </span>
                  <button
                    type="button"
                    onClick={() => void copySent()}
                    aria-label="Copy the exact prompt"
                    className="rounded p-1 text-fg-subtle hover:bg-surface-3 hover:text-fg"
                  >
                    <Copy className="size-3.5" />
                  </button>
                </div>
                <pre className="max-h-64 overflow-auto rounded-lg border border-line bg-canvas/60 p-3 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap text-fg-muted">
                  {serverPrompt}
                </pre>
              </div>
            </motion.div>
          </section>
        </div>

        <aside className="min-w-0 lg:sticky lg:top-20 lg:self-start">
          <OptionsPanel
            options={options}
            onChange={patchOptions}
            kits={kitList}
            kitsLoading={kits.isPending}
            brandKitId={brandKitId}
            onBrandKit={(id) => setKitChoice(id)}
          />
          <p className="mt-3 px-1 text-2xs leading-relaxed text-fg-faint">
            Each account can start 5 renders an hour and 15 a day. Finished videos open straight into the
            editor.
          </p>
        </aside>
      </form>

      <EnhanceDialog
        open={enhanced !== null}
        before={prompt}
        after={enhanced ?? ''}
        onClose={() => setEnhanced(null)}
        onAccept={() => {
          if (enhanced) setPrompt(enhanced)
          setEnhanced(null)
          toast.success('Rewrite applied', 'Edit it freely before you generate.')
        }}
      />
    </div>
  )
}
