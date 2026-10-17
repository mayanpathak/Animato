// Plan 8.10: the graphics layer in the browser. A title drawn by Vello on
// WebGPU (SwiftShader here) and by the Canvas2D fallback lands in the same
// place at the same size; the tolerance is 3% of the canvas for position
// and 15% for size, since the two rasterise text differently.
import { createProject, expect, login, test } from './fixtures'
import type { Page } from '@playwright/test'

test.describe.configure({ timeout: 180_000 })

interface Box {
  x: number
  y: number
  w: number
  h: number
  bright: number
  width: number
  height: number
}

/** The box around the near-white pixels of the preview canvas. */
async function brightBox(page: Page): Promise<Box> {
  return page.evaluate(() => {
    const c = document.querySelector('[data-testid=preview] canvas') as HTMLCanvasElement
    const off = document.createElement('canvas')
    off.width = c.width
    off.height = c.height
    const ctx = off.getContext('2d') as CanvasRenderingContext2D
    ctx.drawImage(c, 0, 0)
    const { data } = ctx.getImageData(0, 0, c.width, c.height)
    let [x0, y0, x1, y1, bright] = [Infinity, Infinity, -1, -1, 0]
    for (let y = 0; y < c.height; y++)
      for (let x = 0; x < c.width; x++) {
        const i = (y * c.width + x) * 4
        if (data[i] > 200 && data[i + 1] > 200 && data[i + 2] > 200) {
          bright++
          x0 = Math.min(x0, x)
          y0 = Math.min(y0, y)
          x1 = Math.max(x1, x)
          y1 = Math.max(y1, y)
        }
      }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, bright, width: c.width, height: c.height }
  })
}

async function titleFrame(page: Page, id: string, compositor: 'webgpu' | 'canvas2d', shot: string) {
  await page.goto(`/app/v/${id}?mode=timeline&compositor=${compositor}`)
  await expect(page.getByTestId('perf-badge')).toHaveAttribute(
    'data-compositor',
    compositor === 'webgpu' ? /WebGPU \+ Vello/ : /Canvas2D/,
  )
  await expect(page.locator('[data-testid=track-text] [data-testid=clip]')).toHaveCount(1)
  // Past the title's rise-in.
  await page.getByTestId('timeline-ruler').click({ position: { x: 1.5 * 80 + 1, y: 10 } })
  await expect.poll(async () => (await brightBox(page)).bright, { timeout: 30_000 }).toBeGreaterThan(500)
  await page.getByTestId('preview').screenshot({ path: `screenshots/${shot}.png` })
  return brightBox(page)
}

test('a title draws in the same place with Vello on WebGPU and with Canvas2D', async ({ page }) => {
  await login(page)
  const id = await createProject(page, 'Graphics e2e')
  await page.getByRole('tab', { name: 'Text' }).click()
  await page.getByTestId('add-text-title').click()
  await expect(page.locator('[data-testid=track-text] [data-testid=clip]')).toHaveCount(1)
  await expect(page.getByText('Saved locally')).toBeVisible({ timeout: 15_000 })

  const gpu = await titleFrame(page, id, 'webgpu', 'graphics-title-webgpu')
  const cpu = await titleFrame(page, id, 'canvas2d', 'graphics-title-canvas2d')
  expect(gpu.width).toBe(cpu.width)
  const W = gpu.width
  const centre = (b: Box) => [b.x + b.w / 2, b.y + b.h / 2]
  const [gx, gy] = centre(gpu)
  const [cx, cy] = centre(cpu)
  expect(Math.abs(gx - cx)).toBeLessThan(W * 0.03)
  expect(Math.abs(gy - cy)).toBeLessThan(W * 0.03)
  expect(Math.abs(gpu.w - cpu.w) / cpu.w).toBeLessThan(0.15)
  expect(Math.abs(gpu.h - cpu.h) / cpu.h).toBeLessThan(0.15)
  // Centred horizontally: the preset is a centred headline.
  expect(Math.abs(gx - W / 2)).toBeLessThan(W * 0.03)

  const calls = await page.evaluate(() => window.__animatoEngineCalls ?? {})
  expect(calls['graphics:scene-build']).toBeGreaterThan(0)
  expect(calls['graphics:frame-at']).toBeGreaterThan(0)
})
