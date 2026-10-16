// The selected take of a video, by state (plan 3.4): rendering, failed,
// ready, ready-remote (import failed) and gone. Finish (P6) replaces the
// ready view's body; the states and their data stay.
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronDown, Download } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ROUTES } from '@/app/nav'
import { Button, buttonClass } from '@/components/ui/button'
import { ErrorState } from '@/components/ui/misc'
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
import { jobsApi } from '@/lib/api/jobs'
import { isFinished } from '@/lib/api/types'
import { track } from '@/lib/analytics'
import { cn } from '@/lib/cn'
import { formatBytes, formatDuration } from '@/lib/format'
import { keys, useJob, useOwner } from '@/lib/local/hooks'
import { jobsTable, type Project, type Take } from '@/lib/local/models'
import { duration, ease } from '@/lib/motion'
import { addJobToProject, timelineOf } from '@/features/editor/projects'
import { usePreferences } from '@/stores/preferences'
import { toast } from '@/stores/toast'
import { RenderView } from './RenderView'
import { useAnotherTake } from './useAnotherTake'
import { VideoPlayer } from './VideoPlayer'
import { WaitActions } from './WaitActions'

type ImportState = 'idle' | 'importing' | 'done' | 'failed'

/** Tab title follows the take (plan 6.5): "Rendering…", "✓ Ready", "Didn't render". */
function useTakeTitle(name: string, status: string | undefined) {
  useEffect(() => {
    const prefix =
      status === 'Completed'
        ? '✓ Ready'
        : status === 'Failed'
          ? 'Didn’t render'
          : status
            ? 'Rendering…'
            : name
    document.title = `${prefix} · Animato`
  }, [name, status])
}

/** One-time, after the first render starts; never before (plan 6.5). */
function NotifyOffer() {
  const enabled = usePreferences((s) => s.notifications)
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem('animato:notify-offered') === '1'
    } catch {
      return true
    }
  })
  if (dismissed || enabled || typeof Notification === 'undefined' || Notification.permission === 'denied')
    return null
  const close = () => {
    try {
      localStorage.setItem('animato:notify-offered', '1')
    } catch {
      // ignore
    }
    setDismissed(true)
  }
  return (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-fg-subtle">
      <span>Working in another tab?</span>
      <button
        type="button"
        className="text-fg underline underline-offset-4 hover:text-accent"
        onClick={async () => {
          const result = await Notification.requestPermission()
          if (result === 'granted') usePreferences.getState().setNotifications(true)
          close()
        }}
      >
        Notify me when it’s ready
      </button>
      <button type="button" className="hover:text-fg" onClick={close} aria-label="Dismiss">
        Not now
      </button>
    </div>
  )
}

function Details({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-6 border-t border-line pt-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 text-left text-sm text-fg-subtle hover:text-fg"
      >
        Technical details
        <ChevronDown className={cn('ml-auto size-4 transition-transform', open && 'rotate-180')} />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.pre
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: duration.base, ease: ease.outExpo }}
            className="mt-3 overflow-hidden font-mono text-xs leading-relaxed break-words whitespace-pre-wrap text-fg-muted"
          >
            {text}
          </motion.pre>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

export function TakeView({ video, take }: { video: Project; take: Take }) {
  const owner = useOwner()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const job = useJob(take.jobId)
  const another = useAnotherTake(video.id)
  const record = useQuery({
    queryKey: ['job-record', take.jobId],
    queryFn: async () => (await jobsTable.get(take.jobId)) ?? null,
    staleTime: Infinity,
  })
  const status = job.data?.status ?? take.status
  const [importState, setImportState] = useState<ImportState>('idle')
  const seenRunning = useRef(false)
  useTakeTitle(video.name, status)

  // Ready: celebrate quietly, notify if the tab is hidden, and prefetch the
  // render into this browser so Finish opens instantly (plan 6.5).
  const startImport = async () => {
    setImportState('importing')
    try {
      const hasClip = timelineOf(video).timeline.clips.length > 0
      if (!hasClip) await addJobToProject(take.jobId, video.id, owner, video.name)
      void qc.invalidateQueries({ queryKey: keys.project(video.id) })
      void qc.invalidateQueries({ queryKey: keys.projects(owner) })
      setImportState('done')
    } catch {
      // Usually CORS on the S3 redirect or a network drop. The <video>
      // player keeps working (it needs no CORS); finishing needs the bytes.
      setImportState('failed')
    }
  }

  useEffect(() => {
    if (status && !isFinished(status)) seenRunning.current = true
    if (status === 'Completed' && importState === 'idle') {
      void startImport()
      if (seenRunning.current) {
        toast.success('Your video is ready.')
        track('job_complete', { library: take.library })
        if (
          document.visibilityState === 'hidden' &&
          usePreferences.getState().notifications &&
          typeof Notification !== 'undefined' &&
          Notification.permission === 'granted'
        )
          new Notification('Your video is ready', { body: video.name, tag: take.jobId })
      }
    }
    if (status === 'Failed' && seenRunning.current) track('job_fail', { library: take.library })
    // startImport is stable for this take; importState gates it to once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  const tryAgain = () => another.start(take, 'retry')

  const editPromptHref = `${ROUTES.newVideo}?prompt=${encodeURIComponent(take.prompt)}&engine=${take.library}`
  const loadState = job.error ? classifyGetJobError(job.error) : null

  if (loadState === 'gone')
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center" data-testid="take-gone">
        <h2 className="font-display text-2xl font-semibold tracking-tight">{RENDER_GONE_TEXT}</h2>
        <p className="mt-2 text-fg-muted">Renders are only visible to the account that started them.</p>
        <div className="mt-7 flex justify-center gap-2">
          <Link to={ROUTES.videos} className={buttonClass('secondary')}>
            Back to videos
          </Link>
          {take.prompt ? (
            <Link to={editPromptHref} className={buttonClass('primary')}>
              Render again
            </Link>
          ) : null}
        </div>
      </div>
    )

  if (job.error && !job.data && !take.status)
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <ErrorState
          title="Couldn’t load this render"
          body={
            loadState === 'unreachable'
              ? UNREACHABLE_TEXT
              : loadState === 'server'
                ? SERVER_ERROR_TEXT
                : errorMessage(job.error)
          }
          action={
            <Button variant="secondary" onClick={() => job.checkAgain()}>
              Try again
            </Button>
          }
        />
      </div>
    )

  if (!status || !isFinished(status))
    return (
      <RenderView
        prompt={take.prompt || 'This render was started in another browser.'}
        library={take.library}
        status={status}
        initialObserved={record.data?.observed ?? []}
        lost={job.lost}
        onCheckAgain={job.checkAgain}
        below={
          <>
            <WaitActions />
            <NotifyOffer />
          </>
        }
      />
    )

  if (status === 'Failed') {
    const details = technicalDetails(job.data?.errorMessage)
    return (
      <div className="mx-auto w-full max-w-2xl px-4 pt-6 pb-16 sm:px-6 sm:pt-12">
        <section
          role="alert"
          className="rounded-2xl border border-line bg-surface-1 p-6 shadow-inner-highlight sm:p-8"
        >
          <h2 className="font-display text-2xl font-semibold tracking-tight">{FAILED_TITLE}</h2>
          <p className="mt-2 text-fg-muted">{failureCause(job.data?.errorMessage)}</p>
          {take.prompt ? <p className="mt-5 line-clamp-3 text-fg-subtle">“{take.prompt}”</p> : null}
          <div className="mt-7 flex flex-wrap items-center gap-2">
            {take.prompt ? (
              <Button onClick={() => void tryAgain()} loading={another.pending} data-testid="job-retry">
                Try again
              </Button>
            ) : null}
            <Link to={editPromptHref} className={buttonClass('secondary')}>
              Edit prompt
            </Link>
          </div>
          {take.prompt ? <p className="mt-3 text-sm text-fg-subtle">Uses 1 of your renders.</p> : null}
          {another.error ? <p className="mt-3 text-sm text-status-failed">{another.error}</p> : null}
          {details ? <Details text={details} /> : null}
        </section>
      </div>
    )
  }

  // Completed. Finish (P6) takes over this body; until then the render plays
  // here and the timeline is one click away.
  const data = job.data
  const videoUrl = jobsApi.videoUrl(take.jobId)
  return (
    <div className="mx-auto w-full max-w-4xl px-4 pt-6 pb-16 sm:px-6 sm:pt-10">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: duration.slow, ease: ease.outExpo }}
      >
        <VideoPlayer
          src={videoUrl}
          fallbackDuration={data?.durationSeconds ?? null}
          label="Rendered animation"
          autoPlay
        />
      </motion.div>
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Button
          size="lg"
          loading={importState === 'importing'}
          disabled={importState === 'failed'}
          onClick={() => navigate(`${ROUTES.video(video.id)}?mode=timeline`)}
          data-testid="job-open-editor"
        >
          {importState === 'importing' ? 'Preparing…' : 'Open in editor'}
        </Button>
        <a href={videoUrl} download className={buttonClass('ghost', 'lg')}>
          <Download /> Download original
        </a>
        <p className="ml-auto text-sm text-fg-subtle tabular-nums">
          {data?.durationSeconds != null ? formatDuration(data.durationSeconds) : ''}
          {data?.fileSizeBytes != null ? ` · ${formatBytes(data.fileSizeBytes)}` : ''}
          {data?.renderTimeMs != null ? ` · rendered in ${(data.renderTimeMs / 1000).toFixed(0)} s` : ''}
        </p>
      </div>
      {importState === 'failed' ? (
        <div
          role="alert"
          data-testid="import-failed"
          className="mt-6 rounded-xl border border-line bg-surface-1 px-5 py-4"
        >
          <p className="text-fg">{IMPORT_FAILED_TEXT}</p>
          <p className="mt-1 text-sm text-fg-subtle">
            The video still plays here and you can download the original.
            {import.meta.env.DEV
              ? ' Local dev: the S3 bucket needs a CORS rule for this origin (LOCAL_DEV.md).'
              : ''}
          </p>
          <Button size="sm" variant="secondary" className="mt-3" onClick={() => void startImport()}>
            Retry import
          </Button>
        </div>
      ) : null}
      <p className="sr-only" aria-live="polite">
        Your video is ready.
      </p>
    </div>
  )
}
