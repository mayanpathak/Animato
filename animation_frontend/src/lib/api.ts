// The only place in the app that calls fetch.
//
// Calls are always same-origin (/api is proxied by Vite in development and
// served by the API server itself in production), so the HttpOnly session
// cookie travels with them and is never sent anywhere else. This code never
// reads, stores or forwards the token.

export interface ApiResult<T = unknown> {
  ok: boolean
  // HTTP status, or 0 when there was no usable response.
  status: number
  // Always something that can be shown to the user when `ok` is false.
  message: string
  data: T | null
  // Seconds, from the Retry-After header of a 429.
  retryAfter: number | null
}

const TIMEOUT_MS = 15_000

const UNREACHABLE = 'Could not reach the server. Check your connection and try again.'
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

export async function api<T = unknown>(
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (body !== undefined) headers['Content-Type'] = 'application/json'

    const res = await fetch(`/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
      cache: 'no-store',
      signal: controller.signal,
    })

    let json: unknown = null
    try {
      json = await res.json()
    } catch {
      json = null
    }

    // Not our API's shape: the dev proxy answering while the server is down,
    // or an HTML error page.
    if (!isRecord(json)) {
      return { ok: false, status: 0, message: UNREACHABLE, data: null, retryAfter: null }
    }

    const ok = res.ok && json.success === true

    let retryAfter: number | null = null
    if (res.status === 429) {
      const seconds = Number(res.headers.get('Retry-After'))
      if (Number.isFinite(seconds) && seconds > 0) retryAfter = seconds
    }

    let message = typeof json.message === 'string' ? json.message : ''
    if (!ok && message === '') message = UNEXPECTED
    if (retryAfter !== null) message = `${message} (wait ${formatWait(retryAfter)})`

    return { ok, status: res.status, message, data: json as T, retryAfter }
  } catch {
    // Network failure or timeout.
    return { ok: false, status: 0, message: UNREACHABLE, data: null, retryAfter: null }
  } finally {
    clearTimeout(timer)
  }
}
