import { Avatar } from '@/components/ui/misc'
import { container, SectionHeading } from '../components/SectionHeading'
import { TESTIMONIALS } from '../data'

export function Testimonials() {
  return (
    <section
      aria-labelledby="testimonials-title"
      className="border-y border-line bg-surface-1/40 py-24 sm:py-32"
    >
      <div className={container}>
        <SectionHeading
          id="testimonials-title"
          eyebrow="What teams say"
          title="Less waiting. More shipping."
        />
        <ul className="mt-16 gap-4 sm:columns-2 lg:columns-3">
          {TESTIMONIALS.map((t) => (
            <li key={t.name} data-reveal className="mb-4 break-inside-avoid">
              <figure className="surface-card rounded-2xl p-6">
                <blockquote className="text-base text-fg">“{t.quote}”</blockquote>
                <figcaption className="mt-5 flex items-center gap-3">
                  <Avatar name={t.name} size={36} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-fg">{t.name}</p>
                    <p className="truncate text-xs text-fg-muted">
                      {t.role}, {t.company}
                    </p>
                  </div>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
