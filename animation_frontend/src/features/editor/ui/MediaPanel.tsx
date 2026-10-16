import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { FileAudio, FileVideo, ImageIcon, Plus, Sparkles, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/misc'
import { useJobHistory, useOwner } from '@/lib/local/hooks'
import type { MediaAsset } from '@/lib/local/models'
import { formatBytes, formatDuration, timeAgo } from '@/lib/format'
import { toast } from '@/stores/toast'
import { cn } from '@/lib/cn'
import { useQueryClient } from '@tanstack/react-query'
import { importFile, type ImportStage } from '../media/client'
import { importJobVideo } from '../projects'
import { useEditor } from '../store'
import { ASSET_MIME } from './Timeline'

const ACCEPT =
  'video/mp4,video/quicktime,video/webm,audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a,audio/webm,audio/ogg,image/png,image/jpeg,.mp4,.mov,.webm,.mp3,.wav,.m4a,.png,.jpg,.jpeg'

interface Pending {
  key: string
  name: string
  stage: ImportStage
  fraction: number
}

const STAGE_LABEL: Record<ImportStage, string> = {
  copy: 'Copying into private storage',
  probe: 'Reading container',
  thumbnails: 'Decoding thumbnails',
  waveform: 'Building waveform',
}

function KindIcon({ kind }: { kind: MediaAsset['kind'] }) {
  return kind === 'audio' ? <FileAudio /> : kind === 'image' ? <ImageIcon /> : <FileVideo />
}

export function MediaPanel({ library }: { library: MediaAsset[] }) {
  const owner = useOwner()
  const qc = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<Pending[]>([])
  const [dragOver, setDragOver] = useState(false)
  const addAsset = useEditor((s) => s.addAsset)
  const jobs = useJobHistory()

  const ingest = async (files: File[], addToTimeline: boolean) => {
    for (const file of files) {
      const key = `${file.name}-${file.size}-${Math.random()}`
      setPending((p) => [...p, { key, name: file.name, stage: 'copy', fraction: 0 }])
      try {
        const asset = await importFile(file, { owner, name: file.name }, (stage, fraction) =>
          setPending((p) => p.map((x) => (x.key === key ? { ...x, stage, fraction } : x))),
        )
        await qc.invalidateQueries({ queryKey: ['media', owner] })
        if (addToTimeline) addAsset(asset)
        else useEditor.getState().setAssets([...useEditor.getState().assets.values(), asset])
      } catch (e) {
        toast.error(`Could not import ${file.name}`, e instanceof Error ? e.message : undefined)
      } finally {
        setPending((p) => p.filter((x) => x.key !== key))
      }
    }
  }

  const fromJob = async (jobId: string, prompt: string) => {
    const key = `job-${jobId}`
    setPending((p) => [...p, { key, name: prompt, stage: 'copy', fraction: 0 }])
    try {
      const asset = await importJobVideo(jobId, owner, prompt.slice(0, 48), (stage, fraction) =>
        setPending((p) => p.map((x) => (x.key === key ? { ...x, stage, fraction } : x))),
      )
      await qc.invalidateQueries({ queryKey: ['media', owner] })
      addAsset(asset)
    } catch (e) {
      toast.error('Could not add that render', e instanceof Error ? e.message : undefined)
    } finally {
      setPending((p) => p.filter((x) => x.key !== key))
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="p-3">
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes('Files')) {
              e.preventDefault()
              setDragOver(true)
            }
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            void ingest([...e.dataTransfer.files], true)
          }}
          className={cn(
            'flex w-full flex-col items-center gap-1.5 rounded-xl border border-dashed px-3 py-5 text-center transition-colors',
            dragOver
              ? 'border-accent bg-accent-soft'
              : 'border-line-strong hover:border-fg-faint hover:bg-surface-2',
          )}
        >
          <Upload className="size-4 text-accent" />
          <span className="text-sm font-medium">Import media</span>
          <span className="text-2xs text-fg-subtle">
            Drop or pick MP4, MOV, WebM, MP3, WAV, M4A, PNG, JPG. Files stay in this browser.
          </span>
        </button>
        <input
          ref={input}
          type="file"
          multiple
          accept={ACCEPT}
          className="sr-only"
          data-testid="media-import-input"
          onChange={(e) => {
            const files = [...(e.target.files ?? [])]
            e.target.value = ''
            void ingest(files, true)
          }}
        />
      </div>
      <AnimatePresence initial={false}>
        {pending.map((p) => (
          <motion.div
            key={p.key}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-3 pb-2"
            data-testid="import-progress"
          >
            <div className="rounded-lg border border-line bg-surface-2 p-2.5">
              <p className="truncate text-xs font-medium">{p.name}</p>
              <p className="mt-0.5 text-2xs text-fg-subtle">{STAGE_LABEL[p.stage]}</p>
              <Progress value={p.fraction} className="mt-2 h-1" label={`Importing ${p.name}`} />
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        <h3 className="mb-2 text-2xs font-semibold tracking-wide text-fg-faint uppercase">In this browser</h3>
        {library.length === 0 ? (
          <p className="rounded-lg border border-line bg-surface-1 p-3 text-xs text-fg-subtle">
            No media yet. Import a file or add one of your renders below.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-2" data-testid="media-library">
            {library.map((a) => (
              <li key={a.id}>
                <div
                  draggable
                  onDragStart={(e) => {
                    useEditor
                      .getState()
                      .setAssets([...new Map([...useEditor.getState().assets, [a.id, a]]).values()])
                    e.dataTransfer.setData(ASSET_MIME, a.id)
                    e.dataTransfer.effectAllowed = 'copy'
                  }}
                  className="group relative cursor-grab overflow-hidden rounded-lg border border-line bg-surface-2 active:cursor-grabbing"
                  title={`${a.name} · ${a.demuxer} · ${formatBytes(a.size)}`}
                >
                  <div className="relative aspect-video bg-surface-3">
                    {a.thumbnails[0] ? (
                      <img
                        src={a.thumbnails[0]}
                        alt=""
                        className="h-full w-full object-cover"
                        draggable={false}
                      />
                    ) : (
                      <div className="grid h-full place-items-center text-fg-faint [&_svg]:size-5">
                        <KindIcon kind={a.kind} />
                      </div>
                    )}
                    {a.duration ? (
                      <span className="absolute right-1 bottom-1 rounded bg-black/70 px-1 font-mono text-[10px] text-white">
                        {formatDuration(a.duration)}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      aria-label={`Add ${a.name} to the timeline`}
                      onClick={() => addAsset(a)}
                      className="absolute top-1 right-1 grid size-6 place-items-center rounded-md bg-black/70 text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 [&_svg]:size-3.5"
                    >
                      <Plus />
                    </button>
                  </div>
                  <p className="truncate px-2 py-1.5 text-2xs text-fg-muted">{a.name}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <h3 className="mt-5 mb-2 flex items-center gap-1.5 text-2xs font-semibold tracking-wide text-fg-faint uppercase">
          <Sparkles className="size-3" /> From your renders
        </h3>
        {jobs.data?.length ? (
          <ul className="space-y-1.5">
            {jobs.data.slice(0, 8).map((j) => (
              <li
                key={j.id}
                className="flex items-center gap-2 rounded-lg border border-line bg-surface-1 p-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs">{j.prompt}</p>
                  <p className="text-2xs text-fg-faint">
                    {j.library} · {timeAgo(j.createdAt)}
                  </p>
                </div>
                <Button size="xs" variant="secondary" onClick={() => void fromJob(j.id, j.prompt)}>
                  Add
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-fg-subtle">Renders you generate in Create show up here.</p>
        )}
      </div>
    </div>
  )
}
