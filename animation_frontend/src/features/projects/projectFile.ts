// The portable `.animato.json` project file. It carries the timeline and the
// metadata of the media it uses; the media bytes themselves stay in the
// browser that created them.
import { z } from 'zod'
import type { Timeline } from '@/features/editor/model/timeline'
import { mediaTable, mine, projectsTable, uid, type MediaAsset, type Project } from '@/lib/local/models'
import { downloadBlob, normalizeTag, safeFileName, timelineAssetIds } from './lib'

export const PROJECT_FILE_FORMAT = 'animato-project'

export type PortableAsset = Omit<MediaAsset, 'thumbnails' | 'waveform'>

export interface ProjectFile {
  format: typeof PROJECT_FILE_FORMAT
  version: 1
  exportedAt: number
  project: Project
  assets: PortableAsset[]
}

export async function exportProjectFile(project: Project): Promise<number> {
  const ids = timelineAssetIds(project.timeline)
  const assets: PortableAsset[] = []
  for (const id of ids) {
    const asset = await mediaTable.get(id)
    if (!asset) continue
    // Strip the generated previews: they are large and rebuilt from the original.
    const { thumbnails: _t, waveform: _w, ...meta } = asset
    assets.push(meta)
  }
  const file: ProjectFile = {
    format: PROJECT_FILE_FORMAT,
    version: 1,
    exportedAt: Date.now(),
    project,
    assets,
  }
  const blob = new Blob([JSON.stringify(file)], { type: 'application/json' })
  downloadBlob(blob, `${safeFileName(project.name)}.animato.json`)
  return assets.length
}

const clipSchema = z.looseObject({
  id: z.string(),
  type: z.enum(['media', 'text', 'caption']),
  start: z.number().min(0),
  duration: z.number().min(0),
  assetId: z.string().optional(),
})

const trackSchema = z.looseObject({
  id: z.string(),
  kind: z.enum(['video', 'text', 'audio', 'voice', 'caption']),
  name: z.string(),
  muted: z.boolean(),
  hidden: z.boolean(),
  volume: z.number(),
  clips: z.array(clipSchema),
})

const timelineSchema = z.looseObject({
  version: z.literal(1),
  width: z.number().int().positive().max(8192),
  height: z.number().int().positive().max(8192),
  fps: z.number().positive().max(240),
  background: z.string(),
  tracks: z.array(trackSchema),
  captionStyle: z.looseObject({ font: z.string(), size: z.number(), color: z.string(), y: z.number() }),
  ducking: z.looseObject({ enabled: z.boolean(), amountDb: z.number() }),
})

const assetSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  kind: z.enum(['video', 'audio', 'image']),
  sha256: z.string().optional(),
})

const fileSchema = z.object({
  format: z.literal(PROJECT_FILE_FORMAT),
  version: z.literal(1),
  project: z.looseObject({
    name: z.string().min(1).max(200),
    tags: z.array(z.string()).optional(),
    thumbnail: z
      .string()
      .regex(/^data:image\/(jpeg|png|webp);base64,/)
      .nullable()
      .optional(),
    timeline: timelineSchema,
  }),
  assets: z.array(assetSchema).default([]),
})

export interface ImportResult {
  project: Project
  /** Media referenced by the timeline that is not in this browser. */
  offline: number
  /** Media matched to a local file by content hash and relinked. */
  relinked: number
}

export class ProjectFileError extends Error {}

const MAX_FILE_BYTES = 25 * 1024 * 1024

export async function importProjectFile(file: File, owner: string): Promise<ImportResult> {
  if (file.size > MAX_FILE_BYTES)
    throw new ProjectFileError('That file is larger than 25 MB. Project files are usually a few KB.')
  let raw: unknown
  try {
    raw = JSON.parse(await file.text())
  } catch {
    throw new ProjectFileError('This file is not valid JSON.')
  }
  const parsed = fileSchema.safeParse(raw)
  if (!parsed.success) {
    const format = (raw as { format?: unknown } | null)?.format
    throw new ProjectFileError(
      format === PROJECT_FILE_FORMAT
        ? 'This Animato project file is damaged or from a newer version.'
        : 'This is not an Animato project file (.animato.json).',
    )
  }
  const data = parsed.data
  const timeline = structuredClone(data.project.timeline) as unknown as Timeline

  // Relink media: same id first, then the same file content (sha256) under another id.
  const local = await mine(mediaTable, owner)
  const byId = new Set(local.map((a) => a.id))
  const bySha = new Map(local.filter((a) => a.sha256).map((a) => [a.sha256, a.id]))
  const remap = new Map<string, string>()
  for (const asset of data.assets) {
    if (byId.has(asset.id)) continue
    const match = asset.sha256 ? bySha.get(asset.sha256) : undefined
    if (match) remap.set(asset.id, match)
  }
  for (const track of timeline.tracks) {
    for (const clip of track.clips) {
      if (clip.type === 'media' && remap.has(clip.assetId)) clip.assetId = remap.get(clip.assetId) as string
    }
  }
  const referenced = timelineAssetIds(timeline)
  let offline = 0
  for (const id of referenced) if (!byId.has(id)) offline++

  const now = Date.now()
  const project: Project = {
    id: uid('prj'),
    owner,
    name: data.project.name.trim(),
    tags: [...new Set((data.project.tags ?? []).map(normalizeTag).filter(Boolean))],
    createdAt: now,
    updatedAt: now,
    thumbnail: data.project.thumbnail ?? null,
    timeline,
  }
  await projectsTable.put(project)
  return { project, offline, relinked: remap.size }
}
