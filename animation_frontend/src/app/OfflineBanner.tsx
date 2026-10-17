import { useSyncExternalStore } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { WifiOff } from 'lucide-react'
import { duration, ease } from '@/lib/motion'

function subscribe(cb: () => void) {
  window.addEventListener('online', cb)
  window.addEventListener('offline', cb)
  return () => {
    window.removeEventListener('online', cb)
    window.removeEventListener('offline', cb)
  }
}

export function OfflineBanner() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  )
  return (
    <AnimatePresence>
      {!online ? <SystemBanner icon={<WifiOff />}>{OFFLINE_TEXT}</SystemBanner> : null}
    </AnimatePresence>
  )
}

export const OFFLINE_TEXT = "You're offline. Editing keeps working; new renders need a connection."

/** A quiet, non-blocking line under the top of the window (plan 6.11). */
export function SystemBanner({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <motion.div
      role="status"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: duration.base, ease: ease.outExpo }}
      className="fixed top-3 left-1/2 z-[var(--z-toast)] flex -translate-x-1/2 items-center gap-2 rounded-full border border-line bg-surface-3 px-4 py-1.5 text-xs text-fg-muted shadow-md [&_svg]:size-3.5 [&_svg]:text-status-warning"
    >
      {icon}
      {children}
    </motion.div>
  )
}
