// Client-side knowledge about the render pipeline. The server only reports
// the current status; everything here (stage copy, typical durations, the
// ETA) is derived in the browser and labelled as such in the UI.
import type { JobStatus, Library } from '@/lib/api/types'

export const PIPELINE: JobStatus[] = ['Pending', 'GeneratingCode', 'Rendering', 'Uploading', 'Completed']

export const SHORT_LABEL: Record<JobStatus, string> = {
  Pending: 'Queued',
  GeneratingCode: 'Planning',
  Rendering: 'Rendering',
  Uploading: 'Encoding',
  Completed: 'Ready',
  Failed: 'Failed',
}

/** Typical seconds spent in each running stage. Rough, used only for the estimate. */
export const TYPICAL_SECONDS: Partial<Record<JobStatus, number>> = {
  Pending: 6,
  GeneratingCode: 22,
  Rendering: 45,
  Uploading: 6,
}

const ENGINE: Record<Library, string> = { manim: 'Manim', remotion: 'Remotion' }

export function feedText(status: JobStatus, library: Library): string {
  switch (status) {
    case 'Pending':
      return 'Queued — waiting for a worker'
    case 'GeneratingCode':
      return `Planning scenes — writing the ${ENGINE[library]} script`
    case 'Rendering':
      return library === 'manim'
        ? 'Rendering — Manim is drawing the frames'
        : 'Rendering — Remotion is rendering the composition'
    case 'Uploading':
      return 'Encoding — uploading the finished video'
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

/**
 * Seconds left, from the time already spent in the current stage and the
 * typical length of the stages after it. Stages watched end to end in this
 * session rescale the typical numbers (a fast queue suggests a fast render).
 */
export function estimateRemaining(observed: Observation[], now: number): number | null {
  const last = observed[observed.length - 1]
  if (!last || last.status === 'Completed' || last.status === 'Failed') return null
  const index = PIPELINE.indexOf(last.status)
  if (index < 0) return null

  let watched = 0
  let typical = 0
  for (let i = 0; i < observed.length - 1; i++) {
    const t = TYPICAL_SECONDS[observed[i].status]
    // Only a stage seen from its start counts; the first one may have been joined midway.
    if (t && i > 0) {
      watched += (observed[i + 1].at - observed[i].at) / 1000
      typical += t
    }
  }
  const scale = typical > 0 ? Math.min(3, Math.max(0.1, watched / typical)) : 1

  const inStage = (now - last.at) / 1000
  const current = (TYPICAL_SECONDS[last.status] ?? 0) * scale
  let remaining = Math.max(current - inStage, current * 0.15)
  for (let i = index + 1; i < PIPELINE.length; i++) remaining += (TYPICAL_SECONDS[PIPELINE[i]] ?? 0) * scale
  return Math.max(1, Math.round(remaining))
}

export function formatEta(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s ? `${m}m ${s}s` : `${m}m`
}
