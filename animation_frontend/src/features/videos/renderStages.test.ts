import { describe, expect, it } from 'vitest'
import { stageTimes, typicalMinutes } from './renderStages'

describe('stageTimes', () => {
  it('times each stage from observed changes, keeping the first start of a repeated stage', () => {
    const t = stageTimes([
      { status: 'Pending', at: 0 },
      { status: 'GeneratingCode', at: 1000 },
      { status: 'Rendering', at: 5000 },
      { status: 'GeneratingCode', at: 9000 },
    ])
    expect(t.get('Pending')).toEqual({ start: 0, end: 1000 })
    expect(t.get('Rendering')).toEqual({ start: 5000, end: 9000 })
    expect(t.get('GeneratingCode')).toEqual({ start: 1000, end: null })
  })
})

describe('typicalMinutes', () => {
  const done = (ms: number) => ({
    library: 'manim' as const,
    observed: [
      { status: 'Pending' as const, at: 0 },
      { status: 'Completed' as const, at: ms },
    ],
  })
  it('needs three fully watched renders of the engine and returns the median', () => {
    expect(typicalMinutes([done(60_000), done(180_000)], 'manim')).toBeNull()
    expect(typicalMinutes([done(60_000), done(180_000), done(240_000)], 'manim')).toBe(3)
    expect(typicalMinutes([done(60_000), done(180_000), done(240_000)], 'remotion')).toBeNull()
  })
  it('ignores renders joined midway (first status not Pending)', () => {
    const joined = {
      library: 'manim' as const,
      observed: [
        { status: 'Rendering' as const, at: 0 },
        { status: 'Completed' as const, at: 1 },
      ],
    }
    expect(typicalMinutes([done(60_000), done(60_000), joined], 'manim')).toBeNull()
  })
})
