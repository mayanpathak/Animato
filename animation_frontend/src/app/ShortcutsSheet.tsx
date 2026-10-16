import { useEffect } from 'react'
import { Dialog } from '@/components/ui/dialog'
import { Kbd } from '@/components/ui/misc'
import { SHORTCUTS } from './nav'
import { isTyping, useShortcuts } from './shortcuts'

export function ShortcutsSheet() {
  const { open, setOpen } = useShortcuts()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '?' && !isTyping(e) && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        useShortcuts.getState().setOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return (
    <Dialog open={open} onClose={() => setOpen(false)} title="Keyboard shortcuts">
      <dl className="divide-y divide-line">
        {SHORTCUTS.map((s) => (
          <div key={s.action} className="flex items-center justify-between gap-4 py-2.5">
            <dt className="text-sm text-fg">
              {s.action}
              <span className="ml-2 text-xs text-fg-subtle">{s.where}</span>
            </dt>
            <dd className="flex gap-1">
              {s.keys.map((k) => (
                <Kbd key={k}>{k}</Kbd>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </Dialog>
  )
}
