import { Link } from 'react-router-dom'
import { buttonClass } from '@/components/ui/button'
import { useTitle } from '@/lib/useTitle'

export default function NotFound() {
  useTitle('Page not found')
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-canvas px-6">
      <div
        aria-hidden
        className="grid-bg absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]"
      />
      <div className="relative text-center">
        <p className="font-display text-[clamp(5rem,18vw,11rem)] leading-none font-semibold tracking-tightest text-gradient">
          404
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">This frame was cut.</h1>
        <p className="mt-2 text-sm text-fg-muted">The page you asked for does not exist, or it moved.</p>
        <div className="mt-7 flex justify-center gap-2">
          <Link to="/" className={buttonClass('secondary')}>
            Home
          </Link>
          <Link to="/app" className={buttonClass('primary')}>
            Open the studio
          </Link>
        </div>
      </div>
    </main>
  )
}
