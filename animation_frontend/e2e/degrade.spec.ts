// Plan 15.5 degrade path: without WebCodecs the render plays and the
// original downloads, with the reason Finish is missing (6.11).
// The no-WebGPU path is in degrade-nogpu.spec.ts (it needs its own browser).
import { createJob, expect, login, test } from './fixtures'

test('no WebCodecs: the render plays, Finish says why it is missing, the original downloads', async ({
  page,
}) => {
  await page.addInitScript(() => {
    for (const name of ['VideoEncoder', 'VideoDecoder', 'AudioEncoder', 'AudioDecoder'])
      delete (window as unknown as Record<string, unknown>)[name]
  })
  await login(page)
  await createJob(page, 'Visualise how gradient descent finds the bottom of a valley')
  await expect(page.getByTestId('no-webcodecs')).toContainText(
    'Finishing needs Chrome, Edge or another browser with WebCodecs.',
    { timeout: 60_000 },
  )
  await expect(page.getByRole('link', { name: 'Download original' })).toHaveAttribute(
    'href',
    /\/api\/jobs\/.+\/video/,
  )
  await expect(page.getByTestId('finish-inspector')).toHaveCount(0)
  await expect(page.getByTestId('job-open-editor')).toHaveCount(0)
})
