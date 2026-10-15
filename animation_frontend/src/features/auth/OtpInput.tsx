import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react'

const LENGTH = 6

interface OtpInputProps {
  // Zero to six digits, with no gaps.
  value: string
  onChange: (value: string) => void
  // Called once all six boxes are filled.
  onComplete: (value: string) => void
  disabled?: boolean
}

export function OtpInput({ value, onChange, onComplete, disabled = false }: OtpInputProps) {
  const boxes = useRef<Array<HTMLInputElement | null>>([])

  const commit = (next: string, focusIndex: number) => {
    onChange(next)
    boxes.current[Math.max(0, Math.min(focusIndex, LENGTH - 1))]?.focus()

    if (next.length === LENGTH) onComplete(next)
  }

  const handleChange = (index: number, raw: string) => {
    const digits = raw.replace(/\D/g, '')

    if (digits === '') return

    // More than one digit at once: autofill, or a paste the browser turned
    // into a change. Treat it as the whole code.
    if (digits.length > 1) {
      const code = digits.slice(0, LENGTH)
      commit(code, code.length)
      return
    }

    // Never leave a gap: a digit typed past the end lands in the next free box.
    const at = Math.min(index, value.length)
    commit(value.slice(0, at) + digits + value.slice(at + 1), at + 1)
  }

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace') {
      event.preventDefault()

      if (index < value.length) {
        commit(value.slice(0, index) + value.slice(index + 1), index)
      } else if (index > 0) {
        commit(value.slice(0, index - 1), index - 1)
      }
    } else if (event.key === 'ArrowLeft') {
      boxes.current[Math.max(0, index - 1)]?.focus()
    } else if (event.key === 'ArrowRight') {
      boxes.current[Math.min(LENGTH - 1, index + 1)]?.focus()
    }
  }

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault()

    const code = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, LENGTH)

    if (code !== '') commit(code, code.length)
  }

  return (
    <div className="flex justify-between gap-2">
      {Array.from({ length: LENGTH }, (_, index) => (
        <input
          key={index}
          ref={(element) => {
            boxes.current[index] = element
          }}
          value={value[index] ?? ''}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={handlePaste}
          onFocus={(event) => event.target.select()}
          disabled={disabled}
          autoFocus={index === 0}
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          aria-label={`Digit ${index + 1} of ${LENGTH}`}
          className="h-12 w-11 rounded-md border border-zinc-300 bg-white text-center text-lg font-semibold outline-none focus:border-zinc-900 disabled:bg-zinc-100"
        />
      ))}
    </div>
  )
}
