// One video in the grid (plan 6.3, 7.4): the media at the video's format
// aspect, title below, a status chip only when not ready, format badge.
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Copy, MoreHorizontal, Pencil, Sparkles, Trash2 } from 'lucide-react'
import { ROUTES } from '@/app/nav'
import { Menu } from '@/components/ui/menu'
import { StatusChip } from '@/components/ui/misc'
import { jobsApi } from '@/lib/api/jobs'
import { isFinished } from '@/lib/api/types'
import { cn } from '@/lib/cn'
import { timeAgo } from '@/lib/format'
import { useJob } from '@/lib/local/hooks'
import { projectsTable, type Project } from '@/lib/local/models'
import { selectedTake } from './model'

const ASPECT_CLASS = { '16:9': 'aspect-video', '9:16': 'aspect-[9/16]', '1:1': 'aspect-square' } as const

function useElapsed(since: number | undefined, active: boolean): string {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [active])
  if (!since) return ''
  const s = Math.max(0, Math.floor((now - since) / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function VideoCard({
  video,
  onRename,
  onDuplicate,
  onDelete,
}: {
  video: Project
  onRename: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const navigate = useNavigate()
  const take = selectedTake(video)
  // Finished takes are not polled again; running ones share the video page's poller.
  const job = useJob(take && !take.status ? take.jobId : undefined)
  const status = take?.status ?? job.data?.status
  const ready = status === 'Completed'
  const running = Boolean(status && !isFinished(status)) || (Boolean(take) && !status)
  const elapsed = useElapsed(take?.createdAt, running)
  const [hover, setHover] = useState(false)
  const media = useRef<HTMLVideoElement>(null)
  const format = video.format ?? '16:9'
  const href = ROUTES.video(video.id)
  const [captured, setCaptured] = useState<string | null>(null)
  const poster = video.thumbnail ?? captured

  // Draws the loaded frame to a small JPEG and keeps it on the video. A render
  // served without CORS taints the canvas; then the <video> stays the poster.
  const onFrame = (el: HTMLVideoElement) => {
    try {
      const w = 384
      const h = Math.round((w * el.videoHeight) / Math.max(1, el.videoWidth))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d')?.drawImage(el, 0, 0, w, h)
      const url = canvas.toDataURL('image/jpeg', 0.75)
      setCaptured(url)
      void projectsTable.get(video.id).then(async (v) => {
        if (v && !v.thumbnail) await projectsTable.put({ ...v, thumbnail: url })
      })
    } catch {
      // tainted canvas: keep showing the video element
    }
  }

  useEffect(() => {
    const el = media.current
    if (!el) return
    if (hover) void el.play().catch(() => undefined)
    else el.pause()
  }, [hover])

  return (
    <article
      className="group relative"
      data-testid="video-card"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <Link to={href} className="block rounded-lg" aria-label={`Open ${video.name}`}>
        <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-surface-1">
          {poster && format !== '16:9' ? (
            // Vertical and square videos sit on a dimmed, blurred copy of their own frame.
            <img
              src={poster}
              alt=""
              aria-hidden
              className="absolute inset-0 size-full scale-110 object-cover opacity-35 blur-2xl"
            />
          ) : null}
          <div
            className={cn(
              'relative h-full max-w-full overflow-hidden bg-surface-2',
              ASPECT_CLASS[format],
              format === '16:9' ? 'w-full' : 'shadow-md',
            )}
          >
            {poster ? <img src={poster} alt="" className="absolute inset-0 size-full object-cover" /> : null}
            {ready && take && !poster ? (
              // First real frame; captured once into the record when the browser allows it.
              <video
                src={`${jobsApi.videoUrl(take.jobId)}#t=1`}
                muted
                playsInline
                preload="metadata"
                onLoadedData={(e) => onFrame(e.currentTarget)}
                className="absolute inset-0 size-full object-cover"
              />
            ) : null}
            {ready && take && hover ? (
              <video
                ref={media}
                src={jobsApi.videoUrl(take.jobId)}
                muted
                loop
                playsInline
                preload="none"
                className="absolute inset-0 size-full object-cover"
              />
            ) : null}
            {running && !poster ? <div className="skeleton absolute inset-0 opacity-50" /> : null}
          </div>
        </div>
      </Link>
      <div className="mt-3 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <Link
            to={href}
            className="block truncate text-[15px] font-medium text-fg"
            data-testid="video-card-title"
          >
            {video.name}
          </Link>
          <p className="mt-0.5 flex items-center gap-2 text-xs text-fg-subtle">
            {status && !ready ? (
              <span className="inline-flex items-center gap-1.5">
                <StatusChip status={status} />
                {running && elapsed ? <span className="font-mono tabular-nums">{elapsed}</span> : null}
              </span>
            ) : (
              <span>{timeAgo(video.updatedAt)}</span>
            )}
            <span
              aria-label={`Format ${format}`}
              className="rounded-sm border border-line px-1 font-mono text-2xs"
            >
              {format}
            </span>
          </p>
        </div>
        <Menu
          align="end"
          trigger={(p) => (
            <button
              {...p}
              type="button"
              aria-label={`More actions for ${video.name}`}
              className="-mr-1 grid size-8 place-items-center rounded-md text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg [&_svg]:size-4"
            >
              <MoreHorizontal />
            </button>
          )}
          items={[
            { label: 'Rename', icon: <Pencil />, onSelect: onRename },
            { label: 'Duplicate', icon: <Copy />, onSelect: onDuplicate },
            ...(take?.prompt
              ? [
                  {
                    label: 'Remix',
                    icon: <Sparkles />,
                    onSelect: () =>
                      navigate(
                        `${ROUTES.newVideo}?prompt=${encodeURIComponent(take.prompt)}&engine=${take.library}`,
                      ),
                  },
                ]
              : []),
            'separator' as const,
            { label: 'Delete', icon: <Trash2 />, danger: true, onSelect: onDelete },
          ]}
        />
      </div>
    </article>
  )
}
