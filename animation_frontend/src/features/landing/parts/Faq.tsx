import { useId, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/cn'
import { duration, ease } from '@/lib/motion'
import type { Faq as FaqItem } from '../content'

export function Faq({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(null)
  const id = useId()
  return (
    <dl className="mt-10 divide-y divide-line border-y border-line">
      {items.map((f, i) => {
        const isOpen = open === i
        return (
          <div key={f.q}>
            <dt>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`${id}-${i}`}
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center gap-4 py-5 text-left text-lg text-fg"
              >
                {f.q}
                <Plus
                  className={cn(
                    'ml-auto size-5 shrink-0 text-fg-subtle transition-transform',
                    isOpen && 'rotate-45',
                  )}
                  aria-hidden
                />
              </button>
            </dt>
            <AnimatePresence initial={false}>
              {isOpen ? (
                <motion.dd
                  id={`${id}-${i}`}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: duration.base, ease: ease.outExpo }}
                  className="overflow-hidden"
                >
                  <p className="max-w-2xl pb-6 text-fg-muted">{f.a}</p>
                </motion.dd>
              ) : null}
            </AnimatePresence>
          </div>
        )
      })}
    </dl>
  )
}
