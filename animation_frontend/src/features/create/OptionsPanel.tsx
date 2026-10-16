import { Link } from 'react-router-dom'
import { Captions, Clock3, Palette, Ratio, Sparkle } from 'lucide-react'
import type { ReactNode } from 'react'
import { Select } from '@/components/ui/field'
import { Slider, Switch } from '@/components/ui/misc'
import { Tabs } from '@/components/ui/tabs'
import { STYLES, type VisualStyle } from '@/lib/api/types'
import { cn } from '@/lib/cn'
import type { BrandKit } from '@/lib/local/models'
import type { AspectOption, StudioOptions } from './prompt'

function AspectGlyph({ aspect }: { aspect: AspectOption }) {
  const [w, h] = aspect === '16:9' ? [14, 8] : aspect === '9:16' ? [8, 14] : [11, 11]
  return (
    <span
      aria-hidden
      className="inline-block rounded-[2px] border border-current"
      style={{ width: w, height: h }}
    />
  )
}

function Row({
  icon,
  label,
  htmlFor,
  children,
  aside,
}: {
  icon: ReactNode
  label: string
  htmlFor?: string
  children: ReactNode
  aside?: ReactNode
}) {
  return (
    <div className="border-b border-line px-4 py-4 last:border-b-0">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <label
          htmlFor={htmlFor}
          className="flex items-center gap-2 text-xs font-medium text-fg-muted [&_svg]:size-3.5 [&_svg]:text-fg-subtle"
        >
          {icon}
          {label}
        </label>
        {aside}
      </div>
      {children}
    </div>
  )
}

export function OptionsPanel({
  options,
  onChange,
  kits,
  kitsLoading,
  brandKitId,
  onBrandKit,
}: {
  options: StudioOptions
  onChange: (patch: Partial<StudioOptions>) => void
  kits: BrandKit[]
  kitsLoading: boolean
  brandKitId: string | null
  onBrandKit: (id: string | null) => void
}) {
  const kit = kits.find((k) => k.id === brandKitId) ?? null
  return (
    <div className="surface-card overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="font-display text-sm font-semibold tracking-tight">Output</h2>
        <span className="text-2xs text-fg-subtle">Added to the prompt</span>
      </div>

      <Row icon={<Ratio />} label="Aspect ratio">
        <Tabs
          label="Aspect ratio"
          size="sm"
          className="w-full [&>button]:flex-1 [&>button]:justify-center"
          value={options.aspect}
          onChange={(aspect) => onChange({ aspect })}
          items={(['16:9', '9:16', '1:1'] as const).map((a) => ({
            value: a,
            label: a,
            icon: <AspectGlyph aspect={a} />,
          }))}
        />
      </Row>

      <Row
        icon={<Clock3 />}
        label="Target length"
        htmlFor="create-duration"
        aside={<span className="font-mono text-xs text-fg tabular-nums">{options.duration}s</span>}
      >
        <Slider
          id="create-duration"
          label="Target length in seconds"
          min={5}
          max={60}
          step={1}
          value={options.duration}
          onChange={(duration) => onChange({ duration })}
        />
        <div className="mt-1.5 flex justify-between font-mono text-2xs text-fg-subtle">
          <span>5s</span>
          <span>60s</span>
        </div>
      </Row>

      <Row icon={<Sparkle />} label="Visual style">
        <div role="radiogroup" aria-label="Visual style" className="flex flex-wrap gap-1.5">
          {STYLES.map((s: VisualStyle) => {
            const active = options.style === s
            return (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onChange({ style: s })}
                className={cn(
                  'h-7 rounded-full border px-3 text-xs font-medium transition-colors',
                  active
                    ? 'border-accent/40 bg-accent-soft text-fg'
                    : 'border-line bg-surface-1 text-fg-subtle hover:border-line-strong hover:text-fg-muted',
                )}
              >
                {s}
              </button>
            )
          })}
        </div>
      </Row>

      <Row icon={<Palette />} label="Brand kit" htmlFor="create-brand">
        <Select
          id="create-brand"
          value={brandKitId ?? ''}
          disabled={kitsLoading}
          onChange={(e) => onBrandKit(e.target.value || null)}
        >
          <option value="">{kitsLoading ? 'Loading kits…' : 'No brand kit'}</option>
          {kits.map((k) => (
            <option key={k.id} value={k.id}>
              {k.name}
            </option>
          ))}
        </Select>
        {kit ? (
          <div className="mt-2.5 flex items-center gap-2">
            <span className="flex -space-x-1">
              {kit.colors.slice(0, 5).map((c) => (
                <span
                  key={c}
                  className="size-4 rounded-full border border-canvas"
                  style={{ background: c }}
                />
              ))}
            </span>
            <span className="truncate text-2xs text-fg-subtle">{kit.headingFont || kit.bodyFont}</span>
          </div>
        ) : null}
        {kit && !kit.appendToPrompts ? (
          <p className="mt-2 text-2xs text-status-warning">
            This kit is set not to add itself to prompts.{' '}
            <Link to="/app/brand" className="underline underline-offset-2 hover:text-fg">
              Change in Brand kit
            </Link>
          </p>
        ) : null}
        {!kitsLoading && kits.length === 0 ? (
          <p className="mt-2 text-2xs text-fg-subtle">
            <Link to="/app/brand" className="text-accent underline underline-offset-2 hover:text-fg">
              Create a brand kit
            </Link>{' '}
            to add your colours and fonts to every prompt.
          </p>
        ) : null}
      </Row>

      <Row
        icon={<Captions />}
        label="On-screen captions"
        htmlFor="create-captions"
        aside={
          <Switch
            id="create-captions"
            label="On-screen captions"
            checked={options.captions}
            onChange={(captions) => onChange({ captions })}
          />
        }
      >
        <p className="text-2xs leading-relaxed text-fg-subtle">
          {options.captions
            ? 'Asks the renderer to write short captions into the video.'
            : 'Off. You can still add and style captions on the timeline in the editor.'}
        </p>
      </Row>
    </div>
  )
}
