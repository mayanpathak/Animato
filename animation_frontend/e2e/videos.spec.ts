import { createJob, expect, login, test } from './fixtures'

test('Videos: empty state, composer strip, card actions', async ({ page }) => {
  await login(page)
  await expect(page.getByText('Your videos are stored in this browser.')).toBeVisible()
  // A starter fills the composer; Generate starts the job and opens the video page.
  await page.getByTestId('empty-starter').first().click()
  await expect(page.getByTestId('composer-prompt')).not.toHaveValue('')
  await page.getByTestId('composer-generate').click()
  await expect(page).toHaveURL(/\/app\/v\/vid_/)
  await expect(page.getByTestId('video-title')).toHaveText('Heart with Fourier Epicycles')
  await expect(page.getByTestId('job-open-editor')).toBeVisible({ timeout: 30_000 })

  await page.getByRole('link', { name: 'Back to videos' }).click()
  const card = page.getByTestId('video-card')
  await expect(card).toHaveCount(1)
  await expect(card).toContainText('9:16')

  await card.getByRole('button', { name: /More actions/ }).click()
  await page.getByRole('menuitem', { name: 'Rename' }).click()
  await page.getByRole('dialog').getByLabel('Name').fill('Heart epicycles')
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click()
  await expect(page.getByTestId('video-card-title')).toHaveText('Heart epicycles')

  await card.getByRole('button', { name: /More actions/ }).click()
  await page.getByRole('menuitem', { name: 'Duplicate' }).click()
  await expect(page.getByTestId('video-card')).toHaveCount(2)

  await page
    .getByTestId('video-card')
    .first()
    .getByRole('button', { name: /More actions/ })
    .click()
  await page.getByRole('menuitem', { name: 'Delete' }).click()
  await expect(page.getByRole('dialog')).toContainText('The render on Animato’s server is not deleted.')
  await page.getByTestId('video-delete-confirm').click()
  await expect(page.getByTestId('video-card')).toHaveCount(1)
})

test('a video created in another tab appears within 2 s', async ({ page, context }) => {
  await login(page)
  await page.goto('/app')
  const other = await context.newPage()
  await createJob(other, 'Binary search on sixteen numbered boxes')
  await expect(page.getByTestId('video-card')).toHaveCount(1, { timeout: 2_000 })
  await other.close()
})

test('N opens the composer and ⌘K finds a video', async ({ page }) => {
  await login(page)
  await createJob(page, 'Kinetic quote about making it simple')
  await page.goto('/app')
  await expect(page.getByTestId('video-card')).toHaveCount(1)
  await page.keyboard.press('n')
  await expect(page).toHaveURL(/\/app\/new$/)
  await page.goto('/app')
  await expect(page.getByTestId('video-card')).toHaveCount(1)
  await page.keyboard.press('Control+k')
  await page.getByPlaceholder(/search videos/i).fill('kinetic')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/app\/v\/vid_/)
})

test('settings: preferences, storage and privacy', async ({ page }) => {
  await login(page)
  await page.goto('/app/settings')
  await expect(page.getByTestId('account-email')).toHaveText('demo@animato.dev')
  await page.getByRole('switch', { name: 'Reduce motion' }).click()
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.reducedMotion)).toBe('true')
  await page.getByRole('tab', { name: '16:9' }).first().click()
  await expect(page.getByRole('heading', { name: 'Storage' })).toBeVisible()
  await expect(page.getByText('Never leaves this device')).toBeVisible()
})

test('brand kit page still works inside the new shell', async ({ page }) => {
  await login(page)
  await page.getByTestId('account-menu').click()
  await page.getByRole('menuitem', { name: 'Brand kit' }).click()
  await expect(page).toHaveURL(/\/app\/brand/)
  await page.getByTestId('brand-new').first().click()
  await expect(page.getByTestId('brand-save-status')).toBeVisible()
})
