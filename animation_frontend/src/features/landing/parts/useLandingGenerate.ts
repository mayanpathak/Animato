import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@/app/nav'
import { track } from '@/lib/analytics'
import { savePendingPrompt } from '@/features/auth/pendingPrompt'
import type { Engine } from '@/features/create/prompt'
import { useSession } from '@/stores/session'
import { useAuthSheet } from './authSheet'

/** Logged out: keep the prompt and open signup over the page. Logged in: open Create. */
export function useLandingGenerate() {
  const navigate = useNavigate()
  const user = useSession((s) => s.user)
  return (prompt: string, engine: Engine) => {
    track('landing_prompt_submit', { engine, signedIn: Boolean(user) })
    if (user) {
      navigate(`${ROUTES.newVideo}?prompt=${encodeURIComponent(prompt)}&engine=${engine}`)
      return
    }
    savePendingPrompt(prompt, engine)
    useAuthSheet.getState().open('signup')
  }
}
