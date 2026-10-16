// Starts another render of a take's prompt on the same video (plan 6.5
// "Try again", 6.6 "+ Another take"), with the options it was made with.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@/app/nav'
import { errorMessage } from '@/lib/api/http'
import { track } from '@/lib/analytics'
import { useCreateJob } from '@/lib/local/hooks'
import { brandTable, jobsTable, type Take } from '@/lib/local/models'
import { buildServerPrompt, optionsFromRecord, recordOptions } from '@/features/create/prompt'
import { DEFAULT_OPTIONS } from '@/features/create/useStartVideo'

export function useAnotherTake(videoId: string) {
  const navigate = useNavigate()
  const createJob = useCreateJob()
  const [error, setError] = useState<string | null>(null)
  const start = async (take: Take, reason: 'retry' | 'another') => {
    setError(null)
    const record = await jobsTable.get(take.jobId)
    const prompt = record?.prompt ?? take.prompt
    const stored = record?.options ?? recordOptions(DEFAULT_OPTIONS, null)
    const options = optionsFromRecord(stored)
    const kit = options.useBrand ? ((await brandTable.get(stored.brandKitId ?? '')) ?? null) : null
    try {
      const { video } = await createJob.mutateAsync({
        prompt,
        library: take.library,
        options: stored,
        serverPrompt: buildServerPrompt(prompt, options, kit),
        videoId,
      })
      track('job_create', { library: take.library, [reason]: true })
      navigate(ROUTES.video(video.id), { replace: true })
    } catch (e) {
      setError(errorMessage(e))
    }
  }
  return { start, pending: createJob.isPending, error }
}
