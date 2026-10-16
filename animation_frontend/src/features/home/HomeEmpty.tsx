import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowRight, Download, LayoutTemplate, Sparkles } from 'lucide-react'
import { buttonClass } from '@/components/ui/button'
import { ease } from '@/lib/motion'

function PromptArt() {
  return (
    <div className="rounded-lg border border-line bg-canvas/70 p-3" aria-hidden>
      <div className="space-y-1.5">
        <div className="h-1.5 w-11/12 rounded-full bg-fg-faint/40" />
        <div className="h-1.5 w-4/5 rounded-full bg-fg-faint/40" />
        <div className="flex items-center gap-1">
          <div className="h-1.5 w-1/2 rounded-full bg-fg-faint/40" />
          <span className="h-3 w-0.5 animate-pulse-soft bg-accent" />
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <span className="inline-flex h-5 items-center gap-1 rounded-md bg-gradient-accent px-2 text-[9px] font-medium text-white">
          <Sparkles className="size-2.5" /> Generate
        </span>
      </div>
    </div>
  )
}

function EditArt() {
  const tracks = [
    ['w-2/5 bg-accent-violet/60', 'w-1/3 bg-accent-violet/40'],
    ['w-1/4 bg-accent-cyan/50', 'w-1/2 bg-accent-cyan/35'],
    ['w-3/5 bg-accent-magenta/40'],
  ]
  return (
    <div className="relative rounded-lg border border-line bg-canvas/70 p-3" aria-hidden>
      <div className="space-y-1.5">
        {tracks.map((clips, i) => (
          <div key={i} className="flex h-3.5 gap-1 rounded-sm bg-surface-2 p-0.5">
            {clips.map((c, j) => (
              <span key={j} className={`h-full rounded-[2px] ${c}`} />
            ))}
          </div>
        ))}
      </div>
      <span className="absolute top-2 bottom-2 left-[46%] w-px bg-fg">
        <span className="absolute -top-1 -left-1 size-2 rotate-45 bg-fg" />
      </span>
    </div>
  )
}

function ExportArt() {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-line bg-canvas/70 p-3" aria-hidden>
      <span className="grid size-10 shrink-0 place-items-center rounded-md border border-line bg-surface-2 text-status-succeeded">
        <Download className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-mono text-[10px] text-fg-muted">launch-teaser.mp4</span>
        <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-surface-3">
          <span className="block h-full w-3/4 rounded-full bg-gradient-accent" />
        </span>
        <span className="mt-1 block font-mono text-[9px] text-fg-faint">1080p · H.264</span>
      </span>
    </div>
  )
}

const STEPS = [
  {
    n: '01',
    title: 'Prompt and generate',
    body: 'Describe the scene in plain words. Animato picks Manim or Remotion, writes the code and renders it.',
    art: <PromptArt />,
  },
  {
    n: '02',
    title: 'Edit',
    body: 'Open the render on a real timeline: trim, add captions, music and your brand, all in the browser.',
    art: <EditArt />,
  },
  {
    n: '03',
    title: 'Export',
    body: 'Encode MP4 or WebM in this browser. The finished file is saved locally, ready to download again.',
    art: <ExportArt />,
  },
]

export function HomeEmpty() {
  return (
    <section
      aria-labelledby="empty-h"
      className="relative overflow-hidden rounded-3xl border border-line bg-surface-1 px-5 py-10 sm:px-10 sm:py-12"
    >
      <div className="pointer-events-none absolute -top-32 left-1/2 h-64 w-[640px] max-w-full -translate-x-1/2 rounded-full bg-accent-violet/15 blur-3xl" />
      <div className="relative mx-auto max-w-2xl text-center">
        <p className="font-mono text-2xs tracking-widest text-fg-subtle uppercase">
          Prompt <span className="text-fg-faint">→</span> Generate <span className="text-fg-faint">→</span>{' '}
          Edit <span className="text-fg-faint">→</span> Export
        </p>
        <h2 id="empty-h" className="mt-3 font-display text-3xl font-semibold tracking-tighter">
          Your studio is ready
        </h2>
        <p className="mt-2 text-sm text-fg-muted">
          Three steps from an idea to a finished video. Rendering happens on the server; editing and exporting
          happen right here in your browser.
        </p>
      </div>
      <ol className="relative mt-10 grid gap-4 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <motion.li
            key={s.n}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: ease.outExpo, delay: 0.1 + i * 0.08 }}
            className="rounded-2xl border border-line bg-surface-2/50 p-4"
          >
            {s.art}
            <p className="mt-4 font-mono text-2xs text-accent">{s.n}</p>
            <h3 className="mt-1 font-display text-base font-semibold tracking-tight">{s.title}</h3>
            <p className="mt-1 text-xs leading-relaxed text-fg-subtle">{s.body}</p>
          </motion.li>
        ))}
      </ol>
      <div className="relative mt-10 flex flex-wrap justify-center gap-2">
        <Link to="/app/create" className={buttonClass('primary', 'lg')}>
          <Sparkles className="size-4" /> Create your first animation <ArrowRight className="size-4" />
        </Link>
        <Link to="/app/templates" className={buttonClass('secondary', 'lg')}>
          <LayoutTemplate className="size-4" /> Start from a template
        </Link>
      </div>
    </section>
  )
}
