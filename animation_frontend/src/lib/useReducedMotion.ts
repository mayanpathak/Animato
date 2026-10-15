import { useReducedMotion as useOsReducedMotion } from 'motion/react'
import { usePreferences } from '@/stores/preferences'

/** OS setting or the in-app preference. */
export function useReducedMotion(): boolean {
  const os = useOsReducedMotion()
  const pref = usePreferences((s) => s.reducedMotion)
  return Boolean(os) || pref
}
