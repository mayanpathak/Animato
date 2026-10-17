import { useState, type FormEvent, type ReactNode } from 'react'
import { Button } from './button'
import { Dialog } from './dialog'
import { Field, Input, Label } from './field'
import { errorMessage } from '@/lib/api/http'
import { toast } from '@/stores/toast'

/** A confirm dialog for destructive actions. */
export function ConfirmDialog({
  open,
  onClose,
  title,
  body,
  confirmLabel,
  onConfirm,
  requireText,
  testId,
}: {
  open: boolean
  onClose: () => void
  title: string
  body: ReactNode
  confirmLabel: string
  onConfirm: () => Promise<void> | void
  /** When set, the user has to type this word to enable the button. */
  requireText?: string
  testId?: string
}) {
  const [busy, setBusy] = useState(false)
  const [typed, setTyped] = useState('')
  const close = () => {
    if (busy) return
    setTyped('')
    onClose()
  }
  const run = async () => {
    setBusy(true)
    try {
      await onConfirm()
      setTyped('')
      onClose()
    } catch (e) {
      toast.error(`${confirmLabel} failed`, errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  const blocked = requireText !== undefined && typed.trim().toLowerCase() !== requireText.toLowerCase()
  return (
    <Dialog
      open={open}
      onClose={close}
      title={title}
      footer={
        <>
          <Button
            variant="ghost"
            onClick={close}
            disabled={busy}
            data-autofocus={requireText ? undefined : true}
          >
            Cancel
          </Button>
          <Button variant="danger" onClick={run} loading={busy} disabled={blocked} data-testid={testId}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm leading-relaxed text-fg-muted">{body}</div>
      {requireText ? (
        <div className="mt-4">
          <Label htmlFor="confirm-text">
            Type <span className="font-mono text-fg">{requireText}</span> to confirm
          </Label>
          <Input
            id="confirm-text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            data-autofocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !blocked) void run()
            }}
          />
        </div>
      ) : null}
    </Dialog>
  )
}

export function RenameDialog({
  open,
  onClose,
  initial,
  title = 'Rename',
  onSave,
}: {
  open: boolean
  onClose: () => void
  initial: string
  title?: string
  onSave: (name: string) => Promise<void>
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      {open ? <RenameForm initial={initial} onSave={onSave} onClose={onClose} /> : null}
    </Dialog>
  )
}

function RenameForm({
  initial,
  onSave,
  onClose,
}: {
  initial: string
  onSave: (n: string) => Promise<void>
  onClose: () => void
}) {
  const [name, setName] = useState(initial)
  const [busy, setBusy] = useState(false)
  const error = name.trim() ? null : 'Give it a name.'
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (error || busy) return
    setBusy(true)
    try {
      await onSave(name.trim())
      onClose()
    } catch (err) {
      toast.error('Could not rename', errorMessage(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field
        label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        maxLength={120}
        autoComplete="off"
        error={name === '' ? null : error}
        data-autofocus
      />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={busy} disabled={Boolean(error)}>
          Save
        </Button>
      </div>
    </form>
  )
}
