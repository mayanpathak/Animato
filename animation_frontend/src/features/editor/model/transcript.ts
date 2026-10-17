// The voice transcript (plan 9.2): the anchor for captions now and the AI
// editor later. Stored on the Video; word edits change `text` only.
export interface TranscriptWord {
  text: string
  start: number
  end: number
  confidence: number
  /** A caption line ends after this word (SRT cue boundaries, plan 9.2). */
  breakAfter?: boolean
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
      words.push({
        text,
        start: cue.start + i * span,
        end: cue.start + (i + 1) * span,
        confidence: 1,
        breakAfter: i === parts.length - 1,
      }),
    )
  }
  return { version: 1, source, language: 'en', words, edited: true }
}

/**
 * Caption lines as [from, to) word ranges: at most `maxWords` words, and a
 * line always ends at a word marked `breakAfter`.
 */
export function chunkRanges(words: TranscriptWord[], maxWords: number): [number, number][] {
  const out: [number, number][] = []
  let from = 0
  for (let i = 0; i < words.length; i++) {
    if (i + 1 - from >= maxWords || words[i].breakAfter || i === words.length - 1) {
      out.push([from, i + 1])
      from = i + 1
    }
  }
  return out
}

/** Timed cues (one per chunk) for SRT export and the captions list. */
export function cuesFromTranscript(
  transcript: Transcript | null | undefined,
  maxWords: number,
): { start: number; end: number; text: string }[] {
  if (!transcript) return []
  return chunkRanges(transcript.words, maxWords).map(([a, b]) => {
    const chunk = transcript.words.slice(a, b)
    return {
      start: chunk[0].start,
      end: chunk[chunk.length - 1].end,
      text: chunk.map((w) => w.text).join(' '),
    }
  })
}

/**
 * Replaces the text of one chunk (as listed by cuesFromTranscript). With the
 * same number of words only `text` changes and times stay (plan 9.2); a
 * different count spreads the new words across the chunk's time span.
 */
export function editChunk(t: Transcript, chunk: number, maxWords: number, text: string): Transcript {
  const range = chunkRanges(t.words, maxWords)[chunk]
  if (!range) return t
  const [from, to] = range
  const old = t.words.slice(from, to)
  const breakAfter = old[old.length - 1].breakAfter
  const parts = text.split(/\s+/).filter(Boolean)
  let next: TranscriptWord[]
  if (!parts.length) return removeChunk(t, chunk, maxWords)
  if (parts.length === old.length) next = old.map((w, i) => ({ ...w, text: parts[i] }))
  else {
    const start = old[0].start
    const span = (old[old.length - 1].end - start) / Math.max(1, parts.length)
    next = parts.map((p, i) => ({
      text: p,
      start: start + i * span,
      end: start + (i + 1) * span,
      confidence: 1,
    }))
    // The line keeps its own boundary, so it doesn't merge with its neighbours.
    next[next.length - 1].breakAfter = true
  }
  if (breakAfter) next[next.length - 1] = { ...next[next.length - 1], breakAfter }
  return {
    ...t,
    edited: true,
    words: [...t.words.slice(0, from), ...next, ...t.words.slice(from + old.length)],
  }
}

export function removeChunk(t: Transcript, chunk: number, maxWords: number): Transcript {
  const range = chunkRanges(t.words, maxWords)[chunk]
  if (!range) return t
  return { ...t, edited: true, words: [...t.words.slice(0, range[0]), ...t.words.slice(range[1])] }
}
