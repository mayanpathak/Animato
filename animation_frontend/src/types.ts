export interface User {
  email: string
  username: string
  isVerified: boolean
}

export const LIBRARIES = ['remotion', 'manim'] as const
export type Library = (typeof LIBRARIES)[number]

// Exactly the strings the API serialises for a job's status.
export const JOB_STATUSES = [
  'Pending',
  'GeneratingCode',
  'Rendering',
  'Uploading',
  'Completed',
  'Failed',
] as const
export type JobStatus = (typeof JOB_STATUSES)[number]

export interface Job {
  jobId: string
  prompt: string
  library: Library
  status: JobStatus
  createdAt: number
  errorMessage: string | null
  // The player could not load the file (not served yet, or cleaned up).
  videoMissing: boolean
}

export function isLibrary(value: unknown): value is Library {
  return LIBRARIES.includes(value as Library)
}

export function isJobStatus(value: unknown): value is JobStatus {
  return JOB_STATUSES.includes(value as JobStatus)
}

export function isFinished(status: JobStatus): boolean {
  return status === 'Completed' || status === 'Failed'
}

export const STATUS_LABELS: Record<JobStatus, string> = {
  Pending: 'Queued',
  GeneratingCode: 'Writing the animation code',
  Rendering: 'Rendering the video',
  Uploading: 'Finishing up',
  Completed: 'Ready',
  Failed: 'Failed',
}
