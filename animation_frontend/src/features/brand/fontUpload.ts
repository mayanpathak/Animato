// Brand fonts (plan 6.8): TTF or OTF only, stored in OPFS, registered with
// the graphics engine (parley + Vello) under the family name the file reports.
import { uid, type UploadedFont } from '@/lib/local/models'
import { writeFile } from '@/lib/local/opfs'
import { loadWasm } from '@/features/editor/engine/wasm'

export const MAX_FONT_BYTES = 10 * 1024 * 1024

/** What a font file is, from its first four bytes. */
export function fontKind(bytes: Uint8Array): 'ttf' | 'otf' | 'woff' | 'woff2' | null {
  const tag = String.fromCharCode(...bytes.slice(0, 4))
  if (bytes[0] === 0 && bytes[1] === 1 && bytes[2] === 0 && bytes[3] === 0) return 'ttf'
  if (tag === 'true') return 'ttf'
  if (tag === 'OTTO') return 'otf'
  if (tag === 'wOFF') return 'woff'
  if (tag === 'wOF2') return 'woff2'
  return null
}

/** Checks, registers and stores a font file. Throws a message fit for the user. */
export async function uploadFont(file: File): Promise<UploadedFont> {
  if (file.size > MAX_FONT_BYTES) throw new Error('That font is over 10 MB.')
  const bytes = new Uint8Array(await file.arrayBuffer())
  const kind = fontKind(bytes)
  if (kind === 'woff' || kind === 'woff2')
    throw new Error(
      'WOFF and WOFF2 are web formats the video renderer cannot read. Upload the TTF or OTF file.',
    )
  if (!kind) throw new Error('That file is not a TTF or OTF font.')
  const wasm = await loadWasm()
  let family: string
  try {
    family = (JSON.parse(wasm.register_font(bytes)) as { family: string }).family
  } catch {
    throw new Error('The font could not be read.')
  }
  const path = `fonts/${uid('fnt')}.${kind}`
  await writeFile(path, new Blob([bytes], { type: kind === 'otf' ? 'font/otf' : 'font/ttf' }))
  return { family, path, fileName: file.name }
}
