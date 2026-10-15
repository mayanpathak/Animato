import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Density = 'comfortable' | 'compact'

interface Preferences {
  density: Density
  reducedMotion: boolean
  sidebarCollapsed: boolean
  editorFps: 30 | 60
  setDensity: (d: Density) => void
  setReducedMotion: (v: boolean) => void
  toggleSidebar: () => void
  setEditorFps: (fps: 30 | 60) => void
}

export const usePreferences = create<Preferences>()(
  persist(
    (set) => ({
      density: 'comfortable',
      reducedMotion: false,
      sidebarCollapsed: false,
      editorFps: 30,
      setDensity: (density) => set({ density }),
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setEditorFps: (editorFps) => set({ editorFps }),
    }),
    { name: 'animato:preferences' },
  ),
)

/** Mirrors preferences onto <html> so CSS (density, reduced motion) can follow. */
export function applyPreferences(): () => void {
  const apply = (s: Preferences) => {
    document.documentElement.dataset.density = s.density
    document.documentElement.dataset.reducedMotion = String(s.reducedMotion)
  }
  apply(usePreferences.getState())
  return usePreferences.subscribe(apply)
}
