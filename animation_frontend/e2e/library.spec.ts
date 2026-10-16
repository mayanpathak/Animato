import { createProject, expect, login, test } from './fixtures'

test('projects: search, filter, multi-select and bulk delete', async ({ page }) => {
  await login(page)
  await createProject(page, 'Quarterly launch reel')
  await createProject(page, 'Fourier series explainer')
  await createProject(page, 'Onboarding walkthrough')
  await page.goto('/app/projects')
  await expect(page.getByTestId('project-card')).toHaveCount(3)

  await page.getByTestId('projects-search').fill('fourier')
  await expect(page.getByTestId('project-card')).toHaveCount(1)
  await expect(page.getByTestId('project-card')).toContainText('Fourier series explainer')
  await page.getByTestId('projects-search').fill('')
  await expect(page.getByTestId('project-card')).toHaveCount(3)

  await page.getByTestId('projects-view-list').click()
  await page.getByTestId('projects-view-grid').click()

  // Wait for the list → grid layout animation to finish.
  await expect(page.getByLabel('Select Quarterly launch reel')).toHaveCount(1)
  await page.getByLabel('Select Quarterly launch reel').check({ force: true })
  await page.getByLabel('Select Onboarding walkthrough').check({ force: true })
  const bar = page.getByRole('toolbar', { name: 'Selected projects' })
  await expect(bar).toContainText('2 selected')
  await bar.getByRole('button', { name: 'Delete' }).click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /delete/i })
    .click()
  await expect(page.getByTestId('project-card')).toHaveCount(1)
  await expect(page.getByTestId('project-card')).toContainText('Fourier series explainer')
})

test('templates prefill Prompt Studio', async ({ page }) => {
  await login(page)
  await page.goto('/app/templates')
  await page.getByTestId('template-card').first().click()
  await page.getByTestId('template-use').click()
  await expect(page).toHaveURL(/\/app\/create\?template=/)
  await expect(page.getByTestId('create-prompt')).not.toHaveValue('')
})

test('command palette navigates', async ({ page }) => {
  await login(page)
  await expect(page.getByRole('button', { name: /search or jump to/i })).toBeVisible()
  await page.keyboard.press('Control+k')
  await page.getByPlaceholder(/jump to/i).fill('brand')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/app\/brand/)
  await page.keyboard.press('Control+k')
  await page.getByPlaceholder(/jump to/i).fill('settings')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/app\/settings/)
})

test('brand kit and settings preferences', async ({ page }) => {
  await login(page)
  await page.goto('/app/brand')
  await page.getByTestId('brand-new').first().click()
  await expect(page.getByTestId('brand-save-status')).toBeVisible()
  await page.goto('/app/settings')
  await page.getByTestId('settings-tab-preferences').click()
  await page.getByTestId('settings-reduced-motion').click()
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.reducedMotion)).toBe('true')
  await page.getByTestId('settings-tab-storage').click()
  await expect(page.getByText(/coming soon/i)).toBeVisible()
})
