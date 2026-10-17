import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { ProtectedRoute, PublicOnlyRoute, VerifyRoute } from './guards'
import { FullPageSpinner } from '@/components/ui/spinner'

const Landing = lazy(() => import('@/features/landing/LandingPage'))
const Pricing = lazy(() => import('@/features/landing/PricingPage'))
const Login = lazy(() => import('@/features/auth/LoginPage'))
const Signup = lazy(() => import('@/features/auth/SignupPage'))
const ForgotPassword = lazy(() => import('@/features/auth/ForgotPasswordPage'))
const ResetPassword = lazy(() => import('@/features/auth/ResetPasswordPage'))
const VerifyEmail = lazy(() => import('@/features/auth/VerifyEmailPage'))
const Videos = lazy(() => import('@/features/videos/VideosPage'))
const Create = lazy(() => import('@/features/create/CreatePage'))
const VideoPage = lazy(() => import('@/features/videos/VideoPage'))
const Brand = lazy(() => import('@/features/brand/BrandPage'))
const Settings = lazy(() => import('@/features/settings/SettingsPage'))
const NotFound = lazy(() => import('./NotFound'))
// The signed-in shell (command palette, menus) and the old-route redirects
// are not needed by the landing page: loaded with the first app route (15.1).
const AppShell = lazy(() => import('./AppShell').then((m) => ({ default: m.AppShell })))
const redirects = () => import('@/features/videos/redirects')
const CreateRedirect = lazy(() => redirects().then((m) => ({ default: m.CreateRedirect })))
const EditRedirect = lazy(() => redirects().then((m) => ({ default: m.EditRedirect })))
const JobRedirect = lazy(() => redirects().then((m) => ({ default: m.JobRedirect })))

function S({ children }: { children: ReactNode }) {
  return <Suspense fallback={<FullPageSpinner />}>{children}</Suspense>
}

function PageSuspense({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <div className="skeleton h-12 rounded-xl" />
          <div className="skeleton mt-10 h-48 rounded-xl" />
        </div>
      }
    >
      {children}
    </Suspense>
  )
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <S>
        <Landing />
      </S>
    ),
  },
  {
    path: '/pricing',
    element: (
      <S>
        <Pricing />
      </S>
    ),
  },
  {
    element: <PublicOnlyRoute />,
    children: [
      {
        path: '/login',
        element: (
          <S>
            <Login />
          </S>
        ),
      },
      {
        path: '/signup',
        element: (
          <S>
            <Signup />
          </S>
        ),
      },
      {
        path: '/forgot-password',
        element: (
          <S>
            <ForgotPassword />
          </S>
        ),
      },
      {
        path: '/reset-password/:token',
        element: (
          <S>
            <ResetPassword />
          </S>
        ),
      },
    ],
  },
  {
    element: <VerifyRoute />,
    children: [
      {
        path: '/verify-email',
        element: (
          <S>
            <VerifyEmail />
          </S>
        ),
      },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/app/v/:id',
        element: (
          <S>
            <VideoPage />
          </S>
        ),
      },
      // Old routes (plan 3.1): no link breaks.
      {
        path: '/app/create',
        element: (
          <S>
            <CreateRedirect />
          </S>
        ),
      },
      { path: '/app/templates', element: <Navigate to="/app/new" replace /> },
      { path: '/app/projects', element: <Navigate to="/app" replace /> },
      {
        path: '/app/projects/:id/edit',
        element: (
          <S>
            <EditRedirect />
          </S>
        ),
      },
      {
        path: '/app/jobs/:id',
        element: (
          <S>
            <JobRedirect />
          </S>
        ),
      },
      {
        element: (
          <S>
            <AppShell />
          </S>
        ),
        children: [
          {
            path: '/app',
            element: (
              <PageSuspense>
                <Videos />
              </PageSuspense>
            ),
          },
          {
            path: '/app/new',
            element: (
              <PageSuspense>
                <Create />
              </PageSuspense>
            ),
          },
          {
            path: '/app/brand',
            element: (
              <PageSuspense>
                <Brand />
              </PageSuspense>
            ),
          },
          {
            path: '/app/settings',
            element: (
              <PageSuspense>
                <Settings />
              </PageSuspense>
            ),
          },
          {
            path: '/app/*',
            element: (
              <PageSuspense>
                <NotFound />
              </PageSuspense>
            ),
          },
        ],
      },
    ],
  },
  {
    path: '*',
    element: (
      <S>
        <NotFound />
      </S>
    ),
  },
])
