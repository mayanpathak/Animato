// Starts a video from a prompt: POST /api/jobs, a local Video with its first
// take, then the video page. Shared by the Videos composer strip and Create.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@/app/nav'
import { mapCreateJobError } from '@/lib/api/errors'
import { useCreateJob } from '@/lib/local/hooks'
import { useQuota } from '@/lib/quota'
import { useSession } from '@/stores/session'
import { promptError } from '@/lib/validation'
import {
  buildServerPrompt,
  resolveLibrary,
  serverPromptError,
  type Engine,
  type StudioOptions,
} from './prompt'

export const DEFAULT_OPTIONS: StudioOptions = {
  aspect: '16:9',
  duration: 20,
  style: 'Cinematic',
  captions: false,
}

export function useStartVideo() {
  const createJob = useCreateJob()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  const start = async (prompt: string, engine: Engine, options: StudioOptions = DEFAULT_OPTIONS) => {
    setError(null)
    const text = prompt.trim()
    const serverPrompt = buildServerPrompt(text, options, null)
    const local = promptError(text) ?? serverPromptError(serverPrompt)
    if (local) {
      setError(local)
      return
    }
    try {
      const { video } = await createJob.mutateAsync({
        prompt: text,
        library: resolveLibrary(engine, text),
        serverPrompt,
        options: {
          aspect: options.aspect,
          duration: options.duration,
          style: options.style,
          brandKitId: null,
        },
      })
      navigate(ROUTES.video(video.id))
    } catch (err) {
      const mapped = mapCreateJobError(err)
      if (mapped.action === 'login') {
        navigate(`/login?next=${encodeURIComponent(location.pathname + location.search)}`)
        return
      }
      if (mapped.action === 'verify') {
        await useSession.getState().checkAuth()
        navigate('/verify-email')
        return
      }
      if (mapped.action === 'wait' && mapped.retryAfter) useQuota.getState().block(mapped.retryAfter)
      setError(mapped.message)
    }
  }

  return { start, pending: createJob.isPending, error, clearError: () => setError(null) }
}
