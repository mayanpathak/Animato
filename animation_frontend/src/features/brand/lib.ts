// Brand kit constants and helpers. Kits live in this browser (IndexedDB).
import { uid, type BrandKit } from '@/lib/local/models'

export const MAX_COLORS = 6
export const MAX_LOGO_BYTES = 2 * 1024 * 1024
export const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml']

export interface FontOption {
  value: string
  label: string
  /** CSS font-family used for previews in the app. */
  css: string
  /** Shipped with the editor's GPU text renderer. */
  editor: boolean
}

export const FONTS: FontOption[] = [
  {
    value: 'Inter',
    label: 'Inter',
    css: "'Inter Variable', ui-sans-serif, system-ui, sans-serif",
    editor: true,
  },
  {
    value: 'Geist',
    label: 'Geist',
    css: "'Geist Variable', 'Inter Variable', ui-sans-serif, sans-serif",
    editor: false,
  },
  {
    value: 'JetBrains Mono',
    label: 'JetBrains Mono',
    css: "'JetBrains Mono Variable', ui-monospace, SFMono-Regular, monospace",
    editor: false,
  },
  {
    value: 'DejaVu Serif',
    label: 'DejaVu Serif',
    css: "'DejaVu Serif', 'Bitstream Vera Serif', Georgia, serif",
    editor: true,
  },
  {
    value: 'serif',
    label: 'System serif',
    css: "ui-serif, Georgia, 'Times New Roman', serif",
    editor: false,
  },
]

export function fontCss(value: string): string {
  return FONTS.find((f) => f.value === value)?.css ?? FONTS[0].css
}

export function fontLabel(value: string): string {
  return FONTS.find((f) => f.value === value)?.label ?? value
}

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i

/** "#abc" / "ABCDEF" → "#aabbcc"; null when it is not a hex colour. */
export function normalizeHex(input: string): string | null {
  const m = HEX.exec(input.trim())
  if (!m) return null
  const h = m[1].toLowerCase()
  return `#${h.length === 3 ? [...h].map((c) => c + c).join('') : h}`
}

export const DEFAULT_COLORS = ['#2f7bf6', '#f5f5f7', '#111113']

export function defaultKit(owner: string, name: string): BrandKit {
  return {
    id: uid('brd'),
    owner,
    name,
    colors: [...DEFAULT_COLORS],
    headingFont: 'Inter',
    bodyFont: 'Inter',
    logoAssetId: null,
    logoDataUrl: null,
    tone: '',
    appendToPrompts: false,
    updatedAt: Date.now(),
  }
}

export function colorRole(i: number): string {
  return ['Primary', 'Secondary', 'Accent'][i] ?? `Color ${i + 1}`
}

/** Everything except the timestamp, for change detection. */
export function kitSignature(k: BrandKit): string {
  const { updatedAt: _u, ...rest } = k
  return JSON.stringify(rest)
}
