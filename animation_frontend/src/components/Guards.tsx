import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

// These guards only decide what the browser shows. The session gate and the
// verified gate on the server are what actually protect anything.

// Landing, login, signup, forgot-password, reset-password.
export function PublicOnlyRoute() {
  const user = useAuthStore((state) => state.user)

  if (user) return <Navigate to={user.isVerified ? '/app' : '/verify-email'} replace />

  return <Outlet />
}

// Logged in but not yet verified.
export function VerifyRoute() {
  const user = useAuthStore((state) => state.user)

  if (!user) return <Navigate to="/login" replace />
  if (user.isVerified) return <Navigate to="/app" replace />

  return <Outlet />
}

// Logged in and verified.
export function ProtectedRoute() {
  const user = useAuthStore((state) => state.user)

  if (!user) return <Navigate to="/login" replace />
  if (!user.isVerified) return <Navigate to="/verify-email" replace />

  return <Outlet />
}
