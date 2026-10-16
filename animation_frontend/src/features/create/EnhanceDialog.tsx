import { useMemo } from 'react'
import { Check, Cpu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { cn } from '@/lib/cn'
import { charCount, PROMPT_MAX } from '@/lib/validation'
import { wordDiff } from './prompt'

export function EnhanceDialog({
  open,
  before,
  after,
  onAccept,
  onClose,
}: {
  open: boolean
  before: string
  after: string
  onAccept: () => void
  onClose: () => void
}) {
  const ops = useMemo(() => (open ? wordDiff(before, after) : []), [open, before, after])
  const added = ops.filter((o) => o.type === 'add').reduce((n, o) => n + o.text.trim().split(/\s+/).length, 0)
  const removed = ops
    .filter((o) => o.type === 'del')
    .reduce((n, o) => n + o.text.trim().split(/\s+/).length, 0)

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Enhance prompt"
      description="A local rewrite: structured into timed beats with camera, motion and engine detail. Runs in your browser; nothing is sent."
      className="sm:max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Discard
          </Button>
          <Button data-autofocus onClick={onAccept} leftIcon={<Check className="size-4" />}>
            Accept rewrite
          </Button>
        </>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-2xs text-fg-subtle">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2 py-0.5 text-fg-muted">
          <Cpu className="size-3" /> Local rewrite
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-status-succeeded/60" /> {added} words added
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-status-failed/60" /> {removed} removed
        </span>
        <span className="ml-auto font-mono tabular-nums">
          {charCount(after)}/{PROMPT_MAX}
        </span>
      </div>
      <div
        className="max-h-[50dvh] overflow-y-auto rounded-lg border border-line bg-surface-2/60 p-4 text-sm leading-7 break-words whitespace-pre-wrap text-fg-muted"
        aria-label="Changes"
      >
        {ops.map((op, i) => (
          <span
            key={i}
            className={cn(
              op.type === 'add' &&
                'rounded-sm bg-status-succeeded/15 text-status-succeeded [box-decoration-break:clone]',
              op.type === 'del' &&
                'rounded-sm bg-status-failed/10 text-status-failed/90 line-through decoration-status-failed/70',
            )}
          >
            {op.type === 'add' ? (
              <span className="sr-only">added: </span>
            ) : op.type === 'del' ? (
              <span className="sr-only">removed: </span>
            ) : null}
            {op.text}
          </span>
        ))}
      </div>
    </Dialog>
  )
}
