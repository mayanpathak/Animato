import { describe, expect, it } from 'vitest'
import { ApiError } from './http'
import {
  classifyGetJobError,
  failureCause,
  mapCreateJobError,
  quotaText,
  SEND_FAILED_TEXT,
  SERVER_ERROR_TEXT,
  technicalDetails,
  UNREACHABLE_TEXT,
} from './errors'

describe('mapCreateJobError (plan 11.4)', () => {
  it('maps every create-job row', () => {
    expect(mapCreateJobError(new ApiError(0, 'x'))).toMatchObject({
      message: UNREACHABLE_TEXT,
      action: 'retry',
    })
    expect(mapCreateJobError(new ApiError(500, 'Internal server error')).message).toBe(SERVER_ERROR_TEXT)
    expect(mapCreateJobError(new ApiError(401, 'Unauthorized')).action).toBe('login')
    expect(mapCreateJobError(new ApiError(403, 'Please verify your email first')).action).toBe('verify')
    const p = mapCreateJobError(new ApiError(400, 'Prompt must be between 10 and 2000 characters'))
    expect(p.message).toBe('Prompt must be between 10 and 2000 characters')
    expect(mapCreateJobError(new ApiError(422, 'Invalid request body')).message).toBe(SEND_FAILED_TEXT)
  })

  it('uses Retry-After for the quota', () => {
    const m = mapCreateJobError(new ApiError(429, 'Too many requests', 1380))
    expect(m).toMatchObject({ action: 'wait', retryAfter: 1380 })
    expect(m.message).toBe("You've reached the render limit. Next render in 23 min.")
    expect(quotaText(null)).toContain('Try again later')
  })

  it('treats a non-ApiError as unreachable', () => {
    expect(mapCreateJobError(new TypeError('fetch failed')).message).toBe(UNREACHABLE_TEXT)
  })
})

describe('classifyGetJobError', () => {
  it('maps statuses', () => {
    expect(classifyGetJobError(new ApiError(404, 'Render job not found'))).toBe('gone')
    expect(classifyGetJobError(new ApiError(400, 'Invalid job id'))).toBe('gone')
    expect(classifyGetJobError(new ApiError(0, ''))).toBe('unreachable')
    expect(classifyGetJobError(new ApiError(403, ''))).toBe('auth')
    expect(classifyGetJobError(new ApiError(502, ''))).toBe('server')
  })
})

describe('failureCause', () => {
  it('matches keywords case-insensitively and never echoes the raw text', () => {
    expect(failureCause('Render TIMEOUT after 300s')).toMatch(/too long/)
    expect(failureCause('SyntaxError: Unexpected token')).toMatch(/couldn't fix/)
    expect(failureCause('Validation failed: scene missing')).toMatch(/couldn't fix/)
    expect(failureCause('docker: exit status 137')).toBe(
      'The renderer hit an error. Trying again usually works.',
    )
    expect(failureCause(null)).toMatch(/Trying again/)
  })
})

describe('technicalDetails', () => {
  it('truncates to 600 characters and strips control characters', () => {
    const long = 'e'.repeat(700)
    expect(technicalDetails(long)).toHaveLength(601)
    expect(technicalDetails('a\u0007b\nc')).toBe('ab\nc')
    expect(technicalDetails('')).toBeNull()
    expect(technicalDetails(null)).toBeNull()
  })
})
