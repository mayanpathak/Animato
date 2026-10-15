import { useEffect, useState } from 'react'
import { Command } from 'cmdk'
import { AnimatePresence, motion } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { Clapperboard, FileVideo, LogOut, Plus, Search, Sparkles } from 'lucide-react'
import { NAV } from './nav'
import { useJobHistory, useProjects } from '@/lib/local/hooks'
import { useSession } from '@/stores/session'
import { toast } from '@/stores/toast'
import { errorMessage } from '@/lib/api/http'
import { Kbd } from '@/components/ui/misc'
import { create } from 'zustand'

export const usePalette = create<{ open: boolean; setOpen: (v: boolean) => void }>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}))

const itemClass =
  'flex h-10 cursor-pointer items-center gap-3 rounded-md px-3 text-sm text-fg-muted data-[selected=true]:bg-surface-3 data-[selected=true]:text-fg [&_svg]:size-4 [&_svg]:shrink-0'

export function CommandPalette() {
  const { open, setOpen } = usePalette()
  const navigate = useNavigate()
  const projects = useProjects()
  const jobs = useJobHistory()
  const logout = useSession((s) => s.logout)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        usePalette.getState().setOpen(!usePalette.getState().open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const go = (to: string) => {
    setOpen(false)
    setSearch('')
    navigate(to)
  }

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[var(--z-modal)] flex items-start justify-center px-4 pt-[14vh]">
          <motion.div
            className="absolute inset-0 bg-overlay backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-line-strong bg-glass-strong shadow-lg backdrop-blur-2xl"
          >
            <Command label="Command palette" loop onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
              <div className="flex items-center gap-3 border-b border-line px-4">
                <Search className="size-4 text-fg-faint" />
                <Command.Input
                  autoFocus
                  value={search}
                  onValueChange={setSearch}
                  placeholder="Jump to a page, project or job…"
                  className="h-13 flex-1 bg-transparent text-[15px] text-fg placeholder:text-fg-faint focus:outline-none"
                />
                <Kbd>Esc</Kbd>
              </div>
              <Command.List className="max-h-[52vh] overflow-y-auto p-2">
                <Command.Empty className="px-3 py-8 text-center text-sm text-fg-subtle">Nothing matches “{search}”.</Command.Empty>
                <Command.Group heading="Actions" className="text-2xs text-fg-faint [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:uppercase">
                  <Command.Item className={itemClass} onSelect={() => go('/app/create')}>
                    <Sparkles /> New animation from a prompt
                  </Command.Item>
                  <Command.Item className={itemClass} onSelect={() => go('/app/projects?new=1')}>
                    <Plus /> New empty project
                  </Command.Item>
                  <Command.Item
                    className={itemClass}
                    onSelect={async () => {
                      setOpen(false)
                      try {
                        await logout()
                        navigate('/login')
                      } catch (e) {
                        toast.error('Could not log out', errorMessage(e))
                      }
                    }}
                  >
                    <LogOut /> Log out
                  </Command.Item>
                </Command.Group>
                <Command.Group heading="Navigate" className="text-2xs text-fg-faint [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:uppercase">
                  {NAV.map((n) => (
                    <Command.Item key={n.to} className={itemClass} value={`go ${n.label}`} onSelect={() => go(n.to)}>
                      <n.icon /> {n.label}
                    </Command.Item>
                  ))}
                </Command.Group>
                {projects.data?.length ? (
                  <Command.Group heading="Projects" className="text-2xs text-fg-faint [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:uppercase">
                    {projects.data.slice(0, 8).map((p) => (
                      <Command.Item key={p.id} className={itemClass} value={`project ${p.name} ${p.id}`} onSelect={() => go(`/app/projects/${p.id}/edit`)}>
                        <Clapperboard /> {p.name}
                      </Command.Item>
                    ))}
                  </Command.Group>
                ) : null}
                {jobs.data?.length ? (
                  <Command.Group heading="Recent jobs" className="text-2xs text-fg-faint [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:uppercase">
                    {jobs.data.slice(0, 6).map((j) => (
                      <Command.Item key={j.id} className={itemClass} value={`job ${j.prompt} ${j.id}`} onSelect={() => go(`/app/jobs/${j.id}`)}>
                        <FileVideo /> <span className="truncate">{j.prompt}</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                ) : null}
              </Command.List>
            </Command>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  )
}
