// The one object in the product: a Video (plan 3.3). Stored in the
// `projects` table; a job never exists in the UI without its video.
import { emptyTimeline } from '@/features/editor/model/timeline'
import { jobsTable, projectsTable, uid, type JobRecord, type Project, type Take } from '@/lib/local/models'
import type { VideoFormat } from '@/stores/preferences'

/** Cross-tab updates: a video created in one tab shows up in the others (plan 6.3). */
export const VIDEOS_CHANNEL = 'animato:videos'

export function announceVideosChanged(): void {
  try {
    const ch = new BroadcastChannel(VIDEOS_CHANNEL)
    ch.postMessage('changed')
    ch.close()
  } catch {
    // BroadcastChannel missing: other tabs refresh on focus instead.
  }
}

const LEADING_VERBS =
  /^(please\s+)?(explain|show|visuali[sz]e|animate|illustrate|make|create|draw|demonstrate)\s+(me\s+)?(how\s+|why\s+|what\s+)?/i

/**
 * A short title from the user's prompt: drop a leading verb, keep the first
 * clause, at most 6 words and 32 characters, Title Case. Deterministic.
 */
export function titleFromPrompt(prompt: string): string {
  const clause = prompt
    .replace(/\s+/g, ' ')
    .trim()
    .replace(LEADING_VERBS, '')
    .split(/[.,;:!?\n]| - | — /)[0]
    .trim()
    // A title reads better without a leading article ("A heart…" → "Heart…").
    .replace(/^(a|an|the)\s+/i, '')
  const words = clause.split(' ').filter(Boolean).slice(0, 6)
  let title = ''
  for (const w of words) {
    const next = title ? `${title} ${w}` : w
    if (next.length > 32) break
    title = next
  }
  // A cut title should not end on a connecting word ("…of Sin(x) Is").
  const dangling = /\s+(a|an|and|as|at|by|for|in|is|are|of|on|or|the|to|vs|with)$/i
  while (dangling.test(title)) title = title.replace(dangling, '')
  if (!title) return 'Untitled video'
  const SMALL_WORDS = 'a an and as at by for from in into of on or the to vs with'
  const small = new Set(SMALL_WORDS.split(' '))
  return title
    .split(' ')
    .map((w, i) =>
      i > 0 && small.has(w.toLowerCase()) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1),
    )
    .join(' ')
}

export function takeFrom(record: Pick<JobRecord, 'id' | 'prompt' | 'library' | 'createdAt'>): Take {
  return { jobId: record.id, prompt: record.prompt, library: record.library, createdAt: record.createdAt }
}

export function newVideo(owner: string, take: Take | null, format: VideoFormat, name?: string): Project {
  const now = Date.now()
  return {
    id: uid('vid'),
    owner,
    name: name ?? (take ? titleFromPrompt(take.prompt) : 'Untitled video'),
    tags: [],
    createdAt: now,
    updatedAt: now,
    thumbnail: null,
    takes: take ? [take] : [],
    selectedTake: take?.jobId ?? null,
    format,
    // The edit canvas stays 16:9 until Finish (P6) lays the video out per format.
    timeline: emptyTimeline('16:9'),
  }
}

export async function createVideo(
  owner: string,
  take: Take | null,
  format: VideoFormat,
  name?: string,
): Promise<Project> {
  const video = await projectsTable.put(newVideo(owner, take, format, name))
  announceVideosChanged()
  return video
}

/** Adds a take to an existing video and selects it. */
export async function addTake(video: Project, take: Take): Promise<Project> {
  const next = await projectsTable.put({
    ...video,
    takes: [...(video.takes ?? []), take],
    selectedTake: take.jobId,
    updatedAt: Date.now(),
  })
  announceVideosChanged()
  return next
}

export async function findVideoForJob(owner: string, jobId: string): Promise<Project | null> {
  const all = await projectsTable.all()
  return all.find((v) => v.owner === owner && v.takes?.some((t) => t.jobId === jobId)) ?? null
}

/**
 * The video that owns a job, for old `/app/jobs/:id` links. When this browser
 * has none, one is created from the local job record (or a bare take).
 */
export async function ensureVideoForJob(owner: string, jobId: string, format: VideoFormat): Promise<Project> {
  const found = await findVideoForJob(owner, jobId)
  if (found) return found
  const record = await jobsTable.get(jobId)
  const take: Take = record
    ? takeFrom(record)
    : { jobId, prompt: '', library: 'remotion', createdAt: Date.now() }
  return createVideo(owner, take, format, record ? undefined : `Render ${jobId.slice(0, 8)}`)
}

export function selectedTake(video: Project): Take | null {
  const takes = video.takes ?? []
  return takes.find((t) => t.jobId === video.selectedTake) ?? takes[takes.length - 1] ?? null
}

/** Stores a take's terminal status on its video, so the Videos grid stops polling it. */
export async function markTakeStatus(jobId: string, status: 'Completed' | 'Failed'): Promise<void> {
  const all = await projectsTable.all()
  for (const v of all) {
    const takes = v.takes ?? []
    const i = takes.findIndex((t) => t.jobId === jobId)
    if (i < 0 || takes[i].status === status) continue
    const next = takes.map((t, j) => (j === i ? { ...t, status } : t))
    await projectsTable.put({ ...v, takes: next })
    announceVideosChanged()
  }
}
