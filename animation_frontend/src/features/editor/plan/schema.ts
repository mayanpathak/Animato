// Edit plan v0 (plan 13.3): what a future assistant returns, and what the
// compiler (compile.ts) turns into editor commands. Versioned and validated
// with zod; times are seconds; anchors are a time or a transcript word.
import { z } from 'zod'

const seconds = z.number().finite().min(0)

export const AnchorSchema = z.union([
  z.object({ t: seconds }).strict(),
  z.object({ word: z.number().int().min(0), edge: z.enum(['start', 'end']) }).strict(),
])

export const EditPlanV0Schema = z
  .object({
    version: z.literal(0),
    /** Shown to the user, plain language. */
    summary: z.string().min(1).max(500),
    format: z.enum(['16:9', '9:16', '1:1']).optional(),
    look: z.enum(['clean', 'bold', 'minimal', 'brand']).optional(),
    /** Ranges of the main clip to keep, in order. */
    keep: z.array(z.object({ from: AnchorSchema, to: AnchorSchema }).strict()).optional(),
    inserts: z
      .array(
        z
          .object({
            /** An asset label, e.g. "Clip 1". */
            asset: z.string().min(1),
            at: AnchorSchema,
            duration: z.number().finite().positive(),
            inPoint: seconds.optional(),
            mode: z.enum(['cutaway', 'overlay']),
            transition: z.enum(['cut', 'fade', 'zoom']).optional(),
          })
          .strict(),
      )
      .optional(),
    music: z
      .object({ asset: z.string().min(1), volume: z.number().finite().min(0).max(2), duck: z.boolean() })
      .strict()
      .nullable()
      .optional(),
    title: z
      .object({ text: z.string().max(120), start: seconds, end: seconds })
      .strict()
      .nullable()
      .optional(),
    captions: z
      .object({ style: z.enum(['clean', 'bold', 'minimal']) })
      .strict()
      .nullable()
      .optional(),
    emphasis: z
      .array(z.object({ word: z.number().int().min(0), kind: z.enum(['color', 'pop', 'zoom']) }).strict())
      .optional(),
  })
  .strict()

export type Anchor = z.infer<typeof AnchorSchema>
export type EditPlanV0 = z.infer<typeof EditPlanV0Schema>

/** Parses unknown input (an assistant's JSON) into a plan, or the reasons it is not one. */
export function parseEditPlan(input: unknown): { plan: EditPlanV0 } | { errors: string[] } {
  const r = EditPlanV0Schema.safeParse(input)
  if (r.success) return { plan: r.data }
  return { errors: r.error.issues.map((i) => `${i.path.join('.') || 'plan'}: ${i.message}`) }
}
