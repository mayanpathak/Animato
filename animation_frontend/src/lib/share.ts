// Share-ready output (plan 12.2, 12.3): file names, remix links and post
// text. All local and deterministic; nothing here leaves the browser.
import { SITE_URL } from './entitlements'

/** "Fourier Epicycles!" → "fourier-epicycles". */
export function slugify(text: string, fallback = 'animato-video'): string {
  const slug = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '')
  return slug || fallback
}

/** `<title-slug>-<format>.<ext>`, e.g. `fourier-epicycles-9x16.mp4` (plan 12.3). */
export function exportFileName(title: string, aspect: string, ext: string): string {
  return `${slugify(title)}-${aspect.replace(':', 'x')}.${ext}`
}

/** A link that opens the landing page with this prompt (plan 12.2). It carries the prompt only. */
export function remixLink(prompt: string, engine: string): string {
  const url = new URL('/', SITE_URL)
  url.searchParams.set('prompt', prompt)
  if (engine) url.searchParams.set('engine', engine)
  return url.toString()
}

const STOP = new Set(
  (
    'a an and are as at be by for from how in into is it its of on or that the this to with what why when ' +
    'explain show visualize visualise animate animation make create video about using use your you my our ' +
    'simple quick short minute seconds step steps way ways works work'
  ).split(' '),
)

/** Two hashtags from the prompt's first distinct keywords, in CamelCase. */
export function hashtags(prompt: string): string[] {
  const words =
    prompt
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .match(/[a-z0-9]+/g) ?? []
  const out: string[] = []
  for (const w of words) {
    if (w.length < 4 || STOP.has(w) || /^\d+$/.test(w)) continue
    const tag = `#${w.charAt(0).toUpperCase()}${w.slice(1)}`
    if (!out.includes(tag)) out.push(tag)
    if (out.length === 2) break
  }
  return out
}

/** The title and two hashtags, ready to paste under a post. */
export function postText(title: string, prompt: string): string {
  return [title.trim(), hashtags(prompt).join(' ')].filter(Boolean).join('\n\n')
}
