// Pure helpers for the render view (plan 6.5), unit-tested.
import type { Observed } from '@/lib/api/polling'
import type { Library } from '@/lib/api/types'

export type StageId = 'Pending' | 'GeneratingCode' | 'Rendering' | 'Uploading'
export const STAGES: StageId[] = ['Pending', 'GeneratingCode', 'Rendering', 'Uploading']

export function formatClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** When each stage was first reached, and when it ended, from observed statuses. */
export function stageTimes(list: readonly Observed[]) {
  const out = new Map<StageId, { start: number; end: number | null }>()
  list.forEach((o, i) => {
    if (!STAGES.includes(o.status as StageId)) return
    const id = o.status as StageId
    // A stage seen twice (a fix attempt) keeps its first start; end is when the
    // next status was seen, or null while it is the current one.
    out.set(id, { start: out.get(id)?.start ?? o.at, end: list[i + 1]?.at ?? null })
  })
  return out
}

/**
 * "Usually takes about N min": only from at least 3 renders of this engine
 * that this browser watched from start to Completed; N is their median.
 */
export function typicalMinutes(records: { library: Library; observed?: Observed[] }[], library: Library) {
  const spans = records
    .filter((r) => r.library === library && r.observed?.length)
    .map((r) => {
      const list = r.observed as Observed[]
      const done = list.find((o) => o.status === 'Completed')
      return done && list[0].status === 'Pending' ? done.at - list[0].at : null
    })
    .filter((v): v is number => v !== null && v > 0)
    .sort((a, b) => a - b)
  if (spans.length < 3) return null
  const mid = Math.floor(spans.length / 2)
  const median = spans.length % 2 ? spans[mid] : (spans[mid - 1] + spans[mid]) / 2
  return Math.max(1, Math.round(median / 60_000))
}
