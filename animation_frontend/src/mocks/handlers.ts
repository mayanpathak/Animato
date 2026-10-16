// MSW handlers for the real API surface only: /api/auth/* and /api/jobs/*.
// Messages, status codes and body shapes copy api_server/src/controller.
import { http, HttpResponse } from 'msw'
import { DEMO_USER, jobStatus, load, renderFor, RENDER_FACTS, save, type MockUser } from './state'

/** The code every mock verification email "contains". */
export const MOCK_VERIFY_CODE = '123456'

const json = (status: number, body: Record<string, unknown>, headers?: Record<string, string>) =>
  HttpResponse.json(body, { status, headers })
const fail = (status: number, message: string) => json(status, { success: false, message })

const userBody = (u: MockUser, full = false) => ({
  email: u.email,
  username: u.username,
  is_verified: u.is_verified,
  ...(full ? { last_login: u.last_login, created_at: u.created_at } : {}),
})

async function body(request: Request): Promise<Record<string, unknown>> {
  try {
    const b = await request.json()
    return b && typeof b === 'object' ? (b as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

const str = (v: unknown) => (typeof v === 'string' ? v : '')
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function sessionUser() {
  const state = load()
  const user = state.users.find((u) => u.email === state.session) ?? null
  return { state, user }
}

export const handlers = [
  http.post('/api/auth/signup', async ({ request }) => {
    const b = await body(request)
    const username = str(b.username).trim()
    const email = str(b.email).trim().toLowerCase()
    const password = str(b.password)
    if ([...username].length < 3 || [...username].length > 30)
      return fail(400, 'Username must be between 3 and 30 characters')
    if (!EMAIL.test(email)) return fail(400, 'Please enter a valid email address')
    if ([...password].length < 8 || [...password].length > 72)
      return fail(400, 'Password must be between 8 and 72 characters')
    const state = load()
    if (state.users.some((u) => u.email === email)) return fail(409, 'User already exists')
    const user: MockUser = {
      email,
      username,
      password,
      is_verified: false,
      created_at: new Date().toISOString(),
      last_login: new Date().toISOString(),
    }
    state.users.push(user)
    state.session = email
    save(state)
    return json(201, { success: true, message: 'User created successfully', user: userBody(user) })
  }),

  http.post('/api/auth/login', async ({ request }) => {
    const b = await body(request)
    const email = str(b.email).trim().toLowerCase()
    const password = str(b.password)
    if (!email || !password) return fail(400, 'Email and password are required')
    const state = load()
    const user = state.users.find((u) => u.email === email)
    if (!user || user.password !== password) return fail(401, 'Invalid credentials')
    user.last_login = new Date().toISOString()
    state.session = email
    save(state)
    return json(200, { success: true, message: 'Logged in successfully', user: userBody(user) })
  }),

  http.post('/api/auth/logout', () => {
    const state = load()
    state.session = null
    save(state)
    return json(200, { success: true, message: 'Logged out successfully' })
  }),

  http.get('/api/auth/check-auth', () => {
    const { user } = sessionUser()
    if (!user) return fail(401, 'Unauthorized - no token provided')
    return json(200, { success: true, user: userBody(user, true) })
  }),

  http.post('/api/auth/verify-email', async ({ request }) => {
    const { state, user } = sessionUser()
    if (!user) return fail(401, 'Unauthorized - no token provided')
    const code = str((await body(request)).code)
    if (code !== MOCK_VERIFY_CODE) return fail(400, 'Invalid or expired verification code')
    user.is_verified = true
    save(state)
    return json(200, { success: true, message: 'Email verified successfully', user: userBody(user) })
  }),

  http.post('/api/auth/resend-verification', () => {
    const { user } = sessionUser()
    if (!user) return fail(401, 'Unauthorized - no token provided')
    return json(200, { success: true, message: 'Verification code sent' })
  }),

  http.post('/api/auth/forgot-password', async ({ request }) => {
    const email = str((await body(request)).email).trim()
    if (!EMAIL.test(email)) return fail(400, 'Please enter a valid email address')
    return json(200, {
      success: true,
      message: 'If an account exists for that email, you will receive a reset link shortly',
    })
  }),

  http.post('/api/auth/reset-password/:token', async ({ request, params }) => {
    const password = str((await body(request)).password)
    if (!/^[0-9a-f]{40}$/.test(String(params.token))) return fail(400, 'Invalid or expired reset token')
    if ([...password].length < 8 || [...password].length > 72)
      return fail(400, 'Password must be between 8 and 72 characters')
    // The mock cannot know which account a link belongs to; the demo account takes it.
    const state = load()
    const demo = state.users.find((u) => u.email === DEMO_USER.email)
    if (demo) demo.password = password
    save(state)
    return json(200, { success: true, message: 'Password reset successful' })
  }),

  http.post('/api/jobs', async ({ request }) => {
    const { state, user } = sessionUser()
    if (!user) return fail(401, 'Unauthorized - no token provided')
    if (!user.is_verified) return fail(403, 'Please verify your email first')
    const b = await body(request)
    const prompt = str(b.prompt)
    const library = b.library === 'manim' ? 'manim' : 'remotion'
    const len = [...prompt].length
    if (len < 10 || len > 2000) return fail(400, 'Prompt must be between 10 and 2000 characters')
    // Same quota as the server: 5 per hour and 15 per day per user.
    const mine = state.jobs.filter((j) => j.owner === user.email)
    const lastHour = mine.filter((j) => j.created_at > Date.now() - 3_600_000)
    const lastDay = mine.filter((j) => j.created_at > Date.now() - 86_400_000)
    if (lastHour.length >= 5 || lastDay.length >= 15) {
      const oldest = (lastHour.length >= 5 ? lastHour : lastDay)[0].created_at
      const window = lastHour.length >= 5 ? 3_600_000 : 86_400_000
      const retry = Math.max(1, Math.ceil((oldest + window - Date.now()) / 1000))
      return json(
        429,
        { success: false, message: 'Too many requests, try again later' },
        { 'Retry-After': String(retry) },
      )
    }
    const job_id = crypto.randomUUID()
    state.jobs.push({
      job_id,
      owner: user.email,
      prompt,
      library,
      created_at: Date.now(),
      fail: /\bfail\b/i.test(prompt),
    })
    save(state)
    return json(200, {
      success: true,
      message: 'Render job created successfully',
      data: { job_id, library, status: 'Pending' },
    })
  }),

  http.get('/api/jobs/:id', ({ params }) => {
    const { state, user } = sessionUser()
    if (!user) return fail(401, 'Unauthorized - no token provided')
    if (!user.is_verified) return fail(403, 'Please verify your email first')
    const id = String(params.id)
    if (!UUID.test(id)) return fail(400, 'Invalid job id')
    const job = state.jobs.find((j) => j.job_id === id && j.owner === user.email)
    if (!job) return fail(404, 'Render job not found')
    const status = jobStatus(job)
    const render = renderFor(job)
    const done = status === 'Completed'
    return json(200, {
      success: true,
      data: {
        job_id: job.job_id,
        library: job.library,
        status,
        video_path: done ? `renders/${job.job_id}.mp4` : null,
        duration_seconds: done ? RENDER_FACTS[render].duration : null,
        file_size_bytes: done ? RENDER_FACTS[render].size : null,
        render_time_ms: done ? 11_200 + (job.prompt.length % 7) * 830 : null,
        error_message:
          status === 'Failed'
            ? 'Renderer exited with code 1: scene "Intro" raised ValueError: invalid color "fail"'
            : null,
      },
    })
  }),

  // The real endpoint answers 302 to a presigned S3 URL. Here the redirect
  // goes to a real VP9/Opus WebM in public/media/renders.
  http.get('/api/jobs/:id/video', ({ params }) => {
    const { state, user } = sessionUser()
    if (!user) return fail(401, 'Unauthorized - no token provided')
    const job = state.jobs.find((j) => j.job_id === String(params.id) && j.owner === user.email)
    if (!job || jobStatus(job) !== 'Completed') return fail(404, 'Video not available')
    return new HttpResponse(null, {
      status: 302,
      headers: { Location: `/media/renders/${renderFor(job)}.webm`, 'Cache-Control': 'no-store' },
    })
  }),
]
