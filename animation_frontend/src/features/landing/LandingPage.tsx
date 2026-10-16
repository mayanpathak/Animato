// / (plan 6.1). The prompt box is the hero; every claim below is true in this
// build (plan 15.6). Illustrations stand in for renders until real Animato
// renders exist (content.ts SITE_MEDIA).
import { useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { buttonClass } from '@/components/ui/button'
import { track } from '@/lib/analytics'
import { duration, ease } from '@/lib/motion'
import { useTitle } from '@/lib/useTitle'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { sanitizeEngine, sanitizePrompt } from '@/lib/validation'
import { FAQS, PLANS, PRICING_NOTE, SITE_MEDIA } from './content'
import { AuthSheet } from './parts/AuthSheet'
import { Faq } from './parts/Faq'
import { Footer } from './parts/Footer'
import { CaptionIllustration, FormatIllustration, StagesIllustration } from './parts/Illustrations'
import { MarketingBar } from './parts/MarketingBar'
import { PlanCards } from './parts/PlanCards'
import { PromptBox } from './parts/PromptBox'

const SECTION = 'mx-auto max-w-6xl px-4 py-18 sm:px-6 sm:py-32'

function Reveal({ children, className }: { children: React.ReactNode; className?: string }) {
  const reduced = useReducedMotion()
  if (reduced) return <div className={className}>{children}</div>
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: duration.slow * 1.4, ease: ease.outExpo }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

function Heading({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="max-w-2xl">
      <h2 className="font-display text-4xl leading-tight font-semibold tracking-tighter text-balance sm:text-5xl">
        {title}
      </h2>
      {sub ? <p className="mt-4 text-lg text-fg-muted">{sub}</p> : null}
    </div>
  )
}

function EngineCard({
  name,
  engine,
  body,
  prompt,
  video,
}: {
  name: string
  engine: string
  body: string
  prompt: string
  video?: string
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface-1 p-6 shadow-inner-highlight sm:p-8">
      {video ? (
        <video
          src={video}
          muted
          loop
          autoPlay
          playsInline
          className="mb-6 aspect-video w-full rounded-lg bg-canvas"
        />
      ) : null}
      <p className="text-sm text-fg-subtle">{engine}</p>
      <h3 className="mt-1 font-display text-2xl font-semibold tracking-tight">{name}</h3>
      <p className="mt-3 text-fg-muted">{body}</p>
      <blockquote className="mt-6 rounded-control bg-surface-2 px-4 py-3 text-sm text-fg">
        “{prompt}”
      </blockquote>
    </div>
  )
}

export default function LandingPage() {
  useTitle('')
  const [params] = useSearchParams()
  const remixPrompt = sanitizePrompt(params.get('prompt'))
  const remixEngine = sanitizeEngine(params.get('engine'))
  const tracked = useRef(false)
  useEffect(() => {
    if (remixPrompt && !tracked.current) {
      tracked.current = true
      track('remix_link_open', { engine: remixEngine })
    }
  }, [remixPrompt, remixEngine])

  return (
    <div className="min-h-dvh overflow-x-clip bg-canvas text-fg">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[var(--z-toast)] focus:rounded-md focus:bg-surface-3 focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <MarketingBar />
      <main id="main" tabIndex={-1} className="outline-none">
        {/* 1. Hero */}
        <section className="mx-auto grid min-h-[720px] max-w-6xl items-center gap-12 px-4 pt-28 pb-16 sm:px-6 lg:max-h-[1000px] lg:min-h-dvh lg:grid-cols-[1.15fr_1fr] lg:pt-14">
          <div className="min-w-0">
            <p className="text-sm font-medium text-fg-muted">Text to animated video</p>
            <h1 className="mt-4 font-display text-[40px] leading-[1.04] font-semibold tracking-tightest sm:text-[64px] xl:text-[76px]">
              <span className="sm:whitespace-nowrap">Explain anything.</span>{' '}
              <span className="sm:whitespace-nowrap">In motion.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-fg-muted sm:text-xl">
              Describe an idea. Animato animates it, then makes it ready for Shorts, Reels and YouTube.
            </p>
            <div className="mt-9">
              <PromptBox initialPrompt={remixPrompt} initialEngine={remixEngine} chips />
            </div>
          </div>
          <div className="min-w-0" aria-label="Illustration: one scene in three formats">
            {SITE_MEDIA.hero ? (
              <video src={SITE_MEDIA.hero} muted loop autoPlay playsInline className="w-full rounded-xl" />
            ) : (
              <FormatIllustration />
            )}
          </div>
        </section>

        {/* 2. How it works */}
        <section className={SECTION} aria-labelledby="how-h">
          <Reveal>
            <h2 id="how-h" className="sr-only">
              How it works
            </h2>
            <Heading title="From a sentence to a post." />
          </Reveal>
          <div className="mt-14 grid gap-10 md:grid-cols-3">
            <Reveal>
              <p className="font-mono text-sm text-fg-subtle">01</p>
              <h3 className="mt-2 text-xl font-semibold">Describe</h3>
              <p className="mt-2 text-fg-muted">Type the idea the way you would explain it to a friend.</p>
              <div className="mt-6 rounded-xl bg-surface-1 px-4 py-5 text-fg ring-1 ring-line" aria-hidden>
                Binary search on 16 boxes, find 42
                <span className="ml-0.5 inline-block h-5 w-px translate-y-1 animate-pulse-soft bg-accent" />
              </div>
            </Reveal>
            <Reveal>
              <p className="font-mono text-sm text-fg-subtle">02</p>
              <h3 className="mt-2 text-xl font-semibold">Animate</h3>
              <p className="mt-2 text-fg-muted">
                Animato writes the animation and renders it on its servers.
              </p>
              <div className="mt-6 rounded-xl bg-surface-1 p-2 ring-1 ring-line">
                <StagesIllustration />
              </div>
            </Reveal>
            <Reveal>
              <p className="font-mono text-sm text-fg-subtle">03</p>
              <h3 className="mt-2 text-xl font-semibold">Finish</h3>
              <p className="mt-2 text-fg-muted">
                Add your voice and captions, pick a format and export, all in your browser.
              </p>
              <div
                className="mt-6 flex items-end gap-3 rounded-xl bg-surface-1 px-5 py-5 ring-1 ring-line"
                aria-hidden
              >
                <span className="h-12 w-21 rounded-md bg-surface-3" />
                <span className="h-16 w-9 rounded-md bg-accent-fill" />
                <span className="size-12 rounded-md bg-surface-3" />
              </div>
            </Reveal>
          </div>
        </section>

        {/* 3. Two engines */}
        <section className={SECTION} aria-labelledby="engines-h">
          <Reveal>
            <h2 id="engines-h" className="sr-only">
              Two engines
            </h2>
            <Heading
              title="Two engines. Picked for you."
              sub="Auto chooses from your words. You can always choose yourself."
            />
          </Reveal>
          <div className="mt-14 grid gap-6 md:grid-cols-2">
            <Reveal>
              <EngineCard
                name="Explainers"
                engine="Manim"
                body="Maths, science, algorithms and exact diagrams."
                prompt="Show why the derivative of sin(x) is cos(x)"
                video={SITE_MEDIA.explainer}
              />
            </Reveal>
            <Reveal>
              <EngineCard
                name="Motion graphics"
                engine="Remotion"
                body="Titles, stats, product teasers and kinetic type."
                prompt="Our revenue grew 38% this quarter, animated bar chart"
                video={SITE_MEDIA.motion}
              />
            </Reveal>
          </div>
        </section>

        {/* 4. Every feed */}
        <section className={SECTION} aria-labelledby="feeds-h">
          <Reveal className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <h2
                id="feeds-h"
                className="font-display text-4xl leading-tight font-semibold tracking-tighter text-balance sm:text-5xl"
              >
                One render. Every format.
              </h2>
              <p className="mt-4 text-lg text-fg-muted">
                Export the same animation for YouTube, Shorts, Reels, TikTok or a square post, in your
                browser. No second render.
              </p>
            </div>
            <div className="grid grid-cols-[1.6fr_0.6fr_1fr] items-end gap-4" aria-hidden>
              <div className="aspect-video rounded-lg bg-surface-2 ring-1 ring-line" />
              <div className="aspect-[9/16] rounded-lg bg-surface-2 ring-1 ring-line" />
              <div className="aspect-square rounded-lg bg-surface-2 ring-1 ring-line" />
              <span className="text-center font-mono text-xs text-fg-subtle">16:9</span>
              <span className="text-center font-mono text-xs text-fg-subtle">9:16</span>
              <span className="text-center font-mono text-xs text-fg-subtle">1:1</span>
            </div>
          </Reveal>
        </section>

        {/* 5. Voice, privately */}
        <section className={SECTION} aria-labelledby="voice-h">
          <Reveal className="grid items-center gap-12 lg:grid-cols-2">
            <CaptionIllustration />
            <div>
              <h2
                id="voice-h"
                className="font-display text-4xl leading-tight font-semibold tracking-tighter text-balance sm:text-5xl"
              >
                Your voice, captioned privately.
              </h2>
              <p className="mt-4 text-lg text-fg-muted">
                Record a voiceover. Captions are made on your device. Your audio never leaves it.
              </p>
            </div>
          </Reveal>
        </section>

        {/* 6. Pricing preview */}
        <section className={SECTION} aria-labelledby="pricing-h">
          <Reveal>
            <h2 id="pricing-h" className="font-display text-4xl font-semibold tracking-tighter sm:text-5xl">
              Free while in early access.
            </h2>
            <p className="mt-4 text-lg text-fg-muted">{PRICING_NOTE}</p>
          </Reveal>
          <Reveal className="mt-12">
            <PlanCards plans={PLANS} />
            <Link to="/pricing" className={buttonClass('ghost', 'md', 'mt-6 -ml-4')}>
              See pricing
            </Link>
          </Reveal>
        </section>

        {/* 7. FAQ */}
        <section className={SECTION} aria-labelledby="faq-h">
          <Reveal>
            <h2 id="faq-h" className="font-display text-4xl font-semibold tracking-tighter sm:text-5xl">
              Questions
            </h2>
          </Reveal>
          <Faq items={FAQS} />
        </section>

        {/* 8. Final CTA */}
        <section className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6 sm:py-36">
          <h2 className="font-display text-4xl font-semibold tracking-tighter sm:text-6xl">
            What will you explain?
          </h2>
          <div className="mt-10 text-left">
            <PromptBox testId="final-prompt" />
          </div>
        </section>
      </main>
      <Footer />
      <AuthSheet />
    </div>
  )
}
