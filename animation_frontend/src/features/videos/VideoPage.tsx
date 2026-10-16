// /app/v/:id — the one page of a video (plan 3.1, 3.4). It follows the
// selected take: rendering, failed or ready. `?mode=timeline` opens the
// fine-tune editor on the same video.
import { lazy, Suspense } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { ROUTES } from '@/app/nav'
import { AppChrome } from '@/app/AppShell'
import { buttonClass } from '@/components/ui/button'
import { FullPageSpinner } from '@/components/ui/spinner'
import { Skeleton } from '@/components/ui/misc'
import { useProject } from '@/lib/local/hooks'
import { useTitle } from '@/lib/useTitle'
import { JobView } from '@/features/jobs/JobPage'
import { selectedTake } from './model'

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
  useTitle(video.data?.name ?? 'Video')

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
  return (
    <div className="min-h-dvh bg-canvas">
      <VideoBar title={video.data?.name ?? null} />
      {video.data && take ? (
        // Keyed by take: another take starts with a fresh status feed.
        <JobView key={take.jobId} id={take.jobId} video={video.data} />
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
