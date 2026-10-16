// Copy and content for the marketing pages. Every capability listed here
// exists in the product; keep it that way when editing.
import {
  Activity,
  Captions,
  Clapperboard,
  Command,
  Download,
  LayoutTemplate,
  Lock,
  Mic,
  Palette,
  Scissors,
  Sigma,
  type LucideIcon,
} from 'lucide-react'

export type Engine = 'Manim' | 'Remotion'

export interface Feature {
  icon: LucideIcon
  title: string
  body: string
}

export const FEATURES: Feature[] = [
  {
    icon: Sigma,
    title: 'Natural language → Manim',
    body: 'Math, science and algorithm explainers with precise, programmatic motion, from one sentence.',
  },
  {
    icon: Clapperboard,
    title: 'Natural language → Remotion',
    body: 'Product videos, motion graphics, data viz and social clips, rendered from a plain-English brief.',
  },
  {
    icon: Activity,
    title: 'Live job tracking',
    body: 'Watch every render move from queued to planning, rendering, encoding and ready, with an ETA.',
  },
  {
    icon: Scissors,
    title: 'In-browser video editor',
    body: 'Multi-track timeline, trim, split, ripple delete, 0.25–4× speed, fades, crop, color, animated text, undo/redo.',
  },
  {
    icon: Mic,
    title: 'In-browser voice tools',
    body: 'Record voiceover in sync with playback, then normalize, gate, EQ and auto-duck music under your voice.',
  },
  {
    icon: Captions,
    title: 'On-device captions',
    body: 'Whisper runs locally after a one-time model download. Import and export SRT whenever you like.',
  },
  {
    icon: Lock,
    title: 'Local-first private projects',
    body: 'Projects live in your browser with IndexedDB and OPFS. Your media is never uploaded to edit.',
  },
  {
    icon: Palette,
    title: 'Brand kit',
    body: 'Your palette, fonts and logo on every text layer and caption, and optionally appended to prompts.',
  },
  {
    icon: LayoutTemplate,
    title: 'Templates',
    body: 'Start from prompt and style presets that already look right, then make them yours.',
  },
  {
    icon: Download,
    title: 'Local export to MP4/WebM',
    body: 'WebCodecs encode at 720p, 1080p or 4K where supported, in 16:9, 9:16 or 1:1, with burned-in captions.',
  },
  {
    icon: Command,
    title: 'Command palette',
    body: 'Press ⌘K to start a new animation, open a project or jump to any job without touching the mouse.',
  },
]

export const HERO_PROMPTS = [
  'Explain the Fourier transform by drawing a square wave from rotating circles',
  'A 15-second product teaser for a budgeting app, bold type, violet gradient',
  'Visualize Dijkstra’s algorithm finding the shortest path across a city grid',
  'Animated bar chart race of renewable energy share by country, 2000 to 2024',
  'Show why the derivative of sin(x) is cos(x) using the unit circle',
]

export interface Render {
  id: string
  src: string
  engine: Engine
  title: string
  prompt: string
}

export const RENDERS: Render[] = [
  {
    id: 'manim-mandelbrot',
    src: '/media/renders/manim-mandelbrot.webm',
    engine: 'Manim',
    title: 'Mandelbrot zoom',
    prompt: 'Zoom into the Mandelbrot set with vivid escape-time coloring and a caption.',
  },
  {
    id: 'remotion-gradient',
    src: '/media/renders/remotion-gradient.webm',
    engine: 'Remotion',
    title: 'Product update title',
    prompt:
      'Title card “Ship faster with Animato”, subtitle “Q3 product update”, on a drifting violet gradient.',
  },
  {
    id: 'manim-automaton',
    src: '/media/renders/manim-automaton.webm',
    engine: 'Manim',
    title: 'Rule 30',
    prompt: 'Grow the Rule 30 cellular automaton one row at a time, captioned as it builds.',
  },
  {
    id: 'remotion-life',
    src: '/media/renders/remotion-life.webm',
    engine: 'Remotion',
    title: 'Game of Life',
    prompt: 'Conway’s Game of Life in cyan on black under the headline “Growth, visualised”.',
  },
]

export type UseCaseId = 'educators' | 'marketers' | 'founders' | 'developers' | 'agencies'

export interface UseCase {
  id: UseCaseId
  label: string
  headline: string
  body: string
  points: string[]
  prompt: string
  engine: Engine
  engineWhy: string
}

export const USE_CASES: UseCase[] = [
  {
    id: 'educators',
    label: 'Educators',
    headline: 'The diagram you sketch on the board, finally in motion.',
    body: 'Turn a lesson objective into a precise animated explainer, then narrate it yourself and caption it on your own machine before class.',
    points: [
      'Exact math typesetting and geometry',
      'Record narration in sync with playback',
      'Offline captions for accessibility',
    ],
    prompt: 'Show the Pythagorean theorem by rearranging four right triangles inside a square',
    engine: 'Manim',
    engineWhy: 'Manim is built for equations, graphs and geometry that must be exactly right.',
  },
  {
    id: 'marketers',
    label: 'Marketers',
    headline: 'Launch-day motion without the launch-week backlog.',
    body: 'Brief a product teaser in a sentence, apply your brand kit, and cut 16:9, 9:16 and 1:1 versions from one project.',
    points: [
      'Brand palette, fonts and logo applied',
      'Presets for YouTube, Shorts/Reels and LinkedIn',
      'Burned-in captions for silent autoplay',
    ],
    prompt:
      'A 12-second feature teaser: “Invoices in one click”, bold type on our brand gradient, logo end card',
    engine: 'Remotion',
    engineWhy: 'Remotion excels at typography, product shots and polished motion graphics.',
  },
  {
    id: 'founders',
    label: 'Founders',
    headline: 'A demo-day video before the deck is even final.',
    body: 'Explain what you are building with a crisp animated walkthrough, record the voiceover in the browser and export it locally.',
    points: [
      'Generate, then trim and re-time in seconds',
      'Auto-ducks music under your voice',
      'Export MP4 or WebM in your browser',
    ],
    prompt: 'Animate how our API turns messy receipts into clean ledger entries, three steps, minimal style',
    engine: 'Remotion',
    engineWhy: 'Remotion handles UI-style scenes, data flows and branded explainers.',
  },
  {
    id: 'developers',
    label: 'Developers',
    headline: 'Explain the algorithm, not the slide software.',
    body: 'Visualize data structures and algorithms step by step for docs, talks and posts, then annotate them with animated text.',
    points: [
      'Step-by-step algorithm visuals',
      'Text overlays with animation presets',
      'Keyboard shortcuts and a ⌘K palette',
    ],
    prompt: 'Visualize quicksort partitioning an array of 12 bars, highlight the pivot at each step',
    engine: 'Manim',
    engineWhy: 'Manim gives you exact, programmatic control of every step.',
  },
  {
    id: 'agencies',
    label: 'Agencies',
    headline: 'Ship more client cuts with the same team.',
    body: 'Start from templates, swap brand kits per client, and finish every edit locally so client footage never leaves the machine.',
    points: ['Templates for repeatable formats', 'A brand kit per look', 'Footage stays on your device'],
    prompt: 'Data-viz social clip: quarterly revenue up 38%, animated line chart, 9:16, client palette',
    engine: 'Remotion',
    engineWhy: 'Remotion renders data viz and social formats with pixel-tight layouts.',
  },
]

export interface Testimonial {
  quote: string
  name: string
  role: string
  company: string
}

export const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      'I described eigenvectors in two sentences and got an animation I would have spent a weekend building by hand. I narrated it in the editor the same afternoon.',
    name: 'Priya Raman',
    role: 'Lecturer, Linear Algebra',
    company: 'Halcyon Institute',
  },
  {
    quote:
      'Our launch clips used to wait on a motion designer. Now the first cut exists before standup, and the designer spends their time on the polish.',
    name: 'Marcus Oyelaran',
    role: 'Head of Growth',
    company: 'Paperplane',
  },
  {
    quote:
      'Legal asked where client footage goes during editing. “Nowhere, it stays on the laptop” was the shortest security review we have ever had.',
    name: 'Elena Duarte',
    role: 'Managing Director',
    company: 'Vantage Creative',
  },
  {
    quote:
      'Scrubbing a timeline in a browser tab should not feel this fast. Splits and trims are instant, even on my old laptop.',
    name: 'Jonas Becker',
    role: 'Developer Advocate',
    company: 'Orbital',
  },
  {
    quote:
      'Offline captions changed our workflow. We caption every explainer now, because it costs nothing and nothing leaves the building.',
    name: 'Aiko Tanaka',
    role: 'Learning Design Lead',
    company: 'Lumen Labs',
  },
  {
    quote:
      'The Studio queue is the difference. Weekly series, four aspect ratios each, and renders come back while we are still writing the next brief.',
    name: 'Daniel Whitfield',
    role: 'Creative Producer',
    company: 'Northwind',
  },
]

export interface Faq {
  q: string
  a: string
  pricing?: boolean
}

export const FAQS: Faq[] = [
  {
    q: 'Is my footage uploaded?',
    a: 'No. Animato renders your prompt on our servers, and the finished video is downloaded into your browser. From there, every edit, voiceover, caption and export happens on your device. Projects are stored locally with IndexedDB and OPFS, and your media is never uploaded to edit.',
    pricing: true,
  },
  {
    q: 'Which browsers are supported?',
    a: 'Any modern browser with WebCodecs. Chromium-based browsers (Chrome, Edge, Arc, Brave) get the WebGPU compositor; others use the Canvas2D compositor. VP9 and AV1 export work everywhere WebCodecs exists; H.264 (MP4) export depends on the encoders your browser ships.',
    pricing: true,
  },
  {
    q: 'What does Manim vs Remotion mean?',
    a: 'They are the two rendering engines behind Animato. Manim is ideal for math, science and algorithm explainers where precision matters. Remotion is ideal for product videos, motion graphics, data viz and social clips. Describe what you want and pick the engine that fits.',
  },
  {
    q: 'How do captions work offline?',
    a: 'Animato runs Whisper speech recognition locally in your browser. The model downloads once and is cached, after which captions are generated on your device without sending audio anywhere. You can edit them, style them with your brand kit, burn them in, or import and export SRT.',
  },
  {
    q: 'What counts as a render?',
    a: 'One render is one prompt turned into a finished video by Manim or Remotion. Editing, recording voiceover, captioning and exporting happen in your browser and never count against your renders.',
    pricing: true,
  },
  {
    q: 'Can I switch between monthly and annual billing?',
    a: 'Yes. Annual billing gives you two months free compared with paying monthly. You can move between plans as your output changes.',
    pricing: true,
  },
]

export interface Tier {
  id: 'starter' | 'pro' | 'studio' | 'enterprise'
  name: string
  blurb: string
  /** Monthly price in USD; null means custom pricing. */
  monthly: number | null
  cta: string
  href: string
  features: string[]
  highlight?: boolean
}

export const TIERS: Tier[] = [
  {
    id: 'starter',
    name: 'Starter',
    blurb: 'For trying ideas and learning the editor.',
    monthly: 0,
    cta: 'Start creating free',
    href: '/signup',
    features: [
      '10 renders per month',
      'Manim and Remotion engines',
      'Full in-browser editor and voice tools',
      'On-device captions',
      '720p export',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    blurb: 'For creators publishing every week.',
    monthly: 49,
    cta: 'Start Pro',
    href: '/signup?plan=pro',
    features: [
      '150 renders per month',
      'Everything in Starter',
      'Brand kit',
      '1080p export',
      'Email support',
    ],
  },
  {
    id: 'studio',
    name: 'Studio',
    blurb: 'For teams shipping video weekly.',
    monthly: 2000,
    cta: 'Start Studio',
    href: '/signup?plan=studio',
    highlight: true,
    features: [
      '2,500 renders per month',
      'Priority render queue',
      '4K export where your browser supports it',
      'Up to 10 seats',
      'Dedicated support, same business day',
      'Guided onboarding for your team',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    blurb: 'For organizations with volume and procurement needs.',
    monthly: null,
    cta: 'Talk to us',
    href: 'mailto:sales@animato.app?subject=Animato%20Enterprise',
    features: [
      'Custom render volume',
      'Custom seat count',
      'Invoicing and security review',
      'Named support contact',
    ],
  },
]

/** Annual billing: pay for 10 months, get 12. */
export function annualMonthly(monthly: number): number {
  return Math.round((monthly * 10) / 12)
}

export interface ComparisonRow {
  label: string
  values: [string | boolean, string | boolean, string | boolean, string | boolean]
}

export const COMPARISON: { group: string; rows: ComparisonRow[] }[] = [
  {
    group: 'Generation',
    rows: [
      { label: 'Renders per month', values: ['10', '150', '2,500', 'Custom'] },
      { label: 'Natural language → Manim', values: [true, true, true, true] },
      { label: 'Natural language → Remotion', values: [true, true, true, true] },
      { label: 'Live job tracking with ETA', values: [true, true, true, true] },
      { label: 'Render queue', values: ['Standard', 'Standard', 'Priority', 'Priority'] },
      { label: 'Templates', values: [true, true, true, true] },
    ],
  },
  {
    group: 'Editing, in your browser',
    rows: [
      { label: 'Multi-track video editor', values: [true, true, true, true] },
      { label: 'Voiceover, normalization, gate, EQ, ducking', values: [true, true, true, true] },
      { label: 'On-device captions and SRT', values: [true, true, true, true] },
      { label: 'Local-first private projects', values: [true, true, true, true] },
      { label: 'Brand kit', values: [false, true, true, true] },
      { label: 'Command palette (⌘K)', values: [true, true, true, true] },
    ],
  },
  {
    group: 'Export',
    rows: [
      { label: 'Maximum resolution', values: ['720p', '1080p', '4K*', '4K*'] },
      { label: 'MP4 / WebM, encoded locally', values: [true, true, true, true] },
      { label: '16:9, 9:16 and 1:1 presets', values: [true, true, true, true] },
      { label: 'Burned-in captions', values: [true, true, true, true] },
    ],
  },
  {
    group: 'Plan terms',
    rows: [
      { label: 'Seats', values: ['1', '1', 'Up to 10', 'Custom'] },
      { label: 'Support', values: ['Docs', 'Email', 'Dedicated', 'Named contact'] },
      { label: 'Team onboarding', values: [false, false, true, true] },
      { label: 'Invoicing and security review', values: [false, false, false, true] },
    ],
  },
]
