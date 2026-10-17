import { Dialog } from '@/components/ui/dialog'
import { LEGAL_LINE } from '@/features/auth/AuthLayout'
import { LoginForm, SignupForm } from '@/features/auth/forms'
import { readPendingPrompt } from '@/features/auth/pendingPrompt'
import { PendingPromptCard } from '@/features/auth/PendingPromptCard'
import { useAuthSheet } from './authSheet'

/** Signup over the landing page, with the visitor's prompt above the form. */
export function AuthSheet() {
  const { mode, email, open, close } = useAuthSheet()
  const pending = mode ? readPendingPrompt() : null
  return (
    <Dialog
      open={mode !== null}
      onClose={close}
      title={mode === 'login' ? 'Log in to generate' : 'Create your account to generate'}
      className="sm:max-w-[440px]"
    >
      <div className="pb-3" data-testid="auth-sheet">
        {pending ? <PendingPromptCard prompt={pending.prompt} /> : null}
        {mode === 'login' ? (
          <LoginForm key="login" initialEmail={email} signup={{ onSwitch: (e) => open('signup', e) }} />
        ) : mode === 'signup' ? (
          <SignupForm key="signup" initialEmail={email} login={{ onSwitch: (e) => open('login', e) }} />
        ) : null}
        <p className="mt-6 text-xs text-fg-subtle">{LEGAL_LINE}</p>
      </div>
    </Dialog>
  )
}
