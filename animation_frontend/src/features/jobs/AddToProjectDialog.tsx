import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Check, Film, FolderPlus } from 'lucide-react'
import { Button, buttonClass } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/misc'
import { Spinner } from '@/components/ui/spinner'
import { errorMessage } from '@/lib/api/http'
import { timeAgo } from '@/lib/format'
import { keys, useOwner, useProjects } from '@/lib/local/hooks'
import { addJobToProject } from '@/features/editor/projects'
import { toast } from '@/stores/toast'

export function AddToProjectDialog({
  open,
  onClose,
  jobId,
  clipName,
  onCreateNew,
  creatingNew,
}: {
  open: boolean
  onClose: () => void
  jobId: string
  clipName: string
  onCreateNew: () => void
  creatingNew: boolean
}) {
  const owner = useOwner()
  const projects = useProjects()
  const qc = useQueryClient()
  const [busy, setBusy] = useState<string | null>(null)
  const [added, setAdded] = useState<Record<string, true>>({})

  const add = async (projectId: string, name: string) => {
    if (busy) return
    setBusy(projectId)
    try {
      const p = await addJobToProject(jobId, projectId, owner, clipName)
      qc.setQueryData(keys.project(p.id), p)
      void qc.invalidateQueries({ queryKey: keys.projects(owner) })
      void qc.invalidateQueries({ queryKey: keys.media(owner) })
      setAdded((a) => ({ ...a, [projectId]: true }))
      toast.success(`Added to ${name}`, 'The clip sits at the end of the video track.')
    } catch (e) {
      toast.error('Could not add the video', errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const list = projects.data ?? []

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add to project"
      description="The video is downloaded into this browser once and appended to the project's video track."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Done
          </Button>
          <Button
            variant="secondary"
            onClick={onCreateNew}
            loading={creatingNew}
            leftIcon={<FolderPlus className="size-4" />}
          >
            New project
          </Button>
        </>
      }
    >
      {projects.isPending ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="py-8 text-center">
          <div className="mx-auto grid size-11 place-items-center rounded-xl border border-line bg-surface-2 text-accent">
            <Film className="size-5" />
          </div>
          <p className="mt-3 text-sm font-medium">No projects yet</p>
          <p className="mt-1 text-xs text-fg-subtle">
            Start one from this video, or create an empty one in Projects.
          </p>
          <Link to="/app/projects?new=1" className={buttonClass('link', 'sm', 'mt-2')}>
            Go to Projects
          </Link>
        </div>
      ) : (
        <ul className="-mx-2 space-y-1">
          {list.map((p) => {
            const done = added[p.id]
            const clips = p.timeline.tracks.reduce((n, t) => n + t.clips.length, 0)
            return (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void add(p.id, p.name)}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-2 disabled:cursor-wait"
                >
                  <span className="relative aspect-video w-16 shrink-0 overflow-hidden rounded-md border border-line bg-gradient-accent-soft">
                    {p.thumbnail ? <img src={p.thumbnail} alt="" className="size-full object-cover" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-fg">{p.name}</span>
                    <span className="block text-2xs text-fg-subtle">
                      {clips} {clips === 1 ? 'clip' : 'clips'} · edited {timeAgo(p.updatedAt)}
                    </span>
                  </span>
                  <span className="grid size-7 shrink-0 place-items-center text-fg-subtle">
                    {busy === p.id ? (
                      <Spinner className="size-4" label="Adding" />
                    ) : done ? (
                      <Check className="size-4 text-status-succeeded" aria-label="Added" />
                    ) : (
                      <span className="text-xs text-accent">Add</span>
                    )}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Dialog>
  )
}
