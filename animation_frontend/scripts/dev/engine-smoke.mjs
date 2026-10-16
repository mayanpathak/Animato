// Dev smoke test for the media engine against `vite` on :5173.
// Usage: node scripts/dev/engine-smoke.mjs [canvas2d|webgpu]
import { chromium } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'

const force = process.argv[2] || undefined
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
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
await page.goto('http://localhost:5173/smoke-404')
await page.waitForTimeout(4000)
await page.goto('http://localhost:5173/smoke-404')
await page.waitForTimeout(1000)
const files = ['clip.mp4', 'clip.webm', 'tone.wav', 'image.png'].map((n) => [
  n,
  readFileSync(`e2e/fixtures/${n}`).toString('base64'),
])
const result = await page.evaluate(
  async ({ files, force }) => {
    const { importFile } = await import('/src/features/editor/media/client.ts')
    const out = { assets: [] }
    const mime = { mp4: 'video/mp4', webm: 'video/webm', wav: 'audio/wav', png: 'image/png' }
    const assets = []
    for (const [name, b64] of files) {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
      const t0 = performance.now()
      try {
        const a = await importFile(new File([bytes], name, { type: mime[name.split('.').pop()] }), {
          owner: 'smoke',
          name,
        })
        assets.push(a)
        out.assets.push({
          name,
          ms: Math.round(performance.now() - t0),
          kind: a.kind,
          demuxer: a.demuxer,
          duration: a.duration,
          w: a.width,
          h: a.height,
          v: a.videoCodec,
          au: a.audioCodec,
          thumbs: a.thumbnails.length,
          wave: a.waveform.length,
          peakMax: Math.max(0, ...a.waveform),
        })
      } catch (e) {
        out.assets.push({ name, error: String(e) })
      }
    }
    const { connect } = await import('/src/features/editor/engine/rpc.ts')
    const { emptyTimeline } = await import('/src/features/editor/model/timeline.ts')
    const { mediaClipFor } = await import('/src/features/editor/projects.ts')
    const rpc = connect(new Worker('/src/features/editor/engine/render.worker.ts', { type: 'module' }))
    const tl = emptyTimeline('16:9')
    const vid = assets.find((a) => a.name === 'clip.webm')
    const mp4 = assets.find((a) => a.name === 'clip.mp4')
    const vt = tl.tracks.find((t) => t.kind === 'video')
    if (vid) vt.clips.push({ ...mediaClipFor(vid, 0), duration: 2 })
    if (mp4) vt.clips.push({ ...mediaClipFor(mp4, 2), offset: 1, duration: 1.5 })
    tl.tracks
      .find((t) => t.kind === 'text')
      .clips.push({
        id: 'txt1',
        type: 'text',
        start: 0,
        duration: 3.5,
        text: 'Hello Animato',
        font: 'Inter',
        size: 96,
        weight: 700,
        color: '#ffffff',
        x: 0.5,
        y: 0.2,
        align: 'Center',
        background: '#00000080',
        animation: 'rise',
      })
    tl.width = 640
    tl.height = 360
    const t0 = performance.now()
    try {
      const res = await rpc.call(
        'export',
        [
          {
            timeline: tl,
            assets,
            width: 640,
            height: 360,
            fps: 30,
            format: force === 'canvas2d' ? 'mp4' : 'webm',
            quality: 'standard',
            path: 'exports/smoke.webm',
            compositor: force,
          },
        ],
        { onProgress: () => {} },
      )
      out.export = { ...res, ms: Math.round(performance.now() - t0) }
      const root = await navigator.storage.getDirectory()
      const f = await (await (await root.getDirectoryHandle('exports')).getFileHandle('smoke.webm')).getFile()
      const buf = new Uint8Array(await f.arrayBuffer())
      out.file = btoa(Array.from(buf, (c) => String.fromCharCode(c)).join(''))
    } catch (e) {
      out.export = { error: String(e) }
    }
    out.calls = window.__animatoEngineCalls
    return out
  },
  { files, force },
)
if (result.file) {
  writeFileSync(
    '/tmp/claude-0/-home-user-Animato/3cfda4e1-fe8d-5e29-925e-dbd3e6478a97/scratchpad/smoke.webm',
    Buffer.from(result.file, 'base64'),
  )
  delete result.file
}
console.log(JSON.stringify(result, null, 1))
await browser.close()
