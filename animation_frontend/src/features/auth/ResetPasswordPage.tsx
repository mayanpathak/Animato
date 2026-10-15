import { useTitle } from '@/lib/useTitle'

export default function ResetPasswordPage() {
  useTitle('Choose a new password')
  return <div className="p-8 text-fg-muted">Choose a new password</div>
}
