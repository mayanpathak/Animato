// Real-time preview mixing: the Rust tooscut-audio-engine running inside an
// AudioWorklet. The compiled WebAssembly.Module arrives from the main thread.
import './worklet-polyfill'
import { AudioEngine, initSync } from '@/wasm/pkg/animato_wasm.js'

declare const sampleRate: number
declare function registerProcessor(name: string, ctor: unknown): void
declare class AudioWorkletProcessor {
  readonly port: MessagePort
}

type Msg =
  | { type: 'init'; module: WebAssembly.Module }
  | { type: 'upload'; id: string; pcm: Float32Array }
  | { type: 'remove'; id: string }
  | { type: 'timeline'; json: string }
  | { type: 'play'; at: number }
  | { type: 'pause' }
  | { type: 'seek'; at: number }

class MixerProcessor extends AudioWorkletProcessor {
  private engine: AudioEngine | null = null
  private buffer = new Float32Array(256)
  private frames = 0

  constructor() {
    super()
    this.port.onmessage = (e: MessageEvent<Msg>) => this.onMessage(e.data)
  }

  private onMessage(m: Msg) {
    if (m.type === 'init') {
      initSync({ module: m.module })
      this.engine = new AudioEngine(sampleRate)
      this.port.postMessage({ type: 'ready' })
      return
    }
    const e = this.engine
    if (!e) return
    if (m.type === 'upload') e.upload_audio(m.id, m.pcm, 48000, 2)
    else if (m.type === 'remove') e.remove_audio(m.id)
    else if (m.type === 'timeline') e.set_timeline(m.json)
    else if (m.type === 'play') {
      e.seek(m.at)
      e.set_playing(true)
    } else if (m.type === 'pause') e.set_playing(false)
    else if (m.type === 'seek') e.seek(m.at)
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const out = outputs[0]
    if (!this.engine || !out?.length) return true
    const n = out[0].length
    if (this.buffer.length < n * 2) this.buffer = new Float32Array(n * 2)
    this.engine.render(this.buffer, n)
    const left = out[0]
    const right = out[1] ?? out[0]
    for (let i = 0; i < n; i++) {
      left[i] = this.buffer[i * 2]
      right[i] = this.buffer[i * 2 + 1]
    }
    this.frames += n
    if (this.frames >= 4096) {
      this.frames = 0
      this.port.postMessage({ type: 'time', time: this.engine.get_current_time() })
    }
    return true
  }
}

registerProcessor('animato-mixer', MixerProcessor)
