import { useEffect, useId, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { Logo } from '@/components/brand/Logo'
import { buttonClass } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { ease } from '@/lib/motion'
import { useSession } from '@/stores/session'

interface NavItem {
  label: string
  /** In-page anchor on the landing page, or a route. */
  hash?: string
  to?: string
}

const ITEMS: NavItem[] = [
  { label: 'Features', hash: 'features' },
  { label: 'Editor', hash: 'editor' },
  { label: 'Pricing', to: '/pricing' },
  { label: 'FAQ', hash: 'faq' },
]

function NavLinkItem({
  item,
  onLanding,
  className,
  onNavigate,
}: {
  item: NavItem
  onLanding: boolean
  className: string
  onNavigate?: () => void
}) {
  if (item.hash && onLanding) {
    return (
      <a href={`#${item.hash}`} className={className} onClick={onNavigate}>
        {item.label}
      </a>
    )
  }
  return (
    <Link to={item.to ?? `/#${item.hash}`} className={className} onClick={onNavigate}>
      {item.label}
    </Link>
  )
}

export function Navbar() {
  const { pathname } = useLocation()
  const onLanding = pathname === '/'
  const user = useSession((s) => s.user)
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const menuId = useId()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onResize = () => {
      if (window.innerWidth >= 768) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
    }
  }, [open])

  const linkClass =
    'rounded-md px-3 py-1.5 text-sm text-fg-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg'

  return (
    <header className="sticky top-0 z-[var(--z-sticky)] px-2 pt-2 sm:px-4">
      <div
        className={cn(
          'mx-auto w-full max-w-7xl rounded-2xl border transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300 ease-out-expo',
          scrolled || open
            ? 'border-line-strong bg-glass-strong shadow-md backdrop-blur-xl'
            : 'border-transparent bg-transparent',
        )}
      >
        <nav
          aria-label="Main"
          className={cn(
            'flex items-center justify-between gap-4 px-3 transition-[height] duration-300 ease-out-expo sm:px-4',
            scrolled ? 'h-12' : 'h-16',
          )}
        >
          <Link to="/" aria-label="Animato home" className="rounded-md">
            <Logo />
          </Link>

          <ul className="hidden items-center gap-1 md:flex">
            {ITEMS.map((item) => (
              <li key={item.label}>
                <NavLinkItem
                  item={item}
                  onLanding={onLanding}
                  className={cn(linkClass, item.to === pathname && 'text-fg')}
                />
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2">
            {user ? (
              <Link to="/app" className={buttonClass('primary', 'sm', 'hidden sm:inline-flex')}>
                Open studio
              </Link>
            ) : (
              <>
                <Link to="/login" className={buttonClass('ghost', 'sm', 'hidden sm:inline-flex')}>
                  Log in
                </Link>
                <Link to="/signup" className={buttonClass('primary', 'sm', 'hidden sm:inline-flex')}>
                  Start creating free
                </Link>
              </>
            )}
            <button
              type="button"
              className="inline-grid size-9 place-items-center rounded-md text-fg-muted hover:bg-surface-2 hover:text-fg md:hidden"
              aria-expanded={open}
              aria-controls={menuId}
              aria-label={open ? 'Close menu' : 'Open menu'}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </nav>

        <AnimatePresence initial={false}>
          {open ? (
            <motion.div
              id={menuId}
              key="menu"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.24, ease: ease.outExpo }}
              className="border-t border-line px-3 pt-2 pb-4 md:hidden"
            >
              <ul className="flex flex-col">
                {ITEMS.map((item) => (
                  <li key={item.label}>
                    <NavLinkItem
                      item={item}
                      onLanding={onLanding}
                      onNavigate={() => setOpen(false)}
                      className="block rounded-md px-3 py-2.5 text-base text-fg-muted hover:bg-surface-2 hover:text-fg"
                    />
                  </li>
                ))}
              </ul>
              <div className="mt-3 grid gap-2">
                {user ? (
                  <Link to="/app" className={buttonClass('primary', 'lg', 'w-full')}>
                    Open studio
                  </Link>
                ) : (
                  <>
                    <Link to="/signup" className={buttonClass('primary', 'lg', 'w-full')}>
                      Start creating free
                    </Link>
                    <Link to="/login" className={buttonClass('secondary', 'lg', 'w-full')}>
                      Log in
                    </Link>
                  </>
                )}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </header>
  )
}
