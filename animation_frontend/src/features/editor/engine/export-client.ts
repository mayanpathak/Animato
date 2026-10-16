// Runs one export in its own worker so the preview stays interactive.
import type { MediaAsset } from '@/lib/local/models'
import { recordCall, type EngineCall } from '@/wasm/stats'
import { connect } from './rpc'
import type { ExportOptions, ExportProgress, ExportResult } from './export'

export async function exportTimeline(
  opts: Omit<ExportOptions, 'assets'> & { assets: MediaAsset[] },
  onProgress: (p: ExportProgress) => void,
  signal: AbortSignal,
): Promise<ExportResult> {
  const rpc = connect(
    new Worker(new URL('./render.worker.ts', import.meta.url), { type: 'module', name: 'animato-export' }),
  )
  rpc.on('engine-call', (c) => recordCall(c as EngineCall))
  try {
    return await rpc.call<ExportResult>('export', [opts], {
      onProgress: (p) => onProgress(p as ExportProgress),
      signal,
    })
  } finally {
    rpc.terminate()
  }
}

/** Codecs this browser can encode, for the export dialog. */
export async function encoderSupport(
  width: number,
  height: number,
): Promise<{ mp4: boolean; webm: boolean; h264: boolean; aac: boolean }> {
  const ok = async (config: VideoEncoderConfig) =>
    (await VideoEncoder.isConfigSupported(config).catch(() => null))?.supported === true
  const base = { width, height, bitrate: 4_000_000, framerate: 30 }
  const big = width * height > 2048 * 1152
  const [h264, vp9, av1] = await Promise.all([
    ok({ ...base, codec: big ? 'avc1.640033' : 'avc1.640028' }),
    ok({ ...base, codec: big ? 'vp09.00.51.08' : 'vp09.00.41.08' }),
    ok({ ...base, codec: big ? 'av01.0.12M.08' : 'av01.0.08M.08' }),
  ])
  const aac =
    (
      await AudioEncoder.isConfigSupported({
        codec: 'mp4a.40.2',
        sampleRate: 48000,
        numberOfChannels: 2,
      }).catch(() => null)
    )?.supported === true
  return { mp4: h264 || vp9 || av1, webm: vp9 || av1, h264, aac }
}
