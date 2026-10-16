import { useId, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/cn'
import { ease } from '@/lib/motion'
import type { Faq } from '../data'

function FaqItem({ faq, open, onToggle }: { faq: Faq; open: boolean; onToggle: () => void }) {
  const id = useId()
  return (
    <div className="border-b border-line">
      <h3>
        <button
          type="button"
          id={`${id}-q`}
          aria-expanded={open}
          aria-controls={`${id}-a`}
          onClick={onToggle}
          className="flex w-full items-center justify-between gap-6 rounded-md py-5 text-left font-display text-base font-medium tracking-tight text-fg transition-colors hover:text-accent sm:text-lg"
        >
          {faq.q}
          <Plus
            aria-hidden
            className={cn(
              'size-5 shrink-0 text-fg-subtle transition-transform duration-300 ease-out-expo',
              open && 'rotate-45 text-accent',
            )}
          />
        </button>
      </h3>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id={`${id}-a`}
            role="region"
            aria-labelledby={`${id}-q`}
            key="a"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.36, ease: ease.outExpo }}
            className="overflow-hidden"
          >
            <p className="max-w-2xl pb-6 text-base text-fg-muted">{faq.a}</p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

/** Accessible accordion: one answer open at a time. */
export function FaqList({ items, className }: { items: Faq[]; className?: string }) {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <div className={cn('border-t border-line', className)}>
      {items.map((faq, i) => (
        <FaqItem key={faq.q} faq={faq} open={open === i} onToggle={() => setOpen(open === i ? null : i)} />
      ))}
    </div>
  )
}
