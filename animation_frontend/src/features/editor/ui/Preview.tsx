import { useEffect, useRef, useState } from 'react'
import { Pause, Play, SkipBack, StepBack, StepForward } from 'lucide-react'
import { IconButton } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useEditor } from '../store'
import { outputDuration } from '../model/timelineV2'
import { previewSize, PreviewRenderer, type PreviewInfo } from '../engine/preview-client'
import type { AudioPreview } from '../engine/audio-preview'

/** The preview canvas (composited in a worker) and the transport controls. */
export function Preview({
  audio,
  onInfo,
  forceCompositor,
}: {
  audio: AudioPreview
  onInfo: (info: PreviewInfo) => void
  forceCompositor?: 'webgpu' | 'canvas2d'
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const renderer = useRef<PreviewRenderer | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const timeline = useEditor((s) => s.timeline)
  const transcript = useEditor((s) => s.transcript)
  const brand = useEditor((s) => s.brand)
  const assets = useEditor((s) => s.assets)
  const playhead = useEditor((s) => s.playhead)
  const playing = useEditor((s) => s.playing)
  const engine = useEditor((s) => s.engine)
  const setPlaying = useEditor((s) => s.setPlaying)
  const setPlayhead = useEditor((s) => s.setPlayhead)
  const fps = timeline?.fps ?? 30
  const size = timeline ? previewSize(timeline) : { width: 16, height: 9 }

  // A canvas can be handed to a worker only once, so each mount makes its own.
  useEffect(() => {
    const host = hostRef.current
    const tl = useEditor.getState().timeline
    if (!host || !tl) return
    const canvas = document.createElement('canvas')
    const initial = previewSize(tl)
    canvas.width = initial.width
    canvas.height = initial.height
    canvas.dataset.testid = 'preview-canvas'
    canvas.className = 'block h-full w-full rounded-md bg-black object-contain ring-1 ring-line-strong'
    canvas.setAttribute('aria-label', 'Video preview')
    canvas.setAttribute('role', 'img')
    host.appendChild(canvas)
    let disposed = false
    PreviewRenderer.create(canvas, tl, forceCompositor)
      .then(({ renderer: r, info }) => {
        if (disposed) return r.dispose()
        renderer.current = r
        onInfo(info)
        setReady(true)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
    return () => {
      disposed = true
      renderer.current?.dispose()
      renderer.current = null
      canvas.remove()
      setReady(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!ready || !timeline || !renderer.current) return
    void renderer.current
      .setProject(timeline, [...assets.values()], transcript, brand)
      .then(() => renderer.current?.render(useEditor.getState().playhead))
  }, [ready, timeline, assets, transcript, brand])

  useEffect(() => {
    if (ready && !playing) renderer.current?.render(playhead)
  }, [ready, playhead, playing])

  // Playback: the audio clock drives the playhead; the worker renders the latest time.
  useEffect(() => {
    if (!playing || !timeline) return
    const end = outputDuration(timeline)
    let raf = 0
    const tick = () => {
      const t = audio.now()
      if (t >= end) {
        setPlaying(false)
        audio.pause()
        setPlayhead(end)
        return
      }
      setPlayhead(t)
      renderer.current?.render(t)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, timeline, audio, setPlaying, setPlayhead])

  const duration = timeline ? outputDuration(timeline) : 0
  const tc = (t: number) => (engine ? engine.secondsToTimecode(t, fps) : '00:00:00:00')

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative flex min-h-0 flex-1 items-center justify-center bg-[radial-gradient(ellipse_at_center,var(--color-surface-2),var(--color-canvas)_70%)] p-4">
        <div
          className="relative max-h-full max-w-full shadow-lg"
          style={{ aspectRatio: `${size.width} / ${size.height}`, height: '100%' }}
        >
          <div ref={hostRef} className="h-full w-full" data-testid="preview" />
          {!ready && !error ? (
            <div className="absolute inset-0 grid place-items-center text-fg-subtle">
              <Spinner className="size-5" label="Starting the compositor" />
            </div>
          ) : null}
          {error ? (
            <div
              role="alert"
              className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-status-failed"
            >
              The preview could not start: {error}
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-t border-line bg-surface-1 px-3">
        <span className="font-mono text-xs text-fg tabular-nums" data-testid="timecode">
          {tc(playhead)}
        </span>
        <div className="flex items-center gap-1">
          <IconButton label="Go to start" size="sm" onClick={() => setPlayhead(0)}>
            <SkipBack />
          </IconButton>
          <IconButton label="Previous frame" size="sm" onClick={() => setPlayhead(playhead - 1 / fps)}>
            <StepBack />
          </IconButton>
          <IconButton
            label={playing ? 'Pause' : 'Play'}
            variant="secondary"
            size="md"
            data-testid="editor-play"
            onClick={() => window.dispatchEvent(new CustomEvent('animato:toggle-play'))}
          >
            {playing ? <Pause /> : <Play />}
          </IconButton>
          <IconButton label="Next frame" size="sm" onClick={() => setPlayhead(playhead + 1 / fps)}>
            <StepForward />
          </IconButton>
        </div>
        <span className="font-mono text-xs text-fg-subtle tabular-nums">{tc(duration)}</span>
      </div>
    </div>
  )
}
