// Create remembers the last engine, length, style and brand toggle (plan 6.4).
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_OPTIONS, type CreateOptions, type Engine } from './prompt'

interface CreatePrefs extends CreateOptions {
  engine: Engine
  set: (patch: Partial<CreateOptions & { engine: Engine }>) => void
}

export const useCreatePrefs = create<CreatePrefs>()(
  persist(
    (set) => ({
      ...DEFAULT_OPTIONS,
      engine: 'auto',
      set: (patch) => set(patch),
    }),
    {
      name: 'animato:create',
      partialize: ({ engine, length, style, useBrand }) => ({ engine, length, style, useBrand }),
    },
  ),
)
