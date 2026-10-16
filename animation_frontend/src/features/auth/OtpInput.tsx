import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react'
import { motion } from 'motion/react'
import { cn } from '@/lib/cn'

const LENGTH = 6

interface OtpInputProps {
  // Zero to six digits, with no gaps.
  value: string
  onChange: (value: string) => void
  // Called once all six boxes are filled.
  onComplete: (value: string) => void
  disabled?: boolean
  invalid?: boolean
}

export function OtpInput({ value, onChange, onComplete, disabled = false, invalid = false }: OtpInputProps) {
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
    <motion.div
      data-testid="otp-input"
      role="group"
      aria-label="Verification code"
      animate={invalid ? { x: [0, -8, 7, -4, 3, 0] } : { x: 0 }}
      transition={{ duration: 0.42 }}
      className="flex justify-between gap-1.5 sm:gap-2.5"
    >
      {Array.from({ length: LENGTH }, (_, index) => {
        const filled = index < value.length
        return (
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
            pattern="[0-9]*"
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            aria-label={`Digit ${index + 1} of ${LENGTH}`}
            aria-invalid={invalid || undefined}
            className={cn(
              'h-14 w-full max-w-13 min-w-0 rounded-lg border bg-surface-1 text-center font-mono text-xl font-semibold text-fg shadow-inner-highlight caret-accent outline-none transition-[border-color,box-shadow,background-color] duration-150',
              'focus:border-accent focus:ring-3 focus:ring-accent-soft disabled:opacity-50',
              filled ? 'border-line-strong bg-surface-2' : 'border-line',
              invalid && 'border-status-failed/70 focus:ring-status-failed/15',
            )}
          />
        )
      })}
    </motion.div>
  )
}
