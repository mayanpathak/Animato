import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Check } from 'lucide-react'
import { buttonClass } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { ease } from '@/lib/motion'
import { annualMonthly, TIERS, type Tier } from '../data'

const usd = (n: number) => `$${n.toLocaleString('en-US')}`

function BillingToggle({ annual, onChange }: { annual: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
      <span className={cn('transition-colors', annual ? 'text-fg-subtle' : 'text-fg')} aria-hidden>
        Monthly
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={annual}
        aria-label="Bill annually (2 months free)"
        data-testid="pricing-toggle"
        onClick={() => onChange(!annual)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-200',
          annual ? 'border-transparent bg-gradient-accent' : 'border-line-strong bg-surface-3',
        )}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 600, damping: 35 }}
          className={cn('size-4.5 rounded-full bg-white shadow-sm', annual ? 'ml-[22px]' : 'ml-[3px]')}
        />
      </button>
      <span className={cn('transition-colors', annual ? 'text-fg' : 'text-fg-subtle')} aria-hidden>
        Annual
      </span>
      <span className="rounded-full border border-accent/25 bg-accent-soft px-2 py-0.5 text-2xs font-medium text-accent">
        2 months free
      </span>
    </div>
  )
}

function Price({ tier, annual }: { tier: Tier; annual: boolean }) {
  if (tier.monthly === null) {
    return (
      <div className="flex h-14 items-end">
        <span className="font-display text-4xl font-semibold tracking-tighter">Custom</span>
      </div>
    )
  }
  const value = annual ? annualMonthly(tier.monthly) : tier.monthly
  return (
    <div className="flex h-14 items-end gap-1.5">
      <span className="relative inline-flex overflow-hidden font-display text-4xl font-semibold tracking-tighter tabular-nums">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={value}
            initial={{ y: '60%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '-60%', opacity: 0 }}
            transition={{ duration: 0.42, ease: ease.outExpo }}
            className="inline-block"
          >
            {usd(value)}
          </motion.span>
        </AnimatePresence>
      </span>
      <span className="pb-1.5 text-sm text-fg-subtle">/mo</span>
    </div>
  )
}

function billingNote(tier: Tier, annual: boolean): string {
  if (tier.monthly === null) return 'Volume pricing, billed annually'
  if (tier.monthly === 0) return 'Free forever, no card required'
  return annual ? `${usd(tier.monthly * 10)} billed yearly` : 'Billed monthly'
}

function TierCard({ tier, annual }: { tier: Tier; annual: boolean }) {
  const body = (
    <div className={cn('flex h-full flex-col rounded-2xl p-6', !tier.highlight && 'surface-card')}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-lg font-semibold tracking-tight">{tier.name}</h3>
        {tier.highlight ? (
          <span className="rounded-full bg-gradient-accent px-2.5 py-0.5 text-2xs font-semibold text-white">
            Recommended
          </span>
        ) : null}
      </div>
      <p className="mt-1.5 min-h-10 text-sm text-fg-muted">{tier.blurb}</p>
      <div className="mt-5">
        <Price tier={tier} annual={annual} />
        <p className="mt-1 text-xs text-fg-subtle">{billingNote(tier, annual)}</p>
      </div>
      {tier.href.startsWith('mailto:') ? (
        <a href={tier.href} className={buttonClass('secondary', 'lg', 'mt-6 w-full')}>
          {tier.cta}
        </a>
      ) : (
        <Link
          to={tier.href}
          className={buttonClass(tier.highlight ? 'primary' : 'secondary', 'lg', 'mt-6 w-full')}
        >
          {tier.cta}
        </Link>
      )}
      <ul className="mt-6 space-y-2.5 border-t border-line pt-6">
        {tier.features.map((f) => (
          <li key={f} className="flex gap-2.5 text-sm text-fg-muted">
            <Check
              className={cn('mt-0.5 size-4 shrink-0', tier.highlight ? 'text-accent' : 'text-fg-subtle')}
              aria-hidden
            />
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  )

  if (!tier.highlight) return <div data-testid={`pricing-tier-${tier.id}`}>{body}</div>
  return (
    <div
      data-testid={`pricing-tier-${tier.id}`}
      className="relative rounded-2xl bg-gradient-accent p-px shadow-glow xl:-my-3"
    >
      <div className="h-full rounded-[calc(var(--radius-2xl)-1px)] bg-surface-1">
        <div className="h-full rounded-[calc(var(--radius-2xl)-1px)] bg-gradient-accent-soft">{body}</div>
      </div>
    </div>
  )
}

/** Tier cards with a monthly/annual toggle; shared by the landing page and /pricing. */
export function PricingTable({ className }: { className?: string }) {
  const [annual, setAnnual] = useState(false)
  return (
    <div className={className}>
      <BillingToggle annual={annual} onChange={setAnnual} />
      <div className="mt-10 grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-4">
        {TIERS.map((tier) => (
          <TierCard key={tier.id} tier={tier} annual={annual} />
        ))}
      </div>
      <p className="mt-6 text-center text-xs text-fg-subtle">
        Prices in USD. 4K export uses your browser’s encoders and is available where supported.
      </p>
    </div>
  )
}
