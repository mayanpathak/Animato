import { useSyncExternalStore } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { WifiOff } from 'lucide-react'

function subscribe(cb: () => void) {
  window.addEventListener('online', cb)
  window.addEventListener('offline', cb)
  return () => {
    window.removeEventListener('online', cb)
    window.removeEventListener('offline', cb)
  }
}

export function OfflineBanner() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true)
  return (
    <AnimatePresence>
      {!online ? (
        <motion.div
          role="status"
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          className="fixed inset-x-0 top-0 z-[var(--z-toast)] flex items-center justify-center gap-2 bg-status-warning/15 py-1.5 text-xs font-medium text-status-warning backdrop-blur-md"
        >
          <WifiOff className="size-3.5" /> You are offline. Editing and export keep working; generating needs a connection.
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
