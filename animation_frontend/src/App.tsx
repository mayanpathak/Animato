import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute, PublicOnlyRoute, VerifyRoute } from './components/Guards'
import { FullPageSpinner } from './components/ui'
import ForgotPassword from './pages/ForgotPassword'
import Landing from './pages/Landing'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import Signup from './pages/Signup'
import Studio from './pages/Studio'
import VerifyEmail from './pages/VerifyEmail'
import { useAuthStore } from './store/authStore'

function App() {
  const isCheckingAuth = useAuthStore((state) => state.isCheckingAuth)
  const checkAuth = useAuthStore((state) => state.checkAuth)

  // The cookie cannot be read from here, so ask the server who is logged in.
  useEffect(() => {
    void checkAuth()
  }, [checkAuth])

  // Nothing is routed until the answer is in, so a logged-in user never sees
  // the landing page flash and a logged-out one never sees the studio.
  if (isCheckingAuth) return <FullPageSpinner />

  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
      </Route>

      <Route element={<VerifyRoute />}>
        <Route path="/verify-email" element={<VerifyEmail />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<Studio />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
