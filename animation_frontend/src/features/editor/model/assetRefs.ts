// The video's assets with roles, stable labels and notes (plan 3.3, 13.2).
// Labels are given once and kept: "Main", "Clip 1", "Clip 2", "Music",
// "Voice", "Logo". B-roll slots stay even when the clip is not on the
// timeline; other roles follow what the timeline uses.
import type { AssetRole, VideoAsset } from '@/lib/local/models'
import type { TimelineV2 } from './timelineV2'

const BASE: Record<AssetRole, string> = {
  main: 'Main',
  broll: 'Clip',
  music: 'Music',
  voice: 'Voice',
  logo: 'Logo',
}

/** The next free label for a role: "Clip 1", "Clip 2"…; "Music", "Music 2"… */
export function nextLabel(refs: readonly VideoAsset[], role: AssetRole): string {
  const taken = new Set(refs.map((r) => r.label))
  const base = BASE[role]
  if (role === 'broll') {
    for (let n = 1; ; n++) if (!taken.has(`${base} ${n}`)) return `${base} ${n}`
  }
  if (!taken.has(base)) return base
  for (let n = 2; ; n++) if (!taken.has(`${base} ${n}`)) return `${base} ${n}`
}

/** Adds `assetId` with `role` unless the video already knows it. */
export function addAssetRef(refs: readonly VideoAsset[], assetId: string, role: AssetRole): VideoAsset[] {
  if (refs.some((r) => r.assetId === assetId)) return refs as VideoAsset[]
  return [...refs, { assetId, role, label: nextLabel(refs, role), note: '' }]
}

export function updateAssetRef(
  refs: readonly VideoAsset[],
  assetId: string,
  patch: Partial<Pick<VideoAsset, 'label' | 'note'>>,
): VideoAsset[] {
  return refs.map((r) => (r.assetId === assetId ? { ...r, ...patch, assetId } : r))
}

/**
 * Refs for what the timeline uses, in timeline order. Kept: B-roll slots,
 * anything with a note, and whatever is still on the timeline. A replaced
 * main clip without a note drops out, so "Main" names the clip in use.
 */
export function syncAssetRefs(refs: readonly VideoAsset[] | undefined, tl: TimelineV2): VideoAsset[] {
  const role = new Map(tl.tracks.map((t) => [t.id, t.role]))
  const used = [...tl.clips].sort((a, b) => a.startTime - b.startTime)
  const usedIds = new Set(used.map((c) => c.assetId))
  let out = (refs ?? []).filter((r) => usedIds.has(r.assetId) || r.role === 'broll' || r.note.trim())
  // "Main" moves to the clip now on the main track.
  const mainIds = new Set(used.filter((c) => role.get(c.trackId) === 'main').map((c) => c.assetId))
  out = out.filter((r) => r.role !== 'main' || mainIds.has(r.assetId) || r.note.trim())
  for (const c of used) out = addAssetRef(out, c.assetId, role.get(c.trackId) ?? 'broll')
  const same =
    refs &&
    refs.length === out.length &&
    refs.every((r, i) => r.assetId === out[i].assetId && r.label === out[i].label && r.note === out[i].note)
  return same ? (refs as VideoAsset[]) : out
}

export function labelOf(refs: readonly VideoAsset[] | undefined, assetId: string): string | undefined {
  return refs?.find((r) => r.assetId === assetId)?.label
}
