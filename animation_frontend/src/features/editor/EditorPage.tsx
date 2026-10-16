import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'motion/react'
import {
  ArrowLeft,
  Captions,
  Check,
  CloudOff,
  Film,
  Keyboard,
  Mic,
  PanelLeft,
  PanelRight,
  Redo2,
  Scissors,
  Type,
  Undo2,
  Upload,
} from 'lucide-react'
import { Button, IconButton, buttonClass } from '@/components/ui/button'
import { Dialog, Drawer } from '@/components/ui/dialog'
import { ErrorState, Skeleton } from '@/components/ui/misc'
import { Tabs } from '@/components/ui/tabs'
import { Tooltip } from '@/components/ui/tooltip'
import { Spinner } from '@/components/ui/spinner'
import { useOwner, useProject } from '@/lib/local/hooks'
import { projectsTable } from '@/lib/local/models'
import { useTitle } from '@/lib/useTitle'
import { loadEngine } from '@/wasm/engine'
import { useEditor } from './store'
import { timelineOf } from './projects'
import { ASPECT_PRESETS, aspectOf, outputDuration, type AspectKey, type TimelineV2 } from './model/timelineV2'
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
import { ExportDialog } from './ui/ExportDialog'
import { ShortcutsDialog } from './ui/ShortcutsDialog'
import { PerfBadge } from './ui/PerfBadge'
import type { MediaAsset } from '@/lib/local/models'

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

function isTyping(el: EventTarget | null): boolean {
  const t = el as HTMLElement | null
  return Boolean(
    t &&
    (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) &&
    (t as HTMLInputElement).type !== 'range',
  )
}

function LeftPanel({ library }: { library: MediaAsset[] }) {
  const [tab, setTab] = useState<LeftTab>('media')
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-line p-2">
        <Tabs
          label="Assets"
          size="sm"
          value={tab}
          onChange={setTab}
          className="w-full justify-between"
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

export default function EditorPage() {
  const { id } = useParams()
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
    Promise.all([loadEngine(), loadLibrary(owner)])
      .then(([engine, lib]) => {
        if (!live) return
        setLibrary(lib)
        // Timeline v1 records migrate on open (plan 10.2); the v1 document is kept as a backup.
        const { timeline: tl, migrated } = timelineOf(p)
        const project = migrated ? { ...p, ...migrated, timeline: tl } : p
        if (migrated) void projectsTable.put(project)
        useEditor.getState().load(project, tl, lib, engine)
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
  }, [projectQuery.data, owner])

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
        await projectsTable.put({
          ...proj,
          timeline: tl,
          transcript,
          thumbnail: thumb ?? proj.thumbnail,
          updatedAt: Date.now(),
        })
        localStorage.removeItem(SNAPSHOT(proj.id))
        setSavedRevision(revision)
        setSaveError(false)
      } catch {
        setSaveError(true)
      }
    }, 700)
  }, [revision])

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
      else if (e.key === '?') setShortcutsOpen(true)
      else if (e.key === 'Escape') s.select(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [togglePlay])

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

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-canvas text-fg" data-testid="editor">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line bg-surface-1/80 px-2 backdrop-blur-xl sm:px-3">
        <Link
          to={project.takes?.length ? `/app/v/${project.id}` : '/app'}
          className={buttonClass('ghost', 'sm', 'px-2')}
          aria-label={project.takes?.length ? 'Back to the video' : 'Back to videos'}
        >
          <ArrowLeft className="size-4" />
        </Link>
        <input
          aria-label="Video title"
          defaultValue={project.name}
          key={project.id}
          onBlur={(e) => {
            const name = e.target.value.trim() || 'Untitled video'
            useEditor.setState({ project: { ...project, name } })
            void projectsTable.put({
              ...project,
              name,
              timeline: useEditor.getState().timeline ?? timeline,
              updatedAt: Date.now(),
            })
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
          <select
            aria-label="Aspect ratio"
            value={aspect}
            onChange={(e) => s.updateTimeline(ASPECT_PRESETS[e.target.value as AspectKey], 'Change aspect')}
            className="h-8 rounded-md border border-line bg-surface-2 px-2 text-xs text-fg-muted"
          >
            <option value="16:9">16:9</option>
            <option value="9:16">9:16</option>
            <option value="1:1">1:1</option>
          </select>
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
          <Tooltip content="Split at playhead (S)" side="bottom">
            <IconButton label="Split at playhead" size="sm" onClick={() => s.split()} data-testid="split">
              <Scissors />
            </IconButton>
          </Tooltip>
          <PerfBadge compositor={info?.label ?? null} />
          <IconButton
            label="Keyboard shortcuts"
            size="sm"
            onClick={() => setShortcutsOpen(true)}
            className="hidden sm:inline-flex"
          >
            <Keyboard />
          </IconButton>
          <IconButton label="Assets panel" size="sm" className="lg:hidden" onClick={() => setLeftOpen(true)}>
            <PanelLeft />
          </IconButton>
          <IconButton label="Inspector" size="sm" className="xl:hidden" onClick={() => setRightOpen(true)}>
            <PanelRight />
          </IconButton>
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

      <p className="border-b border-line bg-status-warning/10 px-3 py-1.5 text-center text-2xs text-status-warning md:hidden">
        The editor works best on a desktop or tablet in landscape.
      </p>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-80 shrink-0 border-r border-line bg-surface-1 lg:block">
          <LeftPanel library={library} />
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
          <Inspector />
        </aside>
      </div>

      <Drawer open={leftOpen} onClose={() => setLeftOpen(false)} title="Assets" side="left">
        <LeftPanel library={library} />
      </Drawer>
      <Drawer open={rightOpen} onClose={() => setRightOpen(false)} title="Inspector">
        <Inspector />
      </Drawer>
      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} compositor={info?.backend} />
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
                  s.apply('Restore session', (d) => ({
                    timeline: restore.timeline,
                    transcript: restore.transcript ?? d.transcript,
                  }))
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
