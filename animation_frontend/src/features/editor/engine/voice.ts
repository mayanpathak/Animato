// Voice (plan 9.1, 9.2): the cleaning defaults for a new voice clip, and
// on-device captions (Whisper in stt.worker) written into the transcript.
// Progress lives in a small store so the Voice and Captions panels and
// Finish all show the same run.
import { create } from 'zustand'
import { track } from '@/lib/analytics'
import { measureLoudness } from '../media/client'
import { captionsItem, toSeconds, timelineDurationV2 } from '../model/timelineV2'
import { cuesFromTranscript, type Transcript } from '../model/transcript'
import { useEditor } from '../store'
import { connect, type RpcClient } from './rpc'

/** Loudness target for "normalize", in dB RMS. */
export const TARGET_DB = -16

/** The gain that brings `level` (dB RMS) to the target, bounded. */
export function normalizeGain(level: number): number {
  return Math.round(Math.min(8, Math.max(0.1, 10 ** ((TARGET_DB - level) / 20))) * 1000) / 1000
}

/** A new voice clip's defaults (plan 9.1): loudness normalised and a noise gate on. */
export async function cleanVoiceClip(clipId: string): Promise<void> {
  const s = useEditor.getState()
  const tl = s.timeline
  const clip = tl?.clips.find((c) => c.id === clipId)
  if (!tl || !clip) return
  let gain = clip.audio.normalizeGain
  try {
    gain = normalizeGain(
      await measureLoudness(
        clip.assetId,
        toSeconds(tl, clip.inPoint),
        toSeconds(tl, clip.duration) * clip.speed,
      ),
    )
  } catch {
    // Unmeasurable (silence): keep the gate, leave the level.
  }
  s.updateClip(clipId, { audio: { ...clip.audio, normalizeGain: gain, gate: true } })
}

let stt: RpcClient | null = null
function sttWorker(): RpcClient {
  stt ??= connect(
    new Worker(new URL('./stt.worker.ts', import.meta.url), { type: 'module', name: 'animato-stt' }),
  )
  return stt
}

interface DownloadProgress {
  file?: string
  progress?: number
}

export interface CaptioningState {
  busy: null | { label: string; value: number; indeterminate?: boolean }
}

export const useCaptioning = create<CaptioningState>(() => ({ busy: null }))

const MODEL = 'onnx-community/whisper-tiny.en_timestamped'

/**
 * Transcribes the timeline's audio on this device and stores the words as
 * the transcript (captions follow it). Returns the lines and words made, or
 * null when there was no speech. Throws on failure.
 */
export async function autoCaption(): Promise<{ lines: number; words: number } | null> {
  const s = useEditor.getState()
  const { timeline, assets, engine } = s
  if (!timeline || !engine || timelineDurationV2(timeline) <= 0) return null
  if (useCaptioning.getState().busy) return null
  const set = (busy: CaptioningState['busy']) => useCaptioning.setState({ busy })
  const before = s.transcript
  const files = new Map<string, number>()
  set({ label: 'Mixing timeline audio', value: 0, indeterminate: true })
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
          set({ label: 'Downloading the speech model (once, then cached)', value: avg })
        } else if (msg.stage === 'transcribe')
          set({ label: 'Transcribing on this device', value: 0, indeterminate: true })
      },
    })
    if (!words.length) return null
    // Captions imported or edited while this ran win over it.
    if (useEditor.getState().transcript !== before) return null
    // Word timestamps go straight into the transcript (plan 9.2). The Rust
    // normalizer finds the sentences; each one ends a caption line.
    const sentenceEnds = engine.captionsFromWords(words).map((c) => c.end)
    const timed = words
      .map((w) => ({
        text: w.text.trim(),
        start: w.startMs / 1000,
        end: w.endMs / 1000,
        confidence: w.confidence,
      }))
      .filter((w) => w.text)
    for (const end of sentenceEnds) {
      let last = -1
      timed.forEach((w, i) => {
        if (w.end <= end + 0.001) last = i
      })
      if (last >= 0) Object.assign(timed[last], { breakAfter: true })
    }
    const transcript: Transcript = {
      version: 1,
      source: { assetId: 'timeline-mix', model: MODEL },
      language: 'en',
      words: timed,
      edited: false,
    }
    useEditor.getState().setTranscript(transcript)
    const tl = useEditor.getState().timeline
    const maxWords = (tl && captionsItem(tl)?.maxWords) ?? 7
    const lines = cuesFromTranscript(transcript, maxWords).length
    track('captions_generated', { lines, words: words.length })
    return { lines, words: words.length }
  } finally {
    set(null)
  }
}
