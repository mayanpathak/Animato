// Where a user goes once they are logged in (plan 5.1): verify first, then a
// pending landing prompt becomes a drafting video, else `next`, else Videos.
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@/app/nav'
import type { User } from '@/lib/api/auth'
import { draftFromPending } from '@/features/videos/model'
import { usePreferences } from '@/stores/preferences'
import { clearPendingPrompt, readPendingPrompt, safeNext } from './pendingPrompt'

export function useAfterAuth() {
  const navigate = useNavigate()
  return async (user: User, next?: string | null) => {
    if (!user.isVerified) {
      navigate('/verify-email', { replace: true })
      return
    }
    const pending = readPendingPrompt()
    if (pending) {
      clearPendingPrompt()
      const video = await draftFromPending(user.email, pending, usePreferences.getState().defaultFormat)
      navigate(ROUTES.video(video.id), { replace: true })
      return
    }
    navigate(safeNext(next ?? null) ?? ROUTES.videos, { replace: true })
  }
}
