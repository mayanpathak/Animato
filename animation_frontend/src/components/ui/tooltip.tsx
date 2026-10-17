import { useId, useState, type ReactElement, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { cn } from '@/lib/cn'

/** Lightweight hover/focus tooltip. The child must accept focus. */
export function Tooltip({
  content,
  children,
  side = 'top',
  className,
}: {
  content: ReactNode
  children: ReactElement
  side?: 'top' | 'bottom' | 'right'
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <span
      className="relative inline-flex"
      onPointerEnter={() => setOpen(true)}
      onPointerLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      aria-describedby={open ? id : undefined}
    >
      {children}
      <AnimatePresence>
        {open ? (
          <motion.span
            id={id}
            role="tooltip"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12, delay: 0.3 }}
            className={cn(
              'pointer-events-none absolute z-[var(--z-tooltip)] rounded-md bg-surface-4 px-2 py-1 text-xs whitespace-nowrap text-fg shadow-md',
              side === 'top' && 'bottom-full left-1/2 mb-2 -translate-x-1/2',
              side === 'bottom' && 'top-full left-1/2 mt-2 -translate-x-1/2',
              side === 'right' && 'top-1/2 left-full ml-2 -translate-y-1/2',
              className,
            )}
          >
            {content}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </span>
  )
}
