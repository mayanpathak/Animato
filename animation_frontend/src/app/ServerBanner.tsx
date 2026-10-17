// "Can't reach Animato's server. Retrying…" (plan 6.11). Shown after any API
// call fails with no usable response; checks every 5 s with an idempotent read
// and, once the server answers, refreshes every query.
import { useEffect, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { CloudOff } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { SERVER_REACHABLE_EVENT, SERVER_UNREACHABLE_EVENT } from '@/lib/api/http'
import { SystemBanner } from './OfflineBanner'

export function ServerBanner() {
  const [down, setDown] = useState(false)
  const qc = useQueryClient()

  useEffect(() => {
    const onDown = () => setDown(true)
    const onUp = () => setDown(false)
    window.addEventListener(SERVER_UNREACHABLE_EVENT, onDown)
    window.addEventListener(SERVER_REACHABLE_EVENT, onUp)
    return () => {
      window.removeEventListener(SERVER_UNREACHABLE_EVENT, onDown)
      window.removeEventListener(SERVER_REACHABLE_EVENT, onUp)
    }
  }, [])

  useEffect(() => {
    if (!down) return
    const t = window.setInterval(async () => {
      if (!navigator.onLine) return
      try {
        // Any JSON answer (even 401) means the server is back.
        const res = await fetch('/api/auth/check-auth', { credentials: 'same-origin', cache: 'no-store' })
        await res.json()
        setDown(false)
        void qc.invalidateQueries()
      } catch {
        // still down
      }
    }, 5000)
    return () => window.clearInterval(t)
  }, [down, qc])

  return (
    <AnimatePresence>
      {down ? <SystemBanner icon={<CloudOff />}>Can’t reach Animato’s server. Retrying…</SystemBanner> : null}
    </AnimatePresence>
  )
}
