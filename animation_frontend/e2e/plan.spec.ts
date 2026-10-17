// Plan 13.5 acceptance: the developer harness applies an edit plan and one
// Undo reverts it. The harness exists in development and this e2e build only.
import { createJob, expect, login, test } from './fixtures'

test.describe.configure({ timeout: 180_000 })

test('dev harness: a plan applies as one step and one Undo reverts it', async ({ page }) => {
  await login(page)
  const id = await createJob(page, 'Visualise how gradient descent finds the bottom of a valley')
  await expect(page.getByTestId('finish-inspector')).toBeVisible({ timeout: 60_000 })
  await page.goto(`/app/v/${id}?dev=plan`)
  await expect(page.getByTestId('finish-inspector')).toBeVisible({ timeout: 60_000 })
  const look = page.getByRole('radiogroup', { name: 'Look' })
  await expect(look.getByRole('radio', { name: 'Clean' })).toBeChecked()

  // An invalid plan is refused with reasons.
  await page.getByTestId('plan-json').fill('{"version": 0}')
  await page.getByTestId('plan-apply').click()
  await expect(page.getByTestId('plan-notes')).toContainText('summary')

  await page.getByTestId('plan-json').fill(
    JSON.stringify({
      version: 0,
      summary: 'Bold look, square, and a cutaway that does not exist',
      look: 'bold',
      format: '1:1',
      inserts: [{ asset: 'Clip 7', at: { t: 1 }, duration: 2, mode: 'cutaway' }],
    }),
  )
  await page.getByTestId('plan-apply').click()
  const notes = page.getByTestId('plan-notes')
  await expect(notes).toContainText('AI edit: Bold look, square')
  await expect(notes).toContainText('No asset is called "Clip 7"')
  await expect(look.getByRole('radio', { name: 'Bold' })).toBeChecked()
  await expect(
    page.getByRole('tablist', { name: 'Format' }).getByRole('tab', { name: '1:1' }),
  ).toHaveAttribute('aria-selected', 'true')

  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(look.getByRole('radio', { name: 'Clean' })).toBeChecked()
  await expect(
    page.getByRole('tablist', { name: 'Format' }).getByRole('tab', { name: '9:16' }),
  ).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled()
})
