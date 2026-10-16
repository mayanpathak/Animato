import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowRight, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { ApiError, errorMessage } from '@/lib/api/http'
import { useTitle } from '@/lib/useTitle'
import { emailError, normaliseEmail, passwordError, usernameError } from '@/lib/validation'
import { useSession } from '@/stores/session'
import { AuthBanner, AuthLayout, linkClass, OAuthButtons, PasswordField, StrengthMeter } from './AuthLayout'
import { savePendingPrompt } from './pendingPrompt'

const schema = z.object({
  username: z
    .string()
    .refine((v) => usernameError(v.trim()) === null, 'Username must be between 3 and 30 characters'),
  email: z
    .string()
    .refine((v) => emailError(normaliseEmail(v)) === null, 'Please enter a valid email address'),
  password: z
    .string()
    .refine((v) => passwordError(v) === null, 'Password must be between 8 and 72 characters'),
})
type Values = z.infer<typeof schema>

export default function SignupPage() {
  useTitle('Sign up')
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const signup = useSession((s) => s.signup)
  const prompt = params.get('prompt')?.trim() || null
  const [serverError, setServerError] = useState<{ message: string; exists: boolean } | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    setFocus,
    control,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: { username: '', email: params.get('email') ?? '', password: '' },
  })
  const password = useWatch({ control, name: 'password' })
  const email = useWatch({ control, name: 'email' })

  const onSubmit = async (values: Values) => {
    setServerError(null)
    // Kept in this tab so it survives email verification.
    savePendingPrompt(prompt)
    try {
      await signup(values.username.trim(), normaliseEmail(values.email), values.password)
      // The server has set the session cookie and returned an unverified user.
      navigate('/verify-email', { replace: true })
    } catch (e) {
      setServerError({ message: errorMessage(e), exists: e instanceof ApiError && e.status === 409 })
      setValue('password', '')
      setFocus('password')
    }
  }

  const loginHref = email.trim() ? `/login?email=${encodeURIComponent(email.trim())}` : '/login'

  return (
    <AuthLayout
      title="Create your account"
      subtitle="We will email you a 6-digit code to confirm your address."
      footer={
        <>
          Already have an account?{' '}
          <Link to={loginHref} className={linkClass}>
            Log in
          </Link>
        </>
      }
    >
      {prompt ? (
        <div className="mb-6 rounded-lg border border-line bg-surface-1 p-3">
          <p className="flex items-center gap-1.5 text-2xs font-medium tracking-wide text-accent uppercase">
            <Sparkles className="size-3" /> Your first animation
          </p>
          <p className="mt-1 line-clamp-2 text-sm text-fg-muted">“{prompt}”</p>
          <p className="mt-1 text-2xs text-fg-faint">
            We will open it in Prompt Studio once your email is verified.
          </p>
        </div>
      ) : null}
      <OAuthButtons />
      <AuthBanner tone="error" message={serverError?.message ?? null}>
        {serverError?.exists ? (
          <p className="mt-1 text-fg-muted">
            <Link to={loginHref} className={linkClass}>
              Log in instead
            </Link>
          </p>
        ) : null}
      </AuthBanner>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <Field
          label="Username"
          autoComplete="username"
          autoFocus
          placeholder="ada"
          data-testid="signup-username"
          error={errors.username?.message}
          hint={<span className="text-2xs text-fg-faint">3–30 characters</span>}
          {...register('username')}
        />
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@studio.com"
          data-testid="signup-email"
          error={errors.email?.message}
          {...register('email')}
        />
        <div>
          <PasswordField
            label="Password"
            autoComplete="new-password"
            data-testid="signup-password"
            error={errors.password?.message}
            {...register('password')}
          />
          <StrengthMeter password={password} />
        </div>
        <Button
          type="submit"
          size="lg"
          className="w-full"
          loading={isSubmitting}
          rightIcon={<ArrowRight className="size-4" />}
          data-testid="signup-submit"
        >
          Create account
        </Button>
        <p className="text-center text-2xs text-fg-faint">
          Each account can start up to 5 renders an hour and 15 a day.
        </p>
      </form>
    </AuthLayout>
  )
}
