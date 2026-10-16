import { useState, type DragEvent } from 'react'
import { ImageUp, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { formatBytes } from '@/lib/format'
import { toast } from '@/stores/toast'
import { LOGO_TYPES, MAX_LOGO_BYTES } from '../lib'

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file.'))
    reader.readAsDataURL(file)
  })
}

/** PNG, JPG or SVG up to 2 MB, kept on the kit as a data URL. */
export function LogoField({
  value,
  onChange,
}: {
  value: string | null
  onChange: (dataUrl: string | null) => void
}) {
  const [over, setOver] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const take = async (file: File | undefined) => {
    if (!file) return
    if (!LOGO_TYPES.includes(file.type)) {
      setError('Use a PNG, JPG or SVG file.')
      return
    }
    if (file.size > MAX_LOGO_BYTES) {
      setError(`That file is ${formatBytes(file.size)}. Logos can be up to 2 MB.`)
      return
    }
    try {
      onChange(await readAsDataUrl(file))
      setError(null)
    } catch {
      toast.error('Could not read that image')
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    void take(e.dataTransfer.files[0])
  }

  return (
    <div>
      <div className="flex items-stretch gap-3">
        <label
          onDragOver={(e) => {
            e.preventDefault()
            setOver(true)
          }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
          className={cn(
            'relative flex min-h-24 flex-1 cursor-pointer items-center gap-3 rounded-lg border border-dashed px-4 py-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-ring',
            over ? 'border-accent bg-accent-soft' : 'border-line-strong bg-surface-1 hover:border-fg-faint',
          )}
        >
          <input
            type="file"
            accept={LOGO_TYPES.join(',')}
            className="sr-only"
            aria-label={value ? 'Replace logo' : 'Upload logo'}
            onChange={(e) => {
              void take(e.target.files?.[0])
              e.target.value = ''
            }}
          />
          {value ? (
            <span className="grid h-16 w-24 shrink-0 place-items-center rounded-md border border-line bg-[conic-gradient(var(--color-surface-3)_25%,var(--color-surface-2)_0_50%,var(--color-surface-3)_0_75%,var(--color-surface-2)_0)] bg-[length:12px_12px] p-2">
              <img src={value} alt="Logo preview" className="max-h-full max-w-full object-contain" />
            </span>
          ) : (
            <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-line bg-surface-2 text-fg-subtle">
              <ImageUp className="size-4" aria-hidden />
            </span>
          )}
          <span className="min-w-0 text-sm">
            <span className="block font-medium text-fg">{value ? 'Replace logo' : 'Upload a logo'}</span>
            <span className="block text-xs text-fg-subtle">
              Drop or choose a PNG, JPG or SVG · up to 2 MB
            </span>
          </span>
        </label>
        {value ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-auto self-stretch"
            aria-label="Remove logo"
            onClick={() => {
              onChange(null)
              setError(null)
            }}
          >
            <Trash2 className="size-4" />
          </Button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="mt-1.5 text-xs text-status-failed">
          {error}
        </p>
      ) : null}
    </div>
  )
}
