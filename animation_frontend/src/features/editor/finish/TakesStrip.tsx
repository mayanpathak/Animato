// Takes strip (plan 6.6, simple mode): every take of the video with its
// status. A finished take becomes the main clip in one click; "+ Another
// take" renders the same prompt again on this video.
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusChip } from '@/components/ui/misc'
import { cn } from '@/lib/cn'
import { useMediaLibrary, useOwner } from '@/lib/local/hooks'
import type { Take } from '@/lib/local/models'
import { toast } from '@/stores/toast'
import { useAnotherTake } from '@/features/videos/useAnotherTake'
import { importJobVideo } from '../projects'
import { MAIN_VIDEO } from '../model/timelineV2'
import { useEditor } from '../store'
import { posterOf } from './poster'

export function TakesStrip() {
  const project = useEditor((s) => s.project)
  const timeline = useEditor((s) => s.timeline)
  const assets = useEditor((s) => s.assets)
  const owner = useOwner()
  const library = useMediaLibrary()
  const another = useAnotherTake(project?.id ?? '')
  const [loading, setLoading] = useState<string | null>(null)
  if (!project || !timeline) return null
  const takes = project.takes ?? []
  const mainAsset = assets.get(timeline.clips.find((c) => c.trackId === MAIN_VIDEO)?.assetId ?? '')
  const assetOf = (t: Take) => library.data?.find((a) => a.jobId === t.jobId) ?? null

  const choose = async (t: Take) => {
    if (mainAsset?.jobId === t.jobId) return
    setLoading(t.jobId)
    try {
      const asset = assetOf(t) ?? (await importJobVideo(t.jobId, owner, project.name))
      useEditor.getState().chooseTake(t.jobId, asset)
    } catch (e) {
      toast.error('Could not use that take', e instanceof Error ? e.message : undefined)
    } finally {
      setLoading(null)
    }
  }

  const latest = takes[takes.length - 1]
  return (
    <div className="flex h-full items-center gap-3 overflow-x-auto px-4" data-testid="takes-strip">
      <span className="shrink-0 text-2xs font-semibold tracking-wide text-fg-subtle uppercase">Takes</span>
      {takes.map((t, i) => {
        const asset = assetOf(t)
        const active = mainAsset?.jobId === t.jobId
        const ready = t.status === 'Completed'
        return (
          <button
            key={t.jobId}
            type="button"
            disabled={!ready || loading !== null}
            aria-pressed={active}
            aria-label={`Take ${i + 1}${active ? ', in use' : ''}`}
            onClick={() => void choose(t)}
            data-testid="take"
            className={cn(
              'relative h-16 w-28 shrink-0 overflow-hidden rounded-lg border bg-surface-2 transition-colors disabled:cursor-default',
              active ? 'border-accent ring-1 ring-accent' : 'border-line hover:border-line-strong',
            )}
          >
            {posterOf(asset) ? (
              <img src={posterOf(asset) ?? ''} alt="" className="size-full object-cover" draggable={false} />
            ) : null}
            <span className="absolute top-1 left-1 rounded bg-black/60 px-1 font-mono text-[10px] text-white">
              {i + 1}
            </span>
            {t.status === 'Failed' ? (
              <StatusChip status="Failed" className="absolute right-1 bottom-1 scale-90" />
            ) : !t.status ? (
              <StatusChip status="Rendering" className="absolute right-1 bottom-1 scale-90" />
            ) : null}
            {loading === t.jobId ? <span className="absolute inset-0 animate-pulse bg-white/10" /> : null}
          </button>
        )
      })}
      {latest ? (
        <div className="flex shrink-0 flex-col items-start gap-0.5">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Plus className="size-3.5" />}
            loading={another.pending}
            onClick={() => void another.start(latest, 'another')}
            data-testid="another-take"
          >
            Another take
          </Button>
          <span className="text-2xs text-fg-subtle">{another.error ?? 'Uses 1 of your renders'}</span>
        </div>
      ) : null}
    </div>
  )
}
