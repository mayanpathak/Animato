import { useStudioStore } from '../../store/studioStore'
import { STATUS_LABELS } from '../../types'

export function AssetBin() {
  const jobs = useStudioStore((state) => state.jobs)
  const currentId = useStudioStore((state) => state.currentId)
  const selectJob = useStudioStore((state) => state.selectJob)

  // Everything that is not in the current-video panel, newest first.
  const assets = jobs.filter((job) => job.jobId !== currentId).reverse()

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold">Video assets</h2>

      {assets.length === 0 ? (
        <p className="text-sm text-zinc-500">Earlier videos appear here.</p>
      ) : (
        <ul className="flex gap-3 overflow-x-auto pb-1">
          {assets.map((job) => (
            <li key={job.jobId} className="shrink-0">
              <button
                type="button"
                onClick={() => selectJob(job.jobId)}
                title="Open in the current video panel"
                className="flex h-24 w-44 flex-col justify-between rounded-md border border-zinc-200 bg-zinc-50 p-2 text-left hover:border-zinc-900"
              >
                <span className="line-clamp-2 break-words text-xs text-zinc-800">{job.prompt}</span>

                <span className="flex items-center justify-between text-xs text-zinc-500">
                  <span className="capitalize">{job.library}</span>
                  <span className={job.status === 'Failed' ? 'text-red-600' : ''}>
                    {STATUS_LABELS[job.status]}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
