/** The prompt a visitor typed on the landing page, shown above the form (plan 5.1 step 2). */
export function PendingPromptCard({ prompt }: { prompt: string }) {
  return (
    <figure className="mb-6 rounded-control bg-surface-2 px-4 py-3" data-testid="pending-prompt">
      <figcaption className="text-xs text-fg-subtle">Your first video</figcaption>
      <blockquote className="mt-1 line-clamp-3 text-sm text-fg">{prompt}</blockquote>
    </figure>
  )
}
