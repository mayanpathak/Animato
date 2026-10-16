import { createProject, expect, login, test } from './fixtures'
import type { Page } from '@playwright/test'

test.describe.configure({ timeout: 180_000 })

type Rec = Record<string, unknown> & { timeline: Record<string, unknown> }

/** Reads or writes one record of the `projects` table (idb-keyval store). */
async function projectRecord(page: Page, id: string, next?: Rec): Promise<Rec> {
  return page.evaluate(
    ([id, next]) =>
      new Promise<Rec>((resolve, reject) => {
        const open = indexedDB.open('animato-projects')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const db = open.result
          const store = db.transaction('records', next ? 'readwrite' : 'readonly').objectStore('records')
          const req = next ? store.put(next, id) : store.get(id)
          req.onerror = () => reject(req.error)
          req.onsuccess = () => {
            const value = next ?? (req.result as Rec)
            db.close()
            resolve(value)
          }
        }
      }),
    [id, next] as const,
  )
}

test('a Timeline v1 project opens, migrates, keeps a backup and plays', async ({ page }) => {
  await login(page)
  const id = await createProject(page, 'Old project')
  await page.goto(`/app/v/${id}?mode=timeline&compositor=canvas2d`)
  // Real media in OPFS for the v1 clip to point at.
  await page.getByTestId('media-import-input').setInputFiles(['e2e/fixtures/clip.webm'])
  await expect(page.locator('[data-testid=track-video] [data-testid=clip]')).toHaveCount(1, {
    timeout: 60_000,
  })
  await expect(page.getByText('Saved locally')).toBeVisible({ timeout: 15_000 })

  const saved = await projectRecord(page, id)
  const v2Clip = (saved.timeline.clips as { assetId: string; name: string }[])[0]
  const media = {
    id: 'clp_old',
    type: 'media',
    assetId: v2Clip.assetId,
    name: v2Clip.name,
    start: 0,
    duration: 2,
    offset: 0,
    speed: 1,
    volume: 1,
    fadeIn: 0,
    fadeOut: 0,
    transform: { x: 0.5, y: 0.5, scale: 1, rotation: 0, opacity: 1 },
    color: { brightness: 1, contrast: 1, saturation: 1 },
    crop: { top: 0, right: 0, bottom: 0, left: 0 },
    audio: { normalizeGain: 1, gate: false, eq: { low: 0, mid: 0, high: 0 }, duck: false },
  }
  const track = (id: string, kind: string, name: string, clips: unknown[]) => ({
    id,
    kind,
    name,
    muted: false,
    hidden: false,
    volume: 1,
    clips,
  })
  const v1 = {
    version: 1,
    width: 1920,
    height: 1080,
    fps: 30,
    background: '#000000',
    tracks: [
      track('trk_text', 'text', 'Text', [
        {
          id: 'txt_old',
          type: 'text',
          start: 0.2,
          duration: 1.5,
          text: 'Old title',
          font: 'Inter',
          size: 100,
          weight: 700,
          color: '#ffffff',
          x: 0.5,
          y: 0.4,
          align: 'Center',
          background: null,
          animation: 'fade',
        },
      ]),
      track('trk_video', 'video', 'Video', [media]),
      track('trk_captions', 'caption', 'Captions', [
        { id: 'cap_old', type: 'caption', start: 0, duration: 1.8, text: 'An old caption' },
      ]),
      track('trk_voice', 'voice', 'Voiceover', []),
      track('trk_audio', 'audio', 'Audio', []),
    ],
    captionStyle: { font: 'Inter', size: 54, color: '#ffffff', background: '#000000b3', y: 0.86 },
    ducking: { enabled: true, amountDb: -12 },
  }
  const { transcript: _t, timelineV1Backup: _b, ...rest } = saved
  await projectRecord(page, id, { ...rest, timeline: v1 })

  await page.reload()
  await expect(page.locator('[data-testid=track-video] [data-testid=clip]')).toHaveCount(1, {
    timeout: 30_000,
  })
  await expect(page.locator('[data-testid=track-video] [data-testid=clip]')).toHaveAttribute(
    'data-duration',
    '2.000',
  )
  await expect(page.locator('[data-testid=track-text] [data-testid=clip]')).toHaveText(/Old title/)
  await expect(page.locator('[data-testid=track-caption] [data-testid=clip]')).toHaveText(/An old caption/)

  // Stored as v2, with the v1 document kept as a backup and the captions as a transcript.
  await expect.poll(async () => (await projectRecord(page, id)).timeline.version, { timeout: 10_000 }).toBe(2)
  const migrated = await projectRecord(page, id)
  expect((migrated.timelineV1Backup as { version: number }).version).toBe(1)
  expect((migrated.transcript as { words: { text: string }[] }).words.map((w) => w.text).join(' ')).toBe(
    'An old caption',
  )

  // And it plays: the timecode passes one second.
  await expect(page.getByTestId('timecode')).toHaveText('00:00:00:00')
  await page.getByTestId('editor-play').click()
  await expect(page.getByTestId('timecode')).not.toHaveText(/00:00:00/, { timeout: 10_000 })
})
