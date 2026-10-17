import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'
import { buttonClass } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import type { Plan } from '../content'

export function PlanCards({ plans }: { plans: Plan[] }) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {plans.map((p) => (
        <div
          key={p.id}
          data-testid={`plan-${p.id}`}
          className={cn(
            'flex flex-col rounded-2xl border bg-surface-1 p-7 shadow-inner-highlight',
            p.id === 'free' ? 'border-line-strong' : 'border-line',
          )}
        >
          <div className="flex items-center justify-between">
            <h3 className="font-display text-xl font-semibold">{p.name}</h3>
            <span className="text-sm text-fg-subtle">{p.status}</span>
          </div>
          <p className="mt-5">
            <span className="font-display text-5xl font-semibold tracking-tighter">{p.price}</span>
            {p.cadence ? <span className="ml-2 text-fg-subtle">{p.cadence}</span> : null}
          </p>
          <ul className="mt-7 flex-1 space-y-3">
            {p.points.map((pt) => (
              <li key={pt} className="flex gap-3 text-fg-muted">
                <Check className="mt-1 size-4 shrink-0 text-fg" aria-hidden />
                {pt}
              </li>
            ))}
          </ul>
          <Link
            to="/signup"
            className={buttonClass(p.id === 'free' ? 'primary' : 'secondary', 'lg', 'mt-8 rounded-full')}
          >
            {p.cta}
          </Link>
        </div>
      ))}
    </div>
  )
}
