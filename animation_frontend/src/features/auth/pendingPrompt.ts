// A prompt typed on the landing page before the visitor had an account. It
// survives signup and email verification in sessionStorage (this tab only)
// and is handed to Prompt Studio once the user lands in the app.

const KEY = 'animato:pending-prompt'

export function savePendingPrompt(prompt: string | null | undefined): void {
  const value = prompt?.trim()
  if (!value) return
  try {
    sessionStorage.setItem(KEY, value.slice(0, 2000))
  } catch {
    // storage disabled: the prompt is simply not carried over
  }
}

export function readPendingPrompt(): string | null {
  try {
    return sessionStorage.getItem(KEY)
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

export function createPathFor(prompt: string): string {
  return `/app/create?prompt=${encodeURIComponent(prompt)}`
}

/** Only in-app paths are honoured, never another origin. */
export function safeNext(next: string | null): string | null {
  return next && next.startsWith('/app') && !next.startsWith('//') ? next : null
}
