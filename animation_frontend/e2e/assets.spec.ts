// Plan P8 acceptance: a B-roll render generated from inside Finish lands in
// the next slot and can be inserted; the insert is one undoable step. Also
// the user's own clip as the main clip of a new video.
import { createJob, expect, login, test } from './fixtures'

test.describe.configure({ timeout: 240_000 })

test('Generate a clip from Finish: it lands in the next B-roll slot and inserts at the playhead', async ({
  page,
}) => {
  await login(page)
  await createJob(page, 'Visualise how gradient descent finds the bottom of a valley')
  await expect(page.getByTestId('finish-inspector')).toBeVisible({ timeout: 60_000 })

  // The Assets rail starts collapsed to icons.
  await page.getByTestId('assets-rail').getByRole('button', { name: 'Media' }).click()
  const assets = page.getByTestId('video-assets')
  await expect(assets.locator('[data-role=main] [data-testid=asset-label]')).toHaveText('Main')

  await assets.getByTestId('generate-clip').click()
  await assets
    .getByTestId('generate-clip-prompt')
    .fill('Explain the Pythagorean theorem with animated squares')
  await assets.getByTestId('generate-clip-submit').click()
  // Rendering, then imported into the first slot. It is not a take.
  await expect(assets.getByTestId('broll-pending')).toBeVisible()
  const slot = assets.locator('[data-role=broll]')
  await expect(slot.getByTestId('asset-label')).toHaveText('Clip 1', { timeout: 90_000 })
  await expect(page.getByTestId('take')).toHaveCount(1)

  // A note is kept for the assistant (plan 13.2).
  await slot.getByLabel('Note for Clip 1').fill('Theorem proof, use when I mention triangles')
  await slot.getByLabel('Note for Clip 1').blur()

  await slot.getByTestId('insert-broll').click()
  await page.getByTestId('toggle-mode').click()
  const broll = page.locator('[data-track-id=trk_v_broll] [data-testid=clip]')
  await expect(broll).toHaveCount(1)
  // One undo removes the insert; the slot stays.
  await page.keyboard.press('ControlOrMeta+z')
  await expect(broll).toHaveCount(0)
  await page.keyboard.press('ControlOrMeta+Shift+z')
  await expect(broll).toHaveCount(1)

  // The note survived a reload (saved on the video).
  await expect(page.getByTestId('autosave')).toHaveAttribute('data-state', 'saved')
  await page.waitForTimeout(800) // the note's own save runs 500 ms after the last change
  await page.reload()
  // Reloaded in timeline mode: the Media panel is open on the left.
  await expect(page.getByLabel('Note for Clip 1')).toHaveValue(
    'Theorem proof, use when I mention triangles',
    {
      timeout: 30_000,
    },
  )
})

test('Import a clip: the user’s own clip opens in Finish as the main clip', async ({ page }) => {
  await login(page)
  await page.goto('/app')
  await page.getByTestId('import-clip-input').setInputFiles('e2e/fixtures/clip.webm')
  await page.waitForURL(/\/app\/v\/vid_/)
  await expect(page.getByTestId('finish-inspector')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByTestId('preview-pending')).toHaveCount(0, { timeout: 60_000 })
  await page.goto('/app')
  await expect(page.getByTestId('video-card').filter({ hasText: 'clip' })).toHaveCount(1)
})
