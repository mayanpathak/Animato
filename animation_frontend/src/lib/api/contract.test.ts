// Contract fixtures: literal JSON bodies the Rust handlers produce, checked
// against the zod schemas and the `request` error handling. Each fixture names
// the file and function it was copied from. Re-check them whenever api_server
// changes (plan 11.2).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, request } from './http'
import { createJobResponse, envelope, jobResponse, userResponse } from './schemas'

const JOB_ID = '3f2b9c1e-8a4d-4f6b-9c2e-1d7a5b3e9f10'

describe('auth fixtures parse', () => {
  it('signup 201 (authcontroller.rs signup; user_object without dates)', () => {
    const body = {
      success: true,
      message: 'User created successfully',
      user: { email: 'ada@example.com', username: 'ada', is_verified: false },
    }
    expect(userResponse.parse(body).user.is_verified).toBe(false)
  })

  it('login 200 (authcontroller.rs login)', () => {
    const body = {
      success: true,
      message: 'Logged in successfully',
      user: { email: 'ada@example.com', username: 'ada', is_verified: true },
    }
    expect(userResponse.parse(body).user.username).toBe('ada')
  })

  it('verify-email 200, also when already verified (authcontroller.rs verify_email)', () => {
    for (const message of ['Email verified successfully', 'Email already verified']) {
      const body = { success: true, message, user: { email: 'a@b.co', username: 'ada', is_verified: true } }
      expect(userResponse.parse(body).user.is_verified).toBe(true)
    }
  })

  it('resend-verification 200 has no user (authcontroller.rs resend_verification)', () => {
    expect(envelope.parse({ success: true, message: 'Verification code sent' }).success).toBe(true)
    expect(envelope.parse({ success: true, message: 'Email already verified' }).success).toBe(true)
    expect(userResponse.safeParse({ success: true, message: 'Email already verified' }).success).toBe(false)
  })

  it('check-auth 200 adds last_login and created_at (authcontroller.rs check_auth; chrono RFC 3339)', () => {
    const body = {
      success: true,
      user: {
        email: 'ada@example.com',
        username: 'ada',
        is_verified: true,
        last_login: '2026-10-16T09:12:44.123456789Z',
        created_at: '2026-10-01T18:03:10.5Z',
      },
    }
    const user = userResponse.parse(body).user
    expect(user.created_at).toBe('2026-10-01T18:03:10.5Z')
  })

  it('logout, forgot-password, reset-password 200 (authcontroller.rs)', () => {
    for (const message of [
      'Logged out successfully',
      'If an account exists for that email, a reset link has been sent',
      'Password reset successful',
    ])
      expect(envelope.parse({ success: true, message }).message).toBe(message)
  })
})

describe('job fixtures parse', () => {
  it('POST /api/jobs 200 (jobcontroller.rs create_render_job_handler)', () => {
    const body = {
      success: true,
      message: 'Render job created successfully',
      data: { job_id: JOB_ID, library: 'manim', status: 'Pending' },
    }
    expect(createJobResponse.parse(body).data.library).toBe('manim')
  })

  it('GET /api/jobs/:id 200 while rendering: result fields are null (jobcontroller.rs get_job_handler)', () => {
    const body = {
      success: true,
      data: {
        job_id: JOB_ID,
        library: 'remotion',
        status: 'GeneratingCode',
        video_path: null,
        duration_seconds: null,
        file_size_bytes: null,
        render_time_ms: null,
        error_message: null,
      },
    }
    expect(jobResponse.parse(body).data.status).toBe('GeneratingCode')
  })

  it('GET /api/jobs/:id 200 completed (RenderResult: f32 seconds, u64 bytes and ms)', () => {
    const body = {
      success: true,
      data: {
        job_id: JOB_ID,
        library: 'remotion',
        status: 'Completed',
        video_path: `renders/${JOB_ID}.mp4`,
        duration_seconds: 15.0,
        file_size_bytes: 1834201,
        render_time_ms: 48213,
        error_message: null,
      },
    }
    expect(jobResponse.parse(body).data.render_time_ms).toBe(48213)
  })

  it('GET /api/jobs/:id 200 failed carries raw error_message', () => {
    const body = {
      success: true,
      data: {
        job_id: JOB_ID,
        library: 'manim',
        status: 'Failed',
        video_path: null,
        duration_seconds: null,
        file_size_bytes: null,
        render_time_ms: null,
        error_message: 'Render timeout after 300s',
      },
    }
    expect(jobResponse.parse(body).data.error_message).toContain('timeout')
  })

  it('rejects statuses and libraries the server never sends', () => {
    const data = {
      job_id: JOB_ID,
      library: 'Manim',
      status: 'Pending',
      video_path: null,
      duration_seconds: null,
      file_size_bytes: null,
      render_time_ms: null,
      error_message: null,
    }
    expect(jobResponse.safeParse({ success: true, data }).success).toBe(false)
    expect(
      jobResponse.safeParse({ success: true, data: { ...data, library: 'manim', status: 'pending' } })
        .success,
    ).toBe(false)
  })
})

describe('request() error envelope', () => {
  afterEach(() => vi.unstubAllGlobals())

  function answer(status: number, body: unknown, headers: Record<string, string> = {}) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(body), { status, headers })),
    )
  }

  async function failure(): Promise<ApiError> {
    try {
      await request(envelope, 'POST', '/jobs', {})
    } catch (e) {
      return e as ApiError
    }
    throw new Error('expected a failure')
  }

  it('400 validation message (jobcontroller.rs)', async () => {
    answer(400, { success: false, message: 'Prompt must be between 10 and 2000 characters' })
    const e = await failure()
    expect(e.status).toBe(400)
    expect(e.message).toBe('Prompt must be between 10 and 2000 characters')
  })

  it('422 axum rejection "Invalid request body" is a plain 4xx', async () => {
    answer(422, { success: false, message: 'Invalid request body' })
    expect((await failure()).status).toBe(422)
  })

  it('403 unverified (verifiedmiddleware.rs)', async () => {
    answer(403, { success: false, message: 'Please verify your email first' })
    expect((await failure()).status).toBe(403)
  })

  it('429 reads Retry-After seconds (ratelimit.rs too_many_requests)', async () => {
    answer(429, { success: false, message: 'Too many requests, try again later' }, { 'Retry-After': '1380' })
    const e = await failure()
    expect(e.status).toBe(429)
    expect(e.retryAfter).toBe(1380)
  })

  it('a non-JSON answer (proxy with the server down) is status 0', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<html>Bad gateway</html>', { status: 502 })),
    )
    expect((await failure()).status).toBe(0)
  })
})
