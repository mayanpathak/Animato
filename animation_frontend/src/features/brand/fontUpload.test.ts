import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fontKind } from './fontUpload'

describe('fontKind', () => {
  it('tells TTF and OTF from web formats by their first bytes', () => {
    expect(fontKind(readFileSync('public/fonts/Inter-Variable.ttf'))).toBe('ttf')
    expect(fontKind(new TextEncoder().encode('OTTO....'))).toBe('otf')
    expect(fontKind(new TextEncoder().encode('wOFF....'))).toBe('woff')
    expect(fontKind(new TextEncoder().encode('wOF2....'))).toBe('woff2')
    expect(fontKind(new TextEncoder().encode('%PDF'))).toBeNull()
  })
})
