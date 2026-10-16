import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  Check,
  Copy,
  Captions,
  MoreHorizontal,
  Palette,
  PencilLine,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Type,
} from 'lucide-react'
import { Button, IconButton } from '@/components/ui/button'
import { Label, Select, Textarea } from '@/components/ui/field'
import { Menu } from '@/components/ui/menu'
import { Badge, Card, EmptyState, ErrorState, Skeleton, Switch } from '@/components/ui/misc'
import { Spinner } from '@/components/ui/spinner'
import { keys, useBrandKits, useOwner, useSaveBrandKit } from '@/lib/local/hooks'
import { brandTable, uid, type BrandKit } from '@/lib/local/models'
import { cn } from '@/lib/cn'
import { errorMessage } from '@/lib/api/http'
import { spring } from '@/lib/motion'
import { useTitle } from '@/lib/useTitle'
import { toast } from '@/stores/toast'
import { ConfirmDialog, RenameDialog } from '@/features/projects/components/ProjectDialogs'
import { defaultKit, FONTS, fontLabel, kitSignature } from './lib'
import { PaletteEditor } from './components/PaletteEditor'
import { LogoField } from './components/LogoField'
import { BrandPreview } from './components/BrandPreview'

type SaveStatus = 'saved' | 'pending' | 'saving' | 'error'

const AUTOSAVE_MS = 600

/** Debounced autosave of the kit being edited. */
function useAutosave(draft: BrandKit | null) {
  const save = useSaveBrandKit()
  const qc = useQueryClient()
  const owner = useOwner()
  const [status, setStatus] = useState<SaveStatus>('saved')
  const saved = useRef('')
  const pending = useRef<BrandKit | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const { mutateAsync } = save

  const run = useCallback(async () => {
    clearTimeout(timer.current)
    const kit = pending.current
    if (!kit) return
    pending.current = null
    setStatus('saving')
    try {
      await mutateAsync(kit)
      saved.current = kitSignature(kit)
      if (!pending.current) setStatus('saved')
    } catch {
      pending.current ??= kit
      setStatus('error')
    }
  }, [mutateAsync])

  useEffect(() => {
    if (!draft || kitSignature(draft) === saved.current) return
    pending.current = draft
    setStatus('pending')
    clearTimeout(timer.current)
    timer.current = setTimeout(() => void run(), AUTOSAVE_MS)
  }, [draft, run])

  // Never lose an edit when leaving the page mid-debounce.
  useEffect(
    () => () => {
      clearTimeout(timer.current)
      const kit = pending.current
      if (kit) {
        void brandTable
          .put({ ...kit, updatedAt: Date.now() })
          .then(() => qc.invalidateQueries({ queryKey: keys.brand(owner) }))
      }
    },
    [qc, owner],
  )

  return {
    status,
    /** Baseline for a freshly selected kit (it is already stored). */
    markSaved: useCallback((kit: BrandKit) => {
      saved.current = kitSignature(kit)
      setStatus('saved')
    }, []),
    flush: run,
    /** Drop a queued save (the kit is being deleted). */
    cancel: useCallback(() => {
      clearTimeout(timer.current)
      pending.current = null
      setStatus('saved')
    }, []),
  }
}

function SaveIndicator({ status, onRetry }: { status: SaveStatus; onRetry: () => void }) {
  const content = {
    saved: { icon: <Check className="size-3.5" />, text: 'Saved', tone: 'text-fg-subtle' },
    pending: {
      icon: <span className="size-1.5 rounded-full bg-status-warning" />,
      text: 'Unsaved changes',
      tone: 'text-fg-subtle',
    },
    saving: {
      icon: <Spinner className="size-3.5" label="Saving" />,
      text: 'Saving…',
      tone: 'text-fg-subtle',
    },
    error: { icon: <AlertCircle className="size-3.5" />, text: 'Not saved', tone: 'text-status-failed' },
  }[status]
  return (
    <div className="flex items-center gap-2">
      <span
        data-testid="brand-save-status"
        data-status={status}
        role="status"
        className={cn('inline-flex h-7 items-center gap-1.5 text-xs', content.tone)}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={status}
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.14 }}
            className="inline-flex items-center gap-1.5"
          >
            {content.icon}
            {content.text}
          </motion.span>
        </AnimatePresence>
      </span>
      {status === 'error' ? (
        <Button variant="ghost" size="xs" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  )
}

export default function BrandPage() {
  useTitle('Brand kit')
  const kitsQ = useBrandKits()
  const owner = useOwner()
  const qc = useQueryClient()
  const kits = useMemo(
    () =>
      [...(kitsQ.data ?? [])].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
      ),
    [kitsQ.data],
  )

  const [draft, setDraft] = useState<BrandKit | null>(null)
  const autosave = useAutosave(draft)
  const [renaming, setRenaming] = useState<BrandKit | null>(null)
  const [deleting, setDeleting] = useState<BrandKit | null>(null)
  const [creating, setCreating] = useState(false)

  // Select the first kit once the list arrives (or when the selected one disappears).
  if (kitsQ.data && kits.length > 0 && (!draft || !kits.some((k) => k.id === draft.id))) {
    const first = kits[0]
    setDraft(first)
    autosave.markSaved(first)
  }
  if (kitsQ.data && kits.length === 0 && draft) setDraft(null)

  const refresh = () => qc.invalidateQueries({ queryKey: keys.brand(owner) })

  const select = async (kit: BrandKit) => {
    if (kit.id === draft?.id) return
    await autosave.flush()
    autosave.markSaved(kit)
    setDraft(kit)
  }

  const create = async (base?: BrandKit) => {
    setCreating(true)
    try {
      await autosave.flush()
      const kit: BrandKit = base
        ? { ...structuredClone(base), id: uid('brd'), name: `${base.name} (copy)`, updatedAt: Date.now() }
        : defaultKit(owner, kits.length ? `Brand kit ${kits.length + 1}` : 'My brand')
      await brandTable.put(kit)
      // Refresh first so the new kit is in the list when it becomes the selection.
      await refresh()
      autosave.markSaved(kit)
      setDraft(kit)
      if (base) toast.success('Kit duplicated', kit.name)
    } catch (e) {
      toast.error('Could not create the kit', errorMessage(e))
    } finally {
      setCreating(false)
    }
  }

  const update = (patch: Partial<BrandKit>) => setDraft((d) => (d ? { ...d, ...patch } : d))

  /** The selected kit's freshest state is the draft, not the stored record. */
  const latest = (k: BrandKit) => (draft && k.id === draft.id ? draft : k)

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold tracking-tight">Brand kit</h1>
          <p className="mt-1 max-w-xl text-sm text-fg-muted">
            Colours, type, logo and voice in one place. Kits apply to text overlays and caption style in the
            editor, and to your prompts when you switch that on.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {draft ? <SaveIndicator status={autosave.status} onRetry={() => void autosave.flush()} /> : null}
          <Button
            variant="secondary"
            leftIcon={<Plus className="size-4" />}
            onClick={() => create()}
            loading={creating}
            data-testid="brand-new"
          >
            New kit
          </Button>
        </div>
      </header>

      <div className="mt-8">
        {kitsQ.isPending ? (
          <div className="flex flex-col gap-6" aria-busy>
            <div className="flex gap-2">
              <Skeleton className="h-14 w-56 rounded-lg" />
              <Skeleton className="h-14 w-56 rounded-lg" />
            </div>
            <div className="grid gap-6 xl:grid-cols-2">
              <Skeleton className="h-96 rounded-xl" />
              <Skeleton className="aspect-video rounded-xl" />
            </div>
          </div>
        ) : kitsQ.isError ? (
          <ErrorState
            title="Could not open your brand kits"
            body="This browser's storage did not answer. Private windows and some privacy settings block IndexedDB."
            action={
              <Button
                variant="secondary"
                leftIcon={<RefreshCw className="size-4" />}
                onClick={() => kitsQ.refetch()}
              >
                Try again
              </Button>
            }
          />
        ) : kits.length === 0 || !draft ? (
          <EmptyState
            icon={<Palette />}
            title="Set up your brand once"
            body="Start from Animato's violet, cyan and magenta with Inter, then make it yours. Everything stays in this browser."
            action={
              <Button leftIcon={<Sparkles className="size-4" />} onClick={() => create()} loading={creating}>
                Create my brand kit
              </Button>
            }
            className="py-20"
          />
        ) : (
          <div className="flex flex-col gap-6">
            <nav aria-label="Brand kits" className="min-w-0">
              <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 py-1 no-scrollbar sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
                {kits.map((stored) => {
                  const k = latest(stored)
                  const active = k.id === draft.id
                  return (
                    <li key={k.id} className="relative w-56 shrink-0">
                      {active ? (
                        <motion.span
                          layoutId="brand-kit-active"
                          transition={spring.layout}
                          className="absolute inset-0 rounded-lg border border-line-strong bg-surface-2 shadow-inner-highlight"
                        />
                      ) : null}
                      <button
                        type="button"
                        aria-current={active ? 'true' : undefined}
                        onClick={() => void select(stored)}
                        className={cn(
                          'relative flex w-full items-center gap-3 rounded-lg border border-transparent py-2.5 pr-10 pl-3 text-left transition-colors',
                          active ? 'text-fg' : 'text-fg-muted hover:bg-surface-1 hover:text-fg',
                        )}
                      >
                        <span className="grid size-8 shrink-0 grid-cols-2 overflow-hidden rounded-md border border-line-strong">
                          {[0, 1, 2, 3].map((i) => (
                            <span
                              key={i}
                              style={{ background: k.colors[i] ?? k.colors[i % k.colors.length] }}
                            />
                          ))}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{k.name}</span>
                          <span className="block truncate text-2xs text-fg-subtle">
                            {fontLabel(k.headingFont)}
                            {k.appendToPrompts ? ' · in prompts' : ''}
                          </span>
                        </span>
                      </button>
                      <div className="absolute top-1/2 right-1.5 -translate-y-1/2">
                        <Menu
                          items={[
                            { label: 'Rename', icon: <PencilLine />, onSelect: () => setRenaming(k) },
                            { label: 'Duplicate', icon: <Copy />, onSelect: () => void create(k) },
                            'separator',
                            {
                              label: 'Delete',
                              icon: <Trash2 />,
                              danger: true,
                              onSelect: () => setDeleting(k),
                            },
                          ]}
                          trigger={(p) => (
                            <IconButton {...p} label={`Actions for ${k.name}`} size="sm">
                              <MoreHorizontal />
                            </IconButton>
                          )}
                        />
                      </div>
                    </li>
                  )
                })}
              </ul>
            </nav>

            <KitEditor key={draft.id} kit={draft} onChange={update} />
          </div>
        )}
      </div>

      <RenameDialog
        open={renaming !== null}
        onClose={() => setRenaming(null)}
        title="Rename brand kit"
        initial={renaming?.name ?? ''}
        onSave={async (name) => {
          if (!renaming) return
          if (draft && renaming.id === draft.id) update({ name })
          else {
            await brandTable.put({ ...renaming, name, updatedAt: Date.now() })
            await refresh()
          }
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Delete this brand kit?"
        confirmLabel="Delete kit"
        body={
          <p>
            <span className="font-medium text-fg">{deleting?.name}</span> will be removed from this browser.
            Videos and projects that already used it keep their look. This cannot be undone.
          </p>
        }
        onConfirm={async () => {
          if (!deleting) return
          if (draft && deleting.id === draft.id) autosave.cancel()
          await brandTable.remove(deleting.id)
          await refresh()
          toast.success('Brand kit deleted')
        }}
      />
    </div>
  )
}

function Section({
  title,
  hint,
  icon,
  children,
}: {
  title: string
  hint?: ReactNode
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <section className="border-t border-line px-5 py-5 first:border-t-0">
      <div className="mb-3.5 flex items-start gap-2.5">
        <span className="mt-0.5 text-fg-subtle [&_svg]:size-4">{icon}</span>
        <div>
          <h2 className="text-sm font-semibold text-fg">{title}</h2>
          {hint ? <p className="mt-0.5 text-xs text-fg-subtle">{hint}</p> : null}
        </div>
      </div>
      {children}
    </section>
  )
}

function FontSelect({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="min-w-0">
      <Label htmlFor={id}>{label}</Label>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {FONTS.map((f) => (
          <option key={f.value} value={f.value}>
            {f.label}
          </option>
        ))}
      </Select>
      <p className="mt-1.5 flex items-center gap-1 text-2xs text-fg-subtle">
        {FONTS.find((f) => f.value === value)?.editor ? (
          <>
            <Check className="size-3 text-status-succeeded" aria-hidden /> Renders in exported video
          </>
        ) : (
          'Preview only; video uses Inter'
        )}
      </p>
    </div>
  )
}

function KitEditor({ kit, onChange }: { kit: BrandKit; onChange: (patch: Partial<BrandKit>) => void }) {
  return (
    <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <Card className="min-w-0 overflow-hidden">
        <Section
          icon={<Palette />}
          title="Palette"
          hint="Up to six colours. The first three are primary, secondary and accent."
        >
          <PaletteEditor colors={kit.colors} onChange={(colors) => onChange({ colors })} />
        </Section>

        <Section
          icon={<Type />}
          title="Typography"
          hint="The video editor's GPU text renderer ships Inter and DejaVu Serif."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <FontSelect
              id="brand-heading-font"
              label="Headings"
              value={kit.headingFont}
              onChange={(headingFont) => onChange({ headingFont })}
            />
            <FontSelect
              id="brand-body-font"
              label="Body and captions"
              value={kit.bodyFont}
              onChange={(bodyFont) => onChange({ bodyFont })}
            />
          </div>
        </Section>

        <Section
          icon={<Sparkles />}
          title="Logo"
          hint="Shown in the preview and available to place as an overlay."
        >
          <LogoField
            value={kit.logoDataUrl}
            onChange={(logoDataUrl) => onChange({ logoDataUrl, logoAssetId: null })}
          />
        </Section>

        <Section
          icon={<Captions />}
          title="Tone of voice"
          hint="How your narration and on-screen copy should sound."
        >
          <Label htmlFor="brand-tone" className="sr-only">
            Tone of voice
          </Label>
          <Textarea
            id="brand-tone"
            value={kit.tone}
            maxLength={600}
            onChange={(e) => onChange({ tone: e.target.value })}
            placeholder="Confident and plain-spoken. Short sentences, no jargon, one idea per scene."
          />
          <p className="mt-1 text-right font-mono text-2xs text-fg-subtle">{kit.tone.length}/600</p>

          <div className="mt-3 flex items-start justify-between gap-4 rounded-lg border border-line bg-surface-2/60 p-3.5">
            <div>
              <label htmlFor="brand-append" className="text-sm font-medium text-fg">
                Append brand details to prompts
              </label>
              <p className="mt-0.5 text-xs text-fg-subtle">
                Prompt Studio adds this kit's colours, fonts and tone to what you describe, so renders come
                out on brand.
              </p>
            </div>
            <Switch
              id="brand-append"
              label="Append brand details to prompts"
              checked={kit.appendToPrompts}
              onChange={(appendToPrompts) => onChange({ appendToPrompts })}
            />
          </div>
        </Section>
      </Card>

      <div className="min-w-0 lg:sticky lg:top-20 max-lg:order-first">
        <h2 className="mb-3 text-xs font-medium tracking-wide text-fg-subtle uppercase">Live preview</h2>
        <BrandPreview kit={kit} />
        <div className="mt-5 rounded-xl border border-line bg-surface-1 p-4">
          <h3 className="text-sm font-semibold">Where this kit applies</h3>
          <ul className="mt-2.5 flex flex-col gap-2 text-sm text-fg-muted">
            <li className="flex gap-2.5">
              <Type className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
              <span>Text overlays in the editor use your heading font and palette.</span>
            </li>
            <li className="flex gap-2.5">
              <Captions className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
              <span>Caption style uses your body font, with the primary colour for emphasis.</span>
            </li>
            <li className="flex gap-2.5">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
              <span className="flex flex-wrap items-center gap-2">
                Prompts in Prompt Studio
                <Badge tone={kit.appendToPrompts ? 'succeeded' : 'neutral'}>
                  {kit.appendToPrompts ? 'On' : 'Off'}
                </Badge>
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
