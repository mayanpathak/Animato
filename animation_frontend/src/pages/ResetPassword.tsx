import { useEffect, useState, type SyntheticEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AuthLayout, Button, Field, FormError, linkClass } from '../components/ui'
import { isResetToken, passwordError } from '../lib/validation'
import { useAuthStore } from '../store/authStore'

export default function ResetPassword() {
  const { token } = useParams()
  const navigate = useNavigate()

  const resetPassword = useAuthStore((state) => state.resetPassword)
  const clearError = useAuthStore((state) => state.clearError)
  const isLoading = useAuthStore((state) => state.isLoading)
  const serverError = useAuthStore((state) => state.error)

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => clearError, [clearError])

  const backToLogin = (
    <Link to="/login" className={linkClass}>
      Back to sign in
    </Link>
  )

  // A token of the wrong shape cannot be valid, so nothing is sent.
  if (!isResetToken(token)) {
    return (
      <AuthLayout title="Invalid link" footer={backToLogin}>
        <p className="text-sm text-zinc-600">
          This reset link is not valid. Request a new one from the{' '}
          <Link to="/forgot-password" className={linkClass}>
            forgot password
          </Link>{' '}
          page.
        </p>
      </AuthLayout>
    )
  }

  const handleSubmit = async (event: SyntheticEvent) => {
    event.preventDefault()
    if (isLoading) return

    const invalid =
      passwordError(password) ?? (password !== confirm ? 'The two passwords do not match' : null)

    setLocalError(invalid)
    if (invalid) return

    const ok = await resetPassword(token, password)

    setPassword('')
    setConfirm('')

    // Replace, so the URL holding the token is dropped from history.
    if (ok) {
      navigate('/login', {
        replace: true,
        state: { notice: 'Password reset successful. Sign in with your new password.' },
      })
    }
  }

  return (
    <AuthLayout title="Choose a new password" footer={backToLogin}>
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field
          label="New password"
          type="password"
          autoComplete="new-password"
          autoFocus
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={isLoading}
          hint="8 to 72 characters"
        />

        <Field
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          disabled={isLoading}
        />

        <FormError message={localError ?? serverError} />

        <Button type="submit" busy={isLoading} className="w-full">
          Reset password
        </Button>
      </form>
    </AuthLayout>
  )
}
