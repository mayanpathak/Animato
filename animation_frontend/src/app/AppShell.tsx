import { useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate, useOutlet } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { useQuery } from '@tanstack/react-query'
import { ChevronsLeft, HardDrive, LogOut, Menu as MenuIcon, Search, Settings, Sparkles } from 'lucide-react'
import { NAV } from './nav'
import { CommandPalette, usePalette } from './CommandPalette'
import { Logo } from '@/components/brand/Logo'
import { Avatar, Kbd, StatusChip } from '@/components/ui/misc'
import { IconButton, buttonClass } from '@/components/ui/button'
import { Menu } from '@/components/ui/menu'
import { Drawer } from '@/components/ui/dialog'
import { cn } from '@/lib/cn'
import { spring } from '@/lib/motion'
import { formatBytes } from '@/lib/format'
import { storageUsage } from '@/lib/local/opfs'
import { useJob, useJobHistory } from '@/lib/local/hooks'
import { isFinished } from '@/lib/api/types'
import { errorMessage } from '@/lib/api/http'
import { usePreferences } from '@/stores/preferences'
import { useSession } from '@/stores/session'
import { toast } from '@/stores/toast'

function SidebarNav({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          title={collapsed ? item.label : undefined}
          className={({ isActive }) =>
            cn(
              'relative flex h-9 items-center gap-3 rounded-md px-2.5 text-sm font-medium transition-colors [&_svg]:size-4 [&_svg]:shrink-0',
              isActive ? 'text-fg' : 'text-fg-subtle hover:bg-surface-2 hover:text-fg-muted',
              collapsed && 'justify-center px-0',
            )
          }
        >
          {({ isActive }) => (
            <>
              {isActive ? (
                <motion.span
                  layoutId="sidebar-active"
                  transition={spring.layout}
                  className="absolute inset-0 rounded-md border border-line bg-surface-3 shadow-inner-highlight"
                >
                  <span className="absolute top-2 bottom-2 left-0 w-0.5 rounded-full bg-gradient-accent" />
                </motion.span>
              ) : null}
              <item.icon className="relative" />
              {collapsed ? null : <span className="relative">{item.label}</span>}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

function StorageMeter({ collapsed }: { collapsed: boolean }) {
  const { data } = useQuery({ queryKey: ['storage'], queryFn: storageUsage, refetchInterval: 30_000 })
  if (!data || collapsed) return null
  const pct = data.quota ? data.usage / data.quota : 0
  return (
    <div className="rounded-lg border border-line bg-surface-1 p-3">
      <div className="flex items-center gap-2 text-xs text-fg-muted">
        <HardDrive className="size-3.5" /> Local storage
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-3">
        <div
          className="h-full rounded-full bg-gradient-accent"
          style={{ width: `${Math.max(2, pct * 100)}%` }}
        />
      </div>
      <p className="mt-1.5 font-mono text-2xs text-fg-faint">
        {formatBytes(data.usage)} of {formatBytes(data.quota)}
      </p>
    </div>
  )
}

/** The newest unfinished job, shown live in the top bar. */
function ActiveJob() {
  const history = useJobHistory()
  const [mountedAt] = useState(() => Date.now())
  const latest = history.data?.[0]
  const recent = latest && mountedAt - latest.createdAt < 30 * 60_000 ? latest : undefined
  const job = useJob(recent?.id)
  const navigate = useNavigate()
  if (!recent || !job.data || isFinished(job.data.status)) return null
  return (
    <button
      type="button"
      onClick={() => navigate(`/app/jobs/${recent.id}`)}
      className="hidden items-center gap-2 rounded-full border border-line bg-surface-1 py-1 pr-1 pl-3 text-xs text-fg-muted transition-colors hover:border-line-strong md:flex"
    >
      <span className="max-w-40 truncate">{recent.prompt}</span>
      <StatusChip status={job.data.status} />
    </button>
  )
}

function UserMenu() {
  const user = useSession((s) => s.user)
  const logout = useSession((s) => s.logout)
  const navigate = useNavigate()
  if (!user) return null
  return (
    <Menu
      trigger={(p) => (
        <button
          {...p}
          type="button"
          aria-label="Account menu"
          className="rounded-full ring-offset-2 ring-offset-canvas focus-visible:ring-2"
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
        { label: 'Settings', icon: <Settings />, onSelect: () => navigate('/app/settings') },
        'separator',
        {
          label: 'Log out',
          icon: <LogOut />,
          danger: true,
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

export function AppShell() {
  const collapsed = usePreferences((s) => s.sidebarCollapsed)
  const toggle = usePreferences((s) => s.toggleSidebar)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const outlet = useOutlet()
  const openPalette = usePalette((s) => s.setOpen)

  useEffect(() => {
    document.getElementById('main')?.focus({ preventScroll: true })
  }, [location.pathname])

  return (
    <div className="flex min-h-dvh bg-canvas">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[var(--z-toast)] focus:rounded-md focus:bg-surface-3 focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 64 : 240 }}
        transition={spring.layout}
        className="sticky top-0 z-[var(--z-sidebar)] hidden h-dvh shrink-0 flex-col border-r border-line bg-surface-1/60 px-3 py-4 backdrop-blur-xl lg:flex"
      >
        <div className={cn('flex items-center px-1', collapsed ? 'justify-center' : 'justify-between')}>
          <NavLink to="/app" aria-label="Animato home">
            <Logo collapsed={collapsed} />
          </NavLink>
          {collapsed ? null : (
            <IconButton label="Collapse sidebar" size="sm" onClick={toggle}>
              <ChevronsLeft />
            </IconButton>
          )}
        </div>
        <NavLink
          to="/app/create"
          className={buttonClass('primary', 'md', cn('mt-6 w-full', collapsed && 'px-0'))}
          title="New animation"
        >
          <Sparkles className="size-4" />
          {collapsed ? null : 'New animation'}
        </NavLink>
        <div className="mt-5 flex-1">
          <SidebarNav collapsed={collapsed} />
        </div>
        <StorageMeter collapsed={collapsed} />
        {collapsed ? (
          <IconButton label="Expand sidebar" size="sm" onClick={toggle} className="mx-auto mt-3 rotate-180">
            <ChevronsLeft />
          </IconButton>
        ) : null}
      </motion.aside>

      <Drawer open={mobileOpen} onClose={() => setMobileOpen(false)} title={<Logo />} side="left">
        <div className="flex flex-col gap-5 p-4">
          <SidebarNav collapsed={false} onNavigate={() => setMobileOpen(false)} />
          <StorageMeter collapsed={false} />
        </div>
      </Drawer>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-[var(--z-sticky)] flex h-14 items-center gap-3 border-b border-line bg-canvas/75 px-4 backdrop-blur-xl sm:px-6">
          <IconButton label="Open menu" className="lg:hidden" onClick={() => setMobileOpen(true)}>
            <MenuIcon />
          </IconButton>
          <button
            type="button"
            onClick={() => openPalette(true)}
            className="flex h-8 w-full max-w-sm items-center gap-2 rounded-md border border-line bg-surface-1 px-2.5 text-sm text-fg-faint transition-colors hover:border-line-strong hover:text-fg-subtle"
          >
            <Search className="size-3.5" />
            <span className="flex-1 text-left">Search or jump to…</span>
            <span className="hidden gap-1 sm:flex">
              <Kbd>⌘</Kbd>
              <Kbd>K</Kbd>
            </span>
          </button>
          <div className="ml-auto flex items-center gap-3">
            <ActiveJob />
            <UserMenu />
          </div>
        </header>
        <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            >
              {outlet}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <CommandPalette />
    </div>
  )
}
