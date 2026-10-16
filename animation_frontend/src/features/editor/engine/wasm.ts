// Loads the animato-wasm module inside a worker (once per worker).
import init, * as wasm from '@/wasm/pkg/animato_wasm.js'

let ready: Promise<typeof wasm> | null = null

export function loadWasm(): Promise<typeof wasm> {
  ready ??= init().then(() => wasm)
  return ready
}

export type Wasm = typeof wasm
