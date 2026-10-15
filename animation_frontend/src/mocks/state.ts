// Server-side state for the MSW mock of the real API, kept in localStorage so
// it survives reloads like a real backend would. This simulates what the
// server knows (accounts, the session cookie, render jobs). It is never read
// by app code, only by the handlers.
import type { JobStatus, Library } from '@/lib/api/types'

export interface MockUser {
  email: string
  username: string
  password: string
  is_verified: boolean
  created_at: string
  last_login: string | null
}

export interface MockJob {
  job_id: string
  owner: string
  prompt: string
  library: Library
  created_at: number
  fail: boolean
}

interface MockState {
  users: MockUser[]
  /** Email of the logged-in user: stands in for the HttpOnly cookie. */
  session: string | null
  jobs: MockJob[]
}

const KEY = 'animato:mock-server:v1'

export const DEMO_USER: MockUser = {
  email: 'demo@animato.dev',
  username: 'demo',
  password: 'animato-demo',
  is_verified: true,
  created_at: '2026-06-02T09:30:00.000Z',
  last_login: null,
}

export function load(): MockState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as MockState
  } catch {
    // fall through to a fresh state
  }
  return { users: [DEMO_USER], session: null, jobs: [] }
}

export function save(state: MockState): void {
  localStorage.setItem(KEY, JSON.stringify(state))
}

/** Test hook: speeds up the simulated render pipeline (default 1). */
export function mockSpeed(): number {
  const v = Number(localStorage.getItem('animato:mock-speed'))
  return Number.isFinite(v) && v > 0 ? v : 1
}

// Seconds spent in each stage at speed 1.
const STAGES: [JobStatus, number][] = [
  ['Pending', 1.5],
  ['GeneratingCode', 3.5],
  ['Rendering', 6],
  ['Uploading', 1.5],
]

export function jobStatus(job: MockJob, now = Date.now()): JobStatus {
  let t = (now - job.created_at) / 1000 * mockSpeed()
  for (const [status, secs] of STAGES) {
    if (job.fail && status === 'Rendering' && t >= secs * 0.4) return 'Failed'
    if (t < secs) return status
    t -= secs
  }
  return job.fail ? 'Failed' : 'Completed'
}

const RENDERS: Record<Library, string[]> = {
  manim: ['manim-mandelbrot', 'manim-automaton'],
  remotion: ['remotion-gradient', 'remotion-life'],
}

export const RENDER_FACTS: Record<string, { size: number; duration: number }> = {
  'manim-mandelbrot': { size: 655_697, duration: 6 },
  'manim-automaton': { size: 1_851_894, duration: 6 },
  'remotion-gradient': { size: 168_183, duration: 6 },
  'remotion-life': { size: 1_246_412, duration: 6 },
}

export function renderFor(job: MockJob): string {
  const list = RENDERS[job.library]
  let h = 0
  for (const ch of job.job_id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return list[h % list.length]
}
