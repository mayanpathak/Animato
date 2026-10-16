// TypeScript twin of the timeline-math functions in crates/animato-wasm.
// Used only if the WASM module fails to load. Decode, compositing (other than
// the Canvas2D compositor), audio mixing and encoding have no fallback here.
import type { CoreFunctions } from './engine'

const MIN_CLIP = 0.1
const r6 = (v: number) => Math.round(v * 1e6) / 1e6

type Json = Record<string, unknown>
interface TimelineJson {
  tracks: { clips: Json[] }[]
}

function locate(tl: TimelineJson, id: string): [number, number] | null {
  for (let t = 0; t < tl.tracks.length; t++) {
    const c = tl.tracks[t].clips.findIndex((x) => x.id === id)
    if (c >= 0) return [t, c]
  }
  return null
}
const num = (o: Json, k: string, d: number) => (typeof o[k] === 'number' ? (o[k] as number) : d)

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
  split_clip(timeline, id, at, newId) {
    const tl = JSON.parse(timeline) as TimelineJson
    const loc = locate(tl, id)
    if (!loc) return timeline
    const clips = tl.tracks[loc[0]].clips
    const clip = clips[loc[1]]
    const start = num(clip, 'start', 0)
    const duration = num(clip, 'duration', 0)
    const speed = Math.max(0.01, num(clip, 'speed', 1))
    if (at <= start + MIN_CLIP || at >= start + duration - MIN_CLIP) return JSON.stringify(tl)
    const left = at - start
    clips.splice(loc[1], 1, { ...clip, duration: r6(left), fadeOut: 0 }, {
      ...clip,
      id: newId,
      start: r6(at),
      duration: r6(duration - left),
      offset: r6(num(clip, 'offset', 0) + left * speed),
      fadeIn: 0,
    })
    return JSON.stringify(tl)
  },
  trim_clip(timeline, id, edge, to) {
    const tl = JSON.parse(timeline) as TimelineJson
    const loc = locate(tl, id)
    if (!loc) return timeline
    const clip = tl.tracks[loc[0]].clips[loc[1]]
    const start = num(clip, 'start', 0)
    const end = start + num(clip, 'duration', 0)
    const offset = num(clip, 'offset', 0)
    const speed = Math.max(0.01, num(clip, 'speed', 1))
    if (edge === 'start') {
      const ns = Math.min(Math.max(to, Math.max(0, start - offset / speed)), end - MIN_CLIP)
      Object.assign(clip, { start: r6(ns), duration: r6(end - ns), offset: r6(offset + (ns - start) * speed) })
    } else {
      clip.duration = r6(Math.max(to, start + MIN_CLIP) - start)
    }
    return JSON.stringify(tl)
  },
  ripple_delete(timeline, id) {
    const tl = JSON.parse(timeline) as TimelineJson
    const loc = locate(tl, id)
    if (!loc) return timeline
    const clips = tl.tracks[loc[0]].clips
    const [removed] = clips.splice(loc[1], 1)
    const rs = num(removed, 'start', 0)
    const gap = num(removed, 'duration', 0)
    for (const c of clips) if (num(c, 'start', 0) >= rs) c.start = r6(Math.max(0, num(c, 'start', 0) - gap))
    return JSON.stringify(tl)
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
    const cues = (JSON.parse(json) as { start: number; end: number; text: string }[]).sort((a, b) => a.start - b.start)
    return cues.map((c, i) => `${i + 1}\n${fmtSrt(c.start)} --> ${fmtSrt(c.end)}\n${c.text.trim()}\n\n`).join('')
  },
  captions_from_words(json) {
    const words = JSON.parse(json) as { text: string; startMs: number; endMs: number }[]
    const cues: { start: number; end: number; text: string }[] = []
    let cur: typeof words = []
    const flush = () => {
      if (cur.length) cues.push({ start: cur[0].startMs / 1000, end: cur[cur.length - 1].endMs / 1000, text: cur.map((w) => w.text.trim()).join(' ') })
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
  keyframe_value(json, time) {
    const keys = (JSON.parse(json) as { time: number; value: number; ease?: string }[]).sort((a, b) => a.time - b.time)
    if (!keys.length) return 0
    if (time <= keys[0].time) return keys[0].value
    const last = keys[keys.length - 1]
    if (time >= last.time) return last.value
    const i = keys.findIndex((k, j) => k.time <= time && keys[j + 1].time > time)
    const a = keys[i]
    const b = keys[i + 1]
    let t = (time - a.time) / (b.time - a.time)
    if (a.ease === 'step') return a.value
    if (a.ease === 'easeIn') t = t * t * t
    else if (a.ease === 'easeOut') t = 1 - (1 - t) ** 3
    else if (a.ease === 'easeInOut') t = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
    return a.value + (b.value - a.value) * t
  },
}
