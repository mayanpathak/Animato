import { createJob, expect, expectNoHorizontalScroll, login, test } from './fixtures'

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

test('landing fits a phone', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('hero-prompt-input')).toBeVisible()
  await expectNoHorizontalScroll(page)
  await page.mouse.wheel(0, 4000)
  await expectNoHorizontalScroll(page)
})

test('Videos, Create and a video page fit a phone', async ({ page }) => {
  await login(page)
  await expectNoHorizontalScroll(page)
  await page.goto('/app/new')
  await expect(page.getByTestId('create-prompt')).toBeVisible()
  await expectNoHorizontalScroll(page)
  await createJob(page)
  await expect(page.getByTestId('job-status')).toContainText('Ready', { timeout: 30_000 })
  await expectNoHorizontalScroll(page)
})
