// /pricing (plan 6.10, 14.1): two plans, a short comparison, the pricing FAQ.
import { useTitle } from '@/lib/useTitle'
import { FAQS, PLANS, PRICING_NOTE } from './content'
import { Faq } from './parts/Faq'
import { Footer } from './parts/Footer'
import { MarketingBar } from './parts/MarketingBar'
import { PlanCards } from './parts/PlanCards'

const COMPARE: { row: string; free: string; creator: string }[] = [
  { row: 'Renders', free: 'Up to 5 an hour, 15 a day', creator: 'More, announced at launch' },
  { row: 'Engines', free: 'Explainer and Motion', creator: 'Explainer and Motion' },
  { row: 'Edit, captions, export', free: 'In your browser', creator: 'In your browser' },
  { row: 'Export', free: '1080p, 16:9 / 9:16 / 1:1', creator: '1080p, 16:9 / 9:16 / 1:1' },
]

export default function PricingPage() {
  useTitle('Pricing')
  return (
    <div className="min-h-dvh overflow-x-clip bg-canvas text-fg">
      <MarketingBar />
      <main id="main" className="mx-auto max-w-4xl px-4 pt-32 pb-24 sm:px-6 sm:pt-40">
        <h1 className="font-display text-5xl font-semibold tracking-tightest sm:text-6xl">Pricing</h1>
        <p className="mt-5 text-lg text-fg-muted" data-testid="pricing-note">
          {PRICING_NOTE}
        </p>
        <div className="mt-14">
          <PlanCards plans={PLANS} />
        </div>
        <section aria-labelledby="compare-h" className="mt-20">
          <h2 id="compare-h" className="font-display text-2xl font-semibold tracking-tight">
            Compare
          </h2>
          <dl className="mt-6 divide-y divide-line border-y border-line">
            {COMPARE.map((c) => (
              <div key={c.row} className="grid gap-1 py-4 sm:grid-cols-3 sm:gap-6">
                <dt className="text-fg">{c.row}</dt>
                <dd className="text-fg-muted">
                  <span className="text-fg-subtle sm:hidden">Free: </span>
                  {c.free}
                </dd>
                <dd className="text-fg-muted">
                  <span className="text-fg-subtle sm:hidden">Creator: </span>
                  {c.creator}
                </dd>
              </div>
            ))}
          </dl>
        </section>
        <section aria-labelledby="pfaq-h" className="mt-20">
          <h2 id="pfaq-h" className="font-display text-2xl font-semibold tracking-tight">
            Questions
          </h2>
          <Faq items={FAQS.filter((f) => f.pricing)} />
        </section>
      </main>
      <Footer />
    </div>
  )
}
