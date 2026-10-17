// /app — every video, newest first, with the composer on top (plan 6.3).
import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ConfirmDialog, RenameDialog } from '@/components/ui/confirm'
import { Skeleton } from '@/components/ui/misc'
import { keys, useOwner, useProjects } from '@/lib/local/hooks'
import { exportsTable, projectsTable, uid, type Project } from '@/lib/local/models'
import { removeFile } from '@/lib/local/opfs'
import { useTitle } from '@/lib/useTitle'
import { toast } from '@/stores/toast'
import { STARTERS } from '@/features/create/starters'
import { ComposerStrip } from './ComposerStrip'
import { VideoCard } from './VideoCard'
import { announceVideosChanged, VIDEOS_CHANNEL } from './model'

/** Refresh the grid when another tab creates or changes a video. */
function useCrossTabRefresh(owner: string) {
  const qc = useQueryClient()
  useEffect(() => {
    let ch: BroadcastChannel | null = null
    try {
      ch = new BroadcastChannel(VIDEOS_CHANNEL)
      ch.onmessage = () => void qc.invalidateQueries({ queryKey: keys.projects(owner) })
    } catch {
      // no BroadcastChannel: the query refetches on window focus
    }
    return () => ch?.close()
  }, [qc, owner])
}

function PersistBanner() {
  const persisted = useQuery({
    queryKey: ['storage-persisted'],
    queryFn: async () => (await navigator.storage?.persisted?.()) ?? true,
    staleTime: Infinity,
  })
  const qc = useQueryClient()
  if (persisted.data !== false) return null
  return (
    <p className="mt-4 text-center text-sm text-fg-subtle">
      Your browser may clear stored videos when space runs low.{' '}
      <button
        type="button"
        className="text-fg underline underline-offset-4 hover:text-accent"
        onClick={async () => {
          const ok = (await navigator.storage?.persist?.()) ?? false
          if (!ok) toast.info('The browser said no', 'It may decide on its own as you use Animato more.')
          void qc.invalidateQueries({ queryKey: ['storage-persisted'] })
        }}
      >
        Keep my videos
      </button>
    </p>
  )
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-busy>
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i}>
          <Skeleton className="aspect-video rounded-lg" />
          <Skeleton className="mt-3 h-4 w-3/4" />
          <Skeleton className="mt-2 h-3 w-1/3" />
        </div>
      ))}
    </div>
  )
}

function EmptyVideos({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <section aria-labelledby="empty-h" className="mt-4">
      <h2 id="empty-h" className="text-fg-muted">
        Describe an idea above, or start from one of these.
      </h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        {STARTERS.slice(0, 3).map((s) => (
          <button
            key={s.id}
            type="button"
            data-testid="empty-starter"
            onClick={() => onPick(s.prompt)}
            className="rounded-xl border border-line bg-surface-1 p-5 text-left shadow-inner-highlight transition-[transform,box-shadow,border-color] duration-[var(--duration-fast)] hover:-translate-y-px hover:border-line-strong hover:shadow-md"
          >
            <span className="text-xs text-fg-subtle">{s.library === 'manim' ? 'Explainer' : 'Motion'}</span>
            <span className="mt-1 block font-medium text-fg">{s.title}</span>
            <span className="mt-2 line-clamp-3 block text-sm text-fg-muted">{s.prompt}</span>
          </button>
        ))}
      </div>
      <p className="mt-8 text-sm text-fg-subtle">Your videos are stored in this browser.</p>
    </section>
  )
}

export default function VideosPage() {
  useTitle('Videos')
  const owner = useOwner()
  const qc = useQueryClient()
  const videos = useProjects()
  const [renaming, setRenaming] = useState<Project | null>(null)
  const [deleting, setDeleting] = useState<Project | null>(null)
  const [composerKey, setComposerKey] = useState(0)
  const [seed, setSeed] = useState('')
  useCrossTabRefresh(owner)

  const list = useMemo(
    () => [...(videos.data ?? [])].sort((a, b) => b.createdAt - a.createdAt),
    [videos.data],
  )

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: keys.projects(owner) })
    announceVideosChanged()
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 pb-24 sm:px-6 sm:pt-10">
      <h1 className="sr-only">Videos</h1>
      <div className="mx-auto max-w-3xl">
        <ComposerStrip key={composerKey} initial={seed} />
      </div>
      <PersistBanner />

      <div className="mt-14">
        {videos.isPending ? (
          <GridSkeleton />
        ) : list.length === 0 ? (
          <EmptyVideos
            onPick={(prompt) => {
              setSeed(prompt)
              setComposerKey((k) => k + 1)
              window.scrollTo({ top: 0 })
            }}
          />
        ) : (
          <>
            <h2 className="mb-6 font-display text-xl font-semibold tracking-tight">Your videos</h2>
            <div
              className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              data-testid="videos-grid"
            >
              {list.map((v, i) => (
                // Past 60 cards the browser skips layout and paint off screen (plan 6.3).
                <div
                  key={v.id}
                  className={
                    i >= 60 ? '[content-visibility:auto] [contain-intrinsic-size:auto_320px]' : undefined
                  }
                >
                  <VideoCard
                    video={v}
                    onRename={() => setRenaming(v)}
                    onDelete={() => setDeleting(v)}
                    onDuplicate={async () => {
                      const now = Date.now()
                      await projectsTable.put({
                        ...structuredClone(v),
                        id: uid('vid'),
                        name: `${v.name} (copy)`,
                        createdAt: now,
                        updatedAt: now,
                      })
                      await refresh()
                    }}
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <RenameDialog
        open={renaming !== null}
        onClose={() => setRenaming(null)}
        title="Rename video"
        initial={renaming?.name ?? ''}
        onSave={async (name) => {
          if (!renaming) return
          const next = { ...renaming, name, updatedAt: Date.now() }
          await projectsTable.put(next)
          qc.setQueryData(keys.project(next.id), next)
          await refresh()
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={`Delete “${deleting?.name ?? ''}”?`}
        body="This removes the video’s edits and exports from this browser. The render on Animato’s server is not deleted."
        confirmLabel="Delete"
        testId="video-delete-confirm"
        onConfirm={async () => {
          if (!deleting) return
          for (const e of await exportsTable.all())
            if (e.projectId === deleting.id) {
              await removeFile(e.path)
              await exportsTable.remove(e.id)
            }
          await projectsTable.remove(deleting.id)
          qc.removeQueries({ queryKey: keys.project(deleting.id) })
          await refresh()
        }}
      />
    </div>
  )
}
