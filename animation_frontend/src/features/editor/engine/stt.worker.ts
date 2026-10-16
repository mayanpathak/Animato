// On-device speech-to-text for auto-captions. The timeline's audio is mixed
// offline by the Rust audio engine, resampled to 16 kHz by offcut-dsp and
// transcribed by Whisper (transformers.js, ONNX on WebAssembly). The model is
// downloaded once on first use and cached by the browser; nothing is uploaded.
import { env, pipeline, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers'
import type { MediaAsset } from '@/lib/local/models'
import { fileHandle } from '@/lib/local/opfs'
import type { TimedWord } from '@/wasm/engine'
import type { Timeline } from '../model/timeline'
import { timelineDuration } from '../model/timeline'
import { audioAssetIds, buildAudioTimeline } from './compose'
import { MIX_RATE } from './decode'
import { serve } from './rpc'
import { loadWasm } from './wasm'

export const STT_MODEL = 'onnx-community/whisper-tiny.en'

env.allowLocalModels = false

let asr: Promise<AutomaticSpeechRecognitionPipeline> | null = null

function model(progress: (p: unknown) => void): Promise<AutomaticSpeechRecognitionPipeline> {
  asr ??= pipeline('automatic-speech-recognition', STT_MODEL, {
    dtype: 'q8',
    device: 'wasm',
    progress_callback: (p: unknown) => progress({ stage: 'download', detail: p }),
  }) as Promise<AutomaticSpeechRecognitionPipeline>
  return asr
}

async function mixdown(tl: Timeline, assets: MediaAsset[]): Promise<Float32Array> {
  const wasm = await loadWasm()
  const map = new Map(assets.map((a) => [a.id, a]))
  const engine = new wasm.AudioEngine(MIX_RATE)
  for (const id of audioAssetIds(tl, map)) {
    try {
      const file = await (await fileHandle(`pcm/${id}.f32`)).getFile()
      engine.upload_audio(id, new Float32Array(await file.arrayBuffer()), MIX_RATE, 2)
    } catch {
      // asset without cached audio: silent
    }
  }
  engine.set_timeline(JSON.stringify(buildAudioTimeline(tl, map)))
  engine.seek(0)
  engine.set_playing(true)
  const frames = Math.round(timelineDuration(tl) * MIX_RATE)
  const mono = new Float32Array(frames)
  const block = 4096
  const buf = new Float32Array(block * 2)
  for (let at = 0; at < frames; at += block) {
    const n = Math.min(block, frames - at)
    engine.render(buf, n)
    for (let i = 0; i < n; i++) mono[at + i] = (buf[i * 2] + buf[i * 2 + 1]) / 2
  }
  engine.free()
  return wasm.resample(mono, MIX_RATE, 16_000)
}

async function transcribe(
  tl: Timeline,
  assets: MediaAsset[],
  progress: (p: unknown) => void,
): Promise<TimedWord[]> {
  progress({ stage: 'mix' })
  const audio = await mixdown(tl, assets)
  if (!audio.length) return []
  const recognizer = await model(progress)
  progress({ stage: 'transcribe' })
  const out = (await recognizer(audio, {
    return_timestamps: 'word',
    chunk_length_s: 30,
    stride_length_s: 5,
  })) as {
    chunks?: { text: string; timestamp: [number, number | null] }[]
  }
  return (out.chunks ?? [])
    .filter((c) => c.text.trim())
    .map((c) => ({
      text: c.text.trim(),
      startMs: Math.round(c.timestamp[0] * 1000),
      endMs: Math.round((c.timestamp[1] ?? c.timestamp[0] + 0.3) * 1000),
      confidence: 1,
    }))
}

serve({
  transcribe: (a, ctx) => transcribe(a[0] as Timeline, a[1] as MediaAsset[], ctx.progress),
})
