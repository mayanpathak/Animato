// /app/v/:id — the one page of a video (plan 3.1, 3.4). It follows the
// selected take: rendering, failed, or ready, which is Finish (plan 6.6).
// `?mode=timeline` opens the fine-tune editor on the same video.
import { lazy, Suspense } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { ROUTES } from '@/app/nav'
import { AppChrome } from '@/app/AppShell'
import { buttonClass } from '@/components/ui/button'
import { FullPageSpinner } from '@/components/ui/spinner'
import { Skeleton } from '@/components/ui/misc'
import { useProject } from '@/lib/local/hooks'
import { DraftView } from './DraftView'
import { TakeView } from './TakeView'
import { selectedTake } from './model'
import { timelineOf } from '@/features/editor/projects'
import { MAIN_VIDEO } from '@/features/editor/model/timelineV2'

const Editor = lazy(() => import('@/features/editor/EditorPage'))

function VideoBar({ title }: { title: string | null }) {
  return (
    <header className="sticky top-0 z-[var(--z-sticky)] border-b border-line bg-canvas">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link
          to={ROUTES.videos}
          className={buttonClass('ghost', 'sm', '-ml-2 px-2 text-fg-muted')}
          aria-label="Back to videos"
        >
          <ArrowLeft />
          <span className="hidden sm:inline">Videos</span>
        </Link>
        <h1
          className="min-w-0 truncate font-display text-base font-semibold tracking-tight"
          data-testid="video-title"
        >
          {title ?? <Skeleton className="h-5 w-40" />}
        </h1>
      </div>
    </header>
  )
}

export default function VideoPage() {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const video = useProject(id)

  if (params.get('mode') === 'timeline')
    return (
      <Suspense fallback={<FullPageSpinner />}>
        <Editor />
        <AppChrome />
      </Suspense>
    )

  if (video.data === null)
    return (
      <div className="min-h-dvh bg-canvas">
        <VideoBar title="Not found" />
        <p className="mx-auto max-w-md px-6 py-24 text-center text-fg-muted">
          This video isn’t in this browser. Videos are stored locally, so they don’t follow you to other
          browsers.
        </p>
      </div>
    )

  const take = video.data ? selectedTake(video.data) : null
  // Ready and in this browser: Finish (plan 6.6). The take views import the
  // render first; they also cover rendering, failure and import errors.
  // The user's own clip (no takes) opens in Finish too, once it is on the main track.
  const ownClip =
    video.data && !take && timelineOf(video.data).timeline.clips.some((c) => c.trackId === MAIN_VIDEO)
  if (
    video.data &&
    (ownClip || (take?.status === 'Completed' && timelineOf(video.data).timeline.clips.length > 0))
  )
    return (
      <Suspense fallback={<FullPageSpinner />}>
        <Editor mode="finish" />
        <AppChrome />
      </Suspense>
    )
  return (
    <div className="min-h-dvh bg-canvas">
      <VideoBar title={video.data?.name ?? null} />
      {video.data && take ? (
        // Keyed by take: another take starts with fresh state.
        <TakeView key={take.jobId} take={take} video={video.data} />
      ) : video.data?.draft ? (
        <DraftView key={video.data.id} video={video.data} />
      ) : video.data ? (
        <div className="mx-auto max-w-md px-6 py-24 text-center">
          <p className="text-fg-muted">This video has no render yet.</p>
          <Link
            to={`${ROUTES.video(video.data.id)}?mode=timeline`}
            className={buttonClass('secondary', 'md', 'mt-5')}
          >
            Open the timeline
          </Link>
        </div>
      ) : null}
      <AppChrome />
    </div>
  )
}
