// Origin Private File System helpers. Media originals and exports are kept
// here so large files never sit in memory: workers read them through
// synchronous access handles, the main thread streams them in.

async function root(): Promise<FileSystemDirectoryHandle> {
  return navigator.storage.getDirectory()
}

async function dir(path: string[], create: boolean): Promise<FileSystemDirectoryHandle> {
  let d = await root()
  for (const part of path) d = await d.getDirectoryHandle(part, { create })
  return d
}

function split(path: string): { dirs: string[]; name: string } {
  const parts = path.split('/').filter(Boolean)
  return { dirs: parts.slice(0, -1), name: parts[parts.length - 1] }
}

export async function fileHandle(path: string, create = false): Promise<FileSystemFileHandle> {
  const { dirs, name } = split(path)
  return (await dir(dirs, create)).getFileHandle(name, { create })
}

/** Streams a File/Blob into OPFS without reading it into memory first. */
export async function writeFile(path: string, data: Blob | ReadableStream<Uint8Array>): Promise<void> {
  const handle = await fileHandle(path, true)
  const writable = await handle.createWritable()
  const stream = data instanceof Blob ? data.stream() : data
  await stream.pipeTo(writable)
}

export async function readFile(path: string): Promise<File> {
  return (await fileHandle(path)).getFile()
}

export async function removeFile(path: string): Promise<void> {
  const { dirs, name } = split(path)
  try {
    await (await dir(dirs, false)).removeEntry(name)
  } catch {
    // already gone
  }
}

export async function clearDirectory(name: string): Promise<void> {
  try {
    await (await root()).removeEntry(name, { recursive: true })
  } catch {
    // nothing to clear
  }
}

export interface StorageUsage {
  usage: number
  quota: number
}

export async function storageUsage(): Promise<StorageUsage> {
  const est = await navigator.storage?.estimate?.()
  return { usage: est?.usage ?? 0, quota: est?.quota ?? 0 }
}
