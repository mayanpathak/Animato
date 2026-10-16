// Constants shared by the API layer, the mocks and the UI.

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

export const STATUS_LABELS: Record<JobStatus, string> = {
  Pending: 'Queued',
  GeneratingCode: 'Writing',
  Rendering: 'Rendering',
  Uploading: 'Finishing',
  Completed: 'Ready',
  Failed: 'Failed',
}

export type StatusTone = 'queued' | 'planning' | 'rendering' | 'succeeded' | 'failed'

export const STATUS_TONE: Record<JobStatus, StatusTone> = {
  Pending: 'queued',
  GeneratingCode: 'planning',
  Rendering: 'rendering',
  Uploading: 'rendering',
  Completed: 'succeeded',
  Failed: 'failed',
}

export function isFinished(status: JobStatus): boolean {
  return status === 'Completed' || status === 'Failed'
}

export const ASPECTS = ['16:9', '9:16', '1:1'] as const
export type Aspect = (typeof ASPECTS)[number]

export const RESOLUTIONS = ['720p', '1080p', '1440p', '4K'] as const
export type Resolution = (typeof RESOLUTIONS)[number]

export const STYLES = ['Minimal', 'Cinematic', 'Playful', 'Technical', 'Editorial'] as const
export type VisualStyle = (typeof STYLES)[number]

export type Engine = Library | 'auto'
