// Job status polling schedule (plan 11.3). Pure, so it is unit-tested; the
// TanStack Query hook in lib/local/hooks.ts applies it.
import { isFinished, type JobStatus } from './types'

export const POLL_MAX_FAILURES = 8
export const POLL_MAX_MS = 45 * 60_000
export const POLL_HIDDEN_MS = 15_000

/** Delay before the next poll, given how long this job has been watched. */
export function pollDelay(elapsedMs: number, hidden: boolean): number {
  if (hidden) return POLL_HIDDEN_MS
  if (elapsedMs < 60_000) return 2_000
  if (elapsedMs < 5 * 60_000) return 4_000
  return 8_000
}

export interface PollState {
  /** When this browser started watching the job (ms epoch). */
  startedAt: number
  /** Consecutive failed polls. */
  failures: number
}

/** Whether polling should give up: "Lost track of this render." */
export function isLost(s: PollState, now: number): boolean {
  return s.failures >= POLL_MAX_FAILURES || now - s.startedAt >= POLL_MAX_MS
}

/** The next refetch interval, or false to stop. */
export function nextPoll(
  status: JobStatus | undefined,
  s: PollState,
  now: number,
  hidden: boolean,
): number | false {
  if (status && isFinished(status)) return false
  if (isLost(s, now)) return false
  return pollDelay(now - s.startedAt, hidden)
}

export interface Observed {
  status: JobStatus
  at: number
}

/** Appends a status only when it changed. Returns the same array when nothing changed. */
export function observe(list: readonly Observed[], status: JobStatus, at: number): Observed[] {
  const last = list[list.length - 1]
  if (last?.status === status) return list as Observed[]
  return [...list, { status, at }]
}

/** True when the worker went back to writing code after rendering: an automatic fix. */
export function isFixing(list: readonly Observed[]): boolean {
  const last = list[list.length - 1]
  if (last?.status !== 'GeneratingCode') return false
  return list.slice(0, -1).some((o) => o.status === 'Rendering')
}
