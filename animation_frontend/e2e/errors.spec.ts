import { createJob, expect, login, test } from './fixtures'

// Plan 11.4: every error row shows the specified UI. The MSW mock answers the
// real status codes; `[e2e:…]` markers in a prompt pick the failure.

async function submit(page: import('@playwright/test').Page, prompt: string) {
  await page.goto('/app/new')
  await page.getByTestId('create-prompt').fill(prompt)
  await page.getByTestId('create-submit').click()
}

test('create job: 500 and other 4xx show the mapped messages and keep the prompt', async ({ page }) => {
  await login(page)
  await submit(page, 'An animated bar chart of rainfall [e2e:500]')
  await expect(page.getByRole('alert')).toContainText('Something went wrong on our side. Please try again.')
  await expect(page.getByTestId('create-prompt')).toHaveValue(/rainfall/)

  await submit(page, 'An animated bar chart of rainfall [e2e:422]')
  await expect(page.getByRole('alert')).toContainText("We couldn't send that. Please refresh and try again.")
})

test('create job: 429 disables Generate with the Retry-After countdown', async ({ page }) => {
  await login(page)
  for (let i = 0; i < 5; i++) await createJob(page, `Quota filler animation number ${i + 1}`)
  await submit(page, 'One more animation past the hourly quota')
  await expect(page.getByRole('alert')).toContainText("You've reached the render limit. Next render in")
  await expect(page.getByTestId('create-submit')).toBeDisabled()
  await expect(page.getByTestId('create-submit')).toContainText('Next render in')
})

test('worker failure: friendly cause, raw text only behind Technical details', async ({ page }) => {
  await login(page)
  await createJob(page, 'A long scene that will time out [e2e:timeout]')
  await expect(page.getByText("That one didn't render.")).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('The animation took too long to render.')).toBeVisible()
  await expect(page.getByText('Uses 1 of your renders.')).toBeVisible()
  await expect(page.getByText(/container killed/)).toHaveCount(0)
  await page.getByRole('button', { name: 'Technical details' }).click()
  await expect(page.getByText(/container killed/)).toBeVisible()
})

test('get job: unknown id shows "no longer available"', async ({ page }) => {
  await login(page)
  await page.goto('/app/jobs/00000000-0000-4000-8000-000000000000')
  await expect(page.getByText('This render is no longer available.')).toBeVisible()
})

test('import failure falls back to the plain player with Retry import', async ({ page }) => {
  await login(page)
  await createJob(page, 'Kinetic quote that cannot be imported [e2e:importfail]')
  // The import starts by itself when the render is ready (plan 6.5 prefetch).
  await expect(page.getByTestId('import-failed')).toContainText("Couldn't load the video for finishing.")
  await expect(page.getByRole('button', { name: 'Retry import' })).toBeVisible()
  await expect(page.getByText('The video could not be loaded.')).toHaveCount(0)
  // The plain <video> needs no CORS: it plays (it autoplays muted on Ready).
  await expect
    .poll(
      () =>
        page
          .locator('video')
          .first()
          .evaluate((v: HTMLVideoElement) => v.currentTime),
      { timeout: 15_000 },
    )
    .toBeGreaterThan(0)
})
