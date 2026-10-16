import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Eraser, HardDrive, Keyboard, LogOut, SlidersHorizontal, Trash2, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, Badge, Card, Kbd, Progress, Skeleton, Switch } from '@/components/ui/misc'
import { Tabs, UnderlineTabs } from '@/components/ui/tabs'
import { errorMessage } from '@/lib/api/http'
import { formatBytes, formatDate, formatNumber, timeAgo } from '@/lib/format'
import {
  keys,
  useBrandKits,
  useExportHistory,
  useJobHistory,
  useMediaLibrary,
  useOwner,
  useProjects,
} from '@/lib/local/hooks'
import { storageUsage } from '@/lib/local/opfs'
import { fadeUp } from '@/lib/motion'
import { useTitle } from '@/lib/useTitle'
import { usePreferences, type Density } from '@/stores/preferences'
import { useSession } from '@/stores/session'
import { toast } from '@/stores/toast'
import { ConfirmDialog } from '@/features/projects/components/ProjectDialogs'
import { clearPreviewCache, deleteAllExports, deleteEverythingLocal, previewCacheBytes } from './storage'

type Tab = 'profile' | 'preferences' | 'storage'
const TABS: Tab[] = ['profile', 'preferences', 'storage']

function tabLabel(tab: Tab, icon: ReactNode, text: string) {
  return (
    <span data-testid={`settings-tab-${tab}`} className="inline-flex items-center gap-1.5">
      {icon}
      {text}
    </span>
  )
}

export default function SettingsPage() {
  useTitle('Settings')
  const [params, setParams] = useSearchParams()
  const raw = params.get('tab') as Tab | null
  const tab: Tab = raw && TABS.includes(raw) ? raw : 'profile'
  const setTab = (t: Tab) =>
    setParams(
      (p) => {
        if (t === 'profile') p.delete('tab')
        else p.set('tab', t)
        return p
      },
      { replace: true },
    )

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Your account, how Animato feels, and what this browser keeps.
        </p>
      </header>

      <UnderlineTabs<Tab>
        label="Settings sections"
        className="mt-6"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'profile', label: tabLabel('profile', <UserRound className="size-4" />, 'Profile') },
          {
            value: 'preferences',
            label: tabLabel('preferences', <SlidersHorizontal className="size-4" />, 'Preferences'),
          },
          { value: 'storage', label: tabLabel('storage', <HardDrive className="size-4" />, 'Storage') },
        ]}
      />

      <div className="mt-8 max-w-3xl">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={tab} {...fadeUp} role="tabpanel" aria-label={tab}>
            {tab === 'profile' ? <ProfileTab /> : null}
            {tab === 'preferences' ? <PreferencesTab /> : null}
            {tab === 'storage' ? <StorageTab /> : null}
          </motion.div>
        </AnimatePresence>
        <p className="mt-10 text-xs text-fg-subtle">Team workspaces and billing are coming soon.</p>
      </div>
    </div>
  )
}

function Row({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-t border-line px-5 py-4 first:border-t-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <div className="text-sm font-medium text-fg">{label}</div>
        {hint ? <p className="mt-0.5 text-xs text-fg-subtle">{hint}</p> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function SectionTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-3">
      <h2 className="font-display text-lg font-semibold tracking-tight text-fg">{children}</h2>
      {hint ? <p className="mt-0.5 text-sm text-fg-muted">{hint}</p> : null}
    </div>
  )
}

/* ---------------------------------- Profile --------------------------------- */

function ProfileTab() {
  const user = useSession((s) => s.user)
  const logout = useSession((s) => s.logout)
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  if (!user) return null

  const onLogout = async () => {
    setBusy(true)
    try {
      await logout()
      navigate('/login')
    } catch (e) {
      toast.error('Could not log out', errorMessage(e))
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <Card className="overflow-hidden">
        <div className="flex items-center gap-4 border-b border-line bg-gradient-accent-soft px-5 py-5">
          <Avatar name={user.username} size={52} />
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-semibold tracking-tight">{user.username}</p>
            <p className="truncate text-sm text-fg-muted">{user.email}</p>
          </div>
          <Badge tone={user.isVerified ? 'succeeded' : 'neutral'} className="ml-auto hidden sm:inline-flex">
            {user.isVerified ? 'Verified' : 'Unverified'}
          </Badge>
        </div>
        <dl className="grid sm:grid-cols-2">
          {[
            { k: 'Username', v: user.username },
            { k: 'Email', v: user.email },
            { k: 'Member since', v: user.createdAt ? formatDate(user.createdAt) : '–' },
            { k: 'Last login', v: user.lastLogin ? timeAgo(user.lastLogin) : '–' },
          ].map((row) => (
            <div
              key={row.k}
              className="border-t border-line px-5 py-3.5 sm:[&:nth-child(-n+2)]:border-t-0 max-sm:first:border-t-0"
            >
              <dt className="text-xs text-fg-subtle">{row.k}</dt>
              <dd className="mt-0.5 truncate text-sm text-fg">{row.v}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <p className="-mt-5 text-xs text-fg-subtle">
        Your username and email come from your account and are read-only here.
      </p>

      <div>
        <SectionTitle hint="Signs this browser out. Your local projects stay here for the next time you sign in.">
          Session
        </SectionTitle>
        <Button
          variant="secondary"
          leftIcon={<LogOut className="size-4" />}
          loading={busy}
          onClick={onLogout}
        >
          Log out
        </Button>
      </div>
    </div>
  )
}

/* -------------------------------- Preferences ------------------------------- */

const SHORTCUTS: { keys: string[][]; action: string; where: string }[] = [
  { keys: [['⌘', 'K']], action: 'Open the command palette', where: 'Anywhere' },
  { keys: [['Space']], action: 'Play / pause', where: 'Editor' },
  { keys: [['J'], ['K'], ['L']], action: 'Shuttle back, pause, forward', where: 'Editor' },
  { keys: [['S']], action: 'Split clip at playhead', where: 'Editor' },
  { keys: [['Delete']], action: 'Delete selected clip', where: 'Editor' },
  { keys: [['⌘', 'Z']], action: 'Undo', where: 'Editor' },
  { keys: [['⌘', '⇧', 'Z']], action: 'Redo', where: 'Editor' },
  { keys: [['?']], action: 'Show the shortcut cheat sheet', where: 'Editor' },
]

function PreferencesTab() {
  const density = usePreferences((s) => s.density)
  const setDensity = usePreferences((s) => s.setDensity)
  const reducedMotion = usePreferences((s) => s.reducedMotion)
  const setReducedMotion = usePreferences((s) => s.setReducedMotion)
  const fps = usePreferences((s) => s.editorFps)
  const setFps = usePreferences((s) => s.setEditorFps)

  return (
    <div className="flex flex-col gap-8">
      <div>
        <SectionTitle hint="Saved in this browser.">Interface</SectionTitle>
        <Card>
          <Row
            label="Density"
            hint="Compact fits more on screen; comfortable gives everything room to breathe."
          >
            <div data-testid="settings-density">
              <Tabs<Density>
                label="Density"
                size="sm"
                value={density}
                onChange={setDensity}
                items={[
                  { value: 'comfortable', label: 'Comfortable' },
                  { value: 'compact', label: 'Compact' },
                ]}
              />
            </div>
          </Row>
          <Row
            label={<label htmlFor="pref-reduced-motion">Reduce motion</label>}
            hint="Turns off transitions and animated previews. Your system setting is always respected too."
          >
            <span data-testid="settings-reduced-motion" className="inline-flex">
              <Switch
                id="pref-reduced-motion"
                label="Reduce motion"
                checked={reducedMotion}
                onChange={setReducedMotion}
              />
            </span>
          </Row>
          <Row
            label="Editor preview frame rate"
            hint="60 fps is smoother; 30 fps is easier on battery and older GPUs."
          >
            <Tabs<'30' | '60'>
              label="Editor preview frame rate"
              size="sm"
              value={String(fps) as '30' | '60'}
              onChange={(v) => setFps(v === '60' ? 60 : 30)}
              items={[
                { value: '30', label: <span className="font-mono">30 fps</span> },
                { value: '60', label: <span className="font-mono">60 fps</span> },
              ]}
            />
          </Row>
        </Card>
      </div>

      <div>
        <SectionTitle hint="On Windows and Linux, use Ctrl for ⌘.">
          <span className="inline-flex items-center gap-2">
            <Keyboard className="size-4 text-fg-subtle" aria-hidden /> Keyboard shortcuts
          </span>
        </SectionTitle>
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="sr-only">
              <tr>
                <th scope="col">Action</th>
                <th scope="col">Where</th>
                <th scope="col">Keys</th>
              </tr>
            </thead>
            <tbody>
              {SHORTCUTS.map((s) => (
                <tr key={s.action} className="border-t border-line first:border-t-0">
                  <td className="px-5 py-3 text-fg">{s.action}</td>
                  <td className="hidden px-2 py-3 text-xs text-fg-subtle sm:table-cell">{s.where}</td>
                  <td className="px-5 py-3 text-right">
                    <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
                      {s.keys.map((combo, i) => (
                        <span key={i} className="inline-flex items-center gap-0.5">
                          {combo.map((k) => (
                            <Kbd key={k}>{k}</Kbd>
                          ))}
                        </span>
                      ))}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  )
}

/* ---------------------------------- Storage --------------------------------- */

function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="bg-surface-1 px-4 py-3.5">
      <p className="text-xs text-fg-subtle">{label}</p>
      <p className="mt-1 font-display text-xl font-semibold tracking-tight tabular-nums">{value}</p>
      {sub ? <p className="mt-0.5 font-mono text-2xs text-fg-subtle">{sub}</p> : null}
    </div>
  )
}

function StorageTab() {
  const owner = useOwner()
  const qc = useQueryClient()
  const usage = useQuery({ queryKey: ['storage'], queryFn: storageUsage })
  const projects = useProjects()
  const media = useMediaLibrary()
  const exportsQ = useExportHistory()
  const brand = useBrandKits()
  const jobs = useJobHistory()
  const [busy, setBusy] = useState<'cache' | null>(null)
  const [confirm, setConfirm] = useState<'exports' | 'everything' | null>(null)

  const mediaBytes = useMemo(() => (media.data ?? []).reduce((s, a) => s + a.size, 0), [media.data])
  const exportBytes = useMemo(() => (exportsQ.data ?? []).reduce((s, a) => s + a.size, 0), [exportsQ.data])
  const cacheBytes = useMemo(() => previewCacheBytes(media.data ?? []), [media.data])
  const loading = media.isPending || exportsQ.isPending || projects.isPending

  const refreshStorage = () => qc.invalidateQueries({ queryKey: ['storage'] })

  const clearCache = async () => {
    setBusy('cache')
    try {
      const n = await clearPreviewCache(owner)
      await qc.invalidateQueries({ queryKey: keys.media(owner) })
      void refreshStorage()
      toast.success(
        n ? 'Preview cache cleared' : 'Nothing to clear',
        n ? `${n} media ${n === 1 ? 'file' : 'files'} cleaned up.` : undefined,
      )
    } catch (e) {
      toast.error('Could not clear the cache', errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const pct = usage.data?.quota ? usage.data.usage / usage.data.quota : 0

  return (
    <div className="flex flex-col gap-8">
      <div>
        <SectionTitle hint="Media originals and exports live in this browser's private file system; records live in IndexedDB.">
          This browser
        </SectionTitle>
        <Card className="p-5">
          {usage.isPending ? (
            <Skeleton className="h-12" />
          ) : usage.data && usage.data.quota > 0 ? (
            <>
              <div className="flex items-baseline justify-between gap-4">
                <p className="text-sm">
                  <span className="font-display text-2xl font-semibold tracking-tight tabular-nums">
                    {formatBytes(usage.data.usage)}
                  </span>{' '}
                  <span className="text-fg-subtle">used of {formatBytes(usage.data.quota)} available</span>
                </p>
                <span className="font-mono text-xs text-fg-subtle tabular-nums">
                  {(pct * 100).toFixed(pct < 0.01 ? 2 : 1)}%
                </span>
              </div>
              <Progress value={Math.max(pct, 0.004)} label="Local storage used" className="mt-3 h-2" />
            </>
          ) : (
            <p className="text-sm text-fg-muted">
              This browser does not report how much storage is available.
            </p>
          )}
        </Card>
        <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
          {loading ? (
            Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="bg-surface-1 px-4 py-3.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="mt-2 h-6 w-10" />
              </div>
            ))
          ) : (
            <>
              <Stat label="Projects" value={formatNumber(projects.data?.length ?? 0)} />
              <Stat
                label="Media files"
                value={formatNumber(media.data?.length ?? 0)}
                sub={formatBytes(mediaBytes)}
              />
              <Stat
                label="Exports"
                value={formatNumber(exportsQ.data?.length ?? 0)}
                sub={formatBytes(exportBytes)}
              />
              <Stat
                label="Brand kits"
                value={formatNumber(brand.data?.length ?? 0)}
                sub={`${jobs.data?.length ?? 0} jobs in history`}
              />
            </>
          )}
        </div>
      </div>

      <div>
        <SectionTitle>Clean up</SectionTitle>
        <Card>
          <Row
            label="Clear thumbnail & waveform cache"
            hint={
              <>
                Removes generated filmstrip frames and audio waveforms (about{' '}
                <span className="font-mono">{formatBytes(cacheBytes)}</span>). Original media is untouched.
              </>
            }
          >
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Eraser className="size-3.5" />}
              loading={busy === 'cache'}
              disabled={cacheBytes === 0}
              onClick={clearCache}
            >
              Clear cache
            </Button>
          </Row>
          <Row
            label="Delete all exports"
            hint={
              <>
                Frees <span className="font-mono">{formatBytes(exportBytes)}</span>. Projects are kept, so you
                can export again any time.
              </>
            }
          >
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Trash2 className="size-3.5" />}
              disabled={!exportsQ.data?.length}
              onClick={() => setConfirm('exports')}
            >
              Delete exports
            </Button>
          </Row>
        </Card>
      </div>

      <div>
        <SectionTitle>Danger zone</SectionTitle>
        <div className="rounded-xl border border-status-failed/25 bg-status-failed/5">
          <Row
            label="Delete everything local"
            hint="Projects, media, exports, brand kits and job history for this account in this browser. Your account and server-side renders are not affected."
          >
            <Button
              variant="danger"
              size="sm"
              leftIcon={<Trash2 className="size-3.5" />}
              onClick={() => setConfirm('everything')}
            >
              Delete everything
            </Button>
          </Row>
        </div>
      </div>

      <ConfirmDialog
        open={confirm === 'exports'}
        onClose={() => setConfirm(null)}
        title="Delete all exports?"
        confirmLabel="Delete exports"
        body={
          <p>
            {exportsQ.data?.length ?? 0} exported {exportsQ.data?.length === 1 ? 'file' : 'files'} (
            <span className="font-mono">{formatBytes(exportBytes)}</span>) will be removed from this browser.
            Download anything you want to keep first.
          </p>
        }
        onConfirm={async () => {
          const n = await deleteAllExports(owner)
          await qc.invalidateQueries({ queryKey: keys.exports(owner) })
          void refreshStorage()
          toast.success(`${n} ${n === 1 ? 'export' : 'exports'} deleted`)
        }}
      />
      <ConfirmDialog
        open={confirm === 'everything'}
        onClose={() => setConfirm(null)}
        title="Delete everything in this browser?"
        confirmLabel="Delete everything"
        requireText="delete"
        testId="settings-delete-everything-confirm"
        body={
          <>
            <p>This permanently removes, for {owner || 'this account'}:</p>
            <ul className="mt-2 list-disc pl-5">
              <li>{projects.data?.length ?? 0} projects and their timelines</li>
              <li>
                {media.data?.length ?? 0} media files (
                <span className="font-mono">{formatBytes(mediaBytes)}</span>)
              </li>
              <li>
                {exportsQ.data?.length ?? 0} exports (
                <span className="font-mono">{formatBytes(exportBytes)}</span>)
              </li>
              <li>{brand.data?.length ?? 0} brand kits and your job history</li>
            </ul>
            <p className="mt-3">
              It cannot be undone. Your account and anything stored on the server are not affected.
            </p>
          </>
        }
        onConfirm={async () => {
          await deleteEverythingLocal(owner)
          qc.removeQueries({ queryKey: ['project'] })
          await Promise.all(
            [
              keys.projects(owner),
              keys.media(owner),
              keys.exports(owner),
              keys.brand(owner),
              keys.jobHistory(owner),
              ['storage'],
            ].map((queryKey) => qc.invalidateQueries({ queryKey })),
          )
          toast.success('Local data deleted', 'This browser now holds nothing for your account.')
        }}
      />
    </div>
  )
}
