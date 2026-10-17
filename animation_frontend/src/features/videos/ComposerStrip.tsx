// The composer on top of Videos (plan 6.3): one line, expands on focus, with
// the engine pill and Generate. Generate starts the job; no page in between.
import { useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUp, Film } from 'lucide-react'
import { ROUTES } from '@/app/nav'
import { useOwner } from '@/lib/local/hooks'
import { usePreferences } from '@/stores/preferences'
import { toast } from '@/stores/toast'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { formatWait } from '@/lib/api/http'
import { useRenderWait } from '@/lib/quota'
import { PROMPT_MAX } from '@/lib/validation'
import { pickEngine, type Engine } from '@/features/create/prompt'
import { useStartVideo } from '@/features/create/useStartVideo'

const ENGINE_LABEL: Record<Engine, string> = { auto: 'Auto', manim: 'Explainer', remotion: 'Motion' }
const ORDER: Engine[] = ['auto', 'manim', 'remotion']

export function ComposerStrip({
  initial = '',
  stay = false,
  onStarted,
}: {
  initial?: string
  /** Start the job but stay on the current page (the composer sheet). */
  stay?: boolean
  onStarted?: () => void
}) {
  const [prompt, setPrompt] = useState(initial)
  const [engine, setEngine] = useState<Engine>('auto')
  const [focused, setFocused] = useState(false)
  const box = useRef<HTMLTextAreaElement>(null)
  const { start, pending, error, clearError } = useStartVideo()
  const wait = useRenderWait()
  const expanded = focused || prompt.length > 0
  const owner = useOwner()
  const navigate = useNavigate()
  const clipInput = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)

  /** The user's own clip as the main clip of a new video (secondary to Generate). */
  const importClip = async (file: File) => {
    setImporting(true)
    try {
      const { videoFromClip } = await import('@/features/editor/projects')
      const video = await videoFromClip(owner, file, usePreferences.getState().defaultFormat)
      navigate(ROUTES.video(video.id))
    } catch (e) {
      toast.error(`Could not import ${file.name}`, e instanceof Error ? e.message : undefined)
    } finally {
      setImporting(false)
    }
  }

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    if (pending || wait > 0) return
    void start(prompt, engine, undefined, { stay }).then((ok) => {
      if (ok) onStarted?.()
    })
  }

  const auto = engine === 'auto' ? pickEngine(prompt) : null
  const engineTitle =
    auto && prompt.trim()
      ? auto.reason
        ? `Auto picks Explainer because you mentioned “${auto.reason}”.`
        : 'Auto picks Motion for titles, stats and kinetic type.'
      : 'Auto picks the engine from your words.'

  return (
    <form onSubmit={submit} aria-label="New video" data-testid="composer-strip">
      <div
        className={cn(
          'rounded-2xl border bg-surface-1 shadow-inner-highlight transition-[border-color,box-shadow] duration-[var(--duration-base)]',
          focused ? 'border-line-strong shadow-md' : 'border-line',
        )}
      >
        <label htmlFor="composer" className="sr-only">
          Describe your next video
        </label>
        <textarea
          ref={box}
          id="composer"
          data-testid="composer-prompt"
          value={prompt}
          maxLength={PROMPT_MAX}
          rows={expanded ? 3 : 1}
          placeholder="What should we animate next?"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => {
            setPrompt(e.target.value)
            if (error) clearError()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          className="block w-full resize-none bg-transparent px-5 pt-4 pb-2 text-[17px] leading-7 text-fg placeholder:text-fg-faint focus:outline-none"
        />
        <div className="flex items-center gap-2 px-3 pb-3">
          <button
            type="button"
            title={engineTitle}
            aria-label={`Engine: ${ENGINE_LABEL[engine]}. ${engineTitle}`}
            data-testid="composer-engine"
            onClick={() => setEngine(ORDER[(ORDER.indexOf(engine) + 1) % ORDER.length])}
            className="h-8 rounded-full bg-surface-2 px-3 text-xs font-medium text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg"
          >
            {ENGINE_LABEL[engine]}
          </button>
          <span className="ml-auto" />
          {stay ? null : (
            <>
              <input
                ref={clipInput}
                type="file"
                accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
                className="sr-only"
                tabIndex={-1}
                aria-label="Import a clip"
                data-testid="import-clip-input"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (file) void importClip(file)
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                loading={importing}
                leftIcon={<Film className="size-3.5" />}
                onClick={() => clipInput.current?.click()}
                data-testid="import-clip"
              >
                Import a clip
              </Button>
            </>
          )}
          <Button
            type="submit"
            size="sm"
            loading={pending}
            disabled={wait > 0 || prompt.trim().length === 0}
            data-testid="composer-generate"
            rightIcon={wait > 0 ? undefined : <ArrowUp />}
          >
            {wait > 0 ? `Next render in ${formatWait(wait)}` : 'Generate'}
          </Button>
        </div>
      </div>
      {error ? (
        <p role="alert" className="mt-2 px-1 text-sm text-status-failed">
          {error}
        </p>
      ) : null}
    </form>
  )
}
