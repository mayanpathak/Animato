// Wire shapes of the real API (api_server/src/controller/*), validated with zod.
// Field names stay snake_case here and are mapped to app types in auth.ts/jobs.ts.
import { z } from 'zod'
import { JOB_STATUSES, LIBRARIES } from './types'

export const envelope = z.object({ success: z.literal(true), message: z.string().optional() })

export const wireUser = z.object({
  email: z.string(),
  username: z.string(),
  is_verified: z.boolean(),
  last_login: z.string().nullish(),
  created_at: z.string().nullish(),
})

export const userResponse = envelope.extend({ user: wireUser })

export const createJobResponse = envelope.extend({
  data: z.object({
    job_id: z.string().uuid(),
    library: z.enum(LIBRARIES),
    status: z.enum(JOB_STATUSES),
  }),
})

export const jobResponse = envelope.extend({
  data: z.object({
    job_id: z.string().uuid(),
    library: z.enum(LIBRARIES),
    status: z.enum(JOB_STATUSES),
    video_path: z.string().nullable(),
    duration_seconds: z.number().nullable(),
    file_size_bytes: z.number().nullable(),
    render_time_ms: z.number().nullable(),
    error_message: z.string().nullable(),
  }),
})
