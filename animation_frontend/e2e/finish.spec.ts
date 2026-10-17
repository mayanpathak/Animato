// Plan 6.6 acceptance: from Ready, choosing 9:16 and pressing Export gives a
// 1080×1920 MP4 with the title, the brand logo and the watermark drawn by
// Vello, downloaded, with defaults only. Also: three format switches undo
// back to the original, and the take strip and looks respond.
import { readFileSync } from 'node:fs'
import { ALL_FORMATS, BufferSource, Input } from 'mediabunny'
import { createJob, expect, login, test } from './fixtures'
import type { Page } from '@playwright/test'

test.describe.configure({ timeout: 900_000 })

async function brightAt(page: Page, fx: number, fy: number, fw: number, fh: number): Promise<number> {
  return page.evaluate(
    ([fx, fy, fw, fh]) => {
      const c = document.querySelector('[data-testid=preview] canvas') as HTMLCanvasElement
      const off = document.createElement('canvas')
      off.width = c.width
      off.height = c.height
      const ctx = off.getContext('2d') as CanvasRenderingContext2D
      ctx.drawImage(c, 0, 0)
      const x = Math.round(fx * c.width)
      const y = Math.round(fy * c.height)
      const { data } = ctx.getImageData(x, y, Math.round(fw * c.width), Math.round(fh * c.height))
      let n = 0
      for (let i = 0; i < data.length; i += 4)
        if (data[i] > 215 && data[i + 1] > 215 && data[i + 2] > 215) n++
      return n
    },
    [fx, fy, fw, fh] as const,
  )
}

test('Ready → 9:16 → Export: a 1080×1920 MP4 with title, logo and watermark (6.6) @slow', async ({
  page,
}, testInfo) => {
  await login(page)
  // A brand kit with a logo: Finish picks it up by default.
  await page.goto('/app/brand')
  await page.getByTestId('brand-new').first().click()
  await page.getByLabel('Upload logo').setInputFiles('e2e/fixtures/image.png')
  await expect(page.getByLabel('Replace logo')).toBeAttached({ timeout: 15_000 })
  // The kit saves after a short pause; wait until it holds the logo.
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            new Promise<boolean>((res) => {
              const o = indexedDB.open('animato-brand')
              o.onsuccess = () => {
                const r = o.result.transaction('records').objectStore('records').getAll()
                r.onsuccess = () =>
                  res((r.result as { logoDataUrl: string | null }[]).some((k) => Boolean(k.logoDataUrl)))
              }
              o.onerror = () => res(false)
            }),
        ),
      { timeout: 15_000 },
    )
    .toBe(true)

  await createJob(page, 'Explain how gradient descent finds the minimum of a curve')
  await expect(page.getByTestId('editor')).toHaveAttribute('data-mode', 'finish', { timeout: 60_000 })
  await expect(page.getByTestId('perf-badge')).toHaveAttribute('data-compositor', /WebGPU \+ Vello/)

  await page.getByRole('tab', { name: '9:16' }).click()
  // Finish opens past the title's entrance (1.2 s), on a frame that shows the look.
  await expect(page.getByTestId('timecode')).toHaveText('00:00:01:06')
  // The hook title is in the top band above the video, the watermark in the bottom-right corner.
  await expect.poll(() => brightAt(page, 0.08, 0.13, 0.84, 0.2), { timeout: 30_000 }).toBeGreaterThan(200)
  await expect.poll(() => brightAt(page, 0.55, 0.72, 0.35, 0.06), { timeout: 30_000 }).toBeGreaterThan(20)
  await page.getByTestId('preview').screenshot({ path: 'screenshots/finish-9x16-preview.png' })

  await page.getByTestId('open-export').click()
  await expect(page.getByTestId('preset-9x16')).toHaveAttribute('aria-checked', 'true')
  const download = page.waitForEvent('download', { timeout: 780_000 })
  await page.getByTestId('export-start').click()
  const file = await download
  expect(file.suggestedFilename()).toBe('gradient-descent-finds-9x16.mp4')
  const path = testInfo.outputPath(file.suggestedFilename())
  await file.saveAs(path)
  const input = new Input({ source: new BufferSource(readFileSync(path)), formats: ALL_FORMATS })
  const video = await input.getPrimaryVideoTrack()
  expect(await input.getMimeType()).toContain('mp4')
  expect([video?.displayWidth, video?.displayHeight]).toEqual([1080, 1920])
  await expect(page.getByTestId('export-done')).toBeVisible()

  const backends = await page.evaluate(() => window.__animatoEngineBackends ?? {})
  expect(backends['composite']).toContain('WebGPU + Vello')
  const calls = await page.evaluate(() => window.__animatoEngineCalls ?? {})
  expect(calls['graphics:scene-build']).toBeGreaterThan(0)
})

test('format switches undo exactly; looks and title edits preview', async ({ page }) => {
  await login(page)
  await createJob(page, 'Visualize Fourier epicycles drawing a heart')
  await expect(page.getByTestId('editor')).toHaveAttribute('data-mode', 'finish', { timeout: 60_000 })
  const format = page.getByRole('tablist', { name: 'Format' })
  const before = (await format.getByRole('tab', { selected: true }).textContent()) ?? ''
  // Three changes, each to a different format than the one before.
  const steps = before === '9:16' ? ['1:1', '16:9', '1:1'] : ['9:16', '1:1', '9:16']
  for (const f of steps) await format.getByRole('tab', { name: f }).click()
  await expect(format.getByRole('tab', { selected: true })).toHaveText(steps[2])
  for (let i = 0; i < 3; i++) await page.getByTestId('undo').click()
  await expect(format.getByRole('tab', { selected: true })).toHaveText(before)

  await page.getByTestId('look-bold').click()
  await expect(page.getByTestId('look-bold')).toHaveAttribute('aria-checked', 'true')
  await page.getByTestId('finish-title').fill('Hearts from circles')
  await expect(page.getByTestId('finish-title')).toHaveValue('Hearts from circles')
  await page.getByTestId('undo').click()
  await expect(page.getByTestId('look-bold')).toHaveAttribute('aria-checked', 'true')
  await expect(page.locator('[data-testid^=look-thumb-]')).toHaveCount(4)
})
