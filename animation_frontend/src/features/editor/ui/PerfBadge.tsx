import { Cpu } from 'lucide-react'
import { useEngineStats } from '@/wasm/stats'
import { Tooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/cn'

/** "Rust/WASM · WebGPU · 4 ms": the backend that did the last piece of work, and how long it took. */
export function PerfBadge({ compositor }: { compositor: string | null }) {
  const last = useEngineStats((s) => s.last)
  const gpu = compositor?.includes('WebGPU')
  return (
    <Tooltip
      side="bottom"
      content={
        <span className="block max-w-64 whitespace-normal">
          Compositor: {compositor ?? 'starting…'}
          {last ? (
            <>
              <br />
              Last op: {last.category} · {last.name} on {last.backend} in {last.ms.toFixed(1)} ms
            </>
          ) : null}
        </span>
      }
    >
      <span
        tabIndex={0}
        data-testid="perf-badge"
        data-compositor={compositor ?? ''}
        className={cn(
          'hidden h-7 items-center gap-1.5 rounded-full border px-2.5 font-mono text-2xs whitespace-nowrap md:inline-flex',
          gpu
            ? 'border-accent/30 bg-accent-soft text-accent'
            : 'border-line-strong bg-surface-2 text-fg-muted',
        )}
      >
        <Cpu className="size-3" />
        {compositor ?? '…'}
        {last ? (
          <span className="text-fg-subtle">
            · {last.ms < 10 ? last.ms.toFixed(1) : Math.round(last.ms)} ms
          </span>
        ) : null}
      </span>
    </Tooltip>
  )
}
