// Small helpers shared by the projects library screens.
import { ASPECT_PRESETS, type AspectKey, type Timeline } from '@/features/editor/model/timeline'
import type { Project } from '@/lib/local/models'

export type SortKey = 'updated' | 'name' | 'created'

export const SORT_LABELS: Record<SortKey, string> = {
  updated: 'Last edited',
  name: 'Name',
  created: 'Created',
}

export function sortProjects(list: Project[], key: SortKey): Project[] {
  const out = [...list]
  if (key === 'name') out.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
  else if (key === 'created') out.sort((a, b) => b.createdAt - a.createdAt)
  else out.sort((a, b) => b.updatedAt - a.updatedAt)
  return out
}

/** "16:9", "9:16", "1:1", or the raw size for anything custom. */
export function aspectLabel(t: Pick<Timeline, 'width' | 'height'>): string {
  const ratio = t.width / t.height
  for (const [key, size] of Object.entries(ASPECT_PRESETS)) {
    if (Math.abs(size.width / size.height - ratio) < 0.01) return key
  }
  return `${t.width}×${t.height}`
}

export const ASPECT_OPTIONS: { key: AspectKey; label: string; hint: string }[] = [
  { key: '16:9', label: 'Landscape', hint: 'YouTube, presentations' },
  { key: '9:16', label: 'Vertical', hint: 'Shorts · Reels · TikTok' },
  { key: '1:1', label: 'Square', hint: 'LinkedIn · Instagram' },
]

/** Asset ids referenced by media clips on the timeline. */
export function timelineAssetIds(t: Timeline): Set<string> {
  const ids = new Set<string>()
  for (const track of t.tracks)
    for (const clip of track.clips) if (clip.type === 'media') ids.add(clip.assetId)
  return ids
}

/** How many projects use each asset. */
export function assetUsage(projects: Project[]): Map<string, number> {
  const usage = new Map<string, number>()
  for (const p of projects)
    for (const id of timelineAssetIds(p.timeline)) usage.set(id, (usage.get(id) ?? 0) + 1)
  return usage
}

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

const STOPS = ['--color-accent-violet', '--color-accent-cyan', '--color-accent-magenta']

/** A calm, deterministic placeholder gradient built from the accent tokens. */
export function placeholderGradient(seed: string): string {
  const h = hash(seed)
  const angle = h % 360
  const a = STOPS[h % 3]
  const b = STOPS[(h >> 3) % 3 === h % 3 ? (h + 1) % 3 : (h >> 3) % 3]
  return [
    `radial-gradient(120% 90% at ${20 + (h % 60)}% 0%, color-mix(in oklab, var(${a}) 38%, transparent), transparent 70%)`,
    `radial-gradient(90% 80% at ${80 - ((h >> 5) % 50)}% 100%, color-mix(in oklab, var(${b}) 28%, transparent), transparent 70%)`,
    `linear-gradient(${angle}deg, var(--color-surface-2), var(--color-surface-3))`,
  ].join(', ')
}

export function safeFileName(name: string): string {
  return (
    name
      .trim()
      .replace(/[^\w\- ]+/g, '')
      .replace(/\s+/g, '-')
      .toLowerCase()
      .slice(0, 60) || 'project'
  )
}

/** Hands a Blob to the browser as a download. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

export function normalizeTag(tag: string): string {
  return tag.trim().replace(/\s+/g, ' ').toLowerCase().slice(0, 32)
}
