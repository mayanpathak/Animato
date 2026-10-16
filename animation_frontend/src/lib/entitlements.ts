// What a plan allows (plan 14.2). Every gated UI reads getEntitlements() and
// nothing else; the billing phase replaces this body.
import type { User } from '@/lib/api/auth'

export interface Entitlements {
  plan: 'free' | 'creator'
  /** Early access: the "Made with Animato" mark is on by default and can be turned off. */
  watermark: 'forced' | 'default-on' | 'off'
  /** Tallest export side: 1920 for 9:16, so 1080p in every format. */
  maxExportHeight: number
  customFonts: boolean
  /**
   * Must match api_server's defaults (JOB_LIMIT_PER_HOUR=5, JOB_LIMIT_PER_DAY=15,
   * api_server/src/main.rs). The frontend cannot read the server's values
   * (backend gap G4); after a 429, Retry-After wins over these.
   */
  renderLimits: { perHour: number; perDay: number }
}

export const EARLY_ACCESS: Entitlements = {
  plan: 'free',
  watermark: 'default-on',
  maxExportHeight: 1920,
  customFonts: true,
  renderLimits: { perHour: 5, perDay: 15 },
}

export function getEntitlements(_user: User | null): Entitlements {
  // Billing is not live: everyone is on Free during early access (plan 14.1).
  return EARLY_ACCESS
}

export function quotaLine(e: Entitlements = EARLY_ACCESS): string {
  return `Up to ${e.renderLimits.perHour} renders an hour and ${e.renderLimits.perDay} a day during early access.`
}

/** Where remix links point (D2). A real domain replaces the origin at launch. */
export const SITE_URL: string =
  (import.meta.env.VITE_SITE_URL as string | undefined) ??
  (typeof window === 'undefined' ? 'https://animato.app' : window.location.origin)
