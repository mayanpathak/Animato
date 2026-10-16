// Starts a video from a prompt: POST /api/jobs, a local Video with its first
// take, then the video page. Shared by Create, the Videos composer strip and
// the composer sheet.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@/app/nav'
import { track } from '@/lib/analytics'
import { mapCreateJobError } from '@/lib/api/errors'
import { useBrandKits, useCreateJob } from '@/lib/local/hooks'
import { useQuota } from '@/lib/quota'
import { promptError } from '@/lib/validation'
import { useSession } from '@/stores/session'
import {
  buildServerPrompt,
  DEFAULT_OPTIONS,
  lengthSeconds,
  resolveLibrary,
  serverPromptError,
  type CreateOptions,
  type Engine,
} from './prompt'

export { DEFAULT_OPTIONS }

export function useStartVideo() {
  const createJob = useCreateJob()
  const navigate = useNavigate()
  const kits = useBrandKits()
  const [error, setError] = useState<string | null>(null)

  /** Resolves true when the job was accepted. */
  const start = async (
    prompt: string,
    engine: Engine,
    options: CreateOptions = DEFAULT_OPTIONS,
    { stay = false }: { stay?: boolean } = {},
  ): Promise<boolean> => {
    setError(null)
    const text = prompt.trim()
    const kit = options.useBrand ? (kits.data?.[0] ?? null) : null
    const serverPrompt = buildServerPrompt(text, options, kit)
    const local = promptError(text) ?? serverPromptError(serverPrompt)
    if (local) {
      setError(local)
      return false
    }
    const library = resolveLibrary(engine, text)
    try {
      const { video } = await createJob.mutateAsync({
        prompt: text,
        library,
        serverPrompt,
        options: {
          aspect: '16:9',
          duration: lengthSeconds(options.length),
          style: options.style,
          brandKitId: kit?.id ?? null,
        },
      })
      track('job_create', { library, from: stay ? 'sheet' : 'composer' })
      if (!stay) navigate(ROUTES.video(video.id))
      return true
    } catch (err) {
      const mapped = mapCreateJobError(err)
      if (mapped.action === 'login') {
        navigate(`/login?next=${encodeURIComponent(location.pathname + location.search)}`)
        return false
      }
      if (mapped.action === 'verify') {
        await useSession.getState().checkAuth()
        navigate('/verify-email')
        return false
      }
      if (mapped.action === 'wait' && mapped.retryAfter) useQuota.getState().block(mapped.retryAfter)
      setError(mapped.message)
      return false
    }
  }

  return { start, pending: createJob.isPending, error, clearError: () => setError(null) }
}
