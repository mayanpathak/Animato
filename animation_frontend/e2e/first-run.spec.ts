import { expect, test } from './fixtures'

// J1 (plan 5.1): landing → idea → signup sheet → verify → the first video starts by itself.
test('first visit to first video, timed', async ({ page }) => {
  const started = Date.now()
  const id = Date.now().toString(36)
  await page.goto('/')
  await page.getByTestId('hero-prompt-input').fill('Binary search on 16 boxes, find 42')
  await page.getByTestId('hero-prompt-generate').click()

  const sheet = page.getByTestId('auth-sheet')
  await expect(sheet).toBeVisible()
  await expect(sheet.getByTestId('pending-prompt')).toContainText('Binary search on 16 boxes')
  await sheet.getByTestId('signup-username').fill(`first_${id}`)
  await sheet.getByTestId('signup-email').fill(`first-${id}@animato.dev`)
  await sheet.getByTestId('signup-password').fill('Frames-and-Fades-42')
  await sheet.getByTestId('signup-submit').click()

  await expect(page).toHaveURL(/\/verify-email/)
  await page.getByTestId('otp-input').locator('input').first().focus()
  await page.keyboard.type('123456')

  // Drafting: the prompt, "Starting your first video…" with a 3 s Cancel, then the job.
  await expect(page).toHaveURL(/\/app\/v\/vid_/)
  await expect(page.getByTestId('first-start')).toBeVisible()
  await expect(page.getByTestId('render-view')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('render-prompt')).toContainText('Binary search on 16 boxes')
  await expect(page.getByTestId('render-stages')).toBeVisible()
  await expect(page.getByTestId('job-open-editor')).toBeVisible({ timeout: 30_000 })
  // The sandbox's mocked render is fast; the budget (plan 5.1) is 3 minutes excluding render time.
  expect(Date.now() - started).toBeLessThan(180_000)
})

test('the first auto-start can be cancelled and started by hand', async ({ page }) => {
  const id = Date.now().toString(36)
  await page.goto('/')
  await page.getByTestId('hero-prompt-input').fill('Kinetic quote: Make it simple, but significant')
  await page.getByTestId('hero-prompt-generate').click()
  const sheet = page.getByTestId('auth-sheet')
  await sheet.getByTestId('signup-username').fill(`cancel_${id}`)
  await sheet.getByTestId('signup-email').fill(`cancel-${id}@animato.dev`)
  await sheet.getByTestId('signup-password').fill('Frames-and-Fades-42')
  await sheet.getByTestId('signup-submit').click()
  await page.getByTestId('otp-input').locator('input').first().focus()
  await page.keyboard.type('123456')
  await page.getByTestId('first-start-cancel').click()
  await expect(page.getByTestId('draft-generate')).toBeVisible()
  await page.waitForTimeout(3500)
  await expect(page.getByTestId('render-view')).toHaveCount(0)
  await page.getByTestId('draft-generate').click()
  await expect(page.getByTestId('render-view')).toBeVisible()
})

test('a remix link prefills the hero; an existing user logs in from the sheet', async ({ page }) => {
  await page.goto('/?prompt=Draw%20a%20heart%20with%20Fourier%20epicycles%00&engine=manim')
  await expect(page.getByTestId('hero-prompt-input')).toHaveValue('Draw a heart with Fourier epicycles')
  await page.getByTestId('hero-prompt-generate').click()
  const sheet = page.getByTestId('auth-sheet')
  await sheet.getByRole('button', { name: 'Log in' }).click()
  await sheet.getByTestId('login-email').fill('demo@animato.dev')
  await sheet.getByTestId('login-password').fill('animato-demo')
  await sheet.getByTestId('login-submit').click()
  await expect(page).toHaveURL(/\/app\/v\/vid_/)
  await expect(page.getByText('Draw a heart with Fourier epicycles')).toBeVisible()
})

test('landing and pricing make no invented claims (plan 15.6)', async ({ page }) => {
  for (const path of ['/', '/pricing']) {
    await page.goto(path)
    const text = (await page.locator('body').innerText()).toLowerCase()
    for (const banned of ['testimonial', '4k', 'eta', 'trusted by', '$49', '$2,000', 'studio plan', 'annual'])
      expect(text, `${path} mentions "${banned}"`).not.toContain(banned)
  }
  await expect(page.getByTestId('pricing-note')).toHaveText(
    'Billing is not live yet. Everyone is on Free during early access.',
  )
})
