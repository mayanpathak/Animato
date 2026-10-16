import { useSearchParams } from 'react-router-dom'
import { useTitle } from '@/lib/useTitle'
import { AuthLayout } from './AuthLayout'
import { SignupForm } from './forms'
import { readPendingPrompt } from './pendingPrompt'
import { PendingPromptCard } from './PendingPromptCard'

export default function SignupPage() {
  useTitle('Sign up')
  const [params] = useSearchParams()
  const pending = readPendingPrompt()
  return (
    <AuthLayout
      title={pending ? 'Create your account to generate' : 'Create your account'}
      subtitle="We’ll email you a 6-digit code to confirm your address."
    >
      {pending ? <PendingPromptCard prompt={pending.prompt} /> : null}
      <SignupForm
        initialEmail={params.get('email') ?? ''}
        login={{ href: (email) => (email ? `/login?email=${encodeURIComponent(email)}` : '/login') }}
      />
    </AuthLayout>
  )
}
