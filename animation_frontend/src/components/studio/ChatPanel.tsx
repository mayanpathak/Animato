import { useEffect, useRef, useState, type KeyboardEvent, type SyntheticEvent } from 'react'
import { charCount, PROMPT_MAX, PROMPT_MIN } from '../../lib/validation'
import { findActiveJob, useStudioStore } from '../../store/studioStore'
import { isFinished, isLibrary, LIBRARIES, STATUS_LABELS, type Job } from '../../types'
import { Button, FormError, Spinner } from '../ui'

const LIBRARY_LABELS = { remotion: 'Remotion', manim: 'Manim' } as const

function StatusBubble({ job }: { job: Job }) {
  if (job.status === 'Failed') {
    return (
      <div className="max-w-[85%] rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        This video could not be generated.
        {job.errorMessage && (
          <details className="mt-1">
            <summary className="cursor-pointer text-xs">Details</summary>
            {/* Raw worker output: plain text only. */}
            <pre className="mt-1 whitespace-pre-wrap break-words text-xs">{job.errorMessage}</pre>
          </details>
        )}
      </div>
    )
  }

  return (
    <div className="flex max-w-[85%] items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700">
      {!isFinished(job.status) && <Spinner className="h-4 w-4" />}
      {job.status === 'Completed' ? 'Your video is ready.' : `${STATUS_LABELS[job.status]}…`}
    </div>
  )
}

export function ChatPanel() {
  const jobs = useStudioStore((state) => state.jobs)
  const library = useStudioStore((state) => state.library)
  const isSubmitting = useStudioStore((state) => state.isSubmitting)
  const error = useStudioStore((state) => state.error)
  const pollStalled = useStudioStore((state) => state.pollStalled)
  const setLibrary = useStudioStore((state) => state.setLibrary)
  const submitPrompt = useStudioStore((state) => state.submitPrompt)
  const resumePolling = useStudioStore((state) => state.resumePolling)

  const [prompt, setPrompt] = useState('')
  const endOfLog = useRef<HTMLDivElement>(null)

  const activeJob = findActiveJob(jobs)
  const busy = isSubmitting || activeJob !== undefined
  const length = charCount(prompt.trim())

  const lastStatus = jobs.at(-1)?.status

  useEffect(() => {
    endOfLog.current?.scrollIntoView({ block: 'end' })
  }, [jobs.length, lastStatus])

  const send = async () => {
    if (busy) return

    const ok = await submitPrompt(prompt)
    if (ok) setPrompt('')
  }

  const handleSubmit = (event: SyntheticEvent) => {
    event.preventDefault()
    void send()
  }

  // Enter sends; Shift+Enter makes a new line.
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      void send()
    }
  }

  return (
    <section className="flex min-h-80 flex-1 flex-col rounded-lg border border-zinc-200 bg-zinc-50">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {jobs.length === 0 && (
          <p className="text-sm text-zinc-500">
            Describe the animation you want. Each prompt makes a new video.
          </p>
        )}

        {jobs.map((job) => (
          <div key={job.jobId} className="space-y-2">
            <div className="ml-auto w-fit max-w-[85%] whitespace-pre-wrap break-words rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white">
              {job.prompt}
              <span className="mt-1 block text-xs text-zinc-400">{LIBRARY_LABELS[job.library]}</span>
            </div>

            <StatusBubble job={job} />
          </div>
        ))}

        {pollStalled && activeJob && (
          <div className="flex items-center gap-3 text-sm text-zinc-600">
            Lost track of this video.
            <Button variant="secondary" onClick={resumePolling}>
              Check again
            </Button>
          </div>
        )}

        <div ref={endOfLog} />
      </div>

      <form onSubmit={handleSubmit} className="space-y-2 border-t border-zinc-200 bg-white p-3">
        <FormError message={error} />

        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={busy}
          rows={3}
          aria-label="Prompt"
          placeholder={
            activeJob ? 'Your video is being made…' : 'A blue circle that morphs into a square…'
          }
          className="w-full resize-none rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 disabled:bg-zinc-100"
        />

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            Library
            <select
              value={library}
              onChange={(event) => {
                if (isLibrary(event.target.value)) setLibrary(event.target.value)
              }}
              disabled={busy}
              className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-zinc-900"
            >
              {LIBRARIES.map((name) => (
                <option key={name} value={name}>
                  {LIBRARY_LABELS[name]}
                </option>
              ))}
            </select>
          </label>

          <span
            className={`ml-auto text-xs ${length > PROMPT_MAX ? 'text-red-600' : 'text-zinc-500'}`}
          >
            {length} / {PROMPT_MAX}
          </span>

          <Button type="submit" busy={isSubmitting} disabled={busy || length < PROMPT_MIN}>
            Generate
          </Button>
        </div>
      </form>
    </section>
  )
}
