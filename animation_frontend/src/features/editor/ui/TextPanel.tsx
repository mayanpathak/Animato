import { Heading1, PanelBottom, Subtitles } from 'lucide-react'
import { useBrandKits } from '@/lib/local/hooks'
import { useEditor } from '../store'
import { builtinFont } from '../graphics/fonts'

const PRESETS = [
  { id: 'title', label: 'Title', hint: 'Large centred headline that rises in', icon: Heading1 },
  { id: 'lower-third', label: 'Lower third', hint: 'Name and role on a dark bar', icon: PanelBottom },
  { id: 'subtitle', label: 'Subtitle', hint: 'Supporting line that fades in', icon: Subtitles },
] as const

export function TextPanel() {
  const addText = useEditor((s) => s.addText)
  const kits = useBrandKits()
  const kit = kits.data?.[0]
  const brand = kit
    ? {
        font: builtinFont(kit.headingFont)?.family ?? 'Inter',
        color: kit.colors[0],
      }
    : undefined
  return (
    <div className="space-y-2 p-3">
      {PRESETS.map((p) => (
        <button
          key={p.id}
          type="button"
          data-testid={`add-text-${p.id}`}
          onClick={() => addText(p.id, undefined)}
          className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface-1 p-3 text-left transition-colors hover:border-line-strong hover:bg-surface-2"
        >
          <span className="grid size-9 place-items-center rounded-lg bg-accent-soft text-accent [&_svg]:size-4">
            <p.icon />
          </span>
          <span>
            <span className="block text-sm font-medium">{p.label}</span>
            <span className="block text-2xs text-fg-subtle">{p.hint}</span>
          </span>
        </button>
      ))}
      {kit && brand ? (
        <button
          type="button"
          onClick={() => addText('title', brand)}
          className="flex w-full items-center gap-3 rounded-xl border border-accent/30 bg-accent-soft/40 p-3 text-left transition-colors hover:bg-accent-soft"
        >
          <span className="flex -space-x-1">
            {kit.colors.slice(0, 3).map((c) => (
              <span key={c} className="size-4 rounded-full ring-2 ring-surface-1" style={{ background: c }} />
            ))}
          </span>
          <span>
            <span className="block text-sm font-medium">Brand title · {kit.name}</span>
            <span className="block text-2xs text-fg-subtle">Uses your brand kit font and first color</span>
          </span>
        </button>
      ) : null}
      <p className="pt-2 text-2xs text-fg-subtle">
        Text is placed at the playhead. Edit it in the inspector on the right.
      </p>
    </div>
  )
}
