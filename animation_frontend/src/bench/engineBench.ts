// Plan 10.4 measurements: each responsibility where the editor engine and
// @tooscut/render-engine / src/workers overlap is timed on the same inputs in
// the same browser. Loaded only in the mocked e2e build (window.__animatoBench)
// and run by e2e/bench.spec.ts; the results go to DESIGN_NOTES.md.
import * as Comlink from 'comlink'
import { VideoFrameLoader } from '@tooscut/render-engine'
import { writeFile } from '@/lib/local/opfs'
import { decodeAudio, FrameDecoder, MIX_RATE } from '@/features/editor/engine/decode'
import { openMedia } from '@/features/editor/engine/demux'
import { loadWasm } from '@/features/editor/engine/wasm'
import type { WaveformWorkerApi } from '@/workers/waveform.worker'

export interface BenchInput {
  name: string
  bytes: Uint8Array
  mime: string
}

function stats(ms: number[]) {
  const s = [...ms].sort((a, b) => a - b)
  const pick = (q: number) => s[Math.min(s.length - 1, Math.floor(q * s.length))]
  return {
    n: s.length,
    median: Math.round(pick(0.5) * 10) / 10,
    p95: Math.round(pick(0.95) * 10) / 10,
    total: Math.round(s.reduce((a, b) => a + b, 0)),
  }
}

/** Deterministic pseudo-random seek points. */
function seeks(duration: number, n: number): number[] {
  let x = 42
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    x = (x * 1103515245 + 12345) % 2 ** 31
    out.push(((x / 2 ** 31) * duration * 0.95) as number)
  }
  return out
}

function heap(): number | null {
  const m = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
  return m ? Math.round(m.usedJSHeapSize / 1e5) / 10 : null
}

async function frameLoading(input: BenchInput) {
  const blob = new Blob([input.bytes as Uint8Array<ArrayBuffer>], { type: input.mime })
  const path = `bench/${input.name}`
  await writeFile(path, blob)

  // Editor engine: OPFS + Rust offcut-mp4 (or mediabunny) demux, WebCodecs decode.
  const media = await openMedia(path, input.name)
  const duration = media.duration
  const points = seeks(duration, 20)
  const seq = Array.from({ length: 30 }, (_, i) => Math.min(duration - 0.05, i / 30))
  const editor = { random: [] as number[], sequential: [] as number[], demuxer: media.demuxer }
  if (media.video) {
    const dec = new FrameDecoder(media.video)
    for (const t of points) {
      const t0 = performance.now()
      ;(await dec.frameAt(t))?.close()
      editor.random.push(performance.now() - t0)
    }
    for (const t of seq) {
      const t0 = performance.now()
      ;(await dec.frameAt(t))?.close()
      editor.sequential.push(performance.now() - t0)
    }
    dec.close()
  }
  media.close()

  // render-engine: VideoFrameLoader in export mode (mediabunny).
  const re = { random: [] as number[], sequential: [] as number[], failures: 0, firstError: '' }
  const loader = await VideoFrameLoader.fromBlob(blob, { mode: 'export' })
  const grab = async (t: number, into: number[]) => {
    const t0 = performance.now()
    try {
      ;(await loader.getImageBitmap(t)).close()
      into.push(performance.now() - t0)
    } catch (e) {
      re.failures++
      re.firstError ||= `t=${t.toFixed(2)}: ${e instanceof Error ? e.message : String(e)}`
    }
  }
  for (const t of points) await grab(t, re.random)
  for (const t of seq) await grab(t, re.sequential)
  loader.dispose()

  return {
    file: input.name,
    duration,
    editor: { demuxer: editor.demuxer, random: stats(editor.random), sequential: stats(editor.sequential) },
    renderEngine: {
      random: stats(re.random),
      sequential: stats(re.sequential),
      failures: re.failures,
      firstError: re.firstError,
    },
  }
}

async function waveforms(input: BenchInput) {
  const blob = new Blob([input.bytes as Uint8Array<ArrayBuffer>], { type: input.mime })
  const path = `bench/${input.name}`
  await writeFile(path, blob)

  // Editor media worker path: decode to 48 kHz stereo PCM (cached for playback
  // and export too), resample to 8 kHz with offcut-dsp, Rust waveform_peaks.
  const t0 = performance.now()
  const media = await openMedia(path, input.name)
  const audio = media.audio ? await decodeAudio(media.audio) : null
  const wasm = await loadWasm()
  let peaks = 0
  if (audio?.pcm.length) {
    const frames = audio.pcm.length / 2
    const mono = new Float32Array(frames)
    for (let i = 0; i < frames; i++) mono[i] = (audio.pcm[i * 2] + audio.pcm[i * 2 + 1]) / 2
    peaks = wasm.waveform_peaks(
      wasm.resample(mono, MIX_RATE, 8000),
      Math.max(1, Math.round(audio.duration * 100)),
    ).length
  }
  media.close()
  const editorMs = performance.now() - t0

  // src/workers/waveform.worker.ts: mediabunny decode + JS RMS bars, in its worker.
  const worker = new Worker(new URL('../workers/waveform.worker.ts', import.meta.url), { type: 'module' })
  const api = Comlink.wrap<WaveformWorkerApi>(worker)
  const url = URL.createObjectURL(blob)
  const t1 = performance.now()
  const result = await api.extractWaveform('bench', url).catch(() => null)
  const workerMs = performance.now() - t1
  worker.terminate()
  URL.revokeObjectURL(url)
  return {
    file: input.name,
    editor: { ms: Math.round(editorMs), peaks, alsoCachesPcm: true },
    waveformWorker: { ms: Math.round(workerMs), bars: result?.waveformData.length ?? 0 },
  }
}

/** A long mono sine as 16-bit WAV, to make decode-strategy memory visible. */
function longWav(seconds: number): Blob {
  const rate = 48000
  const n = seconds * rate
  const buf = new ArrayBuffer(44 + n * 2)
  const v = new DataView(buf)
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)))
  w(0, 'RIFF')
  v.setUint32(4, 36 + n * 2, true)
  w(8, 'WAVEfmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true)
  v.setUint16(22, 1, true)
  v.setUint32(24, rate, true)
  v.setUint32(28, rate * 2, true)
  v.setUint16(32, 2, true)
  v.setUint16(34, 16, true)
  w(36, 'data')
  v.setUint32(40, n * 2, true)
  for (let i = 0; i < n; i++)
    v.setInt16(44 + i * 2, Math.round(Math.sin((i / rate) * 2 * Math.PI * 220) * 8000), true)
  return new Blob([buf], { type: 'audio/wav' })
}

/**
 * Export audio / playback decode strategy on a 60 s timeline of a long
 * source: the editor decodes the whole source to cached PCM; the audio-render
 * worker decodes 10 s windows on demand into a bounded 30 s WASM buffer.
 */
async function exportAudio(sourceSeconds: number) {
  const blob = longWav(sourceSeconds)
  const timeline = {
    clips: [
      {
        id: 'c1',
        sourceId: 'src',
        trackId: 'a1',
        startTime: 0,
        duration: 60,
        inPoint: sourceSeconds / 2,
        speed: 1,
        gain: 1,
        fadeIn: 0,
        fadeOut: 0,
      },
    ],
    tracks: [{ id: 'a1', volume: 1, pan: 0, mute: false, solo: false }],
    crossTransitions: [],
  }
  const totalSamples = 60 * MIX_RATE

  // Editor: decode everything to 48 kHz stereo f32, upload, render.
  await writeFile('bench/long.wav', blob)
  const h0 = heap()
  const t0 = performance.now()
  const media = await openMedia('bench/long.wav', 'long.wav')
  const audio = await decodeAudio(media.audio!)
  media.close()
  const wasm = await loadWasm()
  const engine = new wasm.AudioEngine(MIX_RATE)
  engine.upload_audio('src', audio.pcm, MIX_RATE, 2)
  engine.set_timeline(JSON.stringify(timeline))
  engine.seek(0)
  engine.set_playing(true)
  const out = new Float32Array(4096 * 2)
  for (let at = 0; at < totalSamples; at += 4096) engine.render(out, Math.min(4096, totalSamples - at))
  const editorMs = performance.now() - t0
  const h1 = heap()
  const editorPcmMb = Math.round((audio.pcm.byteLength / 1e6) * 10) / 10
  engine.free()

  // audio-render.worker: windowed decode, chunks acknowledged one by one.
  const worker = new Worker(new URL('../workers/audio-render.worker.ts', import.meta.url), { type: 'module' })
  const t1 = performance.now()
  let chunks = 0
  await new Promise<void>((resolve, reject) => {
    worker.onmessage = (e: MessageEvent<{ type: string; message?: string }>) => {
      if (e.data.type === 'chunk') {
        chunks++
        worker.postMessage({ type: 'ack' })
      } else if (e.data.type === 'done') resolve()
      else if (e.data.type === 'error') reject(new Error(e.data.message))
    }
    worker.postMessage({
      type: 'render',
      sources: [{ sourceId: 'src', blob }],
      timelineStateJson: JSON.stringify(timeline),
      totalSamples,
      sampleRate: MIX_RATE,
    })
  })
  const workerMs = performance.now() - t1
  worker.terminate()
  return {
    sourceSeconds,
    editor: {
      ms: Math.round(editorMs),
      decodedPcmMb: editorPcmMb,
      heapDeltaMb: h0 !== null && h1 !== null ? Math.round((h1 - h0) * 10) / 10 : null,
    },
    audioRenderWorker: {
      ms: Math.round(workerMs),
      chunks,
      boundedBufferMb: Math.round(((30 * MIX_RATE * 2 * 4) / 1e6) * 10) / 10,
    },
  }
}

export async function runEngineBench(inputs: { video: BenchInput[]; audio: BenchInput[] }) {
  const frames = []
  for (const v of inputs.video) frames.push(await frameLoading(v))
  const waves = []
  for (const a of inputs.audio) waves.push(await waveforms(a))
  const audio = [await exportAudio(300)]
  return { userAgent: navigator.userAgent, frames, waves, audio }
}
