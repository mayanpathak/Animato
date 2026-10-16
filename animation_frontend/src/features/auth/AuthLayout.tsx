import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { AlertCircle, CheckCircle2, Eye, EyeOff, Info } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { Field } from '@/components/ui/field'
import { Tooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/cn'
import { ease } from '@/lib/motion'
import { passwordStrength } from '@/lib/validation'
import { useReducedMotion } from '@/lib/useReducedMotion'

const DEMO_VIDEO = '/media/renders/manim-mandelbrot.webm'

function BrandPanel() {
  const reduced = useReducedMotion()
  return (
    <aside
      aria-hidden
      className="relative hidden overflow-hidden border-l border-line bg-surface-1 lg:flex lg:flex-col lg:justify-center"
    >
      {/* Glow and grid */}
      <div className="grid-bg pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
      <div className="pointer-events-none absolute -top-40 -right-32 size-[520px] rounded-full bg-accent-violet/25 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-48 -left-24 size-[460px] rounded-full bg-accent-cyan/15 blur-[120px]" />
      <div className="pointer-events-none absolute top-1/3 left-1/2 size-[280px] rounded-full bg-accent-magenta/10 blur-[100px]" />

      <div className="relative mx-auto w-full max-w-xl px-12 py-16">
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.9, ease: ease.outExpo, delay: 0.1 }}
          className="overflow-hidden rounded-2xl border border-line-strong bg-surface-2 shadow-lg"
        >
          <div className="flex items-center gap-2 border-b border-line bg-surface-1/80 px-4 py-2.5">
            <span className="size-2.5 rounded-full bg-surface-4" />
            <span className="size-2.5 rounded-full bg-surface-4" />
            <span className="size-2.5 rounded-full bg-surface-4" />
            <span className="ml-3 truncate font-mono text-2xs text-fg-subtle">
              mandelbrot_zoom.py · Manim
            </span>
            <span className="ml-auto inline-flex items-center gap-1.5 font-mono text-2xs text-status-succeeded">
              <span className="size-1.5 rounded-full bg-current" /> Rendered
            </span>
          </div>
          <div className="relative aspect-video bg-black">
            <video
              src={DEMO_VIDEO}
              className="size-full object-cover"
              autoPlay={!reduced}
              muted
              loop
              playsInline
              preload="metadata"
              tabIndex={-1}
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-linear-to-t from-black/70 to-transparent" />
            <p className="absolute bottom-3 left-4 max-w-[85%] text-xs text-white/85">
              “Zoom into the Mandelbrot set along the seahorse valley, colouring by escape time.”
            </p>
          </div>
        </motion.div>

        <motion.figure
          initial={reduced ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: ease.outExpo, delay: 0.3 }}
          className="mt-10"
        >
          <blockquote className="font-display text-2xl leading-snug font-medium tracking-tight text-fg">
            Describe it in a sentence. Animato writes the scene, renders it, and hands you a timeline you can{' '}
            <span className="text-gradient">actually edit</span>.
          </blockquote>
          <figcaption className="mt-4 flex items-center gap-3 text-sm text-fg-subtle">
            <span className="h-px w-8 bg-line-strong" />
            Manim for math and motion graphics, Remotion for everything else.
          </figcaption>
        </motion.figure>
      </div>
    </aside>
  )
}

export function AuthLayout({
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
  const reduced = useReducedMotion()
  return (
    <div className="grid min-h-dvh bg-canvas lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="relative flex min-w-0 flex-col px-4 py-6 sm:px-10">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-accent-soft opacity-30 blur-3xl lg:hidden" />
        <header className="relative flex items-center justify-between">
          <Link to="/" aria-label="Animato home" className="rounded-md">
            <Logo />
          </Link>
        </header>
        <main className="relative flex flex-1 items-center justify-center py-10">
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: ease.outExpo }}
            className="w-full max-w-sm"
          >
            <h1 className="font-display text-3xl font-semibold tracking-tighter text-fg">{title}</h1>
            {subtitle ? <p className="mt-2 text-sm text-fg-muted">{subtitle}</p> : null}
            <div className="mt-8">{children}</div>
            {footer ? <div className="mt-8 text-sm text-fg-subtle">{footer}</div> : null}
          </motion.div>
        </main>
        <p className="relative text-2xs text-fg-faint">
          Your projects and edits stay in this browser. Only prompts are sent to the render server.
        </p>
      </div>
      <BrandPanel />
    </div>
  )
}

/** Animated server error / success notice. */
export function AuthBanner({
  tone,
  message,
  children,
}: {
  tone: 'error' | 'success' | 'info'
  message: string | null
  children?: ReactNode
}) {
  const Icon = tone === 'error' ? AlertCircle : tone === 'success' ? CheckCircle2 : Info
  return (
    <AnimatePresence initial={false}>
      {message ? (
        <motion.div
          key={`${tone}:${message}`}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.24, ease: ease.outExpo }}
          className="overflow-hidden"
        >
          <motion.div
            role={tone === 'error' ? 'alert' : 'status'}
            data-testid={tone === 'error' ? 'auth-error' : undefined}
            initial={tone === 'error' ? { x: 0 } : false}
            animate={tone === 'error' ? { x: [0, -6, 5, -3, 2, 0] } : undefined}
            transition={{ duration: 0.4 }}
            className={cn(
              'mb-4 flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm',
              tone === 'error' && 'border-status-failed/30 bg-status-failed/10 text-fg',
              tone === 'success' && 'border-status-succeeded/30 bg-status-succeeded/10 text-fg',
              tone === 'info' && 'border-accent/25 bg-accent-soft text-fg',
            )}
          >
            <Icon
              className={cn(
                'mt-0.5 size-4 shrink-0',
                tone === 'error' && 'text-status-failed',
                tone === 'success' && 'text-status-succeeded',
                tone === 'info' && 'text-accent',
              )}
            />
            <div className="min-w-0">
              <p>{message}</p>
              {children}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="currentColor"
        d="M21.6 12.23c0-.68-.06-1.36-.18-2.02H12v3.83h5.4a4.6 4.6 0 0 1-2 3.02v2.5h3.24c1.9-1.75 2.96-4.33 2.96-7.33Z"
        opacity=".9"
      />
      <path
        fill="currentColor"
        d="M12 22c2.7 0 4.97-.9 6.63-2.42l-3.24-2.5c-.9.6-2.04.96-3.39.96-2.6 0-4.81-1.76-5.6-4.12H3.06v2.58A10 10 0 0 0 12 22Z"
        opacity=".7"
      />
      <path
        fill="currentColor"
        d="M6.4 13.92a6 6 0 0 1 0-3.84V7.5H3.06a10 10 0 0 0 0 9l3.34-2.58Z"
        opacity=".5"
      />
      <path
        fill="currentColor"
        d="M12 5.96c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.94 5.5l3.34 2.58C7.19 7.72 9.4 5.96 12 5.96Z"
        opacity=".8"
      />
    </svg>
  )
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="currentColor"
        d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.3 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.75c0 .27.18.58.69.48A10 10 0 0 0 12 2Z"
      />
    </svg>
  )
}

/** OAuth is not offered by the API yet: the buttons say so instead of pretending. */
export function OAuthButtons() {
  const providers = [
    { name: 'Google', icon: <GoogleIcon /> },
    { name: 'GitHub', icon: <GitHubIcon /> },
  ]
  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        {providers.map((p) => (
          <Tooltip key={p.name} content="Coming soon" className="whitespace-nowrap">
            <button
              type="button"
              aria-disabled="true"
              aria-label={`Continue with ${p.name} (coming soon)`}
              onClick={(e) => e.preventDefault()}
              className="inline-flex h-10 w-full cursor-not-allowed items-center justify-center gap-2 rounded-md border border-line bg-surface-1 px-3 text-sm text-fg-subtle opacity-70"
            >
              {p.icon}
              <span className="truncate">{p.name}</span>
            </button>
          </Tooltip>
        ))}
      </div>
      <div className="my-6 flex items-center gap-3 text-2xs tracking-widest text-fg-faint uppercase">
        <span className="h-px flex-1 bg-line" />
        or with email
        <span className="h-px flex-1 bg-line" />
      </div>
    </div>
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

const STRENGTH_TONES = [
  'bg-status-failed',
  'bg-status-failed',
  'bg-status-warning',
  'bg-status-succeeded',
  'bg-status-succeeded',
]

export function StrengthMeter({ password }: { password: string }) {
  const { score, label } = passwordStrength(password)
  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-surface-3">
            <motion.div
              className={cn('h-full origin-left rounded-full', STRENGTH_TONES[score])}
              initial={false}
              animate={{ scaleX: password && score >= i ? 1 : 0 }}
              transition={{ duration: 0.3, ease: ease.outExpo }}
            />
          </div>
        ))}
      </div>
      <p className="mt-1.5 flex justify-between text-2xs text-fg-subtle">
        <span>{password ? `Strength: ${label}` : '8 to 72 characters'}</span>
        <span className="text-fg-faint">Mix case, digits and a symbol</span>
      </p>
    </div>
  )
}

export const linkClass =
  'font-medium text-accent underline-offset-4 transition-colors hover:text-fg hover:underline rounded-sm'
