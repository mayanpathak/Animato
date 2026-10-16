import { createJob, createProject, expect, login, test } from './fixtures'

const PUBLIC = [
  ['/', /Explain anything/i],
  ['/pricing', /pricing|plan/i],
  ['/login', /log in|welcome back|sign in/i],
  ['/signup', /create|sign up|start/i],
  ['/forgot-password', /reset|forgot/i],
  [`/reset-password/${'a'.repeat(40)}`, /password/i],
] as const

for (const [path, heading] of PUBLIC) {
  test(`public route ${path} renders`, async ({ page }) => {
    await page.goto(path)
    await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible()
  })
}

test('404 is one line with a link home', async ({ page }) => {
  await page.goto('/no-such-page')
  await expect(page.getByText('This page doesn’t exist.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Go home' })).toHaveAttribute('href', '/')
})

test('app routes render for a signed-in user', async ({ page }) => {
  await login(page)
  for (const [path, heading] of [
    ['/app/brand', /brand/i],
    ['/app/settings', /settings/i],
  ] as const) {
    await page.goto(path)
    await expect(page.getByRole('heading', { name: heading }).first(), path).toBeVisible()
  }
  await page.goto('/app')
  await expect(page.getByTestId('composer-strip')).toBeVisible()
  await page.goto('/app/new')
  await expect(page.getByTestId('create-prompt')).toBeVisible()
  const videoId = await createJob(page)
  await expect(page.getByTestId('render-view').or(page.getByTestId('job-open-editor'))).toBeVisible()
  expect(videoId).toMatch(/^vid_/)
  await createProject(page)
  await expect(page.getByTestId('editor')).toBeVisible()
})

test('old routes redirect (plan 3.1)', async ({ page }) => {
  await login(page)
  await page.goto('/app/create?prompt=Remix%20this%20idea%20please')
  await expect(page).toHaveURL(/\/app\/new\?prompt=Remix/)
  await expect(page.getByTestId('create-prompt')).toHaveValue('Remix this idea please')
  await page.goto('/app/templates')
  await expect(page).toHaveURL(/\/app\/new$/)
  await page.goto('/app/projects')
  await expect(page).toHaveURL(/\/app$/)

  // A job link opens the video that owns it.
  const videoId = await createJob(page)
  const jobId = await page.evaluate(
    (id) =>
      new Promise<string>((resolve) => {
        const req = indexedDB.open('animato-projects')
        req.onsuccess = () => {
          const get = req.result.transaction('records').objectStore('records').get(id)
          get.onsuccess = () => resolve(get.result.selectedTake)
        }
      }),
    videoId,
  )
  await page.goto(`/app/jobs/${jobId}`)
  await expect(page).toHaveURL(new RegExp(`/app/v/${videoId}$`))
  await page.goto(`/app/projects/${videoId}/edit`)
  await expect(page).toHaveURL(new RegExp(`/app/v/${videoId}\\?mode=timeline`))
})

test('protected routes send logged-out users to login and back', async ({ page }) => {
  await page.goto('/app/settings')
  await expect(page).toHaveURL(/\/login\?next=%2Fapp%2Fsettings/)
  await page.getByTestId('login-email').fill('demo@animato.dev')
  await page.getByTestId('login-password').fill('animato-demo')
  await page.getByTestId('login-submit').click()
  await expect(page).toHaveURL(/\/app\/settings$/)
})
