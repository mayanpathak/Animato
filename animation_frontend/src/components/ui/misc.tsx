import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { cn } from '@/lib/cn'
import { initials } from '@/lib/format'
import { STATUS_LABELS, STATUS_TONE, type JobStatus, type StatusTone } from '@/lib/api/types'

type BadgeTone = 'neutral' | 'accent' | StatusTone

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-surface-3 text-fg-muted border-line',
  accent: 'bg-accent-soft text-accent border-accent/25',
  queued: 'bg-status-queued/10 text-status-queued border-status-queued/20',
  planning: 'bg-status-planning/10 text-status-planning border-status-planning/25',
  rendering: 'bg-status-rendering/10 text-status-rendering border-status-rendering/25',
  succeeded: 'bg-status-succeeded/10 text-status-succeeded border-status-succeeded/25',
  failed: 'bg-status-failed/10 text-status-failed border-status-failed/25',
}

export function Badge({ tone = 'neutral', className, children }: { tone?: BadgeTone; className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center gap-1 rounded-full border px-2 text-2xs font-medium whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function StatusChip({ status, className }: { status: JobStatus; className?: string }) {
  const tone = STATUS_TONE[status]
  const live = tone === 'planning' || tone === 'rendering' || tone === 'queued'
  return (
    <Badge tone={tone} className={className}>
      <span className="relative flex size-1.5">
        {live ? <span className="absolute inset-0 animate-ping rounded-full bg-current opacity-60" /> : null}
        <span className="relative size-1.5 rounded-full bg-current" />
      </span>
      <span data-testid="status-chip">{STATUS_LABELS[status]}</span>
    </Badge>
  )
}

export function Tag({ children, onRemove }: { children: ReactNode; onRemove?: () => void }) {
  return (
    <span className="inline-flex h-6 items-center gap-1 rounded-md border border-line bg-surface-2 px-2 text-xs text-fg-muted">
      {children}
      {onRemove ? (
        <button type="button" aria-label="Remove tag" onClick={onRemove} className="-mr-1 rounded px-1 text-fg-faint hover:text-fg">
          ×
        </button>
      ) : null}
    </span>
  )
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded border border-line-strong bg-surface-2 px-1 font-mono text-2xs text-fg-subtle',
        className,
      )}
    >
      {children}
    </kbd>
  )
}

export function Avatar({ name, size = 28, className }: { name: string; size?: number; className?: string }) {
  return (
    <span
      className={cn('inline-grid shrink-0 place-items-center rounded-full bg-gradient-accent font-semibold text-white', className)}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden
    >
      {initials(name)}
    </span>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-md', className)} aria-hidden />
}

export function Progress({
  value,
  className,
  label,
  indeterminate,
}: {
  value: number
  className?: string
  label?: string
  indeterminate?: boolean
}) {
  const pct = Math.max(0, Math.min(100, value * 100))
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : Math.round(pct)}
      className={cn('relative h-1.5 w-full overflow-hidden rounded-full bg-surface-3', className)}
    >
      {indeterminate ? (
        <div className="absolute inset-y-0 w-1/3 animate-[marquee_1.4s_linear_infinite] rounded-full bg-gradient-accent" />
      ) : (
        <motion.div
          className="h-full origin-left rounded-full bg-gradient-accent"
          initial={false}
          animate={{ scaleX: pct / 100 }}
          transition={{ type: 'spring', stiffness: 200, damping: 30 }}
        />
      )}
    </div>
  )
}

export function Ring({ value, size = 96, stroke = 8, children }: { value: number; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(1, value))
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <defs>
          <linearGradient id="ring-g" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent-violet)" />
            <stop offset="55%" stopColor="var(--color-accent-cyan)" />
            <stop offset="100%" stopColor="var(--color-accent-magenta)" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--color-surface-3)" strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#ring-g)"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - v) }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  )
}

export function Switch({
  checked,
  onChange,
  label,
  disabled,
  id,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  disabled?: boolean
  id?: string
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors duration-200 disabled:opacity-50',
        checked ? 'border-transparent bg-gradient-accent' : 'border-line-strong bg-surface-3',
      )}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 600, damping: 35 }}
        className={cn('size-3.5 rounded-full bg-white shadow-sm', checked ? 'ml-[18px]' : 'ml-[2px]')}
      />
    </button>
  )
}

export function Slider({
  value,
  min,
  max,
  step = 0.01,
  onChange,
  label,
  format,
  id,
  onCommit,
}: {
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  onCommit?: (v: number) => void
  label: string
  format?: (v: number) => string
  id?: string
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className="flex items-center gap-3">
      <input
        id={id}
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={(e) => onCommit?.(Number((e.target as HTMLInputElement).value))}
        onKeyUp={(e) => onCommit?.(Number((e.target as HTMLInputElement).value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-3 accent-accent [&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md"
        style={{
          backgroundImage: `linear-gradient(to right, var(--color-accent-violet), var(--color-accent-cyan) ${pct}%, transparent ${pct}%)`,
        }}
      />
      {format ? <span className="w-12 shrink-0 text-right font-mono text-2xs text-fg-subtle tabular-nums">{format(value)}</span> : null}
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon?: ReactNode
  title: string
  body?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong bg-surface-1/50 px-6 py-14 text-center',
        className,
      )}
    >
      {icon ? (
        <div className="mb-4 grid size-12 place-items-center rounded-xl border border-line bg-surface-2 text-accent [&_svg]:size-5">
          {icon}
        </div>
      ) : null}
      <h3 className="font-display text-lg font-semibold tracking-tight">{title}</h3>
      {body ? <p className="mt-1.5 max-w-sm text-sm text-fg-muted">{body}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}

export function ErrorState({ title = 'Something went wrong', body, action }: { title?: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div role="alert" className="flex flex-col items-center rounded-2xl border border-status-failed/25 bg-status-failed/5 px-6 py-12 text-center">
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      {body ? <p className="mt-1.5 max-w-md text-sm text-fg-muted">{body}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('surface-card rounded-xl', className)}>{children}</div>
}
