// Local mutations for the projects library. Everything writes to IndexedDB /
// OPFS in this browser and then refreshes the matching React Query caches.
import { useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { keys, useOwner } from '@/lib/local/hooks'
import {
  exportsTable,
  mediaTable,
  projectsTable,
  uid,
  type ExportRecord,
  type MediaAsset,
  type Project,
} from '@/lib/local/models'
import { removeFile } from '@/lib/local/opfs'
import { normalizeTag } from './lib'

export function useProjectActions() {
  const qc = useQueryClient()
  const owner = useOwner()

  return useMemo(() => {
    const refreshProjects = () => qc.invalidateQueries({ queryKey: keys.projects(owner) })
    const refreshStorage = () => qc.invalidateQueries({ queryKey: ['storage'] })

    return {
      async rename(p: Project, name: string) {
        const next = { ...p, name: name.trim(), updatedAt: Date.now() }
        await projectsTable.put(next)
        qc.setQueryData(keys.project(p.id), next)
        await refreshProjects()
      },

      async duplicate(p: Project): Promise<Project> {
        const now = Date.now()
        const copy: Project = {
          ...structuredClone(p),
          id: uid('prj'),
          owner,
          name: `${p.name} (copy)`,
          createdAt: now,
          updatedAt: now,
        }
        await projectsTable.put(copy)
        await refreshProjects()
        return copy
      },

      async setTags(p: Project, tags: string[]) {
        const next = {
          ...p,
          tags: [...new Set(tags.map(normalizeTag).filter(Boolean))],
          updatedAt: Date.now(),
        }
        await projectsTable.put(next)
        qc.setQueryData(keys.project(p.id), next)
        await refreshProjects()
      },

      async addTags(list: Project[], tags: string[]) {
        const add = tags.map(normalizeTag).filter(Boolean)
        for (const p of list) {
          await projectsTable.put({ ...p, tags: [...new Set([...p.tags, ...add])], updatedAt: Date.now() })
        }
        await refreshProjects()
      },

      /** Deletes project records only; media in the library is shared and stays. */
      async remove(ids: string[]) {
        for (const id of ids) {
          await projectsTable.remove(id)
          qc.removeQueries({ queryKey: keys.project(id) })
        }
        await refreshProjects()
      },

      async removeMedia(asset: MediaAsset) {
        await removeFile(asset.path)
        await mediaTable.remove(asset.id)
        await qc.invalidateQueries({ queryKey: keys.media(owner) })
        void refreshStorage()
      },

      async removeExport(record: ExportRecord) {
        await removeFile(record.path)
        await exportsTable.remove(record.id)
        await qc.invalidateQueries({ queryKey: keys.exports(owner) })
        void refreshStorage()
      },

      refreshProjects,
    }
  }, [qc, owner])
}
