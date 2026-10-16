import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  ChevronLeft,
  ChevronRight,
  Maximize,
  Minimize,
  Pause,
  Play,
  Repeat,
  RotateCw,
  Volume1,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/cn'
import { formatClock } from '@/lib/format'

const RATES = [0.5, 1, 1.5, 2] as const
const FRAME = 1 / 30

export interface VideoPlayerProps {
  src: string
  /** Used while the file does not report its own duration (e.g. some WebM). */
  fallbackDuration?: number | null
  poster?: string
  autoPlay?: boolean
  className?: string
  /** CSS aspect-ratio of the frame, e.g. "16 / 9". */
  aspectRatio?: string
  label?: string
}

const ctrl =
  'inline-grid size-8 shrink-0 place-items-center rounded-md text-white/85 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 [&_svg]:size-4'

/**
 * A native <video> with a custom, keyboard-friendly control bar. Shortcuts
 * work while the player (or any control inside it) has focus.
 */
export function VideoPlayer({
  src,
  fallbackDuration,
  poster,
  autoPlay = false,
  className,
  aspectRatio = '16 / 9',
  label = 'Video player',
}: VideoPlayerProps) {
  const root = useRef<HTMLDivElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const bar = useRef<HTMLDivElement>(null)
  const hideTimer = useRef<number | undefined>(undefined)

  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [mediaDuration, setMediaDuration] = useState(0)
  const [buffered, setBuffered] = useState(0)
  const [hover, setHover] = useState<{ x: number; t: number; w: number } | null>(null)
  const [rate, setRate] = useState<(typeof RATES)[number]>(1)
  const [loop, setLoop] = useState(false)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [waiting, setWaiting] = useState(true)
  const [failed, setFailed] = useState(false)
  const [idle, setIdle] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const scrubbing = useRef(false)

  const duration =
    Number.isFinite(mediaDuration) && mediaDuration > 0 ? mediaDuration : (fallbackDuration ?? 0)

  // Smooth time readout while playing.
  useEffect(() => {
    if (!playing) return
    let raf = 0
    const tick = () => {
      const v = video.current
      if (v && !scrubbing.current) setCurrent(v.currentTime)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing])

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === root.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  useEffect(() => () => window.clearTimeout(hideTimer.current), [])

  const poke = useCallback(() => {
    setIdle(false)
    window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => setIdle(true), 2400)
  }, [])

  const togglePlay = useCallback(() => {
    const v = video.current
    if (!v) return
    if (v.paused || v.ended) void v.play().catch(() => setPlaying(false))
    else v.pause()
  }, [])

  const seek = useCallback(
    (t: number) => {
      const v = video.current
      if (!v) return
      const max = duration || v.duration || 0
      const next = Math.max(0, max ? Math.min(t, max) : t)
      v.currentTime = next
      setCurrent(next)
    },
    [duration],
  )

  const step = useCallback(
    (dir: 1 | -1) => {
      const v = video.current
      if (!v) return
      v.pause()
      seek(v.currentTime + dir * FRAME)
    },
    [seek],
  )

  const toggleMute = useCallback(() => {
    const v = video.current
    if (!v) return
    v.muted = !v.muted
    if (!v.muted && v.volume === 0) v.volume = 0.6
  }, [])

  const toggleFullscreen = useCallback(() => {
    const el = root.current
    if (!el) return
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
    else void el.requestFullscreen?.().catch(() => undefined)
  }, [])

  const cycleRate = () => {
    const next = RATES[(RATES.indexOf(rate) + 1) % RATES.length]
    if (video.current) video.current.playbackRate = next
    setRate(next)
  }

  const toggleLoop = () => {
    if (video.current) video.current.loop = !loop
    setLoop(!loop)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    const target = e.target as HTMLElement
    // Let buttons and the volume slider handle their own activation keys.
    if (target.tagName === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return
    if (target.tagName === 'INPUT') return
    const v = video.current
    if (!v) return
    let handled = true
    switch (e.key) {
      case ' ':
      case 'k':
      case 'K':
        togglePlay()
        break
      case 'j':
      case 'J':
        seek(v.currentTime - 5)
        break
      case 'l':
      case 'L':
        seek(v.currentTime + 5)
        break
      case 'ArrowLeft':
        step(-1)
        break
      case 'ArrowRight':
        step(1)
        break
      case 'm':
      case 'M':
        toggleMute()
        break
      case 'f':
      case 'F':
        toggleFullscreen()
        break
      case 'Home':
        seek(0)
        break
      case 'End':
        seek(duration)
        break
      default:
        handled = false
    }
    if (handled) {
      e.preventDefault()
      poke()
    }
  }

  const timeAt = (clientX: number) => {
    const rect = bar.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return { x: 0, t: 0, w: 0 }
    const x = Math.min(Math.max(0, clientX - rect.left), rect.width)
    return { x, t: (x / rect.width) * duration, w: rect.width }
  }

  const onBarDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!duration) return
    scrubbing.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    seek(timeAt(e.clientX).t)
  }
  const onBarMove = (e: PointerEvent<HTMLDivElement>) => {
    const h = timeAt(e.clientX)
    setHover(h)
    if (scrubbing.current) seek(h.t)
  }
  const onBarUp = (e: PointerEvent<HTMLDivElement>) => {
    scrubbing.current = false
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
  }

  const updateBuffered = () => {
    const v = video.current
    if (!v || v.buffered.length === 0) return
    setBuffered(v.buffered.end(v.buffered.length - 1))
  }

  const progress = duration ? Math.min(1, current / duration) : 0
  const bufferedPct = duration ? Math.min(1, buffered / duration) : 0
  const showChrome = !playing || !idle
  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2

  return (
    <div
      ref={root}
      tabIndex={0}
      role="region"
      aria-label={`${label}. Space or K play/pause, J/L skip 5 seconds, arrow keys step one frame, M mute, F fullscreen.`}
      onKeyDown={onKeyDown}
      onPointerMove={poke}
      onPointerLeave={() => playing && setIdle(true)}
      className={cn(
        'group/player relative overflow-hidden rounded-2xl border border-line-strong bg-black shadow-lg focus-visible:outline-2',
        fullscreen && 'rounded-none border-0',
        idle && playing && 'cursor-none',
        className,
      )}
      style={fullscreen ? undefined : { aspectRatio }}
    >
      <video
        key={reloadKey}
        ref={video}
        src={src}
        poster={poster}
        autoPlay={autoPlay}
        muted={autoPlay}
        playsInline
        preload="metadata"
        className="absolute inset-0 size-full object-contain"
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
        onPlay={() => {
          setPlaying(true)
          poke()
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onLoadedMetadata={(e) => {
          setMediaDuration(e.currentTarget.duration)
          setMuted(e.currentTarget.muted)
          setFailed(false)
          setWaiting(false)
        }}
        onDurationChange={(e) => setMediaDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => !scrubbing.current && setCurrent(e.currentTarget.currentTime)}
        onProgress={updateBuffered}
        onWaiting={() => setWaiting(true)}
        onCanPlay={() => {
          setWaiting(false)
          updateBuffered()
        }}
        onPlaying={() => setWaiting(false)}
        onVolumeChange={(e) => {
          setVolume(e.currentTarget.volume)
          setMuted(e.currentTarget.muted)
        }}
        onError={() => {
          setFailed(true)
          setWaiting(false)
        }}
      />

      {/* Centre states */}
      <AnimatePresence>
        {failed ? (
          <motion.div
            key="failed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="alert"
            className="absolute inset-0 grid place-items-center bg-canvas/85 p-6 text-center"
          >
            <div>
              <p className="text-sm font-medium text-fg">The video could not be loaded.</p>
              <p className="mt-1 text-xs text-fg-subtle">
                The link may have expired, or the connection dropped.
              </p>
              <button
                type="button"
                onClick={() => {
                  setFailed(false)
                  setWaiting(true)
                  setReloadKey((k) => k + 1)
                }}
                className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-md border border-line-strong bg-surface-3 px-3 text-sm text-fg hover:bg-surface-4"
              >
                <RotateCw className="size-3.5" /> Try again
              </button>
            </div>
          </motion.div>
        ) : waiting ? (
          <motion.div
            key="wait"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.15 }}
            className="pointer-events-none absolute inset-0 grid place-items-center text-white/80"
          >
            <Spinner className="size-7" label="Loading video" />
          </motion.div>
        ) : !playing ? (
          <motion.button
            key="play"
            type="button"
            tabIndex={-1}
            aria-hidden
            onClick={togglePlay}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.15 }}
            transition={{ duration: 0.2 }}
            className="absolute top-1/2 left-1/2 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/45 text-white backdrop-blur-md transition-colors hover:bg-black/60"
          >
            <Play className="ml-1 size-7" fill="currentColor" />
          </motion.button>
        ) : null}
      </AnimatePresence>

      {/* Control bar */}
      <div
        className={cn(
          'absolute inset-x-0 bottom-0 bg-linear-to-t from-black/85 via-black/45 to-transparent px-2 pt-10 pb-1.5 transition-opacity duration-300 sm:px-3',
          showChrome ? 'opacity-100' : 'opacity-0 group-focus-within/player:opacity-100',
        )}
      >
        {/* Scrub bar */}
        <div
          ref={bar}
          role="slider"
          tabIndex={0}
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration * 10) / 10}
          aria-valuenow={Math.round(current * 10) / 10}
          aria-valuetext={`${formatClock(current)} of ${formatClock(duration)}`}
          data-testid="player-scrub"
          onPointerDown={onBarDown}
          onPointerMove={onBarMove}
          onPointerUp={onBarUp}
          onPointerCancel={onBarUp}
          onPointerLeave={() => setHover(null)}
          className="group/bar relative mx-1 flex h-4 cursor-pointer touch-none items-center"
        >
          <div className="relative h-1 w-full overflow-hidden rounded-full bg-white/20 transition-[height] duration-150 group-hover/bar:h-1.5">
            <div
              className="absolute inset-y-0 left-0 bg-white/30"
              style={{ width: `${bufferedPct * 100}%` }}
            />
            {hover ? (
              <div className="absolute inset-y-0 left-0 bg-white/20" style={{ width: hover.x }} />
            ) : null}
            <div
              className="absolute inset-y-0 left-0 bg-gradient-accent"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <div
            className="pointer-events-none absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 scale-0 rounded-full bg-white shadow-md transition-transform duration-150 group-hover/bar:scale-100 group-focus-visible/bar:scale-100"
            style={{ left: `${progress * 100}%` }}
          />
          {hover && duration ? (
            <div
              className="pointer-events-none absolute bottom-full mb-2 -translate-x-1/2 rounded border border-white/10 bg-black/80 px-1.5 py-0.5 font-mono text-2xs text-white tabular-nums"
              style={{ left: Math.max(24, Math.min(hover.x, hover.w - 24)) }}
            >
              {formatClock(hover.t)}
            </div>
          ) : null}
        </div>

        <div className="mt-1 flex items-center gap-0.5">
          <button
            type="button"
            className={ctrl}
            onClick={togglePlay}
            aria-label={playing ? 'Pause (K)' : 'Play (K)'}
            title={playing ? 'Pause (K)' : 'Play (K)'}
            data-testid="player-play"
          >
            {playing ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}
          </button>
          <button
            type="button"
            className={cn(ctrl, 'hidden sm:inline-grid')}
            onClick={() => step(-1)}
            aria-label="Previous frame (←)"
            title="Previous frame (←)"
            data-testid="player-step-back"
          >
            <ChevronLeft />
          </button>
          <button
            type="button"
            className={cn(ctrl, 'hidden sm:inline-grid')}
            onClick={() => step(1)}
            aria-label="Next frame (→)"
            title="Next frame (→)"
            data-testid="player-step-forward"
          >
            <ChevronRight />
          </button>
          <div className="group/vol flex items-center">
            <button
              type="button"
              className={ctrl}
              onClick={toggleMute}
              aria-label={muted ? 'Unmute (M)' : 'Mute (M)'}
              title={muted ? 'Unmute (M)' : 'Mute (M)'}
              aria-pressed={muted}
              data-testid="player-mute"
            >
              <VolumeIcon />
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              aria-label="Volume"
              onChange={(e) => {
                const v = video.current
                if (!v) return
                v.volume = Number(e.target.value)
                v.muted = Number(e.target.value) === 0
              }}
              className="hidden h-1 w-0 cursor-pointer appearance-none rounded-full bg-white/25 opacity-0 transition-[width,opacity] duration-200 group-focus-within/vol:w-20 group-focus-within/vol:opacity-100 group-hover/vol:w-20 group-hover/vol:opacity-100 sm:block [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
            />
          </div>
          <span
            data-testid="player-time"
            className="ml-1.5 min-w-0 truncate font-mono text-2xs text-white/85 tabular-nums sm:text-xs"
          >
            {formatClock(current)}
            <span className="text-white/45"> / {formatClock(duration)}</span>
          </span>
          <div className="ml-auto flex items-center gap-0.5">
            <button
              type="button"
              onClick={cycleRate}
              aria-label={`Playback speed ${rate}×`}
              title="Playback speed"
              data-testid="player-speed"
              className="inline-flex h-8 min-w-10 shrink-0 items-center justify-center rounded-md px-1.5 font-mono text-xs text-white/85 tabular-nums transition-colors hover:bg-white/10 hover:text-white"
            >
              {rate}×
            </button>
            <button
              type="button"
              onClick={toggleLoop}
              aria-label="Loop"
              title="Loop"
              aria-pressed={loop}
              data-testid="player-loop"
              className={cn(ctrl, loop && 'bg-white/15 text-white')}
            >
              <Repeat />
            </button>
            <button
              type="button"
              className={ctrl}
              onClick={toggleFullscreen}
              aria-label={fullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}
              title={fullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}
              data-testid="player-fullscreen"
            >
              {fullscreen ? <Minimize /> : <Maximize />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
