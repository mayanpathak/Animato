import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from './AppShell'
import { ProtectedRoute, PublicOnlyRoute, VerifyRoute } from './guards'
import { FullPageSpinner } from '@/components/ui/spinner'

const Landing = lazy(() => import('@/features/landing/LandingPage'))
const Pricing = lazy(() => import('@/features/landing/PricingPage'))
const Login = lazy(() => import('@/features/auth/LoginPage'))
const Signup = lazy(() => import('@/features/auth/SignupPage'))
const ForgotPassword = lazy(() => import('@/features/auth/ForgotPasswordPage'))
const ResetPassword = lazy(() => import('@/features/auth/ResetPasswordPage'))
const VerifyEmail = lazy(() => import('@/features/auth/VerifyEmailPage'))
const Home = lazy(() => import('@/features/home/HomePage'))
const Create = lazy(() => import('@/features/create/CreatePage'))
const JobPage = lazy(() => import('@/features/jobs/JobPage'))
const Projects = lazy(() => import('@/features/projects/ProjectsPage'))
const Editor = lazy(() => import('@/features/editor/EditorPage'))
const Templates = lazy(() => import('@/features/templates/TemplatesPage'))
const Brand = lazy(() => import('@/features/brand/BrandPage'))
const Settings = lazy(() => import('@/features/settings/SettingsPage'))
const NotFound = lazy(() => import('./NotFound'))

function S({ children }: { children: ReactNode }) {
  return <Suspense fallback={<FullPageSpinner />}>{children}</Suspense>
}

function PageSuspense({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="skeleton h-8 w-56 rounded-md" />
          <div className="skeleton mt-6 h-40 rounded-xl" />
        </div>
      }
    >
      {children}
    </Suspense>
  )
}

export const router = createBrowserRouter([
  { path: '/', element: <S><Landing /></S> },
  { path: '/pricing', element: <S><Pricing /></S> },
  {
    element: <PublicOnlyRoute />,
    children: [
      { path: '/login', element: <S><Login /></S> },
      { path: '/signup', element: <S><Signup /></S> },
      { path: '/forgot-password', element: <S><ForgotPassword /></S> },
      { path: '/reset-password/:token', element: <S><ResetPassword /></S> },
    ],
  },
  { element: <VerifyRoute />, children: [{ path: '/verify-email', element: <S><VerifyEmail /></S> }] },
  {
    element: <ProtectedRoute />,
    children: [
      { path: '/app/projects/:id/edit', element: <S><Editor /></S> },
      {
        element: <AppShell />,
        children: [
          { path: '/app', element: <PageSuspense><Home /></PageSuspense> },
          { path: '/app/create', element: <PageSuspense><Create /></PageSuspense> },
          { path: '/app/jobs/:id', element: <PageSuspense><JobPage /></PageSuspense> },
          { path: '/app/projects', element: <PageSuspense><Projects /></PageSuspense> },
          { path: '/app/templates', element: <PageSuspense><Templates /></PageSuspense> },
          { path: '/app/brand', element: <PageSuspense><Brand /></PageSuspense> },
          { path: '/app/settings', element: <PageSuspense><Settings /></PageSuspense> },
          { path: '/app/*', element: <PageSuspense><NotFound /></PageSuspense> },
        ],
      },
    ],
  },
  { path: '*', element: <S><NotFound /></S> },
])


