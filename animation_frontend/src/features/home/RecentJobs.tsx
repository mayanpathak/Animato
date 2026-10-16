import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import { Badge, Skeleton, StatusChip } from '@/components/ui/misc'
import { ApiError } from '@/lib/api/http'
import { jobsApi } from '@/lib/api/jobs'
import { isFinished } from '@/lib/api/types'
import { timeAgo } from '@/lib/format'
import { keys, useJob } from '@/lib/local/hooks'
import type { JobRecord } from '@/lib/local/models'
import { ease } from '@/lib/motion'

const HOUR = 3_600_000

/** Polls recent or still-running jobs; older finished ones are fetched once. */
function useRowStatus(record: JobRecord) {
  const [recent] = useState(() => Date.now() - record.createdAt < HOUR)
  const once = useQuery({
    queryKey: keys.job(record.id),
    queryFn: () => jobsApi.get(record.id),
    enabled: !recent,
    staleTime: Infinity,
  })
  const poll = recent || (once.data !== undefined && !isFinished(once.data.status))
  const polled = useJob(poll ? record.id : undefined)
  return poll ? polled : once
}

function JobRow({ record, index }: { record: JobRecord; index: number }) {
  const job = useRowStatus(record)
  const gone = job.error instanceof ApiError && (job.error.status === 404 || job.error.status === 400)
  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: ease.outExpo, delay: index * 0.04 }}
    >
      <Link
        to={`/app/jobs/${record.id}`}
        className="group flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-surface-2 sm:gap-4"
      >
        <span className="w-24 shrink-0">
          {job.data ? (
            <StatusChip status={job.data.status} />
          ) : gone ? (
            <Badge>Unavailable</Badge>
          ) : job.error ? (
            <Badge>Offline</Badge>
          ) : (
            <Skeleton className="h-5 w-20 rounded-full" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-fg">{record.prompt}</span>
          <span className="mt-0.5 flex items-center gap-2 text-2xs text-fg-subtle">
            <span className="font-mono tracking-wide uppercase">{record.library}</span>
            <span aria-hidden>·</span>
            <span>{record.options.aspect}</span>
            <span aria-hidden>·</span>
            <span>{timeAgo(record.createdAt)}</span>
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-fg-faint transition-transform group-hover:translate-x-0.5 group-hover:text-fg-muted" />
      </Link>
    </motion.li>
  )
}

export function RecentJobs({ jobs, loading }: { jobs: JobRecord[]; loading: boolean }) {
  return (
    <section data-testid="recent-jobs" aria-labelledby="recent-h" className="surface-card rounded-2xl">
      <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-5">
        <h2 id="recent-h" className="font-display text-base font-semibold tracking-tight">
          Recent renders
        </h2>
        <span className="text-2xs text-fg-faint">From this browser</span>
      </div>
      {loading ? (
        <ul className="p-2" aria-busy>
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="flex items-center gap-4 px-3 py-3">
              <Skeleton className="h-5 w-20 rounded-full" />
              <span className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-4/5" />
                <Skeleton className="h-2.5 w-1/3" />
              </span>
            </li>
          ))}
        </ul>
      ) : jobs.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="text-sm text-fg-muted">No renders yet.</p>
          <Link to="/app/create" className="mt-1 inline-block text-sm text-accent hover:text-fg">
            Start your first one
          </Link>
        </div>
      ) : (
        <ul className="p-2">
          {jobs.map((j, i) => (
            <JobRow key={j.id} record={j} index={i} />
          ))}
        </ul>
      )}
    </section>
  )
}
