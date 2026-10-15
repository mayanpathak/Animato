import { request, videoUrl } from './http'
import { createJobResponse, jobResponse } from './schemas'
import type { JobStatus, Library } from './types'

export interface Job {
  id: string
  library: Library
  status: JobStatus
  durationSeconds: number | null
  fileSizeBytes: number | null
  renderTimeMs: number | null
  errorMessage: string | null
  hasVideo: boolean
}

export const jobsApi = {
  /** POST /api/jobs — the only way the app creates server work. */
  create: async (prompt: string, library: Library) => {
    const res = await request(createJobResponse, 'POST', '/jobs', { prompt, library })
    return { id: res.data.job_id, library: res.data.library, status: res.data.status }
  },

  /** GET /api/jobs/:id — polled while a job runs (no rate limit). */
  get: async (id: string): Promise<Job> => {
    const { data } = await request(jobResponse, 'GET', `/jobs/${encodeURIComponent(id)}`)
    return {
      id: data.job_id,
      library: data.library,
      status: data.status,
      durationSeconds: data.duration_seconds,
      fileSizeBytes: data.file_size_bytes,
      renderTimeMs: data.render_time_ms,
      errorMessage: data.error_message ? data.error_message.slice(0, 600) : null,
      hasVideo: data.status === 'Completed' && data.video_path !== null,
    }
  },

  /** GET /api/jobs/:id/video answers 302 to a presigned URL; media elements follow it. */
  videoUrl,
}
