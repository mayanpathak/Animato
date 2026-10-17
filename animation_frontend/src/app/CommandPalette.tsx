import { useEffect, useState } from 'react'
import { Command } from 'cmdk'
import { AnimatePresence, motion } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { Film, Keyboard, LogOut, Palette, Plus, Search, Settings, Upload } from 'lucide-react'
import { ROUTES } from './nav'
import { useShortcuts } from './shortcuts'
import { useOwner, useProjects } from '@/lib/local/hooks'
import { createVideo } from '@/features/videos/model'
import { usePreferences } from '@/stores/preferences'
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
  const owner = useOwner()
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
            className="absolute inset-0 bg-overlay"
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
            className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface-2 shadow-lg shadow-inner-highlight"
          >
            <Command label="Command palette" loop onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
              <div className="flex items-center gap-3 border-b border-line px-4">
                <Search className="size-4 text-fg-subtle" />
                <Command.Input
                  autoFocus
                  value={search}
                  onValueChange={setSearch}
                  placeholder="Search videos or type a command…"
                  className="h-13 flex-1 bg-transparent text-[15px] text-fg placeholder:text-fg-faint focus:outline-none"
                />
                <Kbd>Esc</Kbd>
              </div>
              <Command.List className="max-h-[52vh] overflow-y-auto p-2">
                <Command.Empty className="px-3 py-8 text-center text-sm text-fg-subtle">
                  Nothing matches “{search}”.
                </Command.Empty>
                <Command.Group
                  heading="Actions"
                  className="text-2xs text-fg-subtle [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:font-medium "
                >
                  <Command.Item className={itemClass} onSelect={() => go(ROUTES.newVideo)}>
                    <Plus /> New video
                  </Command.Item>
                  <Command.Item
                    className={itemClass}
                    data-testid="palette-own-clip"
                    onSelect={async () => {
                      const video = await createVideo(owner, null, usePreferences.getState().defaultFormat)
                      go(`${ROUTES.video(video.id)}?mode=timeline`)
                    }}
                  >
                    <Upload /> Start from my own clip
                  </Command.Item>
                  <Command.Item className={itemClass} onSelect={() => go(ROUTES.brand)}>
                    <Palette /> Brand kit
                  </Command.Item>
                  <Command.Item className={itemClass} onSelect={() => go(ROUTES.settings)}>
                    <Settings /> Settings
                  </Command.Item>
                  <Command.Item
                    className={itemClass}
                    onSelect={() => {
                      setOpen(false)
                      useShortcuts.getState().setOpen(true)
                    }}
                  >
                    <Keyboard /> Keyboard shortcuts
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
                {projects.data?.length ? (
                  <Command.Group
                    heading="Videos"
                    className="text-2xs text-fg-subtle [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:font-medium "
                  >
                    {projects.data.slice(0, 8).map((p) => (
                      <Command.Item
                        key={p.id}
                        className={itemClass}
                        value={`video ${p.name} ${p.id}`}
                        onSelect={() => go(ROUTES.video(p.id))}
                      >
                        <Film /> {p.name}
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
