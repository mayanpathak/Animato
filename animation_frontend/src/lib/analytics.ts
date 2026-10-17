// Measurement seam (plan 12.5). No third-party scripts: events go to an
// in-memory ring buffer (and console.debug in development). A backend
// ingestion endpoint is gap G7. Never put prompt text or an email in props.
export type AnalyticsEvent =
  | 'landing_prompt_submit'
  | 'signup_complete'
  | 'verify_complete'
  | 'job_create'
  | 'job_complete'
  | 'job_fail'
  | 'finish_open'
  | 'format_change'
  | 'look_change'
  | 'voice_record'
  | 'captions_generated'
  | 'export_start'
  | 'export_complete'
  | 'remix_link_copy'
  | 'remix_link_open'

export interface TrackedEvent {
  event: AnalyticsEvent
  at: number
  props: Record<string, string | number | boolean>
}

const SIZE = 200
const buffer: TrackedEvent[] = []

export function track(event: AnalyticsEvent, props: Record<string, string | number | boolean> = {}): void {
  const entry = { event, at: Date.now(), props }
  buffer.push(entry)
  if (buffer.length > SIZE) buffer.shift()
  if (import.meta.env.DEV) console.debug('[analytics]', event, props)
}

/** A copy of the buffer, newest last (tests and a future uploader). */
export function trackedEvents(): TrackedEvent[] {
  return [...buffer]
}
