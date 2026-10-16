import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Download, FileVideo, RefreshCw, Trash2 } from 'lucide-react'
import { Badge, EmptyState, ErrorState, Skeleton } from '@/components/ui/misc'
import { Button, IconButton } from '@/components/ui/button'
import { useExportHistory } from '@/lib/local/hooks'
import type { ExportRecord } from '@/lib/local/models'
import { readFile } from '@/lib/local/opfs'
import { formatBytes, formatDuration, timeAgo } from '@/lib/format'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { toast } from '@/stores/toast'
import { useProjectActions } from '../actions'
import { downloadBlob } from '../lib'
import { ConfirmDialog } from './ProjectDialogs'

async function download(record: ExportRecord) {
  try {
    const file = await readFile(record.path)
    downloadBlob(file, record.fileName)
  } catch {
    toast.error(
      'That export is no longer in this browser',
      'Its file was cleared from local storage. Export the project again.',
    )
  }
}

export function ExportsSection() {
  const exports = useExportHistory()
  const actions = useProjectActions()
  const reduced = useReducedMotion()
  const [pending, setPending] = useState<ExportRecord | null>(null)

  if (exports.isPending) {
    return (
      <div className="flex flex-col gap-2" aria-busy>
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-14 rounded-lg" />
        ))}
      </div>
    )
  }
  if (exports.isError) {
    return (
      <ErrorState
        title="Could not read your exports"
        body="This browser's storage did not answer."
        action={
          <Button
            variant="secondary"
            leftIcon={<RefreshCw className="size-4" />}
            onClick={() => exports.refetch()}
          >
            Try again
          </Button>
        }
      />
    )
  }
  const list = exports.data
  if (list.length === 0) {
    return (
      <EmptyState
        icon={<FileVideo />}
        title="No exports yet"
        body="Videos you export from the editor are encoded on this device and kept here for re-download."
      />
    )
  }

  return (
    <section aria-label="Exports">
      <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface-1">
        <AnimatePresence initial={false}>
          {list.map((r) => (
            <motion.li
              key={r.id}
              layout={!reduced}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-3 px-3 py-2.5"
            >
              <div className="grid size-10 shrink-0 place-items-center rounded-lg border border-line bg-surface-2 text-fg-subtle">
                <FileVideo className="size-4" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-sm text-fg" title={r.fileName}>
                  {r.fileName}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-2xs text-fg-subtle">
                  <Link to={`/app/projects/${r.projectId}/edit`} className="max-w-40 truncate hover:text-fg">
                    {r.projectName}
                  </Link>
                  <span className="font-mono tabular-nums">
                    {r.width}×{r.height}
                  </span>
                  <span className="font-mono tabular-nums">{formatDuration(r.duration)}</span>
                  <span className="font-mono tabular-nums">{formatBytes(r.size)}</span>
                  <span>{timeAgo(r.createdAt)}</span>
                </div>
              </div>
              <Badge className="hidden font-mono uppercase sm:inline-flex">
                {r.format} · {r.videoCodec}
              </Badge>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Download className="size-3.5" />}
                onClick={() => download(r)}
                aria-label={`Download ${r.fileName}`}
              >
                <span className="hidden sm:inline">Download</span>
              </Button>
              <IconButton label={`Delete ${r.fileName}`} size="sm" onClick={() => setPending(r)}>
                <Trash2 />
              </IconButton>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      <ConfirmDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        title="Delete this export?"
        confirmLabel="Delete export"
        body={
          <p>
            <span className="font-mono text-fg">{pending?.fileName}</span> will be removed from this browser.
            The project is not affected and you can export it again any time.
          </p>
        }
        onConfirm={async () => {
          if (!pending) return
          await actions.removeExport(pending)
          toast.success('Export deleted')
        }}
      />
    </section>
  )
}
