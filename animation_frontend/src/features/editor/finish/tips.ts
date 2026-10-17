// One-time tips (plan 12.4): dismissible, never shown again.
import { useState } from 'react'

export type TipId = 'format' | 'voice' | 'first-ready'

function seen(id: TipId): boolean {
  try {
    return localStorage.getItem(`animato:tip:${id}`) === '1'
  } catch {
    return true
  }
}

export function markTip(id: TipId): void {
  try {
    localStorage.setItem(`animato:tip:${id}`, '1')
  } catch {
    // storage unavailable: the tip may show again
  }
}

/** Whether a tip is still to show, and how to dismiss it. */
export function useTip(id: TipId): [boolean, () => void] {
  const [show, setShow] = useState(() => !seen(id))
  return [
    show,
    () => {
      markTip(id)
      setShow(false)
    },
  ]
}
