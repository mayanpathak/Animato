// What the user sees for each failure (plan 11.4). Pure functions: the screens
// decide where to show the text and which action to offer.
import { ApiError, formatWait } from './http'

export const UNREACHABLE_TEXT = "Can't reach Animato's server."
export const SERVER_ERROR_TEXT = 'Something went wrong on our side. Please try again.'
export const SEND_FAILED_TEXT = "We couldn't send that. Please refresh and try again."
export const RENDER_GONE_TEXT = 'This render is no longer available.'
export const RENDER_EXPIRED_TEXT = 'This render has expired.'
export const IMPORT_FAILED_TEXT = "Couldn't load the video for finishing."
export const FAILED_TITLE = "That one didn't render."

/** Next step a screen should take for a failed create-job call. */
export type CreateAction = 'retry' | 'login' | 'verify' | 'wait' | 'none'

export interface MappedError {
  message: string
  action: CreateAction
  /** Seconds until the next render is allowed (429 only). */
  retryAfter: number | null
}

export function quotaText(seconds: number | null): string {
  return seconds && seconds > 0
    ? `You've reached the render limit. Next render in ${formatWait(seconds)}.`
    : "You've reached the render limit. Try again later."
}

function statusOf(err: unknown): number {
  return err instanceof ApiError ? err.status : 0
}

/** POST /api/jobs failures. */
export function mapCreateJobError(err: unknown): MappedError {
  const status = statusOf(err)
  const none = { retryAfter: null }
  if (status === 0) return { message: UNREACHABLE_TEXT, action: 'retry', ...none }
  if (status === 401)
    return { message: 'Your session ended. Log in again to continue.', action: 'login', ...none }
  if (status === 403) return { message: 'Verify your email to start rendering.', action: 'verify', ...none }
  if (status === 429) {
    const retryAfter = err instanceof ApiError ? err.retryAfter : null
    return { message: quotaText(retryAfter), action: 'wait', retryAfter }
  }
  if (status >= 500) return { message: SERVER_ERROR_TEXT, action: 'retry', ...none }
  // The server's own text for the prompt-length rule; anything else (axum
  // rejections such as "Invalid request body") gets the generic line.
  if (status === 400 && err instanceof ApiError && /prompt/i.test(err.message))
    return { message: err.message, action: 'none', ...none }
  return { message: SEND_FAILED_TEXT, action: 'none', ...none }
}

export type JobLoadState = 'gone' | 'unreachable' | 'server' | 'auth' | 'other'

/** GET /api/jobs/:id failures. */
export function classifyGetJobError(err: unknown): JobLoadState {
  const status = statusOf(err)
  if (status === 404 || status === 400) return 'gone'
  if (status === 0) return 'unreachable'
  if (status === 401 || status === 403) return 'auth'
  if (status >= 500) return 'server'
  return 'other'
}

/**
 * One plain sentence for a worker failure, from a keyword match on the raw
 * `error_message`. The raw text itself is never shown here.
 */
export function failureCause(raw: string | null | undefined): string {
  const text = (raw ?? '').toLowerCase()
  if (/timeout|timed out/.test(text))
    return 'The animation took too long to render. Try a shorter or simpler idea.'
  if (/syntax|compile|validation/.test(text))
    return "The generated animation had an error we couldn't fix automatically. Try rephrasing."
  return 'The renderer hit an error. Trying again usually works.'
}

export const TECHNICAL_DETAILS_MAX = 600

/** Raw worker output for the "Technical details" disclosure: plain text, truncated. */
export function technicalDetails(raw: string | null | undefined): string | null {
  if (!raw) return null
  // Strip control characters other than newline and tab; never rendered as HTML.
  // eslint-disable-next-line no-control-regex
  const clean = raw.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '').trim()
  if (!clean) return null
  return clean.length > TECHNICAL_DETAILS_MAX ? `${clean.slice(0, TECHNICAL_DETAILS_MAX)}…` : clean
}
