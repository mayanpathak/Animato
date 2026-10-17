// Developer harness for edit plans (plan 13.5): paste an EditPlanV0, Apply,
// read the warnings. Proves the seam end to end without an LLM. Only in
// development and the e2e build (`?dev=plan`); production builds drop it.
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/field'
import { useEditor } from '../store'
import { compileEditPlan } from './compile'
import { parseEditPlan } from './schema'

export default function DevHarness() {
  const [text, setText] = useState('')
  const [notes, setNotes] = useState<{ tone: 'error' | 'warning' | 'ok'; text: string }[]>([])

  const apply = () => {
    let json: unknown
    try {
      json = JSON.parse(text)
    } catch (e) {
      setNotes([{ tone: 'error', text: `Not JSON: ${e instanceof Error ? e.message : String(e)}` }])
      return
    }
    const parsed = parseEditPlan(json)
    if ('errors' in parsed) {
      setNotes(parsed.errors.map((t) => ({ tone: 'error' as const, text: t })))
      return
    }
    const s = useEditor.getState()
    if (!s.timeline) return
    const out = compileEditPlan(parsed.plan, {
      timeline: s.timeline,
      transcript: s.transcript,
      assets: s.project?.assets ?? [],
      media: s.assets,
    })
    s.run(out.label, out.commands)
    setNotes([
      { tone: 'ok', text: `${out.label}: ${out.commands.length} commands. Undo reverts it.` },
      ...out.warnings.map((t) => ({ tone: 'warning' as const, text: t })),
    ])
  }

  return (
    <section
      aria-label="Edit plan harness"
      className="fixed bottom-4 left-4 z-[var(--z-overlay)] w-96 space-y-2 rounded-xl border border-line-strong bg-surface-1 p-3 shadow-lg"
      data-testid="plan-harness"
    >
      <p className="text-2xs font-semibold tracking-wide text-fg-subtle uppercase">Edit plan (dev)</p>
      <Textarea
        aria-label="Edit plan JSON"
        rows={6}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="min-h-0 font-mono text-2xs"
        data-testid="plan-json"
      />
      <Button size="sm" onClick={apply} disabled={!text.trim()} data-testid="plan-apply">
        Apply
      </Button>
      <ul className="max-h-40 space-y-1 overflow-y-auto text-2xs" data-testid="plan-notes">
        {notes.map((n, i) => (
          <li
            key={i}
            className={
              n.tone === 'error'
                ? 'text-status-failed'
                : n.tone === 'warning'
                  ? 'text-status-warning'
                  : 'text-fg-muted'
            }
          >
            {n.text}
          </li>
        ))}
      </ul>
    </section>
  )
}
