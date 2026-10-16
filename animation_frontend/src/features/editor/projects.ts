// Creating projects and adding media to them. Used by the job page, the
// library and the editor itself. Everything here is local to this browser.
import { jobsApi } from '@/lib/api/jobs'
import { mediaTable, projectsTable, uid, type MediaAsset, type Project } from '@/lib/local/models'
import { clipId, defaultTransform, emptyTimeline, timelineDuration, type AspectKey, type MediaClip, type Timeline } from './model/timeline'
import { importFile, type ImportProgress } from './media/client'

export function newProject(owner: string, name: string, aspect: AspectKey = '16:9'): Project {
  const now = Date.now()
  return { id: uid('prj'), owner, name, tags: [], createdAt: now, updatedAt: now, thumbnail: null, timeline: emptyTimeline(aspect) }
}

export async function createEmptyProject(owner: string, name: string, aspect: AspectKey = '16:9'): Promise<Project> {
  return projectsTable.put(newProject(owner, name, aspect))
}

export function mediaClipFor(asset: MediaAsset, start: number): MediaClip {
  return {
    id: clipId(),
    type: 'media',
    assetId: asset.id,
    name: asset.name,
    start,
    duration: asset.kind === 'image' ? 3 : asset.duration,
    offset: 0,
    speed: 1,
    volume: 1,
    fadeIn: 0,
    fadeOut: 0,
    transform: defaultTransform(),
    color: { brightness: 1, contrast: 1, saturation: 1 },
    crop: { top: 0, right: 0, bottom: 0, left: 0 },
    audio: { normalizeGain: 1, gate: false, eq: { low: 0, mid: 0, high: 0 }, duck: asset.kind === 'audio' },
  }
}

/** Appends an asset to the end of the matching track (video/image → Video, audio → Music & audio). */
export function appendAsset(t: Timeline, asset: MediaAsset): Timeline {
  const kind = asset.kind === 'audio' ? 'audio' : 'video'
  const tracks = t.tracks.map((track) => {
    if (track.kind !== kind) return track
    const end = track.clips.reduce((m, c) => Math.max(m, c.start + c.duration), 0)
    return { ...track, clips: [...track.clips, mediaClipFor(asset, end)] }
  })
  return { ...t, tracks }
}

/** Downloads a finished job's video (GET /api/jobs/:id/video) into OPFS as a media asset. */
export async function importJobVideo(jobId: string, owner: string, name: string, onProgress?: ImportProgress): Promise<MediaAsset> {
  const existing = (await mediaTable.all()).find((a) => a.owner === owner && a.jobId === jobId)
  if (existing) return existing
  const res = await fetch(jobsApi.videoUrl(jobId), { credentials: 'same-origin' })
  if (!res.ok) throw new Error(res.status === 404 ? 'This video is not available (it may have expired).' : `Could not download the video (${res.status}).`)
  // Streamed straight into OPFS; the file never sits whole in memory.
  const size = Number(res.headers.get('Content-Length')) || 0
  const mime = res.headers.get('Content-Type') ?? 'video/mp4'
  const ext = mime.includes('webm') ? 'webm' : 'mp4'
  return importFile(res.body ?? (await res.blob()), { owner, name: `${name}.${ext}`, jobId, mime, size }, onProgress)
}

/** Creates a project holding a finished job's video on the video track. */
export async function createProjectFromJob(
  jobId: string,
  owner: string,
  name: string,
  aspect: AspectKey = '16:9',
  onProgress?: ImportProgress,
): Promise<Project> {
  const asset = await importJobVideo(jobId, owner, name, onProgress)
  const project = newProject(owner, name, aspect)
  project.timeline = appendAsset(project.timeline, asset)
  project.thumbnail = asset.thumbnails[0] ?? null
  return projectsTable.put(project)
}

/** Adds a finished job's video to the end of an existing project. */
export async function addJobToProject(jobId: string, projectId: string, owner: string, name: string): Promise<Project> {
  const project = await projectsTable.get(projectId)
  if (!project) throw new Error('That project no longer exists.')
  const asset = await importJobVideo(jobId, owner, name)
  const timeline = appendAsset(project.timeline, asset)
  return projectsTable.put({ ...project, timeline, thumbnail: project.thumbnail ?? asset.thumbnails[0] ?? null, updatedAt: Date.now() })
}

export { timelineDuration }
