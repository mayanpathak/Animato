import { createJob, createProject, expect, login, test } from './fixtures'

const PUBLIC = [
  ['/', /Describe it/i],
  ['/pricing', /pricing|plan/i],
  ['/login', /log in|welcome back|sign in/i],
  ['/signup', /create|sign up|start/i],
  ['/forgot-password', /reset|forgot/i],
  [`/reset-password/${'a'.repeat(40)}`, /password/i],
  ['/no-such-page', /This frame was cut/i],
] as const

for (const [path, heading] of PUBLIC) {
  test(`public route ${path} renders`, async ({ page }) => {
    await page.goto(path)
    await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible()
  })
}

test('app routes render for a signed-in user', async ({ page }) => {
  await login(page)
  for (const [path, heading] of [
    ['/app', /what are we making/i],
    ['/app/create', /.+/],
    ['/app/projects', /projects/i],
    ['/app/templates', /templates/i],
    ['/app/brand', /brand/i],
    ['/app/settings', /settings/i],
    ['/app/not-a-page', /This frame was cut/i],
  ] as const) {
    await page.goto(path)
    await expect(page.getByRole('heading', { name: heading }).first(), path).toBeVisible()
  }
  const jobId = await createJob(page)
  await expect(page.getByTestId('job-pipeline')).toBeVisible()
  expect(jobId).toMatch(/^[0-9a-f-]{36}$/)
  await createProject(page)
  await expect(page.getByTestId('editor')).toBeVisible()
  await expect(page.getByTestId('timeline')).toBeVisible()
})

test('protected routes send logged-out users to login and back', async ({ page }) => {
  await page.goto('/app/templates')
  await expect(page).toHaveURL(/\/login\?next=%2Fapp%2Ftemplates/)
  await page.getByTestId('login-email').fill('demo@animato.dev')
  await page.getByTestId('login-password').fill('animato-demo')
  await page.getByTestId('login-submit').click()
  await expect(page).toHaveURL(/\/app\/templates$/)
})
