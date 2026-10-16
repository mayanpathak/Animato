import { useEffect, useRef, useState } from 'react'
import { Circle, Headphones, Mic, Square } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Label, Select } from '@/components/ui/field'
import { Switch } from '@/components/ui/misc'
import { useOwner } from '@/lib/local/hooks'
import { toast } from '@/stores/toast'
import { cn } from '@/lib/cn'
import { importFile } from '../media/client'
import { useEditor } from '../store'

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
        const id = useEditor.getState().addAssetAt(asset, 'voice', startAt.current)
        useEditor.getState().select(id)
        toast.success('Voiceover added', 'Placed on the Voice track where recording started.')
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
    const t0 = performance.now()
    const tick = () => {
      if (recorder.current?.state === 'recording') {
        setElapsed((performance.now() - t0) / 1000)
        setTimeout(tick, 100)
      }
    }
    tick()
    if (withPlayback && !useEditor.getState().playing)
      window.dispatchEvent(new CustomEvent('animato:toggle-play'))
  }

  const stop = () => {
    if (useEditor.getState().playing) window.dispatchEvent(new CustomEvent('animato:toggle-play'))
    recorder.current?.stop()
    recorder.current = null
  }

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
      {error ? (
        <p role="alert" className="text-xs text-status-failed">
          {error}
        </p>
      ) : null}
      <p className="flex gap-2 text-2xs text-fg-subtle">
        <Headphones className="size-3.5 shrink-0" />
        Use headphones so the timeline audio does not bleed into the take. Then normalize, gate and duck it
        from the inspector.
      </p>
    </div>
  )
}
