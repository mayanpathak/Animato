// Worker-only APIs missing from the DOM lib used by the app's tsconfig.
interface FileSystemSyncAccessHandle {
  read(buffer: ArrayBufferView | ArrayBuffer, options?: { at?: number }): number
  write(buffer: ArrayBufferView | ArrayBuffer, options?: { at?: number }): number
  getSize(): number
  truncate(size: number): void
  flush(): void
  close(): void
}

interface FileSystemFileHandle {
  createSyncAccessHandle(options?: { mode?: 'read-only' | 'readwrite' | 'readwrite-unsafe' }): Promise<FileSystemSyncAccessHandle>
}
