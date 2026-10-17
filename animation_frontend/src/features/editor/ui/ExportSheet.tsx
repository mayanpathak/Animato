// Export (plan 6.7): a sheet over the video. Presets per platform, quality,
// "Export all formats", a progress row per output with an ETA measured from
// the real encode speed, then download, remix link and post text. Exports
// render through the preview's frame pipeline and are kept in OPFS.
import { reportIfStorageFull } from '@/lib/local/storageFull'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, ChevronDown, Copy, Download, Lightbulb, Link2, X } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { ROUTES } from '@/app/nav'
import { Drawer } from '@/components/ui/dialog'
import { Button, buttonClass } from '@/components/ui/button'
import { Label } from '@/components/ui/field'
import { Badge, Progress, Switch } from '@/components/ui/misc'
import { Tabs } from '@/components/ui/tabs'
import { jobsApi } from '@/lib/api/jobs'
import { track } from '@/lib/analytics'
import { cn } from '@/lib/cn'
import { triggerDownload } from '@/lib/download'
import { formatBytes, formatDuration } from '@/lib/format'
import { exportsTable, uid } from '@/lib/local/models'
import { readFile } from '@/lib/local/opfs'
import { useOwner } from '@/lib/local/hooks'
import { exportFileName, postText, remixLink } from '@/lib/share'
import { toast } from '@/stores/toast'
import { selectedTake } from '@/features/videos/model'
import { encoderSupport, exportTimeline } from '../engine/export-client'
import type { ExportFormat, ExportResult } from '../engine/export'
import { useTip } from '../finish/tips'
import { setFormat } from '../model/finish'
import { ASPECT_PRESETS, aspectOf, outputDuration, type AspectKey } from '../model/timelineV2'
import { useEditor } from '../store'

const PRESETS: { aspect: AspectKey; label: string }[] = [
  { aspect: '9:16', label: 'Shorts · Reels · TikTok' },
  { aspect: '16:9', label: 'YouTube' },
  { aspect: '1:1', label: 'Square post' },
]

type Quality = 'standard' | 'small'
type Resolution = '1080p' | '720p'

function dims(aspect: AspectKey, res: Resolution): { width: number; height: number } {
  const base = ASPECT_PRESETS[aspect]
  const k = (res === '720p' ? 720 : 1080) / Math.min(base.width, base.height)
  const even = (n: number) => Math.round((n * k) / 2) * 2
  return { width: even(base.width), height: even(base.height) }
}

interface Output {
  aspect: AspectKey
  fileName: string
  state: 'waiting' | 'running' | 'done' | 'failed' | 'cancelled'
  frame: number
  frames: number
  startedAt: number
  elapsed: number
  /** Seconds left, from the measured encode speed; null for the first 2 s. */
  eta: number | null
  result?: ExportResult
  error?: string
}

function seconds(s: number): string {
  return s >= 60 ? `${Math.floor(s / 60)}m ${Math.round(s % 60)}s` : `${Math.max(0, Math.round(s))}s`
}

export function ExportSheet({
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
  const transcript = useEditor((s) => s.transcript)
  const brand = useEditor((s) => s.brand)
  const owner = useOwner()
  const qc = useQueryClient()
  const [quality, setQuality] = useState<Quality>('standard')
  const [format, setFormatChoice] = useState<ExportFormat>('mp4')
  const [res, setRes] = useState<Resolution>('1080p')
  const [fps, setFps] = useState(30)
  const [more, setMore] = useState(false)
  const [all, setAll] = useState(false)
  const [burnCaptions, setBurnCaptions] = useState(true)
  const [outputs, setOutputs] = useState<Output[]>([])
  const [support, setSupport] = useState<Awaited<ReturnType<typeof encoderSupport>> | null>(null)
  const [voiceTip, dismissVoiceTip] = useTip('voice')
  const abort = useRef<AbortController | null>(null)

  const aspect = timeline ? aspectOf(timeline) : '9:16'
  const size = dims(aspect, res)
  const duration = timeline ? outputDuration(timeline) : 0
  const hasCaptions = Boolean(transcript?.words.length)
  const captionsOn = timeline?.finish ? timeline.finish.captions.enabled : burnCaptions
  const running = outputs.some((o) => o.state === 'running' || o.state === 'waiting')
  const finished = outputs.length > 0 && !running
  const take = project ? selectedTake(project) : null
  const title = timeline?.finish?.title.text.trim() || project?.name || 'Animato video'

  useEffect(() => {
    if (!open) return
    let live = true
    void encoderSupport(size.width, size.height).then((s) => live && setSupport(s))
    return () => {
      live = false
    }
  }, [open, size.width, size.height])

  // "Exporting 43% · Animato" while it runs, in any tab state (plan 6.7).
  useEffect(() => {
    if (!running) return
    const before = document.title
    const total = outputs.reduce((n, o) => n + o.frames, 0)
    const done = outputs.reduce((n, o) => n + o.frame, 0)
    document.title = `Exporting ${total ? Math.floor((done / total) * 100) : 0}% · Animato`
    return () => {
      document.title = before
    }
  }, [running, outputs])

  const patch = (i: number, p: Partial<Output>) =>
    setOutputs((list) => list.map((o, j) => (j === i ? { ...o, ...p } : o)))

  const start = async () => {
    if (!timeline || !project) return
    const aspects = all ? PRESETS.map((p) => p.aspect) : [aspect]
    const list: Output[] = aspects.map((a) => ({
      aspect: a,
      fileName: exportFileName(title, a, format),
      state: 'waiting',
      frame: 0,
      frames: Math.round(duration * fps),
      startedAt: 0,
      elapsed: 0,
      eta: null,
    }))
    setOutputs(list)
    const controller = new AbortController()
    abort.current = controller
    track('export_start', { formats: aspects.length, format })
    for (let i = 0; i < list.length; i++) {
      if (controller.signal.aborted) {
        patch(i, { state: 'cancelled' })
        continue
      }
      const out = list[i]
      const { width, height } = dims(out.aspect, res)
      // Each format is the same video laid out for it (Finish keeps the edits).
      const tl = out.aspect === aspect ? timeline : setFormat(timeline, out.aspect, { assets, brand })
      const id = uid('exp')
      const startedAt = performance.now()
      patch(i, { state: 'running', startedAt })
      try {
        const result = await exportTimeline(
          {
            // The timeline keeps its own fps (clip times are frames at it); `fps` is the export rate.
            timeline: tl,
            transcript: captionsOn ? transcript : null,
            assets: [...assets.values()],
            width,
            height,
            fps,
            format,
            quality: quality === 'small' ? 'draft' : 'standard',
            path: `exports/${id}.${format}`,
            compositor,
            brand,
          },
          (p) => {
            const elapsed = (performance.now() - startedAt) / 1000
            // An ETA only from real encode speed, after 2 s of it.
            const eta = elapsed >= 2 && p.frame > 0 ? (elapsed / p.frame) * (p.frames - p.frame) : null
            patch(i, { frame: p.frame, frames: p.frames, elapsed, eta })
          },
          controller.signal,
        )
        await exportsTable.put({
          id,
          owner,
          projectId: project.id,
          projectName: project.name,
          fileName: out.fileName,
          format,
          videoCodec: result.videoCodec,
          width,
          height,
          duration: result.duration,
          size: result.size,
          createdAt: Date.now(),
          path: result.path,
        })
        void qc.invalidateQueries({ queryKey: ['exports', owner] })
        patch(i, { state: 'done', result, frame: result.frames, frames: result.frames })
        track('export_complete', { aspect: out.aspect, format })
        triggerDownload(await readFile(result.path), out.fileName)
      } catch (e) {
        if (controller.signal.aborted) patch(i, { state: 'cancelled' })
        else
          patch(i, {
            state: 'failed',
            error: reportIfStorageFull(e)
              ? 'This browser is out of storage space.'
              : e instanceof Error
                ? e.message
                : String(e),
          })
      }
    }
    abort.current = null
  }

  const close = () => {
    if (running) return
    setOutputs([])
    onClose()
  }

  const copy = async (text: string, done: string, event?: 'remix_link_copy') => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(done)
      if (event) track(event)
    } catch {
      toast.error('Could not copy', 'Your browser blocked the clipboard.')
    }
  }

  return (
    <Drawer open={open} onClose={close} title="Export" className="sm:max-w-[480px]">
      <div className="flex h-full flex-col" data-testid="export-sheet">
        {outputs.length ? (
          <div className="space-y-3" data-testid={finished ? 'export-done' : 'export-progress'}>
            {outputs.map((o) => (
              <div
                key={o.aspect}
                className="rounded-xl border border-line bg-surface-1 p-3"
                data-testid="export-row"
              >
                <div className="flex items-center gap-2">
                  {o.state === 'done' ? <CheckCircle2 className="size-4 text-status-succeeded" /> : null}
                  <p className="min-w-0 flex-1 truncate font-mono text-xs">{o.fileName}</p>
                  {o.state === 'done' && o.result ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      leftIcon={<Download className="size-3.5" />}
                      onClick={async () => triggerDownload(await readFile(o.result!.path), o.fileName)}
                    >
                      {formatBytes(o.result.size)}
                    </Button>
                  ) : null}
                </div>
                {o.state === 'running' || o.state === 'waiting' ? (
                  <>
                    <Progress
                      value={o.frames ? o.frame / o.frames : 0}
                      className="mt-3 h-1.5"
                      label={`Export progress ${o.aspect}`}
                    />
                    <p
                      className="mt-2 font-mono text-2xs text-fg-subtle tabular-nums"
                      data-testid="export-frame"
                    >
                      {o.state === 'waiting'
                        ? 'Waiting'
                        : `Frame ${o.frame} / ${o.frames} · ${seconds(o.elapsed)}${o.eta !== null ? ` · ${seconds(o.eta)} left` : ''}`}
                    </p>
                  </>
                ) : o.state === 'done' && o.result ? (
                  <p className="mt-1 font-mono text-2xs text-fg-subtle">
                    {formatDuration(o.result.duration)} · {o.result.frames} frames · {o.result.videoCodec}
                    {o.result.audioCodec ? ` + ${o.result.audioCodec}` : ''} · {o.result.compositor}
                  </p>
                ) : o.state === 'failed' ? (
                  <p role="alert" className="mt-2 text-xs text-status-failed">
                    {o.error}
                  </p>
                ) : o.state === 'cancelled' ? (
                  <p className="mt-2 text-xs text-fg-subtle">Cancelled</p>
                ) : null}
              </div>
            ))}
            {running ? (
              <Button variant="danger" onClick={() => abort.current?.abort()} data-testid="export-cancel">
                Cancel
              </Button>
            ) : (
              <div className="space-y-2 pt-2">
                <div className="flex flex-wrap gap-2">
                  <Link to={ROUTES.videos} className={buttonClass('secondary', 'sm')}>
                    Show in Videos
                  </Link>
                  {take?.prompt ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      leftIcon={<Link2 className="size-3.5" />}
                      onClick={() =>
                        void copy(
                          remixLink(take.prompt, take.library),
                          'Link copied. It shares your prompt, not your video.',
                          'remix_link_copy',
                        )
                      }
                      data-testid="copy-remix"
                    >
                      Copy remix link
                    </Button>
                  ) : null}
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<Copy className="size-3.5" />}
                    onClick={() => void copy(postText(title, take?.prompt ?? title), 'Post text copied.')}
                  >
                    Copy post text
                  </Button>
                </div>
                {voiceTip && !hasCaptions ? (
                  <div
                    className="flex items-start gap-2 rounded-lg border border-line bg-accent-soft px-3 py-2 text-xs"
                    role="note"
                  >
                    <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-accent" />
                    <span className="flex-1">Add your voice next time for automatic captions.</span>
                    <button
                      type="button"
                      aria-label="Dismiss tip"
                      className="text-fg-subtle hover:text-fg"
                      onClick={dismissVoiceTip}
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ) : null}
                <Button variant="ghost" size="sm" onClick={() => setOutputs([])}>
                  Export again
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <Label>Preset</Label>
              <div className="space-y-1.5" role="radiogroup" aria-label="Preset">
                {PRESETS.map((p) => {
                  const d = dims(p.aspect, '1080p')
                  const active = aspect === p.aspect
                  return (
                    <button
                      key={p.aspect}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      data-testid={`preset-${p.aspect.replace(':', 'x')}`}
                      onClick={() => {
                        if (active) return
                        useEditor.getState().setFormat(p.aspect)
                        track('format_change', { format: p.aspect, from: 'export' })
                      }}
                      className={cn(
                        'flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-colors',
                        active ? 'border-accent bg-accent-soft' : 'border-line hover:border-line-strong',
                      )}
                    >
                      <span className="text-sm font-medium">{p.label}</span>
                      <span className="font-mono text-2xs text-fg-subtle">
                        {d.width}×{d.height}
                      </span>
                    </button>
                  )
                })}
              </div>
              <p className="mt-1.5 text-2xs text-fg-subtle">
                Choosing a preset switches this video to its format.
              </p>
            </div>

            <div className="flex items-center justify-between gap-3">
              <Label className="mb-0">Quality</Label>
              <Tabs
                label="Quality"
                size="sm"
                value={quality}
                onChange={setQuality}
                items={[
                  { value: 'standard', label: 'Standard' },
                  { value: 'small', label: 'Small file' },
                ]}
              />
            </div>

            <label className="flex cursor-pointer items-center justify-between gap-3">
              <span>
                <span className="block text-sm">Export all formats</span>
                <span className="block text-2xs text-fg-subtle">
                  9:16, 16:9 and 1:1, one after the other.
                </span>
              </span>
              <Switch label="Export all formats" checked={all} onChange={setAll} />
            </label>

            <div className="border-t border-line pt-3">
              <button
                type="button"
                onClick={() => setMore((m) => !m)}
                aria-expanded={more}
                className="flex w-full items-center gap-2 text-sm text-fg-subtle hover:text-fg"
                data-testid="export-more"
              >
                More
                <ChevronDown className={cn('ml-auto size-4 transition-transform', more && 'rotate-180')} />
              </button>
              {more ? (
                <div className="mt-3 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <Label className="mb-0">Container</Label>
                    <Tabs
                      label="Container"
                      size="sm"
                      value={format}
                      onChange={setFormatChoice}
                      items={[
                        { value: 'mp4', label: 'MP4' },
                        { value: 'webm', label: 'WebM' },
                      ]}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <Label className="mb-0">Size</Label>
                    <Tabs
                      label="Size"
                      size="sm"
                      value={res}
                      onChange={setRes}
                      items={[
                        { value: '1080p', label: '1080p' },
                        { value: '720p', label: '720p' },
                      ]}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <Label className="mb-0">Frame rate</Label>
                    <Tabs
                      label="Frame rate"
                      size="sm"
                      value={String(fps) as '30' | '60'}
                      onChange={(v) => setFps(Number(v))}
                      items={[
                        { value: '30', label: '30 fps' },
                        { value: '60', label: '60 fps' },
                      ]}
                    />
                  </div>
                  {timeline?.finish ? null : (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm">Burn in captions</span>
                      <Switch
                        label="Burn in captions"
                        checked={burnCaptions && hasCaptions}
                        disabled={!hasCaptions}
                        onChange={setBurnCaptions}
                      />
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    <Badge>
                      {size.width}×{size.height}
                    </Badge>
                    <Badge>{formatDuration(duration)}</Badge>
                    {support ? (
                      <>
                        <Badge tone={support[format] ? 'succeeded' : 'failed'}>
                          {support[format] ? 'Encoder available' : `No ${format.toUpperCase()} encoder here`}
                        </Badge>
                        <Badge>
                          {format === 'mp4'
                            ? `${support.h264 ? 'H.264' : 'VP9/AV1'} + ${support.aac ? 'AAC' : 'Opus'}`
                            : 'VP9 + Opus'}
                        </Badge>
                      </>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            <Button
              className="w-full"
              size="lg"
              onClick={() => void start()}
              disabled={duration <= 0 || (support !== null && !support[format])}
              data-testid="export-start"
            >
              {all ? 'Export 3 formats' : `Export ${aspect}`}
            </Button>
            <p className="text-center text-2xs text-fg-subtle">
              Rendered and encoded on this device. Nothing is uploaded.
            </p>
            {take?.status === 'Completed' ? (
              <a
                href={jobsApi.videoUrl(take.jobId)}
                download
                className={buttonClass('ghost', 'sm', 'w-full text-fg-subtle')}
              >
                Download original render
              </a>
            ) : null}
          </div>
        )}
      </div>
    </Drawer>
  )
}
