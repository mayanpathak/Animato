// Plan 6.8 acceptance: an uploaded font appears in the graphics preview and
// in an export; a logo appears on the end card. WOFF files are refused.
import { createJob, expect, login, test } from './fixtures'
import type { Page } from '@playwright/test'

test.describe.configure({ timeout: 600_000 })

/** Distinct colours on a preview canvas: more than a flat fill means something was drawn. */
async function painted(page: Page, label: RegExp): Promise<number> {
  return page.getByRole('img', { name: label }).evaluate((c: HTMLCanvasElement) => {
    const ctx = c.getContext('2d') as CanvasRenderingContext2D
    const { data } = ctx.getImageData(0, 0, c.width, c.height)
    const seen = new Set<number>()
    for (let i = 0; i < data.length; i += 4 * 97) seen.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2])
    return seen.size
  })
}

test('an uploaded font and the logo reach the preview and the export (6.8) @slow', async ({
  page,
}, testInfo) => {
  await login(page)
  await page.goto('/app/brand')
  await page.getByTestId('brand-new').click()
  // WOFF is a web format: refused with the reason.
  await page.getByTestId('brand-font-upload').setInputFiles({
    name: 'web.woff2',
    mimeType: 'font/woff2',
    buffer: Buffer.from('wOF2fake-font-bytes'),
  })
  await expect(page.getByText(/WOFF and WOFF2 are web formats/)).toBeVisible()

  await page.getByTestId('brand-font-upload').setInputFiles('e2e/fixtures/DejaVuSansMono.ttf')
  await expect(page.locator('#brand-heading-font')).toHaveValue('DejaVu Sans Mono')
  await page.getByLabel('Upload logo').setInputFiles('e2e/fixtures/image.png')
  await expect.poll(() => painted(page, /Title card in/), { timeout: 30_000 }).toBeGreaterThan(20)
  await expect.poll(() => painted(page, /End card in/), { timeout: 30_000 }).toBeGreaterThan(5)
  await page
    .getByTestId('brand-graphics-preview')
    .screenshot({ path: 'screenshots/brand-graphics-preview.png' })
  const pageCalls = await page.evaluate(() => window.__animatoEngineCalls ?? {})
  expect(pageCalls['graphics:font:DejaVu Sans Mono']).toBeGreaterThan(0)
  // The kit has saved its font and logo.
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
                  res(
                    (r.result as { logoDataUrl: string | null; fonts?: unknown[] }[]).some(
                      (k) => Boolean(k.logoDataUrl) && Boolean(k.fonts?.length),
                    ),
                  )
              }
            }),
        ),
      { timeout: 15_000 },
    )
    .toBe(true)

  // Finish with the Brand look and an end card, exported small.
  await createJob(page, 'Explain how a binary heap keeps its order')
  await expect(page.getByTestId('editor')).toHaveAttribute('data-mode', 'finish', { timeout: 60_000 })
  await page.getByRole('tab', { name: '16:9' }).click()
  await page.getByTestId('look-brand').click()
  await page.getByRole('switch', { name: 'Show end card' }).click()
  await page.getByTestId('open-export').click()
  await page.getByTestId('export-more').click()
  await page.getByRole('tab', { name: '720p' }).click()
  const download = page.waitForEvent('download', { timeout: 480_000 })
  await page.getByTestId('export-start').click()
  await (await download).saveAs(testInfo.outputPath('brand.mp4'))
  // The export worker registered the uploaded font for its frames.
  const calls = await page.evaluate(() => window.__animatoEngineCalls ?? {})
  expect(calls['graphics:font:DejaVu Sans Mono']).toBeGreaterThanOrEqual(3)
})
