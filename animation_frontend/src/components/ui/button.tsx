import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Spinner } from './spinner'

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'link'
type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const variants: Record<Variant, string> = {
  primary:
    'relative text-white bg-gradient-accent bg-[length:200%_100%] bg-left hover:bg-right shadow-glow [transition:background-position_600ms_var(--ease-out-expo),transform_160ms,box-shadow_240ms] disabled:shadow-none',
  secondary: 'bg-surface-3 text-fg border border-line-strong hover:bg-surface-4 shadow-inner-highlight',
  outline: 'border border-line-strong text-fg hover:bg-surface-2 hover:border-fg-faint',
  ghost: 'text-fg-muted hover:text-fg hover:bg-surface-2',
  danger: 'bg-status-failed/15 text-status-failed border border-status-failed/30 hover:bg-status-failed/25',
  link: 'text-accent hover:text-fg underline-offset-4 hover:underline px-0',
}

const sizes: Record<Size, string> = {
  xs: 'h-7 px-2.5 text-xs gap-1.5 rounded-sm',
  sm: 'h-8 px-3 text-sm gap-1.5 rounded-md',
  md: 'h-9 px-4 text-sm gap-2 rounded-md',
  lg: 'h-11 px-5 text-base gap-2 rounded-lg',
  xl: 'h-13 px-7 text-base gap-2.5 rounded-xl',
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
    'inline-flex shrink-0 select-none items-center justify-center font-medium whitespace-nowrap transition-[background-color,color,border-color,box-shadow,transform] duration-150 ease-out-quart active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 focus-visible:outline-2',
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
      {loading ? <Spinner className="size-4" /> : leftIcon}
      {children}
      {!loading && rightIcon}
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
  md: 'size-8 rounded-md',
  lg: 'size-10 rounded-lg',
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
        'inline-flex shrink-0 items-center justify-center transition-colors duration-150 disabled:opacity-40 [&_svg]:size-4',
        iconSizes[size],
        variant === 'ghost' && 'text-fg-muted hover:bg-surface-3 hover:text-fg',
        variant === 'secondary' && 'bg-surface-3 text-fg hover:bg-surface-4 border border-line',
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
