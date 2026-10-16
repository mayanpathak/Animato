// Starter prompts for Prompt Studio. Each one is a plain prompt plus the
// options it was written for; picking a template only prefills the composer.
// The preview videos are real renders shipped in public/media/renders.

export interface Template {
  id: string
  title: string
  category: string
  description: string
  prompt: string
  library: 'manim' | 'remotion'
  aspect: '16:9' | '9:16' | '1:1'
  duration: number
  style: string
  video: string
}

const R = '/media/renders'

export const TEMPLATES: Template[] = [
  {
    id: 'mandelbrot-zoom',
    title: 'Mandelbrot deep zoom',
    category: 'Math',
    description: 'A slow dive into seahorse valley, coloured by escape time.',
    prompt:
      'Zoom smoothly into the Mandelbrot set along seahorse valley. Colour each point by escape time with a violet-to-cyan palette, show the current zoom factor in the corner, and end on a spiral that fills the frame.',
    library: 'manim',
    aspect: '16:9',
    duration: 20,
    style: 'Cinematic',
    video: `${R}/manim-mandelbrot.webm`,
  },
  {
    id: 'cellular-automaton',
    title: 'Rule 30, row by row',
    category: 'Algorithms',
    description: 'An elementary cellular automaton grows from a single cell.',
    prompt:
      'Explain Rule 30: show the 8-case rule table first, then grow the automaton from one black cell, one row at a time, speeding up after the first 12 rows. Finish by highlighting the chaotic centre column.',
    library: 'manim',
    aspect: '16:9',
    duration: 25,
    style: 'Technical',
    video: `${R}/manim-automaton.webm`,
  },
  {
    id: 'pythagoras-proof',
    title: 'Pythagoras by rearrangement',
    category: 'Math',
    description: 'Four triangles slide around a square to prove a² + b² = c².',
    prompt:
      'Prove the Pythagorean theorem by rearrangement: draw a right triangle with sides a, b, c, copy it four times inside a square of side a + b, then slide the triangles to reveal the areas a² + b² and c². Label every length and finish on the equation.',
    library: 'manim',
    aspect: '16:9',
    duration: 30,
    style: 'Minimal',
    video: `${R}/manim-automaton.webm`,
  },
  {
    id: 'sorting-race',
    title: 'Bubble sort vs. merge sort',
    category: 'Algorithms',
    description: 'Two sorting algorithms race on the same shuffled bars.',
    prompt:
      'Race bubble sort against merge sort on the same 24 shuffled bars, side by side. Highlight compared bars in cyan and swapped bars in magenta, keep a live comparison counter under each, and freeze on the winner.',
    library: 'manim',
    aspect: '16:9',
    duration: 30,
    style: 'Technical',
    video: `${R}/manim-mandelbrot.webm`,
  },
  {
    id: 'launch-teaser',
    title: 'Product launch teaser',
    category: 'Marketing',
    description: 'Bold kinetic type over a drifting gradient, made for Reels.',
    prompt:
      'A vertical launch teaser: a drifting violet-to-cyan gradient background, three short lines of kinetic typography ("Describe it." "Watch it move." "Edit it."), each line punching in on the beat, ending on a logo lockup with "Out now".',
    library: 'remotion',
    aspect: '9:16',
    duration: 15,
    style: 'Playful',
    video: `${R}/remotion-gradient.webm`,
  },
  {
    id: 'game-of-life',
    title: 'Game of Life title card',
    category: 'Social',
    description: "Conway's Life evolves behind a clean, centred title.",
    prompt:
      'A square title card: Conway\'s Game of Life running behind a centred headline "Simple rules, endless patterns". Cells glow softly when born and fade when they die, and a glider crosses the frame at the end.',
    library: 'remotion',
    aspect: '1:1',
    duration: 12,
    style: 'Minimal',
    video: `${R}/remotion-life.webm`,
  },
  {
    id: 'stat-reveal',
    title: 'Quarterly stat reveal',
    category: 'Marketing',
    description: 'Big numbers count up with crisp editorial typography.',
    prompt:
      'An editorial stat reveal: three numbers count up one after another ("4.2M renders", "38 countries", "12s median render") with thin rules between them, generous whitespace, and a closing line "Thank you for building with us".',
    library: 'remotion',
    aspect: '16:9',
    duration: 18,
    style: 'Editorial',
    video: `${R}/remotion-gradient.webm`,
  },
  {
    id: 'changelog-story',
    title: 'Changelog story',
    category: 'Social',
    description: 'Three feature cards slide in for a vertical update post.',
    prompt:
      'A vertical changelog story: a header "What\'s new this week", then three feature cards that slide up one at a time, each with an icon, a five-word title and a one-line description, ending on a call to action "Try it today".',
    library: 'remotion',
    aspect: '9:16',
    duration: 20,
    style: 'Cinematic',
    video: `${R}/remotion-life.webm`,
  },
  {
    id: 'how-https-works',
    title: 'How HTTPS works',
    category: 'Explainers',
    description: 'A TLS handshake told with two characters and a padlock.',
    prompt:
      'Explain the TLS handshake in plain language: a browser and a server as two rounded characters, the certificate as a stamped card, key exchange as two colours mixing into a shared secret, and a padlock that snaps shut when the encrypted channel opens. Label each step in one short line.',
    library: 'manim',
    aspect: '16:9',
    duration: 45,
    style: 'Friendly',
    video: `${R}/manim-automaton.webm`,
  },
  {
    id: 'compound-interest',
    title: 'Compound interest, visualised',
    category: 'Data',
    description: 'Two savings curves pull apart over 30 years.',
    prompt:
      'Plot two savings curves over 30 years: 500 a month at 2% and at 7%. Draw the axes first, then trace both curves together, shade the gap between them in violet, and call out the final balances with a counter that ticks up at the end.',
    library: 'manim',
    aspect: '16:9',
    duration: 25,
    style: 'Editorial',
    video: `${R}/manim-mandelbrot.webm`,
  },
  {
    id: 'bar-chart-race',
    title: 'Bar chart race',
    category: 'Data',
    description: 'Ranked bars overtake each other year by year.',
    prompt:
      'A bar chart race of the five most-used programming languages from 2015 to 2025. Bars re-sort smoothly as values change, the year counts up in large type in the corner, and each bar carries its label and value at the tip.',
    library: 'remotion',
    aspect: '16:9',
    duration: 20,
    style: 'Technical',
    video: `${R}/remotion-gradient.webm`,
  },
  {
    id: 'feature-spotlight',
    title: 'Feature spotlight',
    category: 'Product',
    description: 'A UI card zooms in on one feature with callouts.',
    prompt:
      'A product feature spotlight: a clean app window floats in, the camera pushes in on one panel, three numbered callouts draw on with thin leader lines, and the frame settles on the headline "Edit your video like a doc".',
    library: 'remotion',
    aspect: '16:9',
    duration: 15,
    style: 'Minimal',
    video: `${R}/remotion-life.webm`,
  },
  {
    id: 'photosynthesis',
    title: 'Photosynthesis in 30 seconds',
    category: 'Education',
    description: 'Light, water and CO₂ become sugar inside a leaf cell.',
    prompt:
      'Teach photosynthesis for a middle-school class: zoom into a leaf, then a chloroplast. Show sunlight, water and CO₂ flowing in as labelled particles, glucose and oxygen flowing out, and end on the balanced equation written step by step.',
    library: 'manim',
    aspect: '9:16',
    duration: 30,
    style: 'Friendly',
    video: `${R}/manim-automaton.webm`,
  },
]
