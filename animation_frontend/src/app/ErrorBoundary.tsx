import { Component, type ErrorInfo, type ReactNode } from 'react'
import { buttonClass } from '@/components/ui/button'

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Kept visible in dev tools; there is no remote error reporting.
    console.error(error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="grid min-h-dvh place-items-center bg-base px-6">
        <div className="max-w-md text-center">
          <p className="font-mono text-xs tracking-widest text-status-failed uppercase">Unexpected error</p>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">This screen crashed.</h1>
          <p className="mt-3 text-sm text-fg-muted">
            Your projects are stored in this browser and were not affected. Reload to continue where you left off.
          </p>
          <pre className="mt-5 max-h-32 overflow-auto rounded-lg border border-line bg-surface-1 p-3 text-left font-mono text-2xs text-fg-subtle">
            {this.state.error.message}
          </pre>
          <button type="button" className={buttonClass('primary', 'md', 'mt-6')} onClick={() => location.reload()}>
            Reload Animato
          </button>
        </div>
      </div>
    )
  }
}
