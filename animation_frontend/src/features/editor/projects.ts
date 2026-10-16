// Bringing renders into a video's timeline. Everything here is local to this browser.
import { jobsApi } from '@/lib/api/jobs'
import { mediaTable, projectsTable, type MediaAsset, type Project } from '@/lib/local/models'
import { importFile, type ImportProgress } from './media/client'
import { isV2, migrateTimeline } from './model/migrate'
import { appendAsset } from './model/ops'
import { clipId, emptyTimelineV2, type TimelineV2 } from './model/timelineV2'

/**
 * The video's Timeline v2, migrating a v1 document on the way (plan 10.2). The
 * caller saves the result; `migrated` carries the v1 backup and the transcript
 * made from v1 caption clips.
 */
export function timelineOf(project: Project): {
  timeline: TimelineV2
  migrated: Partial<Project> | null
} {
  const t = project.timeline as { version?: number } | undefined
  if (!t) return { timeline: emptyTimelineV2(), migrated: {} }
  if (isV2(t as { version: number })) return { timeline: t as TimelineV2, migrated: null }
  const { timeline, transcript } = migrateTimeline(project.timeline as never)
  return {
    timeline,
    migrated: {
      timelineV1Backup: project.timeline as never,
      ...(transcript && !project.transcript ? { transcript } : {}),
    },
  }
}

/** Downloads a finished job's video (GET /api/jobs/:id/video) into OPFS as a media asset. */
export async function importJobVideo(
  jobId: string,
  owner: string,
  name: string,
  onProgress?: ImportProgress,
): Promise<MediaAsset> {
  const existing = (await mediaTable.all()).find((a) => a.owner === owner && a.jobId === jobId)
  if (existing) return existing
  const res = await fetch(jobsApi.videoUrl(jobId), { credentials: 'same-origin' })
  if (!res.ok)
    throw new Error(
      res.status === 404
        ? 'This video is not available (it may have expired).'
        : `Could not download the video (${res.status}).`,
    )
  // Streamed straight into OPFS; the file never sits whole in memory.
  const size = Number(res.headers.get('Content-Length')) || 0
  const mime = res.headers.get('Content-Type') ?? 'video/mp4'
  const ext = mime.includes('webm') ? 'webm' : 'mp4'
  return importFile(
    res.body ?? (await res.blob()),
    { owner, name: `${name}.${ext}`, jobId, mime, size },
    onProgress,
  )
}

/** Adds a finished job's video to the end of a video's timeline. */
export async function addJobToProject(
  jobId: string,
  projectId: string,
  owner: string,
  name: string,
): Promise<Project> {
  const project = await projectsTable.get(projectId)
  if (!project) throw new Error('That video no longer exists.')
  const asset = await importJobVideo(jobId, owner, name)
  const { timeline, migrated } = timelineOf(project)
  return projectsTable.put({
    ...project,
    ...migrated,
    timeline: appendAsset(timeline, asset, clipId()),
    thumbnail: project.thumbnail ?? asset.thumbnails[0] ?? null,
    updatedAt: Date.now(),
  })
}
