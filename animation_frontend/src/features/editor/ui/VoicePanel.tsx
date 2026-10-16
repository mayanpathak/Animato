import { useEffect, useRef, useState } from 'react'
import { Circle, Headphones, Mic, Square } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Label, Select } from '@/components/ui/field'
import { Progress, Switch } from '@/components/ui/misc'
import { track } from '@/lib/analytics'
import type { MediaAsset } from '@/lib/local/models'
import { useOwner } from '@/lib/local/hooks'
import { toast } from '@/stores/toast'
import { cn } from '@/lib/cn'
import { autoCaption, cleanVoiceClip, useCaptioning } from '../engine/voice'
import { importFile } from '../media/client'
import { useEditor } from '../store'

/** Wall-clock milliseconds (outside the component, so lint reads it as an event-time call). */
const now = () => performance.now()

type Phase = 'idle' | 'countdown' | 'recording' | 'saving'

export function VoicePanel() {
  const owner = useOwner()
  const qc = useQueryClient()
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [deviceId, setDeviceId] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [count, setCount] = useState(3)
  const [level, setLevel] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [withPlayback, setWithPlayback] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const recorder = useRef<MediaRecorder | null>(null)
  const meterRaf = useRef(0)
  const ctx = useRef<AudioContext | null>(null)
  const startAt = useRef(0)
  const takes = useRef(0)
  const uploadInput = useRef<HTMLInputElement>(null)
  const captioning = useCaptioning((s) => s.busy)

  const stopMeter = () => {
    cancelAnimationFrame(meterRaf.current)
    void ctx.current?.close()
    ctx.current = null
    stream.current?.getTracks().forEach((t) => t.stop())
    stream.current = null
    setLevel(0)
  }

  useEffect(() => () => stopMeter(), [])

  const openMic = async () => {
    setError(null)
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
        },
      })
      stream.current = s
      const list = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput')
      setDevices(list)
      if (!deviceId) setDeviceId(s.getAudioTracks()[0]?.getSettings().deviceId ?? '')
      const ac = new AudioContext()
      ctx.current = ac
      const analyser = ac.createAnalyser()
      analyser.fftSize = 1024
      ac.createMediaStreamSource(s).connect(analyser)
      const data = new Float32Array(analyser.fftSize)
      const loop = () => {
        analyser.getFloatTimeDomainData(data)
        let peak = 0
        for (const v of data) peak = Math.max(peak, Math.abs(v))
        setLevel(peak)
        meterRaf.current = requestAnimationFrame(loop)
      }
      loop()
      return s
    } catch (e) {
      setError(
        e instanceof DOMException && e.name === 'NotAllowedError'
          ? 'Microphone access was blocked. Allow it in the address bar and try again.'
          : 'No microphone is available.',
      )
      return null
    }
  }

  const start = async () => {
    const s = stream.current ?? (await openMic())
    if (!s) return
    setPhase('countdown')
    for (let i = 3; i > 0; i--) {
      setCount(i)
      await new Promise((r) => setTimeout(r, 700))
    }
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm'
    const rec = new MediaRecorder(s, { mimeType: mime, audioBitsPerSecond: 128_000 })
    const chunks: Blob[] = []
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
    rec.onstop = async () => {
      setPhase('saving')
      const blob = new Blob(chunks, { type: 'audio/webm' })
      takes.current += 1
      try {
        const asset = await importFile(blob, {
          owner,
          name: `Voiceover take ${takes.current}.webm`,
          mime: 'audio/webm',
        })
        await qc.invalidateQueries({ queryKey: ['media', owner] })
        await addVoice(asset, startAt.current, 'Placed on the Voice track where recording started.')
        track('voice_record', { seconds: Math.round(asset.duration) })
      } catch (e) {
        toast.error('Could not save the take', e instanceof Error ? e.message : undefined)
      } finally {
        setPhase('idle')
      }
    }
    recorder.current = rec
    startAt.current = useEditor.getState().playhead
    rec.start(250)
    setPhase('recording')
    const t0 = now()
    const tick = () => {
      if (recorder.current?.state === 'recording') {
        setElapsed((now() - t0) / 1000)
        setTimeout(tick, 100)
      }
    }
    tick()
    if (withPlayback && !useEditor.getState().playing)
      window.dispatchEvent(new CustomEvent('animato:toggle-play'))
  }

  /** A voice clip on the Voice track, cleaned, then captions from it (J5). */
  const addVoice = async (asset: MediaAsset, at: number, where: string) => {
    const id = useEditor.getState().addAssetAt(asset, 'voice', at)
    useEditor.getState().select(id)
    await cleanVoiceClip(id)
    toast.success('Voiceover added', `${where} Loudness normalised, noise gate on.`)
    // Captions follow the voice, unless they were edited by hand: those are kept.
    if (useEditor.getState().transcript?.edited) {
      toast.info('Your edited captions were kept', 'Generate them again from Captions to include this take.')
      return
    }
    try {
      const made = await autoCaption()
      if (made)
        toast.success(
          `${made.lines} captions created`,
          'Timed to your voice. Click a line in Captions to fix it.',
        )
    } catch (e) {
      toast.error('Auto-captions failed', e instanceof Error ? e.message : undefined)
    }
  }

  const upload = async (file: File) => {
    setPhase('saving')
    try {
      const asset = await importFile(file, { owner, name: file.name })
      await qc.invalidateQueries({ queryKey: ['media', owner] })
      if (asset.kind !== 'audio') throw new Error('Choose an audio file (MP3, WAV, M4A, WebM).')
      await addVoice(asset, useEditor.getState().playhead, 'Placed at the playhead.')
    } catch (e) {
      toast.error(`Could not add ${file.name}`, e instanceof Error ? e.message : undefined)
    } finally {
      setPhase('idle')
    }
  }

  const stop = () => {
    if (useEditor.getState().playing) window.dispatchEvent(new CustomEvent('animato:toggle-play'))
    recorder.current?.stop()
    recorder.current = null
  }

  // Space stops a take (before the editor's play/pause shortcut sees it).
  useEffect(() => {
    if (phase !== 'recording') return
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      e.preventDefault()
      e.stopPropagation()
      stop()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [phase])

  return (
    <div className="space-y-4 p-3" data-testid="voice-panel">
      <div>
        <Label htmlFor="mic-device">Input</Label>
        <Select
          id="mic-device"
          value={deviceId}
          onChange={(e) => {
            setDeviceId(e.target.value)
            stopMeter()
          }}
          onFocus={() => {
            if (!devices.length) void openMic()
          }}
        >
          {devices.length === 0 ? <option value="">Default microphone</option> : null}
          {devices.map((d, i) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || `Microphone ${i + 1}`}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <div className="mb-1 flex justify-between text-2xs text-fg-subtle">
          <span>Level</span>
          <span className="font-mono">{level > 0 ? `${(20 * Math.log10(level)).toFixed(0)} dBFS` : '—'}</span>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-surface-3"
          role="meter"
          aria-label="Input level"
          aria-valuemin={0}
          aria-valuemax={1}
          aria-valuenow={Number(level.toFixed(2))}
        >
          <div
            className={cn(
              'h-full rounded-full transition-[width] duration-75',
              level > 0.9 ? 'bg-status-failed' : 'bg-accent-fill',
            )}
            style={{ width: `${Math.min(100, level * 140)}%` }}
          />
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm">Play the timeline while recording</p>
          <p className="text-2xs text-fg-subtle">Your take lines up with the picture.</p>
        </div>
        <Switch label="Play while recording" checked={withPlayback} onChange={setWithPlayback} />
      </div>
      {phase === 'recording' ? (
        <Button
          variant="danger"
          className="w-full"
          leftIcon={<Square className="size-4" />}
          onClick={stop}
          data-testid="record-stop"
        >
          Stop · {elapsed.toFixed(1)}s
        </Button>
      ) : (
        <Button
          className="w-full"
          leftIcon={
            phase === 'countdown' ? <Circle className="size-4 animate-pulse" /> : <Mic className="size-4" />
          }
          onClick={() => void start()}
          loading={phase === 'saving'}
          disabled={phase !== 'idle'}
          data-testid="record-start"
        >
          {phase === 'countdown'
            ? `Recording in ${count}…`
            : phase === 'saving'
              ? 'Saving take'
              : 'Record voiceover'}
        </Button>
      )}
      <input
        ref={uploadInput}
        type="file"
        accept="audio/*"
        className="hidden"
        data-testid="voice-upload"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) void upload(file)
        }}
      />
      <Button
        variant="ghost"
        size="sm"
        className="w-full"
        disabled={phase !== 'idle'}
        onClick={() => uploadInput.current?.click()}
      >
        Or upload a voiceover
      </Button>
      {captioning ? (
        <div className="rounded-lg border border-line bg-surface-2 p-3" data-testid="captioning">
          <p className="text-xs">{captioning.label}</p>
          <Progress
            value={captioning.value}
            indeterminate={captioning.indeterminate}
            className="mt-2 h-1.5"
            label={captioning.label}
          />
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs text-status-failed">
          {error}
        </p>
      ) : null}
      <p className="flex gap-2 text-2xs text-fg-subtle">
        <Headphones className="size-3.5 shrink-0" />
        Use headphones so the timeline audio does not bleed into the take. Each take is normalised and gated,
        music dips under it, and captions follow it. Space stops recording.
      </p>
    </div>
  )
}
