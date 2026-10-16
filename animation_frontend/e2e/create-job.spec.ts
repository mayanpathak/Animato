import { expect, login, test } from './fixtures'

test('prompt → options → render → live status → result → open in editor', async ({ page }) => {
  await login(page)
  await page.goto('/app/create')
  await page.getByTestId('create-prompt').fill('Show how binary search halves a sorted array, step by step')
  await page.getByTestId('create-engine-manim').click()
  await page.getByRole('tab', { name: '9:16' }).click()
  await page.getByTestId('create-sent-preview').click()
  await expect(page.getByTestId('create-sent-preview')).toContainText(/9:16/)

  await page.getByTestId('create-submit').click()
  await expect(page).toHaveURL(/\/app\/jobs\/[0-9a-f-]{36}/)
  await expect(page.getByTestId('job-pipeline')).toBeVisible()
  // The mock walks the real status sequence; the page polls GET /api/jobs/:id.
  await expect(page.getByTestId('job-status')).toContainText('Ready', { timeout: 30_000 })
  await expect(page.getByTestId('job-feed')).toContainText(/Ready|Completed/i)

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
  await expect(page).toHaveURL(/\/app\/projects\/[^/]+\/edit/, { timeout: 30_000 })
  await expect(page.locator('[data-testid=track-video] [data-testid=clip]')).toHaveCount(1)
  await expect(page.locator('[data-testid=clip-thumbnails] img').first()).toBeVisible()
})

test('a failing prompt shows the error state with retry', async ({ page }) => {
  await login(page)
  await page.goto('/app/create')
  await page.getByTestId('create-prompt').fill('This render should fail on purpose, please')
  await page.getByTestId('create-submit').click()
  await expect(page.getByTestId('job-status')).toContainText('Failed', { timeout: 30_000 })
  await expect(page.getByRole('button', { name: /retry/i })).toBeVisible()
})
