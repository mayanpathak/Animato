import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { CheckCircle2, FlaskConical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { authApi } from '@/lib/api/auth'
import { ApiError, errorMessage, formatWait } from '@/lib/api/http'
import { ease } from '@/lib/motion'
import { useTitle } from '@/lib/useTitle'
import { useSession } from '@/stores/session'
import { AuthBanner, AuthLayout } from './AuthLayout'
import { OtpInput } from './OtpInput'
import { useAfterAuth } from './afterAuth'

const RESEND_COOLDOWN_SECS = 60
// The server locks a code after this many wrong guesses.
const MAX_ATTEMPTS = 5
const MOCKS = import.meta.env.VITE_USE_MOCKS === 'true'

export default function VerifyEmailPage() {
  useTitle('Verify your email')
  const navigate = useNavigate()
  const user = useSession((s) => s.user)
  const verifyEmail = useSession((s) => s.verifyEmail)
  const logout = useSession((s) => s.logout)

  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verified, setVerified] = useState(false)
  const [wrongGuesses, setWrongGuesses] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  // A code was just sent with signup: resend opens after 60 s (plan 6.2).
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECS)
  const [showSpamHint, setShowSpamHint] = useState(false)
  const afterAuth = useAfterAuth()

  useEffect(() => {
    const t = setTimeout(() => setShowSpamHint(true), 30_000)
    return () => clearTimeout(t)
  }, [])
  const [resending, setResending] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  const submit = async (value: string) => {
    if (verifying) return
    setVerifying(true)
    setError(null)
    setNotice(null)
    try {
      const verifiedUser = await verifyEmail(value)
      setVerified(true)
      await afterAuth(verifiedUser)
    } catch (e) {
      setError(errorMessage(e))
      setCode('')
      setWrongGuesses((n) => n + 1)
    } finally {
      setVerifying(false)
    }
  }

  const resend = async () => {
    if (resending || cooldown > 0) return
    setResending(true)
    setError(null)
    setNotice(null)
    try {
      await authApi.resendVerification()
      setCode('')
      setWrongGuesses(0)
      setCooldown(RESEND_COOLDOWN_SECS)
      setNotice('A new code is on its way. The previous one no longer works.')
    } catch (e) {
      setError(errorMessage(e))
      if (e instanceof ApiError && e.retryAfter !== null) setCooldown(Math.ceil(e.retryAfter))
    } finally {
      setResending(false)
    }
  }

  const switchAccount = async () => {
    setLeaving(true)
    try {
      // Local state is cleared only once the server confirmed the logout.
      await logout()
      navigate('/login', { replace: true })
    } catch (e) {
      setError(errorMessage(e))
      setLeaving(false)
    }
  }

  const locked = wrongGuesses >= MAX_ATTEMPTS

  return (
    <AuthLayout
      title="Check your email"
      subtitle={
        <>
          We sent a 6-digit code to{' '}
          <span className="font-medium break-all text-fg">{user?.email ?? 'your email'}</span>.
        </>
      }
      footer={
        <p>
          Wrong address?{' '}
          <button
            type="button"
            onClick={() => void switchAccount()}
            disabled={leaving}
            className="rounded-sm font-medium text-accent underline-offset-4 hover:text-fg hover:underline disabled:opacity-50"
          >
            {leaving ? 'Signing out…' : 'Use a different account'}
          </button>
        </p>
      }
    >
      {MOCKS ? (
        <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 text-xs text-fg-muted">
          <FlaskConical className="size-3.5" /> Demo mode: the code is 123456
        </p>
      ) : null}

      <AuthBanner tone="error" message={error} />
      <AuthBanner tone="success" message={notice} />

      <div className="relative">
        {/* Remounted after a wrong guess so the first box takes focus again. */}
        <OtpInput
          key={wrongGuesses}
          value={code}
          onChange={setCode}
          onComplete={(value) => void submit(value)}
          disabled={verifying || verified}
          invalid={wrongGuesses > 0 && code === '' && error !== null}
        />
        <div className="mt-3 flex h-5 items-center gap-2 text-xs text-fg-subtle" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            {verified ? (
              <motion.span
                key="ok"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="inline-flex items-center gap-1.5 text-status-succeeded"
              >
                <CheckCircle2 className="size-3.5" /> Verified.
              </motion.span>
            ) : verifying ? (
              <motion.span
                key="busy"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="inline-flex items-center gap-1.5"
              >
                <Spinner className="size-3.5" /> Checking code…
              </motion.span>
            ) : (
              <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                Paste the code or type it. It submits on the last digit.
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {locked ? (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.24, ease: ease.outExpo }}
            className="mt-4 overflow-hidden text-sm text-status-warning"
          >
            This code is locked. Send a new one.
          </motion.p>
        ) : null}
      </AnimatePresence>

      <Button
        variant="secondary"
        size="lg"
        className="mt-6 w-full tabular-nums"
        onClick={() => void resend()}
        loading={resending}
        disabled={cooldown > 0 || verified}
      >
        {cooldown > 0 ? `Resend code in ${formatWait(cooldown)}` : 'Resend code'}
      </Button>
      {showSpamHint ? (
        <p className="mt-3 text-center text-sm text-fg-muted" data-testid="spam-hint">
          Nothing yet? Check your spam folder.
        </p>
      ) : null}
    </AuthLayout>
  )
}
