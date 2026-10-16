export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[var(--z-toast)] focus:rounded-md focus:bg-surface-3 focus:px-3 focus:py-2 focus:text-sm focus:text-fg"
    >
      Skip to content
    </a>
  )
}
