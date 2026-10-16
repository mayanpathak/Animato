import type { Page } from '@playwright/test'
import { createJob, createProject, expect, login, test } from './fixtures'

// Full-page screenshots of every page, desktop and mobile, into screenshots/.
// Reduced motion is emulated so scroll-driven sections render in their final state.
test.describe.configure({ mode: 'serial', timeout: 240_000 })

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
} as const

async function shot(page: Page, name: string, size: keyof typeof VIEWPORTS) {
  await page.waitForLoadState('networkidle').catch(() => undefined)
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(600)
  // Headless Chromium repeats tiles in captures taller than ~8k px, so long
  // pages are saved in parts: <page>-<size>.png, <page>-<size>-2.png, ...
  const PART = 6000
  const height = await page.evaluate(() => document.documentElement.scrollHeight)
  const width = page.viewportSize()?.width ?? 1440
  for (let i = 0, y = 0; y < height; i++, y += PART) {
    const suffix = i === 0 ? '' : `-${i + 1}`
    await page.screenshot({
      path: `screenshots/${name}-${size}${suffix}.png`,
      fullPage: true,
      animations: 'disabled',
      clip: { x: 0, y, width, height: Math.min(PART, height - y) },
    })
  }
}

for (const [size, viewport] of Object.entries(VIEWPORTS) as [
  keyof typeof VIEWPORTS,
  (typeof VIEWPORTS)[keyof typeof VIEWPORTS],
][]) {
  test.describe(size, () => {
    test.use({ viewport, reducedMotion: 'reduce', isMobile: size === 'mobile', hasTouch: size === 'mobile' })

    test(`public pages (${size})`, async ({ page }) => {
      for (const [name, path] of [
        ['landing', '/'],
        ['pricing', '/pricing'],
        ['login', '/login'],
        ['signup', '/signup'],
        ['forgot-password', '/forgot-password'],
        ['reset-password', `/reset-password/${'b'.repeat(40)}`],
        ['404', '/this-page-does-not-exist'],
      ]) {
        await page.goto(path)
        await expect(page.locator('main, h1, h2').first()).toBeVisible()
        await shot(page, name, size)
      }
      // Verify email needs a fresh, unverified account.
      await page.goto('/signup')
      const id = `${size}${Date.now().toString(36)}`
      await page.getByTestId('signup-username').fill(`shot_${id}`)
      await page.getByTestId('signup-email').fill(`shot-${id}@animato.dev`)
      await page.getByTestId('signup-password').fill('Screenshot-Pass-77')
      await page.getByTestId('signup-submit').click()
      await expect(page).toHaveURL(/verify-email/)
      await shot(page, 'verify-email', size)
    })

    test(`app pages (${size})`, async ({ page }) => {
      await login(page)
      await expect(page.getByTestId('composer-strip')).toBeVisible()
      await shot(page, 'videos-empty', size)
      await createJob(page, 'Visualise how gradient descent finds the bottom of a valley')
      await shot(page, 'video-rendering', size)
      await expect(page.getByTestId('job-status')).toContainText('Ready', { timeout: 30_000 })
      await shot(page, 'video-ready', size)
      await createJob(page, 'A render that times out on purpose [e2e:timeout]')
      await expect(page.getByText("That one didn't render.")).toBeVisible({ timeout: 30_000 })
      await shot(page, 'video-failed', size)
      await createJob(page, 'Kinetic quote: Make it simple, but significant')
      await page.goto('/app')
      await expect(page.getByTestId('video-card')).toHaveCount(3)
      await shot(page, 'videos', size)
      await page.getByTestId('account-menu').click()
      await shot(page, 'account-menu', size)
      await page.keyboard.press('Escape')
      await page.goto('/app/new')
      await page
        .getByTestId('create-prompt')
        .fill('A 20-second product teaser for a note-taking app, bold type, quick cuts')
      await shot(page, 'create', size)
      for (const [name, path] of [
        ['brand', '/app/brand'],
        ['settings', '/app/settings'],
      ]) {
        await page.goto(path)
        await expect(page.locator('h1, h2').first()).toBeVisible()
        await shot(page, name, size)
      }
      const videoId = await createProject(page, 'Launch teaser')
      await page.goto(`/app/v/${videoId}?mode=timeline&compositor=canvas2d`)
      await page
        .getByTestId('media-import-input')
        .setInputFiles(['e2e/fixtures/clip.webm', 'e2e/fixtures/speech.webm'])
      await expect(page.locator('[data-testid=clip]')).toHaveCount(2, { timeout: 60_000 })
      if (size === 'desktop') {
        await page.locator('[data-testid=track-video] [data-testid=clip]').first().click()
        await page.getByTestId('timeline-ruler').click({ position: { x: 120, y: 10 } })
      }
      await page.waitForTimeout(1200)
      await shot(page, 'editor', size)
    })
  })
}
