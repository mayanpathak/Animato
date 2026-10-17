import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type VideoFormat = '16:9' | '9:16' | '1:1'
export const VIDEO_FORMATS: VideoFormat[] = ['9:16', '16:9', '1:1']

export type LookId = 'clean' | 'bold' | 'minimal' | 'brand'
export const LOOKS: { id: LookId; label: string }[] = [
  { id: 'clean', label: 'Clean' },
  { id: 'bold', label: 'Bold' },
  { id: 'minimal', label: 'Minimal' },
  { id: 'brand', label: 'Brand' },
]

interface Preferences {
  reducedMotion: boolean
  /** Format a new video opens in. 9:16 for first-time users (plan 18.2); the last used wins afterwards. */
  defaultFormat: VideoFormat
  defaultLook: LookId
  /** The user allowed "Notify me when it's ready" (the browser permission is separate). */
  notifications: boolean
  setReducedMotion: (v: boolean) => void
  setDefaultFormat: (f: VideoFormat) => void
  setDefaultLook: (l: LookId) => void
  setNotifications: (v: boolean) => void
}

export const usePreferences = create<Preferences>()(
  persist(
    (set) => ({
      reducedMotion: false,
      defaultFormat: '9:16',
      defaultLook: 'clean',
      notifications: false,
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),
      setDefaultFormat: (defaultFormat) => set({ defaultFormat }),
      setDefaultLook: (defaultLook) => set({ defaultLook }),
      setNotifications: (notifications) => set({ notifications }),
    }),
    {
      name: 'animato:preferences',
      // Drops settings that no longer exist (density, sidebar, editor fps).
      partialize: (s) => ({
        reducedMotion: s.reducedMotion,
        defaultFormat: s.defaultFormat,
        defaultLook: s.defaultLook,
        notifications: s.notifications,
      }),
    },
  ),
)

/** Mirrors preferences onto <html> so CSS (reduced motion) can follow. */
export function applyPreferences(): () => void {
  const apply = (s: Preferences) => {
    document.documentElement.dataset.reducedMotion = String(s.reducedMotion)
  }
  apply(usePreferences.getState())
  return usePreferences.subscribe(apply)
}
