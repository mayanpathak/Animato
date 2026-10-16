// Per-asset frame sources inside a worker: decoders for video, bitmaps for images.
import type { MediaAsset } from '@/lib/local/models'
import { fileHandle } from '@/lib/local/opfs'
import type { FramePlan } from './compose'
import type { LayerSource } from './compositor'
import { FrameDecoder } from './decode'
import { openMedia, type OpenedMedia } from './demux'

interface VideoEntry {
  media: OpenedMedia
  decoder: FrameDecoder
}

export class SourcePool {
  private videos = new Map<string, Promise<VideoEntry | null>>()
  private images = new Map<string, Promise<ImageBitmap | null>>()
  private assets = new Map<string, MediaAsset>()

  setAssets(assets: Map<string, MediaAsset>): void {
    this.assets = assets
    for (const [id, entry] of this.videos) {
      if (!assets.has(id)) {
        void entry.then((e) => {
          e?.decoder.close()
          e?.media.close()
        })
        this.videos.delete(id)
      }
    }
  }

  private video(assetId: string): Promise<VideoEntry | null> {
    let entry = this.videos.get(assetId)
    if (!entry) {
      const asset = this.assets.get(assetId)
      entry = asset
        ? openMedia(asset.path, asset.name)
            .then((media) =>
              media.video ? { media, decoder: new FrameDecoder(media.video) } : (media.close(), null),
            )
            .catch(() => null)
        : Promise.resolve(null)
      this.videos.set(assetId, entry)
    }
    return entry
  }

  private image(assetId: string): Promise<ImageBitmap | null> {
    let entry = this.images.get(assetId)
    if (!entry) {
      const asset = this.assets.get(assetId)
      entry = asset
        ? fileHandle(asset.path)
            .then((h) => h.getFile())
            .then((f) => createImageBitmap(f))
            .catch(() => null)
        : Promise.resolve(null)
      this.images.set(assetId, entry)
    }
    return entry
  }

  /** Frames for every media layer in the plan. Video frames must be closed via `release`. */
  async gather(plan: FramePlan): Promise<Map<string, LayerSource>> {
    const out = new Map<string, LayerSource>()
    await Promise.all(
      plan.media.map(async (l) => {
        if (l.kind === 'image') {
          const bmp = await this.image(l.assetId)
          if (bmp) out.set(l.key, { image: bmp, width: bmp.width, height: bmp.height })
          return
        }
        const v = await this.video(l.assetId)
        const frame = v ? await v.decoder.frameAt(l.sourceTime) : null
        if (frame) out.set(l.key, { image: frame, width: frame.displayWidth, height: frame.displayHeight })
      }),
    )
    return out
  }

  release(sources: Map<string, LayerSource>): void {
    for (const s of sources.values()) if (s.image instanceof VideoFrame) s.image.close()
  }

  close(): void {
    for (const e of this.videos.values())
      void e.then((v) => {
        v?.decoder.close()
        v?.media.close()
      })
    for (const b of this.images.values()) void b.then((i) => i?.close())
    this.videos.clear()
    this.images.clear()
  }
}
