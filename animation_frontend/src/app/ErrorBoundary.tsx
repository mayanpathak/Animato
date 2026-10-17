import { Component, type ErrorInfo, type ReactNode } from 'react'
import { buttonClass } from '@/components/ui/button'

interface State {
  error: Error | null
  copied: boolean
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, copied: false }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Kept visible in dev tools; there is no remote error reporting.
    console.error(error, info.componentStack)
  }

  /** Error name and stack only: no user data (plan 6.11). */
  private copy = async () => {
    const e = this.state.error
    if (!e) return
    try {
      await navigator.clipboard.writeText(`${e.name}: ${e.message}\n${e.stack ?? ''}`)
      this.setState({ copied: true })
    } catch {
      // clipboard blocked; nothing else to do
    }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="grid min-h-dvh place-items-center bg-canvas px-6">
        <div className="max-w-sm text-center">
          <h1 className="font-display text-2xl font-semibold tracking-tighter">
            Something broke on this screen.
          </h1>
          <p className="mt-3 text-fg-muted">Your videos are stored in this browser and were not affected.</p>
          <div className="mt-7 flex justify-center gap-2">
            <button type="button" className={buttonClass('primary')} onClick={() => location.reload()}>
              Reload
            </button>
            <button type="button" className={buttonClass('secondary')} onClick={() => void this.copy()}>
              {this.state.copied ? 'Copied' : 'Copy details'}
            </button>
          </div>
        </div>
      </div>
    )
  }
}
