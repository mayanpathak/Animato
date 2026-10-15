import { useEffect, useState, type SyntheticEvent } from 'react'
import { Link } from 'react-router-dom'
import { AuthLayout, Button, Field, FormError, FormNotice, linkClass } from '../components/ui'
import { emailError, normaliseEmail } from '../lib/validation'
import { useAuthStore } from '../store/authStore'

// Shown after every accepted request, whether or not the email has an
// account, so this page cannot be used to find out which emails are registered.
const SENT = 'If an account exists for that email, you will receive a reset link shortly.'

export default function ForgotPassword() {
  const forgotPassword = useAuthStore((state) => state.forgotPassword)
  const clearError = useAuthStore((state) => state.clearError)
  const isLoading = useAuthStore((state) => state.isLoading)
  const serverError = useAuthStore((state) => state.error)

  const [email, setEmail] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  useEffect(() => clearError, [clearError])

  const handleSubmit = async (event: SyntheticEvent) => {
    event.preventDefault()
    if (isLoading) return

    const cleanEmail = normaliseEmail(email)
    const invalid = emailError(cleanEmail)

    setSent(false)
    setLocalError(invalid)
    if (invalid) return

    setSent(await forgotPassword(cleanEmail))
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your email and we will send you a reset link."
      footer={
        <Link to="/login" className={linkClass}>
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={isLoading}
        />

        <FormError message={localError ?? serverError} />
        <FormNotice message={sent ? SENT : null} />

        <Button type="submit" busy={isLoading} className="w-full">
          Send reset link
        </Button>
      </form>
    </AuthLayout>
  )
}
