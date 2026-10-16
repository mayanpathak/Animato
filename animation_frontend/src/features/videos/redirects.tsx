// Old links keep working (plan 3.1 redirect table).
import { useEffect } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ROUTES } from '@/app/nav'
import { FullPageSpinner } from '@/components/ui/spinner'
import { isJobId } from '@/lib/api/http'
import { useOwner } from '@/lib/local/hooks'
import { usePreferences } from '@/stores/preferences'
import { ensureVideoForJob } from './model'

/** `/app/create?…` → `/app/new?…` (the query, e.g. a remix prompt, is kept). */
export function CreateRedirect() {
  const { search } = useLocation()
  return <Navigate to={`${ROUTES.newVideo}${search}`} replace />
}

/** `/app/projects/:id/edit` → `/app/v/:id?mode=timeline`. */
export function EditRedirect() {
  const { id = '' } = useParams()
  return <Navigate to={`${ROUTES.video(id)}?mode=timeline`} replace />
}

/** `/app/jobs/:jobId` → the video that owns the job (created if this browser has none). */
export function JobRedirect() {
  const { id = '' } = useParams()
  const owner = useOwner()
  const navigate = useNavigate()
  useEffect(() => {
    if (!owner) return
    if (!isJobId(id)) {
      navigate(ROUTES.videos, { replace: true })
      return
    }
    let live = true
    void ensureVideoForJob(owner, id, usePreferences.getState().defaultFormat).then((v) => {
      if (live) navigate(ROUTES.video(v.id), { replace: true })
    })
    return () => {
      live = false
    }
  }, [id, owner, navigate])
  return <FullPageSpinner />
}
