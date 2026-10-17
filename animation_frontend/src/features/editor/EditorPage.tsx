import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { motion } from 'motion/react'
import {
  ArrowLeft,
  Captions,
  Check,
  CloudOff,
  Film,
  Keyboard,
  Lightbulb,
  Mic,
  PanelLeft,
  PanelLeftClose,
  PanelRight,
  Redo2,
  Scissors,
  SlidersHorizontal,
  Sparkles,
  Type,
  Undo2,
  Upload,
  X,
} from 'lucide-react'
import { Button, IconButton, buttonClass } from '@/components/ui/button'
import { Dialog, Drawer } from '@/components/ui/dialog'
import { ErrorState, Skeleton } from '@/components/ui/misc'
import { Tabs } from '@/components/ui/tabs'
import { Tooltip } from '@/components/ui/tooltip'
import { Spinner } from '@/components/ui/spinner'
import { useBrandKits, useOwner, useProject } from '@/lib/local/hooks'
import { track } from '@/lib/analytics'
import { cn } from '@/lib/cn'
import { getEntitlements } from '@/lib/entitlements'
import { ROUTES } from '@/app/nav'
import { useSession } from '@/stores/session'
import { usePreferences } from '@/stores/preferences'
import { selectedTake, titleFromPrompt } from '@/features/videos/model'
import { startFinish } from './model/finish'
import { useBrandRender } from './finish/brand'
import { FinishInspector } from './finish/FinishInspector'
import { TakesStrip } from './finish/TakesStrip'
import { useTip } from './finish/tips'
import { posterTime } from './finish/poster'
import { brandTable, projectsTable } from '@/lib/local/models'
import { useTitle } from '@/lib/useTitle'
import { loadEngine } from '@/wasm/engine'
import { useEditor } from './store'
import { timelineOf } from './projects'
import { aspectOf, outputDuration, type AspectKey, type TimelineV2 } from './model/timelineV2'
import type { Transcript } from './model/transcript'
import { AudioPreview } from './engine/audio-preview'
import type { PreviewInfo } from './engine/preview-client'
import { Preview } from './ui/Preview'
import { Timeline as TimelineView } from './ui/Timeline'
import { Inspector } from './ui/Inspector'
import { MediaPanel } from './ui/MediaPanel'
import { loadLibrary } from './media/library'
import { TextPanel } from './ui/TextPanel'
import { CaptionsPanel } from './ui/CaptionsPanel'
import { VoicePanel } from './ui/VoicePanel'
import { ExportSheet } from './ui/ExportSheet'
import { ShortcutsDialog } from './ui/ShortcutsDialog'
import { PerfBadge } from './ui/PerfBadge'
import type { MediaAsset, Project } from '@/lib/local/models'

/** A brief pill naming the last edit ("Split", "Undo Trim end"). */
function HistoryToast() {
  const label = useEditor((st) => st.lastLabel)
  const revision = useEditor((st) => st.revision)
  if (revision === 0 || !label) return null
  return (
    <motion.div
      key={revision}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: [0, 1, 1, 0], y: [6, 0, 0, 0] }}
      transition={{ duration: 1.6, times: [0, 0.12, 0.8, 1] }}
      className="pointer-events-none fixed bottom-4 left-1/2 z-[var(--z-toast)] -translate-x-1/2 rounded-full border border-line-strong bg-surface-2 px-3 py-1 text-2xs text-fg-muted backdrop-blur-xl"
      aria-hidden
    >
      {label}
    </motion.div>
  )
}

type LeftTab = 'media' | 'text' | 'captions' | 'voice'
const SNAPSHOT = (id: string) => `animato:editor-snapshot:${id}`

// The edit-plan harness (plan 13.5): development and the e2e build only, so
// production bundles leave it out.
const PLAN_HARNESS = import.meta.env.DEV || import.meta.env.VITE_USE_MOCKS === 'true'
const DevHarness = PLAN_HARNESS ? lazy(() => import('./plan/DevHarness')) : null

function isTyping(el: EventTarget | null): boolean {
  const t = el as HTMLElement | null
  return Boolean(
    t &&
    (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) &&
    (t as HTMLInputElement).type !== 'range',
  )
}

/**
 * Saves the editor's side of a video over the stored record: takes and B-roll
 * renders added meanwhile (another tab, "Generate a clip") are kept.
 */
async function saveEdit(proj: Project, patch: Partial<Project>): Promise<void> {
  const stored = (await projectsTable.get(proj.id)) ?? proj
  await projectsTable.put({
    ...stored,
    name: proj.name,
    selectedTake: proj.selectedTake,
    assets: proj.assets,
    ...patch,
    updatedAt: Date.now(),
  })
}

function LeftPanel({
  library,
  tab,
  setTab,
}: {
  library: MediaAsset[]
  tab: LeftTab
  setTab: (t: LeftTab) => void
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-line p-2">
        <Tabs
          label="Assets"
          size="sm"
          value={tab}
          onChange={setTab}
          fill
          items={[
            { value: 'media', label: 'Media', icon: <Film /> },
            { value: 'text', label: 'Text', icon: <Type /> },
            { value: 'captions', label: 'Captions', icon: <Captions /> },
            { value: 'voice', label: 'Voice', icon: <Mic /> },
          ]}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'media' ? <MediaPanel library={library} /> : null}
        {tab === 'text' ? <TextPanel /> : null}
        {tab === 'captions' ? <CaptionsPanel /> : null}
        {tab === 'voice' ? <VoicePanel /> : null}
      </div>
    </div>
  )
}

/** Fine-tune's right panel: the clip inspector, and Finish when the video has it. */
function RightPanel({ hasFinish, onAddVoice }: { hasFinish: boolean; onAddVoice: () => void }) {
  const [tab, setTab] = useState<'clip' | 'finish'>('clip')
  if (!hasFinish) return <Inspector />
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-line p-2">
        <Tabs
          label="Inspector"
          size="sm"
          value={tab}
          onChange={setTab}
          fill
          items={[
            { value: 'clip', label: 'Clip' },
            { value: 'finish', label: 'Finish' },
          ]}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'clip' ? <Inspector /> : <FinishInspector onAddVoice={onAddVoice} />}
      </div>
    </div>
  )
}

/** First Finish visit, not yet vertical: one quiet tip (plan 12.4). */
function FormatTip({ aspect }: { aspect: AspectKey }) {
  const [show, dismiss] = useTip('format')
  if (!show || aspect === '9:16') return null
  return (
    <div
      className="m-3 flex items-start gap-2 rounded-lg border border-line bg-accent-soft px-3 py-2 text-xs"
      role="note"
    >
      <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-accent" />
      <span className="flex-1">Switch to 9:16 for Shorts.</span>
      <button
        type="button"
        className="text-fg-subtle hover:text-fg"
        onClick={dismiss}
        aria-label="Dismiss tip"
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}

export default function EditorPage({ mode = 'timeline' }: { mode?: 'finish' | 'timeline' }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const kits = useBrandKits()
  const [leftTab, setLeftTab] = useState<LeftTab>('media')
  const [railOpen, setRailOpen] = useState(false)
  const finishMode = mode === 'finish'
  const [firstReady, markFirstReady] = useTip('first-ready')
  useEffect(() => {
    if (finishMode && firstReady) markFirstReady()
    // Once per browser: marked on the first Finish visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finishMode])
  const owner = useOwner()
  const projectQuery = useProject(id)
  const timeline = useEditor((s) => s.timeline)
  const project = useEditor((s) => s.project)
  const revision = useEditor((s) => s.revision)
  const past = useEditor((s) => s.past)
  const future = useEditor((s) => s.future)
  const [library, setLibrary] = useState<MediaAsset[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [savedRevision, setSavedRevision] = useState(0)
  const [saveError, setSaveError] = useState(false)
  const [restore, setRestore] = useState<{
    timeline: TimelineV2
    transcript?: Transcript | null
    at: number
  } | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [leftOpen, setLeftOpen] = useState(false)
  const [rightOpen, setRightOpen] = useState(false)
  const [info, setInfo] = useState<PreviewInfo | null>(null)
  const audio = useMemo(() => new AudioPreview(), [])
  const forceCompositor =
    (new URLSearchParams(location.search).get('compositor') as 'webgpu' | 'canvas2d' | null) ?? undefined

  useTitle(project?.name ?? 'Editor')

  // Load the project, the WASM engine and this browser's media library.
  useEffect(() => {
    const p = projectQuery.data
    if (!p || !owner) return
    let live = true
    Promise.all([loadEngine(), loadLibrary(owner), brandTable.all()])
      .then(([engine, lib, allKits]) => {
        if (!live) return
        setLibrary(lib)
        // Already open (a mode switch, or the record changed under us: a new
        // B-roll render, a take's status): keep the document, its unsaved
        // edits and undo; take only the record's other fields.
        const open = useEditor.getState()
        if (open.project?.id === p.id && open.timeline && (!finishMode || open.timeline.finish)) {
          useEditor.setState({
            project: {
              ...p,
              name: open.project.name,
              selectedTake: open.project.selectedTake,
              assets: open.project.assets,
            },
          })
          if (finishMode) useEditor.getState().setPlayhead(posterTime(outputDuration(open.timeline)))
          return
        }
        // Timeline v1 records migrate on open (plan 10.2); the v1 document is kept as a backup.
        const { timeline: migratedTl, migrated } = timelineOf(p)
        // Finish opens with its defaults the first time (plan 6.6): the title
        // derived from the prompt, the watermark per plan, the video's format.
        let tl = migratedTl
        const take = selectedTake(p)
        if (finishMode && !tl.finish) {
          const kit = allKits.filter((k) => k.owner === owner).sort((a, b) => b.updatedAt - a.updatedAt)[0]
          tl = startFinish(
            tl,
            {
              // The user's own clip has no prompt: no title until they write one.
              title: take?.prompt ? titleFromPrompt(take.prompt) : '',
              watermark: getEntitlements(useSession.getState().user).watermark !== 'off',
              format: p.format,
              look: usePreferences.getState().defaultLook,
            },
            {
              assets: new Map(lib.map((a) => [a.id, a])),
              // Colours and font for the captions preset; the logo is registered later.
              brand: kit
                ? { kitId: kit.id, colors: kit.colors, headingFont: kit.headingFont, logo: null }
                : null,
            },
          )
          if (kit && tl.finish)
            tl = { ...tl, finish: { ...tl.finish, brand: { ...tl.finish.brand, kitId: kit.id } } }
        }
        const project = migrated || tl !== migratedTl ? { ...p, ...migrated, timeline: tl } : p
        if (project !== p) void projectsTable.put(project)
        useEditor.getState().load(project, tl, lib, engine)
        if (finishMode) {
          useEditor.getState().setPlayhead(posterTime(outputDuration(tl)))
          track('finish_open', { format: aspectOf(tl) })
        }
        try {
          const raw = localStorage.getItem(SNAPSHOT(p.id))
          const snap = raw
            ? (JSON.parse(raw) as { timeline: TimelineV2; transcript?: Transcript | null; at: number })
            : null
          if (snap && snap.timeline?.version !== 2) throw new Error('old snapshot')
          if (snap && snap.at > p.updatedAt + 1000) setRestore(snap)
        } catch {
          // unreadable snapshot: ignore
        }
      })
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : String(e)))
    return () => {
      live = false
    }
  }, [projectQuery.data, owner, finishMode])

  // The brand kit Finish names, ready for the renderer.
  const finishKitId = timeline?.finish?.brand.kitId ?? null
  const brand = useBrandRender(kits.data?.find((k) => k.id === finishKitId) ?? null)
  useEffect(() => useEditor.getState().setBrand(brand), [brand])

  const toggleMode = useCallback(() => {
    if (!id) return
    navigate(finishMode ? `${ROUTES.video(id)}?mode=timeline` : ROUTES.video(id), { replace: true })
  }, [finishMode, id, navigate])

  useEffect(
    () => () => {
      audio.close()
      useEditor.getState().reset()
    },
    [audio],
  )

  // Keep the library list in step with imports made in this session.
  const assetsMap = useEditor((s) => s.assets)
  useEffect(() => {
    if (owner) void loadLibrary(owner).then(setLibrary)
  }, [assetsMap, owner])

  // Autosave: an instant crash snapshot in localStorage, then IndexedDB.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    const s = useEditor.getState()
    if (!s.project || !s.timeline || revision === 0) return
    const proj = s.project
    const tl = s.timeline
    const transcript = s.transcript
    try {
      localStorage.setItem(SNAPSHOT(proj.id), JSON.stringify({ timeline: tl, transcript, at: Date.now() }))
    } catch {
      // storage full: the IndexedDB save below still runs
    }
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      try {
        const firstVideo = tl.clips.find((c) => s.assets.get(c.assetId)?.kind !== 'audio')
        const thumb = firstVideo ? s.assets.get(firstVideo.assetId)?.thumbnails[0] : undefined
        await saveEdit(proj, { timeline: tl, transcript, thumbnail: thumb ?? proj.thumbnail })
        localStorage.removeItem(SNAPSHOT(proj.id))
        setSavedRevision(revision)
        setSaveError(false)
      } catch {
        setSaveError(true)
      }
    }, 700)
  }, [revision])

  // Asset labels and notes are records, not edits: saved as they change, outside undo.
  const assetRefs = useEditor((st) => st.project?.assets)
  useEffect(() => {
    const proj = useEditor.getState().project
    if (!proj || !assetRefs) return
    const t = setTimeout(() => void saveEdit(proj, {}).catch(() => setSaveError(true)), 500)
    return () => clearTimeout(t)
  }, [assetRefs])

  const togglePlay = useCallback(() => {
    const s = useEditor.getState()
    if (!s.timeline) return
    if (s.playing) {
      audio.pause()
      s.setPlaying(false)
      s.setPlayhead(audio.now())
    } else {
      const end = outputDuration(s.timeline)
      const from = s.playhead >= end - 0.01 ? 0 : s.playhead
      s.setPlayhead(from)
      void audio.play(from, s.timeline, s.assets).then(() => useEditor.getState().setPlaying(true))
    }
  }, [audio])

  useEffect(() => {
    const onToggle = () => togglePlay()
    window.addEventListener('animato:toggle-play', onToggle)
    return () => window.removeEventListener('animato:toggle-play', onToggle)
  }, [togglePlay])

  // Mix changes while playing reach the worklet.
  useEffect(() => {
    const s = useEditor.getState()
    if (s.playing && s.timeline) void audio.sync(s.timeline, s.assets)
  }, [revision, audio])

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || document.querySelector('[role="dialog"]')) return
      const s = useEditor.getState()
      const mod = e.metaKey || e.ctrlKey
      const fps = s.timeline?.fps ?? 30
      const key = e.key.toLowerCase()
      if (mod && key === 'z') {
        e.preventDefault()
        if (e.shiftKey) s.redo()
        else s.undo()
      } else if (mod && key === 'y') {
        e.preventDefault()
        s.redo()
      } else if (mod && key === 'd') {
        e.preventDefault()
        if (s.selection) s.duplicate(s.selection)
      } else if (mod) {
        return
      } else if (e.key === ' ' || key === 'k') {
        e.preventDefault()
        if (key === 'k' && !s.playing) return
        togglePlay()
      } else if (key === 'l') {
        if (!s.playing) togglePlay()
      } else if (key === 'j') {
        if (s.playing) togglePlay()
        useEditor.getState().setPlayhead(useEditor.getState().playhead - 5)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        s.setPlayhead(s.playhead - 1 / fps)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        s.setPlayhead(s.playhead + 1 / fps)
      } else if (key === 's') {
        e.preventDefault()
        s.split()
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!s.selection) return
        e.preventDefault()
        if (e.shiftKey) s.rippleDelete(s.selection)
        else s.remove(s.selection)
      } else if (e.key === '+' || e.key === '=') s.setZoom(s.zoom * 1.25)
      else if (e.key === '-') s.setZoom(s.zoom / 1.25)
      else if (key === 'n') s.toggleSnapping()
      else if (key === 't' && s.project?.takes?.length) toggleMode()
      else if (e.key === '?') setShortcutsOpen(true)
      else if (e.key === 'Escape') s.select(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [togglePlay, toggleMode])

  if (projectQuery.isLoading || (projectQuery.data && !timeline && !loadError)) {
    return (
      <div className="flex h-dvh flex-col bg-canvas" aria-busy>
        <div className="flex h-12 items-center gap-3 border-b border-line px-3">
          <Skeleton className="h-6 w-40" />
        </div>
        <div className="grid flex-1 place-items-center text-fg-subtle">
          <div className="flex items-center gap-3 text-sm">
            <Spinner /> Loading the editor engine…
          </div>
        </div>
      </div>
    )
  }
  if (loadError || projectQuery.data === null || projectQuery.isError) {
    return (
      <div className="grid min-h-dvh place-items-center bg-canvas p-6">
        <ErrorState
          title={projectQuery.data === null ? 'Video not found' : 'The editor could not start'}
          body={
            loadError ??
            'This video isn’t in this browser. Videos are stored locally, so they don’t follow you to other browsers.'
          }
          action={
            <Link to="/app" className={buttonClass('secondary')}>
              Back to videos
            </Link>
          }
        />
      </div>
    )
  }
  if (!timeline || !project) return null
  const s = useEditor.getState()
  const saveState: 'saved' | 'saving' | 'error' = saveError
    ? 'error'
    : revision > savedRevision
      ? 'saving'
      : 'saved'
  const aspect = aspectOf(timeline)

  const hasTakes = Boolean(project.takes?.length)
  const leftPanel = <LeftPanel library={library} tab={leftTab} setTab={setLeftTab} />
  const openVoice = () => {
    setLeftTab('voice')
    setRailOpen(true)
    setLeftOpen(true)
  }

  return (
    <div
      className="flex h-dvh flex-col overflow-hidden bg-canvas text-fg"
      data-testid="editor"
      data-mode={mode}
    >
      {DevHarness && new URLSearchParams(location.search).get('dev') === 'plan' ? (
        <Suspense fallback={null}>
          <DevHarness />
        </Suspense>
      ) : null}
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line bg-surface-1/80 px-2 backdrop-blur-xl sm:px-3">
        <Link
          to={finishMode || !hasTakes ? '/app' : `/app/v/${project.id}`}
          className={buttonClass('ghost', 'sm', 'px-2')}
          aria-label={finishMode || !hasTakes ? 'Back to videos' : 'Back to Finish'}
        >
          <ArrowLeft className="size-4" />
          {finishMode ? <span className="hidden text-fg-muted sm:inline">Videos</span> : null}
        </Link>
        <input
          aria-label="Video title"
          defaultValue={project.name}
          key={project.id}
          onBlur={(e) => {
            const name = e.target.value.trim() || 'Untitled video'
            useEditor.setState({ project: { ...project, name } })
            void saveEdit({ ...project, name }, { timeline: useEditor.getState().timeline ?? timeline })
          }}
          className="min-w-0 max-w-56 flex-1 truncate rounded-md bg-transparent px-2 py-1 font-display text-sm font-semibold hover:bg-surface-2 focus:bg-surface-2 focus:outline-none"
        />
        <span
          className="hidden items-center gap-1 text-2xs text-fg-subtle sm:flex"
          data-testid="autosave"
          data-state={saveState}
          role="status"
        >
          {saveState === 'saving' ? (
            <Spinner className="size-3" />
          ) : saveState === 'saved' ? (
            <Check className="size-3 text-status-succeeded" />
          ) : (
            <CloudOff className="size-3 text-status-failed" />
          )}
          {saveState === 'saving' ? 'Saving' : saveState === 'saved' ? 'Saved locally' : 'Not saved'}
        </span>
        <div className="ml-auto flex items-center gap-1">
          {finishMode ? null : (
            <select
              aria-label="Aspect ratio"
              value={aspect}
              onChange={(e) => s.setFormat(e.target.value as AspectKey)}
              className="h-8 rounded-md border border-line bg-surface-2 px-2 text-xs text-fg-muted"
            >
              <option value="16:9">16:9</option>
              <option value="9:16">9:16</option>
              <option value="1:1">1:1</option>
            </select>
          )}
          <Tooltip
            content={past.length ? `Undo ${past[past.length - 1].label} (⌘Z)` : 'Nothing to undo'}
            side="bottom"
          >
            <IconButton label="Undo" size="sm" disabled={!past.length} onClick={s.undo} data-testid="undo">
              <Undo2 />
            </IconButton>
          </Tooltip>
          <Tooltip
            content={future.length ? `Redo ${future[0].label} (⌘⇧Z)` : 'Nothing to redo'}
            side="bottom"
          >
            <IconButton label="Redo" size="sm" disabled={!future.length} onClick={s.redo} data-testid="redo">
              <Redo2 />
            </IconButton>
          </Tooltip>
          {finishMode ? null : (
            <Tooltip content="Split at playhead (S)" side="bottom">
              <IconButton label="Split at playhead" size="sm" onClick={() => s.split()} data-testid="split">
                <Scissors />
              </IconButton>
            </Tooltip>
          )}
          {/* Developer detail: kept (hidden) in Finish for the e2e checks, shown in fine-tune. */}
          <span className={finishMode ? 'hidden' : 'hidden sm:contents'}>
            <PerfBadge compositor={info?.label ?? null} />
          </span>
          {hasTakes ? (
            <Tooltip
              content={finishMode ? 'Fine-tune on the timeline (T)' : 'Back to Finish (T)'}
              side="bottom"
            >
              <Button
                variant="ghost"
                size="sm"
                className="hidden min-[900px]:inline-flex"
                leftIcon={
                  finishMode ? <SlidersHorizontal className="size-3.5" /> : <Sparkles className="size-3.5" />
                }
                onClick={toggleMode}
                data-testid="toggle-mode"
              >
                {finishMode ? 'Timeline' : 'Finish'}
              </Button>
            </Tooltip>
          ) : null}
          {finishMode ? null : (
            <>
              <IconButton
                label="Keyboard shortcuts"
                size="sm"
                onClick={() => setShortcutsOpen(true)}
                className="hidden sm:inline-flex"
              >
                <Keyboard />
              </IconButton>
              <IconButton
                label="Assets panel"
                size="sm"
                className="lg:hidden"
                onClick={() => setLeftOpen(true)}
              >
                <PanelLeft />
              </IconButton>
              <IconButton
                label="Inspector"
                size="sm"
                className="xl:hidden"
                onClick={() => setRightOpen(true)}
              >
                <PanelRight />
              </IconButton>
            </>
          )}
          <Button
            size="sm"
            leftIcon={<Upload className="size-3.5" />}
            onClick={() => setExportOpen(true)}
            data-testid="open-export"
          >
            Export
          </Button>
        </div>
      </header>

      {finishMode ? null : (
        <p className="border-b border-line bg-status-warning/10 px-3 py-1.5 text-center text-2xs text-status-warning md:hidden">
          The editor works best on a desktop or tablet in landscape.
        </p>
      )}

      {finishMode ? (
        <div className="flex min-h-0 flex-1 flex-col min-[900px]:flex-row">
          <aside
            className={cn(
              'hidden shrink-0 border-r border-line bg-surface-1 min-[900px]:flex',
              railOpen ? 'w-80' : 'w-12',
            )}
            data-testid="assets-rail"
          >
            {railOpen ? (
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex h-9 items-center justify-between border-b border-line pr-1 pl-3">
                  <span className="text-2xs font-semibold tracking-wide text-fg-subtle uppercase">
                    Assets
                  </span>
                  <IconButton label="Collapse assets" size="xs" onClick={() => setRailOpen(false)}>
                    <PanelLeftClose />
                  </IconButton>
                </div>
                <div className="min-h-0 flex-1">{leftPanel}</div>
              </div>
            ) : (
              <div className="flex w-12 flex-col items-center gap-1 py-2">
                {(
                  [
                    ['media', 'Media', <Film key="m" />],
                    ['text', 'Text', <Type key="t" />],
                    ['captions', 'Captions', <Captions key="c" />],
                    ['voice', 'Voice', <Mic key="v" />],
                  ] as const
                ).map(([t, label, icon]) => (
                  <Tooltip key={t} content={label} side="right">
                    <IconButton
                      label={label}
                      size="sm"
                      onClick={() => {
                        setLeftTab(t)
                        setRailOpen(true)
                      }}
                    >
                      {icon}
                    </IconButton>
                  </Tooltip>
                ))}
              </div>
            )}
          </aside>
          <div className="flex min-h-0 min-w-0 flex-col max-[899px]:shrink-0 min-[900px]:flex-1">
            <motion.div
              className="h-[56dvh] min-h-0 min-[900px]:h-auto min-[900px]:flex-1"
              // The first video ready: a quiet scale-in, once (plan 12.4).
              initial={firstReady ? { opacity: 0, scale: 0.96 } : false}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <Preview audio={audio} onInfo={setInfo} forceCompositor={forceCompositor} />
            </motion.div>
            <div className="hidden h-24 shrink-0 border-t border-line bg-surface-1 min-[900px]:block">
              <TakesStrip />
            </div>
          </div>
          <aside className="min-h-0 flex-1 overflow-y-auto border-line bg-surface-1 min-[900px]:w-[340px] min-[900px]:flex-none min-[900px]:border-l">
            <FormatTip aspect={aspect} />
            <FinishInspector onAddVoice={openVoice} />
          </aside>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <aside className="hidden w-80 shrink-0 border-r border-line bg-surface-1 lg:block">
            {leftPanel}
          </aside>
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="min-h-0 flex-[1.15]">
              <Preview audio={audio} onInfo={setInfo} forceCompositor={forceCompositor} />
            </div>
            <div className="min-h-[190px] flex-1 border-t border-line">
              <TimelineView />
            </div>
          </div>
          <aside className="hidden w-80 shrink-0 border-l border-line bg-surface-1 xl:block">
            <RightPanel hasFinish={Boolean(timeline.finish)} onAddVoice={openVoice} />
          </aside>
        </div>
      )}

      <Drawer open={leftOpen} onClose={() => setLeftOpen(false)} title="Assets" side="left">
        {leftPanel}
      </Drawer>
      <Drawer open={rightOpen} onClose={() => setRightOpen(false)} title="Inspector">
        <RightPanel hasFinish={Boolean(timeline.finish)} onAddVoice={openVoice} />
      </Drawer>
      <ExportSheet open={exportOpen} onClose={() => setExportOpen(false)} compositor={info?.backend} />
      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <Dialog
        open={restore !== null}
        onClose={() => setRestore(null)}
        title="Restore your last session?"
        description="This project has unsaved edits from a session that ended unexpectedly."
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                localStorage.removeItem(SNAPSHOT(project.id))
                setRestore(null)
              }}
            >
              Discard
            </Button>
            <Button
              data-testid="restore-session"
              onClick={() => {
                if (restore)
                  s.run('Restore session', [
                    {
                      type: 'doc.restore',
                      timeline: restore.timeline,
                      transcript: restore.transcript ?? useEditor.getState().transcript,
                    },
                  ])
                setRestore(null)
              }}
            >
              Restore
            </Button>
          </>
        }
      >
        <p className="text-sm text-fg-muted">
          Saved {restore ? new Date(restore.at).toLocaleString() : ''}. Restoring keeps undo available, so you
          can step back.
        </p>
      </Dialog>
      <HistoryToast />
    </div>
  )
}
