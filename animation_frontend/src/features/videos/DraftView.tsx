// A video waiting for its first job (plan 3.4 `drafting`, 5.1 step 5). The
// first video after signup starts itself after a 3 s Cancel; any other draft
// waits for Generate. A refused job keeps the prompt and says why.
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { useQueryClient } from '@tanstack/react-query'
import { ROUTES } from '@/app/nav'
import { Button, buttonClass } from '@/components/ui/button'
import { track } from '@/lib/analytics'
import { mapCreateJobError } from '@/lib/api/errors'
import { formatWait } from '@/lib/api/http'
import { keys, useCreateJob } from '@/lib/local/hooks'
import { projectsTable, type Project } from '@/lib/local/models'
import { duration, ease } from '@/lib/motion'
import { useQuota, useRenderWait } from '@/lib/quota'
import { buildServerPrompt, recordOptions, resolveLibrary } from '@/features/create/prompt'
import { DEFAULT_OPTIONS } from '@/features/create/useStartVideo'

const COUNTDOWN = 3

export function DraftView({ video }: { video: Project }) {
  const draft = video.draft as NonNullable<Project['draft']>
  const qc = useQueryClient()
  const createJob = useCreateJob()
  const wait = useRenderWait()
  const [count, setCount] = useState(draft.autoStart && !draft.error ? COUNTDOWN : null)
  const [error, setError] = useState<string | null>(draft.error ?? null)
  const started = useRef(false)

  const generate = async () => {
    if (started.current) return
    started.current = true
    setError(null)
    const library = resolveLibrary(draft.engine, draft.prompt)
    try {
      await createJob.mutateAsync({
        prompt: draft.prompt,
        library,
        serverPrompt: buildServerPrompt(draft.prompt, DEFAULT_OPTIONS, null),
        options: recordOptions(DEFAULT_OPTIONS, null),
        videoId: video.id,
      })
      // The take is on the video now; clearing the draft flips the page to rendering.
      const latest = await projectsTable.get(video.id)
      if (latest) await projectsTable.put({ ...latest, draft: null })
      track('job_create', { library, first: draft.autoStart })
    } catch (e) {
      const mapped = mapCreateJobError(e)
      if (mapped.action === 'wait' && mapped.retryAfter) useQuota.getState().block(mapped.retryAfter)
      setError(mapped.message)
      const latest = await projectsTable.get(video.id)
      if (latest)
        await projectsTable.put({ ...latest, draft: { ...draft, autoStart: false, error: mapped.message } })
      started.current = false
    } finally {
      void qc.invalidateQueries({ queryKey: keys.project(video.id) })
    }
  }

  useEffect(() => {
    if (count === null) return
    if (count === 0) {
      setCount(null)
      void generate()
      return
    }
    const t = setTimeout(() => setCount((c) => (c === null ? null : c - 1)), 1000)
    return () => clearTimeout(t)
    // generate is stable for this draft
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count])

  const cancel = async () => {
    setCount(null)
    const latest = await projectsTable.get(video.id)
    if (latest) await projectsTable.put({ ...latest, draft: { ...draft, autoStart: false } })
    void qc.invalidateQueries({ queryKey: keys.project(video.id) })
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-6 pb-16 sm:px-6 sm:pt-12">
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: duration.slow, ease: ease.outExpo }}
        className="rounded-2xl border border-line bg-surface-1 p-6 shadow-inner-highlight sm:p-8"
        data-testid="draft-view"
      >
        <blockquote className="text-lg leading-relaxed text-fg">“{draft.prompt}”</blockquote>
        {count !== null ? (
          <div className="mt-8 flex items-center justify-between gap-4" aria-live="polite">
            <p className="text-fg-muted" data-testid="first-start">
              Starting your first video… <span className="font-mono text-fg tabular-nums">{count}</span>
            </p>
            <Button variant="secondary" onClick={() => void cancel()} data-testid="first-start-cancel">
              Cancel
            </Button>
          </div>
        ) : (
          <div className="mt-8">
            {error ? (
              <p role="alert" className="mb-4 text-sm text-status-failed">
                {error}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={() => void generate()}
                loading={createJob.isPending}
                disabled={wait > 0}
                data-testid="draft-generate"
              >
                {wait > 0 ? `Next render in ${formatWait(wait)}` : 'Generate'}
              </Button>
              <Link
                to={`${ROUTES.newVideo}?prompt=${encodeURIComponent(draft.prompt)}&engine=${draft.engine}`}
                className={buttonClass('ghost')}
              >
                Edit prompt
              </Link>
            </div>
          </div>
        )}
      </motion.section>
    </div>
  )
}
