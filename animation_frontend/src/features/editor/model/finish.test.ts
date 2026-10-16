import { describe, expect, it } from 'vitest'
import type { MediaAsset, Project } from '@/lib/local/models'
import type { CoreEngine } from '@/wasm/engine'
import { useEditor } from '../store'
import { mediaClipFor } from './ops'
import { setFormat, setLook, startFinish } from './finish'
import {
  captionsItem,
  defaultCaptions,
  emptyTimelineV2,
  MAIN_VIDEO,
  outputDuration,
  type TimelineV2,
} from './timelineV2'

const asset = { id: 'a1', kind: 'video', name: 'r.mp4', duration: 8, width: 854, height: 480 } as MediaAsset

function rendered(): TimelineV2 {
  const tl = emptyTimelineV2('16:9')
  tl.clips = [mediaClipFor(tl, asset, 0, MAIN_VIDEO, 'c1')]
  tl.extraGraphics = [defaultCaptions()]
  return tl
}

describe('Finish', () => {
  it('starts with the derived title, the watermark, the format and the look’s captions', () => {
    const tl = startFinish(rendered(), { title: 'Fourier Epicycles', watermark: true, format: '9:16' })
    expect([tl.width, tl.height]).toEqual([1080, 1920])
    expect(tl.finish).toMatchObject({
      look: 'clean',
      watermark: true,
      title: { text: 'Fourier Epicycles', enabled: true },
    })
    expect(captionsItem(tl)).toMatchObject({ highlight: 'word', stroke: { width: 6 } })
    // Started once: a second call changes nothing.
    expect(startFinish(tl, { title: 'Other', watermark: false })).toBe(tl)
  })

  it('a look sets its caption style; Bold captions are upper case, three words', () => {
    const tl = setLook(startFinish(rendered(), { title: 'T', watermark: true }), 'bold')
    expect(tl.finish?.captions.style).toBe('bold')
    expect(captionsItem(tl)).toMatchObject({ case: 'upper', maxWords: 3 })
  })

  it('the end card adds its seconds after the content', () => {
    const tl = startFinish(rendered(), { title: 'T', watermark: true })
    expect(outputDuration(tl)).toBe(8)
    expect(
      outputDuration({ ...tl, finish: { ...tl.finish!, endCard: { ...tl.finish!.endCard, enabled: true } } }),
    ).toBe(10)
    expect(outputDuration(emptyTimelineV2())).toBe(0)
  })

  it('switching format three times and undoing three times restores the original exactly (6.6)', () => {
    const start = startFinish(rendered(), { title: 'T', watermark: true, format: '16:9' })
    const s = useEditor.getState()
    s.load({ id: 'v' } as Project, start, [asset], {} as CoreEngine)
    s.setFormat('9:16')
    s.setFormat('1:1')
    s.setFormat('9:16')
    expect(useEditor.getState().timeline).toEqual(
      setFormat(start, '9:16', { assets: new Map([[asset.id, asset]]) }),
    )
    s.undo()
    s.undo()
    s.undo()
    expect(useEditor.getState().timeline).toEqual(start)
  })
})
