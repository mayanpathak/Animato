import { useTitle } from '@/lib/useTitle'

export default function HomePage() {
  useTitle('Home')
  return <div className="p-8 text-fg-muted">Home</div>
}
