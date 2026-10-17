import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate, useOutlet } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { CreditCard, Keyboard, LogOut, Palette, Plus, Search, Settings } from 'lucide-react'
import { ROUTES } from './nav'
import { CommandPalette, usePalette } from './CommandPalette'
import { ShortcutsSheet } from './ShortcutsSheet'
import { isTyping, useShortcuts } from './shortcuts'
import { Logo } from '@/components/brand/Logo'
import { Avatar } from '@/components/ui/misc'
import { IconButton, buttonClass } from '@/components/ui/button'
import { Menu } from '@/components/ui/menu'
import { cn } from '@/lib/cn'
import { duration, ease } from '@/lib/motion'
import { errorMessage } from '@/lib/api/http'
import { useSession } from '@/stores/session'
import { toast } from '@/stores/toast'

function UserMenu() {
  const user = useSession((s) => s.user)
  const logout = useSession((s) => s.logout)
  const navigate = useNavigate()
  if (!user) return null
  return (
    <Menu
      align="end"
      trigger={(p) => (
        <button
          {...p}
          type="button"
          aria-label="Account menu"
          data-testid="account-menu"
          className="grid size-9 place-items-center rounded-full"
        >
          <Avatar name={user.username} size={30} />
        </button>
      )}
      header={
        <div className="border-b border-line px-2 pt-1.5 pb-2.5">
          <p className="text-sm font-medium">{user.username}</p>
          <p className="truncate text-xs text-fg-subtle">{user.email}</p>
        </div>
      }
      items={[
        { label: 'Brand kit', icon: <Palette />, onSelect: () => navigate(ROUTES.brand) },
        { label: 'Settings', icon: <Settings />, onSelect: () => navigate(ROUTES.settings) },
        { label: 'Pricing', icon: <CreditCard />, onSelect: () => navigate(ROUTES.pricing) },
        {
          label: 'Keyboard shortcuts',
          icon: <Keyboard />,
          shortcut: '?',
          onSelect: () => useShortcuts.getState().setOpen(true),
        },
        'separator',
        {
          label: 'Log out',
          icon: <LogOut />,
          onSelect: async () => {
            try {
              await logout()
              navigate('/login')
            } catch (e) {
              toast.error('Could not log out', errorMessage(e))
            }
          },
        },
      ]}
    />
  )
}

/** Hairline and translucency appear only once content scrolls under the bar. */
function useScrolled(): boolean {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 4)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  return scrolled
}

/** The slim top bar (plan 3.2): wordmark, Videos, + New video, account. */
export function TopBar() {
  const scrolled = useScrolled()
  const openPalette = usePalette((s) => s.setOpen)
  return (
    <header
      className={cn(
        'sticky top-0 z-[var(--z-sticky)] border-b transition-[background-color,border-color] duration-[var(--duration-base)]',
        scrolled ? 'bar-blur border-line' : 'border-transparent bg-canvas',
      )}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 sm:gap-6 sm:px-6">
        <Link to={ROUTES.videos} aria-label="Animato, your videos" className="rounded-md">
          <Logo className="[&>span:last-child]:hidden sm:[&>span:last-child]:inline" />
        </Link>
        <nav aria-label="Main">
          <NavLink
            to={ROUTES.videos}
            end
            className={({ isActive }) =>
              cn(
                'rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
                isActive ? 'text-fg' : 'text-fg-subtle hover:text-fg',
              )
            }
          >
            Videos
          </NavLink>
        </nav>
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <IconButton label="Search (⌘K)" onClick={() => openPalette(true)}>
            <Search />
          </IconButton>
          <Link
            to={ROUTES.newVideo}
            data-testid="new-video"
            className={buttonClass('primary', 'sm', 'px-3 sm:px-3.5')}
            aria-label="New video"
          >
            <Plus />
            <span className="hidden sm:inline">New video</span>
          </Link>
          <UserMenu />
        </div>
      </div>
    </header>
  )
}

/** App-wide keys: N opens the composer (plan 3.2). */
function useAppKeys() {
  const navigate = useNavigate()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e)) return
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        navigate(ROUTES.newVideo)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])
}

/** Global overlays every signed-in screen shares (palette, shortcuts, keys). */
export function AppChrome() {
  useAppKeys()
  return (
    <>
      <CommandPalette />
      <ShortcutsSheet />
    </>
  )
}

export function AppShell() {
  const location = useLocation()
  const outlet = useOutlet()

  useEffect(() => {
    document.getElementById('main')?.focus({ preventScroll: true })
  }, [location.pathname])

  return (
    <div className="min-h-dvh bg-canvas">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[var(--z-toast)] focus:rounded-md focus:bg-surface-3 focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <TopBar />
      <main id="main" tabIndex={-1} className="focus:outline-none">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: duration.fast, ease: ease.outExpo }}
          >
            {outlet}
          </motion.div>
        </AnimatePresence>
      </main>
      <AppChrome />
    </div>
  )
}
