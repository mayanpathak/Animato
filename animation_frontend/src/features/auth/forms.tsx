// Sign up and log in forms, shared by the pages and the landing page's sheet.
// Client rules mirror api_server/src/schema/types.rs exactly.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod/mini'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { ApiError, errorMessage } from '@/lib/api/http'
import { emailError, normaliseEmail, passwordError, usernameError } from '@/lib/validation'
import { useSession } from '@/stores/session'
import { AuthBanner, linkClass, PasswordField, PasswordRules } from './AuthLayout'
import { useAfterAuth } from './afterAuth'

const signupSchema = z.object({
  username: z
    .string()
    .check(z.refine((v) => usernameError(v.trim()) === null, 'Username must be between 3 and 30 characters')),
  email: z
    .string()
    .check(z.refine((v) => emailError(normaliseEmail(v)) === null, 'Please enter a valid email address')),
  password: z
    .string()
    .check(z.refine((v) => passwordError(v) === null, 'Password must be between 8 and 72 characters')),
})
type SignupValues = z.infer<typeof signupSchema>

/** Where "Log in" / "Sign up" go: a page link, or a switch inside the sheet. */
export type AuthSwitch = { href: (email: string) => string } | { onSwitch: (email: string) => void }

function SwitchLink({ to, email, children }: { to: AuthSwitch; email: string; children: string }) {
  if ('onSwitch' in to)
    return (
      <button type="button" className={linkClass} onClick={() => to.onSwitch(email)}>
        {children}
      </button>
    )
  return (
    <Link to={to.href(email)} className={linkClass}>
      {children}
    </Link>
  )
}

export function SignupForm({ initialEmail = '', login }: { initialEmail?: string; login: AuthSwitch }) {
  const signup = useSession((s) => s.signup)
  const afterAuth = useAfterAuth()
  const [serverError, setServerError] = useState<{ message: string; exists: boolean } | null>(null)
  const {
    register,
    handleSubmit,
    setValue,
    setFocus,
    control,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    // Validate as they type, with the server's own rules (plan 5.1 step 3).
    mode: 'onChange',
    defaultValues: { username: '', email: initialEmail, password: '' },
  })
  const password = useWatch({ control, name: 'password' })
  const email = useWatch({ control, name: 'email' })

  const onSubmit = async (values: SignupValues) => {
    setServerError(null)
    try {
      const user = await signup(values.username.trim(), normaliseEmail(values.email), values.password)
      await afterAuth(user)
    } catch (e) {
      const exists = e instanceof ApiError && e.status === 409
      setServerError({ message: exists ? 'That email already has an account.' : errorMessage(e), exists })
      setValue('password', '')
      setFocus(exists ? 'email' : 'password')
    }
  }

  return (
    <>
      <AuthBanner tone="error" message={serverError?.message ?? null}>
        {serverError?.exists ? (
          <p className="mt-1 text-fg-muted">
            <SwitchLink to={login} email={email.trim()}>
              Log in
            </SwitchLink>
          </p>
        ) : null}
      </AuthBanner>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <Field
          label="Username"
          autoComplete="username"
          autoFocus
          data-testid="signup-username"
          error={errors.username?.message}
          {...register('username')}
        />
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          data-testid="signup-email"
          error={errors.email?.message}
          {...register('email')}
        />
        <div>
          <PasswordField
            label="Password"
            autoComplete="new-password"
            data-testid="signup-password"
            error={password && charCountOver(password) ? errors.password?.message : undefined}
            {...register('password')}
          />
          <PasswordRules password={password} />
        </div>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting} data-testid="signup-submit">
          Create account
        </Button>
      </form>
      <p className="mt-6 text-sm text-fg-subtle">
        Already have an account?{' '}
        <SwitchLink to={login} email={email.trim()}>
          Log in
        </SwitchLink>
      </p>
    </>
  )
}

/** Only an over-long password is shown as an error; the rule line covers "too short". */
function charCountOver(password: string): boolean {
  return [...password].length > 72
}

const loginSchema = z.object({
  email: z
    .string()
    .check(z.refine((v) => emailError(normaliseEmail(v)) === null, 'Please enter a valid email address')),
  // Same as the server: any non-empty password, so older short ones still work.
  password: z.string().check(z.minLength(1, 'Password is required')),
})
type LoginValues = z.infer<typeof loginSchema>

export function LoginForm({
  initialEmail = '',
  next,
  signup,
  notice,
}: {
  initialEmail?: string
  next?: string | null
  signup: AuthSwitch
  notice?: string | null
}) {
  const login = useSession((s) => s.login)
  const afterAuth = useAfterAuth()
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setValue,
    setFocus,
    control,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: initialEmail, password: '' },
  })
  const email = useWatch({ control, name: 'email' })

  const onSubmit = async (values: LoginValues) => {
    setServerError(null)
    try {
      const user = await login(normaliseEmail(values.email), values.password)
      await afterAuth(user, next)
    } catch (e) {
      setServerError(errorMessage(e))
      setValue('password', '')
      setFocus('password')
    }
  }

  return (
    <>
      <AuthBanner tone="success" message={notice && !serverError ? notice : null} />
      {/* The server answers the same way for an unknown email and a wrong
          password, so this is a suggestion, never an automatic redirect. */}
      <AuthBanner tone="error" message={serverError}>
        <p className="mt-1 text-fg-muted">
          No account yet?{' '}
          <SwitchLink to={signup} email={email.trim()}>
            Sign up
          </SwitchLink>
        </p>
      </AuthBanner>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          autoFocus={!initialEmail}
          data-testid="login-email"
          error={errors.email?.message}
          {...register('email')}
        />
        <PasswordField
          label="Password"
          autoComplete="current-password"
          autoFocus={Boolean(initialEmail)}
          data-testid="login-password"
          error={errors.password?.message}
          hint={
            <Link
              to="/forgot-password"
              className="text-xs text-fg-subtle underline-offset-4 hover:text-fg hover:underline"
            >
              Forgot password?
            </Link>
          }
          {...register('password')}
        />
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting} data-testid="login-submit">
          Log in
        </Button>
      </form>
      <p className="mt-6 text-sm text-fg-subtle">
        No account yet?{' '}
        <SwitchLink to={signup} email={email.trim()}>
          Sign up
        </SwitchLink>
      </p>
    </>
  )
}
