import type { RefObject } from 'react'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { gsap, MEDIA, ScrollTrigger, useGSAP } from './gsap'

/**
 * Fades `[data-reveal]` elements inside `scope` up into view as they enter the
 * viewport. With reduced motion (OS or in-app) nothing is hidden or moved.
 * Call it from the page component so it runs after the sections' own
 * ScrollTriggers (pins) exist and their spacing is measured first.
 */
export function useReveal(scope: RefObject<HTMLElement | null>): void {
  const reduced = useReducedMotion()
  useGSAP(
    () => {
      if (reduced) return
      const mm = gsap.matchMedia()
      mm.add(MEDIA.motion, () => {
        const items = gsap.utils.toArray<HTMLElement>('[data-reveal]')
        if (items.length === 0) return
        gsap.set(items, { opacity: 0, y: 24 })
        ScrollTrigger.batch(items, {
          start: 'top 88%',
          once: true,
          onEnter: (batch) =>
            gsap.to(batch, {
              opacity: 1,
              y: 0,
              duration: 0.9,
              ease: 'expo.out',
              stagger: 0.08,
              overwrite: true,
            }),
        })
      })
      return () => mm.revert()
    },
    { scope, dependencies: [reduced], revertOnUpdate: true },
  )
}
