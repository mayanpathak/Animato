// TypeScript twin of the timeline-math functions in crates/animato-wasm.
// Used only if the WASM module fails to load. Decode, compositing (other than
// the Canvas2D compositor), audio mixing and encoding have no fallback here.
import type { CoreFunctions } from './engine'

function srtTime(t: string): number | null {
  const m = /^(\d+):(\d+):(\d+(?:[.,]\d+)?)$/.exec(t.trim())
  if (!m) return null
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3].replace(',', '.'))
}
function fmtSrt(t: number): string {
  const ms = Math.round(Math.max(0, t) * 1000)
  const p = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${p(Math.floor(ms / 3_600_000))}:${p(Math.floor(ms / 60_000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`
}

export const fallback: CoreFunctions = {
  engine_version: () => 'animato-ts-fallback',
  seconds_to_timecode(seconds, fps) {
    const f = Number.isFinite(fps) && fps >= 1 ? Math.round(fps) : 30
    const total = Math.round(Math.max(0, seconds) * f)
    const s = Math.floor(total / f)
    const p = (n: number) => String(n).padStart(2, '0')
    return `${p(Math.floor(s / 3600))}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}:${p(total % f)}`
  },
  timecode_to_seconds(tc, fps) {
    const f = Number.isFinite(fps) && fps >= 1 ? Math.round(fps) : 30
    const parts = tc.trim().split(':').map(Number)
    if (parts.some((p) => !Number.isInteger(p) || p < 0)) return NaN
    const [h, m, s, fr] = parts.length === 4 ? parts : parts.length === 3 ? [0, ...parts] : [NaN, 0, 0, 0]
    if (Number.isNaN(h) || m >= 60 || s >= 60 || fr >= f) return NaN
    return h * 3600 + m * 60 + s + fr / f
  },
  snap(time, targets, threshold) {
    let best = time
    let dist = threshold
    for (const t of targets) {
      const d = Math.abs(t - time)
      if (d <= dist) {
        best = t
        dist = d
      }
    }
    return best
  },
  parse_srt(text) {
    const cues: { start: number; end: number; text: string }[] = []
    for (const block of text.replace(/\r\n?/g, '\n').split('\n\n')) {
      const lines = block.split('\n').filter((l) => l.trim() !== '')
      const ti = lines.findIndex((l) => l.includes('-->'))
      if (ti < 0) continue
      const [a, b = ''] = lines[ti].split('-->')
      const start = srtTime(a)
      const end = srtTime(b.trim().split(/\s+/)[0] ?? '')
      if (start === null || end === null || end <= start) continue
      cues.push({ start, end, text: lines.slice(ti + 1).join('\n') })
    }
    cues.sort((x, y) => x.start - y.start)
    return JSON.stringify(cues)
  },
  to_srt(json) {
    const cues = (JSON.parse(json) as { start: number; end: number; text: string }[]).sort(
      (a, b) => a.start - b.start,
    )
    return cues
      .map((c, i) => `${i + 1}\n${fmtSrt(c.start)} --> ${fmtSrt(c.end)}\n${c.text.trim()}\n\n`)
      .join('')
  },
  captions_from_words(json) {
    const words = JSON.parse(json) as { text: string; startMs: number; endMs: number }[]
    const cues: { start: number; end: number; text: string }[] = []
    let cur: typeof words = []
    const flush = () => {
      if (cur.length)
        cues.push({
          start: cur[0].startMs / 1000,
          end: cur[cur.length - 1].endMs / 1000,
          text: cur.map((w) => w.text.trim()).join(' '),
        })
      cur = []
    }
    words.forEach((w, i) => {
      if (!w.text.trim()) return
      cur.push(w)
      const next = words[i + 1]
      if (/[.?!]$/.test(w.text.trim()) || !next || next.startMs - w.endMs >= 700 || cur.length >= 40) flush()
    })
    flush()
    return JSON.stringify(cues)
  },
  waveform_peaks(pcm, buckets) {
    const n = Math.max(1, buckets)
    const out = new Float32Array(n)
    if (!pcm.length) return out
    const per = pcm.length / n
    for (let b = 0; b < n; b++) {
      const from = Math.floor(b * per)
      const to = Math.min(pcm.length, Math.max(from + 1, Math.floor((b + 1) * per)))
      let m = 0
      for (let i = from; i < to; i++) m = Math.max(m, Math.abs(pcm[i]))
      out[b] = Math.min(1, m)
    }
    return out
  },
}
