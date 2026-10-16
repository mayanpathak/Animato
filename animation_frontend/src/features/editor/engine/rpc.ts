// A small typed request/response channel over postMessage, used between the
// UI thread and the editor's workers. Progress events travel on the same
// channel, tagged with the request id.

export interface RpcRequest {
  id: number
  method: string
  args: unknown[]
}

export type RpcReply =
  | { id: number; ok: true; result: unknown }
  | { id: number; ok: false; error: string }
  | { id: number; progress: unknown }
  | { event: string; payload: unknown }

type Handler = (
  args: unknown[],
  ctx: { progress: (p: unknown) => void; signal: AbortSignal },
) => unknown | Promise<unknown>

/** Worker side: dispatches requests to handlers. `cancel` aborts a running request. */
export function serve(handlers: Record<string, Handler>): {
  emit: (event: string, payload: unknown, transfer?: Transferable[]) => void
} {
  const scope = self as unknown as {
    postMessage(message: unknown, transfer?: Transferable[]): void
    onmessage: ((e: MessageEvent) => void) | null
  }
  const running = new Map<number, AbortController>()
  scope.onmessage = async (e: MessageEvent<RpcRequest | { cancel: number }>) => {
    const msg = e.data
    if ('cancel' in msg) {
      running.get(msg.cancel)?.abort()
      return
    }
    const handler = handlers[msg.method]
    if (!handler) {
      scope.postMessage({ id: msg.id, ok: false, error: `Unknown method ${msg.method}` })
      return
    }
    const controller = new AbortController()
    running.set(msg.id, controller)
    try {
      const result = await handler(msg.args, {
        progress: (p) => scope.postMessage({ id: msg.id, progress: p }),
        signal: controller.signal,
      })
      const transfer = collectTransferables(result)
      scope.postMessage({ id: msg.id, ok: true, result }, transfer)
    } catch (err) {
      scope.postMessage({ id: msg.id, ok: false, error: err instanceof Error ? err.message : String(err) })
    } finally {
      running.delete(msg.id)
    }
  }
  return { emit: (event, payload, transfer = []) => scope.postMessage({ event, payload }, transfer) }
}

function collectTransferables(value: unknown): Transferable[] {
  if (value instanceof ArrayBuffer) return [value]
  if (value instanceof ImageBitmap) return [value]
  if (ArrayBuffer.isView(value) && value.buffer instanceof ArrayBuffer) return [value.buffer]
  return []
}

export interface RpcClient {
  call<T>(
    method: string,
    args: unknown[],
    opts?: { onProgress?: (p: unknown) => void; signal?: AbortSignal; transfer?: Transferable[] },
  ): Promise<T>
  on(event: string, cb: (payload: unknown) => void): () => void
  terminate(): void
}

/** UI side. */
export function connect(worker: Worker): RpcClient {
  let seq = 0
  const pending = new Map<
    number,
    { resolve: (v: unknown) => void; reject: (e: Error) => void; onProgress?: (p: unknown) => void }
  >()
  const listeners = new Map<string, Set<(p: unknown) => void>>()
  worker.onmessage = (e: MessageEvent<RpcReply>) => {
    const msg = e.data
    if ('event' in msg) {
      listeners.get(msg.event)?.forEach((cb) => cb(msg.payload))
      return
    }
    const p = pending.get(msg.id)
    if (!p) return
    if ('progress' in msg) {
      p.onProgress?.(msg.progress)
      return
    }
    pending.delete(msg.id)
    if (msg.ok) p.resolve(msg.result)
    else p.reject(new Error(msg.error))
  }
  worker.onerror = (e) => {
    for (const p of pending.values()) p.reject(new Error(e.message || 'Worker crashed'))
    pending.clear()
  }
  return {
    call<T>(
      method: string,
      args: unknown[],
      opts: { onProgress?: (p: unknown) => void; signal?: AbortSignal; transfer?: Transferable[] } = {},
    ) {
      const id = ++seq
      return new Promise<T>((resolve, reject) => {
        pending.set(id, { resolve: resolve as (v: unknown) => void, reject, onProgress: opts.onProgress })
        opts.signal?.addEventListener('abort', () => worker.postMessage({ cancel: id }), { once: true })
        worker.postMessage({ id, method, args }, opts.transfer ?? [])
      })
    },
    on(event, cb) {
      const set = listeners.get(event) ?? new Set()
      set.add(cb)
      listeners.set(event, set)
      return () => set.delete(cb)
    },
    terminate: () => worker.terminate(),
  }
}
