// React Query wrappers around the local stores and the two job endpoints.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { jobsApi, type Job } from '@/lib/api/jobs'
import { isFinished, type Library } from '@/lib/api/types'
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

/** Polls GET /api/jobs/:id every 2.5 s until the job finishes. */
export function useJob(id: string | undefined) {
  return useQuery<Job>({
    queryKey: keys.job(id ?? ''),
    queryFn: () => jobsApi.get(id as string),
    enabled: Boolean(id),
    refetchInterval: (q) => (q.state.data && isFinished(q.state.data.status) ? false : 2500),
    staleTime: (q) => (q.state.data && isFinished(q.state.data.status) ? Infinity : 0),
  })
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
