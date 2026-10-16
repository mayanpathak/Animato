import { expect, login, test } from './fixtures'

test('prompt → options → render → live status → result → open in editor', async ({ page }) => {
  await login(page)
  await page.goto('/app/new')
  await page.getByTestId('create-prompt').fill('Show how binary search halves a sorted array, step by step')
  await page.getByRole('tab', { name: 'Explainer' }).click()
  await page.getByRole('button', { name: 'What we send' }).click()
  // The workers always render 16:9: no aspect ratio is ever sent (plan 2.3).
  await expect(page.getByTestId('create-sent-preview')).not.toContainText(/9:16|16:9|1:1/)

  await page.getByTestId('create-submit').click()
  await expect(page).toHaveURL(/\/app\/v\/vid_/)
  await expect(page.getByTestId('render-view').or(page.getByTestId('job-open-editor'))).toBeVisible()
  // The mock walks the real status sequence; the page polls GET /api/jobs/:id.
  await expect(page.getByTestId('job-open-editor')).toBeVisible({ timeout: 30_000 })

  // Player controls on the real render.
  const time = page.getByTestId('player-time')
  await page.getByTestId('player-play').click()
  await expect
    .poll(async () => (await time.textContent())?.trim(), { timeout: 15_000 })
    .not.toMatch(/^00:00\.0\b/)
  await page.getByTestId('player-play').click()
  await page.getByTestId('player-speed').click()
  await page.getByTestId('player-step-forward').click()

  await page.getByTestId('job-open-editor').click()
  await expect(page).toHaveURL(/\/app\/v\/vid_[^?]+\?mode=timeline/, { timeout: 30_000 })
  await expect(page.locator('[data-testid=track-video] [data-testid=clip]')).toHaveCount(1)
  await expect(page.locator('[data-testid=clip-thumbnails] img').first()).toBeVisible()
})

test('a failing prompt shows the error state with retry', async ({ page }) => {
  await login(page)
  await page.goto('/app/new')
  await page.getByTestId('create-prompt').fill('This render should fail on purpose, please')
  await page.getByTestId('create-submit').click()
  await expect(page.getByText("That one didn't render.")).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('job-retry')).toHaveText(/Try again/)
  await expect(page.getByText("That one didn't render.")).toBeVisible()
})
