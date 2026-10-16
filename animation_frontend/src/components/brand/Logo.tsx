import { cn } from '@/lib/cn'

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-7', className)} aria-hidden>
      <defs>
        <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--color-accent-violet)" />
          <stop offset="0.55" stopColor="var(--color-accent-cyan)" />
          <stop offset="1" stopColor="var(--color-accent-magenta)" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#logo-g)" />
      <path
        d="M9 22.5 15.2 9.5h1.6L23 22.5h-3.1l-1.3-2.9h-5.2l-1.3 2.9H9Zm5.4-5.5h3.2L16 13.2 14.4 17Z"
        fill="white"
      />
    </svg>
  )
}

export function Logo({ className, collapsed }: { className?: string; collapsed?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark />
      {collapsed ? null : (
        <span className="font-display text-[17px] font-semibold tracking-tight">Animato</span>
      )}
    </span>
  )
}
