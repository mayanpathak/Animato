import { readFileSync } from 'node:fs'
import { createProject, expect, login, test } from './fixtures'

test.describe.configure({ timeout: 300_000 })

test('voiceover, audio tools, SRT round trip and on-device auto-captions', async ({ page }, testInfo) => {
  await login(page)
  const id = await createProject(page, 'Voice e2e')
  await page.goto(`/app/projects/${id}/edit?compositor=canvas2d`)
  await page.getByTestId('media-import-input').setInputFiles('e2e/fixtures/speech.webm')
  const audio = page.locator('[data-testid=track-audio] [data-testid=clip]')
  await expect(audio).toHaveCount(1, { timeout: 60_000 })

  // Loudness normalization measures the real PCM.
  await audio.first().click()
  await page.getByTestId('normalize').click()
  await expect(page.getByText('Loudness normalized')).toBeVisible()

  // Play through the AudioWorklet mixer (Rust audio engine).
  await page.getByTestId('editor-play').click()
  await expect.poll(() => page.getByTestId('timecode').textContent()).not.toBe('00:00:00:00')
  await page.getByTestId('editor-play').click()
  expect(await page.evaluate(() => window.__animatoEngineCalls?.['audio:worklet-init'] ?? 0)).toBeGreaterThan(
    0,
  )

  // Record a take from the (fake) microphone; it lands on the Voice track.
  await page.getByRole('tab', { name: 'Voice' }).click()
  await page.getByTestId('record-start').click()
  await expect(page.getByTestId('record-stop')).toBeVisible({ timeout: 10_000 })
  await page.waitForTimeout(1200) // record ~1 s of audio
  await page.getByTestId('record-stop').click()
  await expect(page.locator('[data-testid=track-voice] [data-testid=clip]')).toHaveCount(1, {
    timeout: 30_000,
  })
  // The take is a beep from the fake device: mute it for transcription.
  await page.getByRole('button', { name: 'Mute Voice' }).click()

  // SRT import, then export round trip.
  await page.getByRole('tab', { name: 'Captions' }).click()
  const srt = testInfo.outputPath('in.srt')
  const { writeFileSync } = await import('node:fs')
  writeFileSync(
    srt,
    '1\n00:00:00,500 --> 00:00:02,000\nHello from an SRT file\n\n2\n00:00:02,500 --> 00:00:04,000\nSecond line\n',
  )
  await page.getByTestId('srt-input').setInputFiles(srt)
  await expect(page.locator('[data-testid=caption-list] li')).toHaveCount(2)
  const dl = page.waitForEvent('download')
  await page.getByTestId('srt-export').click()
  const out = testInfo.outputPath('out.srt')
  await (await dl).saveAs(out)
  expect(readFileSync(out, 'utf8')).toContain('00:00:00,500 --> 00:00:02,000\nHello from an SRT file')

  // Whisper runs locally (model downloaded once); words are grouped by offcut-text.
  test.skip(process.env.SKIP_STT === '1', 'SKIP_STT=1: no network for the speech model')
  await page.getByTestId('auto-captions').click()
  await expect(page.getByText(/captions created/)).toBeVisible({ timeout: 240_000 })
  const lines = await page
    .locator('[data-testid=caption-list] textarea')
    .evaluateAll((els) => els.map((e) => (e as HTMLTextAreaElement).value).join(' '))
  expect(lines.toLowerCase()).toMatch(/sentence|video|browser/)
  expect(
    await page.evaluate(() => window.__animatoEngineCalls?.['captions:normalize-transcript'] ?? 0),
  ).toBeGreaterThan(0)
})
