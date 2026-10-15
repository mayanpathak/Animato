import { videoUrl } from '../../lib/api'
import { findActiveJob, useStudioStore } from '../../store/studioStore'
import { STATUS_LABELS, type Job } from '../../types'
import { Button, Spinner } from '../ui'

function Stage({ job }: { job: Job | undefined }) {
  const markVideoMissing = useStudioStore((state) => state.markVideoMissing)

  if (!job) {
    return <p className="text-sm text-zinc-400">No video yet. Describe one in the chat.</p>
  }

  if (job.status === 'Failed') {
    return <p className="text-sm text-red-300">This video could not be generated.</p>
  }

  if (job.status !== 'Completed') {
    return (
      <div className="flex flex-col items-center gap-3 text-sm text-zinc-300">
        <Spinner className="h-8 w-8" />
        {STATUS_LABELS[job.status]}…
      </div>
    )
  }

  if (job.videoMissing) {
    return (
      <p className="max-w-xs text-center text-sm text-zinc-400">
        The video file is not available. It may have expired, or the server is not serving videos
        yet.
      </p>
    )
  }

  // Served through the API so the session decides who may watch it.
  return (
    <video
      key={job.jobId}
      src={videoUrl(job.jobId)}
      controls
      playsInline
      onError={() => markVideoMissing(job.jobId)}
      className="h-full w-full bg-black"
    />
  )
}

export function CurrentVideo() {
  const jobs = useStudioStore((state) => state.jobs)
  const currentId = useStudioStore((state) => state.currentId)
  const newVideo = useStudioStore((state) => state.newVideo)

  const current = jobs.find((job) => job.jobId === currentId)
  const rendering = findActiveJob(jobs) !== undefined

  return (
    <section className="flex flex-col rounded-lg border border-zinc-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Current video</h2>

        {/* Empties this panel; the video that was here moves to the asset bin. */}
        <Button variant="secondary" onClick={newVideo} disabled={!current || rendering}>
          New video
        </Button>
      </div>

      <div className="flex aspect-video w-full items-center justify-center overflow-hidden rounded-md bg-zinc-900">
        <Stage job={current} />
      </div>

      {current && (
        <p className="mt-3 whitespace-pre-wrap break-words text-sm text-zinc-600">
          {current.prompt}
        </p>
      )}
    </section>
  )
}
