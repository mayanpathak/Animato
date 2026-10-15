import { useEffect, useState } from 'react'
import { OtpInput } from '../components/OtpInput'
import { AuthLayout, Button, FormError, FormNotice } from '../components/ui'
import { formatWait } from '../lib/api'
import { useAuthStore } from '../store/authStore'

const RESEND_COOLDOWN_SECS = 60
// The server locks a code after this many wrong guesses.
const MAX_ATTEMPTS = 5

export default function VerifyEmail() {
  const user = useAuthStore((state) => state.user)
  const verifyEmail = useAuthStore((state) => state.verifyEmail)
  const resendVerification = useAuthStore((state) => state.resendVerification)
  const logout = useAuthStore((state) => state.logout)
  const clearError = useAuthStore((state) => state.clearError)
  const isLoading = useAuthStore((state) => state.isLoading)
  const serverError = useAuthStore((state) => state.error)

  const [code, setCode] = useState('')
  const [wrongGuesses, setWrongGuesses] = useState(0)
  const [cooldown, setCooldown] = useState(0)
  const [isResending, setIsResending] = useState(false)
  const [resendError, setResendError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => clearError, [clearError])

  useEffect(() => {
    if (cooldown <= 0) return

    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  const submit = async (value: string) => {
    if (isLoading) return

    setNotice(null)
    setResendError(null)

    // On success the user object comes back verified and the route guard
    // moves on to /app. The session from signup or login is already in place.
    const ok = await verifyEmail(value)

    if (!ok) {
      setCode('')
      setWrongGuesses((count) => count + 1)
    }
  }

  const resend = async () => {
    if (isResending || cooldown > 0) return

    setIsResending(true)
    setNotice(null)
    setResendError(null)
    clearError()

    const res = await resendVerification()

    setIsResending(false)

    if (res.ok) {
      setCode('')
      setWrongGuesses(0)
      setCooldown(RESEND_COOLDOWN_SECS)
      setNotice('A new code is on its way. The old one no longer works.')
    } else {
      setResendError(res.message)
      if (res.retryAfter !== null) setCooldown(Math.ceil(res.retryAfter))
    }
  }

  const locked = wrongGuesses >= MAX_ATTEMPTS

  return (
    <AuthLayout
      title="Verify your email"
      subtitle={`Enter the 6-digit code we sent to ${user?.email ?? 'your email'}.`}
      footer={
        <button
          type="button"
          onClick={() => void logout()}
          disabled={isLoading}
          className="underline underline-offset-2"
        >
          Use a different account
        </button>
      }
    >
      {/* Remounted after a wrong guess so the first box takes focus again. */}
      <OtpInput
        key={wrongGuesses}
        value={code}
        onChange={setCode}
        onComplete={(value) => void submit(value)}
        disabled={isLoading}
      />

      <FormError message={serverError ?? resendError} />
      <FormNotice message={notice} />

      {locked && (
        <p className="text-sm text-zinc-600">
          After {MAX_ATTEMPTS} wrong tries a code stops working. Request a new one below.
        </p>
      )}

      <Button
        variant="secondary"
        className="w-full"
        onClick={() => void resend()}
        busy={isResending}
        disabled={cooldown > 0}
      >
        {cooldown > 0 ? `Resend code in ${formatWait(cooldown)}` : 'Resend code'}
      </Button>

      <p className="text-xs text-zinc-500">
        Codes expire after 15 minutes. Check your spam folder if nothing arrives.
      </p>
    </AuthLayout>
  )
}
