import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '@/components/brand/Logo'
import { buttonClass } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { useSession } from '@/stores/session'

/** Transparent until scroll, then a solid bar with a hairline (plan 6.1). */
export function MarketingBar() {
  const user = useSession((s) => s.user)
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-[var(--z-sticky)] border-b transition-[background-color,border-color] duration-[var(--duration-base)]',
        scrolled ? 'bar-blur border-line' : 'border-transparent',
      )}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:px-6">
        <Link to="/" aria-label="Animato home" className="rounded-md">
          <Logo />
        </Link>
        <nav aria-label="Site" className="ml-auto flex items-center gap-1 sm:gap-2">
          <Link to="/pricing" className={buttonClass('ghost', 'sm')}>
            Pricing
          </Link>
          {user ? (
            <Link to="/app" className={buttonClass('primary', 'sm', 'rounded-full px-4')}>
              Open Animato
            </Link>
          ) : (
            <>
              <Link to="/login" className={buttonClass('ghost', 'sm')}>
                Log in
              </Link>
              <Link
                to="/signup"
                className={buttonClass('primary', 'sm', 'rounded-full px-4')}
                data-testid="start-free"
              >
                Start free
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
