import { useState, type ReactNode } from 'react'
import { AudioLines, Gauge, MousePointerClick, Palette, Scissors, Type, Volume2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Label, Select, Textarea } from '@/components/ui/field'
import { Slider, Switch } from '@/components/ui/misc'
import { toast } from '@/stores/toast'
import { cn } from '@/lib/cn'
import { useShallow } from 'zustand/react/shallow'
import { selectedItem, useEditor } from '../store'
import type { CaptionsItem, MediaClipV2, TitleItem, TitleMotion, TrackRole } from '../model/timelineV2'
import { measureLoudness } from '../media/client'

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4]
const TARGET_DB = -16

function Section({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="border-b border-line px-4 py-4">
      <h3 className="mb-3 flex items-center gap-2 text-2xs font-semibold tracking-wide text-fg-subtle uppercase [&_svg]:size-3.5">
        {icon}
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

function Row({ label, children, htmlFor }: { label: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div>
      <Label htmlFor={htmlFor} className="mb-1">
        {label}
      </Label>
      {children}
    </div>
  )
}

const pct = (v: number) => `${Math.round(v * 100)}%`
const secs = (v: number) => `${v.toFixed(1)}s`
const db = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(0)} dB`

function MediaInspector({
  clip,
  role,
  visual,
  fps,
}: {
  clip: MediaClipV2
  role: TrackRole
  visual: boolean
  fps: number
}) {
  const s = useEditor.getState()
  const asset = useEditor((st) => st.assets.get(clip.assetId))
  const [measuring, setMeasuring] = useState(false)
  const up = (patch: Partial<MediaClipV2>, key: string) => s.updateClip(clip.id, patch, `${key}-${clip.id}`)
  // Clip times are frames (Timeline v2); the controls speak seconds.
  const sec = (f: number) => f / fps
  const frames = (v: number) => Math.round(v * fps)
  const duration = sec(clip.duration)
  const inPoint = sec(clip.inPoint)
  const audible = asset?.hasAudio

  return (
    <>
      <Section title="Timing" icon={<Gauge />}>
        <Row label="Speed">
          <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Speed">
            {SPEEDS.map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={clip.speed === v}
                data-testid={`speed-${v}`}
                onClick={() => s.setSpeed(clip.id, v)}
                className={cn(
                  'h-7 min-w-10 rounded-md border px-2 font-mono text-2xs transition-colors',
                  clip.speed === v
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-line text-fg-muted hover:border-line-strong hover:text-fg',
                )}
              >
                {v}×
              </button>
            ))}
          </div>
        </Row>
        <Row label="Fade in">
          <Slider
            label="Fade in"
            min={0}
            max={Math.min(5, duration / 2)}
            step={0.05}
            value={sec(clip.fadeIn)}
            format={secs}
            onChange={(v) => up({ fadeIn: frames(v) }, 'fadein')}
          />
        </Row>
        <Row label="Fade out">
          <Slider
            label="Fade out"
            min={0}
            max={Math.min(5, duration / 2)}
            step={0.05}
            value={sec(clip.fadeOut)}
            format={secs}
            onChange={(v) => up({ fadeOut: frames(v) }, 'fadeout')}
          />
        </Row>
        <p className="font-mono text-2xs text-fg-subtle">
          Source {inPoint.toFixed(2)}s → {(inPoint + duration * clip.speed).toFixed(2)}s · on timeline{' '}
          {duration.toFixed(2)}s
        </p>
      </Section>
      {visual ? (
        <>
          <Section title="Transform" icon={<MousePointerClick />}>
            <div className="grid grid-cols-2 gap-3">
              <Row label="Position X">
                <Slider
                  label="Position X"
                  min={0}
                  max={1}
                  value={clip.transform.x}
                  format={pct}
                  onChange={(v) => up({ transform: { ...clip.transform, x: v } }, 'tx')}
                />
              </Row>
              <Row label="Position Y">
                <Slider
                  label="Position Y"
                  min={0}
                  max={1}
                  value={clip.transform.y}
                  format={pct}
                  onChange={(v) => up({ transform: { ...clip.transform, y: v } }, 'ty')}
                />
              </Row>
            </div>
            <Row label="Scale">
              <Slider
                label="Scale"
                min={0.1}
                max={3}
                value={clip.transform.scale}
                format={pct}
                onChange={(v) => up({ transform: { ...clip.transform, scale: v } }, 'scale')}
              />
            </Row>
            <Row label="Rotation">
              <Slider
                label="Rotation"
                min={-180}
                max={180}
                step={1}
                value={clip.transform.rotation}
                format={(v) => `${v.toFixed(0)}°`}
                onChange={(v) => up({ transform: { ...clip.transform, rotation: v } }, 'rot')}
              />
            </Row>
            <Row label="Opacity">
              <Slider
                label="Opacity"
                min={0}
                max={1}
                value={clip.transform.opacity}
                format={pct}
                onChange={(v) => up({ transform: { ...clip.transform, opacity: v } }, 'opacity')}
              />
            </Row>
            <div className="grid grid-cols-2 gap-3">
              {(['top', 'bottom', 'left', 'right'] as const).map((edge) => (
                <Row key={edge} label={`Crop ${edge}`}>
                  <Slider
                    label={`Crop ${edge}`}
                    min={0}
                    max={0.45}
                    value={clip.crop[edge]}
                    format={pct}
                    onChange={(v) => up({ crop: { ...clip.crop, [edge]: v } }, `crop-${edge}`)}
                  />
                </Row>
              ))}
            </div>
          </Section>
          <Section title="Color" icon={<Palette />}>
            <Row label="Brightness">
              <Slider
                label="Brightness"
                min={0}
                max={2}
                value={clip.color.brightness}
                format={pct}
                onChange={(v) => up({ color: { ...clip.color, brightness: v } }, 'bright')}
              />
            </Row>
            <Row label="Contrast">
              <Slider
                label="Contrast"
                min={0}
                max={2}
                value={clip.color.contrast}
                format={pct}
                onChange={(v) => up({ color: { ...clip.color, contrast: v } }, 'contrast')}
              />
            </Row>
            <Row label="Saturation">
              <Slider
                label="Saturation"
                min={0}
                max={2}
                value={clip.color.saturation}
                format={pct}
                onChange={(v) => up({ color: { ...clip.color, saturation: v } }, 'sat')}
              />
            </Row>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => s.updateClip(clip.id, { color: { brightness: 1, contrast: 1, saturation: 1 } })}
            >
              Reset color
            </Button>
          </Section>
        </>
      ) : null}
      {audible ? (
        <Section title="Audio" icon={<AudioLines />}>
          <Row label="Volume">
            <Slider
              label="Volume"
              min={0}
              max={2}
              value={clip.volume}
              format={pct}
              onChange={(v) => up({ volume: v }, 'vol')}
            />
          </Row>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm">Loudness normalization</p>
              <p className="text-2xs text-fg-subtle">
                {clip.audio.normalizeGain !== 1
                  ? `Gain ${db(20 * Math.log10(clip.audio.normalizeGain))} to ${TARGET_DB} dB RMS`
                  : `Match ${TARGET_DB} dB RMS`}
              </p>
            </div>
            <Button
              size="xs"
              variant="secondary"
              loading={measuring}
              data-testid="normalize"
              onClick={async () => {
                setMeasuring(true)
                try {
                  const level = await measureLoudness(clip.assetId, inPoint, duration * clip.speed)
                  const gain = Math.min(8, Math.max(0.1, 10 ** ((TARGET_DB - level) / 20)))
                  s.updateClip(clip.id, {
                    audio: { ...clip.audio, normalizeGain: Math.round(gain * 1000) / 1000 },
                  })
                  toast.success(
                    'Loudness normalized',
                    `Measured ${level.toFixed(1)} dB, applied ${db(20 * Math.log10(gain))}.`,
                  )
                } catch {
                  toast.error('Could not measure this clip')
                } finally {
                  setMeasuring(false)
                }
              }}
            >
              Normalize
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor={`gate-${clip.id}`} className="mb-0 text-sm text-fg">
              Noise gate
            </Label>
            <Switch
              id={`gate-${clip.id}`}
              label="Noise gate"
              checked={clip.audio.gate}
              onChange={(v) => s.updateClip(clip.id, { audio: { ...clip.audio, gate: v } })}
            />
          </div>
          {role !== 'voice' ? (
            <div className="flex items-center justify-between">
              <Label htmlFor={`duck-${clip.id}`} className="mb-0 text-sm text-fg">
                Duck under voice
              </Label>
              <Switch
                id={`duck-${clip.id}`}
                label="Duck under voice"
                checked={clip.audio.duck}
                onChange={(v) => s.updateClip(clip.id, { audio: { ...clip.audio, duck: v } })}
              />
            </div>
          ) : null}
          <div className="grid grid-cols-3 gap-2">
            {(['low', 'mid', 'high'] as const).map((band) => (
              <div key={band}>
                <Label className="mb-1 capitalize">{band}</Label>
                <input
                  type="range"
                  aria-label={`EQ ${band}`}
                  min={-12}
                  max={12}
                  step={1}
                  value={clip.audio.eq[band]}
                  onChange={(e) =>
                    up(
                      { audio: { ...clip.audio, eq: { ...clip.audio.eq, [band]: Number(e.target.value) } } },
                      `eq-${band}`,
                    )
                  }
                  className="w-full accent-accent"
                />
                <span className="font-mono text-2xs text-fg-subtle">{db(clip.audio.eq[band])}</span>
              </div>
            ))}
          </div>
        </Section>
      ) : null}
    </>
  )
}

const FONTS = ['Inter', 'DejaVu Serif']
const ANIMATIONS: { value: TitleMotion; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'fade', label: 'Fade' },
  { value: 'rise', label: 'Rise' },
  { value: 'pop', label: 'Pop' },
]

function TextInspector({ clip }: { clip: TitleItem }) {
  const s = useEditor.getState()
  const up = (patch: Partial<TitleItem>, key: string) => s.updateGraphic(clip.id, patch, `${key}-${clip.id}`)
  return (
    <Section title="Text" icon={<Type />}>
      <Row label="Text" htmlFor="text-content">
        <Textarea
          id="text-content"
          data-testid="text-content"
          value={clip.text}
          rows={3}
          className="min-h-0"
          onChange={(e) => up({ text: e.target.value }, 'text')}
        />
      </Row>
      <div className="grid grid-cols-2 gap-3">
        <Row label="Font" htmlFor="text-font">
          <Select id="text-font" value={clip.font} onChange={(e) => up({ font: e.target.value }, 'font')}>
            {FONTS.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </Select>
        </Row>
        <Row label="Weight" htmlFor="text-weight">
          <Select
            id="text-weight"
            value={String(clip.weight)}
            onChange={(e) => up({ weight: Number(e.target.value) }, 'weight')}
          >
            <option value="400">Regular</option>
            <option value="600">Semibold</option>
            <option value="700">Bold</option>
          </Select>
        </Row>
      </div>
      <Row label="Size">
        <Slider
          label="Text size"
          min={18}
          max={220}
          step={1}
          value={clip.size}
          format={(v) => `${v}px`}
          onChange={(v) => up({ size: v }, 'size')}
        />
      </Row>
      <div className="grid grid-cols-2 gap-3">
        <Row label="Color" htmlFor="text-color">
          <div className="flex items-center gap-2">
            <input
              id="text-color"
              type="color"
              value={clip.color.slice(0, 7)}
              onChange={(e) => up({ color: e.target.value }, 'color')}
              className="h-9 w-10 cursor-pointer rounded border border-line-strong bg-transparent"
            />
            <Input
              aria-label="Text color hex"
              value={clip.color}
              onChange={(e) => up({ color: e.target.value }, 'color')}
              className="h-9 font-mono text-xs"
            />
          </div>
        </Row>
        <Row label="Background" htmlFor="text-bg">
          <div className="flex h-9 items-center gap-2">
            <Switch
              id="text-bg"
              label="Text background"
              checked={clip.background !== null}
              onChange={(v) => up({ background: v ? '#07070acc' : null }, 'bg')}
            />
            {clip.background ? (
              <input
                type="color"
                aria-label="Background color"
                value={clip.background.slice(0, 7)}
                onChange={(e) => up({ background: `${e.target.value}cc` }, 'bgc')}
                className="h-8 w-9 cursor-pointer rounded border border-line-strong bg-transparent"
              />
            ) : null}
          </div>
        </Row>
      </div>
      <Row label="Align">
        <div className="flex gap-1">
          {(['Left', 'Center', 'Right'] as const).map((a) => (
            <Button
              key={a}
              size="xs"
              variant={clip.align === a ? 'secondary' : 'ghost'}
              onClick={() => up({ align: a }, 'align')}
            >
              {a}
            </Button>
          ))}
        </div>
      </Row>
      <div className="grid grid-cols-2 gap-3">
        <Row label="Position X">
          <Slider
            label="Text X"
            min={0.05}
            max={0.95}
            value={clip.x}
            format={pct}
            onChange={(v) => up({ x: v }, 'x')}
          />
        </Row>
        <Row label="Position Y">
          <Slider
            label="Text Y"
            min={0.05}
            max={0.95}
            value={clip.y}
            format={pct}
            onChange={(v) => up({ y: v }, 'y')}
          />
        </Row>
      </div>
      <Row label="Animation">
        <div className="flex gap-1" role="radiogroup" aria-label="Text animation">
          {ANIMATIONS.map((a) => (
            <Button
              key={a.value}
              size="xs"
              role="radio"
              aria-checked={clip.enter === a.value}
              variant={clip.enter === a.value ? 'secondary' : 'ghost'}
              onClick={() => up({ enter: a.value }, 'anim')}
            >
              {a.label}
            </Button>
          ))}
        </div>
        <p className="mt-1.5 text-2xs text-fg-subtle">
          Animation curves are evaluated by render-engine’s keyframe evaluator.
        </p>
      </Row>
    </Section>
  )
}

/** Style of the captions graphic (all captions). Shown in the Captions panel. */
export function CaptionStyleControls({ item }: { item: CaptionsItem }) {
  const s = useEditor.getState()
  const up = (patch: Partial<CaptionsItem>, key: string) => s.updateGraphic(item.id, patch, key)
  return (
    <Section title="Caption style (all captions)" icon={<Palette />}>
      <Row label="Size">
        <Slider
          label="Caption size"
          min={24}
          max={120}
          step={1}
          value={item.size}
          format={(v) => `${v}px`}
          onChange={(v) => up({ size: v }, 'capsize')}
        />
      </Row>
      <Row label="Vertical position">
        <Slider
          label="Caption position"
          min={0.1}
          max={0.95}
          value={item.y}
          format={pct}
          onChange={(v) => up({ y: v }, 'capy')}
        />
      </Row>
      <Row label="Color" htmlFor="cap-color">
        <input
          id="cap-color"
          type="color"
          value={item.color.slice(0, 7)}
          onChange={(e) => up({ color: e.target.value }, 'capc')}
          className="h-9 w-10 cursor-pointer rounded border border-line-strong bg-transparent"
        />
      </Row>
    </Section>
  )
}

export function Inspector() {
  const sel = useEditor(useShallow(selectedItem))
  const timeline = useEditor((s) => s.timeline)
  if (!sel || !timeline) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <Scissors className="size-5 text-fg-subtle" />
        <p className="mt-3 text-sm font-medium">Nothing selected</p>
        <p className="mt-1 text-xs text-fg-subtle">
          Select a clip on the timeline to adjust timing, transform, color, audio or text.
        </p>
      </div>
    )
  }
  return (
    <div className="h-full overflow-y-auto" data-testid="inspector">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        {sel.kind === 'media' ? (
          <Volume2 className="size-4 text-fg-subtle" />
        ) : (
          <Type className="size-4 text-fg-subtle" />
        )}
        <p className="truncate text-sm font-medium">
          {sel.kind === 'media' ? sel.clip.name : 'Text overlay'}
        </p>
      </div>
      {sel.kind === 'media' ? (
        <MediaInspector
          clip={sel.clip}
          role={sel.track.role}
          visual={sel.track.type === 'video'}
          fps={timeline.fps}
        />
      ) : null}
      {sel.kind === 'title' ? <TextInspector clip={sel.item} /> : null}
    </div>
  )
}
