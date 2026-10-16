import { container, SectionHeading } from '../components/SectionHeading'
import { FaqList } from '../components/FaqList'
import { FAQS } from '../data'

export function FaqSection() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="scroll-mt-20 py-24 sm:py-32">
      <div className={`${container} grid gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]`}>
        <SectionHeading
          id="faq-title"
          align="left"
          eyebrow="FAQ"
          title="Questions, answered."
          body="The short version: we render, you edit, and your footage stays on your device."
        />
        <div data-reveal>
          <FaqList items={FAQS} />
        </div>
      </div>
    </section>
  )
}
