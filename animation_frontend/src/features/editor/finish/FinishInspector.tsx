// Finish (plan 6.6): one scrolling column of quiet sections. Every change
// is one undo step and previews at once. On a phone only Format, Look and
// Title show.
import { useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  Captions,
  Clapperboard,
  Crop,
  Droplet,
  Mic,
  Music,
  Palette,
  Sparkles,
  Stamp,
  Type,
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { ROUTES } from '@/app/nav'
import { Button, buttonClass } from '@/components/ui/button'
import { Input, Label, Select } from '@/components/ui/field'
import { Slider, Switch } from '@/components/ui/misc'
import { Tabs } from '@/components/ui/tabs'
import { track } from '@/lib/analytics'
import { cn } from '@/lib/cn'
import { getEntitlements } from '@/lib/entitlements'
import { useBrandKits, useOwner } from '@/lib/local/hooks'
import { toast } from '@/stores/toast'
import { usePreferences } from '@/stores/preferences'
import { useSession } from '@/stores/session'
import { CAPTION_STYLES, LOOKS } from '../graphics/looks'
import { importFile } from '../media/client'
import { aspectOf, MAIN_AUDIO, MAIN_VIDEO, type AspectKey, type FinishSettings } from '../model/timelineV2'
import { useEditor } from '../store'
import { LookThumb } from './LookThumb'
import { posterOf } from './poster'

function Section({
  title,
  icon,
  children,
  desktop,
  aside,
}: {
  title: string
  icon: ReactNode
  children: ReactNode
  /** Hidden on phones (plan 6.6: Format, Look and Title only). */
  desktop?: boolean
  aside?: ReactNode
}) {
  return (
    <section className={cn('border-b border-line px-4 py-4', desktop && 'hidden min-[900px]:block')}>
      <div className="mb-3 flex items-center gap-2">
        <h3 className="flex items-center gap-2 text-2xs font-semibold tracking-wide text-fg-subtle uppercase [&_svg]:size-3.5">
          {icon}
          {title}
        </h3>
        <div className="ml-auto">{aside}</div>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  disabled,
  testId,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  testId?: string
}) {
  return (
    <div className="flex items-start justify-between gap-3" data-testid={testId}>
      <div className="min-w-0">
        <p className="text-sm">{label}</p>
        {hint ? <p className="mt-0.5 text-2xs text-fg-subtle">{hint}</p> : null}
      </div>
      <Switch label={label} checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  )
}

const FORMATS: { value: AspectKey; label: string }[] = [
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
  { value: '1:1', label: '1:1' },
]

export function FinishInspector({ onAddVoice }: { onAddVoice: () => void }) {
  const timeline = useEditor((s) => s.timeline)
  const transcript = useEditor((s) => s.transcript)
  const assets = useEditor((s) => s.assets)
  const brand = useEditor((s) => s.brand)
  const user = useSession((s) => s.user)
  const kits = useBrandKits()
  const owner = useOwner()
  const qc = useQueryClient()
  const musicInput = useRef<HTMLInputElement>(null)
  const [importingMusic, setImportingMusic] = useState(false)
  const s = useEditor.getState()
  if (!timeline?.finish) return null
  const finish = timeline.finish
  const aspect = aspectOf(timeline)
  const entitlements = getEntitlements(user)
  const up = (label: string, fn: (f: FinishSettings) => FinishSettings, key?: string) =>
    s.updateFinish(fn, label, key)
  const mainClip = timeline.clips.find((c) => c.trackId === MAIN_VIDEO)
  const poster = mainClip ? posterOf(assets.get(mainClip.assetId)) : null
  const kit = kits.data?.find((k) => k.id === finish.brand.kitId) ?? null
  const musicTrack = timeline.tracks.find((t) => t.id === MAIN_AUDIO)
  const hasMusic = timeline.clips.some((c) => c.trackId === MAIN_AUDIO)

  const addMusic = async (file: File) => {
    setImportingMusic(true)
    try {
      const asset = await importFile(file, { owner, name: file.name })
      await qc.invalidateQueries({ queryKey: ['media', owner] })
      if (asset.kind !== 'audio') throw new Error('Choose an audio file (MP3, WAV, M4A).')
      s.addAsset(asset)
    } catch (e) {
      toast.error(`Could not add ${file.name}`, e instanceof Error ? e.message : undefined)
    } finally {
      setImportingMusic(false)
    }
  }

  return (
    <div className="pb-8" data-testid="finish-inspector">
      <Section title="Format" icon={<Crop />}>
        <Tabs
          label="Format"
          value={aspect}
          onChange={(v) => {
            s.setFormat(v)
            usePreferences.getState().setDefaultFormat(v)
            track('format_change', { format: v })
          }}
          items={FORMATS}
          fill
        />
      </Section>

      <Section title="Look" icon={<Sparkles />}>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Look">
          {LOOKS.map((l) => {
            const active = finish.look === l.id
            const needsKit = l.id === 'brand' && !kit
            return (
              <button
                key={l.id}
                type="button"
                role="radio"
                aria-checked={active}
                data-testid={`look-${l.id}`}
                title={needsKit ? 'Create a brand kit to use this look' : l.hint}
                disabled={needsKit}
                onClick={() => {
                  s.setLook(l.id)
                  usePreferences.getState().setDefaultLook(l.id)
                  track('look_change', { look: l.id })
                }}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-lg border p-2 transition-colors disabled:opacity-40',
                  active ? 'border-accent bg-accent-soft' : 'border-line hover:border-line-strong',
                )}
              >
                <LookThumb look={l.id} timeline={timeline} brand={brand} assets={assets} poster={poster} />
                <span className="text-xs font-medium">{l.label}</span>
              </button>
            )
          })}
        </div>
      </Section>

      <Section
        title="Title"
        icon={<Type />}
        aside={
          <Switch
            label="Show title"
            checked={finish.title.enabled}
            onChange={(v) =>
              up(v ? 'Show title' : 'Hide title', (f) => ({ ...f, title: { ...f.title, enabled: v } }))
            }
          />
        }
      >
        <Input
          aria-label="Title text"
          data-testid="finish-title"
          value={finish.title.text}
          maxLength={80}
          onChange={(e) =>
            up('Edit title', (f) => ({ ...f, title: { ...f.title, text: e.target.value } }), 'finish-title')
          }
        />
        <div className="flex items-center justify-between gap-3">
          <Label className="mb-0">Position</Label>
          <Tabs
            size="sm"
            label="Title position"
            value={finish.title.position}
            onChange={(v) => up('Title position', (f) => ({ ...f, title: { ...f.title, position: v } }))}
            items={[
              { value: 'top', label: 'Top' },
              { value: 'center', label: 'Centre' },
            ]}
          />
        </div>
        <div>
          <Label className="mb-1">Shown for</Label>
          <Slider
            label="Title duration"
            min={1}
            max={8}
            step={0.5}
            value={finish.title.duration}
            format={(v) => `${v}s`}
            onChange={(v) =>
              up(
                'Title duration',
                (f) => ({ ...f, title: { ...f.title, duration: v } }),
                'finish-title-duration',
              )
            }
          />
        </div>
      </Section>

      <Section
        title="Captions"
        icon={<Captions />}
        desktop
        aside={
          transcript?.words.length ? (
            <Switch
              label="Show captions"
              checked={finish.captions.enabled}
              onChange={(v) =>
                up(v ? 'Show captions' : 'Hide captions', (f) => ({
                  ...f,
                  captions: { ...f.captions, enabled: v },
                }))
              }
            />
          ) : null
        }
      >
        {transcript?.words.length ? (
          <Tabs
            size="sm"
            label="Caption style"
            value={finish.captions.style}
            onChange={(v) => s.setCaptionStyle(v)}
            items={CAPTION_STYLES.map((c) => ({ value: c.id, label: c.label }))}
            fill
          />
        ) : (
          <Button variant="secondary" size="sm" leftIcon={<Mic className="size-3.5" />} onClick={onAddVoice}>
            Add your voice to get captions
          </Button>
        )}
      </Section>

      <Section title="Brand" icon={<Palette />} desktop>
        {kits.data?.length ? (
          <>
            <Select
              aria-label="Brand kit"
              value={finish.brand.kitId ?? ''}
              onChange={(e) =>
                up('Brand kit', (f) => ({ ...f, brand: { ...f.brand, kitId: e.target.value || null } }))
              }
            >
              <option value="">No brand kit</option>
              {kits.data.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </Select>
            <ToggleRow
              label="Logo"
              hint={kit && !kit.logoDataUrl ? 'This kit has no logo yet.' : undefined}
              checked={finish.brand.logo}
              disabled={!kit?.logoDataUrl}
              onChange={(v) =>
                up(v ? 'Show logo' : 'Hide logo', (f) => ({ ...f, brand: { ...f.brand, logo: v } }))
              }
            />
            <ToggleRow
              label="Use brand colours"
              hint="Switches to the Brand look."
              checked={finish.look === 'brand'}
              disabled={!kit}
              onChange={(v) => {
                s.setLook(v ? 'brand' : 'clean')
                track('look_change', { look: v ? 'brand' : 'clean' })
              }}
            />
          </>
        ) : (
          <p className="text-xs text-fg-subtle">Your logo, colours and fonts, applied in one click.</p>
        )}
        <Link to={ROUTES.brand} className={buttonClass('ghost', 'sm', '-ml-2')}>
          {kits.data?.length ? 'Edit brand kit' : 'Create a brand kit'}
        </Link>
      </Section>

      <Section title="Music" icon={<Music />} desktop>
        <input
          ref={musicInput}
          type="file"
          accept="audio/*"
          className="hidden"
          data-testid="finish-music-input"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) void addMusic(file)
          }}
        />
        <Button
          variant="secondary"
          size="sm"
          loading={importingMusic}
          onClick={() => musicInput.current?.click()}
        >
          {hasMusic ? 'Add another track' : 'Add music'}
        </Button>
        {hasMusic && musicTrack ? (
          <div>
            <Label className="mb-1">Volume</Label>
            <Slider
              label="Music volume"
              min={0}
              max={1}
              step={0.01}
              value={musicTrack.volume}
              format={(v) => `${Math.round(v * 100)}%`}
              onChange={(v) => s.updateTrack(musicTrack.id, { volume: v })}
            />
          </div>
        ) : null}
        <ToggleRow
          label="Lower under voice"
          checked={timeline.audio.ducking.enabled}
          onChange={(v) =>
            s.updateTimeline(
              { audio: { ...timeline.audio, ducking: { ...timeline.audio.ducking, enabled: v } } },
              v ? 'Lower music under voice' : 'Keep music level',
            )
          }
        />
      </Section>

      <Section
        title="End card"
        icon={<Clapperboard />}
        desktop
        aside={
          <Switch
            label="Show end card"
            checked={finish.endCard.enabled}
            onChange={(v) =>
              up(v ? 'Add end card' : 'Remove end card', (f) => ({
                ...f,
                endCard: { ...f.endCard, enabled: v },
              }))
            }
          />
        }
      >
        {finish.endCard.enabled ? (
          <>
            <Input
              aria-label="End card headline"
              value={finish.endCard.headline}
              maxLength={60}
              onChange={(e) =>
                up(
                  'Edit end card',
                  (f) => ({ ...f, endCard: { ...f.endCard, headline: e.target.value } }),
                  'end-head',
                )
              }
            />
            <Input
              aria-label="End card line"
              placeholder="@yourhandle"
              value={finish.endCard.sub}
              maxLength={60}
              onChange={(e) =>
                up(
                  'Edit end card',
                  (f) => ({ ...f, endCard: { ...f.endCard, sub: e.target.value } }),
                  'end-sub',
                )
              }
            />
            <div>
              <Label className="mb-1">Length</Label>
              <Slider
                label="End card length"
                min={1}
                max={5}
                step={0.5}
                value={finish.endCard.duration}
                format={(v) => `${v}s`}
                onChange={(v) =>
                  up('End card length', (f) => ({ ...f, endCard: { ...f.endCard, duration: v } }), 'end-len')
                }
              />
            </div>
          </>
        ) : (
          <p className="text-xs text-fg-subtle">
            Added after the video: a headline, your handle and your logo.
          </p>
        )}
      </Section>

      <Section title="Watermark" icon={entitlements.watermark === 'forced' ? <Stamp /> : <Droplet />} desktop>
        <ToggleRow
          label="Made with Animato"
          hint={
            entitlements.watermark === 'forced'
              ? 'Included on the Free plan.'
              : 'Free while in early access. Creator plan removes it automatically.'
          }
          checked={finish.watermark}
          disabled={entitlements.watermark === 'forced'}
          testId="finish-watermark"
          onChange={(v) => up(v ? 'Show watermark' : 'Hide watermark', (f) => ({ ...f, watermark: v }))}
        />
      </Section>

      <p className="px-4 pt-4 text-center text-xs text-fg-subtle min-[900px]:hidden">
        Open on a computer to fine-tune.
      </p>
    </div>
  )
}
