// Dev smoke test for the editor UI against `vite` on :5173 (mocks on).
import { chromium } from '@playwright/test'

const S = '/tmp/claude-0/-home-user-Animato/3cfda4e1-fe8d-5e29-925e-dbd3e6478a97/scratchpad'
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: [
    '--enable-unsafe-webgpu',
    '--enable-features=Vulkan',
    '--use-angle=swiftshader',
    '--use-webgpu-adapter=swiftshader',
    '--disable-vulkan-surface',
    '--autoplay-policy=no-user-gesture-required',
  ],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true })
page.on(
  'console',
  (m) =>
    (m.type() === 'error' || m.type() === 'warning') &&
    console.log('[console]', m.type(), m.text().slice(0, 400)),
)
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
await page.goto('http://localhost:5173/login')
await page.waitForTimeout(2500)
await page.goto('http://localhost:5173/login')
await page.getByTestId('login-email').fill('demo@animato.dev')
await page.getByTestId('login-password').fill('animato-demo')
await page.getByTestId('login-submit').click()
await page.waitForURL('**/app**')
const id = await page.evaluate(async () => {
  const { createEmptyProject } = await import('/src/features/editor/projects.ts')
  const p = await createEmptyProject('demo@animato.dev', 'Smoke project', '16:9')
  return p.id
})
await page.goto(`http://localhost:5173/app/projects/${id}/edit?compositor=${process.argv[2] || 'webgpu'}`)
await page.getByTestId('editor').waitFor()
await page.getByTestId('media-import-input').setInputFiles('e2e/fixtures/clip.webm')
await page.getByTestId('clip').first().waitFor({ timeout: 30000 })
await page.waitForTimeout(1500)
console.log('badge', await page.getByTestId('perf-badge').getAttribute('data-compositor'))
console.log('thumbs', await page.locator('[data-testid=clip-thumbnails] img').count())
await page.screenshot({ path: `${S}/editor1.png` })
await page.getByTestId('timeline-ruler').click({ position: { x: 200, y: 10 } })
await page.getByTestId('split').click()
console.log('clips after split', await page.getByTestId('clip').count())
await page.getByTestId('undo').click()
console.log('after undo', await page.getByTestId('clip').count())
await page.getByTestId('redo').click()
console.log('after redo', await page.getByTestId('clip').count())
await page
  .getByTestId('add-text-title')
  .click()
  .catch(async () => {
    await page.getByRole('tab', { name: 'Text' }).click()
    await page.getByTestId('add-text-title').click()
  })
await page.waitForTimeout(800)
await page.screenshot({ path: `${S}/editor2.png` })
await page.getByTestId('open-export').click()
await page.getByRole('tab', { name: '720p' }).click()
await page.getByTestId('export-start').click()
const dl = await page.waitForEvent('download', { timeout: 120000 })
const path = `${S}/editor-export.${dl.suggestedFilename().split('.').pop()}`
await dl.saveAs(path)
console.log('download', dl.suggestedFilename(), path)
console.log('calls', JSON.stringify(await page.evaluate(() => window.__animatoEngineCalls)))
await page.screenshot({ path: `${S}/editor3.png` })
await browser.close()
