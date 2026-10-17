// Marketing copy for the landing and pricing pages. Every line must be true in
// the build that ships (plan 15.6): no testimonials, logos, user counts,
// ratings, "4K" or ETA claims, and nothing a user cannot do today.
import { EARLY_ACCESS } from '@/lib/entitlements'
import { STARTERS } from '@/features/create/starters'

/** Appendix A: the hero placeholder cycles through these real example prompts. */
export const HERO_PROMPTS = [
  'Show why the derivative of sin(x) is cos(x)',
  'Binary search on 16 boxes, find 42',
  'Kinetic quote: Make it simple, but significant',
  'Our revenue grew 38% this quarter, animated bar chart',
]

/** The four starter chips under the hero box (plan 6.1). */
export const HERO_CHIPS = ['fourier', 'binary-search', 'kinetic-quote', 'stat-reveal']
  .map((id) => STARTERS.find((s) => s.id === id))
  .filter((s) => s !== undefined)

/**
 * Real Animato renders for the marketing page. Empty until the owner renders
 * the starters on the real stack and commits the files to public/media/site/:
 * the bundled public/media/renders clips are ffmpeg test patterns and must not
 * be presented as Animato output. Each section shows an illustration of the
 * product UI instead while a slot is empty.
 */
export const SITE_MEDIA: { explainer?: string; motion?: string; hero?: string } = {}

export interface Faq {
  q: string
  a: string
  pricing?: boolean
}

const L = EARLY_ACCESS.renderLimits

export const FAQS: Faq[] = [
  {
    q: 'What can Animato make?',
    a: 'Short animations from a description: explainers with exact diagrams and maths (built with Manim), and motion graphics such as titles, stats and kinetic type (built with Remotion). Renders run on Animato’s servers.',
  },
  {
    q: 'Which formats can I export?',
    a: 'Renders are landscape. In your browser you can export them as 1080p video for YouTube (16:9), Shorts, Reels and TikTok (9:16) or a square post (1:1).',
  },
  {
    q: 'Is my voice uploaded?',
    a: 'No. Voiceovers are recorded and stored in your browser, and captions are made on your device by a speech model that runs locally. Only your prompts and account details go to Animato’s server.',
  },
  {
    q: 'Where are my videos stored?',
    a: 'In this browser’s private storage. They do not sync to other devices yet, and clearing site data removes them. Settings shows how much space they use.',
  },
  {
    q: 'How many renders can I start?',
    a: `During early access, up to ${L.perHour} renders an hour and ${L.perDay} a day per account. Editing and exporting in the browser do not count.`,
    pricing: true,
  },
  {
    q: 'Is there a paid plan?',
    a: 'Billing is not live yet. Everyone is on Free during early access. The Creator plan at $20 a month will raise render limits; its limits will be announced at launch.',
    pricing: true,
  },
]

export interface Plan {
  id: 'free' | 'creator'
  name: string
  price: string
  cadence: string
  status: 'Available now' | 'Coming soon'
  points: string[]
  cta: string
}

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    cadence: '',
    status: 'Available now',
    points: [
      `Up to ${L.perHour} renders an hour, ${L.perDay} a day during early access`,
      'Explainer and motion engines',
      'Edit, caption and export in your browser',
      '1080p export in 16:9, 9:16 and 1:1',
    ],
    cta: 'Start free',
  },
  {
    id: 'creator',
    name: 'Creator',
    price: '$20',
    cadence: 'per month',
    status: 'Coming soon',
    points: ['More renders (limits announced at launch)', 'Everything in Free'],
    cta: 'Start free, upgrade at launch',
  },
]

export const PRICING_NOTE = 'Billing is not live yet. Everyone is on Free during early access.'
