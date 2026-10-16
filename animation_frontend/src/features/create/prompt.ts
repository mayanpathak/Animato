// Prompt Studio logic that runs entirely in the browser. The server accepts
// only { prompt, library }, so every option is folded into the prompt text,
// and "Enhance" is a deterministic local rewrite, not a model call.
import type { Engine, Library, VisualStyle } from '@/lib/api/types'
import type { BrandKit } from '@/lib/local/models'
import { charCount, PROMPT_MAX } from '@/lib/validation'

export type { Engine }
export type AspectOption = '16:9' | '9:16' | '1:1'

export interface StudioOptions {
  aspect: AspectOption
  duration: number
  style: VisualStyle
  captions: boolean
}

export const ASPECT_LABEL: Record<AspectOption, string> = {
  '16:9': 'landscape',
  '9:16': 'vertical',
  '1:1': 'square',
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
  if (!kit || !kit.appendToPrompts) return ''
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

/** The exact text sent as `prompt` to POST /api/jobs. */
export function buildServerPrompt(
  prompt: string,
  options: StudioOptions,
  kit: BrandKit | null | undefined,
): string {
  const lines = [
    `Format: ${options.aspect} ${ASPECT_LABEL[options.aspect]}, about ${options.duration} seconds. Style: ${options.style}.`,
  ]
  const brand = brandSuffix(kit)
  if (brand) lines.push(brand)
  if (options.captions) lines.push('Include short on-screen captions that summarise each beat.')
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

const STYLE_MOTION: Record<VisualStyle, string> = {
  Minimal:
    'Keep motion restrained: one idea on screen at a time, generous negative space, soft ease-out fades.',
  Cinematic: 'Use a slow dolly-in camera, soft depth, gentle ease-in-out moves and a held final frame.',
  Playful: 'Use bouncy overshoot easing, quick staggered entrances and a little squash and stretch.',
  Technical: 'Use precise linear timing, a grid-aligned layout and monospaced labels.',
  Editorial: 'Use measured fades, strong typographic hierarchy, thin rules and calm pacing.',
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
export function enhancePrompt(prompt: string, library: Library, options: StudioOptions): string {
  // Already structured by a previous rewrite: only sharpen words, keep the layout.
  if (/\bBeat 1\b/.test(prompt)) return sharpen(prompt.trim())
  const clean = sharpen(prompt.replace(/\s+/g, ' ').trim())
  if (!clean) return prompt

  const parts = sentences(clean).map((s) => endWithPeriod(capitalise(s)))
  const d = options.duration
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

// ------------------------------------------------------------------ word diff

export type DiffOp = { type: 'same' | 'add' | 'del'; text: string }

const MAX_TOKENS = 1200

/** Word-level LCS diff. Whitespace is kept with the token before it. */
export function wordDiff(before: string, after: string): DiffOp[] {
  const a = before.match(/\S+\s*/g) ?? []
  const b = after.match(/\S+\s*/g) ?? []
  if (a.length > MAX_TOKENS || b.length > MAX_TOKENS) {
    return [
      { type: 'del', text: before },
      { type: 'add', text: after },
    ]
  }
  const key = (t: string) => t.trim()
  const n = a.length
  const m = b.length
  // lcs[i][j] = LCS length of a[i..] and b[j..]
  const lcs: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = key(a[i]) === key(b[j]) ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }
  const ops: DiffOp[] = []
  const push = (type: DiffOp['type'], text: string) => {
    const last = ops[ops.length - 1]
    if (last && last.type === type) last.text += text
    else ops.push({ type, text })
  }
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (key(a[i]) === key(b[j])) {
      push('same', b[j])
      i++
      j++
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      push('del', a[i++])
    } else {
      push('add', b[j++])
    }
  }
  while (i < n) push('del', a[i++])
  while (j < m) push('add', b[j++])
  return ops
}

// ------------------------------------------------------------------- examples

export const EXAMPLES: { label: string; prompt: string; engine: Library }[] = [
  {
    label: 'Fourier epicycles',
    engine: 'manim',
    prompt:
      'Draw a heart with Fourier epicycles: 40 rotating circles chained tip to tail, tracing the outline as the circles spin, then fade the circles and leave the glowing path.',
  },
  {
    label: 'Derivative as slope',
    engine: 'manim',
    prompt:
      'Plot y = sin(x) on axes and slide a tangent line along the curve, showing its slope as a number, while a second graph of the derivative draws itself underneath.',
  },
  {
    label: 'Binary search',
    engine: 'manim',
    prompt:
      'Explain binary search on a sorted row of 16 numbered boxes, highlighting the low, mid and high pointers at each step until the target 42 is found.',
  },
  {
    label: 'Kinetic quote',
    engine: 'remotion',
    prompt:
      'Kinetic typography for the quote "Make it simple, but significant." Each word lands on its own beat with a soft blur-in, over a slowly drifting gradient.',
  },
  {
    label: 'App launch promo',
    engine: 'remotion',
    prompt:
      'A vertical launch promo for a habit-tracking app: a phone mockup slides in, three feature callouts pop beside it, and it ends on the app icon with "Available today".',
  },
  {
    label: 'Podcast audiogram',
    engine: 'remotion',
    prompt:
      'A square podcast teaser: episode title in large type, an animated waveform bar along the bottom, guest name lower third, and a "Listen now" end card.',
  },
]
