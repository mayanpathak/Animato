import { useRef } from 'react'
import { Download, FileUp, Languages, Trash2, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/misc'
import { toast } from '@/stores/toast'
import { cn } from '@/lib/cn'
import { useEditor } from '../store'
import { captionsItem } from '../model/timelineV2'
import { cuesFromTranscript, editChunk, removeChunk } from '../model/transcript'
import { autoCaption, useCaptioning } from '../engine/voice'
import { CaptionStyleControls } from './Inspector'

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
  const project = useEditor((s) => s.project)
  const setCaptions = useEditor((s) => s.setCaptions)
  const setTranscript = useEditor((s) => s.setTranscript)
  const transcript = useEditor((s) => s.transcript)
  const setPlayhead = useEditor((s) => s.setPlayhead)
  const select = useEditor((s) => s.select)
  const fileRef = useRef<HTMLInputElement>(null)
  const busy = useCaptioning((st) => st.busy)

  if (!timeline || !engine) return null
  const captions = captionsItem(timeline)
  const maxWords = captions?.maxWords ?? 7
  const sorted = cuesFromTranscript(transcript, maxWords)
  const asCues = () => sorted

  const run = async () => {
    try {
      const made = await autoCaption()
      if (!made) toast.info('No speech found', 'Record a voiceover or add a clip with dialogue first.')
      else
        toast.success(
          `${made.lines} captions created`,
          `${made.words} words, timed to your voice. Edit any line below.`,
        )
    } catch (e) {
      toast.error('Auto-captions failed', e instanceof Error ? e.message : undefined)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2 p-3">
        <Button
          className="w-full"
          leftIcon={<Wand2 className="size-4" />}
          onClick={() => void run()}
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
            disabled={!sorted.length}
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
              setCaptions(parsed, { assetId: 'srt-import', model: 'srt' })
              toast.success(`${parsed.length} captions imported`)
            }
          }}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto border-t border-line">
        {captions && sorted.length > 0 ? <CaptionStyleControls item={captions} /> : null}
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
            {sorted.map((c, i) => (
              <li key={`${i}-${c.start}`} className="group flex gap-2 px-3 py-2">
                <button
                  type="button"
                  className="shrink-0 font-mono text-2xs text-accent hover:underline"
                  onClick={() => {
                    setPlayhead(c.start)
                    select(null)
                  }}
                >
                  {engine.secondsToTimecode(c.start, timeline.fps).slice(3, 8)}
                </button>
                <textarea
                  aria-label="Caption text"
                  value={c.text}
                  rows={1}
                  onChange={(e) => {
                    const text = e.target.value
                    const t = useEditor.getState().transcript
                    if (t) setTranscript(editChunk(t, i, maxWords, text), `cap-${i}`)
                  }}
                  className={cn(
                    'min-h-6 flex-1 resize-none bg-transparent text-xs text-fg focus:outline-none',
                  )}
                />
                <button
                  type="button"
                  aria-label="Delete caption"
                  onClick={() => transcript && setTranscript(removeChunk(transcript, i, maxWords))}
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
