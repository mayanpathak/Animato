import { useLocation, useSearchParams } from 'react-router-dom'
import { useTitle } from '@/lib/useTitle'
import { AuthLayout } from './AuthLayout'
import { LoginForm } from './forms'
import { readPendingPrompt } from './pendingPrompt'
import { PendingPromptCard } from './PendingPromptCard'

export default function LoginPage() {
  useTitle('Log in')
  const [params] = useSearchParams()
  const location = useLocation()
  const notice = (location.state as { notice?: unknown } | null)?.notice
  const pending = readPendingPrompt()
  return (
    <AuthLayout title="Log in" subtitle="Welcome back.">
      {pending ? <PendingPromptCard prompt={pending.prompt} /> : null}
      <LoginForm
        initialEmail={params.get('email') ?? ''}
        next={params.get('next')}
        notice={typeof notice === 'string' ? notice : null}
        signup={{ href: (email) => (email ? `/signup?email=${encodeURIComponent(email)}` : '/signup') }}
      />
    </AuthLayout>
  )
}
