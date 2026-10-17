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
  await expect(page.getByTestId('render-view').or(page.getByTestId('finish-inspector'))).toBeVisible()
  // The mock walks the real status sequence; the page polls GET /api/jobs/:id.
  // Ready: the render is brought into this browser and Finish opens (plan 6.6).
  await expect(page.getByTestId('editor')).toHaveAttribute('data-mode', 'finish', { timeout: 60_000 })
  await expect(page.getByTestId('finish-inspector')).toBeVisible()
  await expect(page.getByTestId('take')).toHaveCount(1)
  await expect(page.getByTestId('take')).toHaveAttribute('aria-pressed', 'true')
  // The derived title (plan 6.4.4) is the hook title.
  await expect(page.getByTestId('finish-title')).toHaveValue('Binary Search Halves a Sorted')

  // T opens the fine-tune timeline on the same video.
  await page.keyboard.press('t')
  await expect(page).toHaveURL(/\/app\/v\/vid_[^?]+\?mode=timeline/, { timeout: 30_000 })
  await expect(page.locator('[data-testid=track-video] [data-testid=clip]')).toHaveCount(1)
  await expect(page.locator('[data-testid=clip-thumbnails] img').first()).toBeVisible()
  await page.getByTestId('toggle-mode').click()
  await expect(page.getByTestId('editor')).toHaveAttribute('data-mode', 'finish')
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
