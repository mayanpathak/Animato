import { Dialog } from '@/components/ui/dialog'
import { Kbd } from '@/components/ui/misc'

const ROWS: [string, string[]][] = [
  ['Play / pause', ['Space']],
  ['Shuttle back / pause / forward', ['J', 'K', 'L']],
  ['Step one frame', ['←', '→']],
  ['Split at playhead', ['S']],
  ['Delete clip', ['Delete']],
  ['Ripple delete', ['Shift', 'Delete']],
  ['Duplicate clip', ['⌘', 'D']],
  ['Undo', ['⌘', 'Z']],
  ['Redo', ['⌘', 'Shift', 'Z']],
  ['Zoom timeline', ['+', '−']],
  ['Toggle snapping', ['N']],
  ['Command palette', ['⌘', 'K']],
  ['This cheat sheet', ['?']],
]

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Keyboard shortcuts"
      description="Ctrl works wherever ⌘ is shown."
    >
      <dl className="divide-y divide-line">
        {ROWS.map(([label, keys]) => (
          <div key={label} className="flex items-center justify-between py-2.5 text-sm">
            <dt className="text-fg-muted">{label}</dt>
            <dd className="flex gap-1">
              {keys.map((k) => (
                <Kbd key={k}>{k}</Kbd>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </Dialog>
  )
}
