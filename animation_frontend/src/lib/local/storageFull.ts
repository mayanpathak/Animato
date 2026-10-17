// Storage full (plan 15.2): a write that the browser refuses for lack of
// space says so once, with a way to Settings → Storage, where the largest
// files are listed. Callers still handle the failure themselves.
import { toast } from '@/stores/toast'

/** True for the browser's "out of storage" errors (IndexedDB, OPFS, localStorage). */
export function isQuotaError(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false
  const name = (e as { name?: unknown }).name
  return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED'
}

let last = 0

/** Shows the storage-full toast (at most every 10 s) when `e` is a quota error. Returns whether it was. */
export function reportIfStorageFull(e: unknown): boolean {
  if (!isQuotaError(e)) return false
  const now = Date.now()
  if (now - last > 10_000) {
    last = now
    toast.error('This browser is out of storage space', 'Delete exports or media you no longer need.', {
      label: 'Free up space',
      href: '/app/settings#storage',
    })
  }
  return true
}
