import { Fragment } from 'react'
import { Check, Minus } from 'lucide-react'
import { cn } from '@/lib/cn'
import { COMPARISON, TIERS } from '../data'

function Cell({ value, highlight }: { value: string | boolean; highlight: boolean }) {
  return (
    <td className={cn('px-4 py-3 text-center text-sm', highlight && 'bg-accent-soft')}>
      {value === true ? (
        <>
          <Check className={cn('mx-auto size-4', highlight ? 'text-accent' : 'text-fg-muted')} aria-hidden />
          <span className="sr-only">Included</span>
        </>
      ) : value === false ? (
        <>
          <Minus className="mx-auto size-4 text-fg-faint" aria-hidden />
          <span className="sr-only">Not included</span>
        </>
      ) : (
        <span className={highlight ? 'text-fg' : 'text-fg-muted'}>{value}</span>
      )}
    </td>
  )
}

/** Plan-by-plan comparison; every row is a real capability or a plan term. */
export function ComparisonTable() {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line">
      <table className="w-full min-w-[680px] border-collapse text-left">
        <caption className="sr-only">Feature comparison across Animato plans</caption>
        <thead>
          <tr className="border-b border-line bg-surface-1">
            <th scope="col" className="px-4 py-4 text-sm font-medium text-fg-subtle">
              Plan
            </th>
            {TIERS.map((t) => (
              <th
                key={t.id}
                scope="col"
                className={cn(
                  'px-4 py-4 text-center font-display text-base font-semibold tracking-tight',
                  t.highlight ? 'bg-accent-soft text-fg' : 'text-fg',
                )}
              >
                {t.name}
              </th>
            ))}
          </tr>
        </thead>
        {COMPARISON.map((group) => (
          <tbody key={group.group}>
            <tr className="border-b border-line bg-surface-1/60">
              <th
                scope="colgroup"
                colSpan={TIERS.length + 1}
                className="px-4 pt-6 pb-2 font-mono text-2xs font-medium tracking-widest text-accent uppercase"
              >
                {group.group}
              </th>
            </tr>
            {group.rows.map((row) => (
              <tr key={row.label} className="border-b border-line last:border-b-0">
                <th scope="row" className="px-4 py-3 text-sm font-normal text-fg-muted">
                  {row.label}
                </th>
                {row.values.map((v, i) => (
                  <Fragment key={TIERS[i].id}>
                    <Cell value={v} highlight={Boolean(TIERS[i].highlight)} />
                  </Fragment>
                ))}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  )
}
