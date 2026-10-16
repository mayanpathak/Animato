import { Link } from 'react-router-dom'
import { Logo } from '@/components/brand/Logo'

const CONTACT = import.meta.env.VITE_CONTACT_EMAIL as string | undefined

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 text-sm sm:grid-cols-[1.4fr_1fr_1fr] sm:px-6">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-fg-subtle">
            Your videos, voice and edits stay in your browser. Prompts and your account go to Animato’s
            server.
          </p>
        </div>
        <nav aria-label="Product" className="flex flex-col gap-2">
          <span className="text-fg">Product</span>
          <Link to="/signup" className="text-fg-subtle hover:text-fg">
            Start free
          </Link>
          <Link to="/pricing" className="text-fg-subtle hover:text-fg">
            Pricing
          </Link>
          <Link to="/login" className="text-fg-subtle hover:text-fg">
            Log in
          </Link>
        </nav>
        <div className="flex flex-col gap-2">
          <span className="text-fg">Company</span>
          <span className="text-fg-subtle">Terms: published before launch</span>
          {CONTACT ? (
            <a href={`mailto:${CONTACT}`} className="text-fg-subtle hover:text-fg">
              {CONTACT}
            </a>
          ) : null}
        </div>
      </div>
    </footer>
  )
}
