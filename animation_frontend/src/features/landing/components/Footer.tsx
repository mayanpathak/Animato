import { Link, useLocation } from 'react-router-dom'
import { Logo } from '@/components/brand/Logo'
import { container } from './SectionHeading'

interface FooterLink {
  label: string
  hash?: string
  to?: string
  href?: string
}

const COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: 'Product',
    links: [
      { label: 'Features', hash: 'features' },
      { label: 'Editor', hash: 'editor' },
      { label: 'Showcase', hash: 'showcase' },
      { label: 'Pricing', to: '/pricing' },
      { label: 'FAQ', hash: 'faq' },
    ],
  },
  {
    title: 'Get started',
    links: [
      { label: 'Start creating free', to: '/signup' },
      { label: 'Log in', to: '/login' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy', href: '#' },
      { label: 'Terms', href: '#' },
      { label: 'Security', href: '#' },
    ],
  },
]

const linkClass = 'rounded-sm text-sm text-fg-muted transition-colors hover:text-fg'

const YEAR = new Date().getFullYear()

export function Footer() {
  const onLanding = useLocation().pathname === '/'
  return (
    <footer className="border-t border-line bg-surface-1/40">
      <div className={`${container} grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]`}>
        <div className="max-w-xs">
          <Logo />
          <p className="mt-4 text-sm text-fg-muted">
            Describe it. Watch it move. Prompt-to-animation with Manim and Remotion, finished in a real editor
            that runs in your browser.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h2 className="font-mono text-2xs font-medium tracking-widest text-fg-subtle uppercase">
              {col.title}
            </h2>
            <ul className="mt-4 space-y-2.5">
              {col.links.map((l) => (
                <li key={l.label}>
                  {l.href ? (
                    <a href={l.href} className={linkClass}>
                      {l.label}
                    </a>
                  ) : l.hash && onLanding ? (
                    <a href={`#${l.hash}`} className={linkClass}>
                      {l.label}
                    </a>
                  ) : (
                    <Link to={l.to ?? `/#${l.hash}`} className={linkClass}>
                      {l.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div
        className={`${container} flex flex-col gap-2 border-t border-line py-6 text-xs text-fg-subtle sm:flex-row sm:justify-between`}
      >
        <p>© {YEAR} Animato. All rights reserved.</p>
        <p>Edited on your device. Rendered with Manim and Remotion.</p>
      </div>
    </footer>
  )
}
