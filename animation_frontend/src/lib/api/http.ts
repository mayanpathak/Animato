// The only place in the app that calls fetch.
//
// Calls are always same-origin (/api is proxied by Vite in development and
// served by the API server itself in production), so the HttpOnly session
// cookie travels with them and is never sent anywhere else. This code never
// reads, stores or forwards the token. With VITE_USE_MOCKS=true the same
// requests are answered in the browser by MSW (src/mocks); nothing here changes.
import type { z } from 'zod'

export type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

const TIMEOUT_MS = 15_000

export const UNREACHABLE = 'Could not reach the server. Check your connection and try again.'
const UNEXPECTED = 'Something went wrong. Please try again.'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isJobId(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value)
}

export function formatWait(seconds: number): string {
  if (seconds < 60) return `${Math.max(1, Math.ceil(seconds))}s`
  if (seconds < 3600) return `${Math.ceil(seconds / 60)} min`
  return `${Math.ceil(seconds / 3600)} h`
}

// Built from the job id only, never from a path the server sent back.
export function videoUrl(jobId: string): string {
  return `/api/jobs/${encodeURIComponent(jobId)}/video`
}

/** A failed call. `status` is 0 when there was no usable response. */
export class ApiError extends Error {
  readonly status: number
  readonly retryAfter: number | null

  constructor(status: number, message: string, retryAfter: number | null = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.retryAfter = retryAfter
  }
}

/** Fired on any 401 so the session store can log the UI out. */
export const SESSION_LOST_EVENT = 'animato:session-lost'

/**
 * Calls the API and validates the JSON body against `schema`. Throws
 * `ApiError` for network failures, non-2xx answers, `success: false`, and
 * bodies that do not match the schema.
 */
export async function request<S extends z.ZodType>(
  schema: S,
  method: Method,
  path: string,
  body?: unknown,
): Promise<z.infer<S>> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  let res: Response
  let json: unknown = null
  try {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    res = await fetch(`/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
      cache: 'no-store',
      signal: controller.signal,
    })
    try {
      json = await res.json()
    } catch {
      json = null
    }
  } catch {
    throw new ApiError(0, UNREACHABLE)
  } finally {
    clearTimeout(timer)
  }

  // Not our API's shape: the dev proxy answering while the server is down,
  // or an HTML error page.
  if (!isRecord(json)) throw new ApiError(0, UNREACHABLE)

  let retryAfter: number | null = null
  if (res.status === 429) {
    const seconds = Number(res.headers.get('Retry-After'))
    if (Number.isFinite(seconds) && seconds > 0) retryAfter = seconds
  }

  if (!res.ok || json.success !== true) {
    if (res.status === 401 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(SESSION_LOST_EVENT, { detail: path }))
    }
    let message = typeof json.message === 'string' && json.message !== '' ? json.message : UNEXPECTED
    if (retryAfter !== null) message = `${message} (wait ${formatWait(retryAfter)})`
    throw new ApiError(res.status, message, retryAfter)
  }

  const parsed = schema.safeParse(json)
  if (!parsed.success) {
    throw new ApiError(res.status, 'The server sent a response this app does not understand.')
  }
  return parsed.data
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  return UNEXPECTED
}
