import { useRef, useState } from 'react'
import { Download, FileUp, Languages, Trash2, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/misc'
import { toast } from '@/stores/toast'
import { cn } from '@/lib/cn'
import { useEditor } from '../store'
import { timelineDuration, type CaptionClip } from '../model/timeline'
import { connect, type RpcClient } from '../engine/rpc'

let stt: RpcClient | null = null
function sttWorker(): RpcClient {
  stt ??= connect(
    new Worker(new URL('../engine/stt.worker.ts', import.meta.url), { type: 'module', name: 'animato-stt' }),
  )
  return stt
}

interface DownloadProgress {
  status?: string
  file?: string
  progress?: number
  loaded?: number
  total?: number
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/x-subrip' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function CaptionsPanel() {
  const timeline = useEditor((s) => s.timeline)
  const engine = useEditor((s) => s.engine)
  const assets = useEditor((s) => s.assets)
  const project = useEditor((s) => s.project)
  const setCaptions = useEditor((s) => s.setCaptions)
  const setPlayhead = useEditor((s) => s.setPlayhead)
  const select = useEditor((s) => s.select)
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<null | { label: string; value: number; indeterminate?: boolean }>(null)

  if (!timeline || !engine) return null
  const cues = (timeline.tracks.find((t) => t.kind === 'caption')?.clips ?? []) as CaptionClip[]
  const sorted = [...cues].sort((a, b) => a.start - b.start)
  const asCues = () => sorted.map((c) => ({ start: c.start, end: c.start + c.duration, text: c.text }))

  const autoCaption = async () => {
    if (timelineDuration(timeline) <= 0) return
    const files = new Map<string, number>()
    setBusy({ label: 'Mixing timeline audio', value: 0, indeterminate: true })
    try {
      const words = await sttWorker().call<
        { text: string; startMs: number; endMs: number; confidence: number }[]
      >('transcribe', [timeline, [...assets.values()]], {
        onProgress: (p) => {
          const msg = p as { stage: string; detail?: DownloadProgress }
          if (msg.stage === 'download' && msg.detail) {
            const d = msg.detail
            if (d.file && typeof d.progress === 'number') files.set(d.file, d.progress)
            const avg = files.size ? [...files.values()].reduce((a, b) => a + b, 0) / files.size / 100 : 0
            setBusy({ label: 'Downloading the speech model (once, then cached)', value: avg })
          } else if (msg.stage === 'transcribe')
            setBusy({ label: 'Transcribing on this device', value: 0, indeterminate: true })
        },
      })
      if (!words.length) {
        toast.info('No speech found', 'Record a voiceover or add a clip with dialogue first.')
        return
      }
      const result = engine.captionsFromWords(words)
      setCaptions(result)
      toast.success(
        `${result.length} captions created`,
        'Grouped into sentences by offcut-text. Edit any line below.',
      )
    } catch (e) {
      toast.error('Auto-captions failed', e instanceof Error ? e.message : undefined)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2 p-3">
        <Button
          className="w-full"
          leftIcon={<Wand2 className="size-4" />}
          onClick={() => void autoCaption()}
          disabled={busy !== null}
          data-testid="auto-captions"
        >
          Auto-caption with Whisper
        </Button>
        <p className="text-2xs text-fg-subtle">
          Runs locally (Whisper tiny, ~40 MB downloaded once). Your audio never leaves this browser.
        </p>
        {busy ? (
          <div className="rounded-lg border border-line bg-surface-2 p-2.5" data-testid="captions-progress">
            <p className="text-xs">{busy.label}</p>
            <Progress
              value={busy.value}
              indeterminate={busy.indeterminate}
              className="mt-2 h-1"
              label={busy.label}
            />
          </div>
        ) : null}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            className="flex-1"
            leftIcon={<FileUp className="size-3.5" />}
            onClick={() => fileRef.current?.click()}
            data-testid="srt-import"
          >
            Import SRT
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="flex-1"
            leftIcon={<Download className="size-3.5" />}
            disabled={!cues.length}
            onClick={() => download(`${project?.name ?? 'captions'}.srt`, engine.toSrt(asCues()))}
            data-testid="srt-export"
          >
            Export SRT
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".srt,application/x-subrip,text/plain"
          className="sr-only"
          data-testid="srt-input"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (!file) return
            const parsed = engine.parseSrt(await file.text())
            if (!parsed.length) toast.error('No captions found in that file')
            else {
              setCaptions(parsed)
              toast.success(`${parsed.length} captions imported`)
            }
          }}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto border-t border-line">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-10 text-center">
            <Languages className="size-5 text-fg-subtle" />
            <p className="mt-2 text-sm font-medium">No captions yet</p>
            <p className="mt-1 text-xs text-fg-subtle">
              Generate them from the audio, or import an SRT file.
            </p>
          </div>
        ) : (
          <ol className="divide-y divide-line" data-testid="caption-list">
            {sorted.map((c) => (
              <li key={c.id} className="group flex gap-2 px-3 py-2">
                <button
                  type="button"
                  className="shrink-0 font-mono text-2xs text-accent hover:underline"
                  onClick={() => {
                    setPlayhead(c.start)
                    select(c.id)
                  }}
                >
                  {engine.secondsToTimecode(c.start, timeline.fps).slice(3, 8)}
                </button>
                <textarea
                  aria-label="Caption text"
                  value={c.text}
                  rows={1}
                  onChange={(e) =>
                    useEditor
                      .getState()
                      .updateClip<CaptionClip>(c.id, { text: e.target.value }, `cap-${c.id}`)
                  }
                  className={cn(
                    'min-h-6 flex-1 resize-none bg-transparent text-xs text-fg focus:outline-none',
                  )}
                />
                <button
                  type="button"
                  aria-label="Delete caption"
                  onClick={() => useEditor.getState().remove(c.id)}
                  className="text-fg-subtle opacity-0 group-hover:opacity-100 hover:text-status-failed focus:opacity-100 [&_svg]:size-3.5"
                >
                  <Trash2 />
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}
