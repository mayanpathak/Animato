import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import {
  Copy,
  FileDown,
  FolderOpen,
  LayoutGrid,
  List,
  PencilLine,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Tag as TagIcon,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Button, IconButton, buttonClass } from '@/components/ui/button'
import { Select } from '@/components/ui/field'
import { EmptyState, ErrorState, Kbd, Skeleton } from '@/components/ui/misc'
import { Tabs, UnderlineTabs } from '@/components/ui/tabs'
import type { MenuItem } from '@/components/ui/menu'
import { keys, useExportHistory, useMediaLibrary, useOwner, useProjects } from '@/lib/local/hooks'
import type { Project } from '@/lib/local/models'
import { cn } from '@/lib/cn'
import { errorMessage } from '@/lib/api/http'
import { spring } from '@/lib/motion'
import { useTitle } from '@/lib/useTitle'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { toast } from '@/stores/toast'
import { useProjectActions } from './actions'
import { SORT_LABELS, sortProjects, type SortKey } from './lib'
import { exportProjectFile, importProjectFile, ProjectFileError } from './projectFile'
import { ProjectCard, ProjectRow } from './components/ProjectCard'
import { NewProjectDialog } from './components/NewProjectDialog'
import { ConfirmDialog, RenameDialog, TagsDialog } from './components/ProjectDialogs'
import { MediaSection } from './components/MediaSection'
import { ExportsSection } from './components/ExportsSection'

type Section = 'projects' | 'media' | 'exports'
type View = 'grid' | 'list'

const VIEW_KEY = 'animato:projects-view'

function readView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid'
  } catch {
    return 'grid'
  }
}

function Count({ n }: { n: number | undefined }) {
  if (n === undefined) return null
  return (
    <span className="rounded-full bg-surface-3 px-1.5 font-mono text-2xs text-fg-subtle tabular-nums">
      {n}
    </span>
  )
}

export default function ProjectsPage() {
  useTitle('Projects')
  const [params, setParams] = useSearchParams()
  const section = (
    ['media', 'exports'].includes(params.get('tab') ?? '') ? params.get('tab') : 'projects'
  ) as Section
  const newOpen = params.get('new') === '1'

  const projects = useProjects()
  const media = useMediaLibrary()
  const exportsQ = useExportHistory()

  const setSection = (s: Section) =>
    setParams(
      (p) => {
        if (s === 'projects') p.delete('tab')
        else p.set('tab', s)
        return p
      },
      { replace: true },
    )
  const setNewOpen = useCallback(
    (open: boolean) =>
      setParams(
        (p) => {
          if (open) p.set('new', '1')
          else p.delete('new')
          return p
        },
        { replace: !open },
      ),
    [setParams],
  )

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold tracking-tight">Library</h1>
          <p className="mt-1 text-sm text-fg-muted">
            Projects, media and exports, kept in this browser. Nothing here is uploaded.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ImportButton />
          <Button
            leftIcon={<Plus className="size-4" />}
            onClick={() => setNewOpen(true)}
            data-testid="projects-new"
          >
            New project
          </Button>
        </div>
      </header>

      <UnderlineTabs
        label="Library sections"
        className="mt-6"
        value={section}
        onChange={setSection}
        items={[
          {
            value: 'projects',
            label: (
              <>
                Projects <Count n={projects.data?.length} />
              </>
            ),
          },
          {
            value: 'media',
            label: (
              <>
                Media <Count n={media.data?.length} />
              </>
            ),
          },
          {
            value: 'exports',
            label: (
              <>
                Exports <Count n={exportsQ.data?.length} />
              </>
            ),
          },
        ]}
      />

      <div className="mt-6">
        {section === 'projects' ? <ProjectsSection onNew={() => setNewOpen(true)} /> : null}
        {section === 'media' ? <MediaSection /> : null}
        {section === 'exports' ? <ExportsSection /> : null}
      </div>

      <NewProjectDialog open={newOpen} onClose={() => setNewOpen(false)} />
    </div>
  )
}

function ImportButton() {
  const owner = useOwner()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const onChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      const { project, offline, relinked } = await importProjectFile(file, owner)
      await qc.invalidateQueries({ queryKey: keys.projects(owner) })
      const notes = [
        relinked ? `${relinked} media ${relinked === 1 ? 'file' : 'files'} relinked from this browser.` : '',
        offline
          ? `${offline} media ${offline === 1 ? 'file is' : 'files are'} offline: import ${offline === 1 ? 'it' : 'them'} in the editor to relink.`
          : '',
      ].filter(Boolean)
      toast.success(`Imported “${project.name}”`, notes.join(' ') || undefined)
      navigate('/app/projects', { replace: true })
    } catch (err) {
      toast.error(
        'Could not import that file',
        err instanceof ProjectFileError ? err.message : errorMessage(err),
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <label
      data-testid="projects-import"
      className={buttonClass(
        'secondary',
        'md',
        cn(
          'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-ring',
          busy && 'pointer-events-none opacity-60',
        ),
      )}
      title="Import a .animato.json project file"
    >
      <input
        type="file"
        accept=".json,application/json"
        className="sr-only"
        onChange={onChange}
        disabled={busy}
        aria-label="Import project file"
      />
      <Upload className="size-4" aria-hidden />
      <span className="hidden sm:inline">Import</span>
    </label>
  )
}

function ProjectsSection({ onNew }: { onNew: () => void }) {
  const projects = useProjects()
  const actions = useProjectActions()
  const navigate = useNavigate()
  const reduced = useReducedMotion()
  const searchRef = useRef<HTMLInputElement>(null)

  const [view, setViewState] = useState<View>(readView)
  const [query, setQuery] = useState('')
  const [activeTags, setActiveTags] = useState<string[]>([])
  const [sort, setSort] = useState<SortKey>('updated')
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const anchor = useRef<string | null>(null)

  const [renaming, setRenaming] = useState<Project | null>(null)
  const [tagging, setTagging] = useState<Project | null>(null)
  const [bulkTagging, setBulkTagging] = useState(false)
  const [deleting, setDeleting] = useState<Project[] | null>(null)

  const setView = (v: View) => {
    setViewState(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {
      // per-viewer convenience only
    }
  }

  const all = useMemo(() => projects.data ?? [], [projects.data])
  const allTags = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of all) for (const t of p.tags) counts.set(t, (counts.get(t) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  }, [all])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = all.filter((p) => {
      if (activeTags.some((t) => !p.tags.includes(t))) return false
      if (!q) return true
      return p.name.toLowerCase().includes(q) || p.tags.some((t) => t.includes(q))
    })
    return sortProjects(filtered, sort)
  }, [all, query, activeTags, sort])

  // Drop selections that no longer exist.
  const selectedProjects = useMemo(() => all.filter((p) => selected.has(p.id)), [all, selected])
  const selecting = selectedProjects.length > 0

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const typing = target.closest('input,textarea,select,[contenteditable="true"]')
      if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        searchRef.current?.focus()
      }
      if (e.key === 'Escape' && !typing && !document.querySelector('[role="dialog"]')) {
        setSelected(new Set())
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const toggle = (id: string, shift: boolean) => {
    // The updater runs later, so read the anchor now.
    const from = anchor.current
    setSelected((prev) => {
      const next = new Set(prev)
      if (shift && from) {
        const a = visible.findIndex((p) => p.id === from)
        const b = visible.findIndex((p) => p.id === id)
        if (a !== -1 && b !== -1) {
          const [lo, hi] = a < b ? [a, b] : [b, a]
          for (const p of visible.slice(lo, hi + 1)) next.add(p.id)
          return next
        }
      }
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    anchor.current = id
  }

  const menuFor = (p: Project): (MenuItem | 'separator')[] => [
    { label: 'Open', icon: <FolderOpen />, onSelect: () => navigate(`/app/projects/${p.id}/edit`) },
    { label: 'Rename', icon: <PencilLine />, onSelect: () => setRenaming(p) },
    {
      label: 'Duplicate',
      icon: <Copy />,
      onSelect: async () => {
        try {
          const copy = await actions.duplicate(p)
          toast.success('Project duplicated', copy.name)
        } catch (e) {
          toast.error('Could not duplicate', errorMessage(e))
        }
      },
    },
    { label: 'Edit tags', icon: <TagIcon />, onSelect: () => setTagging(p) },
    {
      label: 'Export project file',
      icon: <FileDown />,
      onSelect: async () => {
        try {
          await exportProjectFile(p)
          toast.success('Project file downloaded', 'Media files stay in this browser and are not included.')
        } catch (e) {
          toast.error('Could not export the project file', errorMessage(e))
        }
      },
    },
    'separator',
    { label: 'Delete', icon: <Trash2 />, danger: true, onSelect: () => setDeleting([p]) },
  ]

  const toggleTag = (t: string) =>
    setActiveTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))

  if (projects.isPending) {
    return (
      <div aria-busy>
        <div className="mb-5 flex gap-2">
          <Skeleton className="h-9 flex-1 sm:max-w-sm" />
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-9 w-20" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-line bg-surface-1">
              <Skeleton className="aspect-video rounded-none" />
              <div className="flex flex-col gap-2 p-3.5">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (projects.isError) {
    return (
      <ErrorState
        title="Could not open your projects"
        body="This browser's storage did not answer. Private windows and some privacy settings block IndexedDB."
        action={
          <Button
            variant="secondary"
            leftIcon={<RefreshCw className="size-4" />}
            onClick={() => projects.refetch()}
          >
            Try again
          </Button>
        }
      />
    )
  }

  if (all.length === 0) {
    return (
      <EmptyState
        icon={<Sparkles />}
        title="No projects yet"
        body="Describe an animation and Animato renders it, or start from an empty timeline and bring your own media."
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link to="/app/create" className={buttonClass('primary', 'md')}>
              <Sparkles className="size-4" /> Create from prompt
            </Link>
            <Button variant="secondary" leftIcon={<Plus className="size-4" />} onClick={onNew}>
              New empty project
            </Button>
          </div>
        }
        className="py-20"
      />
    )
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle"
            aria-hidden
          />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search names and tags"
            aria-label="Search projects"
            data-testid="projects-search"
            className="h-9 w-full rounded-md border border-line-strong bg-surface-1 pr-9 pl-9 text-sm text-fg shadow-inner-highlight transition-[border-color,box-shadow] placeholder:text-fg-faint hover:border-fg-faint/60 focus:border-accent focus:ring-3 focus:ring-accent-soft focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {query ? (
            <IconButton
              label="Clear search"
              size="xs"
              className="absolute top-1/2 right-1.5 -translate-y-1/2"
              onClick={() => setQuery('')}
            >
              <X />
            </IconButton>
          ) : (
            <Kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 sm:inline-flex">
              /
            </Kbd>
          )}
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <label className="sr-only" htmlFor="projects-sort">
            Sort by
          </label>
          <Select
            id="projects-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="min-w-0 flex-1 sm:w-40 sm:flex-none"
          >
            {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
              <option key={k} value={k}>
                {SORT_LABELS[k]}
              </option>
            ))}
          </Select>
          <Tabs<View>
            label="View"
            value={view}
            onChange={setView}
            items={[
              {
                value: 'grid',
                label: (
                  <span data-testid="projects-view-grid" className="inline-flex items-center gap-1.5">
                    <LayoutGrid aria-hidden /> <span className="sr-only sm:not-sr-only">Grid</span>
                  </span>
                ),
              },
              {
                value: 'list',
                label: (
                  <span data-testid="projects-view-list" className="inline-flex items-center gap-1.5">
                    <List aria-hidden /> <span className="sr-only sm:not-sr-only">List</span>
                  </span>
                ),
              },
            ]}
          />
        </div>
      </div>

      {allTags.length ? (
        <div
          className="-mx-4 mt-3 flex items-center gap-1.5 overflow-x-auto px-4 pb-1 no-scrollbar sm:mx-0 sm:flex-wrap sm:px-0"
          aria-label="Filter by tag"
          role="group"
        >
          {allTags.map(([t, n]) => {
            const on = activeTags.includes(t)
            return (
              <button
                key={t}
                type="button"
                aria-pressed={on}
                onClick={() => toggleTag(t)}
                className={cn(
                  'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors',
                  on
                    ? 'border-accent/50 bg-accent-soft text-fg'
                    : 'border-line bg-surface-1 text-fg-muted hover:border-line-strong hover:text-fg',
                )}
              >
                <TagIcon className="size-3" aria-hidden />
                {t}
                <span className="font-mono text-2xs text-fg-subtle">{n}</span>
              </button>
            )
          })}
          {activeTags.length ? (
            <button
              type="button"
              onClick={() => setActiveTags([])}
              className="h-7 shrink-0 px-2 text-xs text-fg-subtle hover:text-fg"
            >
              Clear
            </button>
          ) : null}
        </div>
      ) : null}

      <p className="sr-only" aria-live="polite">
        {visible.length} {visible.length === 1 ? 'project' : 'projects'} shown
      </p>

      <div className="mt-5">
        {visible.length === 0 ? (
          <EmptyState
            icon={<Search />}
            title="Nothing matches"
            body={
              query
                ? `No project name or tag contains “${query.trim()}”${activeTags.length ? ' with the selected tags' : ''}.`
                : 'No project has all the selected tags.'
            }
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setQuery('')
                  setActiveTags([])
                }}
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          <motion.div
            layout={!reduced}
            className={cn(
              view === 'grid'
                ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4'
                : 'flex flex-col gap-0.5',
            )}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              {visible.map((p) => {
                const item = {
                  project: p,
                  selected: selected.has(p.id),
                  selecting,
                  onToggle: (shift: boolean) => toggle(p.id, shift),
                  menu: menuFor(p),
                }
                return (
                  <motion.div
                    key={`${view}-${p.id}`}
                    layout={reduced ? false : 'position'}
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={reduced ? { duration: 0 } : spring.layout}
                    className="min-w-0"
                  >
                    {view === 'grid' ? <ProjectCard {...item} /> : <ProjectRow {...item} />}
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      <p className={cn('mt-8 text-center text-xs text-fg-subtle', selecting && 'pb-20')}>
        Tip: shift-click to select a range. Project files (.animato.json) carry the timeline and media
        details; the media files themselves stay in this browser.
      </p>

      <AnimatePresence>
        {selecting ? (
          <motion.div
            role="toolbar"
            aria-label="Selected projects"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={spring.snappy}
            className="fixed inset-x-4 bottom-4 z-[var(--z-sticky)] mx-auto flex max-w-md items-center gap-1 rounded-xl border border-line-strong bg-glass-strong p-1.5 pl-3.5 shadow-lg backdrop-blur-xl"
          >
            <span className="mr-auto text-sm font-medium tabular-nums">
              {selectedProjects.length} selected
            </span>
            {selectedProjects.length < visible.length ? (
              <Button
                variant="ghost"
                size="sm"
                className="hidden sm:inline-flex"
                onClick={() => setSelected(new Set(visible.map((p) => p.id)))}
              >
                Select all
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<TagIcon className="size-3.5" />}
              onClick={() => setBulkTagging(true)}
            >
              Tag
            </Button>
            <Button
              variant="danger"
              size="sm"
              leftIcon={<Trash2 className="size-3.5" />}
              onClick={() => setDeleting(selectedProjects)}
            >
              Delete
            </Button>
            <IconButton label="Clear selection" size="sm" onClick={() => setSelected(new Set())}>
              <X />
            </IconButton>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <RenameDialog
        open={renaming !== null}
        onClose={() => setRenaming(null)}
        initial={renaming?.name ?? ''}
        onSave={async (name) => {
          if (renaming) await actions.rename(renaming, name)
        }}
      />
      <TagsDialog
        open={tagging !== null}
        onClose={() => setTagging(null)}
        title="Edit tags"
        description={tagging?.name}
        initial={tagging?.tags ?? []}
        suggestions={allTags.map(([t]) => t)}
        onSave={async (tags) => {
          if (tagging) await actions.setTags(tagging, tags)
        }}
      />
      <TagsDialog
        open={bulkTagging}
        onClose={() => setBulkTagging(false)}
        title={`Tag ${selectedProjects.length} ${selectedProjects.length === 1 ? 'project' : 'projects'}`}
        description="These tags are added; existing tags are kept."
        initial={[]}
        suggestions={allTags.map(([t]) => t)}
        saveLabel="Add tags"
        onSave={async (tags) => {
          await actions.addTags(selectedProjects, tags)
          toast.success('Tags added')
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={
          deleting && deleting.length > 1 ? `Delete ${deleting.length} projects?` : 'Delete this project?'
        }
        confirmLabel="Delete"
        body={
          <p>
            {deleting && deleting.length === 1 ? (
              <>
                <span className="font-medium text-fg">{deleting[0].name}</span> and its timeline will be
                removed from this browser.
              </>
            ) : (
              <>The selected projects and their timelines will be removed from this browser.</>
            )}{' '}
            Media in your library is shared between projects and is kept. This cannot be undone.
          </p>
        }
        onConfirm={async () => {
          if (!deleting) return
          await actions.remove(deleting.map((p) => p.id))
          setSelected((prev) => {
            const next = new Set(prev)
            for (const p of deleting) next.delete(p.id)
            return next
          })
          toast.success(deleting.length > 1 ? `${deleting.length} projects deleted` : 'Project deleted')
        }}
      />
    </div>
  )
}
