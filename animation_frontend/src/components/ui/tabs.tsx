import { useId, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { cn } from '@/lib/cn'
import { spring } from '@/lib/motion'

export interface TabItem<T extends string> {
  value: T
  label: ReactNode
  icon?: ReactNode
}

/** Segmented control: one pill track, a sliding selected pill (shared layoutId per instance). */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className,
  size = 'md',
  label,
  fill,
}: {
  items: TabItem<T>[]
  value: T
  onChange: (v: T) => void
  className?: string
  size?: 'sm' | 'md'
  label: string
  /** Equal-width segments across the full width. */
  fill?: boolean
}) {
  const id = useId()
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        'relative items-center gap-0.5 rounded-full bg-surface-2 p-0.5',
        fill ? 'flex w-full' : 'inline-flex',
        className,
      )}
      onKeyDown={(e) => {
        const i = items.findIndex((t) => t.value === value)
        if (e.key === 'ArrowRight') onChange(items[(i + 1) % items.length].value)
        if (e.key === 'ArrowLeft') onChange(items[(i - 1 + items.length) % items.length].value)
      }}
    >
      {items.map((item) => {
        const active = item.value === value
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(item.value)}
            className={cn(
              'relative inline-flex items-center justify-center gap-1.5 rounded-full font-medium whitespace-nowrap transition-colors duration-[var(--duration-fast)] [&_svg]:size-3.5',
              fill && 'flex-1',
              size === 'sm' ? 'h-7 px-3 text-xs' : 'h-8 px-3.5 text-sm',
              active ? 'text-fg' : 'text-fg-subtle hover:text-fg-muted',
            )}
          >
            {active ? (
              <motion.span
                layoutId={`tab-${id}`}
                transition={spring.layout}
                className="absolute inset-0 rounded-full bg-surface-4 shadow-sm shadow-inner-highlight"
              />
            ) : null}
            <span className="relative inline-flex items-center gap-1.5">
              {item.icon}
              {item.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** Underlined page tabs. */
export function UnderlineTabs<T extends string>({
  items,
  value,
  onChange,
  label,
  className,
}: {
  items: TabItem<T>[]
  value: T
  onChange: (v: T) => void
  label: string
  className?: string
}) {
  const id = useId()
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn('flex gap-5 overflow-x-auto border-b border-line no-scrollbar', className)}
    >
      {items.map((item) => {
        const active = item.value === value
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              'relative inline-flex h-10 items-center gap-1.5 text-sm font-medium whitespace-nowrap transition-colors [&_svg]:size-4',
              active ? 'text-fg' : 'text-fg-subtle hover:text-fg-muted',
            )}
          >
            {item.icon}
            {item.label}
            {active ? (
              <motion.span
                layoutId={`ul-${id}`}
                transition={spring.layout}
                className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-fg"
              />
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
