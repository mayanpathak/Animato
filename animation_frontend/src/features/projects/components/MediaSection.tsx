import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { AudioLines, Film, ImageIcon, RefreshCw, Trash2 } from 'lucide-react'
import { Badge, EmptyState, ErrorState, Skeleton } from '@/components/ui/misc'
import { Button, IconButton } from '@/components/ui/button'
import { useMediaLibrary, useProjects } from '@/lib/local/hooks'
import type { MediaAsset } from '@/lib/local/models'
import { formatBytes, formatDuration, timeAgo } from '@/lib/format'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { toast } from '@/stores/toast'
import { useProjectActions } from '../actions'
import { assetUsage } from '../lib'
import { ConfirmDialog } from './ProjectDialogs'

const KIND_ICON = { video: Film, audio: AudioLines, image: ImageIcon } as const

export function MediaSection() {
  const media = useMediaLibrary()
  const projects = useProjects()
  const actions = useProjectActions()
  const reduced = useReducedMotion()
  const [pending, setPending] = useState<MediaAsset | null>(null)
  const usage = useMemo(() => assetUsage(projects.data ?? []), [projects.data])
  const total = useMemo(() => (media.data ?? []).reduce((s, a) => s + a.size, 0), [media.data])

  if (media.isPending) {
    return (
      <div className="flex flex-col gap-2" aria-busy>
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
    )
  }
  if (media.isError) {
    return (
      <ErrorState
        title="Could not read your media library"
        body="This browser's storage did not answer. Private windows and some privacy settings block it."
        action={
          <Button
            variant="secondary"
            leftIcon={<RefreshCw className="size-4" />}
            onClick={() => media.refetch()}
          >
            Try again
          </Button>
        }
      />
    )
  }
  const list = media.data
  if (list.length === 0) {
    return (
      <EmptyState
        icon={<Film />}
        title="No media yet"
        body="Renders you add to a project and files you import in the editor are kept here, in this browser, so they never upload anywhere."
      />
    )
  }

  const pendingUse = pending ? (usage.get(pending.id) ?? 0) : 0

  return (
    <section aria-label="Media library">
      <p className="mb-3 text-xs text-fg-subtle">
        {list.length} {list.length === 1 ? 'file' : 'files'} ·{' '}
        <span className="font-mono">{formatBytes(total)}</span> in this browser
      </p>
      <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface-1">
        <AnimatePresence initial={false}>
          {list.map((asset) => {
            const Icon = KIND_ICON[asset.kind]
            const used = usage.get(asset.id) ?? 0
            const codec = asset.videoCodec ?? asset.audioCodec
            return (
              <motion.li
                key={asset.id}
                layout={!reduced}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-3 px-3 py-2.5"
              >
                <div className="relative grid aspect-video w-20 shrink-0 place-items-center overflow-hidden rounded-md border border-line bg-surface-2 text-fg-subtle sm:w-24">
                  {asset.thumbnails[0] ? (
                    <img src={asset.thumbnails[0]} alt="" className="size-full object-cover" loading="lazy" />
                  ) : (
                    <Icon className="size-4" aria-hidden />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-fg" title={asset.name}>
                    {asset.name}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-2xs text-fg-subtle">
                    <span className="inline-flex items-center gap-1 capitalize">
                      <Icon className="size-3" aria-hidden /> {asset.kind}
                    </span>
                    {asset.kind !== 'image' ? (
                      <span className="font-mono tabular-nums">{formatDuration(asset.duration)}</span>
                    ) : null}
                    {asset.width > 0 ? (
                      <span className="font-mono tabular-nums">
                        {asset.width}×{asset.height}
                      </span>
                    ) : null}
                    <span className="font-mono tabular-nums">{formatBytes(asset.size)}</span>
                    {codec ? <span className="hidden font-mono sm:inline">{codec}</span> : null}
                    <span className="hidden md:inline">Added {timeAgo(asset.createdAt)}</span>
                  </div>
                </div>
                <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
                  {asset.demuxer !== 'image' ? (
                    <Badge tone={asset.demuxer === 'offcut-mp4' ? 'accent' : 'neutral'} className="font-mono">
                      {asset.demuxer}
                    </Badge>
                  ) : null}
                  <Badge tone={used ? 'succeeded' : 'neutral'}>
                    {used ? `In ${used} ${used === 1 ? 'project' : 'projects'}` : 'Unused'}
                  </Badge>
                </div>
                <IconButton label={`Delete ${asset.name}`} size="sm" onClick={() => setPending(asset)}>
                  <Trash2 />
                </IconButton>
              </motion.li>
            )
          })}
        </AnimatePresence>
      </ul>

      <ConfirmDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        title="Delete this media file?"
        confirmLabel="Delete file"
        body={
          <>
            <p>
              <span className="font-medium text-fg">{pending?.name}</span> (
              <span className="font-mono">{formatBytes(pending?.size)}</span>) will be removed from this
              browser.
            </p>
            {pendingUse > 0 ? (
              <p className="mt-3 rounded-lg border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-status-warning">
                Used by {pendingUse} {pendingUse === 1 ? 'project' : 'projects'}. Those clips will show as
                offline media until you import the file again.
              </p>
            ) : null}
          </>
        }
        onConfirm={async () => {
          if (!pending) return
          await actions.removeMedia(pending)
          toast.success('Media deleted', pending.name)
        }}
      />
    </section>
  )
}
