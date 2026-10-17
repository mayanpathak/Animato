// Edit plan compiler (plan 13.4): EditPlanV0 → editor commands, pure. Labels
// resolve to the video's assets, anchors resolve with the transcript, times
// clamp to the media; anything it cannot do becomes a warning, never a crash.
// The store runs the commands as one step, "AI edit: <summary>", so one Undo
// reverts the whole plan. It never deletes assets, only clips.
import type { MediaAsset, VideoAsset } from '@/lib/local/models'
import type { Command } from '../model/commands'
import {
  BROLL_VIDEO,
  clipId as newClipId,
  graphicId as newGraphicId,
  MAIN_AUDIO,
  MAIN_VIDEO,
  timelineDurationV2,
  toSeconds,
  type AudioFx,
  type TimelineV2,
  type TitleItem,
  type Transform,
} from '../model/timelineV2'
import type { Transcript } from '../model/transcript'
import type { Anchor, EditPlanV0 } from './schema'

export interface PlanVideo {
  timeline: TimelineV2
  transcript: Transcript | null
  /** The video's assets with roles and labels (plan 13.2). */
  assets: readonly VideoAsset[]
  media: Map<string, MediaAsset>
}

export interface CompiledPlan {
  label: string
  commands: Command[]
  warnings: string[]
}

/** Ids for new clips and graphics; injectable so fixtures are deterministic. */
export interface IdSource {
  clip(): string
  graphic(): string
}

const RANDOM_IDS: IdSource = { clip: newClipId, graphic: newGraphicId }
const FADE = 0.3
const OVERLAY: Transform = { x: 0.76, y: 0.26, scale: 0.4, rotation: 0, opacity: 1 }

const round = (s: number) => Math.round(s * 1000) / 1000

export function compileEditPlan(
  plan: EditPlanV0,
  video: PlanVideo,
  ids: IdSource = RANDOM_IDS,
): CompiledPlan {
  const { timeline: tl, transcript } = video
  const commands: Command[] = []
  const warnings: string[] = []
  const words = transcript?.words ?? []

  const byLabel = (label: string) => {
    const ref = video.assets.find((r) => r.label.toLowerCase() === label.trim().toLowerCase())
    if (!ref) {
      const known = video.assets.map((r) => r.label).join(', ') || 'none'
      warnings.push(`No asset is called "${label}" (this video has: ${known}).`)
      return null
    }
    const media = video.media.get(ref.assetId)
    if (!media) {
      warnings.push(`"${label}" is not in this browser, so it was left out.`)
      return null
    }
    return { ref, media }
  }

  /** An anchor in source seconds (the timeline as it was), or null with a warning. */
  const resolve = (a: Anchor, what: string): number | null => {
    if ('t' in a) return a.t
    const w = words[a.word]
    if (!w) {
      warnings.push(`${what}: word ${a.word} does not exist (the transcript has ${words.length} words).`)
      return null
    }
    return a.edge === 'start' ? w.start : w.end
  }

  const mainClips = tl.clips.filter((c) => c.trackId === MAIN_VIDEO).sort((a, b) => a.startTime - b.startTime)
  const main = mainClips[0]
  const mainMedia = main ? video.media.get(main.assetId) : undefined
  // The picture's end: music beds longer than the video do not stretch it.
  const videoTracks = new Set(tl.tracks.filter((t) => t.type === 'video').map((t) => t.id))
  const pictureEnd = Math.max(
    0,
    ...tl.clips.filter((c) => videoTracks.has(c.trackId)).map((c) => toSeconds(tl, c.startTime + c.duration)),
  )
  let contentEnd = pictureEnd || timelineDurationV2(tl)

  // ---------------------------------------------------------------- keep
  // Source time → output time after the cuts. Identity when nothing is cut.
  let toOutput = (t: number): number | null => Math.min(Math.max(0, t), contentEnd)
  if (plan.keep?.length) {
    if (!main || !mainMedia) warnings.push('There is no main clip to cut, so "keep" was ignored.')
    else {
      const offset = toSeconds(tl, main.startTime) - toSeconds(tl, main.inPoint)
      const ranges: { from: number; to: number; at: number }[] = []
      let cursor = toSeconds(tl, main.startTime)
      for (const [i, k] of plan.keep.entries()) {
        const from = resolve(k.from, `Keep ${i + 1}`)
        const to = resolve(k.to, `Keep ${i + 1}`)
        if (from === null || to === null) continue
        // Timeline time → source time of the main media, clamped to it.
        const a = Math.max(0, Math.min(mainMedia.duration, from - offset))
        const b = Math.max(0, Math.min(mainMedia.duration, to - offset))
        if (b - a < 0.05) {
          warnings.push(
            `Keep ${i + 1} is empty after clamping to the clip (${round(a)}–${round(b)} s), skipped.`,
          )
          continue
        }
        if (a !== from - offset || b !== to - offset)
          warnings.push(`Keep ${i + 1} was clamped to the clip: ${round(a)}–${round(b)} s.`)
        ranges.push({ from: a + offset, to: b + offset, at: cursor })
        cursor += b - a
      }
      if (ranges.length) {
        for (const c of mainClips) commands.push({ type: 'clip.remove', id: c.id })
        for (const r of ranges)
          commands.push({
            type: 'clip.add',
            id: ids.clip(),
            assetId: main.assetId,
            trackId: MAIN_VIDEO,
            start: round(r.at),
            inPoint: round(r.from - offset),
            duration: round(r.to - r.from),
          })
        contentEnd = cursor
        toOutput = (t) => {
          const r = ranges.find((x) => t >= x.from - 1e-6 && t <= x.to + 1e-6)
          return r ? round(r.at + (t - r.from)) : null
        }
      }
    }
  }

  // ---------------------------------------------------------------- inserts
  for (const [i, ins] of (plan.inserts ?? []).entries()) {
    const found = byLabel(ins.asset)
    if (!found) continue
    if (found.media.kind === 'audio') {
      warnings.push(`Insert ${i + 1}: "${ins.asset}" is audio; inserts are pictures.`)
      continue
    }
    const at = resolve(ins.at, `Insert ${i + 1}`)
    if (at === null) continue
    const start = toOutput(at)
    if (start === null) {
      warnings.push(`Insert ${i + 1} falls in a part that was cut, skipped.`)
      continue
    }
    const length = found.media.kind === 'image' ? Infinity : found.media.duration
    const inPoint = Math.min(ins.inPoint ?? 0, Math.max(0, length - 0.05))
    let duration = Math.min(ins.duration, length - inPoint, Math.max(0, contentEnd - start))
    if (duration < 0.05) {
      warnings.push(`Insert ${i + 1} starts at the end of the video, skipped.`)
      continue
    }
    duration = round(duration)
    if (duration < ins.duration) warnings.push(`Insert ${i + 1} was shortened to ${duration} s to fit.`)
    const id = ids.clip()
    commands.push({
      type: 'clip.add',
      id,
      assetId: found.ref.assetId,
      trackId: BROLL_VIDEO,
      start,
      inPoint: round(inPoint),
      duration,
    })
    const fade = ins.transition === 'fade' ? Math.round(Math.min(FADE, duration / 2) * tl.fps) : 0
    if (ins.transition === 'zoom')
      warnings.push(`Insert ${i + 1}: the zoom transition is not available yet; it cuts.`)
    commands.push({
      type: 'clip.update',
      id,
      patch: {
        volume: 0,
        fadeIn: fade,
        fadeOut: fade,
        transform: ins.mode === 'overlay' ? OVERLAY : (main?.transform ?? OVERLAY),
      },
    })
  }

  // ---------------------------------------------------------------- music
  if (plan.music !== undefined) {
    const existing = tl.clips.filter((c) => c.trackId === MAIN_AUDIO)
    if (plan.music === null) for (const c of existing) commands.push({ type: 'clip.remove', id: c.id })
    else {
      const found = byLabel(plan.music.asset)
      if (found && found.media.kind !== 'audio')
        warnings.push(`"${plan.music.asset}" has no audio of its own to use as music.`)
      else if (found) {
        for (const c of existing) commands.push({ type: 'clip.remove', id: c.id })
        const id = ids.clip()
        commands.push({
          type: 'clip.add',
          id,
          assetId: found.ref.assetId,
          trackId: MAIN_AUDIO,
          start: 0,
          duration: round(Math.min(found.media.duration, Math.max(contentEnd, 0.05))),
        })
        const audio: AudioFx = {
          normalizeGain: 1,
          gate: false,
          eq: { low: 0, mid: 0, high: 0 },
          duck: plan.music.duck,
        }
        commands.push({ type: 'clip.update', id, patch: { volume: plan.music.volume, audio } })
      }
    }
  }

  // ---------------------------------------------------------------- finish
  // Title and caption switches first, then format, look and caption style,
  // which only touch their own fields.
  let finish = tl.finish
  if (plan.title !== undefined) {
    const t = plan.title
    if (t === null) {
      if (finish) finish = { ...finish, title: { ...finish.title, enabled: false } }
    } else if (t.end - t.start < 0.1) warnings.push('The title has no duration, skipped.')
    else if (finish && t.start === 0)
      finish = {
        ...finish,
        title: { ...finish.title, enabled: true, text: t.text, duration: round(t.end - t.start) },
      }
    else {
      const item: TitleItem = {
        kind: 'title',
        id: ids.graphic(),
        start: t.start,
        end: t.end,
        text: t.text,
        font: 'Inter',
        size: 110,
        weight: 700,
        color: '#ffffff',
        x: 0.5,
        y: 0.42,
        align: 'Center',
        background: null,
        enter: 'rise',
        layer: 'over',
      }
      commands.push({ type: 'graphic.add', item })
    }
  }
  if (plan.captions !== undefined && finish)
    finish = { ...finish, captions: { ...finish.captions, enabled: plan.captions !== null } }
  if (finish && finish !== tl.finish) commands.push({ type: 'finish.set', finish })

  if (plan.format) commands.push({ type: 'finish.format', aspect: plan.format })
  if (plan.look) {
    if (tl.finish) commands.push({ type: 'finish.look', look: plan.look })
    else warnings.push('Looks apply in Finish; this video has not been opened there yet.')
  }
  if (plan.captions !== undefined) {
    if (!tl.finish) warnings.push('Caption styles apply in Finish; this video has not been opened there yet.')
    else if (plan.captions) commands.push({ type: 'finish.captionStyle', style: plan.captions.style })
  }

  if (plan.emphasis?.length) warnings.push('Word emphasis is not available yet; it was left out.')
  if (!commands.length && !warnings.length) warnings.push('The plan changes nothing.')
  return { label: `AI edit: ${plan.summary}`, commands, warnings }
}
