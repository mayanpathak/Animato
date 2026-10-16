import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: [
    '--enable-unsafe-webgpu',
    '--enable-features=Vulkan',
    '--use-angle=swiftshader',
    '--use-webgpu-adapter=swiftshader',
    '--disable-vulkan-surface',
  ],
})
const page = await browser.newPage()
page.on('console', (m) => console.log('[console]', m.type(), m.text().slice(0, 300)))
await page.goto('http://localhost:5173/smoke-404')
await page.waitForTimeout(1500)
const b64 = readFileSync('e2e/fixtures/clip.webm').toString('base64')
const out = await page.evaluate(
  async ({ b64, variant }) => {
    const { importFile } = await import('/src/features/editor/media/client.ts')
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    const a = await importFile(new File([bytes], 'clip.webm', { type: 'video/webm' }), {
      owner: 'r',
      name: 'clip.webm',
    })
    const { PreviewRenderer } = await import('/src/features/editor/engine/preview-client.ts')
    const { emptyTimeline } = await import('/src/features/editor/model/timeline.ts')
    const { mediaClipFor } = await import('/src/features/editor/projects.ts')
    const tl = emptyTimeline('16:9')
    tl.tracks.find((t) => t.kind === 'video').clips.push(mediaClipFor(a, 0))
    const canvas = document.createElement('canvas')
    document.body.appendChild(canvas)
    const { renderer, info } = await PreviewRenderer.create(canvas, tl)
    await renderer.setProject(tl, [a])
    const log = [info.label]
    for (const t of [0, 0.5, 1, 1.5, 2]) {
      renderer.render(t)
      await new Promise((r) => setTimeout(r, 400))
      log.push(`t=${t} ms=${renderer.lastMs.toFixed(1)}`)
    }
    return log
  },
  { b64 },
)
console.log(out)
await browser.close()
