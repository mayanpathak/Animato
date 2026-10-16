import { describe, expect, it } from 'vitest'
import { isFixing, isLost, nextPoll, observe, pollDelay, POLL_MAX_MS } from './polling'

describe('pollDelay (plan 11.3)', () => {
  it('backs off 2 s, 4 s, 8 s and uses 15 s when hidden', () => {
    expect(pollDelay(0, false)).toBe(2000)
    expect(pollDelay(59_999, false)).toBe(2000)
    expect(pollDelay(60_000, false)).toBe(4000)
    expect(pollDelay(5 * 60_000 - 1, false)).toBe(4000)
    expect(pollDelay(5 * 60_000, false)).toBe(8000)
    expect(pollDelay(0, true)).toBe(15_000)
  })
})

describe('nextPoll', () => {
  const start = { startedAt: 0, failures: 0 }
  it('stops on a terminal status', () => {
    expect(nextPoll('Completed', start, 1000, false)).toBe(false)
    expect(nextPoll('Failed', start, 1000, false)).toBe(false)
    expect(nextPoll('Rendering', start, 1000, false)).toBe(2000)
    expect(nextPoll(undefined, start, 1000, false)).toBe(2000)
  })
  it('gives up after 8 consecutive failures or 45 minutes', () => {
    expect(isLost({ startedAt: 0, failures: 7 }, 1000)).toBe(false)
    expect(isLost({ startedAt: 0, failures: 8 }, 1000)).toBe(true)
    expect(isLost(start, POLL_MAX_MS)).toBe(true)
    expect(nextPoll('Rendering', { startedAt: 0, failures: 8 }, 1000, false)).toBe(false)
  })
})

describe('observe and isFixing', () => {
  it('records only changes and detects a fix attempt', () => {
    let list = observe([], 'Pending', 1)
    list = observe(list, 'Pending', 2)
    expect(list).toHaveLength(1)
    list = observe(list, 'GeneratingCode', 3)
    expect(isFixing(list)).toBe(false)
    list = observe(list, 'Rendering', 4)
    list = observe(list, 'GeneratingCode', 5)
    expect(isFixing(list)).toBe(true)
    expect(list.map((o) => o.status)).toEqual(['Pending', 'GeneratingCode', 'Rendering', 'GeneratingCode'])
  })
})
