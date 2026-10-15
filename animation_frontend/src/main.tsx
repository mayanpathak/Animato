import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { MotionConfig } from 'motion/react'
import './index.css'
import { router } from './app/router'
import { ErrorBoundary } from './app/ErrorBoundary'
import { OfflineBanner } from './app/OfflineBanner'
import { Toaster } from './components/ui/toaster'
import { queryClient } from './lib/query'
import { applyPreferences, usePreferences } from './stores/preferences'
import { useSession } from './stores/session'

function Root() {
  const reduced = usePreferences((s) => s.reducedMotion)
  return (
    <MotionConfig reducedMotion={reduced ? 'always' : 'user'}>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
          <Toaster />
          <OfflineBanner />
        </QueryClientProvider>
      </ErrorBoundary>
    </MotionConfig>
  )
}

async function boot() {
  // Mocks answer the existing /api endpoints in the browser when no backend runs.
  if (import.meta.env.VITE_USE_MOCKS === 'true') {
    const { startMocks } = await import('./mocks/browser')
    await startMocks()
  }
  applyPreferences()
  void useSession.getState().checkAuth()
  createRoot(document.getElementById('root') as HTMLElement).render(
    <StrictMode>
      <Root />
    </StrictMode>,
  )
}

void boot()
