// The user's media library: every asset imported in this browser, newest first.
import { mediaTable, mine, type MediaAsset } from '@/lib/local/models'

export async function loadLibrary(owner: string): Promise<MediaAsset[]> {
  return (await mine(mediaTable, owner)).sort((a, b) => b.createdAt - a.createdAt)
}
