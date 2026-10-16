import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { createEmptyProject } from '@/features/editor/projects'
import { ASPECT_PRESETS, type AspectKey } from '@/features/editor/model/timeline'
import { keys, useOwner } from '@/lib/local/hooks'
import { cn } from '@/lib/cn'
import { spring } from '@/lib/motion'
import { errorMessage } from '@/lib/api/http'
import { toast } from '@/stores/toast'
import { ASPECT_OPTIONS } from '../lib'

export function NewProjectDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New project"
      description="An empty timeline in this browser. Drop in renders, media, text and captions."
    >
      {open ? <NewProjectForm onClose={onClose} /> : null}
    </Dialog>
  )
}

function NewProjectForm({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [aspect, setAspect] = useState<AspectKey>('16:9')
  const [busy, setBusy] = useState(false)
  const owner = useOwner()
  const qc = useQueryClient()
  const navigate = useNavigate()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    try {
      const project = await createEmptyProject(owner, name.trim() || 'Untitled project', aspect)
      await qc.invalidateQueries({ queryKey: keys.projects(owner) })
      onClose()
      navigate(`/app/projects/${project.id}/edit`)
    } catch (err) {
      toast.error('Could not create the project', errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <Field
        label="Name"
        placeholder="Untitled project"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={120}
        autoComplete="off"
        data-autofocus
        data-testid="new-project-name"
      />
      <fieldset>
        <legend className="mb-1.5 block text-xs font-medium text-fg-muted">Format</legend>
        <div role="radiogroup" aria-label="Format" className="grid grid-cols-3 gap-2">
          {ASPECT_OPTIONS.map((opt) => {
            const active = opt.key === aspect
            const { width, height } = ASPECT_PRESETS[opt.key]
            return (
              <button
                key={opt.key}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setAspect(opt.key)}
                onKeyDown={(e) => {
                  const i = ASPECT_OPTIONS.findIndex((o) => o.key === aspect)
                  const step =
                    e.key === 'ArrowRight' || e.key === 'ArrowDown'
                      ? 1
                      : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
                        ? -1
                        : 0
                  if (!step) return
                  e.preventDefault()
                  const next = ASPECT_OPTIONS[(i + step + ASPECT_OPTIONS.length) % ASPECT_OPTIONS.length]
                  setAspect(next.key)
                  ;(
                    e.currentTarget.parentElement?.querySelector(
                      `[data-aspect="${next.key}"]`,
                    ) as HTMLElement | null
                  )?.focus()
                }}
                tabIndex={active ? 0 : -1}
                data-aspect={opt.key}
                className={cn(
                  'relative flex flex-col items-center gap-2 rounded-lg border px-2 pt-4 pb-3 text-center transition-colors',
                  active
                    ? 'border-transparent text-fg'
                    : 'border-line bg-surface-1 text-fg-muted hover:border-line-strong hover:text-fg',
                )}
              >
                {active ? (
                  <motion.span
                    layoutId="new-project-aspect"
                    transition={spring.layout}
                    className="absolute inset-0 rounded-lg border border-accent/60 bg-accent-soft shadow-glow"
                  />
                ) : null}
                <span className="relative grid h-12 place-items-center">
                  <span
                    className={cn(
                      'block rounded-[3px] border-2',
                      active ? 'border-accent' : 'border-fg-faint',
                    )}
                    style={{
                      aspectRatio: `${width} / ${height}`,
                      height: width >= height ? undefined : 44,
                      width: width >= height ? 56 : undefined,
                    }}
                  />
                </span>
                <span className="relative font-mono text-xs font-medium">{opt.key}</span>
                <span className="relative text-2xs leading-tight text-fg-subtle">{opt.hint}</span>
              </button>
            )
          })}
        </div>
      </fieldset>
      <div className="-mx-5 -mb-4 flex justify-end gap-2 border-t border-line bg-surface-2/50 px-5 py-3">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={busy} data-testid="new-project-create">
          Create and open
        </Button>
      </div>
    </form>
  )
}
