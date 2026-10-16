// UI-thread side of media import. The original is streamed into OPFS here
// (never held whole in memory); the media worker then hashes, probes,
// thumbnails and extracts PCM. Rebuilt from its call sites and the worker's
// RPC surface after the folder was lost to the root `.gitignore` rule `media/`.
import { fileHandle, removeFile } from '@/lib/local/opfs'
import { mediaTable, uid, type MediaAsset } from '@/lib/local/models'
import { recordCall, type EngineCall } from '@/wasm/stats'
import { connect, type RpcClient } from '../engine/rpc'
import type { ImportRequest } from '../engine/media.worker'

export type ImportStage = 'copy' | 'probe' | 'thumbnails' | 'waveform'
export type ImportProgress = (stage: ImportStage, fraction: number) => void

export interface ImportMeta {
  owner: string
  name: string
  /** Animato job the file came from (a render), if any. */
  jobId?: string | null
  mime?: string
  /** Byte size when the source is a stream (used for copy progress). */
  size?: number
}

let worker: RpcClient | null = null

function media(): RpcClient {
  if (!worker) {
    worker = connect(
      new Worker(new URL('../engine/media.worker.ts', import.meta.url), {
        type: 'module',
        name: 'animato-media',
      }),
    )
    worker.on('engine-call', (c) => recordCall(c as EngineCall))
  }
  return worker
}

function extOf(name: string, mime: string): string {
  const m = /\.([a-z0-9]{1,5})$/i.exec(name)
  if (m) return m[1].toLowerCase()
  if (mime.includes('webm')) return 'webm'
  if (mime.startsWith('audio/')) return 'm4a'
  if (mime.startsWith('image/')) return mime.split('/')[1] ?? 'png'
  return 'mp4'
}

/** Copies a Blob or stream into OPFS, reporting byte progress. */
async function copyIn(
  path: string,
  data: Blob | ReadableStream<Uint8Array>,
  total: number,
  onProgress?: ImportProgress,
): Promise<number> {
  const handle = await fileHandle(path, true)
  const writable = await handle.createWritable()
  const stream = data instanceof Blob ? data.stream() : data
  let written = 0
  const counter = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      written += chunk.byteLength
      if (total > 0) onProgress?.('copy', Math.min(1, written / total))
      controller.enqueue(chunk)
    },
  })
  await stream.pipeThrough(counter).pipeTo(writable)
  onProgress?.('copy', 1)
  return written
}

/**
 * Imports a file into this browser's private storage and the media library.
 * Duplicates (same owner and SHA-256) resolve to the existing asset.
 */
export async function importFile(
  data: Blob | ReadableStream<Uint8Array>,
  meta: ImportMeta,
  onProgress?: ImportProgress,
): Promise<MediaAsset> {
  const id = uid('media')
  const mime = meta.mime ?? (data instanceof Blob ? data.type : '') ?? ''
  const path = `media/${id}.${extOf(meta.name, mime)}`
  const total = data instanceof Blob ? data.size : (meta.size ?? 0)
  onProgress?.('copy', 0)
  let size: number
  try {
    size = await copyIn(path, data, total, onProgress)
  } catch (e) {
    await removeFile(path)
    throw e
  }
  const req: ImportRequest = {
    id,
    path,
    name: meta.name,
    mime,
    owner: meta.owner,
    jobId: meta.jobId ?? null,
    size,
  }
  let asset: MediaAsset
  try {
    asset = await media().call<MediaAsset>('import', [req], {
      onProgress: (p) => {
        const { stage, fraction } = p as { stage: ImportStage; fraction: number }
        onProgress?.(stage, fraction)
      },
    })
  } catch (e) {
    await removeFile(path)
    throw e
  }
  const dupe = (await mediaTable.all()).find(
    (a) => a.owner === asset.owner && a.sha256 === asset.sha256 && a.id !== asset.id,
  )
  if (dupe) {
    await removeFile(path)
    await removeFile(`pcm/${id}.f32`)
    // A render imported again keeps its job link.
    if (asset.jobId && !dupe.jobId) return mediaTable.put({ ...dupe, jobId: asset.jobId })
    return dupe
  }
  return mediaTable.put(asset)
}

/** RMS loudness (dB) of a region of an asset's cached PCM. */
export function measureLoudness(assetId: string, from: number, duration: number): Promise<number> {
  return media().call<number>('measureLoudness', [assetId, from, duration])
}

/** Interleaved stereo 48 kHz PCM cached at import, or null for silent assets. */
export async function readPcm(assetId: string): Promise<Float32Array | null> {
  try {
    const file = await (await fileHandle(`pcm/${assetId}.f32`)).getFile()
    return new Float32Array(await file.arrayBuffer())
  } catch {
    return null
  }
}
