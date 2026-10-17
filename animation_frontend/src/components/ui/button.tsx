import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Spinner } from './spinner'

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'link'
type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const variants: Record<Variant, string> = {
  primary:
    'bg-accent-fill text-white shadow-sm shadow-inner-highlight hover:bg-accent-hover active:bg-accent-pressed disabled:bg-surface-4 disabled:text-fg-subtle disabled:shadow-none',
  secondary: 'bg-surface-2 text-fg border border-line hover:bg-surface-3 hover:border-line-strong',
  outline: 'border border-line-strong text-fg hover:bg-surface-2',
  ghost: 'text-fg-muted hover:text-fg hover:bg-surface-2',
  danger:
    'bg-surface-2 text-status-failed border border-line hover:bg-status-failed/10 hover:border-status-failed/30',
  link: 'text-accent hover:text-fg underline-offset-4 hover:underline px-0',
}

// Heights 32 / 36 / 44 (plan 7.4); xs and xl for dense tools and marketing CTAs.
const sizes: Record<Size, string> = {
  xs: 'h-7 px-2.5 text-xs gap-1.5 rounded-md',
  sm: 'h-8 px-3 text-sm gap-1.5 rounded-control',
  md: 'h-9 px-4 text-sm gap-2 rounded-control',
  lg: 'h-11 px-5 text-base gap-2 rounded-control',
  xl: 'h-13 px-7 text-base gap-2.5 rounded-full',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
}

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', className?: string): string {
  return cn(
    'inline-flex shrink-0 select-none items-center justify-center font-medium whitespace-nowrap transition-[background-color,color,border-color,box-shadow,transform] duration-[var(--duration-fast)] ease-out-quart active:scale-[0.98] active:duration-[var(--duration-instant)] disabled:cursor-not-allowed disabled:active:scale-100 [&_svg]:size-4 [&_svg]:shrink-0',
    variants[variant],
    sizes[size],
    className,
  )
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading,
    leftIcon,
    rightIcon,
    className,
    children,
    disabled,
    type,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={buttonClass(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {/* Loading keeps the label and the width: the spinner takes the icon's place. */}
      {loading ? <Spinner className="size-4" /> : leftIcon}
      {children}
      {rightIcon ? <span className={loading ? 'invisible' : undefined}>{rightIcon}</span> : null}
    </button>
  )
})

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  variant?: 'ghost' | 'secondary' | 'outline'
  active?: boolean
}

const iconSizes = {
  xs: 'size-6 rounded-sm',
  sm: 'size-7 rounded-md',
  md: 'size-8 rounded-control',
  lg: 'size-10 rounded-control',
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, size = 'md', variant = 'ghost', active, className, children, type, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center transition-[background-color,color,transform] duration-[var(--duration-fast)] active:scale-[0.96] disabled:opacity-40 [&_svg]:size-4',
        iconSizes[size],
        variant === 'ghost' && 'text-fg-muted hover:bg-surface-3 hover:text-fg',
        variant === 'secondary' && 'bg-surface-2 text-fg hover:bg-surface-3 border border-line',
        variant === 'outline' && 'border border-line-strong text-fg-muted hover:text-fg hover:bg-surface-2',
        active && 'bg-accent-soft text-accent hover:bg-accent-soft hover:text-accent',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
})
