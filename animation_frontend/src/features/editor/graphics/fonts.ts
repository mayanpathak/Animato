// Fonts for the graphics layer (plan 8.8). The files are served from
// public/fonts (licences in public/fonts/LICENSES.md). In a worker each file
// is registered once with animato-graphics (Vello draws its glyphs) and with
// FontFace under the family name the file gives itself, so the Canvas2D
// fallback draws the same font.
import type { Wasm } from '../engine/wasm'
import type { GraphicsDoc, GraphicsTranscript } from './schema'

export interface BuiltinFont {
  family: string
  file: string
}

/** Every font a title or caption can use in video. `serif` maps to DejaVu Serif. */
export const BUILTIN_FONTS: BuiltinFont[] = [
  { family: 'Inter', file: 'Inter-Variable.ttf' },
  { family: 'Geist', file: 'Geist-Variable.ttf' },
  { family: 'JetBrains Mono', file: 'JetBrainsMono-Variable.ttf' },
  { family: 'DejaVu Serif', file: 'DejaVuSerif-Bold.ttf' },
]

const EMOJI: BuiltinFont = { family: 'Noto Emoji', file: 'NotoEmoji-Variable.ttf' }

export function builtinFont(family: string): BuiltinFont | undefined {
  const name = /^serif$/i.test(family) ? 'DejaVu Serif' : family
  return BUILTIN_FONTS.find((f) => f.family.toLowerCase() === name.toLowerCase())
}

/** Characters Inter and the others do not draw: emoji and pictographs. */
const PICTOGRAPHIC = /\p{Extended_Pictographic}/u

const loaded = new Map<string, Promise<void>>()

async function load(wasm: Wasm, font: BuiltinFont, fallback: boolean): Promise<void> {
  const bytes = new Uint8Array(await (await fetch(`/fonts/${font.file}`)).arrayBuffer())
  const { face, family } = JSON.parse(wasm.register_font(bytes)) as { face: number; family: string }
  if (fallback) wasm.set_fallback_font(face)
  // A worker has self.fonts; the main thread (look thumbnails) has document.fonts.
  const fonts =
    (self as unknown as { fonts?: FontFaceSet }).fonts ??
    (typeof document === 'undefined' ? undefined : document.fonts)
  if (fonts && typeof FontFace !== 'undefined') {
    // Variable files cover their whole weight range.
    const ff = new FontFace(family, bytes, { weight: '100 900' })
    await ff.load()
    fonts.add(ff)
  }
}

function ensure(wasm: Wasm, font: BuiltinFont, fallback = false): Promise<void> {
  let p = loaded.get(font.file)
  if (!p) {
    p = load(wasm, font, fallback)
    // A failed fetch is retried next time instead of being cached.
    p.catch(() => loaded.delete(font.file))
    loaded.set(font.file, p)
  }
  return p
}

/**
 * Registers the fonts a document needs: Inter always (the fallback for an
 * unknown family), the families its items name, and Noto Emoji when any of
 * its text has a pictograph.
 */
export async function ensureFonts(
  wasm: Wasm,
  doc: GraphicsDoc,
  transcript: GraphicsTranscript | null,
): Promise<void> {
  const wanted = new Set<BuiltinFont>([BUILTIN_FONTS[0]])
  const texts: string[] = []
  for (const item of doc.items) {
    if ('style' in item) {
      const f = builtinFont(item.style.font)
      if (f) wanted.add(f)
    }
    if (item.kind === 'title') texts.push(item.text)
    if (item.kind === 'endCard') {
      texts.push(item.headline, item.sub)
      const f = builtinFont(item.font)
      if (f) wanted.add(f)
    }
    if (item.kind === 'watermark') texts.push(item.text)
  }
  if (doc.items.some((i) => i.kind === 'captions') && transcript)
    texts.push(...transcript.words.map((w) => w.text))
  const jobs = [...wanted].map((f) => ensure(wasm, f))
  if (texts.some((t) => PICTOGRAPHIC.test(t))) jobs.push(ensure(wasm, EMOJI, true))
  await Promise.all(jobs)
}
