import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Magnet, RotateCcw, Scissors } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/misc'
import { cn } from '@/lib/cn'
import { spring } from '@/lib/motion'
import {
  defaultTransform,
  emptyTimeline,
  type MediaClip,
  type Timeline,
} from '@/features/editor/model/timeline'
import type { CoreEngine } from '@/wasm/engine'

const DURATION = 12
const FPS = 30
const SNAP_THRESHOLD = 0.15
/** The engine refuses to split closer than this to a clip edge. */
const MIN_PIECE = 0.1

function demoClip(id: string, assetId: string, name: string, start: number, duration: number): MediaClip {
  return {
    id,
    type: 'media',
    assetId,
    name,
    start,
    duration,
    offset: 0,
    speed: 1,
    volume: 1,
    fadeIn: 0,
    fadeOut: 0,
    transform: defaultTransform(),
    color: { brightness: 1, contrast: 1, saturation: 1 },
    crop: { top: 0, right: 0, bottom: 0, left: 0 },
    audio: { normalizeGain: 1, gate: false, eq: { low: 0, mid: 0, high: 0 }, duck: false },
  }
}

function demoTimeline(): Timeline {
  const t = emptyTimeline('16:9')
  const video = t.tracks.find((tr) => tr.kind === 'video')
  if (video) {
    video.clips.push(
      demoClip('clip_intro', 'remotion-gradient', 'Title card', 0, 3),
      demoClip('clip_mandel', 'manim-mandelbrot', 'Mandelbrot zoom', 3, 5.5),
      demoClip('clip_life', 'remotion-life', 'Game of Life', 8.5, 3.5),
    )
  }
  return t
}

function videoClips(t: Timeline): MediaClip[] {
  const track = t.tracks.find((tr) => tr.kind === 'video')
  return (track?.clips ?? []).filter((c): c is MediaClip => c.type === 'media')
}

const CLIP_TONE: Record<string, string> = {
  'remotion-gradient': 'border-accent/40 bg-accent-soft text-accent',
  'manim-mandelbrot': 'border-status-rendering/35 bg-status-rendering/10 text-status-rendering',
  'remotion-life': 'border-status-planning/35 bg-status-planning/10 text-status-planning',
}

const formatMs = (ms: number) => (ms < 1 ? `${ms.toFixed(3)} ms` : `${ms.toFixed(2)} ms`)

type Status = 'idle' | 'loading' | 'ready'

/**
 * A tiny timeline driven by the real editor engine (Rust compiled to
 * WebAssembly, or its TypeScript twin). The ~8 MB module is only requested
 * once this component is about to scroll into view.
 */
export function WasmDemo() {
  const root = useRef<HTMLDivElement>(null)
  const keyboard = useRef(false)
  const nextId = useRef(1)
  const [status, setStatus] = useState<Status>('idle')
  const [engine, setEngine] = useState<CoreEngine | null>(null)
  const [timeline, setTimeline] = useState<Timeline>(demoTimeline)
  const [time, setTime] = useState(4.2)
  const [snapped, setSnapped] = useState(false)
  const [lastOp, setLastOp] = useState<{ name: string; ms: number } | null>(null)

  useEffect(() => {
    const el = root.current
    if (!el) return
    let alive = true
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        io.disconnect()
        setStatus('loading')
        void import('@/wasm/engine')
          .then(({ loadEngine }) => loadEngine())
          .then((e) => {
            if (!alive) return
            setEngine(e)
            setStatus('ready')
          })
      },
      { rootMargin: '300px 0px' },
    )
    io.observe(el)
    return () => {
      alive = false
      io.disconnect()
    }
  }, [])

  const clips = useMemo(() => videoClips(timeline), [timeline])
  const edges = useMemo(() => [...new Set(clips.flatMap((c) => [c.start, c.start + c.duration]))], [clips])
  const target = clips.find((c) => time > c.start + MIN_PIECE && time < c.start + c.duration - MIN_PIECE)

  const seek = useCallback(
    (raw: number, allowSnap: boolean) => {
      const t = Math.min(DURATION, Math.max(0, raw))
      if (!engine || !allowSnap) {
        setTime(t)
        setSnapped(false)
        return
      }
      const t0 = performance.now()
      const s = engine.snap(t, edges, SNAP_THRESHOLD)
      setLastOp({ name: 'snap', ms: performance.now() - t0 })
      setTime(s)
      setSnapped(s !== t)
    },
    [edges, engine],
  )

  const split = useCallback(() => {
    if (!engine || !target) return
    const newId = `clip_split_${nextId.current++}`
    const t0 = performance.now()
    const next = engine.splitClip(timeline, target.id, time, newId)
    setLastOp({ name: 'splitClip', ms: performance.now() - t0 })
    setTimeline(next)
  }, [engine, target, timeline, time])

  const reset = () => {
    setTimeline(demoTimeline())
    setLastOp(null)
  }

  const pointerSeek = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    seek(((e.clientX - r.left) / r.width) * DURATION, true)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key.toLowerCase() === 's' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault()
      split()
    }
  }

  const pct = (s: number) => `${(s / DURATION) * 100}%`
  const ready = status === 'ready' && engine !== null

  return (
    <div
      ref={root}
      data-testid="wasm-demo"
      onKeyDown={onKeyDown}
      className="overflow-hidden rounded-2xl border border-line-strong bg-surface-1 shadow-lg"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-2/60 px-4 py-2.5">
        <p className="font-mono text-2xs tracking-widest text-fg-subtle uppercase">Live engine demo</p>
        <span
          data-testid="wasm-demo-backend"
          className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-surface-1 px-2.5 py-0.5 font-mono text-2xs text-fg-muted"
        >
          <span
            aria-hidden
            className={cn(
              'size-1.5 rounded-full',
              ready ? 'bg-status-succeeded' : 'animate-pulse-soft bg-status-rendering',
            )}
          />
          {ready
            ? `${engine.backend === 'wasm' ? 'Rust/WASM' : 'TS fallback'} · ${engine.version}`
            : status === 'loading'
              ? 'Loading engine…'
              : 'Engine loads on scroll'}
        </span>
      </div>

      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-2xs text-fg-subtle">Playhead (30 fps timecode)</p>
            <p className="font-mono text-2xl font-medium tracking-tight text-fg tabular-nums" aria-live="off">
              {ready ? engine.secondsToTimecode(time, FPS) : '--:--:--:--'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xs text-fg-subtle">Last engine call</p>
            <p className="font-mono text-sm text-fg-muted tabular-nums" aria-live="polite">
              {lastOp ? (
                <>
                  <span className="text-accent">{lastOp.name}</span> · {formatMs(lastOp.ms)}
                </>
              ) : (
                '—'
              )}
            </p>
          </div>
        </div>

        <div className="relative mt-5 select-none">
          <div className="relative h-5 border-b border-line" aria-hidden>
            {Array.from({ length: DURATION + 1 }, (_, s) => (
              <span key={s} className="absolute bottom-0 h-1.5 w-px bg-line-strong" style={{ left: pct(s) }}>
                {s % 2 === 0 ? (
                  <span
                    className={cn(
                      'absolute bottom-2 font-mono text-2xs text-fg-faint',
                      s === 0 ? 'left-0' : s === DURATION ? 'right-0' : '-translate-x-1/2',
                    )}
                  >
                    {s}s
                  </span>
                ) : null}
              </span>
            ))}
          </div>
          <div
            aria-hidden
            className="relative mt-2 h-14 cursor-ew-resize touch-none rounded-md bg-surface-2/60"
            onPointerDown={(e) => {
              keyboard.current = false
              e.currentTarget.setPointerCapture(e.pointerId)
              pointerSeek(e)
            }}
            onPointerMove={(e) => {
              if (e.currentTarget.hasPointerCapture(e.pointerId)) pointerSeek(e)
            }}
          >
            <AnimatePresence initial={false}>
              {clips.map((c) => (
                <motion.div
                  key={c.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={spring.layout}
                  className={cn(
                    'absolute inset-y-1 overflow-hidden rounded-md border px-2 py-1.5',
                    CLIP_TONE[c.assetId] ?? 'border-line-strong bg-surface-3 text-fg-muted',
                    target?.id === c.id && 'ring-1 ring-fg/40',
                  )}
                  style={{ left: `calc(${pct(c.start)} + 1px)`, width: `calc(${pct(c.duration)} - 2px)` }}
                >
                  <p className="truncate text-2xs font-medium">{c.name}</p>
                  <p className="truncate font-mono text-2xs opacity-70">{c.duration.toFixed(2)}s</p>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <div
            aria-hidden
            className="pointer-events-none absolute top-3 -bottom-1 w-px bg-fg shadow-glow"
            style={{ left: pct(time) }}
          >
            <span className="absolute -top-1 -left-[3.5px] size-2 rotate-45 bg-fg" />
          </div>
        </div>

        <label className="mt-5 block">
          <span className="sr-only">Playhead position in seconds</span>
          <input
            type="range"
            min={0}
            max={DURATION}
            step={1 / FPS}
            value={time}
            onPointerDown={() => {
              keyboard.current = false
            }}
            onKeyDown={() => {
              keyboard.current = true
            }}
            onChange={(e) => seek(Number(e.target.value), !keyboard.current)}
            aria-valuetext={`${time.toFixed(2)} seconds`}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-3 accent-accent [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md"
            style={{
              backgroundImage: `linear-gradient(to right, var(--color-accent-violet), var(--color-accent-cyan) ${pct(time)}, transparent ${pct(time)})`,
            }}
          />
        </label>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            data-testid="wasm-demo-split"
            size="sm"
            variant="primary"
            onClick={split}
            disabled={!ready || !target}
            leftIcon={<Scissors className="size-3.5" aria-hidden />}
          >
            Split at playhead
            <Kbd className="ml-1 border-white/30 bg-white/10 text-white">S</Kbd>
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={reset}
            leftIcon={<RotateCcw className="size-3.5" aria-hidden />}
          >
            Reset
          </Button>
          <span
            className={cn(
              'ml-auto inline-flex items-center gap-1.5 text-xs transition-colors',
              snapped ? 'text-status-succeeded' : 'text-fg-subtle',
            )}
            aria-live="polite"
          >
            <Magnet className="size-3.5" aria-hidden />
            {snapped ? 'Snapped to clip edge' : `Snaps within ${SNAP_THRESHOLD}s`}
          </span>
        </div>
        <p className="mt-3 text-xs text-fg-subtle">
          {clips.length} clips · drag the timeline or use the slider; arrow keys move without snapping.
        </p>
      </div>
    </div>
  )
}
