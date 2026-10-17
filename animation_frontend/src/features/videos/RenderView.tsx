// The video page while a take renders (plan 6.5): honest stages with real
// elapsed time, no percentage and no invented estimate.
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { Check, Sigma, Type } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { isFixing, observe, type Observed } from '@/lib/api/polling'
import { formatClock, STAGES, stageTimes, typicalMinutes, type StageId } from './renderStages'
import { isFinished, type JobStatus, type Library } from '@/lib/api/types'
import { cn } from '@/lib/cn'
import { useOwner } from '@/lib/local/hooks'
import { jobsTable, mine } from '@/lib/local/models'
import { duration, ease } from '@/lib/motion'

const COPY: Record<StageId | 'Fixing', { label: string; detail: string }> = {
  Pending: { label: 'Queued', detail: 'Waiting for a renderer.' },
  GeneratingCode: { label: 'Writing the animation', detail: 'Turning your idea into an animation script.' },
  Fixing: {
    label: 'Fixing a render error',
    detail: 'The first attempt failed to render. Trying a corrected version.',
  },
  Rendering: { label: 'Rendering frames', detail: 'Drawing every frame.' },
  Uploading: { label: 'Finishing', detail: 'Saving your video.' },
}

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [active])
  return now
}

export function RenderView({
  prompt,
  library,
  status,
  initialObserved,
  lost,
  onCheckAgain,
  below,
}: {
  prompt: string
  library: Library
  status: JobStatus | undefined
  initialObserved: Observed[]
  lost: boolean
  onCheckAgain: () => void
  below?: React.ReactNode
}) {
  const owner = useOwner()
  // Status changes this page sees are appended to what the poller already recorded.
  const [observed, setObserved] = useState<Observed[]>(initialObserved)
  const [lastStatus, setLastStatus] = useState(status)
  if (status !== lastStatus) {
    setLastStatus(status)
    if (status) setObserved((list) => observe(list, status, Date.now()))
  }
  const running = !status || !isFinished(status)
  const now = useNow(running)
  const times = useMemo(() => stageTimes(observed), [observed])
  const fixing = isFixing(observed)
  const current = (status && !isFinished(status) ? status : 'Pending') as StageId
  const currentIndex = STAGES.indexOf(current)
  const [expanded, setExpanded] = useState(false)

  const history = useQuery({
    queryKey: ['job-history-typical', owner, library],
    queryFn: async () => typicalMinutes(await mine(jobsTable, owner), library),
    enabled: owner !== '',
    staleTime: 60_000,
  })

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-6 pb-16 sm:px-6 sm:pt-12">
      <motion.section
        layout
        aria-labelledby="render-h"
        className="rounded-2xl border border-line bg-surface-1 p-6 shadow-inner-highlight sm:p-8"
        data-testid="render-view"
      >
        <div className="flex items-start gap-3">
          <span
            className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-control bg-surface-2 text-fg-muted [&_svg]:size-4"
            title={library === 'manim' ? 'Explainer (Manim)' : 'Motion (Remotion)'}
          >
            {library === 'manim' ? <Sigma /> : <Type />}
          </span>
          <blockquote className="min-w-0 flex-1">
            <p
              className={cn('text-lg leading-relaxed text-fg', !expanded && 'line-clamp-2')}
              data-testid="render-prompt"
            >
              “{prompt}”
            </p>
            {prompt.length > 140 ? (
              <button
                type="button"
                className="mt-1 text-sm text-fg-subtle underline-offset-4 hover:text-fg hover:underline"
                onClick={() => setExpanded((e) => !e)}
              >
                {expanded ? 'Show less' : 'Show all'}
              </button>
            ) : null}
          </blockquote>
        </div>

        <h2 id="render-h" className="sr-only">
          Render progress
        </h2>
        <ol className="mt-8 space-y-1" aria-live="polite" data-testid="render-stages">
          {STAGES.map((id, i) => {
            const t = times.get(id)
            const state = i < currentIndex ? 'done' : i === currentIndex ? 'active' : 'todo'
            const copy = id === 'GeneratingCode' && fixing ? COPY.Fixing : COPY[id]
            const elapsed = t ? (t.end ?? now) - t.start : null
            return (
              <li
                key={id}
                data-state={state}
                aria-current={state === 'active' ? 'step' : undefined}
                className={cn(
                  'relative flex items-start gap-3 overflow-hidden rounded-control px-3 py-3',
                  state === 'active' && 'bg-surface-2',
                )}
              >
                {state === 'active' ? (
                  <div className="skeleton absolute inset-0 opacity-40" aria-hidden />
                ) : null}
                <span
                  className={cn(
                    'relative mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border',
                    state === 'done' && 'border-transparent bg-accent-fill text-white',
                    state === 'active' && 'border-accent',
                    state === 'todo' && 'border-line-strong',
                  )}
                  aria-hidden
                >
                  {state === 'done' ? <Check className="size-3" strokeWidth={3} /> : null}
                  {state === 'active' ? (
                    <span className="size-1.5 animate-pulse-soft rounded-full bg-accent" />
                  ) : null}
                </span>
                <div className="relative min-w-0 flex-1">
                  <p className={cn('text-[15px]', state === 'todo' ? 'text-fg-subtle' : 'text-fg')}>
                    {copy.label}
                  </p>
                  {state === 'active' ? <p className="mt-0.5 text-sm text-fg-muted">{copy.detail}</p> : null}
                </div>
                {elapsed !== null && state !== 'todo' ? (
                  <span className="relative font-mono text-sm text-fg-subtle tabular-nums">
                    {formatClock(elapsed)}
                  </span>
                ) : null}
              </li>
            )
          })}
        </ol>

        {lost ? (
          <div
            className="mt-6 flex items-center justify-between gap-3 border-t border-line pt-5"
            data-testid="job-lost"
          >
            <p className="text-sm text-fg-muted">Lost track of this render.</p>
            <Button size="sm" variant="secondary" onClick={onCheckAgain}>
              Check again
            </Button>
          </div>
        ) : history.data ? (
          <p className="mt-6 border-t border-line pt-5 text-sm text-fg-subtle" data-testid="typical-time">
            Usually takes about {history.data} min.
          </p>
        ) : null}
      </motion.section>
      {below ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: duration.slow, ease: ease.outExpo, delay: 0.2 }}
        >
          {below}
        </motion.div>
      ) : null}
    </div>
  )
}
