// Gzip size of the JS each public page loads in the production build (plan
// 15.1). Run after `npm run build`: npm run measure:js
import { spawn } from 'node:child_process'
import { gzipSync } from 'node:zlib'
import { chromium } from '@playwright/test'
const port = 4392
const server = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], {
  stdio: 'ignore',
  cwd: process.cwd(),
})
for (let i = 0; i < 60; i++) {
  try {
    if ((await fetch(`http://localhost:${port}/`)).ok) break
  } catch {}
  await new Promise((r) => setTimeout(r, 500))
}
const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM_PATH || '/opt/pw-browsers/chromium',
})
for (const path of ['/', '/login', '/pricing']) {
  const page = await browser.newPage()
  const sizes = new Map()
  page.on('response', async (res) => {
    const u = new URL(res.url())
    if (!u.pathname.endsWith('.js')) return
    const b = await res.body().catch(() => null)
    if (b) sizes.set(u.pathname, gzipSync(b, { level: 9 }).length)
  })
  await page.goto(`http://localhost:${port}${path}`)
  await page.waitForLoadState('networkidle')
  const total = [...sizes.values()].reduce((a, b) => a + b, 0)
  console.log(
    path,
    Math.round(total / 1024),
    'KB',
    JSON.stringify(
      [...sizes]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([f, n]) => `${f.replace('/assets/', '')}:${Math.round(n / 1024)}`),
    ),
  )
  await page.close()
}
await browser.close()
server.kill()
