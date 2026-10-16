import { Fragment, useState } from 'react'
import { Check, Minus } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Tabs } from '@/components/ui/tabs'
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

/** Phones: one plan at a time, picked with tabs, instead of a wide table. */
function ComparisonList() {
  const [tier, setTier] = useState(TIERS.find((t) => t.highlight)?.id ?? TIERS[0].id)
  const index = TIERS.findIndex((t) => t.id === tier)
  return (
    <div className="sm:hidden">
      <Tabs
        label="Plan"
        size="sm"
        value={tier}
        onChange={setTier}
        className="w-full [&>button]:flex-1 [&>button]:justify-center"
        items={TIERS.map((t) => ({ value: t.id, label: t.name }))}
      />
      <div className="mt-4 overflow-hidden rounded-2xl border border-line">
        {COMPARISON.map((group) => (
          <dl key={group.group} className="border-b border-line last:border-b-0">
            <p className="bg-surface-1/60 px-4 pt-4 pb-2 font-mono text-2xs font-medium tracking-widest text-accent uppercase">
              {group.group}
            </p>
            {group.rows.map((row) => {
              const v = row.values[index]
              return (
                <div
                  key={row.label}
                  className="flex items-center justify-between gap-4 border-t border-line px-4 py-3 text-sm"
                >
                  <dt className="text-fg-muted">{row.label}</dt>
                  <dd className="shrink-0 text-right">
                    {v === true ? (
                      <>
                        <Check className="size-4 text-accent" aria-hidden />
                        <span className="sr-only">Included</span>
                      </>
                    ) : v === false ? (
                      <>
                        <Minus className="size-4 text-fg-faint" aria-hidden />
                        <span className="sr-only">Not included</span>
                      </>
                    ) : (
                      <span className="text-fg">{v}</span>
                    )}
                  </dd>
                </div>
              )
            })}
          </dl>
        ))}
      </div>
    </div>
  )
}

/** Plan-by-plan comparison; every row is a real capability or a plan term. */
export function ComparisonTable() {
  return (
    <>
      <ComparisonList />
      <div className="hidden overflow-x-auto rounded-2xl border border-line sm:block">
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
    </>
  )
}
