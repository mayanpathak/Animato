// Counters and timings for work done by the engine, shown in the editor's
// performance badge and read by the e2e suite (window.__animatoEngineCalls).
import { create } from 'zustand'

export type EngineCategory =
  'timeline' | 'demux' | 'decode' | 'composite' | 'audio' | 'encode' | 'captions' | 'dsp'

export interface EngineCall {
  category: EngineCategory
  name: string
  backend: string
  ms: number
}

interface EngineStats {
  last: EngineCall | null
  record: (call: EngineCall) => void
}

declare global {
  interface Window {
    __animatoEngineCalls?: Record<string, number>
    __animatoEngineBackends?: Record<string, string>
  }
}

export const useEngineStats = create<EngineStats>((set) => ({
  last: null,
  record: (call) => {
    if (typeof window !== 'undefined') {
      const calls = (window.__animatoEngineCalls ??= {})
      calls[call.category] = (calls[call.category] ?? 0) + 1
      calls[`${call.category}:${call.name}`] = (calls[`${call.category}:${call.name}`] ?? 0) + 1
      ;(window.__animatoEngineBackends ??= {})[call.category] = call.backend
    }
    set({ last: call })
  },
}))

export function recordCall(call: EngineCall): void {
  useEngineStats.getState().record(call)
}
