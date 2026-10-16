import { DEMO, expect, test } from './fixtures'

test('signup with validation, verify, logout, login', async ({ page }) => {
  const id = Date.now().toString(36)
  const email = `e2e-${id}@animato.dev`
  const password = 'Frames-and-Fades-42'

  await page.goto('/signup')
  await page.getByTestId('signup-username').fill('ab')
  await page.getByTestId('signup-email').fill('not-an-email')
  await page.getByTestId('signup-password').fill('short')
  await page.getByTestId('signup-submit').click()
  await expect(page.getByText(/between 3 and 30/i)).toBeVisible()
  await expect(page.getByText(/valid email/i)).toBeVisible()
  await expect(page.getByText(/between 8 and 72/i)).toBeVisible()
  await expect(page).toHaveURL(/\/signup/)

  await page.getByTestId('signup-username').fill(`e2e_${id}`)
  await page.getByTestId('signup-email').fill(email)
  await page.getByTestId('signup-password').fill(password)
  await page.getByTestId('signup-submit').click()
  await expect(page).toHaveURL(/\/verify-email/)

  // Wrong code first, then the mock's code.
  await page.getByTestId('otp-input').locator('input').first().focus()
  await page.keyboard.type('000000')
  await expect(page.getByText(/invalid or expired/i)).toBeVisible()
  await page.getByTestId('otp-input').locator('input').first().focus()
  await page.keyboard.type('123456')
  await expect(page).toHaveURL(/\/app/)

  await page.getByRole('button', { name: 'Account menu' }).click()
  await page.getByRole('menuitem', { name: 'Log out' }).click()
  await expect(page).toHaveURL(/\/login/)

  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await expect(page).toHaveURL(/\/app$/)
})

test('login shows the server error and offers signup with the email', async ({ page }) => {
  await page.goto('/login')
  await page.getByTestId('login-email').fill(DEMO.email)
  await page.getByTestId('login-password').fill('wrong-password')
  await page.getByTestId('login-submit').click()
  await expect(page.getByTestId('auth-error')).toContainText('Invalid credentials')
  await expect(page.getByTestId('login-password')).toHaveValue('')
  await page
    .getByRole('link', { name: /sign up/i })
    .first()
    .click()
  await expect(page).toHaveURL(/\/signup\?email=demo%40animato\.dev/)
})
