import { describe, expect, it } from 'vitest'
import { useToasts } from '@/stores/toast'
import { isQuotaError, reportIfStorageFull } from './storageFull'

describe('storage full (plan 15.2)', () => {
  it('recognises the browsers’ quota errors and nothing else', () => {
    expect(isQuotaError(new DOMException('full', 'QuotaExceededError'))).toBe(true)
    expect(isQuotaError({ name: 'NS_ERROR_DOM_QUOTA_REACHED' })).toBe(true)
    expect(isQuotaError(new DOMException('gone', 'NotFoundError'))).toBe(false)
    expect(isQuotaError(new Error('QuotaExceededError'))).toBe(false)
    expect(isQuotaError(null)).toBe(false)
  })

  it('shows one toast with a way to Settings → Storage, not one per failed write', () => {
    useToasts.setState({ toasts: [] })
    const e = new DOMException('full', 'QuotaExceededError')
    expect(reportIfStorageFull(e)).toBe(true)
    expect(reportIfStorageFull(e)).toBe(true)
    expect(reportIfStorageFull(new Error('other'))).toBe(false)
    const shown = useToasts.getState().toasts
    expect(shown).toHaveLength(1)
    expect(shown[0]).toMatchObject({ tone: 'error', action: { href: '/app/settings#storage' } })
  })
})
