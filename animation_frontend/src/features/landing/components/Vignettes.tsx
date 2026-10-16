// Small illustrative UI vignettes for "How it works", built from DOM and CSS.
// They are decorative (aria-hidden): the step text carries the meaning.
import type { ReactNode } from 'react'
import { Check, Download, Mic, Scissors, Sparkles, Type } from 'lucide-react'
import { cn } from '@/lib/cn'

function Frame({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'overflow-hidden rounded-2xl border border-line-strong bg-surface-1 shadow-lg',
        className,
      )}
    >
      <div className="flex h-9 items-center gap-2 border-b border-line bg-surface-2/60 px-4">
        <span className="size-2 rounded-full bg-surface-4" />
        <span className="size-2 rounded-full bg-surface-4" />
        <span className="size-2 rounded-full bg-surface-4" />
        <span className="ml-2 truncate font-mono text-2xs text-fg-subtle">{title}</span>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  )
}

export function PromptVignette({ className }: { className?: string }) {
  return (
    <Frame title="New animation" className={className}>
      <p className="font-mono text-2xs tracking-widest text-fg-subtle uppercase">Prompt</p>
      <div className="mt-2 rounded-xl border border-line-strong bg-surface-2 p-3.5 text-sm leading-relaxed text-fg">
        Visualize binary search on a sorted array of 16 numbers. Highlight low, mid and high at each step, and
        end on the found value.
        <span className="ml-0.5 inline-block h-4 w-px translate-y-0.5 animate-pulse-soft bg-accent" />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs text-fg-subtle">Engine</span>
        <span className="rounded-md border border-accent/30 bg-accent-soft px-2 py-1 text-xs text-accent">
          Manim
        </span>
        <span className="rounded-md border border-line px-2 py-1 text-xs text-fg-muted">Remotion</span>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-gradient-accent px-3 py-1.5 text-xs font-medium text-white shadow-glow">
          <Sparkles className="size-3.5" /> Generate
        </span>
      </div>
    </Frame>
  )
}

const STAGES = [
  { label: 'Queued', tone: 'text-status-queued', done: true },
  { label: 'Planning scenes', tone: 'text-status-planning', done: true },
  { label: 'Rendering', tone: 'text-status-rendering', done: false, active: true },
  { label: 'Encoding', tone: 'text-fg-faint', done: false },
  { label: 'Ready', tone: 'text-fg-faint', done: false },
]

export function GenerateVignette({ className }: { className?: string }) {
  return (
    <Frame title="binary-search · Manim" className={className}>
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex h-6 items-center gap-1.5 rounded-full border border-status-rendering/25 bg-status-rendering/10 px-2.5 text-xs font-medium text-status-rendering">
          <span className="relative flex size-1.5">
            <span className="absolute inset-0 animate-ping rounded-full bg-current opacity-60" />
            <span className="relative size-1.5 rounded-full bg-current" />
          </span>
          Rendering
        </span>
        <span className="font-mono text-xs text-fg-muted">ETA 0:38</span>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-3">
        <div className="h-full w-[62%] rounded-full bg-gradient-accent" />
      </div>
      <ol className="mt-5 space-y-2.5">
        {STAGES.map((s) => (
          <li key={s.label} className="flex items-center gap-3 text-sm">
            <span
              className={cn(
                'grid size-5 place-items-center rounded-full border',
                s.done
                  ? 'border-status-succeeded/30 bg-status-succeeded/10 text-status-succeeded'
                  : 'border-line-strong',
                s.active && 'border-status-rendering/40',
              )}
            >
              {s.done ? (
                <Check className="size-3" />
              ) : s.active ? (
                <span className="size-1.5 animate-pulse-soft rounded-full bg-status-rendering" />
              ) : null}
            </span>
            <span className={cn(s.done ? 'text-fg-muted' : s.tone, s.active && 'font-medium')}>
              {s.label}
            </span>
          </li>
        ))}
      </ol>
    </Frame>
  )
}

// Deterministic pseudo-waveform heights.
const WAVE = Array.from(
  { length: 48 },
  (_, i) => 25 + Math.round(Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.6)) * 70),
)

export function EditVignette({ className }: { className?: string }) {
  return (
    <Frame title="Editor · binary-search" className={className}>
      <div className="flex flex-wrap items-center gap-1.5">
        {[
          { icon: Scissors, label: 'Split' },
          { icon: Type, label: 'Text' },
          { icon: Mic, label: 'Record' },
        ].map(({ icon: Icon, label }) => (
          <span
            key={label}
            className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface-2 px-2 py-1 text-xs text-fg-muted"
          >
            <Icon className="size-3.5" /> {label}
          </span>
        ))}
        <span className="ml-auto rounded-md border border-line px-2 py-1 font-mono text-2xs text-fg-muted">
          1.5×
        </span>
      </div>
      <div className="relative mt-4 space-y-1.5">
        <div className="flex h-7 gap-1">
          <div className="w-[20%] rounded-sm border border-status-planning/30 bg-status-planning/10" />
          <div className="ml-[22%] w-[30%] rounded-sm border border-status-planning/30 bg-status-planning/10 px-1.5 text-2xs leading-6 text-status-planning">
            “Found it”
          </div>
        </div>
        <div className="flex h-9 gap-1">
          <div className="w-[44%] rounded-sm border border-accent/35 bg-accent-soft px-1.5 text-2xs leading-8 text-accent">
            intro.webm
          </div>
          <div className="flex-1 rounded-sm border border-accent/35 bg-accent-soft px-1.5 text-2xs leading-8 text-accent">
            search.webm
          </div>
        </div>
        <div className="flex h-7 items-center gap-px overflow-hidden rounded-sm border border-status-succeeded/25 bg-status-succeeded/5 px-1">
          {WAVE.map((h, i) => (
            <span
              key={i}
              className="w-full rounded-full bg-status-succeeded/60"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
        <div className="h-5 rounded-sm border border-status-rendering/25 bg-status-rendering/10 px-1.5 text-2xs leading-4 text-status-rendering">
          Music · ducked −12 dB under voice
        </div>
        <div className="absolute inset-y-[-6px] left-[46%] w-px bg-fg shadow-glow">
          <span className="absolute -top-1 -left-1 size-2 rotate-45 bg-fg" />
        </div>
      </div>
      <div className="mt-3 flex justify-between font-mono text-2xs text-fg-faint">
        <span>00:00:00:00</span>
        <span className="text-fg-muted">00:00:04:12</span>
        <span>00:00:09:00</span>
      </div>
    </Frame>
  )
}

export function ExportVignette({ className }: { className?: string }) {
  return (
    <Frame title="Export" className={className}>
      <div className="grid grid-cols-3 gap-2">
        {['16:9', '9:16', '1:1'].map((a, i) => (
          <div
            key={a}
            className={cn(
              'grid h-14 place-items-center rounded-lg border text-xs',
              i === 0 ? 'border-accent/40 bg-accent-soft text-accent' : 'border-line text-fg-muted',
            )}
          >
            {a}
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="rounded-md border border-line bg-surface-2 px-2 py-1 text-fg">MP4</span>
        <span className="rounded-md border border-line px-2 py-1 text-fg-muted">WebM</span>
        <span className="rounded-md border border-line bg-surface-2 px-2 py-1 text-fg">1080p</span>
        <span className="rounded-md border border-line px-2 py-1 text-fg-muted">Burn in captions</span>
      </div>
      <div className="mt-5 flex items-center justify-between text-xs">
        <span className="inline-flex items-center gap-1.5 text-fg-muted">
          <Download className="size-3.5" /> Encoding on this device
        </span>
        <span className="font-mono text-fg-muted">72%</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
        <div className="h-full w-[72%] rounded-full bg-gradient-accent" />
      </div>
      <p className="mt-2 font-mono text-2xs text-fg-subtle">WebCodecs · frame 194 / 270 · 0 bytes uploaded</p>
    </Frame>
  )
}
