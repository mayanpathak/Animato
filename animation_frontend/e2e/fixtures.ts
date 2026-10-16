import { test as base, expect, type Page } from '@playwright/test'

// Resource errors the real API produces on purpose (logged out, not found,
// quota) show up as console errors in Chromium; everything else fails a test.
const ALLOWED = [
  /Failed to load resource: the server responded with a status of (400|401|404|422|429|500|502)/,
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

/** Creates a render job through the real endpoint (answered by MSW) and records it locally. */
export async function createJob(
  page: Page,
  prompt = 'Explain the Pythagorean theorem with animated squares',
): Promise<string> {
  await page.goto('/app/create')
  await page.getByTestId('create-prompt').fill(prompt)
  await page.getByTestId('create-submit').click()
  await page.waitForURL(/\/app\/jobs\/[0-9a-f-]{36}/)
  return page.url().split('/').pop() as string
}

/** Creates an empty local project and returns its id. */
export async function createProject(page: Page, name = 'E2E project'): Promise<string> {
  await page.goto('/app/projects?new=1')
  await page.getByTestId('new-project-name').fill(name)
  await page.getByTestId('new-project-create').click()
  await page.waitForURL(/\/app\/projects\/[^/]+\/edit/)
  await page.getByTestId('timeline').waitFor()
  return page.url().split('/').slice(-2)[0]
}

/** No horizontal overflow at the current viewport. */
export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  // Compare with the configured viewport: on mobile, innerWidth grows with overflowing content.
  const width = page.viewportSize()?.width ?? 0
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(scrollWidth - width).toBeLessThanOrEqual(1)
}
