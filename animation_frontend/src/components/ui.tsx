import { useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 ${className}`}
    />
  )
}

export function FullPageSpinner() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <Spinner className="h-8 w-8" />
    </div>
  )
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary'
  busy?: boolean
}

export const buttonClass = {
  primary:
    'inline-flex items-center justify-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50',
  secondary:
    'inline-flex items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50',
}

export function Button({
  variant = 'primary',
  busy = false,
  disabled,
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      {...props}
      disabled={disabled || busy}
      className={`${buttonClass[variant]} ${className}`}
    >
      {busy && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  )
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  hint?: string
}

export function Field({ label, hint, ...props }: FieldProps) {
  const id = useId()

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-zinc-800">
        {label}
      </label>
      <input
        id={id}
        {...props}
        className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900 disabled:bg-zinc-100"
      />
      {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
    </div>
  )
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null

  return (
    <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {message}
    </p>
  )
}

export function FormNotice({ message }: { message: string | null }) {
  if (!message) return null

  return (
    <p role="status" className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
      {message}
    </p>
  )
}

export const linkClass = 'font-medium text-zinc-900 underline underline-offset-2'

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <Link to="/" className="mb-6 text-xl font-semibold tracking-tight">
        myanimate
      </Link>

      <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6">
        <h1 className="text-lg font-semibold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-zinc-600">{subtitle}</p>}

        <div className="mt-5 space-y-4">{children}</div>
      </div>

      {footer && <div className="mt-4 text-sm text-zinc-600">{footer}</div>}
    </div>
  )
}
