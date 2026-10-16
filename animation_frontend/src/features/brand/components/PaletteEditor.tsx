import { useState } from 'react'
import { AnimatePresence, Reorder, motion, useDragControls } from 'motion/react'
import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2 } from 'lucide-react'
import { Button, IconButton } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { colorRole, MAX_COLORS, normalizeHex } from '../lib'

interface Swatch {
  id: string
  hex: string
}

let seq = 0
const nextId = () => `sw${++seq}`

const ADD_SUGGESTIONS = ['#f4f4f7', '#0d0d12', '#34d399', '#fbbf24', '#fb7185', '#38bdf8']

/**
 * Up to six colours. Drag the handle (or use the arrow buttons) to reorder:
 * the first three are used as primary, secondary and accent.
 */
export function PaletteEditor({
  colors,
  onChange,
}: {
  colors: string[]
  onChange: (colors: string[]) => void
}) {
  // Stable keys for Reorder; colours can repeat, so they cannot be keys themselves.
  const [swatches, setSwatches] = useState<Swatch[]>(() => colors.map((hex) => ({ id: nextId(), hex })))

  const commit = (next: Swatch[]) => {
    setSwatches(next)
    onChange(next.map((s) => s.hex))
  }
  const move = (i: number, d: -1 | 1) => {
    const j = i + d
    if (j < 0 || j >= swatches.length) return
    const next = [...swatches]
    ;[next[i], next[j]] = [next[j], next[i]]
    commit(next)
  }
  const add = () => {
    if (swatches.length >= MAX_COLORS) return
    const hex = ADD_SUGGESTIONS.find((c) => !swatches.some((s) => s.hex === c)) ?? '#ffffff'
    commit([...swatches, { id: nextId(), hex }])
  }

  return (
    <div>
      <Reorder.Group
        axis="y"
        values={swatches}
        onReorder={commit}
        className="flex flex-col gap-1.5"
        aria-label="Palette colours"
      >
        <AnimatePresence initial={false}>
          {swatches.map((s, i) => (
            <SwatchRow
              key={s.id}
              swatch={s}
              index={i}
              count={swatches.length}
              onHex={(hex) => commit(swatches.map((x) => (x.id === s.id ? { ...x, hex } : x)))}
              onMove={(d) => move(i, d)}
              onRemove={() => commit(swatches.filter((x) => x.id !== s.id))}
            />
          ))}
        </AnimatePresence>
      </Reorder.Group>
      <div className="mt-2.5 flex items-center justify-between gap-3">
        <Button
          variant="outline"
          size="sm"
          leftIcon={<Plus className="size-3.5" />}
          onClick={add}
          disabled={swatches.length >= MAX_COLORS}
          data-testid="brand-color-add"
        >
          Add colour
        </Button>
        <span className="font-mono text-2xs text-fg-subtle">
          {swatches.length}/{MAX_COLORS}
        </span>
      </div>
    </div>
  )
}

function SwatchRow({
  swatch,
  index,
  count,
  onHex,
  onMove,
  onRemove,
}: {
  swatch: Swatch
  index: number
  count: number
  onHex: (hex: string) => void
  onMove: (d: -1 | 1) => void
  onRemove: () => void
}) {
  const controls = useDragControls()
  const [text, setText] = useState(swatch.hex)
  const [prev, setPrev] = useState(swatch.hex)
  // Follow changes from the colour picker.
  if (prev !== swatch.hex) {
    setPrev(swatch.hex)
    setText(swatch.hex)
  }
  const valid = normalizeHex(text) !== null
  const inputId = `hex-${swatch.id}`
  const role = colorRole(index)

  return (
    <Reorder.Item
      value={swatch}
      dragListener={false}
      dragControls={controls}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginTop: -6 }}
      transition={{ duration: 0.18 }}
      className="relative list-none"
    >
      <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-1 p-1.5 pr-1">
        <button
          type="button"
          aria-hidden
          tabIndex={-1}
          onPointerDown={(e) => controls.start(e)}
          className="hidden cursor-grab touch-none text-fg-faint hover:text-fg-muted active:cursor-grabbing sm:block"
        >
          <GripVertical className="size-4" />
        </button>
        <label className="relative size-8 shrink-0 cursor-pointer overflow-hidden rounded-md border border-line-strong shadow-inner-highlight">
          <span className="absolute inset-0" style={{ background: swatch.hex }} />
          <input
            type="color"
            value={swatch.hex}
            onChange={(e) => onHex(e.target.value.toLowerCase())}
            aria-label={`${role} colour picker`}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          />
        </label>
        <div className="min-w-0 flex-1">
          <label htmlFor={inputId} className="block text-2xs font-medium text-fg-subtle">
            {role}
          </label>
          <input
            id={inputId}
            value={text}
            spellCheck={false}
            autoComplete="off"
            maxLength={7}
            aria-invalid={!valid || undefined}
            aria-describedby={valid ? undefined : `${inputId}-err`}
            onChange={(e) => {
              setText(e.target.value)
              const hex = normalizeHex(e.target.value)
              if (hex && e.target.value.replace('#', '').length === 6) onHex(hex)
            }}
            onBlur={() => {
              const hex = normalizeHex(text)
              if (hex) {
                setText(hex)
                if (hex !== swatch.hex) onHex(hex)
              } else setText(swatch.hex)
            }}
            className={cn(
              'w-full rounded-sm bg-transparent font-mono text-sm text-fg uppercase outline-none focus-visible:outline-2 focus-visible:outline-offset-1',
              !valid && 'text-status-failed',
            )}
          />
        </div>
        <div className="flex shrink-0 items-center">
          <IconButton
            label={`Move ${role.toLowerCase()} up`}
            size="sm"
            disabled={index === 0}
            onClick={() => onMove(-1)}
          >
            <ArrowUp />
          </IconButton>
          <IconButton
            label={`Move ${role.toLowerCase()} down`}
            size="sm"
            disabled={index === count - 1}
            onClick={() => onMove(1)}
          >
            <ArrowDown />
          </IconButton>
          <IconButton
            label={`Remove ${role.toLowerCase()}`}
            size="sm"
            disabled={count <= 1}
            onClick={onRemove}
          >
            <Trash2 />
          </IconButton>
        </div>
      </div>
      <AnimatePresence>
        {!valid ? (
          <motion.p
            id={`${inputId}-err`}
            role="alert"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-2 pt-1 text-xs text-status-failed"
          >
            Use a hex colour like #8B5CF6 or #8BF.
          </motion.p>
        ) : null}
      </AnimatePresence>
    </Reorder.Item>
  )
}
