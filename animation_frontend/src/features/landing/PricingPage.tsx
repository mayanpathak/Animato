import { useRef } from 'react'
import { useTitle } from '@/lib/useTitle'
import { ComparisonTable } from './components/ComparisonTable'
import { FaqList } from './components/FaqList'
import { Footer } from './components/Footer'
import { Navbar } from './components/Navbar'
import { PricingTable } from './components/PricingTable'
import { container, SectionHeading } from './components/SectionHeading'
import { SkipLink } from './components/SkipLink'
import { FAQS } from './data'
import { useReveal } from './lib/useReveal'
import { FinalCta } from './sections/FinalCta'

export default function PricingPage() {
  useTitle('Pricing')
  const main = useRef<HTMLElement>(null)
  useReveal(main)

  return (
    <div className="min-h-dvh overflow-x-clip bg-canvas text-fg">
      <SkipLink />
      <Navbar />
      <main id="main" ref={main} tabIndex={-1} className="outline-none">
        <section aria-labelledby="pricing-page-title" className="relative isolate pt-16 pb-24 sm:pt-24">
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 -z-10 h-[480px] grid-bg opacity-60 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]"
          />
          <div className={container}>
            <div className="mx-auto max-w-2xl text-center">
              <p className="font-mono text-2xs font-medium tracking-widest text-accent uppercase">Pricing</p>
              <h1
                id="pricing-page-title"
                className="mt-3 font-display text-4xl font-semibold tracking-tighter text-balance text-fg sm:text-5xl"
              >
                Pay for renders. <span className="text-gradient">Edit for free, forever.</span>
              </h1>
              <p className="mt-5 text-base text-pretty text-fg-muted sm:text-lg">
                Every plan includes Manim and Remotion, live job tracking and the full in-browser editor.
                Editing, voiceover, captions and export run on your device, so they never count against your
                plan.
              </p>
            </div>
            <PricingTable className="mt-14" />
          </div>
        </section>

        <section aria-labelledby="compare-title" className="pb-24 sm:pb-32">
          <div className={container}>
            <SectionHeading
              id="compare-title"
              eyebrow="Compare plans"
              title="Everything, side by side."
              body="Same editor on every plan. The differences are volume, resolution, queue priority and support."
            />
            <div data-reveal className="mt-12">
              <ComparisonTable />
              <p className="mt-4 text-xs text-fg-subtle">
                * 4K export is encoded by your browser with WebCodecs and is available where your browser and
                hardware support it.
              </p>
            </div>
          </div>
        </section>

        <section aria-labelledby="pricing-faq-title" className="pb-24 sm:pb-32">
          <div className={`${container} grid gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]`}>
            <SectionHeading id="pricing-faq-title" align="left" eyebrow="FAQ" title="Billing and plans." />
            <div data-reveal>
              <FaqList items={FAQS.filter((f) => f.pricing)} />
            </div>
          </div>
        </section>

        <FinalCta />
      </main>
      <Footer />
    </div>
  )
}
