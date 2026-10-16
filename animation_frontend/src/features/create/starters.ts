// Starter prompts (plan 6.4: starters replace the Templates page). Each one is a
// prompt and the engine it was written for. `video` stays empty until a real
// Animato render of that prompt is committed to public/media/starters: the
// bundled clips in public/media/renders are ffmpeg test patterns, and showing
// them as Animato output would be an invented fact.
import type { Library } from '@/lib/api/types'

export interface Starter {
  id: string
  title: string
  prompt: string
  library: Library
  video?: string
}

export const STARTERS: Starter[] = [
  {
    id: 'fourier',
    title: 'Fourier epicycles',
    library: 'manim',
    prompt:
      'Draw a heart with Fourier epicycles: 40 rotating circles chained tip to tail, tracing the outline as the circles spin, then fade the circles and leave the path.',
  },
  {
    id: 'binary-search',
    title: 'Binary search',
    library: 'manim',
    prompt:
      'Explain binary search on a sorted row of 16 numbered boxes, highlighting the low, mid and high pointers at each step until the target 42 is found.',
  },
  {
    id: 'kinetic-quote',
    title: 'Kinetic quote',
    library: 'remotion',
    prompt:
      'Kinetic typography for the quote "Make it simple, but significant." Each word lands on its own beat with a soft blur-in.',
  },
  {
    id: 'stat-reveal',
    title: 'Stat reveal',
    library: 'remotion',
    prompt:
      'Our revenue grew 38% this quarter: an animated bar chart where the last bar rises past the others and the number counts up to 38%.',
  },
  {
    id: 'derivative',
    title: 'Derivative as slope',
    library: 'manim',
    prompt:
      'Plot y = sin(x) and slide a tangent line along the curve, showing its slope as a number, while the graph of the derivative draws itself underneath.',
  },
  {
    id: 'pythagoras',
    title: 'Pythagoras with squares',
    library: 'manim',
    prompt:
      'Prove the Pythagorean theorem visually: build squares on each side of a right triangle, then rearrange the two smaller squares to fill the largest one.',
  },
  {
    id: 'launch-teaser',
    title: 'Launch teaser',
    library: 'remotion',
    prompt:
      'A 10-second product teaser: the words "Ship faster" slide in, a progress bar fills, and the line "Available today" fades up at the end.',
  },
  {
    id: 'compound-interest',
    title: 'Compound interest',
    library: 'manim',
    prompt:
      'Show compound interest: $1,000 growing at 7% a year for 30 years, a curve that bends upward with the yearly balance labelled every 5 years.',
  },
]
