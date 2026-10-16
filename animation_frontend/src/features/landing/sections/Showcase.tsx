import { useCallback, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { Play } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { cn } from '@/lib/cn'
import { container, SectionHeading } from '../components/SectionHeading'
import { RENDERS, type Render } from '../data'

function EngineTag({ engine }: { engine: Render['engine'] }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center rounded-full border px-2 font-mono text-2xs',
        engine === 'Manim'
          ? 'border-status-rendering/30 bg-status-rendering/10 text-status-rendering'
          : 'border-accent/30 bg-accent-soft text-accent',
      )}
    >
      {engine}
    </span>
  )
}

function RenderCard({ render, onOpen, tall }: { render: Render; onOpen: () => void; tall: boolean }) {
  const video = useRef<HTMLVideoElement>(null)
  const start = () => {
    video.current?.play().catch(() => undefined)
  }
  const stop = () => {
    const v = video.current
    if (!v) return
    v.pause()
    v.currentTime = 0
  }
  return (
    <motion.button
      type="button"
      layoutId={`render-${render.id}`}
      data-render={render.id}
      onClick={onOpen}
      onPointerEnter={start}
      onPointerLeave={stop}
      onFocus={start}
      onBlur={stop}
      aria-label={`Play “${render.title}”, rendered with ${render.engine}`}
      className="group block w-full overflow-hidden rounded-2xl border border-line bg-surface-1 text-left transition-[border-color,box-shadow] duration-300 hover:border-line-strong hover:shadow-glow"
    >
      <div className={cn('relative overflow-hidden bg-surface-2', tall ? 'aspect-[4/3]' : 'aspect-video')}>
        <div
          aria-hidden
          className="absolute inset-0 grid place-items-center grid-bg [background-size:32px_32px]"
        >
          <span className="grid size-11 place-items-center rounded-full border border-line-strong bg-glass text-fg-muted transition-opacity duration-300 group-hover:opacity-0">
            <Play className="size-4" />
          </span>
        </div>
        <video
          ref={video}
          src={render.src}
          muted
          loop
          playsInline
          preload="none"
          aria-hidden
          tabIndex={-1}
          className="absolute inset-0 size-full object-cover transition-transform duration-700 ease-out-expo group-hover:scale-[1.03]"
        />
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-base font-semibold tracking-tight text-fg">{render.title}</h3>
          <EngineTag engine={render.engine} />
        </div>
        <p className="mt-1.5 text-sm text-fg-muted">“{render.prompt}”</p>
      </div>
    </motion.button>
  )
}

export function Showcase() {
  // `active` outlives `open` so the dialog keeps its layoutId while it animates closed.
  const [active, setActive] = useState<Render | null>(null)
  const [open, setOpen] = useState(false)
  // Dialog re-runs its focus effect when onClose changes, so keep it stable.
  const close = useCallback(() => {
    setOpen(false)
    // The card was swapped for a placeholder while open; return focus to it.
    const id = active?.id
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-render="${id}"]`)?.focus())
  }, [active])
  const show = (r: Render) => {
    setActive(r)
    setOpen(true)
  }

  return (
    <section id="showcase" aria-labelledby="showcase-title" className="scroll-mt-20 py-24 sm:py-32">
      <div className={container}>
        <SectionHeading
          id="showcase-title"
          eyebrow="Showcase"
          title="Real renders, straight from a prompt."
          body="Every clip below came out of Animato unedited. Hover to play, click to watch it full size."
        />
        <ul className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-12">
          {RENDERS.map((r, i) => {
            const wide = i === 0 || i === 3
            return (
              <li key={r.id} data-reveal className={cn('min-w-0', wide ? 'lg:col-span-7' : 'lg:col-span-5')}>
                {open && active?.id === r.id ? (
                  <div className="rounded-2xl border border-dashed border-line" aria-hidden>
                    <div className={wide ? 'aspect-video' : 'aspect-[4/3]'} />
                    <div className="h-24" />
                  </div>
                ) : (
                  <RenderCard render={r} tall={!wide} onOpen={() => show(r)} />
                )}
              </li>
            )
          })}
        </ul>
      </div>

      <Dialog
        open={open}
        onClose={close}
        layoutId={active ? `render-${active.id}` : undefined}
        title={active?.title ?? ''}
        description={active ? `${active.engine} · “${active.prompt}”` : undefined}
        // `text-base` in the Dialog title also matches the --color-canvas token; keep the title readable.
        className="sm:max-w-4xl [&_h2]:text-fg"
      >
        {active ? (
          <video
            key={active.id}
            src={active.src}
            controls
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            className="aspect-video w-full rounded-lg bg-canvas"
          />
        ) : null}
      </Dialog>
    </section>
  )
}
