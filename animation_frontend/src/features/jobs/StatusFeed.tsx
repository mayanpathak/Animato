import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Copy, Radio } from 'lucide-react'
import { IconButton } from '@/components/ui/button'
import { STATUS_TONE, isFinished, type JobStatus } from '@/lib/api/types'
import { cn } from '@/lib/cn'
import { formatClock } from '@/lib/format'
import { toast } from '@/stores/toast'

export interface FeedLine {
  at: number
  status: JobStatus | null
  text: string
}

const TONE_TEXT: Record<string, string> = {
  queued: 'text-status-queued',
  planning: 'text-status-planning',
  rendering: 'text-status-rendering',
  succeeded: 'text-status-succeeded',
  failed: 'text-status-failed',
}

export function StatusFeed({ lines, live }: { lines: FeedLine[]; live: boolean }) {
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [lines.length])

  const copy = async () => {
    const text = lines.map((l) => `${formatClock(l.at / 1000)}  ${l.text}`).join('\n')
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Status feed copied')
    } catch {
      toast.error('Could not copy', 'Your browser blocked clipboard access.')
    }
  }

  return (
    <section
      aria-labelledby="feed-h"
      className="surface-card flex min-h-0 flex-col overflow-hidden rounded-2xl"
    >
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <h2 id="feed-h" className="font-display text-sm font-semibold tracking-tight">
          Status feed
        </h2>
        {live ? (
          <span className="inline-flex items-center gap-1 text-2xs text-status-rendering">
            <Radio className="size-3 animate-pulse-soft" /> live
          </span>
        ) : null}
        <IconButton label="Copy status feed" size="sm" className="ml-auto" onClick={() => void copy()}>
          <Copy />
        </IconButton>
      </div>
      <div
        ref={scroller}
        data-testid="job-feed"
        role="log"
        aria-live="polite"
        aria-label="Status changes seen by this page"
        className="max-h-64 min-h-36 overflow-y-auto bg-canvas/50 px-4 py-3 font-mono text-xs leading-6"
      >
        <AnimatePresence initial={false}>
          {lines.map((line, i) => {
            const tone = line.status ? STATUS_TONE[line.status] : null
            return (
              <motion.div
                key={`${i}-${line.text}`}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25 }}
                className="flex gap-3"
              >
                <span className="shrink-0 text-fg-subtle tabular-nums">{formatClock(line.at / 1000)}</span>
                <span className={cn('min-w-0 break-words', tone ? TONE_TEXT[tone] : 'text-fg-subtle')}>
                  {line.text}
                </span>
              </motion.div>
            )
          })}
        </AnimatePresence>
        {live && lines.length > 0 && !isFinished(lines[lines.length - 1].status ?? 'Pending') ? (
          <div className="flex gap-3 text-fg-subtle" aria-hidden>
            <span className="invisible tabular-nums">00:00.0</span>
            <span className="animate-pulse-soft">▍</span>
          </div>
        ) : null}
      </div>
      <p className="border-t border-line px-4 py-2 text-2xs text-fg-subtle">
        Status changes this page saw while checking the server. Animato’s server does not publish worker logs.
      </p>
    </section>
  )
}
