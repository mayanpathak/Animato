import { Cpu, Film, Layers } from 'lucide-react'
import { cn } from '@/lib/cn'
import { container } from '../components/SectionHeading'
import { WasmDemo } from '../components/WasmDemo'

const PIPELINE = [
  {
    icon: Film,
    title: 'Decode with WebCodecs',
    body: 'Frames come straight from your browser’s hardware video decoders. No server round-trip, no proxy files.',
  },
  {
    icon: Layers,
    title: 'Composite on the GPU',
    body: 'Layers, transforms, crops, color and text are composited with WebGPU by our Rust tooscut-compositor, with a Canvas2D fallback everywhere else.',
  },
  {
    icon: Cpu,
    title: 'Timeline math in Rust',
    body: 'Splits, trims, ripple deletes, snapping and timecode run in Rust compiled to WebAssembly. Try it in the live demo.',
  },
]

export function EditorSpotlight() {
  return (
    <section
      id="editor"
      aria-labelledby="editor-title"
      className="relative isolate scroll-mt-20 overflow-hidden border-y border-line bg-surface-1/40 py-24 sm:py-32"
    >
      <div
        aria-hidden
        className="absolute top-1/2 left-[60%] -z-10 h-[520px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-accent-soft opacity-60 blur-3xl"
      />
      <div
        className={cn(
          container,
          'grid items-center gap-14 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16',
        )}
      >
        <div data-reveal className="min-w-0">
          <p className="font-mono text-2xs font-medium tracking-widest text-accent uppercase">The editor</p>
          <h2
            id="editor-title"
            className="mt-3 font-display text-3xl font-semibold tracking-tighter text-balance text-fg sm:text-4xl"
          >
            Edits happen here, at native speed.
          </h2>
          <p className="mt-4 text-base text-pretty text-fg-muted sm:text-lg">
            The Animato editor is not a thin client for a render farm. It is Rust compiled to WebAssembly,
            running in this tab, on your hardware. Your footage never leaves your machine to be edited.
          </p>
          <ul className="mt-8 space-y-5">
            {PIPELINE.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-4">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line-strong bg-surface-2 text-accent">
                  <Icon className="size-4" aria-hidden />
                </span>
                <div>
                  <h3 className="font-display text-base font-semibold tracking-tight text-fg">{title}</h3>
                  <p className="mt-1 text-sm text-fg-muted">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div data-reveal className="min-w-0">
          <WasmDemo />
        </div>
      </div>
    </section>
  )
}
