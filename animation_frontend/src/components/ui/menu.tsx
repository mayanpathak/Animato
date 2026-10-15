import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { cn } from '@/lib/cn'

export interface MenuItem {
  label: string
  icon?: ReactNode
  onSelect: () => void
  danger?: boolean
  shortcut?: string
  disabled?: boolean
}

/** A small dropdown menu anchored to its trigger. */
export function Menu({
  trigger,
  items,
  align = 'end',
  header,
  className,
}: {
  trigger: (props: { onClick: () => void; 'aria-expanded': boolean; 'aria-haspopup': 'menu' }) => ReactNode
  items: (MenuItem | 'separator')[]
  align?: 'start' | 'end'
  header?: ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const els = [...(root.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [])]
        const i = els.indexOf(document.activeElement as HTMLElement)
        const next = e.key === 'ArrowDown' ? (i + 1) % els.length : (i - 1 + els.length) % els.length
        els[next]?.focus()
      }
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    requestAnimationFrame(() => root.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus())
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={root} className="relative">
      {trigger({ onClick: () => setOpen((o) => !o), 'aria-expanded': open, 'aria-haspopup': 'menu' })}
      <AnimatePresence>
        {open ? (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className={cn(
              'absolute top-full z-[var(--z-dropdown)] mt-1.5 min-w-52 origin-top overflow-hidden rounded-lg border border-line-strong bg-glass-strong p-1 shadow-lg backdrop-blur-xl',
              align === 'end' ? 'right-0' : 'left-0',
              className,
            )}
          >
            {header}
            {items.map((item, i) =>
              item === 'separator' ? (
                <div key={i} className="my-1 h-px bg-line" />
              ) : (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => {
                    setOpen(false)
                    item.onSelect()
                  }}
                  className={cn(
                    'flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-left text-sm outline-none transition-colors disabled:opacity-40 [&_svg]:size-4',
                    item.danger
                      ? 'text-status-failed hover:bg-status-failed/10 focus:bg-status-failed/10'
                      : 'text-fg-muted hover:bg-surface-3 hover:text-fg focus:bg-surface-3 focus:text-fg',
                  )}
                >
                  {item.icon}
                  <span className="flex-1">{item.label}</span>
                  {item.shortcut ? <span className="font-mono text-2xs text-fg-faint">{item.shortcut}</span> : null}
                </button>
              ),
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
