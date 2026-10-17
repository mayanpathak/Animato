// "In this video" (plan 6.6 Assets rail, 13.2): the main clip, B-roll slots
// "Clip 1, Clip 2, …" with a note and Insert at playhead, "Generate a clip"
// (a new render that lands in the next slot when ready), then music and
// voice. Labels are stable; notes are kept for the assistant (section 13).
import { useEffect, useRef, useState } from 'react'
import { AudioLines, Clapperboard, Plus, Sparkles } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/field'
import { StatusChip } from '@/components/ui/misc'
import { useJob, useOwner, useProject } from '@/lib/local/hooks'
import type { AssetRole, MediaAsset, Take, VideoAsset } from '@/lib/local/models'
import { formatDuration } from '@/lib/format'
import { toast } from '@/stores/toast'
import { useStartVideo } from '@/features/create/useStartVideo'
import { markBrollImported } from '@/features/videos/model'
import { importJobVideo } from '../projects'
import { useEditor } from '../store'

const ORDER: AssetRole[] = ['main', 'broll', 'music', 'voice', 'logo']
const HEADING: Record<AssetRole, string> = {
  main: 'Main',
  broll: 'B-roll',
  music: 'Music',
  voice: 'Voice',
  logo: 'Logo',
}

function AssetRow({ r, asset }: { r: VideoAsset; asset: MediaAsset | undefined }) {
  const [note, setNote] = useState(r.note)
  // The middle frame: renders often open on a dark first frame.
  const thumb = asset?.thumbnails[Math.floor((asset?.thumbnails.length ?? 0) / 2)]
  return (
    <li
      className="rounded-lg border border-line bg-surface-1 p-2"
      data-testid="video-asset"
      data-role={r.role}
    >
      <div className="flex items-center gap-2">
        <div className="aspect-video w-14 shrink-0 overflow-hidden rounded bg-surface-3">
          {thumb ? (
            <img src={thumb} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full place-items-center text-fg-subtle [&_svg]:size-4">
              {asset?.kind === 'audio' ? <AudioLines /> : <Clapperboard />}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium" data-testid="asset-label">
            {r.label}
          </p>
          <p className="truncate text-2xs text-fg-subtle">
            {asset ? `${asset.name} · ${formatDuration(asset.duration)}` : 'Not in this browser'}
          </p>
        </div>
        {r.role === 'broll' && asset ? (
          <Button
            size="xs"
            variant="secondary"
            onClick={() => useEditor.getState().insertBroll(asset)}
            data-testid="insert-broll"
          >
            Insert at playhead
          </Button>
        ) : null}
      </div>
      {r.role === 'broll' || r.role === 'main' ? (
        <Textarea
          aria-label={`Note for ${r.label}`}
          placeholder="What is this clip?"
          rows={1}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => {
            if (note !== r.note) useEditor.getState().updateAssetRef(r.assetId, { note })
          }}
          className="mt-2 min-h-7 resize-none text-xs"
        />
      ) : null}
    </li>
  )
}

/** A B-roll render still on its way; when it finishes it is imported into the next slot. */
function PendingBroll({ take, videoId }: { take: Take; videoId: string }) {
  const job = useJob(take.status ? undefined : take.jobId)
  const owner = useOwner()
  const qc = useQueryClient()
  const status = take.status ?? job.data?.status ?? 'Pending'
  const started = useRef(false)
  useEffect(() => {
    if (status !== 'Completed' || started.current) return
    started.current = true
    void importJobVideo(take.jobId, owner, take.prompt.slice(0, 48))
      .then((asset) => {
        // Not awaited: a refetch elsewhere can take long; the slot does not depend on it.
        void qc.invalidateQueries({ queryKey: ['media', owner] })
        const known = useEditor.getState().project?.assets?.find((r) => r.assetId === asset.id)
        useEditor.getState().addBrollSlot(asset)
        void markBrollImported(videoId, take.jobId, asset.id)
        if (known && known.role !== 'broll')
          toast.info('That clip is already in this video', `The render is the same file as ${known.label}.`)
        else toast.success('Your clip is ready', 'It is in the next B-roll slot.')
      })
      .catch((e: unknown) =>
        toast.error('Could not bring the clip in', e instanceof Error ? e.message : undefined),
      )
  }, [status, take.jobId, take.prompt, owner, qc, videoId])
  return (
    <li
      className="flex items-center gap-2 rounded-lg border border-dashed border-line-strong p-2"
      data-testid="broll-pending"
    >
      <p className="min-w-0 flex-1 truncate text-xs text-fg-muted">{take.prompt}</p>
      <StatusChip status={status} />
    </li>
  )
}

function GenerateClip({ videoId }: { videoId: string }) {
  const [open, setOpen] = useState(false)
  const [prompt, setPrompt] = useState('')
  const { start, pending, error, clearError } = useStartVideo()
  if (!open)
    return (
      <Button
        size="sm"
        variant="ghost"
        className="w-full"
        leftIcon={<Sparkles className="size-3.5" />}
        onClick={() => setOpen(true)}
        data-testid="generate-clip"
      >
        Generate a clip
      </Button>
    )
  return (
    <form
      className="space-y-2 rounded-lg border border-line bg-surface-2 p-2"
      onSubmit={(e) => {
        e.preventDefault()
        void start(prompt, 'auto', undefined, { brollFor: videoId }).then((ok) => {
          if (!ok) return
          setPrompt('')
          setOpen(false)
          toast.info('Generating your clip', 'It lands in the next B-roll slot when it is ready.')
        })
      }}
    >
      <Textarea
        aria-label="Describe the clip"
        placeholder="A bar chart growing year by year"
        rows={2}
        value={prompt}
        autoFocus
        onChange={(e) => {
          setPrompt(e.target.value)
          if (error) clearError()
        }}
        className="text-xs"
        data-testid="generate-clip-prompt"
      />
      {error ? (
        <p role="alert" className="text-2xs text-status-failed">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button size="xs" variant="ghost" type="button" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button
          size="xs"
          type="submit"
          loading={pending}
          disabled={!prompt.trim()}
          data-testid="generate-clip-submit"
        >
          Generate
        </Button>
      </div>
    </form>
  )
}

export function VideoAssets() {
  const project = useEditor((s) => s.project)
  const assets = useEditor((s) => s.assets)
  // The stored record: B-roll renders are added to it by the job flow.
  const stored = useProject(project?.id)
  if (!project) return null
  const refs = project.assets ?? []
  const brollJobs = (stored.data?.broll ?? []).filter(
    (t) => !t.assetId && !refs.some((r) => assets.get(r.assetId)?.jobId === t.jobId) && t.status !== 'Failed',
  )
  const failed = (stored.data?.broll ?? []).filter((t) => t.status === 'Failed')
  return (
    <section className="space-y-4 px-3 pb-3" data-testid="video-assets">
      {ORDER.map((role) => {
        const list = refs.filter((r) => r.role === role)
        if (role !== 'broll' && !list.length) return null
        return (
          <div key={role}>
            <h3 className="mb-2 flex items-center gap-1.5 text-2xs font-semibold tracking-wide text-fg-subtle uppercase">
              {role === 'broll' ? <Clapperboard className="size-3" /> : null}
              {HEADING[role]}
            </h3>
            <ul className="space-y-1.5">
              {list.map((r) => (
                <AssetRow key={`${r.assetId}:${r.note}`} r={r} asset={assets.get(r.assetId)} />
              ))}
              {role === 'broll'
                ? brollJobs.map((t) => <PendingBroll key={t.jobId} take={t} videoId={project.id} />)
                : null}
            </ul>
            {role === 'broll' ? (
              <div className="mt-2 space-y-1.5">
                {!list.length && !brollJobs.length ? (
                  <p className="flex items-center gap-1.5 text-2xs text-fg-subtle">
                    <Plus className="size-3" /> Add a clip from the library below, or generate one.
                  </p>
                ) : null}
                {failed.length ? (
                  <p className="text-2xs text-status-failed">
                    {failed.length === 1 ? 'One clip' : `${failed.length} clips`} did not render.
                  </p>
                ) : null}
                <GenerateClip videoId={project.id} />
              </div>
            ) : null}
          </div>
        )
      })}
    </section>
  )
}
