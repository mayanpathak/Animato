// A prompt typed on the landing page before the visitor had an account
// (plan 5.1). It survives signup, email verification and a login of an
// existing user in sessionStorage (this tab only), with the engine choice,
// and becomes the user's first video.
import type { Engine } from '@/features/create/prompt'

const KEY = 'animato:pending-prompt'

export interface PendingPrompt {
  prompt: string
  engine: Engine
}

const ENGINES: Engine[] = ['auto', 'manim', 'remotion']

export function savePendingPrompt(prompt: string | null | undefined, engine: Engine = 'auto'): void {
  const value = prompt?.trim()
  if (!value) return
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ prompt: value.slice(0, 2000), engine }))
  } catch {
    // storage disabled: the prompt is simply not carried over
  }
}

export function readPendingPrompt(): PendingPrompt | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PendingPrompt>
    if (typeof parsed.prompt !== 'string' || !parsed.prompt.trim()) return null
    const engine = ENGINES.includes(parsed.engine as Engine) ? (parsed.engine as Engine) : 'auto'
    return { prompt: parsed.prompt, engine }
  } catch {
    return null
  }
}

export function clearPendingPrompt(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // nothing to clear
  }
}

/** Only in-app paths are honoured, never another origin. */
export function safeNext(next: string | null): string | null {
  return next && next.startsWith('/app') && !next.startsWith('//') ? next : null
}
