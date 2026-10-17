// Motion tokens for Framer Motion, mirroring src/styles/tokens.css so CSS
// and Framer animations feel the same.
import type { Transition } from 'motion/react'

export const ease = {
  outExpo: [0.16, 1, 0.3, 1],
  outQuart: [0.25, 1, 0.5, 1],
  inOutQuart: [0.76, 0, 0.24, 1],
  spring: [0.34, 1.56, 0.64, 1],
} as const satisfies Record<string, readonly [number, number, number, number]>

/** Seconds. */
export const duration = {
  instant: 0.09,
  fast: 0.16,
  base: 0.24,
  slow: 0.42,
  slower: 0.7,
} as const

export const spring = {
  snappy: { type: 'spring', stiffness: 520, damping: 38, mass: 0.7 },
  soft: { type: 'spring', stiffness: 260, damping: 30 },
  layout: { type: 'spring', stiffness: 420, damping: 40 },
  /** Shared-element morphs (plan 7.2). */
  morph: { type: 'spring', stiffness: 380, damping: 32 },
} as const satisfies Record<string, Transition>

export const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: duration.base, ease: ease.outExpo },
}

export function prefersReducedMotion(): boolean {
  if (typeof document !== 'undefined' && document.documentElement.dataset.reducedMotion === 'true')
    return true
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
