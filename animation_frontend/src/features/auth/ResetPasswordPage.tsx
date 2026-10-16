import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, LinkIcon } from 'lucide-react'
import { Button, buttonClass } from '@/components/ui/button'
import { authApi } from '@/lib/api/auth'
import { errorMessage } from '@/lib/api/http'
import { useTitle } from '@/lib/useTitle'
import { isResetToken, passwordError } from '@/lib/validation'
import { AuthBanner, AuthLayout, linkClass, PasswordField, StrengthMeter } from './AuthLayout'

const schema = z
  .object({
    password: z
      .string()
      .refine((v) => passwordError(v) === null, 'Password must be between 8 and 72 characters'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'The two passwords do not match' })
type Values = z.infer<typeof schema>

const backToLogin = (
  <Link to="/login" className={`${linkClass} inline-flex items-center gap-1.5`}>
    <ArrowLeft className="size-3.5" /> Back to log in
  </Link>
)

function ResetForm({ token }: { token: string }) {
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    setFocus,
    control,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { password: '', confirm: '' } })
  const password = useWatch({ control, name: 'password' })

  const onSubmit = async (values: Values) => {
    setServerError(null)
    try {
      await authApi.resetPassword(token, values.password)
      // Replace, so the URL holding the token is dropped from history.
      navigate('/login', {
        replace: true,
        state: { notice: 'Password updated. Log in with your new password.' },
      })
    } catch (e) {
      setServerError(errorMessage(e))
      reset({ password: '', confirm: '' })
      setFocus('password')
    }
  }

  return (
    <>
      <AuthBanner tone="error" message={serverError}>
        <p className="mt-1 text-fg-muted">
          Links expire after an hour.{' '}
          <Link to="/forgot-password" className={linkClass}>
            Request a new one
          </Link>
        </p>
      </AuthBanner>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div>
          <PasswordField
            label="New password"
            autoComplete="new-password"
            autoFocus
            error={errors.password?.message}
            {...register('password')}
          />
          <StrengthMeter password={password} />
        </div>
        <PasswordField
          label="Confirm new password"
          autoComplete="new-password"
          error={errors.confirm?.message}
          {...register('confirm')}
        />
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          Update password
        </Button>
      </form>
    </>
  )
}

export default function ResetPasswordPage() {
  useTitle('Choose a new password')
  const { token } = useParams()

  // A token of the wrong shape cannot be valid, so nothing is sent.
  if (!isResetToken(token)) {
    return (
      <AuthLayout title="This link does not work" footer={backToLogin}>
        <div role="alert" className="rounded-xl border border-line bg-surface-1 p-5">
          <div className="grid size-11 place-items-center rounded-xl border border-status-failed/30 bg-status-failed/10 text-status-failed">
            <LinkIcon className="size-5" />
          </div>
          <p className="mt-4 text-sm text-fg">The reset link is incomplete or malformed.</p>
          <p className="mt-1 text-xs text-fg-subtle">
            Copy the whole link from the email, or ask for a fresh one. Each link works once.
          </p>
          <Link to="/forgot-password" className={buttonClass('secondary', 'md', 'mt-4')}>
            Request a new link
          </Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Choose a new password"
      subtitle="Pick something you do not use anywhere else."
      footer={backToLogin}
    >
      <ResetForm token={token} />
    </AuthLayout>
  )
}
