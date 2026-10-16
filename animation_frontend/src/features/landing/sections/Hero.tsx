import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Pause, Play, Sparkles } from 'lucide-react'
import { buttonClass } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { useSession } from '@/stores/session'
import { HERO_PROMPTS } from '../data'
import { container } from '../components/SectionHeading'
import { gsap, MEDIA, useGSAP } from '../lib/gsap'

const LINE_ONE = ['Describe', 'it.']
const LINE_TWO = ['Watch', 'it', 'move.']

/** Types example prompts one character at a time while `active`. */
function useTypewriter(prompts: string[], active: boolean, reduced: boolean) {
  const [index, setIndex] = useState(0)
  const [chars, setChars] = useState(reduced ? prompts[0].length : 0)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!active) return
    const full = prompts[index]
    if (reduced) {
      const t = window.setTimeout(() => {
        const next = (index + 1) % prompts.length
        setIndex(next)
        setChars(prompts[next].length)
      }, 4200)
      return () => window.clearTimeout(t)
    }
    let delay = deleting ? 14 : 38 + Math.random() * 40
    if (!deleting && chars === full.length) delay = 2200
    if (deleting && chars === 0) delay = 300
    const t = window.setTimeout(() => {
      if (!deleting && chars === full.length) setDeleting(true)
      else if (deleting && chars === 0) {
        setDeleting(false)
        setIndex((index + 1) % prompts.length)
      } else setChars(chars + (deleting ? -1 : 1))
    }, delay)
    return () => window.clearTimeout(t)
  }, [active, chars, deleting, index, prompts, reduced])

  return { text: prompts[index].slice(0, chars), full: prompts[index] }
}

function PromptBox({ reduced }: { reduced: boolean }) {
  const navigate = useNavigate()
  const user = useSession((s) => s.user)
  const [value, setValue] = useState('')
  const [focused, setFocused] = useState(false)
  const paused = focused || value.length > 0
  const { text, full } = useTypewriter(HERO_PROMPTS, !paused, reduced)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const prompt = value.trim() || full
    const base = user ? '/app/create' : '/signup'
    navigate(`${base}?prompt=${encodeURIComponent(prompt)}`)
  }

  return (
    <form
      onSubmit={submit}
      className="hero-prompt group relative w-full rounded-2xl bg-line-strong p-px shadow-lg transition-shadow duration-300 focus-within:shadow-glow"
    >
      <div className="flex flex-col gap-2 rounded-[calc(var(--radius-2xl)-1px)] bg-surface-1 p-2 sm:flex-row sm:items-center">
        <div className="relative flex min-w-0 flex-1 items-center">
          <Sparkles className="pointer-events-none absolute left-3 size-4 text-accent" aria-hidden />
          <label htmlFor="hero-prompt" className="sr-only">
            Describe the animation you want
          </label>
          <input
            id="hero-prompt"
            data-testid="hero-prompt-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            autoComplete="off"
            spellCheck={false}
            className="h-12 w-full min-w-0 rounded-xl bg-transparent pr-3 pl-10 text-base text-fg outline-none placeholder:text-fg-subtle"
            placeholder={paused ? 'Describe your animation…' : undefined}
          />
          {!paused ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-3 left-10 flex items-center overflow-hidden text-base whitespace-nowrap text-fg-subtle"
            >
              <span className="truncate">{text}</span>
              <span className="ml-0.5 h-5 w-px shrink-0 animate-pulse-soft bg-accent" />
            </div>
          ) : null}
        </div>
        <button
          type="submit"
          data-testid="hero-prompt-submit"
          className={buttonClass('primary', 'lg', 'w-full sm:w-auto')}
        >
          Generate
          <ArrowRight className="size-4" aria-hidden />
        </button>
      </div>
    </form>
  )
}

function StudioPreview({ reduced }: { reduced: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const playheadRef = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(!reduced)

  // Keep the mini playhead in sync with the real video.
  useEffect(() => {
    const video = videoRef.current
    const head = playheadRef.current
    if (!video || !head) return
    let raf = 0
    const tick = () => {
      if (video.duration > 0)
        head.style.transform = `translateX(${(video.currentTime / video.duration) * 100}%)`
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (playing) video.play().catch(() => setPlaying(false))
    else video.pause()
  }, [playing])

  return (
    <div className="hero-preview relative">
      <div
        aria-hidden
        className="absolute -inset-8 -z-10 rounded-[48px] bg-gradient-accent-soft opacity-80 blur-3xl"
      />
      <div className="overflow-hidden rounded-2xl border border-line-strong bg-surface-1 shadow-lg">
        <div className="flex h-10 items-center gap-3 border-b border-line bg-surface-2/70 px-4">
          <div className="flex gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-surface-4" />
            <span className="size-2.5 rounded-full bg-surface-4" />
            <span className="size-2.5 rounded-full bg-surface-4" />
          </div>
          <p className="min-w-0 truncate font-mono text-2xs text-fg-subtle">
            launch-teaser · Remotion · 1280×720
          </p>
          <span className="ml-auto hidden items-center gap-1.5 rounded-full border border-status-succeeded/25 bg-status-succeeded/10 px-2 py-0.5 text-2xs text-status-succeeded sm:inline-flex">
            <span className="size-1.5 rounded-full bg-current" aria-hidden />
            Ready
          </span>
        </div>
        <div className="relative aspect-video bg-canvas">
          <video
            ref={videoRef}
            src="/media/renders/remotion-gradient.webm"
            autoPlay={!reduced}
            muted
            loop
            playsInline
            preload="metadata"
            aria-label="Example Remotion render: animated gradient title card"
            className="absolute inset-0 size-full object-cover"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          />
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? 'Pause preview' : 'Play preview'}
            className="absolute right-3 bottom-3 inline-grid size-8 place-items-center rounded-full border border-line-strong bg-glass-strong text-fg backdrop-blur-md transition-colors hover:bg-surface-3"
          >
            {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          </button>
        </div>
        <div className="space-y-1.5 border-t border-line bg-surface-1 p-3" aria-hidden>
          <div className="relative">
            <div className="flex h-6 gap-1">
              <div className="w-[38%] rounded-sm border border-accent/30 bg-accent-soft" />
              <div className="w-[34%] rounded-sm border border-status-rendering/25 bg-status-rendering/10" />
              <div className="flex-1 rounded-sm border border-accent/30 bg-accent-soft" />
            </div>
            <div className="mt-1 flex h-4 gap-1">
              <div className="ml-[12%] w-[46%] rounded-sm border border-status-planning/25 bg-status-planning/10" />
            </div>
            <div className="pointer-events-none absolute inset-y-[-4px] left-0 w-full">
              <div ref={playheadRef} className="h-full w-full will-change-transform">
                <div className="h-full w-px bg-fg shadow-glow" />
              </div>
            </div>
          </div>
          <div className="flex justify-between font-mono text-2xs text-fg-faint">
            <span>00:00</span>
            <span>Video · Text</span>
            <span>00:06</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function Hero() {
  const ref = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()

  useGSAP(
    () => {
      if (reduced) return
      const mm = gsap.matchMedia()
      mm.add(MEDIA.motion, () => {
        const tl = gsap.timeline({ defaults: { ease: 'expo.out', duration: 1.1 } })
        tl.from('.hero-badge', { opacity: 0, y: 12, duration: 0.8 })
          .from('.hero-word', { opacity: 0, yPercent: 60, stagger: 0.07 }, '-=0.5')
          .from('.hero-sub', { opacity: 0, y: 16 }, '-=0.8')
          .from('.hero-cta', { opacity: 0, y: 12, stagger: 0.06 }, '-=0.85')
          .from('.hero-prompt', { opacity: 0, y: 20, scale: 0.98 }, '-=0.85')
          .from('.hero-preview', { opacity: 0, y: 40, scale: 0.96, duration: 1.4 }, '-=0.9')
      })
      return () => mm.revert()
    },
    { scope: ref, dependencies: [reduced], revertOnUpdate: true },
  )

  const scrollToEditor = () => {
    document
      .getElementById('editor')
      ?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
  }

  return (
    <section
      ref={ref}
      aria-labelledby="hero-title"
      className="relative isolate overflow-hidden pt-12 pb-20 sm:pt-20 lg:pb-28"
    >
      <div
        aria-hidden
        className="absolute inset-0 -z-10 grid-bg opacity-60 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]"
      />
      <div className={cn(container, 'grid items-center gap-14 lg:grid-cols-[1.05fr_1fr] lg:gap-12')}>
        <div className="min-w-0">
          <p className="hero-badge inline-flex max-w-full items-center gap-2 rounded-full border border-line-strong bg-surface-1/80 px-3 py-1 text-xs text-fg-muted">
            <span className="size-1.5 shrink-0 rounded-full bg-gradient-accent" aria-hidden />
            <span className="truncate">Manim + Remotion, finished in your browser</span>
          </p>
          <h1
            id="hero-title"
            className="mt-6 font-display text-4xl leading-[1.02] font-semibold tracking-tightest text-fg sm:text-5xl lg:text-6xl"
          >
            <span className="block">
              {LINE_ONE.map((w) => (
                <span key={w} className="hero-word mr-[0.22em] inline-block">
                  {w}
                </span>
              ))}
            </span>
            <span className="block pb-1">
              {LINE_TWO.map((w) => (
                <span key={w} className="hero-word mr-[0.22em] inline-block text-gradient last:mr-0">
                  {w}
                </span>
              ))}
            </span>
          </h1>
          <p className="hero-sub mt-6 max-w-xl text-lg text-pretty text-fg-muted">
            Type what you want to see. Animato generates it with Manim or Remotion, then you finish it in a
            real video and voice editor that runs entirely in your browser. Nothing uploaded, nothing waiting
            on a server.
          </p>
          <div className="mt-8 max-w-xl">
            <PromptBox reduced={reduced} />
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link to="/signup" className={buttonClass('primary', 'lg', 'hero-cta')}>
              Start creating free
            </Link>
            <button
              type="button"
              onClick={scrollToEditor}
              className={buttonClass('secondary', 'lg', 'hero-cta')}
            >
              See the editor
            </button>
          </div>
        </div>
        <div className="min-w-0">
          <StudioPreview reduced={reduced} />
        </div>
      </div>
    </section>
  )
}
