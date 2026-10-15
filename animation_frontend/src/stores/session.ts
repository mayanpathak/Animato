import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authApi, type User } from '@/lib/api/auth'
import { ApiError, errorMessage, SESSION_LOST_EVENT } from '@/lib/api/http'

// The session cookie is HttpOnly: this store never sees a token. It keeps the
// user profile so the shell can paint immediately after a reload; check-auth
// re-validates it on every start, and any 401 logs the UI out.

interface SessionState {
  user: User | null
  /** True until the startup check-auth call has answered. */
  checking: boolean
  checkAuth: () => Promise<void>
  signup: (username: string, email: string, password: string) => Promise<User>
  login: (email: string, password: string) => Promise<User>
  logout: () => Promise<void>
  verifyEmail: (code: string) => Promise<User>
  sessionLost: () => void
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      user: null,
      checking: true,

      checkAuth: async () => {
        try {
          const user = await authApi.checkAuth()
          set({ user, checking: false })
        } catch (e) {
          // Only a definite "not logged in" clears the profile; a network error keeps it.
          if (e instanceof ApiError && e.status === 401) set({ user: null })
          set({ checking: false })
        }
      },

      signup: async (username, email, password) => {
        const user = await authApi.signup(username, email, password)
        set({ user })
        return user
      },

      login: async (email, password) => {
        const user = await authApi.login(email, password)
        set({ user })
        return user
      },

      // Local state is cleared only once the server confirmed the cookie is gone.
      logout: async () => {
        try {
          await authApi.logout()
        } catch (e) {
          throw new Error(`You are still logged in. ${errorMessage(e)}`, { cause: e })
        }
        set({ user: null })
      },

      verifyEmail: async (code) => {
        const user = await authApi.verifyEmail(code)
        set({ user })
        return user
      },

      sessionLost: () => set({ user: null }),
    }),
    {
      name: 'animato:session',
      partialize: (s) => ({ user: s.user }),
    },
  ),
)

if (typeof window !== 'undefined') {
  window.addEventListener(SESSION_LOST_EVENT, (e) => {
    // check-auth's own 401 is handled by checkAuth.
    if ((e as CustomEvent<string>).detail !== '/auth/check-auth') useSession.getState().sessionLost()
  })
}
