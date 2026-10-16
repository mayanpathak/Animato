import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, MailCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { authApi } from '@/lib/api/auth'
import { errorMessage } from '@/lib/api/http'
import { ease } from '@/lib/motion'
import { useTitle } from '@/lib/useTitle'
import { emailError, normaliseEmail } from '@/lib/validation'
import { AuthBanner, AuthLayout, linkClass } from './AuthLayout'

const schema = z.object({
  email: z
    .string()
    .refine((v) => emailError(normaliseEmail(v)) === null, 'Please enter a valid email address'),
})
type Values = z.infer<typeof schema>

export default function ForgotPasswordPage() {
  useTitle('Reset your password')
  const [serverError, setServerError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [resending, setResending] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '' } })

  const send = async (email: string) => {
    setServerError(null)
    try {
      await authApi.forgotPassword(email)
      setSentTo(email)
    } catch (e) {
      setServerError(errorMessage(e))
    }
  }

  const resend = async () => {
    if (!sentTo) return
    setResending(true)
    await send(sentTo)
    setResending(false)
  }

  return (
    <AuthLayout
      title={sentTo ? 'Check your inbox' : 'Reset your password'}
      subtitle={sentTo ? undefined : 'Enter the email you signed up with and we will send you a reset link.'}
      footer={
        <Link to="/login" className={`${linkClass} inline-flex items-center gap-1.5`}>
          <ArrowLeft className="size-3.5" /> Back to log in
        </Link>
      }
    >
      <AuthBanner tone="error" message={serverError} />
      <AnimatePresence mode="wait" initial={false}>
        {sentTo ? (
          <motion.div
            key="sent"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3, ease: ease.outExpo }}
            role="status"
          >
            <div className="rounded-xl border border-line bg-surface-1 p-5">
              <div className="grid size-11 place-items-center rounded-xl border border-status-succeeded/30 bg-status-succeeded/10 text-status-succeeded">
                <MailCheck className="size-5" />
              </div>
              {/* The same answer whether or not the email has an account, so this
                  page cannot be used to find out which emails are registered. */}
              <p className="mt-4 text-sm text-fg">
                If an account exists for <span className="font-medium break-all">{sentTo}</span>, a reset link
                is on its way.
              </p>
              <p className="mt-2 text-xs text-fg-subtle">
                The link works once and expires after an hour. Check your spam folder if nothing arrives in a
                few minutes.
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="secondary" loading={resending} onClick={() => void resend()}>
                Send it again
              </Button>
              <Button variant="ghost" onClick={() => setSentTo(null)}>
                Use another email
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3, ease: ease.outExpo }}
            onSubmit={handleSubmit((v) => send(normaliseEmail(v.email)))}
            noValidate
            className="space-y-4"
          >
            <Field
              label="Email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="you@studio.com"
              error={errors.email?.message}
              {...register('email')}
            />
            <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
              Send reset link
            </Button>
          </motion.form>
        )}
      </AnimatePresence>
    </AuthLayout>
  )
}
