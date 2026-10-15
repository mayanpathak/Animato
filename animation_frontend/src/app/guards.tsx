import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useSession } from '@/stores/session'
import { FullPageSpinner } from '@/components/ui/spinner'

// These guards only decide what the browser shows. The session gate and the
// verified gate on the server are what actually protect anything.

/** Login, signup, forgot/reset password: logged-out users only. */
export function PublicOnlyRoute() {
  const user = useSession((s) => s.user)
  const location = useLocation()
  if (user) {
    const next = new URLSearchParams(location.search).get('next')
    const safeNext = next && next.startsWith('/app') ? next : '/app'
    return <Navigate to={user.isVerified ? safeNext : '/verify-email'} replace />
  }
  return <Outlet />
}

/** Logged in but not yet verified. */
export function VerifyRoute() {
  const user = useSession((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  if (user.isVerified) return <Navigate to="/app" replace />
  return <Outlet />
}

/** Logged in and verified. Redirects back here after login via ?next=. */
export function ProtectedRoute() {
  const user = useSession((s) => s.user)
  const checking = useSession((s) => s.checking)
  const location = useLocation()
  if (!user && checking) return <FullPageSpinner />
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
  if (!user.isVerified) return <Navigate to="/verify-email" replace />
  return <Outlet />
}
