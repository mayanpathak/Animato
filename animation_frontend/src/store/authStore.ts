import { create } from 'zustand'
import { api, isRecord, type ApiResult } from '../lib/api'
import type { User } from '../types'

// The only code that calls /api/auth. The user object lives in memory only;
// after a refresh it is rebuilt from check-auth.

const UNEXPECTED = 'Something went wrong. Please try again.'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  // True until the startup session check has finished.
  isCheckingAuth: boolean
  isLoading: boolean
  error: string | null

  checkAuth: () => Promise<void>
  refreshUser: () => Promise<void>
  signup: (username: string, email: string, password: string) => Promise<boolean>
  login: (email: string, password: string) => Promise<boolean>
  logout: () => Promise<boolean>
  verifyEmail: (code: string) => Promise<boolean>
  resendVerification: () => Promise<ApiResult>
  forgotPassword: (email: string) => Promise<boolean>
  resetPassword: (token: string, password: string) => Promise<boolean>
  sessionLost: () => void
  clearError: () => void
}

// Never trust the shape of what came back.
function parseUser(data: unknown): User | null {
  if (!isRecord(data) || !isRecord(data.user)) return null

  const { email, username, is_verified } = data.user

  if (
    typeof email !== 'string' ||
    typeof username !== 'string' ||
    typeof is_verified !== 'boolean'
  ) {
    return null
  }

  return { email, username, isVerified: is_verified }
}

const LOGGED_OUT = { user: null, isAuthenticated: false } as const

export const useAuthStore = create<AuthState>((set, get) => {
  // Signup, login and verify-email all answer with the user object.
  const userAction = async (path: string, body: unknown): Promise<ApiResult> => {
    set({ isLoading: true, error: null })

    const res = await api('POST', path, body)
    const user = res.ok ? parseUser(res.data) : null

    if (user) {
      set({ user, isAuthenticated: true, isLoading: false })
    } else {
      set({ isLoading: false, error: res.ok ? UNEXPECTED : res.message })
    }

    return { ...res, ok: user !== null }
  }

  const messageAction = async (path: string, body?: unknown): Promise<boolean> => {
    set({ isLoading: true, error: null })

    const res = await api('POST', path, body)

    set({ isLoading: false, error: res.ok ? null : res.message })
    return res.ok
  }

  return {
    user: null,
    isAuthenticated: false,
    isCheckingAuth: true,
    isLoading: false,
    error: null,

    checkAuth: async () => {
      const res = await api('GET', '/auth/check-auth')
      const user = res.ok ? parseUser(res.data) : null

      set({ user, isAuthenticated: user !== null, isCheckingAuth: false })
    },

    // Re-reads the user without the startup spinner (after a 403 elsewhere).
    refreshUser: async () => {
      const res = await api('GET', '/auth/check-auth')
      const user = res.ok ? parseUser(res.data) : null

      if (user) {
        set({ user, isAuthenticated: true })
      } else if (res.status === 401) {
        get().sessionLost()
      }
    },

    signup: async (username, email, password) =>
      (await userAction('/auth/signup', { username, email, password })).ok,

    login: async (email, password) => (await userAction('/auth/login', { email, password })).ok,

    verifyEmail: async (code) => {
      const res = await userAction('/auth/verify-email', { code })

      if (res.status === 401) get().sessionLost()
      return res.ok
    },

    resendVerification: async () => {
      const res = await api('POST', '/auth/resend-verification')

      if (res.status === 401) get().sessionLost()
      return res
    },

    forgotPassword: (email) => messageAction('/auth/forgot-password', { email }),

    resetPassword: (token, password) =>
      messageAction(`/auth/reset-password/${encodeURIComponent(token)}`, { password }),

    // Local state is cleared only once the server has cleared the cookie.
    // Otherwise the UI would say "logged out" while the session still works.
    logout: async () => {
      set({ isLoading: true, error: null })

      const res = await api('POST', '/auth/logout')

      if (res.ok) {
        set({ ...LOGGED_OUT, isLoading: false })
      } else {
        set({ isLoading: false, error: `You are still logged in. ${res.message}` })
      }

      return res.ok
    },

    // A 401 arrived somewhere: the cookie is gone, expired or invalid.
    sessionLost: () => set({ ...LOGGED_OUT, isLoading: false }),

    clearError: () => set({ error: null }),
  }
})
