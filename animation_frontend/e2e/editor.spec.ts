import { ALL_FORMATS, BufferSource, Input } from 'mediabunny'
import { readFileSync } from 'node:fs'
import { createProject, expect, login, test } from './fixtures'
import type { Page } from '@playwright/test'

test.describe.configure({ timeout: 240_000 })

const ZOOM = 80 // default px per second

async function clipsOn(page: Page, kind: string) {
  return page.locator(`[data-testid=track-${kind}] [data-testid=clip]`)
}

async function timelineEnd(page: Page): Promise<number> {
  return page
    .locator('[data-testid=clip]')
    .evaluateAll((els) =>
      Math.max(
        0,
        ...els.map(
          (e) => Number((e as HTMLElement).dataset.start) + Number((e as HTMLElement).dataset.duration),
        ),
      ),
    )
}

async function setPlayhead(page: Page, seconds: number) {
  const ruler = page.getByTestId('timeline-ruler')
  await ruler.click({ position: { x: seconds * ZOOM + 1, y: 10 } })
}

/** Probes an exported file with mediabunny (in Node): container, tracks, duration. */
async function probe(path: string) {
  const input = new Input({ source: new BufferSource(readFileSync(path)), formats: ALL_FORMATS })
  const video = await input.getPrimaryVideoTrack()
  const audio = await input.getPrimaryAudioTrack()
  return {
    mime: await input.getMimeType(),
    duration: await input.computeDuration(),
    width: video?.displayWidth ?? 0,
    height: video?.displayHeight ?? 0,
    videoCodec: video?.codec ?? null,
    audioCodec: audio?.codec ?? null,
  }
}

test('real media: import, edit, undo/redo, export and verify the file', async ({ page }, testInfo) => {
  await login(page)
  const id = await createProject(page, 'Editor e2e')
  // Canvas2D compositor keeps this long test fast under SwiftShader; the WebGPU test below covers the GPU path.
  await page.goto(`/app/projects/${id}/edit?compositor=canvas2d`)
  await expect(page.getByTestId('perf-badge')).toHaveAttribute('data-compositor', /Canvas2D/)

  await page
    .getByTestId('media-import-input')
    .setInputFiles(['e2e/fixtures/clip.webm', 'e2e/fixtures/tone.wav'])
  await expect(await clipsOn(page, 'video')).toHaveCount(1, { timeout: 60_000 })
  await expect(await clipsOn(page, 'audio')).toHaveCount(1, { timeout: 60_000 })
  // Real frames and a real waveform.
  await expect(page.locator('[data-testid=clip-thumbnails] img').first()).toBeVisible()
  expect(await page.locator('[data-testid=clip-thumbnails] img').first().getAttribute('src')).toMatch(
    /^data:image\/jpeg/,
  )
  await expect(page.locator('[data-testid=track-audio] [data-testid=clip-waveform] path')).toHaveAttribute(
    'd',
    /M\d/,
  )

  const video = await clipsOn(page, 'video')

  // Split the video clip at 2 s.
  await setPlayhead(page, 2)
  await video.first().click()
  await page.keyboard.press('s')
  await expect(video).toHaveCount(2)

  // Undo / redo the split.
  await page.getByTestId('undo').click()
  await expect(video).toHaveCount(1)
  await page.getByTestId('redo').click()
  await expect(video).toHaveCount(2)

  // Ripple delete the first part: the rest moves to 0.
  await video.first().click()
  await page.keyboard.press('Shift+Delete')
  await expect(video).toHaveCount(1)
  await expect(video.first()).toHaveAttribute('data-start', '0.000')
  expect(Number(await video.first().getAttribute('data-duration'))).toBeCloseTo(3, 1)

  // Trim the end by 0.5 s with the handle.
  const handle = video.first().getByTestId('clip-trim-end')
  const box = (await handle.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 - 0.5 * ZOOM, box.y + box.height / 2, { steps: 6 })
  await page.mouse.up()
  await expect(video.first()).toHaveAttribute('data-duration', /^2\.(4|5)\d*/)

  // Double speed halves its length.
  await video.first().click()
  await page.getByTestId('speed-2').click()
  const after = Number(await video.first().getAttribute('data-duration'))
  expect(after).toBeGreaterThan(1.15)
  expect(after).toBeLessThan(1.3)

  // Remove the tone so the timeline length is set by video + text.
  await (await clipsOn(page, 'audio')).first().click()
  await page.keyboard.press('Delete')
  await expect(await clipsOn(page, 'audio')).toHaveCount(0)

  // Text overlay at 0 s, shortened to 2 s.
  await setPlayhead(page, 0)
  await page.getByRole('tab', { name: 'Text' }).click()
  await page.getByTestId('add-text-title').click()
  await expect(await clipsOn(page, 'text')).toHaveCount(1)
  await page.getByTestId('text-content').fill('Edited in the browser')
  const text = (await clipsOn(page, 'text')).first()
  const tBox = (await text.getByTestId('clip-trim-end').boundingBox())!
  await page.mouse.move(tBox.x + tBox.width / 2, tBox.y + tBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(tBox.x + tBox.width / 2 - 1 * ZOOM, tBox.y + tBox.height / 2, { steps: 6 })
  await page.mouse.up()

  const expected = await timelineEnd(page)
  expect(expected).toBeGreaterThan(1.8)
  expect(expected).toBeLessThan(2.2)

  // Export locally and verify the downloaded file.
  await page.getByTestId('open-export').click()
  await page.getByRole('tab', { name: '720p' }).click()
  await page.getByRole('tab', { name: 'WebM' }).click()
  const downloadPromise = page.waitForEvent('download', { timeout: 180_000 })
  await page.getByTestId('export-start').click()
  await expect(page.getByTestId('export-progress').or(page.getByTestId('export-done'))).toBeVisible()
  const download = await downloadPromise
  await expect(page.getByTestId('export-done')).toBeVisible()
  const file = testInfo.outputPath(download.suggestedFilename())
  await download.saveAs(file)
  expect(readFileSync(file).byteLength).toBeGreaterThan(10_000)
  const info = await probe(file)
  expect(info.mime).toContain('webm')
  expect(info.width).toBe(1280)
  expect(info.height).toBe(720)
  expect(info.videoCodec).toBe('vp9')
  expect(Math.abs(info.duration - expected)).toBeLessThan(0.2)

  const calls = await page.evaluate(() => window.__animatoEngineCalls ?? {})
  expect(calls['demux']).toBeGreaterThan(0)
  expect(calls['decode:video-frame']).toBeGreaterThan(0)
  expect(calls['composite']).toBeGreaterThan(0)
  expect(calls['encode']).toBeGreaterThan(0)
  expect(calls['timeline:split']).toBeGreaterThan(0)
  expect(calls['timeline:ripple-delete']).toBeGreaterThan(0)
  expect(calls['timeline:trim']).toBeGreaterThan(0)
})

test('MP4 import goes through the Rust demuxer and the WebGPU compositor previews and exports it', async ({
  page,
}, testInfo) => {
  await login(page)
  const id = await createProject(page, 'GPU e2e')
  await page.goto(`/app/projects/${id}/edit`)
  await page.getByTestId('media-import-input').setInputFiles('e2e/fixtures/clip.mp4')
  const video = await clipsOn(page, 'video')
  await expect(video).toHaveCount(1, { timeout: 60_000 })
  await expect(page.getByTestId('perf-badge')).toHaveAttribute('data-compositor', /Rust\/WASM · WebGPU/)

  // Keep the GPU export short: 4× speed → 1.25 s.
  await video.first().click()
  await page.getByTestId('speed-4').click()
  await page.getByTestId('open-export').click()
  await page.getByRole('tab', { name: '720p' }).click()
  await page.getByRole('tab', { name: 'MP4' }).click()
  const downloadPromise = page.waitForEvent('download', { timeout: 200_000 })
  await page.getByTestId('export-start').click()
  const download = await downloadPromise
  const file = testInfo.outputPath(download.suggestedFilename())
  await download.saveAs(file)
  const info = await probe(file)
  expect(info.mime).toContain('mp4')
  expect(Math.abs(info.duration - 1.25)).toBeLessThan(0.2)

  const calls = await page.evaluate(() => window.__animatoEngineCalls ?? {})
  const backends = await page.evaluate(() => window.__animatoEngineBackends ?? {})
  expect(calls['demux:offcut-mp4']).toBeGreaterThan(0)
  expect(calls['composite:webgpu']).toBeGreaterThan(0)
  expect(backends['composite']).toContain('WebGPU')
})
