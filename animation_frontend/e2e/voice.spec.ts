import { readFileSync } from 'node:fs'
import { createProject, expect, login, test } from './fixtures'

test.describe.configure({ timeout: 300_000 })

test('voiceover, audio tools, SRT round trip and on-device auto-captions', async ({ page }, testInfo) => {
  await login(page)
  const id = await createProject(page, 'Voice e2e')
  await page.goto(`/app/v/${id}?mode=timeline&compositor=canvas2d`)
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
  // Space stops the take (it does not toggle playback while recording).
  await page.keyboard.press('Space')
  await expect(page.locator('[data-testid=track-voice] [data-testid=clip]')).toHaveCount(1, {
    timeout: 30_000,
  })
  // Cleaned by default: normalised and gated (plan 9.1); captions then run on their own.
  await expect(page.getByText('Voiceover added')).toBeVisible()
  await expect(page.getByTestId('editor-play')).toHaveAccessibleName('Play')
  await expect(page.getByTestId('captioning')).toHaveCount(0, { timeout: 240_000 })
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
  // Editing a word redraws the preview's captions straight away (plan 9.3).
  const builds = () => page.evaluate(() => window.__animatoEngineCalls?.['graphics:scene-build'] ?? 0)
  const before = await builds()
  await page.locator('[data-testid=caption-list] textarea').first().fill('Hello from the SRT file')
  await expect.poll(builds, { timeout: 1000 }).toBeGreaterThan(before)
  const dl = page.waitForEvent('download')
  await page.getByTestId('srt-export').click()
  const out = testInfo.outputPath('out.srt')
  await (await dl).saveAs(out)
  expect(readFileSync(out, 'utf8')).toContain('00:00:00,500 --> 00:00:02,000\nHello from the SRT file')

  // Whisper runs locally (model downloaded once); words are grouped by offcut-text.
  test.skip(process.env.SKIP_STT === '1', 'SKIP_STT=1: no network for the speech model')
  await page.getByTestId('auto-captions').click()
  await expect(page.getByTestId('captions-progress')).toBeVisible()
  await expect(page.getByTestId('captions-progress')).toHaveCount(0, { timeout: 240_000 })
  await expect(page.getByText(/captions created/).last()).toBeVisible()
  const lines = await page
    .locator('[data-testid=caption-list] textarea')
    .evaluateAll((els) => els.map((e) => (e as HTMLTextAreaElement).value).join(' '))
  expect(lines.toLowerCase()).toMatch(/sentence|video|browser/)
  expect(
    await page.evaluate(() => window.__animatoEngineCalls?.['captions:normalize-transcript'] ?? 0),
  ).toBeGreaterThan(0)
})
