import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { container, SectionHeading } from '../components/SectionHeading'
import { PricingTable } from '../components/PricingTable'

export function PricingPreview() {
  return (
    <section id="pricing" aria-labelledby="pricing-title" className="scroll-mt-20 py-24 sm:py-32">
      <div className={container}>
        <SectionHeading
          id="pricing-title"
          eyebrow="Pricing"
          title="Start free. Scale when you ship weekly."
          body="Every plan includes both engines and the full in-browser editor. Plans differ in render volume, export resolution and support."
        />
        <div data-reveal>
          <PricingTable className="mt-12" />
        </div>
        <p className="mt-8 text-center">
          <Link
            to="/pricing"
            className="inline-flex items-center gap-1.5 rounded-sm text-sm text-accent hover:text-fg"
          >
            Compare every plan in detail <ArrowRight className="size-4" aria-hidden />
          </Link>
        </p>
      </div>
    </section>
  )
}
