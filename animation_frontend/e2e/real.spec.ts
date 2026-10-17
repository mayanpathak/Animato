// The one flow against the real local stack (plan 15.3), skipped by default.
// Run it with the stack up (LOCAL_DEV.md) and an existing verified account:
//   E2E_EMAIL=… E2E_PASSWORD=… npm run test:e2e:real
// The credentials come from the environment only; this file never prints them.
import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

test.describe.configure({ timeout: 30 * 60_000 })

test('real stack: log in, create a job, wait for Completed, Finish, export @real', async ({ page }, info) => {
  const email = process.env.E2E_EMAIL
  const password = process.env.E2E_PASSWORD
  test.skip(!process.env.E2E_REAL || !email || !password, 'Set E2E_REAL=1, E2E_EMAIL and E2E_PASSWORD')

  await page.goto('/login?next=/app')
  await page.getByTestId('login-email').fill(email as string)
  await page.getByTestId('login-password').fill(password as string)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((u) => u.pathname.startsWith('/app'))

  await page.goto('/app/new')
  await page.getByTestId('create-prompt').fill('Explain the Pythagorean theorem with animated squares')
  await page.getByTestId('create-submit').click()
  await page.waitForURL(/\/app\/v\/vid_/)

  // Renders take minutes on a local worker; Finish opens once the render is imported.
  await expect(page.getByTestId('finish-inspector')).toBeVisible({ timeout: 25 * 60_000 })
  await expect(page.getByTestId('preview-pending')).toHaveCount(0, { timeout: 120_000 })

  await page.getByTestId('open-export').click()
  const download = page.waitForEvent('download', { timeout: 20 * 60_000 })
  await page.getByTestId('export-start').click()
  const file = info.outputPath('real-export.mp4')
  await (await download).saveAs(file)
  // An MP4 starts with an ftyp box.
  expect(readFileSync(file).subarray(4, 8).toString('latin1')).toBe('ftyp')
})
