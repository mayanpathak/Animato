import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Download } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/field'
import { Badge, Progress, Switch } from '@/components/ui/misc'
import { Tabs } from '@/components/ui/tabs'
import { exportsTable, uid } from '@/lib/local/models'
import { readFile } from '@/lib/local/opfs'
import { useOwner } from '@/lib/local/hooks'
import { formatBytes, formatDuration } from '@/lib/format'
import { toast } from '@/stores/toast'
import { cn } from '@/lib/cn'
import { triggerDownload } from '@/lib/download'
import { useEditor } from '../store'
import { ASPECT_PRESETS, timelineDuration, type AspectKey, type Timeline } from '../model/timeline'
import { encoderSupport, exportTimeline } from '../engine/export-client'
import type { ExportFormat, ExportProgress, ExportQuality, ExportResult } from '../engine/export'

const RESOLUTIONS = [
  { id: '720p', short: 720 },
  { id: '1080p', short: 1080 },
  { id: '4K', short: 2160 },
] as const

const PLATFORMS: { label: string; aspect: AspectKey; hint: string }[] = [
  { label: 'YouTube', aspect: '16:9', hint: '16:9 landscape' },
  { label: 'Shorts · Reels · TikTok', aspect: '9:16', hint: '9:16 vertical' },
  { label: 'LinkedIn · Instagram', aspect: '1:1', hint: '1:1 square' },
]

function aspectOf(t: Timeline): AspectKey {
  const r = t.width / t.height
  return r > 1.2 ? '16:9' : r < 0.8 ? '9:16' : '1:1'
}

function dims(aspect: AspectKey, short: number): { width: number; height: number } {
  const base = ASPECT_PRESETS[aspect]
  const scale = short / Math.min(base.width, base.height)
  const even = (n: number) => Math.round(n / 2) * 2
  return { width: even(base.width * scale), height: even(base.height * scale) }
}

export function ExportDialog({
  open,
  onClose,
  compositor,
}: {
  open: boolean
  onClose: () => void
  compositor?: 'webgpu' | 'canvas2d'
}) {
  const timeline = useEditor((s) => s.timeline)
  const project = useEditor((s) => s.project)
  const assets = useEditor((s) => s.assets)
  const updateTimeline = useEditor((s) => s.updateTimeline)
  const owner = useOwner()
  const qc = useQueryClient()
  const [format, setFormat] = useState<ExportFormat>('mp4')
  const [res, setRes] = useState<(typeof RESOLUTIONS)[number]['id']>('1080p')
  const [quality, setQuality] = useState<ExportQuality>('standard')
  const [burnCaptions, setBurnCaptions] = useState(true)
  const [fps, setFps] = useState(30)
  const [progress, setProgress] = useState<ExportProgress | null>(null)
  const [result, setResult] = useState<(ExportResult & { fileName: string }) | null>(null)
  const [support, setSupport] = useState<Awaited<ReturnType<typeof encoderSupport>> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abort = useRef<AbortController | null>(null)
  const startedAt = useRef(0)

  const aspect = timeline ? aspectOf(timeline) : '16:9'
  const size = dims(aspect, RESOLUTIONS.find((r) => r.id === res)?.short ?? 1080)
  const duration = timeline ? timelineDuration(timeline) : 0
  const hasCaptions = Boolean(timeline?.tracks.some((t) => t.kind === 'caption' && t.clips.length))

  useEffect(() => {
    if (!open) return
    let live = true
    void encoderSupport(size.width, size.height).then((s) => live && setSupport(s))
    return () => {
      live = false
    }
  }, [open, size.width, size.height])

  const running = progress !== null && result === null && error === null
  const [eta, setEta] = useState<number | null>(null)

  const start = async () => {
    if (!timeline || !project) return
    setError(null)
    setResult(null)
    setEta(null)
    setProgress({ frame: 0, frames: Math.round(duration * fps), fps: 0 })
    startedAt.current = performance.now()
    const controller = new AbortController()
    abort.current = controller
    const safe = project.name.replace(/[^\w.-]+/g, '-').replace(/^-|-$/g, '') || 'animato-export'
    const fileName = `${safe}-${res}.${format}`
    const id = uid('exp')
    const exported: Timeline = burnCaptions
      ? timeline
      : {
          ...timeline,
          tracks: timeline.tracks.map((t) => (t.kind === 'caption' ? { ...t, hidden: true } : t)),
        }
    try {
      const out = await exportTimeline(
        {
          timeline: { ...exported, fps },
          assets: [...assets.values()],
          width: size.width,
          height: size.height,
          fps,
          format,
          quality,
          path: `exports/${id}.${format}`,
          compositor,
        },
        (p) => {
          setProgress(p)
          const elapsed = (performance.now() - startedAt.current) / 1000
          setEta(p.frame > 0 ? (elapsed / p.frame) * (p.frames - p.frame) : null)
        },
        controller.signal,
      )
      await exportsTable.put({
        id,
        owner,
        projectId: project.id,
        projectName: project.name,
        fileName,
        format,
        videoCodec: out.videoCodec,
        width: size.width,
        height: size.height,
        duration: out.duration,
        size: out.size,
        createdAt: Date.now(),
        path: out.path,
      })
      void qc.invalidateQueries({ queryKey: ['exports', owner] })
      setResult({ ...out, fileName })
      triggerDownload(await readFile(out.path), fileName)
      toast.success('Export finished', `${fileName} · ${formatBytes(out.size)}`)
    } catch (e) {
      if (controller.signal.aborted) {
        setProgress(null)
        toast.info('Export cancelled')
      } else setError(e instanceof Error ? e.message : String(e))
    } finally {
      abort.current = null
    }
  }

  const close = () => {
    if (running) return
    setProgress(null)
    setResult(null)
    setError(null)
    onClose()
  }

  const footer = result ? (
    <>
      <Button variant="secondary" onClick={close}>
        Done
      </Button>
      <Button
        leftIcon={<Download className="size-4" />}
        onClick={async () => triggerDownload(await readFile(result.path), result.fileName)}
      >
        Download again
      </Button>
    </>
  ) : running ? (
    <Button variant="danger" onClick={() => abort.current?.abort()} data-testid="export-cancel">
      Cancel export
    </Button>
  ) : (
    <>
      <Button variant="ghost" onClick={close}>
        Close
      </Button>
      <Button
        onClick={() => void start()}
        disabled={duration <= 0 || (support !== null && !support[format])}
        data-testid="export-start"
      >
        Export {format.toUpperCase()}
      </Button>
    </>
  )

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Export video"
      description="Rendered and encoded on this device. Nothing is uploaded."
      footer={footer}
      className="sm:max-w-xl"
    >
      {result ? (
        <div className="py-4 text-center" data-testid="export-done">
          <CheckCircle2 className="mx-auto size-10 text-status-succeeded" />
          <p className="mt-3 font-display text-lg font-semibold">{result.fileName}</p>
          <p className="mt-1 font-mono text-xs text-fg-subtle">
            {formatBytes(result.size)} · {formatDuration(result.duration)} · {result.frames} frames ·{' '}
            {result.videoCodec}
            {result.audioCodec ? ` + ${result.audioCodec}` : ''}
          </p>
          <p className="mt-1 text-xs text-fg-subtle">Composited with {result.compositor}</p>
        </div>
      ) : running && progress ? (
        <div className="py-2" data-testid="export-progress">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-medium">Rendering frames</p>
            <p className="font-mono text-xs text-fg-muted tabular-nums" data-testid="export-frame">
              Frame {progress.frame} / {progress.frames}
            </p>
          </div>
          <Progress
            value={progress.frames ? progress.frame / progress.frames : 0}
            className="mt-3 h-2"
            label="Export progress"
          />
          <p className="mt-2 font-mono text-2xs text-fg-subtle">
            {progress.fps ? `${progress.fps.toFixed(1)} fps` : 'Starting encoder…'}
            {eta !== null ? ` · about ${Math.ceil(eta)}s left` : ''}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          <div>
            <Label>Platform preset</Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {PLATFORMS.map((p) => (
                <button
                  key={p.aspect}
                  type="button"
                  onClick={() => updateTimeline(ASPECT_PRESETS[p.aspect], 'Change aspect')}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-left transition-colors',
                    aspect === p.aspect
                      ? 'border-accent bg-accent-soft'
                      : 'border-line hover:border-line-strong',
                  )}
                >
                  <span className="block text-sm font-medium">{p.label}</span>
                  <span className="text-2xs text-fg-subtle">{p.hint}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Format</Label>
              <Tabs
                label="Format"
                value={format}
                onChange={setFormat}
                items={[
                  { value: 'mp4', label: 'MP4' },
                  { value: 'webm', label: 'WebM' },
                ]}
              />
            </div>
            <div>
              <Label>Resolution</Label>
              <Tabs
                label="Resolution"
                value={res}
                onChange={setRes}
                items={RESOLUTIONS.map((r) => ({ value: r.id, label: r.id }))}
              />
            </div>
            <div>
              <Label>Quality</Label>
              <Tabs
                label="Quality"
                value={quality}
                onChange={setQuality}
                items={[
                  { value: 'draft', label: 'Draft' },
                  { value: 'standard', label: 'Standard' },
                  { value: 'high', label: 'High' },
                ]}
              />
            </div>
            <div>
              <Label>Frame rate</Label>
              <Tabs
                label="Frame rate"
                value={String(fps) as '30' | '60'}
                onChange={(v) => setFps(Number(v))}
                items={[
                  { value: '30', label: '30 fps' },
                  { value: '60', label: '60 fps' },
                ]}
              />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-line px-3 py-2.5">
            <div>
              <p className="text-sm">Burn in captions</p>
              <p className="text-2xs text-fg-subtle">
                {hasCaptions ? 'Captions are drawn into the picture.' : 'This timeline has no captions yet.'}
              </p>
            </div>
            <Switch
              label="Burn in captions"
              checked={burnCaptions && hasCaptions}
              disabled={!hasCaptions}
              onChange={setBurnCaptions}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-2xs text-fg-subtle">
            <Badge>
              {size.width}×{size.height}
            </Badge>
            <Badge>{formatDuration(duration)}</Badge>
            {support ? (
              <>
                <Badge tone={support[format] ? 'succeeded' : 'failed'}>
                  {support[format] ? 'Encoder available' : `No ${format.toUpperCase()} encoder at this size`}
                </Badge>
                {format === 'mp4' ? (
                  <Badge>
                    {support.h264 ? 'H.264' : 'VP9/AV1 in MP4'}
                    {support.aac ? ' + AAC' : ' + Opus'}
                  </Badge>
                ) : (
                  <Badge>VP9 + Opus</Badge>
                )}
              </>
            ) : (
              <Badge>Checking encoders…</Badge>
            )}
          </div>
          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-status-failed/30 bg-status-failed/10 p-3 text-sm text-status-failed"
            >
              {error}
            </p>
          ) : null}
        </div>
      )}
    </Dialog>
  )
}
