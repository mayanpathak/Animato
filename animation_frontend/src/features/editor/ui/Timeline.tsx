import { memo, useCallback, useMemo, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { Eye, EyeOff, Magnet, Minus, Plus, Volume2, VolumeX } from 'lucide-react'
import type { MediaAsset } from '@/lib/local/models'
import { cn } from '@/lib/cn'
import { IconButton } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
import { useEditor } from '../store'
import { timelineDuration, type Clip, type MediaClip, type Track } from '../model/timeline'

const HEADER_W = 148
const ROW_H: Record<Track['kind'], number> = { video: 64, text: 38, caption: 34, voice: 52, audio: 52 }
const SNAP_PX = 8

export const ASSET_MIME = 'application/x-animato-asset'

function tickStep(zoom: number): number {
  const steps = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300]
  return steps.find((s) => s * zoom >= 70) ?? 600
}

const Waveform = memo(function Waveform({
  asset,
  clip,
  width,
  height,
}: {
  asset: MediaAsset
  clip: MediaClip
  width: number
  height: number
}) {
  const path = useMemo(() => {
    const peaks = asset.waveform
    if (!peaks.length || width <= 2) return ''
    const from = clip.offset * 100
    const span = clip.duration * clip.speed * 100
    const bars = Math.max(1, Math.floor(width / 2))
    const mid = height / 2
    let d = ''
    for (let b = 0; b < bars; b++) {
      const i0 = Math.floor(from + (b / bars) * span)
      const i1 = Math.max(i0 + 1, Math.floor(from + ((b + 1) / bars) * span))
      let p = 0
      for (let i = i0; i < i1 && i < peaks.length; i++) p = Math.max(p, peaks[i] ?? 0)
      const h = Math.max(0.5, Math.min(1, p * 2.2) * mid * clip.volume)
      d += `M${b * 2 + 1} ${mid - h}V${mid + h}`
    }
    return d
  }, [asset.waveform, clip.offset, clip.duration, clip.speed, clip.volume, width, height])
  return (
    <svg
      className="pointer-events-none absolute inset-0"
      width={width}
      height={height}
      aria-hidden
      data-testid="clip-waveform"
    >
      <path d={path} stroke="currentColor" strokeWidth="1.2" className="text-status-succeeded/80" />
    </svg>
  )
})

const Thumbnails = memo(function Thumbnails({
  asset,
  clip,
  width,
  height,
}: {
  asset: MediaAsset
  clip: MediaClip
  width: number
  height: number
}) {
  const tiles = useMemo(() => {
    const thumbs = asset.thumbnails
    if (!thumbs.length) return []
    const tileW = Math.max(24, Math.round((height * 16) / 9))
    const count = Math.max(1, Math.ceil(width / tileW))
    return Array.from({ length: count }, (_, i) => {
      if (asset.kind === 'image') return { src: thumbs[0], x: i * tileW, w: tileW }
      const t = clip.offset + ((i + 0.5) / count) * clip.duration * clip.speed
      const idx = Math.min(
        thumbs.length - 1,
        Math.max(0, Math.floor((t / Math.max(0.001, asset.duration)) * thumbs.length)),
      )
      return { src: thumbs[idx], x: i * tileW, w: tileW }
    })
  }, [asset, clip.offset, clip.duration, clip.speed, width, height])
  return (
    <div
      className="pointer-events-none absolute inset-0 flex overflow-hidden opacity-70"
      aria-hidden
      data-testid="clip-thumbnails"
    >
      {tiles.map((t) => (
        <img
          key={t.x}
          src={t.src}
          alt=""
          draggable={false}
          className="h-full shrink-0 object-cover"
          style={{ width: t.w }}
        />
      ))}
    </div>
  )
})

function ClipView({
  clip,
  track,
  asset,
  zoom,
  selected,
  onPointerDown,
}: {
  clip: Clip
  track: Track
  asset: MediaAsset | undefined
  zoom: number
  selected: boolean
  onPointerDown: (e: ReactPointerEvent, clip: Clip, mode: 'move' | 'start' | 'end') => void
}) {
  const width = Math.max(4, clip.duration * zoom)
  const height = ROW_H[track.kind] - 8
  const label = clip.type === 'media' ? clip.name : clip.text
  const tone =
    clip.type === 'text'
      ? 'bg-accent-violet/25 border-accent-violet/50'
      : clip.type === 'caption'
        ? 'bg-accent-magenta/20 border-accent-magenta/40'
        : track.kind === 'voice'
          ? 'bg-accent-cyan/15 border-accent-cyan/45'
          : track.kind === 'audio'
            ? 'bg-status-succeeded/10 border-status-succeeded/35'
            : 'bg-surface-4 border-line-strong'
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${clip.type} clip ${label}`}
      data-testid="clip"
      data-clip-id={clip.id}
      data-type={clip.type}
      data-start={clip.start.toFixed(3)}
      data-duration={clip.duration.toFixed(3)}
      onPointerDown={(e) => onPointerDown(e, clip, 'move')}
      className={cn(
        'group absolute top-1 cursor-grab overflow-hidden rounded-md border text-left select-none active:cursor-grabbing',
        tone,
        selected && 'z-10 ring-2 ring-accent ring-offset-1 ring-offset-canvas',
        clip.type === 'media' && !asset && 'border-dashed border-status-failed/60',
      )}
      style={{ left: clip.start * zoom, width, height }}
    >
      {clip.type === 'media' && asset && asset.kind !== 'audio' && track.kind === 'video' ? (
        <Thumbnails asset={asset} clip={clip} width={width} height={height} />
      ) : null}
      {clip.type === 'media' && asset && (track.kind !== 'video' || asset.kind === 'audio') ? (
        <Waveform asset={asset} clip={clip} width={width} height={height} />
      ) : null}
      <span className="pointer-events-none relative flex items-center gap-1 truncate px-2 pt-1 text-2xs font-medium text-fg drop-shadow">
        {clip.type === 'media' && clip.speed !== 1 ? (
          <span className="rounded bg-black/60 px-1 font-mono">{clip.speed}×</span>
        ) : null}
        <span className="truncate">
          {clip.type === 'media' && !asset ? `Offline media · ${label}` : label}
        </span>
      </span>
      {clip.type === 'media' && (clip.fadeIn > 0 || clip.fadeOut > 0) ? (
        <svg className="pointer-events-none absolute inset-0" width={width} height={height} aria-hidden>
          {clip.fadeIn > 0 ? (
            <path d={`M0 ${height}L${clip.fadeIn * zoom} 0V${height}Z`} className="fill-black/35" />
          ) : null}
          {clip.fadeOut > 0 ? (
            <path
              d={`M${width} ${height}L${width - clip.fadeOut * zoom} 0V${height}Z`}
              className="fill-black/35"
            />
          ) : null}
        </svg>
      ) : null}
      <span
        data-testid="clip-trim-start"
        onPointerDown={(e) => {
          e.stopPropagation()
          onPointerDown(e, clip, 'start')
        }}
        className="absolute inset-y-0 left-0 w-2 cursor-ew-resize bg-white/0 transition-colors group-hover:bg-white/25"
      />
      <span
        data-testid="clip-trim-end"
        onPointerDown={(e) => {
          e.stopPropagation()
          onPointerDown(e, clip, 'end')
        }}
        className="absolute inset-y-0 right-0 w-2 cursor-ew-resize bg-white/0 transition-colors group-hover:bg-white/25"
      />
    </div>
  )
}

export function Timeline() {
  const timeline = useEditor((s) => s.timeline)
  const assets = useEditor((s) => s.assets)
  const zoom = useEditor((s) => s.zoom)
  const playhead = useEditor((s) => s.playhead)
  const selection = useEditor((s) => s.selection)
  const snapping = useEditor((s) => s.snapping)
  const scroller = useRef<HTMLDivElement>(null)
  const lane = useRef<HTMLDivElement>(null)

  const duration = timeline ? timelineDuration(timeline) : 0
  const contentW = Math.max((duration + 10) * zoom, 800)
  const step = tickStep(zoom)

  const timeAt = useCallback((clientX: number) => {
    const rect = lane.current?.getBoundingClientRect()
    return rect ? Math.max(0, (clientX - rect.left) / useEditor.getState().zoom) : 0
  }, [])

  const snap = useCallback((t: number, exclude?: string) => {
    const s = useEditor.getState()
    if (!s.snapping || !s.engine) return t
    return s.engine.snap(t, s.snapTargets(exclude), SNAP_PX / s.zoom)
  }, [])

  const onClipPointerDown = useCallback(
    (e: ReactPointerEvent, clip: Clip, mode: 'move' | 'start' | 'end') => {
      if (e.button !== 0) return
      e.preventDefault()
      const s = useEditor.getState()
      s.select(clip.id)
      const target = e.currentTarget as HTMLElement
      target.setPointerCapture(e.pointerId)
      const startX = e.clientX
      const origStart = clip.start
      const origEnd = clip.start + clip.duration
      const key = `${mode}-${clip.id}-${Date.now()}`
      let moved = false
      const onMove = (ev: PointerEvent) => {
        const dt = (ev.clientX - startX) / useEditor.getState().zoom
        if (!moved && Math.abs(ev.clientX - startX) < 3) return
        moved = true
        const st = useEditor.getState()
        if (mode === 'move') {
          let start = Math.max(0, origStart + dt)
          const snappedStart = snap(start, clip.id)
          const snappedEnd = snap(start + clip.duration, clip.id) - clip.duration
          start = snappedStart !== start ? snappedStart : snappedEnd !== start ? snappedEnd : start
          const under = document
            .elementsFromPoint(ev.clientX, ev.clientY)
            .find((el) => (el as HTMLElement).dataset?.trackId) as HTMLElement | undefined
          st.move(clip.id, start, under?.dataset.trackId, key)
        } else if (mode === 'start') {
          st.trim(clip.id, 'start', snap(origStart + dt, clip.id), key)
        } else {
          st.trim(clip.id, 'end', snap(origEnd + dt, clip.id), key)
        }
      }
      const onUp = () => {
        target.removeEventListener('pointermove', onMove)
        target.removeEventListener('pointerup', onUp)
        target.removeEventListener('pointercancel', onUp)
      }
      target.addEventListener('pointermove', onMove)
      target.addEventListener('pointerup', onUp)
      target.addEventListener('pointercancel', onUp)
    },
    [snap],
  )

  const onScrub = useCallback(
    (e: ReactPointerEvent) => {
      if (e.button !== 0) return
      const s = useEditor.getState()
      if (s.playing) window.dispatchEvent(new CustomEvent('animato:toggle-play'))
      s.select(null)
      s.setPlayhead(snap(timeAt(e.clientX)))
      const el = e.currentTarget as HTMLElement
      el.setPointerCapture(e.pointerId)
      const onMove = (ev: PointerEvent) => useEditor.getState().setPlayhead(snap(timeAt(ev.clientX)))
      const onUp = () => {
        el.removeEventListener('pointermove', onMove)
        el.removeEventListener('pointerup', onUp)
      }
      el.addEventListener('pointermove', onMove)
      el.addEventListener('pointerup', onUp)
    },
    [snap, timeAt],
  )

  if (!timeline) return null
  const s = useEditor.getState()

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface-1" data-testid="timeline">
      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-line px-2">
        <span className="px-1 text-2xs font-medium tracking-wide text-fg-faint uppercase">Timeline</span>
        <div className="ml-auto flex items-center gap-1">
          <Tooltip content={snapping ? 'Snapping on (N)' : 'Snapping off (N)'}>
            <IconButton
              label="Toggle snapping"
              size="sm"
              active={snapping}
              onClick={s.toggleSnapping}
              data-testid="timeline-snap"
            >
              <Magnet />
            </IconButton>
          </Tooltip>
          <IconButton
            label="Zoom out"
            size="sm"
            onClick={() => s.setZoom(zoom / 1.4)}
            data-testid="timeline-zoom-out"
          >
            <Minus />
          </IconButton>
          <input
            type="range"
            aria-label="Timeline zoom"
            min={10}
            max={600}
            value={zoom}
            onChange={(e) => s.setZoom(Number(e.target.value))}
            className="w-24 accent-accent"
          />
          <IconButton
            label="Zoom in"
            size="sm"
            onClick={() => s.setZoom(zoom * 1.4)}
            data-testid="timeline-zoom-in"
          >
            <Plus />
          </IconButton>
        </div>
      </div>
      <div
        ref={scroller}
        className="relative min-h-0 flex-1 overflow-auto"
        onWheel={(e) => {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            s.setZoom(zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15))
          }
        }}
      >
        <div className="relative" style={{ width: contentW + HEADER_W }}>
          {/* Ruler */}
          <div className="sticky top-0 z-20 flex h-7 border-b border-line bg-surface-1">
            <div
              className="sticky left-0 z-10 shrink-0 border-r border-line bg-surface-1"
              style={{ width: HEADER_W }}
            />
            <div className="relative flex-1 cursor-text" onPointerDown={onScrub} data-testid="timeline-ruler">
              {Array.from({ length: Math.ceil(contentW / zoom / step) + 1 }, (_, i) => i * step).map((t) => (
                <span
                  key={t}
                  className="absolute top-0 h-full border-l border-line pl-1 font-mono text-[10px] leading-7 text-fg-faint"
                  style={{ left: t * zoom }}
                >
                  {t >= 60
                    ? `${Math.floor(t / 60)}:${String(Math.round(t % 60)).padStart(2, '0')}`
                    : `${Number(t.toFixed(2))}s`}
                </span>
              ))}
            </div>
          </div>
          {/* Tracks */}
          <div className="relative">
            {timeline.tracks.map((track) => (
              <div key={track.id} className="flex border-b border-line" style={{ height: ROW_H[track.kind] }}>
                <div
                  className="sticky left-0 z-10 flex shrink-0 items-center gap-1 border-r border-line bg-surface-1 px-2"
                  style={{ width: HEADER_W }}
                >
                  <span className="flex-1 truncate text-xs text-fg-muted">{track.name}</span>
                  {track.kind === 'audio' || track.kind === 'voice' || track.kind === 'video' ? (
                    <IconButton
                      label={track.muted ? `Unmute ${track.name}` : `Mute ${track.name}`}
                      size="xs"
                      active={track.muted}
                      onClick={() =>
                        s.apply(track.muted ? 'Unmute track' : 'Mute track', (t) => ({
                          ...t,
                          tracks: t.tracks.map((tr) =>
                            tr.id === track.id ? { ...tr, muted: !tr.muted } : tr,
                          ),
                        }))
                      }
                    >
                      {track.muted ? <VolumeX /> : <Volume2 />}
                    </IconButton>
                  ) : null}
                  {track.kind !== 'audio' && track.kind !== 'voice' ? (
                    <IconButton
                      label={track.hidden ? `Show ${track.name}` : `Hide ${track.name}`}
                      size="xs"
                      active={track.hidden}
                      onClick={() =>
                        s.apply(track.hidden ? 'Show track' : 'Hide track', (t) => ({
                          ...t,
                          tracks: t.tracks.map((tr) =>
                            tr.id === track.id ? { ...tr, hidden: !tr.hidden } : tr,
                          ),
                        }))
                      }
                    >
                      {track.hidden ? <EyeOff /> : <Eye />}
                    </IconButton>
                  ) : null}
                </div>
                <div
                  ref={track === timeline.tracks[0] ? lane : undefined}
                  className={cn('relative flex-1', track.hidden && 'opacity-40')}
                  data-track-id={track.id}
                  data-testid={`track-${track.kind}`}
                  onPointerDown={(e) => {
                    if (e.target === e.currentTarget) onScrub(e)
                  }}
                  onDragOver={(e) => {
                    if (e.dataTransfer.types.includes(ASSET_MIME)) e.preventDefault()
                  }}
                  onDrop={(e) => {
                    const id = e.dataTransfer.getData(ASSET_MIME)
                    const asset = useEditor.getState().assets.get(id)
                    if (!asset) return
                    e.preventDefault()
                    useEditor.getState().addAssetAt(asset, track.kind, snap(timeAt(e.clientX)))
                  }}
                >
                  {track.clips.map((clip) => (
                    <ClipView
                      key={clip.id}
                      clip={clip}
                      track={track}
                      asset={clip.type === 'media' ? assets.get(clip.assetId) : undefined}
                      zoom={zoom}
                      selected={selection === clip.id}
                      onPointerDown={onClipPointerDown}
                    />
                  ))}
                </div>
              </div>
            ))}
            <div
              aria-hidden
              data-testid="playhead"
              className="pointer-events-none absolute top-[-28px] bottom-0 z-30 w-px bg-accent-magenta shadow-[0_0_8px_var(--color-accent-magenta)]"
              style={{ left: HEADER_W + playhead * zoom }}
            >
              <span className="absolute -top-px -left-[5px] size-[11px] rotate-45 rounded-[2px] bg-accent-magenta" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
