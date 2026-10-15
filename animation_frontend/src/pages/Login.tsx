import { useEffect, useState, type SyntheticEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AuthLayout, Button, Field, FormError, FormNotice, linkClass } from '../components/ui'
import { emailError, normaliseEmail } from '../lib/validation'
import { useAuthStore } from '../store/authStore'

interface LoginLocationState {
  email?: string
  notice?: string
}

export default function Login() {
  const location = useLocation()
  const fromState = (location.state ?? {}) as LoginLocationState

  const login = useAuthStore((state) => state.login)
  const clearError = useAuthStore((state) => state.clearError)
  const isLoading = useAuthStore((state) => state.isLoading)
  const serverError = useAuthStore((state) => state.error)

  const [email, setEmail] = useState(typeof fromState.email === 'string' ? fromState.email : '')
  const [password, setPassword] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => clearError, [clearError])

  const handleSubmit = async (event: SyntheticEvent) => {
    event.preventDefault()
    if (isLoading) return

    const cleanEmail = normaliseEmail(email)
    // Same as the server: any non-empty password, so older short ones still work.
    const invalid = emailError(cleanEmail) ?? (password === '' ? 'Password is required' : null)

    setLocalError(invalid)
    if (invalid) return

    // On success the route guard moves on to /app or /verify-email.
    const ok = await login(cleanEmail, password)

    if (!ok) {
      setPassword('')
      setFailed(true)
    }
  }

  return (
    <AuthLayout
      title="Sign in"
      footer={
        <>
          No account yet?{' '}
          <Link to="/signup" state={{ email }} className={linkClass}>
            Sign up
          </Link>
        </>
      }
    >
      <FormNotice message={typeof fromState.notice === 'string' ? fromState.notice : null} />

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

        <Field
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={isLoading}
        />

        <FormError message={localError ?? serverError} />

        {/* The server answers the same way for an unknown email and a wrong
            password, so this cannot be an automatic redirect. */}
        {failed && !localError && serverError && (
          <p className="text-sm text-zinc-600">
            New here?{' '}
            <Link to="/signup" state={{ email }} className={linkClass}>
              Create an account
            </Link>
          </p>
        )}

        <Button type="submit" busy={isLoading} className="w-full">
          Sign in
        </Button>
      </form>

      <p className="text-sm">
        <Link to="/forgot-password" className={linkClass}>
          Forgot password?
        </Link>
      </p>
    </AuthLayout>
  )
}
