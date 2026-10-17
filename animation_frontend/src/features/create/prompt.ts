// Create's logic, all in the browser. The server accepts only
// { prompt, library }: length and style become a hint line, brand colours a
// second one, and "Tidy up my prompt" is a deterministic local rewrite.
import type { Engine, Library } from '@/lib/api/types'
import type { BrandKit } from '@/lib/local/models'
import { charCount, PROMPT_MAX } from '@/lib/validation'

export type { Engine }

export type LengthId = 'short' | 'medium' | 'long'
export const LENGTHS: { id: LengthId; label: string; seconds: number }[] = [
  { id: 'short', label: 'Short', seconds: 10 },
  { id: 'medium', label: 'Medium', seconds: 20 },
  { id: 'long', label: 'Long', seconds: 45 },
]

export type StyleId = 'Clean' | 'Bold' | 'Playful' | 'Technical'
export const STYLE_IDS: StyleId[] = ['Clean', 'Bold', 'Playful', 'Technical']

export interface CreateOptions {
  length: LengthId
  style: StyleId
  /** Add the brand kit's colours, fonts and tone (only offered when a kit exists). */
  useBrand: boolean
}

export const DEFAULT_OPTIONS: CreateOptions = { length: 'medium', style: 'Clean', useBrand: false }

export function lengthSeconds(id: LengthId): number {
  return LENGTHS.find((l) => l.id === id)?.seconds ?? 20
}

/** The options as stored on the local job record. */
export function recordOptions(o: CreateOptions, brandKitId: string | null) {
  return { aspect: '16:9', duration: lengthSeconds(o.length), style: o.style, brandKitId }
}

/** Maps a stored job record's options back to Create's (for "Try again"). */
export function optionsFromRecord(o: {
  duration: number
  style: string
  brandKitId: string | null
}): CreateOptions {
  const length = [...LENGTHS].sort(
    (a, b) => Math.abs(a.seconds - o.duration) - Math.abs(b.seconds - o.duration),
  )[0].id
  const style = STYLE_IDS.includes(o.style as StyleId) ? (o.style as StyleId) : 'Clean'
  return { length, style, useBrand: o.brandKitId !== null }
}

// ---------------------------------------------------------------- engine pick

const MANIM_WORDS = [
  'math',
  'mathematical',
  'physics',
  'algorithm',
  'algorithms',
  'proof',
  'prove',
  'theorem',
  'graph',
  'graphs',
  'equation',
  'equations',
  'calculus',
  'derivative',
  'integral',
  'matrix',
  'matrices',
  'vector',
  'vectors',
  'geometry',
  'fractal',
  'mandelbrot',
  'fourier',
  'sorting',
  'sort',
  'probability',
  'pendulum',
  'orbit',
  'wave',
  'polynomial',
  'triangle',
  'pythagorean',
  'pythagoras',
  'automaton',
  'binary',
  'recursion',
  'latex',
]

const MANIM_RE = new RegExp(`\\b(${MANIM_WORDS.join('|')})\\b`, 'i')

/** Local keyword heuristic: maths and science go to Manim, everything else to Remotion. */
export function pickEngine(prompt: string): { library: Library; reason: string | null } {
  const m = MANIM_RE.exec(prompt)
  return m ? { library: 'manim', reason: m[1].toLowerCase() } : { library: 'remotion', reason: null }
}

export function resolveLibrary(engine: Engine, prompt: string): Library {
  return engine === 'auto' ? pickEngine(prompt).library : engine
}

// -------------------------------------------------------------- server prompt

export function brandSuffix(kit: BrandKit | null | undefined): string {
  if (!kit) return ''
  const parts: string[] = []
  const colors = kit.colors.filter(Boolean).slice(0, 5)
  if (colors.length) parts.push(`Brand colors: ${colors.join(', ')}.`)
  const heading = kit.headingFont.trim()
  const body = kit.bodyFont.trim()
  if (heading && body && heading !== body)
    parts.push(`Fonts: ${heading} for headings, ${body} for body text.`)
  else if (heading || body) parts.push(`Font: ${heading || body}.`)
  if (kit.tone.trim()) parts.push(`Tone: ${kit.tone.trim().replace(/\.$/, '')}.`)
  return parts.join(' ')
}

/**
 * The exact text sent as `prompt` to POST /api/jobs. No aspect ratio: the
 * workers always render a 16:9 stage (plan 2.3); formats are a Finish feature.
 */
export function buildServerPrompt(
  prompt: string,
  options: CreateOptions,
  kit: BrandKit | null | undefined,
): string {
  const lines = [`About ${lengthSeconds(options.length)} seconds. Style: ${options.style.toLowerCase()}.`]
  const brand = options.useBrand ? brandSuffix(kit) : ''
  if (brand) lines.push(brand)
  return `${prompt.trim()}\n\n${lines.join(' ')}`
}

export function serverPromptError(serverPrompt: string): string | null {
  const n = charCount(serverPrompt)
  return n > PROMPT_MAX
    ? `With the options added the prompt is ${n} characters; the limit is ${PROMPT_MAX}. Shorten it by ${n - PROMPT_MAX}.`
    : null
}

// ------------------------------------------------------------- local rewrite

const VAGUE: Record<string, string> = {
  nice: 'polished',
  cool: 'striking',
  good: 'clear',
  awesome: 'bold',
  beautiful: 'elegant',
  stuff: 'elements',
  things: 'elements',
  simple: 'clean',
  some: 'a few',
  quickly: 'briskly',
  pretty: 'refined',
}

const STYLE_MOTION: Record<StyleId, string> = {
  Clean:
    'Keep motion restrained: one idea on screen at a time, generous negative space, soft ease-out fades.',
  Bold: 'Use large type, high contrast, punchy cuts and confident, fast entrances.',
  Playful: 'Use bouncy overshoot easing, quick staggered entrances and a little squash and stretch.',
  Technical: 'Use precise linear timing, a grid-aligned layout and monospaced labels.',
}

const ENGINE_VOCAB: Record<Library, string> = {
  manim:
    'Build it with Manim primitives (Axes, MathTex, VGroup); animate with Create, Transform and FadeIn, and typeset every label in LaTeX.',
  remotion:
    'Animate with spring-based easing and interpolate(), stagger entrances about 4 frames apart, and keep text inside title-safe margins.',
}

function sentences(text: string): string[] {
  return (text.match(/[^.!?\n]+[.!?]*/g) ?? []).map((s) => s.trim()).filter(Boolean)
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function endWithPeriod(s: string): string {
  return /[.!?]$/.test(s) ? s : `${s}.`
}

function sharpen(text: string): string {
  return text.replace(/\b([A-Za-z]+)\b/g, (word) => {
    const swap = VAGUE[word.toLowerCase()]
    if (!swap) return word
    return word[0] === word[0].toUpperCase() ? capitalise(swap) : swap
  })
}

function seconds(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

/**
 * Deterministic rewrite: sharpens vague words, structures the idea into timed
 * beats, and adds camera, motion and engine vocabulary. Same input, same output.
 */
export function enhancePrompt(prompt: string, library: Library, options: CreateOptions): string {
  // Already structured by a previous rewrite: only sharpen words, keep the layout.
  if (/\bBeat 1\b/.test(prompt)) return sharpen(prompt.trim())
  const clean = sharpen(prompt.replace(/\s+/g, ' ').trim())
  if (!clean) return prompt

  const parts = sentences(clean).map((s) => endWithPeriod(capitalise(s)))
  const d = lengthSeconds(options.length)
  const t1 = Math.max(1, Math.round(d * 0.2 * 2) / 2)
  const t2 = Math.max(t1 + 1, Math.round(d * 0.8 * 2) / 2)

  let open: string
  let middle: string
  let close: string
  if (parts.length >= 3) {
    open = parts[0]
    middle = parts.slice(1, -1).join(' ')
    close = parts[parts.length - 1]
  } else if (parts.length === 2) {
    open = 'Open on a clean frame and establish the subject.'
    middle = parts[0]
    close = parts[1]
  } else {
    open = 'Open on a clean frame and establish the subject.'
    middle = parts[0] ?? endWithPeriod(capitalise(clean))
    close = 'Resolve with a slow push-in and hold the final frame for a beat.'
  }

  const beats = [
    `Beat 1 (0–${seconds(t1)}s): ${open}`,
    `Beat 2 (${seconds(t1)}–${seconds(t2)}s): ${middle}`,
    `Beat 3 (${seconds(t2)}–${seconds(d)}s): ${close}`,
  ]
  const extras = [STYLE_MOTION[options.style], ENGINE_VOCAB[library]]

  // Add as much as fits, beats first.
  let out = beats.join('\n')
  for (const extra of extras) {
    const next = `${out}\n${extra}`
    if (charCount(next) <= PROMPT_MAX - 300) out = next
  }
  return charCount(out) <= PROMPT_MAX ? out : clean
}
