// The voice transcript (plan 9.2): the anchor for captions now and the AI
// editor later. Stored on the Video; word edits change `text` only.
export interface TranscriptWord {
  text: string
  start: number
  end: number
  confidence: number
}

export interface Transcript {
  version: 1
  source: { assetId: string; model: string }
  language: string
  words: TranscriptWord[]
  edited: boolean
}

/**
 * A transcript from timed text cues (SRT import, v1 caption clips): each
 * cue's words are spread evenly across it. Marked edited, since the times are
 * not the speech model's.
 */
export function transcriptFromCues(
  cues: { start: number; end: number; text: string }[],
  source: { assetId: string; model: string },
): Transcript {
  const words: TranscriptWord[] = []
  for (const cue of cues) {
    const parts = cue.text.split(/\s+/).filter(Boolean)
    const span = Math.max(0.01, cue.end - cue.start) / Math.max(1, parts.length)
    parts.forEach((text, i) =>
      words.push({ text, start: cue.start + i * span, end: cue.start + (i + 1) * span, confidence: 1 }),
    )
  }
  return { version: 1, source, language: 'en', words, edited: true }
}

/** The caption line on screen at time t: up to `maxWords` words of the chunk holding t. */
export function captionAt(
  transcript: Transcript | null | undefined,
  t: number,
  maxWords: number,
): { text: string; activeIndex: number } | null {
  if (!transcript?.words.length) return null
  const words = transcript.words
  // The last word that has started by t.
  let at = -1
  for (let j = 0; j < words.length && words[j].start <= t; j++) at = j
  if (at < 0) return null
  const speaking = t < words[at].end
  const next = words[at + 1]
  // In a short pause between words of the same chunk the line stays up.
  const pause =
    !speaking &&
    next !== undefined &&
    next.start - words[at].end < 0.6 &&
    Math.floor((at + 1) / maxWords) === Math.floor(at / maxWords)
  if (!speaking && !pause) return null
  const i = speaking ? at : -1
  const chunkStart = Math.floor(at / maxWords) * maxWords
  const chunk = words.slice(chunkStart, chunkStart + maxWords)
  return { text: chunk.map((w) => w.text).join(' '), activeIndex: i >= 0 ? at - chunkStart : -1 }
}

/** Timed cues (one per chunk) for SRT export and the captions list. */
export function cuesFromTranscript(
  transcript: Transcript | null | undefined,
  maxWords: number,
): { start: number; end: number; text: string }[] {
  if (!transcript) return []
  const out: { start: number; end: number; text: string }[] = []
  for (let i = 0; i < transcript.words.length; i += maxWords) {
    const chunk = transcript.words.slice(i, i + maxWords)
    out.push({
      start: chunk[0].start,
      end: chunk[chunk.length - 1].end,
      text: chunk.map((w) => w.text).join(' '),
    })
  }
  return out
}
