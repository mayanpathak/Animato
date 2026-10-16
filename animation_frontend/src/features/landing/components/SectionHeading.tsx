import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function SectionHeading({
  id,
  eyebrow,
  title,
  body,
  align = 'center',
  className,
}: {
  id?: string
  eyebrow: string
  title: ReactNode
  body?: ReactNode
  align?: 'center' | 'left'
  className?: string
}) {
  return (
    <div
      data-reveal
      className={cn('max-w-2xl', align === 'center' ? 'mx-auto text-center' : 'text-left', className)}
    >
      <p className="font-mono text-2xs font-medium tracking-widest text-accent uppercase">{eyebrow}</p>
      <h2
        id={id}
        className="mt-3 font-display text-3xl font-semibold tracking-tighter text-balance text-fg sm:text-4xl"
      >
        {title}
      </h2>
      {body ? <p className="mt-4 text-base text-pretty text-fg-muted sm:text-lg">{body}</p> : null}
    </div>
  )
}

/** Horizontal page gutter shared by every section. */
export const container = 'mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8'
