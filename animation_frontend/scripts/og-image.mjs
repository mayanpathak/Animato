// Captures the landing hero at 1200×630 as public/og.png (Open Graph, plan P10).
// The page itself is the picture: no invented render. Run after `npm run build`:
//   node scripts/og-image.mjs
import { spawn } from 'node:child_process'
import { chromium } from '@playwright/test'

const port = 4391
const server = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore' })
try {
  const url = `http://localhost:${port}/`
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(url)).ok) break
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || '/opt/pw-browsers/chromium',
  })
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, reducedMotion: 'reduce' })
  await page.goto(url)
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(800)
  // No system banners ("Can't reach the server" when no backend runs).
  await page.addStyleTag({ content: '[role="status"].fixed { display: none !important }' })
  await page.screenshot({ path: 'public/og.png' })
  await browser.close()
} finally {
  server.kill()
}
