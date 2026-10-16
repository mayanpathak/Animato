// Client-side copy for the render pipeline. The server only reports the
// current status, and no progress or ETA, so none is invented here.
import type { JobStatus, Library } from '@/lib/api/types'

export const PIPELINE: JobStatus[] = ['Pending', 'GeneratingCode', 'Rendering', 'Uploading', 'Completed']

export const SHORT_LABEL: Record<JobStatus, string> = {
  Pending: 'Queued',
  GeneratingCode: 'Writing',
  Rendering: 'Rendering',
  Uploading: 'Finishing',
  Completed: 'Ready',
  Failed: 'Failed',
}

const ENGINE: Record<Library, string> = { manim: 'Manim', remotion: 'Remotion' }

export function feedText(status: JobStatus, library: Library): string {
  switch (status) {
    case 'Pending':
      return 'Queued — waiting for a worker'
    case 'GeneratingCode':
      return `Writing the animation — the ${ENGINE[library]} script`
    case 'Rendering':
      return library === 'manim'
        ? 'Rendering — Manim is drawing the frames'
        : 'Rendering — Remotion is rendering the composition'
    case 'Uploading':
      return 'Finishing — saving your video'
    case 'Completed':
      return 'Ready — the video is available'
    case 'Failed':
      return 'Failed — the worker reported an error'
  }
}

export interface Observation {
  status: JobStatus
  /** ms since the feed's origin */
  at: number
}

export function formatEta(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s ? `${m}m ${s}s` : `${m}m`
}
