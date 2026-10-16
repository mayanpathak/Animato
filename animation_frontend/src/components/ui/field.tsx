import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { cn } from '@/lib/cn'

// Plan 7.4: surface-2, hairline, 10 px radius, 2 px accent focus ring offset 2 px.
const control =
  'w-full rounded-control border border-line bg-surface-2 px-3 text-sm text-fg placeholder:text-fg-faint transition-[border-color,box-shadow] duration-[var(--duration-fast)] hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ring disabled:opacity-50 aria-[invalid=true]:border-status-failed/60'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cn(control, 'h-11 sm:h-10', className)} {...rest} />
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(control, 'min-h-24 resize-y py-2.5 leading-relaxed', className)}
        {...rest}
      />
    )
  },
)

export function Label({
  htmlFor,
  children,
  className,
}: {
  htmlFor?: string
  children: ReactNode
  className?: string
}) {
  return (
    <label htmlFor={htmlFor} className={cn('mb-1.5 block text-xs font-medium text-fg-muted', className)}>
      {children}
    </label>
  )
}

export function FieldError({ id, message }: { id?: string; message?: string | null }) {
  return (
    <AnimatePresence initial={false}>
      {message ? (
        <motion.p
          id={id}
          role="alert"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="mt-1.5 text-xs text-status-failed"
        >
          {message}
        </motion.p>
      ) : null}
    </AnimatePresence>
  )
}

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string | null
  hint?: ReactNode
  trailing?: ReactNode
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, error, hint, trailing, id, className, ...rest },
  ref,
) {
  const auto = useId()
  const inputId = id ?? auto
  const errorId = `${inputId}-error`
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between">
        <Label htmlFor={inputId}>{label}</Label>
        {hint}
      </div>
      <div className="relative">
        <Input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={trailing ? 'pr-10' : undefined}
          {...rest}
        />
        {trailing ? <div className="absolute inset-y-0 right-1 flex items-center">{trailing}</div> : null}
      </div>
      <FieldError id={errorId} message={error} />
    </div>
  )
})

export function Select({
  className,
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <div className={cn('relative', className)}>
      <select className={cn(control, 'h-9 appearance-none pr-8 [&>option]:bg-surface-2')} {...rest}>
        {children}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 16 16"
        className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-fg-subtle"
      >
        <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      </svg>
    </div>
  )
}
