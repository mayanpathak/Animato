// Plan 15.5 / 8.7: without WebGPU the editor composites with Canvas2D on its
// own. A browser started without the WebGPU flags, so the render worker gets
// no adapter (an init script cannot reach the worker).
import { existsSync } from 'node:fs'
import { createProject, expect, login, test } from './fixtures'

const SANDBOX_CHROMIUM = '/opt/pw-browsers/chromium'
const executablePath =
  process.env.PW_CHROMIUM_PATH || (existsSync(SANDBOX_CHROMIUM) ? SANDBOX_CHROMIUM : undefined)

test.use({ launchOptions: { executablePath, args: ['--disable-features=WebGPU', '--disable-gpu'] } })

test('no WebGPU: the editor falls back to Canvas2D by itself', async ({ page }) => {
  await login(page)
  const id = await createProject(page, 'Degrade e2e')
  await page.goto(`/app/v/${id}?mode=timeline`)
  await page.getByTestId('media-import-input').setInputFiles('e2e/fixtures/clip.webm')
  await expect(page.locator('[data-testid=clip]')).toHaveCount(1, { timeout: 60_000 })
  await expect(page.getByTestId('perf-badge')).toContainText('Canvas2D', { timeout: 30_000 })
})
