import { describe, expect, it } from 'vitest'
import { sanitizeEngine, sanitizePrompt } from './validation'

describe('remix link parameters (plan 6.1, 12.2)', () => {
  it('trims, strips control characters and caps at 2,000 characters', () => {
    expect(sanitizePrompt('  hello\u0000 world\u0007 ')).toBe('hello world')
    expect(sanitizePrompt('line one\nline two')).toBe('line one\nline two')
    expect([...sanitizePrompt('é'.repeat(2500))]).toHaveLength(2000)
    expect(sanitizePrompt(null)).toBe('')
  })
  it('accepts only known engines', () => {
    expect(sanitizeEngine('manim')).toBe('manim')
    expect(sanitizeEngine('MANIM')).toBe('auto')
    expect(sanitizeEngine('<script>')).toBe('auto')
  })
})
