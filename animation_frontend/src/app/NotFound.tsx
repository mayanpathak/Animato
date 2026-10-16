import { Link } from 'react-router-dom'
import { useTitle } from '@/lib/useTitle'

export default function NotFound() {
  useTitle('Page not found')
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-6">
      <p className="text-center text-fg-muted">
        This page doesn’t exist.{' '}
        <Link to="/" className="text-fg underline underline-offset-4">
          Go home
        </Link>
      </p>
    </main>
  )
}
