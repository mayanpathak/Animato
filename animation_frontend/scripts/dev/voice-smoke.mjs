import { chromium } from '@playwright/test'
const browser = await chromium.launch({
  channel: 'chromium',
  args: [
    '--enable-unsafe-webgpu',
    '--use-angle=swiftshader',
    '--use-webgpu-adapter=swiftshader',
    '--autoplay-policy=no-user-gesture-required',
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
  ],
})
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['microphone'] })
const page = await ctx.newPage()
page.on(
  'console',
  (m) =>
    (m.type() === 'error' || m.type() === 'warning') &&
    !m.text().includes('401') &&
    console.log('[console]', m.type(), m.text().slice(0, 300)),
)
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
await page.goto('http://localhost:5173/login')
await page.getByTestId('login-email').fill('demo@animato.dev')
await page.getByTestId('login-password').fill('animato-demo')
await page.getByTestId('login-submit').click()
await page.waitForURL('**/app**')
const id = await page.evaluate(
  async () =>
    (
      await (
        await import('/src/features/editor/projects.ts')
      ).createEmptyProject('demo@animato.dev', 'Voice smoke', '16:9')
    ).id,
)
await page.goto(`http://localhost:5173/app/projects/${id}/edit?compositor=canvas2d`)
await page
  .getByTestId('media-import-input')
  .setInputFiles(['e2e/fixtures/speech.webm', 'e2e/fixtures/clip.webm'])
await page.waitForTimeout(6000)
console.log('toasts', await page.locator('[role=alert],[role=status]').allTextContents())
await page.locator('[data-testid=clip]').nth(1).waitFor({ timeout: 30000 })
console.log(
  'clips',
  await page
    .locator('[data-testid=clip]')
    .evaluateAll((e) => e.map((x) => x.dataset.type + ':' + x.closest('[data-track-id]').dataset.trackId)),
)
await page.screenshot({
  path: '/tmp/claude-0/-home-user-Animato/3cfda4e1-fe8d-5e29-925e-dbd3e6478a97/scratchpad/voice0.png',
})
console.log('waveforms', await page.locator('[data-testid=clip-waveform]').count())
await page.getByTestId('editor-play').click()
await page.waitForTimeout(1500)
console.log('timecode after play', await page.getByTestId('timecode').textContent())
await page.getByTestId('editor-play').click()
console.log('calls', JSON.stringify(await page.evaluate(() => window.__animatoEngineCalls)))
// record 2s voiceover with the fake mic
await page.getByRole('tab', { name: 'Voice' }).click()
await page.getByTestId('record-start').click()
await page.getByTestId('record-stop').waitFor({ timeout: 10000 })
await page.waitForTimeout(2000)
await page.getByTestId('record-stop').click()
await page.waitForFunction(
  () => document.querySelectorAll('[data-testid=track-voice] [data-testid=clip]').length > 0,
  null,
  { timeout: 30000 },
)
console.log('voice clips', await page.locator('[data-testid=track-voice] [data-testid=clip]').count())
// remove voice take so STT hears only speech
await page.getByRole('button', { name: 'Mute Video' }).click()
await page.getByRole('button', { name: 'Mute Voice' }).click()
await page.getByRole('tab', { name: 'Captions' }).click()
const t0 = Date.now()
await page.getByTestId('auto-captions').click()
for (let i = 0; i < 24; i++) {
  await page.waitForTimeout(5000)
  const st = await page
    .locator('[data-testid=captions-progress], [role=alert], [role=status]')
    .allTextContents()
  console.log('stt', i, JSON.stringify(st).slice(0, 300))
  if (await page.getByTestId('caption-list').count()) break
  if (st.join().includes('failed')) break
}
console.log('stt seconds', (Date.now() - t0) / 1000)
console.log(
  'captions',
  await page.locator('[data-testid=caption-list] textarea').evaluateAll((els) => els.map((e) => e.value)),
)
await page.screenshot({
  path: '/tmp/claude-0/-home-user-Animato/3cfda4e1-fe8d-5e29-925e-dbd3e6478a97/scratchpad/voice.png',
})
await browser.close()
