import AxeBuilder from '@axe-core/playwright'
import { createJob, expect, login, test } from './fixtures'

// P2 acceptance: axe finds no serious or critical violations on the app screens.
// Reduced motion so contrast is measured on settled, fully opaque content.
test.use({ reducedMotion: 'reduce' })
async function audit(page: import('@playwright/test').Page, name: string) {
  await page.waitForLoadState('networkidle').catch(() => undefined)
  await page.waitForTimeout(800)
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze()
  const bad = result.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  expect(
    bad.map((v) => `${name}: ${v.id} (${v.impact}) ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([])
}

test('app screens have no serious axe violations', async ({ page }) => {
  await login(page)
  await audit(page, 'videos-empty')
  await createJob(page, 'Visualise how gradient descent finds the bottom of a valley')
  await expect(page.getByTestId('job-status')).toContainText('Ready', { timeout: 30_000 })
  await audit(page, 'video-ready')
  await page.goto('/app')
  await expect(page.getByTestId('video-card')).toHaveCount(1)
  await audit(page, 'videos')
  await page.goto('/app/settings')
  await audit(page, 'settings')
  await page.goto('/app/new')
  await audit(page, 'create')
  await page.goto('/no-such-page')
  await audit(page, '404')
})
