// After a 429 on POST /api/jobs, Generate stays disabled until Retry-After
// has passed (plan 11.4). The deadline survives a reload in localStorage.
import { useEffect, useState } from 'react'
import { create } from 'zustand'

const KEY = 'animato:render-wait-until'

function read(): number {
  try {
    return Number(localStorage.getItem(KEY)) || 0
  } catch {
    return 0
  }
}

interface QuotaState {
  until: number
  block: (seconds: number) => void
}

export const useQuota = create<QuotaState>()((set) => ({
  until: typeof window === 'undefined' ? 0 : read(),
  block: (seconds) => {
    const until = Date.now() + seconds * 1000
    try {
      localStorage.setItem(KEY, String(until))
    } catch {
      // storage blocked: the wait still applies in this tab
    }
    set({ until })
  },
}))

/** Seconds until the next render is allowed; 0 when not blocked. Ticks every second. */
export function useRenderWait(): number {
  const until = useQuota((s) => s.until)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (until <= Date.now()) return
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [until])
  return Math.max(0, Math.ceil((until - now) / 1000))
}
