import { motion } from 'motion/react'
import { Check, X } from 'lucide-react'
import type { JobStatus } from '@/lib/api/types'
import { cn } from '@/lib/cn'
import { ease } from '@/lib/motion'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { PIPELINE, SHORT_LABEL } from './stages'

type NodeState = 'done' | 'active' | 'todo' | 'failed'

/**
 * Five stages, Pending → Completed. On failure the stage that was running
 * when it failed (last one this page saw) turns red.
 */
export function Pipeline({ status, lastRunning }: { status: JobStatus; lastRunning: JobStatus | null }) {
  const reduced = useReducedMotion()
  const failed = status === 'Failed'
  // Not seen running here: the failing stage is unknown, so only the end node turns red.
  const unknownStage = failed && lastRunning === null
  const failedAt = !failed
    ? -1
    : unknownStage
      ? PIPELINE.length - 1
      : Math.max(0, PIPELINE.indexOf(lastRunning ?? 'Pending'))
  const activeIndex = failed ? failedAt : PIPELINE.indexOf(status)
  const complete = status === 'Completed'

  const stateOf = (i: number): NodeState => {
    if (failed) return i === failedAt ? 'failed' : i < failedAt && !unknownStage ? 'done' : 'todo'
    if (complete) return 'done'
    return i < activeIndex ? 'done' : i === activeIndex ? 'active' : 'todo'
  }

  const fill = unknownStage ? 0 : Math.max(0, activeIndex) / (PIPELINE.length - 1)

  return (
    <div data-testid="job-pipeline" className="relative" role="list" aria-label="Render pipeline">
      {/* Track sits between the first and last node centres. */}
      <div
        className="absolute top-4 right-[10%] left-[10%] h-0.5 -translate-y-1/2 rounded-full bg-surface-3"
        aria-hidden
      >
        <motion.div
          className={cn(
            'h-full origin-left rounded-full',
            failed ? 'bg-status-failed/60' : 'bg-gradient-accent',
          )}
          initial={false}
          animate={{ scaleX: fill }}
          transition={{ duration: reduced ? 0 : 0.8, ease: ease.outExpo }}
        />
      </div>
      <ol className="relative grid grid-cols-5">
        {PIPELINE.map((stage, i) => {
          const state = stateOf(i)
          const label = state === 'failed' ? 'Failed' : SHORT_LABEL[stage]
          return (
            <li
              key={stage}
              role="listitem"
              aria-current={state === 'active' ? 'step' : undefined}
              className="flex min-w-0 flex-col items-center gap-2"
            >
              <span className="relative grid size-8 place-items-center">
                {state === 'active' && !reduced ? (
                  <motion.span
                    aria-hidden
                    className="absolute inset-0 rounded-full bg-accent/40"
                    animate={{ scale: [1, 1.7], opacity: [0.55, 0] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
                  />
                ) : null}
                <motion.span
                  initial={false}
                  animate={{ scale: state === 'active' ? 1.08 : 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  className={cn(
                    'relative grid size-8 place-items-center rounded-full border text-2xs font-semibold transition-colors duration-300',
                    state === 'done' && 'border-transparent bg-gradient-accent text-white',
                    state === 'active' && 'border-accent bg-surface-2 text-accent shadow-glow',
                    state === 'todo' && 'border-line-strong bg-surface-1 text-fg-faint',
                    state === 'failed' && 'border-status-failed/60 bg-status-failed/15 text-status-failed',
                  )}
                >
                  {state === 'done' ? (
                    <motion.span
                      initial={{ scale: 0.4, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.3, ease: ease.outExpo }}
                    >
                      <Check className="size-4" strokeWidth={2.5} />
                    </motion.span>
                  ) : state === 'failed' ? (
                    <X className="size-4" strokeWidth={2.5} />
                  ) : state === 'active' ? (
                    <span className="size-2 rounded-full bg-current" />
                  ) : (
                    <span className="font-mono">{i + 1}</span>
                  )}
                </motion.span>
              </span>
              <span
                className={cn(
                  'max-w-full truncate text-center text-2xs font-medium sm:text-xs',
                  state === 'todo'
                    ? 'text-fg-faint'
                    : state === 'failed'
                      ? 'text-status-failed'
                      : 'text-fg-muted',
                  state === 'active' && 'text-fg',
                )}
              >
                {label}
              </span>
              <span className="sr-only">
                {state === 'done'
                  ? 'done'
                  : state === 'active'
                    ? 'in progress'
                    : state === 'failed'
                      ? 'failed'
                      : 'waiting'}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
