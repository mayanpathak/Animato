import { Link } from 'react-router-dom'
import { buttonClass } from '@/components/ui/button'
import { useSession } from '@/stores/session'
import { container } from '../components/SectionHeading'

export function FinalCta() {
  const user = useSession((s) => s.user)
  return (
    <section aria-labelledby="cta-title" className="pb-24 sm:pb-32">
      <div className={container}>
        <div
          data-reveal
          className="relative isolate overflow-hidden rounded-3xl border border-line-strong bg-surface-1 px-6 py-16 text-center shadow-lg sm:px-12 sm:py-20"
        >
          <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-accent-soft" />
          <div
            aria-hidden
            className="absolute inset-0 -z-10 grid-bg opacity-50 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]"
          />
          <h2
            id="cta-title"
            className="mx-auto max-w-2xl font-display text-3xl font-semibold tracking-tighter text-balance text-fg sm:text-5xl"
          >
            Your next explainer is one sentence away.
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-base text-fg-muted sm:text-lg">
            Render it with Manim or Remotion, then finish it in your browser. Free to start, no card required.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            {user ? (
              <Link to="/app/create" className={buttonClass('primary', 'lg')}>
                Create an animation
              </Link>
            ) : (
              <Link to="/signup" className={buttonClass('primary', 'lg')}>
                Start creating free
              </Link>
            )}
            <Link to="/pricing" className={buttonClass('secondary', 'lg')}>
              See pricing
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
