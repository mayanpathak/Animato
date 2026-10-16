// Local-first storage. Everything the backend does not offer lives here, in
// this browser: IndexedDB for records, OPFS (see opfs.ts) for media bytes.
import { createStore, del, entries, get, set, type UseStore } from 'idb-keyval'

const stores: Record<string, UseStore> = {}

function store(name: string): UseStore {
  stores[name] ??= createStore(`animato-${name}`, 'records')
  return stores[name]
}

export interface Table<T extends { id: string }> {
  all: () => Promise<T[]>
  get: (id: string) => Promise<T | undefined>
  put: (value: T) => Promise<T>
  remove: (id: string) => Promise<void>
}

export function table<T extends { id: string }>(name: string): Table<T> {
  return {
    all: async () => (await entries<string, T>(store(name))).map(([, v]) => v),
    get: (id) => get<T>(id, store(name)),
    put: async (value) => {
      await set(value.id, value, store(name))
      return value
    },
    remove: (id) => del(id, store(name)),
  }
}

export function uid(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`
}
