import { create } from 'zustand'

/** The signup / login sheet over the landing page (plan 5.1 step 2). */
export const useAuthSheet = create<{
  mode: 'signup' | 'login' | null
  email: string
  open: (mode: 'signup' | 'login', email?: string) => void
  close: () => void
}>((set) => ({
  mode: null,
  email: '',
  open: (mode, email = '') => set({ mode, email }),
  close: () => set({ mode: null }),
}))
