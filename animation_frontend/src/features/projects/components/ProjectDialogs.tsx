import { useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field, Input, Label } from '@/components/ui/field'
import { errorMessage } from '@/lib/api/http'
import { toast } from '@/stores/toast'
import { normalizeTag } from '../lib'

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
  title = 'Rename project',
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

/** Chip input: Enter or comma adds, Backspace on empty removes the last tag. */
export function TagInput({
  value,
  onChange,
  suggestions,
  id,
}: {
  value: string[]
  onChange: (tags: string[]) => void
  suggestions: string[]
  id?: string
}) {
  const [draft, setDraft] = useState('')
  const add = (raw: string) => {
    const tags = raw.split(',').map(normalizeTag).filter(Boolean)
    if (tags.length) onChange([...new Set([...value, ...tags])].slice(0, 20))
    setDraft('')
  }
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      add(draft)
    } else if (e.key === 'Backspace' && draft === '' && value.length) {
      onChange(value.slice(0, -1))
    }
  }
  const open = suggestions.filter((s) => !value.includes(s) && s.includes(normalizeTag(draft))).slice(0, 8)
  return (
    <div>
      <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-line-strong bg-surface-1 px-2 py-1.5 shadow-inner-highlight focus-within:border-accent focus-within:ring-3 focus-within:ring-accent-soft">
        <AnimatePresence initial={false}>
          {value.map((t) => (
            <motion.span
              key={t}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.14 }}
              className="inline-flex h-6 items-center gap-1 rounded-md border border-line bg-surface-3 pr-0.5 pl-2 text-xs text-fg"
            >
              {t}
              <button
                type="button"
                aria-label={`Remove tag ${t}`}
                onClick={() => onChange(value.filter((v) => v !== t))}
                className="grid size-5 place-items-center rounded text-fg-subtle hover:bg-surface-4 hover:text-fg"
              >
                <X className="size-3" />
              </button>
            </motion.span>
          ))}
        </AnimatePresence>
        <input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => draft && add(draft)}
          placeholder={value.length ? 'Add another…' : 'Type a tag and press Enter'}
          aria-label="Add tag"
          maxLength={32}
          data-autofocus
          className="h-6 min-w-28 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-fg-faint"
        />
      </div>
      {open.length ? (
        <div className="mt-3">
          <p className="mb-1.5 text-2xs font-medium tracking-wide text-fg-subtle uppercase">Your tags</p>
          <div className="flex flex-wrap gap-1.5">
            {open.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => add(s)}
                className="inline-flex h-6 items-center gap-1 rounded-md border border-dashed border-line-strong px-2 text-xs text-fg-muted transition-colors hover:border-accent/50 hover:text-fg"
              >
                <Plus className="size-3" /> {s}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function TagsDialog({
  open,
  onClose,
  title,
  description,
  initial,
  suggestions,
  saveLabel = 'Save tags',
  onSave,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  initial: string[]
  suggestions: string[]
  saveLabel?: string
  onSave: (tags: string[]) => Promise<void>
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title} description={description}>
      {open ? (
        <TagsForm
          initial={initial}
          suggestions={suggestions}
          onSave={onSave}
          onClose={onClose}
          saveLabel={saveLabel}
        />
      ) : null}
    </Dialog>
  )
}

function TagsForm({
  initial,
  suggestions,
  onSave,
  onClose,
  saveLabel,
}: {
  initial: string[]
  suggestions: string[]
  onSave: (tags: string[]) => Promise<void>
  onClose: () => void
  saveLabel: string
}) {
  const [tags, setTags] = useState(initial)
  const [busy, setBusy] = useState(false)
  const save = async () => {
    setBusy(true)
    try {
      await onSave(tags)
      onClose()
    } catch (e) {
      toast.error('Could not save tags', errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex flex-col gap-4">
      <TagInput value={tags} onChange={setTags} suggestions={suggestions} />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={save} loading={busy}>
          {saveLabel}
        </Button>
      </div>
    </div>
  )
}
