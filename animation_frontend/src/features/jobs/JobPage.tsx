import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  Clapperboard,
  Clock3,
  Copy,
  Download,
  FileQuestion,
  FolderPlus,
  HardDrive,
  RotateCcw,
  Sparkles,
  Timer,
} from 'lucide-react'
import { Button, buttonClass } from '@/components/ui/button'
import { Badge, ErrorState, Progress, Skeleton, StatusChip } from '@/components/ui/misc'
import {
  classifyGetJobError,
  FAILED_TITLE,
  failureCause,
  IMPORT_FAILED_TEXT,
  RENDER_GONE_TEXT,
  SERVER_ERROR_TEXT,
  technicalDetails,
  UNREACHABLE_TEXT,
} from '@/lib/api/errors'
import { errorMessage } from '@/lib/api/http'
import { jobsApi, type Job } from '@/lib/api/jobs'
import {
  STATUS_LABELS,
  STYLES,
  isFinished,
  type JobStatus,
  type Library,
  type VisualStyle,
} from '@/lib/api/types'
import { cn } from '@/lib/cn'
import { formatBytes, formatDuration, timeAgo } from '@/lib/format'
import { keys, useBrandKits, useCreateJob, useJob, useOwner } from '@/lib/local/hooks'
import { jobsTable, type JobRecord } from '@/lib/local/models'
import { ease } from '@/lib/motion'
import { useTitle } from '@/lib/useTitle'
import { toast } from '@/stores/toast'
import { createProjectFromJob } from '@/features/editor/projects'
import { buildServerPrompt, type AspectOption } from '@/features/create/prompt'
import { AddToProjectDialog } from './AddToProjectDialog'
import { Pipeline } from './Pipeline'
import { StatusFeed, type FeedLine } from './StatusFeed'
import { VideoPlayer } from './VideoPlayer'
import { estimateRemaining, feedText, formatEta, type Observation } from './stages'

const ASPECTS: AspectOption[] = ['16:9', '9:16', '1:1']
const ENGINE_NAME: Record<Library, string> = { manim: 'Manim', remotion: 'Remotion' }

interface Feed {
  origin: number
  observed: Observation[]
  lines: FeedLine[]
}

// Kept for the session so coming back to a job keeps what this tab saw.
const feeds = new Map<string, Feed>()

function aspectOf(record: JobRecord | null | undefined): AspectOption {
  const a = record?.options.aspect as AspectOption | undefined
  return a && ASPECTS.includes(a) ? a : '16:9'
}

function projectName(record: JobRecord | null | undefined, id: string): string {
  const text = record?.prompt.replace(/\s+/g, ' ').trim()
  if (!text) return `Animation ${id.slice(0, 8)}`
  if (text.length <= 56) return text
  const cut = text.slice(0, 56)
  return `${cut.slice(0, cut.lastIndexOf(' ') > 30 ? cut.lastIndexOf(' ') : 56)}…`
}

function useNow(active: boolean, ms = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const t = window.setInterval(() => setNow(Date.now()), ms)
    return () => window.clearInterval(t)
  }, [active, ms])
  return now
}

function useJobRecord(id: string) {
  return useQuery({
    queryKey: ['job-record', id],
    queryFn: async () => (await jobsTable.get(id)) ?? null,
    staleTime: Infinity,
  })
}

function appendStatus(
  prev: Feed | null,
  status: JobStatus,
  library: Library,
  createdAt: number | undefined,
): Feed {
  const last = prev?.observed[prev.observed.length - 1]
  if (prev && last?.status === status) return prev
  const now = Date.now()
  // Time from job creation when this browser created it recently, else from page open.
  const origin = prev?.origin ?? (createdAt && now - createdAt < 10 * 60_000 ? createdAt : now)
  const at = now - origin
  return {
    origin,
    observed: [...(prev?.observed ?? []), { status, at }],
    lines: [...(prev?.lines ?? []), { at, status, text: feedText(status, library) }],
  }
}

/**
 * Appends a feed line each time the polled status changes. It listens to the
 * query cache (the poller's results) rather than mirroring props in an effect.
 */
function useStatusFeed(id: string, library: Library, createdAt: number | undefined) {
  const qc = useQueryClient()
  const meta = useRef({ library, createdAt })
  useEffect(() => {
    meta.current = { library, createdAt }
  }, [library, createdAt])

  const [feed, setFeed] = useState<Feed | null>(() => {
    const existing = feeds.get(id)
    if (existing) return existing
    const cached = qc.getQueryData<Job>(keys.job(id))
    return cached ? appendStatus(null, cached.status, cached.library, undefined) : null
  })

  useEffect(() => {
    return qc.getQueryCache().subscribe((event) => {
      if (event.type !== 'updated') return
      const [scope, jobId] = event.query.queryKey as unknown[]
      if (scope !== 'job' || jobId !== id) return
      const data = event.query.state.data as Job | undefined
      if (!data) return
      setFeed((prev) => {
        const next = appendStatus(prev, data.status, meta.current.library, meta.current.createdAt)
        if (next !== prev) feeds.set(id, next)
        return next
      })
    })
  }, [qc, id])

  return feed
}

function HeroCard({
  id,
  record,
  job,
  recordLoading,
}: {
  id: string
  record: JobRecord | null | undefined
  job: Job | undefined
  recordLoading: boolean
}) {
  const library = record?.library ?? job?.library
  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(id)
      toast.success('Job id copied')
    } catch {
      toast.error('Could not copy', 'Your browser blocked clipboard access.')
    }
  }
  return (
    <motion.div
      layoutId="job-hero"
      transition={{ duration: 0.5, ease: ease.outExpo }}
      className="relative overflow-hidden rounded-2xl border border-line-strong bg-surface-1 shadow-inner-highlight"
    >
      <div className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full bg-accent-violet/10 blur-3xl" />
      <div className="relative p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span data-testid="job-status">
            {job ? <StatusChip status={job.status} /> : <Skeleton className="h-5 w-20 rounded-full" />}
          </span>
          {library ? <Badge tone="accent">{ENGINE_NAME[library]}</Badge> : null}
          {record ? (
            <span className="inline-flex items-center gap-1 text-xs text-fg-subtle">
              <Clock3 className="size-3" /> {timeAgo(record.createdAt)}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => void copyId()}
            className="ml-auto rounded font-mono text-2xs text-fg-faint transition-colors hover:text-fg-muted"
            title="Copy job id"
          >
            {id.slice(0, 8)}…
          </button>
        </div>
        {recordLoading ? (
          <div className="mt-4 space-y-2">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-2/3" />
          </div>
        ) : record ? (
          <p className="mt-4 font-display text-lg leading-relaxed tracking-tight break-words text-fg sm:text-xl">
            {record.prompt}
          </p>
        ) : (
          <div className="mt-4">
            <p className="font-display text-lg font-semibold tracking-tight">Job created elsewhere</p>
            <p className="mt-1 text-sm text-fg-subtle">
              This browser has no copy of the prompt. Status and video still come straight from the server.
            </p>
          </div>
        )}
        {record ? (
          <div className="mt-4 flex flex-wrap gap-1.5 text-2xs text-fg-subtle">
            <span className="rounded-md border border-line bg-surface-2 px-2 py-0.5">
              {record.options.aspect}
            </span>
            <span className="rounded-md border border-line bg-surface-2 px-2 py-0.5">
              ~{record.options.duration}s
            </span>
            <span className="rounded-md border border-line bg-surface-2 px-2 py-0.5">
              {record.options.style}
            </span>
            {record.options.brandKitId ? (
              <span className="rounded-md border border-line bg-surface-2 px-2 py-0.5">Brand kit</span>
            ) : null}
          </div>
        ) : null}
      </div>
    </motion.div>
  )
}

function ProgressCard({ job, feed, now }: { job: Job; feed: Feed | null; now: number }) {
  const running = !isFinished(job.status)
  const eta = feed ? estimateRemaining(feed.observed, now - feed.origin) : null
  const elapsed = feed ? Math.max(0, (now - feed.origin) / 1000) : 0
  return (
    <section aria-label="Progress" className="surface-card rounded-2xl p-5 sm:p-6">
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-xs text-fg-subtle">
            {running ? 'Now' : job.status === 'Completed' ? 'Finished' : 'Stopped'}
          </p>
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={job.status}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25, ease: ease.outExpo }}
              className="font-display text-xl font-semibold tracking-tight"
            >
              {STATUS_LABELS[job.status]}
            </motion.p>
          </AnimatePresence>
        </div>
        {running ? (
          <div className="text-right">
            <p className="text-xs text-fg-subtle">Time left</p>
            <p className="font-mono text-sm text-fg tabular-nums">
              {eta !== null ? `≈ ${formatEta(eta)}` : '—'}{' '}
              <span className="text-2xs text-fg-faint">estimate</span>
            </p>
          </div>
        ) : null}
      </div>
      <Pipeline status={job.status} lastRunning={lastRunning(feed)} />
      {running ? (
        <div className="mt-6 flex items-center gap-3">
          <Progress value={0} indeterminate label="Rendering in progress" />
          <span className="shrink-0 font-mono text-2xs text-fg-faint tabular-nums">
            {formatEta(Math.round(elapsed))}
          </span>
        </div>
      ) : null}
    </section>
  )
}

function lastRunning(feed: Feed | null): JobStatus | null {
  const list = feed?.observed ?? []
  for (let i = list.length - 1; i >= 0; i--) if (!isFinished(list[i].status)) return list[i].status
  return null
}

function FailurePanel({
  job,
  canRetry,
  retrying,
  onRetry,
  retryError,
  prompt,
}: {
  job: Job
  canRetry: boolean
  retrying: boolean
  onRetry: () => void
  retryError: string | null
  prompt: string | null
}) {
  const [open, setOpen] = useState(false)
  const details = technicalDetails(job.errorMessage)
  return (
    <section
      role="alert"
      className="rounded-2xl border border-status-failed/25 bg-status-failed/5 p-5 sm:p-6"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-status-failed/30 bg-status-failed/10 text-status-failed">
          <AlertTriangle className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-semibold tracking-tight">{FAILED_TITLE}</h2>
          <p className="mt-1 text-sm text-fg-muted">{failureCause(job.errorMessage)}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {canRetry ? (
              <Button
                onClick={onRetry}
                loading={retrying}
                leftIcon={<RotateCcw className="size-4" />}
                data-testid="job-retry"
              >
                Try again
              </Button>
            ) : null}
            <Link
              to={prompt ? `/app/create?prompt=${encodeURIComponent(prompt)}` : '/app/create'}
              className={buttonClass('secondary')}
            >
              Edit prompt
            </Link>
          </div>
          {canRetry ? <p className="mt-2 text-2xs text-fg-subtle">Uses 1 of your renders.</p> : null}
          {retryError ? <p className="mt-3 text-sm text-status-failed">{retryError}</p> : null}
        </div>
      </div>
      {details ? (
        <div className="mt-5 rounded-lg border border-line bg-canvas/60">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-fg-muted hover:text-fg"
          >
            Technical details
            <ChevronDown className={cn('ml-auto size-3.5 transition-transform', open && 'rotate-180')} />
          </button>
          <AnimatePresence initial={false}>
            {open ? (
              <motion.pre
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: ease.outExpo }}
                className="overflow-hidden border-t border-line px-3 py-2.5 font-mono text-2xs leading-relaxed break-words whitespace-pre-wrap text-status-failed/90"
              >
                {details}
              </motion.pre>
            ) : null}
          </AnimatePresence>
        </div>
      ) : null}
    </section>
  )
}

function Fact({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface-2/50 px-3 py-2.5">
      <dt className="flex items-center gap-1.5 text-2xs text-fg-subtle [&_svg]:size-3">
        {icon}
        {label}
      </dt>
      <dd className="mt-0.5 font-mono text-sm text-fg tabular-nums">{value}</dd>
    </div>
  )
}

function JobView({ id }: { id: string }) {
  const navigate = useNavigate()
  const owner = useOwner()
  const qc = useQueryClient()
  const job = useJob(id)
  const recordQuery = useJobRecord(id)
  const record = recordQuery.data
  const brandKits = useBrandKits()
  const createJob = useCreateJob()
  const [opening, setOpening] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [retryError, setRetryError] = useState<string | null>(null)
  const [importError, setImportError] = useState(false)

  const status = job.data?.status
  const library: Library = record?.library ?? job.data?.library ?? 'remotion'
  const feed = useStatusFeed(id, library, record?.createdAt)
  const now = useNow(Boolean(status && !isFinished(status)))
  useTitle(status ? `${STATUS_LABELS[status]} · Job` : 'Job')

  const name = projectName(record, id)

  const openInEditor = async () => {
    if (opening) return
    setOpening(true)
    setImportError(false)
    try {
      const project = await createProjectFromJob(id, owner, name, aspectOf(record))
      void qc.invalidateQueries({ queryKey: keys.projects(owner) })
      void qc.invalidateQueries({ queryKey: keys.media(owner) })
      navigate(`/app/projects/${project.id}/edit`)
    } catch {
      // Usually CORS on the S3 redirect or a network drop. The <video> player
      // keeps working (it needs no CORS); finishing needs the bytes.
      setImportError(true)
      setOpening(false)
    }
  }

  const retry = async () => {
    if (!record) return
    setRetryError(null)
    const kit = brandKits.data?.find((k) => k.id === record.options.brandKitId) ?? null
    const style = (STYLES as readonly string[]).includes(record.options.style)
      ? (record.options.style as VisualStyle)
      : 'Cinematic'
    const serverPrompt = buildServerPrompt(
      record.prompt,
      { aspect: aspectOf(record), duration: record.options.duration, style, captions: false },
      kit,
    )
    try {
      const next = await createJob.mutateAsync({
        prompt: record.prompt,
        library: record.library,
        options: record.options,
        serverPrompt,
      })
      navigate(`/app/jobs/${next.id}`)
    } catch (e) {
      setRetryError(errorMessage(e))
    }
  }

  const copyPrompt = async () => {
    if (!record) return
    try {
      await navigator.clipboard.writeText(record.prompt)
      toast.success('Prompt copied')
    } catch {
      toast.error('Could not copy', 'Your browser blocked clipboard access.')
    }
  }

  const loadState = job.error ? classifyGetJobError(job.error) : null
  if (job.error && (loadState === 'gone' || !job.data)) {
    if (loadState === 'gone') {
      return (
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-line-strong bg-surface-1/50 px-6 py-16 text-center">
            <span className="grid size-12 place-items-center rounded-xl border border-line bg-surface-2 text-fg-subtle">
              <FileQuestion className="size-5" />
            </span>
            <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight">{RENDER_GONE_TEXT}</h1>
            <p className="mt-1.5 max-w-sm text-sm text-fg-muted">
              It may belong to another account, or the link is incomplete. Renders are only visible to the
              account that started them.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Link to="/app" className={buttonClass('secondary')}>
                Back to Home
              </Link>
              <Link
                to={
                  record
                    ? `/app/create?prompt=${encodeURIComponent(record.prompt)}&engine=${record.library}`
                    : '/app/create'
                }
                className={buttonClass('primary')}
              >
                <Sparkles className="size-4" /> {record ? 'Render again' : 'New animation'}
              </Link>
            </div>
          </div>
        </div>
      )
    }
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <ErrorState
          title="Could not load this job"
          body={
            loadState === 'unreachable'
              ? UNREACHABLE_TEXT
              : loadState === 'server'
                ? SERVER_ERROR_TEXT
                : errorMessage(job.error)
          }
          action={
            <Button
              variant="secondary"
              onClick={() => void job.refetch()}
              leftIcon={<RotateCcw className="size-4" />}
            >
              Try again
            </Button>
          }
        />
      </div>
    )
  }

  const data = job.data
  const completed = data?.status === 'Completed'
  const failed = data?.status === 'Failed'
  const aspect = aspectOf(record)
  const videoUrl = jobsApi.videoUrl(id)

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Link
        to="/app"
        className="mb-5 inline-flex items-center gap-1.5 rounded-sm text-xs text-fg-subtle transition-colors hover:text-fg"
      >
        <ArrowLeft className="size-3.5" /> Home
      </Link>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <HeroCard id={id} record={record} job={data} recordLoading={recordQuery.isPending} />

          {job.lost ? (
            <div
              role="status"
              data-testid="job-lost"
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface-1 px-4 py-3 text-sm"
            >
              <span className="text-fg-muted">Lost track of this render.</span>
              <Button size="sm" variant="secondary" onClick={job.checkAgain}>
                Check again
              </Button>
            </div>
          ) : null}

          {!data ? (
            <div className="surface-card rounded-2xl p-6" aria-busy>
              <Skeleton className="h-6 w-40" />
              <div className="mt-8 grid grid-cols-5 gap-4">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex flex-col items-center gap-2">
                    <Skeleton className="size-8 rounded-full" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              {completed ? (
                <motion.div
                  key="video"
                  initial={{ opacity: 0, y: 12, scale: 0.99 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.5, ease: ease.outExpo }}
                  className={cn(
                    aspect === '9:16' && 'mx-auto max-w-sm',
                    aspect === '1:1' && 'mx-auto max-w-xl',
                  )}
                >
                  <VideoPlayer
                    src={videoUrl}
                    fallbackDuration={data.durationSeconds}
                    aspectRatio={aspect.replace(':', ' / ')}
                    label="Rendered animation"
                  />
                </motion.div>
              ) : failed ? (
                <motion.div
                  key="failed"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <FailurePanel
                    job={data}
                    canRetry={Boolean(record)}
                    retrying={createJob.isPending}
                    onRetry={() => void retry()}
                    retryError={retryError}
                    prompt={record?.prompt ?? null}
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>
          )}

          {data ? <ProgressCard job={data} feed={feed} now={now} /> : null}
        </div>

        <aside className="min-w-0 space-y-4 lg:sticky lg:top-20 lg:self-start">
          {completed ? (
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: ease.outExpo, delay: 0.1 }}
              aria-label="Next steps"
              className="surface-card rounded-2xl p-4"
            >
              <Button
                size="lg"
                className="w-full"
                onClick={() => void openInEditor()}
                loading={opening}
                leftIcon={<Clapperboard className="size-4" />}
                data-testid="job-open-editor"
              >
                {opening ? 'Importing video…' : 'Open in Editor'}
              </Button>
              <Button
                variant="secondary"
                className="mt-2 w-full"
                onClick={() => setAddOpen(true)}
                leftIcon={<FolderPlus className="size-4" />}
                data-testid="job-add-to-project"
              >
                Add to project
              </Button>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <a href={videoUrl} download className={buttonClass('ghost', 'sm', 'justify-start')}>
                  <Download className="size-3.5" /> Download
                </a>
                <Link
                  to={
                    record
                      ? `/app/create?prompt=${encodeURIComponent(record.prompt)}&engine=${library}`
                      : '/app/create'
                  }
                  className={buttonClass('ghost', 'sm', 'justify-start')}
                >
                  <Sparkles className="size-3.5" /> New variation
                </Link>
              </div>
              {importError ? (
                <div role="alert" data-testid="import-failed" className="mt-3 text-sm">
                  <p className="text-fg">{IMPORT_FAILED_TEXT}</p>
                  <p className="mt-1 text-2xs text-fg-subtle">
                    The video still plays here and you can download the original.
                    {import.meta.env.DEV
                      ? ' Local dev: the S3 bucket needs a CORS rule for this origin (LOCAL_DEV.md).'
                      : ''}
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-2"
                    onClick={() => void openInEditor()}
                    leftIcon={<RotateCcw className="size-3.5" />}
                  >
                    Retry import
                  </Button>
                </div>
              ) : null}
              {opening ? (
                <p className="mt-2 text-2xs text-fg-faint" aria-live="polite">
                  Downloading the render into this browser and building thumbnails…
                </p>
              ) : null}
            </motion.section>
          ) : null}

          {completed && data ? (
            <section aria-label="Render facts" className="surface-card rounded-2xl p-4">
              <h2 className="mb-3 font-display text-sm font-semibold tracking-tight">Render</h2>
              <dl className="grid grid-cols-2 gap-2">
                <Fact icon={<Timer />} label="Duration" value={formatDuration(data.durationSeconds)} />
                <Fact icon={<HardDrive />} label="File size" value={formatBytes(data.fileSizeBytes)} />
                <Fact
                  icon={<Clock3 />}
                  label="Render time"
                  value={data.renderTimeMs != null ? `${(data.renderTimeMs / 1000).toFixed(1)}s` : '–'}
                />
                <Fact icon={<Clapperboard />} label="Engine" value={ENGINE_NAME[library]} />
              </dl>
            </section>
          ) : null}

          {!completed ? (
            <section aria-label="Actions" className="surface-card flex flex-wrap gap-2 rounded-2xl p-3">
              <Link
                to={
                  record
                    ? `/app/create?prompt=${encodeURIComponent(record.prompt)}&engine=${library}`
                    : '/app/create'
                }
                className={buttonClass('ghost', 'sm')}
              >
                <Sparkles className="size-3.5" /> New variation
              </Link>
              {record ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void copyPrompt()}
                  leftIcon={<Copy className="size-3.5" />}
                >
                  Copy prompt
                </Button>
              ) : null}
            </section>
          ) : record ? (
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => void copyPrompt()}
              leftIcon={<Copy className="size-3.5" />}
            >
              Copy prompt
            </Button>
          ) : null}

          <StatusFeed lines={feed?.lines ?? []} live={Boolean(status && !isFinished(status))} />
        </aside>
      </div>

      {completed ? (
        <AddToProjectDialog
          open={addOpen}
          onClose={() => setAddOpen(false)}
          jobId={id}
          clipName={name}
          creatingNew={opening}
          onCreateNew={() => void openInEditor()}
        />
      ) : null}
    </div>
  )
}

export default function JobPage() {
  const { id = '' } = useParams()
  // Keyed so a retry (new id) starts with a fresh feed and state.
  return <JobView key={id} id={id} />
}
