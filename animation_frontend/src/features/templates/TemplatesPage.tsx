import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, LayoutGroup, motion } from 'motion/react'
import { ArrowRight, Check, Clock, Copy, Play, Search, X } from 'lucide-react'
import { Button, IconButton } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Badge, EmptyState, Kbd } from '@/components/ui/misc'
import { cn } from '@/lib/cn'
import { spring } from '@/lib/motion'
import { useTitle } from '@/lib/useTitle'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { toast } from '@/stores/toast'
import { TEMPLATES, type Template } from './data'

const ALL = 'All'

const ENGINE = {
  manim: { label: 'Manim', hint: 'Math, diagrams and precise geometry' },
  remotion: { label: 'Remotion', hint: 'Motion graphics, type and UI' },
} as const

function art(t: Template): string {
  const a = t.library === 'manim' ? '--color-accent-violet' : '--color-accent-cyan'
  const b = t.library === 'manim' ? '--color-accent-cyan' : '--color-accent-magenta'
  return [
    `radial-gradient(70% 90% at 15% 10%, color-mix(in oklab, var(${a}) 40%, transparent), transparent 70%)`,
    `radial-gradient(60% 80% at 90% 100%, color-mix(in oklab, var(${b}) 30%, transparent), transparent 70%)`,
    'linear-gradient(160deg, var(--color-surface-2), var(--color-canvas))',
  ].join(', ')
}

export default function TemplatesPage() {
  useTitle('Templates')
  const [category, setCategory] = useState(ALL)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<Template | null>(null)
  const reduced = useReducedMotion()

  const categories = useMemo(() => [ALL, ...new Set(TEMPLATES.map((t) => t.category))], [])
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return TEMPLATES.filter((t) => {
      if (category !== ALL && t.category !== category) return false
      if (!q) return true
      return [t.title, t.description, t.category, t.style, t.prompt, t.library].some((s) =>
        s.toLowerCase().includes(q),
      )
    })
  }, [category, query])

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold tracking-tight">Templates</h1>
          <p className="mt-1 max-w-xl text-sm text-fg-muted">
            Proven prompts to start from. Pick one, tweak the words in Prompt Studio, and render your own
            version.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search templates"
            aria-label="Search templates"
            className="h-9 w-full rounded-md border border-line-strong bg-surface-1 pr-9 pl-9 text-sm text-fg shadow-inner-highlight transition-[border-color,box-shadow] placeholder:text-fg-faint hover:border-fg-faint/60 focus:border-accent focus:ring-3 focus:ring-accent-soft focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {query ? (
            <IconButton
              label="Clear search"
              size="xs"
              className="absolute top-1/2 right-1.5 -translate-y-1/2"
              onClick={() => setQuery('')}
            >
              <X />
            </IconButton>
          ) : null}
        </div>
      </header>

      <div
        role="group"
        aria-label="Categories"
        className="-mx-4 mt-6 flex gap-1 overflow-x-auto px-4 pb-1 no-scrollbar sm:mx-0 sm:flex-wrap sm:px-0"
      >
        {categories.map((c) => {
          const active = c === category
          const count = c === ALL ? TEMPLATES.length : TEMPLATES.filter((t) => t.category === c).length
          return (
            <button
              key={c}
              type="button"
              aria-pressed={active}
              onClick={() => setCategory(c)}
              className={cn(
                'relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors',
                active ? 'text-fg' : 'text-fg-subtle hover:text-fg-muted',
              )}
            >
              {active ? (
                <motion.span
                  layoutId="template-category"
                  transition={reduced ? { duration: 0 } : spring.layout}
                  className="absolute inset-0 rounded-full border border-line-strong bg-surface-3 shadow-inner-highlight"
                />
              ) : null}
              <span className="relative">{c}</span>
              <span className="relative font-mono text-2xs text-fg-subtle">{count}</span>
            </button>
          )
        })}
      </div>

      <p className="sr-only" aria-live="polite">
        {visible.length} templates shown
      </p>

      <LayoutGroup>
        {visible.length === 0 ? (
          <EmptyState
            className="mt-6"
            icon={<Search />}
            title="No templates match"
            body="Try a broader word, or describe exactly what you want in Prompt Studio."
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setQuery('')
                  setCategory(ALL)
                }}
              >
                Show all templates
              </Button>
            }
          />
        ) : (
          <motion.ul layout={!reduced} className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout" initial={false}>
              {visible.map((t) => (
                <motion.li
                  key={t.id}
                  layout={reduced ? false : 'position'}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={reduced ? { duration: 0 } : spring.layout}
                  className="min-w-0"
                >
                  <TemplateCard template={t} onOpen={() => setOpen(t)} reduced={reduced} />
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>
        )}
        <PreviewDialog template={open} onClose={() => setOpen(null)} reduced={reduced} />
      </LayoutGroup>
    </div>
  )
}

function TemplateCard({
  template: t,
  onOpen,
  reduced,
}: {
  template: Template
  onOpen: () => void
  reduced: boolean
}) {
  const video = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const start = () => {
    if (reduced) return
    void video.current?.play().catch(() => undefined)
  }
  const stop = () => {
    const v = video.current
    if (!v) return
    v.pause()
    setPlaying(false)
  }
  return (
    <motion.button
      type="button"
      layoutId={reduced ? undefined : `template-${t.id}`}
      data-testid="template-card"
      onClick={onOpen}
      onPointerEnter={start}
      onPointerLeave={stop}
      onFocus={start}
      onBlur={stop}
      aria-label={`${t.title}: ${t.description} Open preview`}
      className="group block w-full overflow-hidden rounded-xl border border-line bg-surface-1 text-left shadow-inner-highlight transition-colors duration-200 hover:border-line-strong"
    >
      <div className="relative aspect-video overflow-hidden" style={{ backgroundImage: art(t) }}>
        <div
          className="absolute inset-0 grid-bg opacity-40 [mask-image:radial-gradient(closest-side,black,transparent)]"
          aria-hidden
        />
        <video
          ref={video}
          src={t.video}
          muted
          loop
          playsInline
          preload="none"
          aria-hidden
          tabIndex={-1}
          onPlaying={() => setPlaying(true)}
          className={cn(
            'absolute inset-0 size-full object-cover transition-opacity duration-500',
            playing ? 'opacity-100' : 'opacity-0',
          )}
        />
        <div
          className={cn(
            'absolute inset-0 grid place-items-center transition-opacity duration-300',
            playing ? 'opacity-0' : 'opacity-100',
          )}
          aria-hidden
        >
          <span className="grid size-11 place-items-center rounded-full border border-line-strong bg-glass-strong text-fg backdrop-blur-md transition-transform duration-300 ease-out-expo group-hover:scale-110">
            <Play className="ml-0.5 size-4" fill="currentColor" />
          </span>
        </div>
        <div className="absolute top-2.5 left-2.5 flex gap-1.5">
          <Badge className="border-line-strong bg-glass-strong text-fg backdrop-blur-md">
            {ENGINE[t.library].label}
          </Badge>
          <Badge className="border-line-strong bg-glass-strong font-mono text-fg-muted backdrop-blur-md">
            {t.aspect}
          </Badge>
        </div>
        <span className="absolute right-2.5 bottom-2 inline-flex items-center gap-1 rounded-sm bg-canvas/70 px-1.5 py-0.5 font-mono text-2xs text-fg-muted backdrop-blur-sm">
          <Clock className="size-3" aria-hidden /> {t.duration}s
        </span>
      </div>
      <div className="flex flex-col gap-1.5 p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="truncate font-display text-lg font-semibold tracking-tight text-fg">{t.title}</h3>
          <span className="shrink-0 text-2xs font-medium tracking-wide text-fg-subtle uppercase">
            {t.category}
          </span>
        </div>
        <p className="line-clamp-2 text-sm text-fg-muted">{t.description}</p>
      </div>
    </motion.button>
  )
}

function PreviewDialog({
  template: t,
  onClose,
  reduced,
}: {
  template: Template | null
  onClose: () => void
  reduced: boolean
}) {
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    if (!t) return
    try {
      await navigator.clipboard.writeText(t.prompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      toast.error('Could not copy', 'Your browser blocked clipboard access.')
    }
  }
  return (
    <Dialog
      open={t !== null}
      onClose={onClose}
      layoutId={t && !reduced ? `template-${t.id}` : undefined}
      title={t?.title ?? ''}
      description={t ? `${t.category} · ${t.description}` : undefined}
      className="sm:max-w-3xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button
            data-testid="template-use"
            data-autofocus
            rightIcon={<ArrowRight className="size-4" />}
            onClick={() => t && navigate(`/app/create?template=${encodeURIComponent(t.id)}`)}
          >
            Use template
          </Button>
        </>
      }
    >
      {t ? (
        <div className="flex flex-col gap-5">
          <div className="overflow-hidden rounded-lg border border-line bg-black">
            <video
              key={t.id}
              src={t.video}
              controls
              muted
              loop
              playsInline
              autoPlay={!reduced}
              preload="metadata"
              className="aspect-video w-full object-contain"
              aria-label={`Sample render for ${t.title}`}
            />
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <h3 className="text-xs font-medium text-fg-muted">Prompt</h3>
              <Button
                variant="ghost"
                size="xs"
                onClick={copy}
                leftIcon={copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              >
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <p className="rounded-lg border border-line bg-surface-2 p-3.5 text-sm leading-relaxed text-fg">
              {t.prompt}
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
            {[
              { k: 'Engine', v: ENGINE[t.library].label, hint: ENGINE[t.library].hint },
              { k: 'Aspect', v: t.aspect, mono: true },
              { k: 'Duration', v: `${t.duration}s`, mono: true },
              { k: 'Style', v: t.style },
            ].map((row) => (
              <div key={row.k} className="bg-surface-1 px-3.5 py-3">
                <dt className="text-2xs font-medium tracking-wide text-fg-subtle uppercase">{row.k}</dt>
                <dd className={cn('mt-1 text-sm text-fg', row.mono && 'font-mono')}>{row.v}</dd>
                {row.hint ? <dd className="mt-0.5 text-2xs text-fg-subtle">{row.hint}</dd> : null}
              </div>
            ))}
          </dl>
          <p className="text-xs text-fg-subtle">
            The preview is a sample render from the same engine. Your render follows the prompt, so it can
            differ. Press <Kbd>Esc</Kbd> to close.
          </p>
        </div>
      ) : null}
    </Dialog>
  )
}
