import type { MediaAsset } from '@/lib/local/models'

/** A frame a third of the way in: renders often open on a dark frame. */
export function posterOf(asset: MediaAsset | null | undefined): string | null {
  const t = asset?.thumbnails ?? []
  return t.length ? t[Math.floor(t.length / 3)] : null
}

/** Where Finish opens: once the title has entered, inside short videos. */
export function posterTime(duration: number): number {
  return Math.min(1.2, duration / 3)
}
