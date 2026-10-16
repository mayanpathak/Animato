import { useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { errorMessage } from '@/lib/api/http'
import { useTitle } from '@/lib/useTitle'
import { emailError, normaliseEmail } from '@/lib/validation'
import { useSession } from '@/stores/session'
import { AuthBanner, AuthLayout, linkClass, OAuthButtons, PasswordField } from './AuthLayout'
import { createPathFor, readPendingPrompt, safeNext, savePendingPrompt } from './pendingPrompt'

const schema = z.object({
  email: z
    .string()
    .refine((v) => emailError(normaliseEmail(v)) === null, 'Please enter a valid email address'),
  // Same as the server: any non-empty password, so older short ones still work.
  password: z.string().min(1, 'Password is required'),
})
type Values = z.infer<typeof schema>

export default function LoginPage() {
  useTitle('Log in')
  const [params] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const login = useSession((s) => s.login)
  const notice = (location.state as { notice?: unknown } | null)?.notice
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    setFocus,
    control,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: params.get('email') ?? '', password: '' },
  })

  const onSubmit = async (values: Values) => {
    setServerError(null)
    savePendingPrompt(params.get('prompt'))
    try {
      const user = await login(normaliseEmail(values.email), values.password)
      // The route guard does the same; navigating here also covers a pending prompt.
      const pending = readPendingPrompt()
      const target = !user.isVerified
        ? '/verify-email'
        : (safeNext(params.get('next')) ?? (pending ? createPathFor(pending) : '/app'))
      navigate(target, { replace: true })
    } catch (e) {
      setServerError(errorMessage(e))
      setValue('password', '')
      setFocus('password')
    }
  }

  const typedEmail = useWatch({ control, name: 'email' })
  const signupHref = () => {
    const q = new URLSearchParams()
    const email = typedEmail.trim()
    if (email) q.set('email', email)
    const prompt = params.get('prompt')
    if (prompt) q.set('prompt', prompt)
    const s = q.toString()
    return s ? `/signup?${s}` : '/signup'
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to pick up where you left off."
      footer={
        <>
          New to Animato?{' '}
          <Link to={signupHref()} className={linkClass}>
            Create an account
          </Link>
        </>
      }
    >
      <OAuthButtons />
      <AuthBanner tone="success" message={typeof notice === 'string' && !serverError ? notice : null} />
      {/* The server answers the same way for an unknown email and a wrong
          password, so this is a suggestion, never an automatic redirect. */}
      <AuthBanner tone="error" message={serverError}>
        <p className="mt-1 text-fg-muted">
          No account yet?{' '}
          <Link to={signupHref()} className={linkClass}>
            Sign up
          </Link>
        </p>
      </AuthBanner>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          autoFocus
          placeholder="you@studio.com"
          data-testid="login-email"
          error={errors.email?.message}
          {...register('email')}
        />
        <PasswordField
          label="Password"
          autoComplete="current-password"
          data-testid="login-password"
          error={errors.password?.message}
          hint={
            <Link to="/forgot-password" className="text-xs text-fg-subtle transition-colors hover:text-fg">
              Forgot password?
            </Link>
          }
          {...register('password')}
        />
        <Button
          type="submit"
          size="lg"
          className="w-full"
          loading={isSubmitting}
          rightIcon={<ArrowRight className="size-4" />}
          data-testid="login-submit"
        >
          Log in
        </Button>
      </form>
    </AuthLayout>
  )
}
