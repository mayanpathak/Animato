// Plan 6.2: one centred card (max 400 px) on the quiet canvas, wordmark above,
// legal line below. The same forms render inside the landing page's sheet.
import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Check, Eye, EyeOff } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { Field } from '@/components/ui/field'
import { cn } from '@/lib/cn'
import { duration, ease } from '@/lib/motion'
import { charCount } from '@/lib/validation'

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: ReactNode
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="w-full">
      <h1 className="font-display text-2xl font-semibold tracking-tighter text-fg sm:text-[28px]">{title}</h1>
      {subtitle ? <p className="mt-2 text-fg-muted">{subtitle}</p> : null}
      <div className="mt-7">{children}</div>
      {footer ? <div className="mt-7 text-sm text-fg-subtle">{footer}</div> : null}
    </div>
  )
}

export const LEGAL_LINE =
  'Your videos and edits stay in this browser. Prompts and your account go to Animato’s server.'

export function AuthLayout(props: Parameters<typeof AuthCard>[0]) {
  return (
    <div className="flex min-h-dvh flex-col items-center bg-canvas px-4 py-8 sm:py-12">
      <Link to="/" aria-label="Animato home" className="rounded-md">
        <Logo />
      </Link>
      <main className="flex w-full flex-1 items-center justify-center py-10">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: duration.slow, ease: ease.outExpo }}
          className="w-full max-w-[400px] rounded-2xl border border-line bg-surface-1 p-6 shadow-lg shadow-inner-highlight sm:p-8"
        >
          <AuthCard {...props} />
        </motion.div>
      </main>
      <p className="max-w-[400px] text-center text-xs text-fg-subtle">{LEGAL_LINE}</p>
    </div>
  )
}

/** Server error / success notice above a form. */
export function AuthBanner({
  tone,
  message,
  children,
}: {
  tone: 'error' | 'success' | 'info'
  message: string | null
  children?: ReactNode
}) {
  return (
    <AnimatePresence initial={false}>
      {message ? (
        <motion.div
          key={`${tone}:${message}`}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: duration.base, ease: ease.outExpo }}
          className="overflow-hidden"
        >
          <div
            role={tone === 'error' ? 'alert' : 'status'}
            data-testid={tone === 'error' ? 'auth-error' : undefined}
            className={cn(
              'mb-5 rounded-control border px-3.5 py-3 text-sm',
              tone === 'error' ? 'border-status-failed/30 text-fg' : 'border-line text-fg',
            )}
          >
            <p>{message}</p>
            {children}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

type PasswordFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  error?: string | null
  hint?: ReactNode
}

/** Password input with a show/hide toggle; forwards its ref for react-hook-form. */
export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  function PasswordField(props, ref) {
    const [visible, setVisible] = useState(false)
    return (
      <Field
        ref={ref}
        {...props}
        type={visible ? 'text' : 'password'}
        trailing={
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Hide password' : 'Show password'}
            aria-pressed={visible}
            className="grid size-8 place-items-center rounded-md text-fg-subtle transition-colors hover:text-fg"
          >
            {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        }
      />
    )
  },
)

/** The server's password rule as a quiet line that ticks when met (plan 6.2). */
export function PasswordRules({ password }: { password: string }) {
  const n = charCount(password)
  const ok = n >= 8 && n <= 72
  return (
    <p
      className={cn(
        'mt-2 flex items-center gap-1.5 text-xs transition-colors duration-[var(--duration-fast)]',
        ok ? 'text-status-succeeded' : n > 72 ? 'text-status-failed' : 'text-fg-subtle',
      )}
      data-testid="password-rule"
    >
      <Check className={cn('size-3.5', ok ? 'opacity-100' : 'opacity-40')} aria-hidden />
      {n > 72 ? 'At most 72 characters' : '8 to 72 characters'}
    </p>
  )
}

export const linkClass = 'font-medium text-fg underline underline-offset-4 hover:text-accent rounded-sm'
