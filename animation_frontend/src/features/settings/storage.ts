// Bulk clean-up of everything this browser keeps for the signed-in user.
// Only local data is touched; the server (account, render jobs) is not.
import { brandTable, exportsTable, jobsTable, mediaTable, mine, projectsTable } from '@/lib/local/models'
import { clearDirectory, removeFile } from '@/lib/local/opfs'

/** Approximate bytes of generated previews (thumbnail data URLs and waveform peaks). */
export function previewCacheBytes(media: { thumbnails: string[]; waveform: number[] }[]): number {
  let bytes = 0
  for (const a of media) {
    for (const t of a.thumbnails) bytes += t.length
    bytes += a.waveform.length * 8
  }
  return bytes
}

export async function clearPreviewCache(owner: string): Promise<number> {
  const media = await mine(mediaTable, owner)
  let n = 0
  for (const a of media) {
    if (a.thumbnails.length === 0 && a.waveform.length === 0) continue
    await mediaTable.put({ ...a, thumbnails: [], waveform: [] })
    n++
  }
  return n
}

/**
 * Removes this user's files and records. The OPFS directory itself is only
 * swept when no other account in this browser still has records in it.
 */
async function purge<T extends { id: string; owner: string; path: string }>(
  table: { all: () => Promise<T[]>; remove: (id: string) => Promise<void> },
  owner: string,
  directory: string,
): Promise<number> {
  const all = await table.all()
  const own = all.filter((r) => r.owner === owner)
  for (const r of own) {
    await removeFile(r.path)
    await table.remove(r.id)
  }
  if (all.every((r) => r.owner === owner)) await clearDirectory(directory)
  return own.length
}

export function deleteAllExports(owner: string): Promise<number> {
  return purge(exportsTable, owner, 'exports')
}

export async function deleteEverythingLocal(owner: string): Promise<void> {
  await purge(exportsTable, owner, 'exports')
  await purge(mediaTable, owner, 'media')
  for (const t of [projectsTable, brandTable, jobsTable] as const) {
    for (const r of await mine<{ id: string; owner: string }>(t, owner)) await t.remove(r.id)
  }
}
