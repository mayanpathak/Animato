import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

export async function startMocks(): Promise<void> {
  // MSW's worker unregisters itself when its last page unloads. After a full
  // reload, Chromium's navigation-time update of that just-removed
  // registration rejects with "Not found". Harmless, and only in mock mode.
  window.addEventListener('unhandledrejection', (e) => {
    const message = e.reason instanceof Error ? e.reason.message : String(e.reason)
    if (message.includes('Failed to update a ServiceWorker') && message.includes('mockServiceWorker.js'))
      e.preventDefault()
  })
  const worker = setupWorker(...handlers)
  await worker.start({
    onUnhandledFrame: 'bypass',
    quiet: true,
    serviceWorker: { url: '/mockServiceWorker.js' },
  })
}
