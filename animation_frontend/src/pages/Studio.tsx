import { useEffect } from 'react'
import { AssetBin } from '../components/studio/AssetBin'
import { ChatPanel } from '../components/studio/ChatPanel'
import { CurrentVideo } from '../components/studio/CurrentVideo'
import { Button, FormError } from '../components/ui'
import { useAuthStore } from '../store/authStore'
import { useStudioStore } from '../store/studioStore'

export default function Studio() {
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const isLoading = useAuthStore((state) => state.isLoading)
  const authError = useAuthStore((state) => state.error)

  const load = useStudioStore((state) => state.load)
  const reset = useStudioStore((state) => state.reset)

  const email = user?.email

  // Load this user's jobs on the way in; wipe them from memory on the way
  // out (logout or a lost session), so the next user starts empty.
  useEffect(() => {
    if (!email) return

    load(email)
    return reset
  }, [email, load, reset])

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      <header className="flex items-center justify-between gap-4 border-b border-zinc-200 bg-white px-6 py-3">
        <span className="text-xl font-semibold tracking-tight">myanimate</span>

        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-zinc-600 sm:inline">{user?.username}</span>
          <Button variant="secondary" onClick={() => void logout()} busy={isLoading}>
            Log out
          </Button>
        </div>
      </header>

      {authError && (
        <div className="px-4 pt-4">
          <FormError message={authError} />
        </div>
      )}

      <main className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-2">
        <div className="flex min-h-0 flex-col gap-4">
          <ChatPanel />
          <AssetBin />
        </div>

        <CurrentVideo />
      </main>
    </div>
  )
}
