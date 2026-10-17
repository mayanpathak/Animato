// Wire shapes of the real API (api_server/src/controller/*), validated with
// zod. zod/mini keeps the validation and leaves most of zod out of the
// initial bundle (plan 15.1). Field names stay snake_case here and are mapped
// to app types in auth.ts/jobs.ts.
import * as z from 'zod/mini'
import { JOB_STATUSES, LIBRARIES } from './types'

export const envelope = z.object({ success: z.literal(true), message: z.optional(z.string()) })

export const wireUser = z.object({
  email: z.string(),
  username: z.string(),
  is_verified: z.boolean(),
  last_login: z.nullish(z.string()),
  created_at: z.nullish(z.string()),
})

export const userResponse = z.extend(envelope, { user: wireUser })

export const createJobResponse = z.extend(envelope, {
  data: z.object({
    job_id: z.uuid(),
    library: z.enum(LIBRARIES),
    status: z.enum(JOB_STATUSES),
  }),
})

export const jobResponse = z.extend(envelope, {
  data: z.object({
    job_id: z.uuid(),
    library: z.enum(LIBRARIES),
    status: z.enum(JOB_STATUSES),
    video_path: z.nullable(z.string()),
    duration_seconds: z.nullable(z.number()),
    file_size_bytes: z.nullable(z.number()),
    render_time_ms: z.nullable(z.number()),
    error_message: z.nullable(z.string()),
  }),
})
