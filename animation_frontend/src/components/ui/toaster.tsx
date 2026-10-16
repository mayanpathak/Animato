import { AnimatePresence, motion } from 'motion/react'
import { CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { useToasts } from '@/stores/toast'
import { cn } from '@/lib/cn'

export function Toaster() {
  const toasts = useToasts((s) => s.toasts)
  const dismiss = useToasts((s) => s.dismiss)
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-4 bottom-4 z-[var(--z-toast)] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, transition: { duration: 0.18 } }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto flex items-start gap-3 rounded-xl border border-line-strong bg-glass-strong p-3.5 shadow-lg backdrop-blur-xl"
          >
            <span
              className={cn(
                'mt-0.5 [&_svg]:size-4',
                t.tone === 'success' && 'text-status-succeeded',
                t.tone === 'error' && 'text-status-failed',
                t.tone === 'info' && 'text-accent',
              )}
            >
              {t.tone === 'success' ? <CheckCircle2 /> : t.tone === 'error' ? <XCircle /> : <Info />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{t.title}</p>
              {t.body ? <p className="mt-0.5 text-xs text-fg-muted">{t.body}</p> : null}
            </div>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => dismiss(t.id)}
              className="text-fg-faint hover:text-fg [&_svg]:size-3.5"
            >
              <X />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
