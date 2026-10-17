// Plan 15.2/15.3: when the browser is out of space, an import says so and
// leads to Settings → Storage, which lists the largest files.
import { createProject, expect, login, test } from './fixtures'

test('storage full: the import fails with a way to free up space', async ({ page }) => {
  await login(page)
  const id = await createProject(page, 'Storage e2e')
  // One file in first, so Settings has something to list.
  await page.getByTestId('media-import-input').setInputFiles('e2e/fixtures/clip.webm')
  await expect(page.locator('[data-testid=clip]')).toHaveCount(1, { timeout: 60_000 })

  // From now on every OPFS write is refused as if the disk were full.
  await page.evaluate(() => {
    FileSystemFileHandle.prototype.createWritable = () =>
      Promise.reject(new DOMException('The quota has been exceeded.', 'QuotaExceededError'))
  })
  await page.getByTestId('media-import-input').setInputFiles('e2e/fixtures/speech.webm')
  const alert = page.getByRole('alert').filter({ hasText: 'out of storage space' }).first()
  await expect(alert).toBeVisible({ timeout: 30_000 })
  await alert.getByRole('link', { name: 'Free up space' }).click()

  await expect(page).toHaveURL(/\/app\/settings#storage$/)
  await expect(page.locator('#storage')).toBeInViewport()
  await expect(page.getByTestId('largest-files')).toContainText('clip.webm')
  expect(id).toBeTruthy()
})
