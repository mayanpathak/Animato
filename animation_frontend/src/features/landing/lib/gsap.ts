// GSAP setup for the marketing pages. Plugins are registered once here so
// sections import gsap/ScrollTrigger/useGSAP from this module only.
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(ScrollTrigger, useGSAP)

export { gsap, ScrollTrigger, useGSAP }

/** gsap.matchMedia() conditions shared by every landing animation. */
export const MEDIA = {
  motion: '(prefers-reduced-motion: no-preference)',
  desktop: '(min-width: 768px)',
} as const

/** The in-app "reduce motion" preference (Settings), which CSS media queries cannot see. */
export function appReducedMotion(): boolean {
  return typeof document !== 'undefined' && document.documentElement.dataset.reducedMotion === 'true'
}
