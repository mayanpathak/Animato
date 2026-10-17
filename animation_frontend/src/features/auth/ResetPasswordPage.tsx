import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod/mini'
import { ArrowLeft } from 'lucide-react'
import { Button, buttonClass } from '@/components/ui/button'
import { authApi } from '@/lib/api/auth'
import { errorMessage } from '@/lib/api/http'
import { useTitle } from '@/lib/useTitle'
import { toast } from '@/stores/toast'
import { isResetToken, passwordError } from '@/lib/validation'
import { AuthBanner, AuthLayout, linkClass, PasswordField, PasswordRules } from './AuthLayout'

const schema = z
  .object({
    password: z
      .string()
      .check(z.refine((v) => passwordError(v) === null, 'Password must be between 8 and 72 characters')),
    confirm: z.string(),
  })
  .check(
    z.refine((v) => v.password === v.confirm, {
      path: ['confirm'],
      message: 'The two passwords do not match',
    }),
  )
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
      toast.success('Password changed. Log in with your new password.')
      navigate('/login', { replace: true })
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
          <PasswordRules password={password} />
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
      <AuthLayout title="This link is not valid" footer={backToLogin}>
        <div role="alert">
          <p className="text-fg-muted">
            Copy the whole link from the email, or ask for a fresh one. Each link works once.
          </p>
          <Link to="/forgot-password" className={buttonClass('secondary', 'md', 'mt-5')}>
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
