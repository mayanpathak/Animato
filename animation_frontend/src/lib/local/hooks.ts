// React Query wrappers around the local stores and the two job endpoints.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/lib/api/http'
import { jobsApi, type Job } from '@/lib/api/jobs'
import { isLost, nextPoll, observe, type PollState } from '@/lib/api/polling'
import { isFinished, type JobStatus, type Library } from '@/lib/api/types'
import { useSession } from '@/stores/session'
import {
  brandTable,
  exportsTable,
  jobsTable,
  mediaTable,
  mine,
  projectsTable,
  type BrandKit,
  type JobRecord,
  type Project,
} from './models'

export const keys = {
  jobHistory: (owner: string) => ['job-history', owner] as const,
  job: (id: string) => ['job', id] as const,
  projects: (owner: string) => ['projects', owner] as const,
  project: (id: string) => ['project', id] as const,
  media: (owner: string) => ['media', owner] as const,
  brand: (owner: string) => ['brand', owner] as const,
  exports: (owner: string) => ['exports', owner] as const,
}

function useOwner(): string {
  return useSession((s) => s.user?.email ?? '')
}

export function useJobHistory() {
  const owner = useOwner()
  return useQuery({
    queryKey: keys.jobHistory(owner),
    queryFn: async () => (await mine(jobsTable, owner)).sort((a, b) => b.createdAt - a.createdAt),
    enabled: owner !== '',
  })
}

// One poll state per job, shared by every screen that watches it (plan 11.3).
const pollStates = new Map<string, PollState & { lost: boolean }>()

function pollState(id: string): PollState & { lost: boolean } {
  let s = pollStates.get(id)
  if (!s) {
    s = { startedAt: Date.now(), failures: 0, lost: false }
    pollStates.set(id, s)
  }
  return s
}

/** Records a status change on the local job record (stage timings, "fixing" detection). */
async function recordObserved(id: string, status: JobStatus): Promise<void> {
  const record = await jobsTable.get(id)
  if (!record) return
  const prev = record.observed ?? []
  const next = observe(prev, status, Date.now())
  if (next !== prev) await jobsTable.put({ ...record, observed: next })
}

function isHidden(): boolean {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden'
}

function isGone(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 404 || error.status === 400)
}

/**
 * Polls GET /api/jobs/:id with backoff (2 s, 4 s, 8 s; 15 s while hidden)
 * until the job finishes, the job is gone, or polling gives up after 8
 * consecutive failures or 45 minutes (`lost`). `checkAgain` resets the counters.
 */
export function useJob(id: string | undefined) {
  const query = useQuery<Job>({
    queryKey: keys.job(id ?? ''),
    queryFn: async () => {
      const state = pollState(id as string)
      try {
        const job = await jobsApi.get(id as string)
        state.failures = 0
        await recordObserved(job.id, job.status).catch(() => undefined)
        return job
      } catch (e) {
        if (!isGone(e)) state.failures += 1
        // An unverified session answers 403: re-check who is logged in.
        if (e instanceof ApiError && e.status === 403) void useSession.getState().checkAuth()
        throw e
      } finally {
        // Read by the render below; the poll that crosses a limit re-renders with it.
        state.lost = isLost(state, Date.now())
      }
    },
    enabled: Boolean(id),
    retry: false,
    refetchIntervalInBackground: true,
    refetchInterval: (q) => {
      if (!id || isGone(q.state.error)) return false
      return nextPoll(q.state.data?.status, pollState(id), Date.now(), isHidden())
    },
    staleTime: (q) => (q.state.data && isFinished(q.state.data.status) ? Infinity : 0),
  })
  const finished = query.data ? isFinished(query.data.status) : false
  const lost = Boolean(id && pollStates.get(id)?.lost) && !finished && !isGone(query.error)
  const checkAgain = () => {
    if (!id) return
    pollStates.set(id, { startedAt: Date.now(), failures: 0, lost: false })
    void query.refetch()
  }
  return { ...query, lost, checkAgain }
}

export function useCreateJob() {
  const owner = useOwner()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      prompt: string
      library: Library
      options: JobRecord['options']
      serverPrompt: string
    }) => {
      const created = await jobsApi.create(input.serverPrompt, input.library)
      const record: JobRecord = {
        id: created.id,
        owner,
        prompt: input.prompt,
        library: created.library,
        createdAt: Date.now(),
        options: input.options,
      }
      await jobsTable.put(record)
      return record
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.jobHistory(owner) }),
  })
}

export function useProjects() {
  const owner = useOwner()
  return useQuery({
    queryKey: keys.projects(owner),
    queryFn: async () => (await mine(projectsTable, owner)).sort((a, b) => b.updatedAt - a.updatedAt),
    enabled: owner !== '',
  })
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: keys.project(id ?? ''),
    queryFn: async () => (await projectsTable.get(id as string)) ?? null,
    enabled: Boolean(id),
  })
}

export function useSaveProject() {
  const qc = useQueryClient()
  const owner = useOwner()
  return useMutation({
    mutationFn: (p: Project) => projectsTable.put({ ...p, updatedAt: Date.now() }),
    onSuccess: (p) => {
      qc.setQueryData(keys.project(p.id), p)
      void qc.invalidateQueries({ queryKey: keys.projects(owner) })
    },
  })
}

export function useMediaLibrary() {
  const owner = useOwner()
  return useQuery({
    queryKey: keys.media(owner),
    queryFn: async () => (await mine(mediaTable, owner)).sort((a, b) => b.createdAt - a.createdAt),
    enabled: owner !== '',
  })
}

export function useBrandKits() {
  const owner = useOwner()
  return useQuery({
    queryKey: keys.brand(owner),
    queryFn: async () => (await mine(brandTable, owner)).sort((a, b) => b.updatedAt - a.updatedAt),
    enabled: owner !== '',
  })
}

export function useSaveBrandKit() {
  const qc = useQueryClient()
  const owner = useOwner()
  return useMutation({
    mutationFn: (k: BrandKit) => brandTable.put({ ...k, updatedAt: Date.now() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.brand(owner) }),
  })
}

export function useExportHistory() {
  const owner = useOwner()
  return useQuery({
    queryKey: keys.exports(owner),
    queryFn: async () => (await mine(exportsTable, owner)).sort((a, b) => b.createdAt - a.createdAt),
    enabled: owner !== '',
  })
}

export { useOwner }
