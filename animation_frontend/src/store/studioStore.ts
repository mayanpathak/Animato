import { create } from 'zustand'
import { api, isJobId, isRecord } from '../lib/api'
import { promptError } from '../lib/validation'
import {
  isFinished,
  isJobStatus,
  isLibrary,
  type Job,
  type JobStatus,
  type Library,
} from '../types'
import { useAuthStore } from './authStore'

// The only code that calls /api/jobs.
//
// There is no "list my jobs" endpoint yet, so the job list is kept in
// localStorage, keyed by the user's email. Only ids, prompts and statuses are
// stored; every job call is still checked against the session on the server.

const POLL_MS = 2_500
const MAX_POLL_FAILURES = 8
const MAX_POLL_MS = 30 * 60 * 1000
const MAX_SAVED_JOBS = 50
const MAX_ERROR_CHARS = 600
const STORAGE_PREFIX = 'myanimate:jobs:v1:'

interface StudioState {
  // Email of the user these jobs belong to; null while nobody is loaded.
  owner: string | null
  // Oldest first.
  jobs: Job[]
  // The job in the current-video panel. Every other job is the asset bin.
  currentId: string | null
  library: Library
  isSubmitting: boolean
  error: string | null
  // Polling gave up; the UI offers to check again.
  pollStalled: boolean

  load: (email: string) => void
  reset: () => void
  setLibrary: (library: Library) => void
  submitPrompt: (prompt: string) => Promise<boolean>
  newVideo: () => void
  selectJob: (jobId: string) => void
  markVideoMissing: (jobId: string) => void
  resumePolling: () => void
  clearError: () => void
}

const EMPTY = {
  owner: null,
  jobs: [],
  currentId: null,
  isSubmitting: false,
  error: null,
  pollStalled: false,
} satisfies Partial<StudioState>

export function findActiveJob(jobs: Job[]): Job | undefined {
  return jobs.findLast((job) => !isFinished(job.status))
}

// ─── Saved jobs ───────────────────────────────────────────────────────────────

function parseSavedJob(value: unknown): Job | null {
  if (!isRecord(value)) return null

  const { jobId, prompt, library, status, createdAt, errorMessage } = value

  if (
    !isJobId(jobId) ||
    typeof prompt !== 'string' ||
    !isLibrary(library) ||
    !isJobStatus(status) ||
    typeof createdAt !== 'number'
  ) {
    return null
  }

  return {
    jobId,
    prompt,
    library,
    status,
    createdAt,
    errorMessage: typeof errorMessage === 'string' ? errorMessage : null,
    videoMissing: false,
  }
}

function readSaved(email: string): { jobs: Job[]; currentId: string | null } {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_PREFIX + email) ?? 'null')

    if (!isRecord(parsed) || !Array.isArray(parsed.jobs)) return { jobs: [], currentId: null }

    const jobs = parsed.jobs
      .map(parseSavedJob)
      .filter((job): job is Job => job !== null)
      .slice(-MAX_SAVED_JOBS)

    const currentId = jobs.some((job) => job.jobId === parsed.currentId)
      ? (parsed.currentId as string)
      : null

    return { jobs, currentId }
  } catch {
    return { jobs: [], currentId: null }
  }
}

function writeSaved(email: string, jobs: Job[], currentId: string | null) {
  try {
    localStorage.setItem(
      STORAGE_PREFIX + email,
      JSON.stringify({ jobs: jobs.slice(-MAX_SAVED_JOBS), currentId }),
    )
  } catch {
    // Storage full or disabled: the list simply does not survive a refresh.
  }
}

// ─── Server payloads ──────────────────────────────────────────────────────────

function parseJobUpdate(data: unknown): { status: JobStatus; errorMessage: string | null } | null {
  if (!isRecord(data) || !isRecord(data.data) || !isJobStatus(data.data.status)) return null

  const raw = data.data.error_message

  return {
    status: data.data.status,
    // Raw worker output; kept short and only ever rendered as plain text.
    errorMessage: typeof raw === 'string' ? raw.slice(0, MAX_ERROR_CHARS) : null,
  }
}

// A 401 or 403 from a job call. The route guards react to the auth store.
function handleAuthFailure(status: number): boolean {
  if (status === 401) {
    useAuthStore.getState().sessionLost()
    return true
  }

  if (status === 403) {
    void useAuthStore.getState().refreshUser()
    return true
  }

  return false
}

// ─── Polling ──────────────────────────────────────────────────────────────────

let pollTimer: ReturnType<typeof setTimeout> | undefined
// Bumped whenever polling is stopped, so a reply already in flight is ignored.
let pollRun = 0

function stopPolling() {
  pollRun += 1
  clearTimeout(pollTimer)
  pollTimer = undefined
}

function patchJob(jobId: string, patch: Partial<Job>) {
  useStudioStore.setState((state) => ({
    jobs: state.jobs.map((job) => (job.jobId === jobId ? { ...job, ...patch } : job)),
  }))
}

function startPolling(jobId: string) {
  stopPolling()

  const run = pollRun
  const startedAt = Date.now()
  let failures = 0

  const tick = async () => {
    const res = await api('GET', `/jobs/${encodeURIComponent(jobId)}`)

    if (run !== pollRun) return
    if (handleAuthFailure(res.status)) return

    if (res.status === 404) {
      patchJob(jobId, { status: 'Failed', errorMessage: 'This job no longer exists.' })
      return
    }

    const update = res.ok ? parseJobUpdate(res.data) : null

    if (update) {
      failures = 0
      patchJob(jobId, update)

      if (isFinished(update.status)) return
    } else {
      failures += 1
    }

    if (failures >= MAX_POLL_FAILURES || Date.now() - startedAt > MAX_POLL_MS) {
      useStudioStore.setState({ pollStalled: true })
      return
    }

    pollTimer = setTimeout(tick, POLL_MS)
  }

  useStudioStore.setState({ pollStalled: false })
  pollTimer = setTimeout(tick, POLL_MS)
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useStudioStore = create<StudioState>((set, get) => ({
  ...EMPTY,
  library: 'remotion',

  load: (email) => {
    if (get().owner === email) return

    stopPolling()

    const saved = readSaved(email)
    set({ ...EMPTY, owner: email, jobs: saved.jobs, currentId: saved.currentId })

    const active = findActiveJob(saved.jobs)
    if (active) startPolling(active.jobId)
  },

  // Called when the studio unmounts (logout, lost session), so nothing of
  // one user's is left in memory for the next.
  reset: () => {
    stopPolling()
    set({ ...EMPTY })
  },

  setLibrary: (library) => set({ library }),

  submitPrompt: async (prompt) => {
    const { owner, library, isSubmitting, jobs } = get()

    if (owner === null || isSubmitting) return false

    const text = prompt.trim()
    const invalid = promptError(text)

    if (invalid) {
      set({ error: invalid })
      return false
    }

    if (findActiveJob(jobs)) {
      set({ error: 'Wait for the current video to finish first.' })
      return false
    }

    set({ isSubmitting: true, error: null })

    const res = await api('POST', '/jobs', { prompt: text, library })

    // The studio was reset, or another user loaded, while this was in flight.
    if (get().owner !== owner) return false

    if (handleAuthFailure(res.status)) {
      set({ isSubmitting: false })
      return false
    }

    const jobId = res.ok && isRecord(res.data) && isRecord(res.data.data) ? res.data.data.job_id : null

    if (!isJobId(jobId)) {
      set({
        isSubmitting: false,
        error: res.ok ? 'Something went wrong. Please try again.' : res.message,
      })
      return false
    }

    const job: Job = {
      jobId,
      prompt: text,
      library,
      status: 'Pending',
      createdAt: Date.now(),
      errorMessage: null,
      videoMissing: false,
    }

    // The new job becomes current; whatever was current is now in the bin.
    set((state) => ({ jobs: [...state.jobs, job], currentId: jobId, isSubmitting: false }))
    startPolling(jobId)

    return true
  },

  // Empties the current-video panel. The job that was there stays in `jobs`,
  // which is what puts it in the asset bin.
  newVideo: () => set({ currentId: null, error: null }),

  selectJob: (jobId) => {
    if (get().jobs.some((job) => job.jobId === jobId)) set({ currentId: jobId })
  },

  markVideoMissing: (jobId) => patchJob(jobId, { videoMissing: true }),

  resumePolling: () => {
    const active = findActiveJob(get().jobs)
    if (active) startPolling(active.jobId)
  },

  clearError: () => set({ error: null }),
}))

useStudioStore.subscribe((state) => {
  if (state.owner !== null) writeSaved(state.owner, state.jobs, state.currentId)
})
