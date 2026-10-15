import { useTitle } from '@/lib/useTitle'

export default function ForgotPasswordPage() {
  useTitle('Reset your password')
  return <div className="p-8 text-fg-muted">Reset your password</div>
}
