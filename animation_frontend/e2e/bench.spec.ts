import { readFileSync, writeFileSync } from 'node:fs'
import { expect, login, test } from './fixtures'

// Plan 10.4 measurements. Opt-in: BENCH=1 npx playwright test e2e/bench.spec.ts
test.skip(!process.env.BENCH, 'benchmark runs only with BENCH=1')
test.describe.configure({ timeout: 600_000 })

const file = (name: string, mime: string) => ({
  name,
  mime,
  bytes: [...readFileSync(`e2e/fixtures/${name}`)],
})

test('engine benchmark (plan 10.4)', async ({ page }) => {
  await login(page)
  const inputs = {
    video: [file('clip.mp4', 'video/mp4'), file('clip.webm', 'video/webm')],
    audio: [file('speech.webm', 'audio/webm'), file('tone.wav', 'audio/wav')],
  }
  const result = await page.evaluate(async (raw) => {
    const toInput = (i: { name: string; mime: string; bytes: number[] }) => ({
      ...i,
      bytes: new Uint8Array(i.bytes),
    })
    const w = window as unknown as { __animatoBench: (x: unknown) => Promise<unknown> }
    return w.__animatoBench({ video: raw.video.map(toInput), audio: raw.audio.map(toInput) })
  }, inputs)
  writeFileSync(process.env.BENCH_OUT ?? 'test-results/engine-bench.json', JSON.stringify(result, null, 2))
  expect(result).toBeTruthy()
})
