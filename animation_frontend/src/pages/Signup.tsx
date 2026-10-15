import { useEffect, useState, type SyntheticEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AuthLayout, Button, Field, FormError, linkClass } from '../components/ui'
import { emailError, normaliseEmail, passwordError, usernameError } from '../lib/validation'
import { useAuthStore } from '../store/authStore'

export default function Signup() {
  const location = useLocation()
  const fromState = (location.state ?? {}) as { email?: string }

  const signup = useAuthStore((state) => state.signup)
  const clearError = useAuthStore((state) => state.clearError)
  const isLoading = useAuthStore((state) => state.isLoading)
  const serverError = useAuthStore((state) => state.error)

  const [username, setUsername] = useState('')
  const [email, setEmail] = useState(typeof fromState.email === 'string' ? fromState.email : '')
  const [password, setPassword] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => clearError, [clearError])

  const handleSubmit = async (event: SyntheticEvent) => {
    event.preventDefault()
    if (isLoading) return

    const cleanUsername = username.trim()
    const cleanEmail = normaliseEmail(email)
    const invalid =
      usernameError(cleanUsername) ?? emailError(cleanEmail) ?? passwordError(password)

    setLocalError(invalid)
    if (invalid) return

    // On success the server has set the session cookie and returned an
    // unverified user; the route guard moves on to /verify-email.
    const ok = await signup(cleanUsername, cleanEmail, password)

    if (!ok) setPassword('')
  }

  const error = localError ?? serverError

  return (
    <AuthLayout
      title="Create your account"
      subtitle="We will email you a 6-digit code to confirm your address."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" state={{ email }} className={linkClass}>
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field
          label="Username"
          autoComplete="username"
          autoFocus
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          disabled={isLoading}
          hint="3 to 30 characters"
        />

        <Field
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={isLoading}
        />

        <Field
          label="Password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={isLoading}
          hint="8 to 72 characters"
        />

        <FormError message={error} />

        {error === 'User already exists' && (
          <p className="text-sm text-zinc-600">
            <Link to="/login" state={{ email }} className={linkClass}>
              Sign in instead
            </Link>
          </p>
        )}

        <Button type="submit" busy={isLoading} className="w-full">
          Sign up
        </Button>
      </form>
    </AuthLayout>
  )
}
