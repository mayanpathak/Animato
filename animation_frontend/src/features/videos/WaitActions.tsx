// Two quiet, optional things to do while a render runs (plan 6.5): set up the
// brand kit inline, or draft the next idea without leaving the page.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Palette, PenLine } from 'lucide-react'
import { ROUTES } from '@/app/nav'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { useBrandKits, useOwner, useSaveBrandKit } from '@/lib/local/hooks'
import { toast } from '@/stores/toast'
import { DEFAULT_COLORS, defaultKit, LOGO_TYPES, MAX_LOGO_BYTES } from '@/features/brand/lib'
import { ComposerStrip } from './ComposerStrip'

function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
}

function BrandQuickSetup({ onDone }: { onDone: () => void }) {
  const owner = useOwner()
  const kits = useBrandKits()
  const save = useSaveBrandKit()
  const existing = kits.data?.[0]
  const [colors, setColors] = useState<string[]>(() =>
    (existing?.colors ?? defaultKit('', '').colors).slice(0, 2),
  )
  const [logo, setLogo] = useState<string | null>(existing?.logoDataUrl ?? null)

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={async (e) => {
        e.preventDefault()
        const base = existing ?? defaultKit(owner, 'My brand')
        await save.mutateAsync({ ...base, colors: [...colors, ...base.colors.slice(2)], logoDataUrl: logo })
        toast.success('Brand kit saved', 'Finish uses it for titles, the end card and the Brand look.')
        onDone()
      }}
    >
      <div>
        <p className="text-sm text-fg-muted">Logo</p>
        <div className="mt-2 flex items-center gap-3">
          <span className="grid size-14 place-items-center overflow-hidden rounded-control bg-surface-2">
            {logo ? (
              <img src={logo} alt="Your logo" className="max-h-full max-w-full object-contain" />
            ) : null}
          </span>
          <label className="cursor-pointer text-sm text-fg underline underline-offset-4 hover:text-accent">
            {logo ? 'Replace' : 'Choose a file'}
            <input
              type="file"
              className="sr-only"
              accept={LOGO_TYPES.join(',')}
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                if (!LOGO_TYPES.includes(file.type) || file.size > MAX_LOGO_BYTES) {
                  toast.error('That logo can’t be used', 'Use a PNG, JPEG or SVG up to 2 MB.')
                  return
                }
                setLogo(await readDataUrl(file))
              }}
            />
          </label>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {['Primary colour', 'Second colour'].map((label, i) => (
          <label key={label} className="flex items-center gap-3 text-sm text-fg-muted">
            <input
              type="color"
              value={colors[i] ?? DEFAULT_COLORS[i]}
              onChange={(e) => setColors((c) => c.map((v, j) => (j === i ? e.target.value : v)))}
              className="size-10 cursor-pointer rounded-control border border-line bg-transparent"
            />
            {label}
          </label>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <Link
          to={ROUTES.brand}
          className="text-sm text-fg-subtle underline-offset-4 hover:text-fg hover:underline"
        >
          All brand settings
        </Link>
        <Button type="submit" loading={save.isPending}>
          Save
        </Button>
      </div>
    </form>
  )
}

export function WaitActions() {
  const [open, setOpen] = useState<'brand' | 'draft' | null>(null)
  const kits = useBrandKits()
  const hasKit = Boolean(kits.data?.length)
  return (
    <>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setOpen('brand')}
          className="flex items-start gap-3 rounded-xl border border-line px-4 py-3.5 text-left transition-colors hover:bg-surface-1"
        >
          <Palette className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
          <span>
            <span className="block text-fg">{hasKit ? 'Check your brand kit' : 'Set up your brand kit'}</span>
            <span className="mt-0.5 block text-sm text-fg-subtle">
              A logo and two colours, used when you finish.
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => setOpen('draft')}
          className="flex items-start gap-3 rounded-xl border border-line px-4 py-3.5 text-left transition-colors hover:bg-surface-1"
        >
          <PenLine className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
          <span>
            <span className="block text-fg">Draft your next idea</span>
            <span className="mt-0.5 block text-sm text-fg-subtle">Starts another video; you stay here.</span>
          </span>
        </button>
      </div>
      <Dialog open={open === 'brand'} onClose={() => setOpen(null)} title="Brand kit">
        {open === 'brand' ? <BrandQuickSetup onDone={() => setOpen(null)} /> : null}
      </Dialog>
      <Dialog open={open === 'draft'} onClose={() => setOpen(null)} title="Your next video">
        <div className="pb-2">
          <ComposerStrip
            stay
            onStarted={() => {
              setOpen(null)
              toast.success('Started', 'It’s rendering in Videos.')
            }}
          />
        </div>
      </Dialog>
    </>
  )
}
