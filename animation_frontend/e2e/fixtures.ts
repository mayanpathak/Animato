import { test as base, expect, type Page } from '@playwright/test'

// Resource errors the real API produces on purpose (logged out, not found,
// quota) show up as console errors in Chromium; everything else fails a test.
const ALLOWED = [
  /Failed to load resource: the server responded with a status of (400|401|404|409|422|429|500|502)/,
]

export const DEMO = { email: 'demo@animato.dev', password: 'animato-demo' }

export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use, testInfo) => {
      const errors: string[] = []
      page.on('console', (msg) => {
        if (msg.type() !== 'error' && msg.type() !== 'warning') return
        const text = msg.text()
        if (ALLOWED.some((re) => re.test(text))) return
        errors.push(`[${msg.type()}] ${text}`)
      })
      page.on('pageerror', (err) => errors.push(`[pageerror] ${err.message} @ ${page.url()}`))
      // Fast mock render pipeline: a job completes in ~1 s instead of ~12 s.
      await page.addInitScript(() => localStorage.setItem('animato:mock-speed', '12'))
      await use(errors)
      if (testInfo.status === testInfo.expectedStatus) expect(errors, 'console errors').toEqual([])
    },
    { auto: true },
  ],
})

export { expect }

export async function login(page: Page, next = '/app'): Promise<void> {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(DEMO.email)
  await page.getByTestId('login-password').fill(DEMO.password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((u) => u.pathname.startsWith('/app'))
}

/** Starts a video from the composer (real endpoint, answered by MSW); returns the video id. */
export async function createJob(
  page: Page,
  prompt = 'Explain the Pythagorean theorem with animated squares',
): Promise<string> {
  await page.goto('/app/new')
  await page.getByTestId('create-prompt').fill(prompt)
  await page.getByTestId('create-submit').click()
  await page.waitForURL(/\/app\/v\/vid_/)
  return new URL(page.url()).pathname.split('/').pop() as string
}

/** Creates an empty video from the command palette, opens its timeline and returns its id. */
export async function createProject(page: Page, _name = 'E2E video'): Promise<string> {
  await page.goto('/app')
  await page.getByRole('button', { name: 'Search (⌘K)' }).click()
  await page.getByTestId('palette-own-clip').click()
  await page.waitForURL(/\/app\/v\/vid_[^/?]+\?mode=timeline/)
  await page.getByTestId('timeline').waitFor()
  return new URL(page.url()).pathname.split('/').pop() as string
}

/** No horizontal overflow at the current viewport. */
export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  // Compare with the configured viewport: on mobile, innerWidth grows with overflowing content.
  const width = page.viewportSize()?.width ?? 0
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(scrollWidth - width).toBeLessThanOrEqual(1)
}
