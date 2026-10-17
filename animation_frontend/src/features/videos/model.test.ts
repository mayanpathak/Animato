import { describe, expect, it } from 'vitest'
import { titleFromPrompt } from './model'

describe('titleFromPrompt', () => {
  it('drops a leading verb, keeps the first clause, caps words and length, Title Case', () => {
    expect(titleFromPrompt('Explain why the derivative of sin(x) is cos(x)')).toBe(
      'Derivative of Sin(x) Is Cos(x)',
    )
    expect(titleFromPrompt('Show how binary search halves a sorted array, step by step')).toBe(
      'Binary Search Halves a Sorted',
    )
    expect(titleFromPrompt('Visualize Fourier epicycles drawing a heart')).toBe('Fourier Epicycles Drawing')
    expect(titleFromPrompt('Kinetic quote: Make it simple, but significant')).toBe('Kinetic Quote')
    expect(titleFromPrompt('   ')).toBe('Untitled video')
  })

  it('never exceeds 32 characters or 6 words', () => {
    const t = titleFromPrompt(
      'Our quarterly revenue grew thirty eight percent this quarter animated bar chart',
    )
    expect(t.length).toBeLessThanOrEqual(32)
    expect(t.split(' ').length).toBeLessThanOrEqual(6)
  })
})
