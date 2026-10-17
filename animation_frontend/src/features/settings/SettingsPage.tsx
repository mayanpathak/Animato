// /app/settings (plan 6.9): Account, Preferences, Storage, Privacy, About.
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm'
import { Progress, Skeleton, Switch } from '@/components/ui/misc'
import { Tabs } from '@/components/ui/tabs'
import { errorMessage } from '@/lib/api/http'
import { formatBytes, formatDate, timeAgo } from '@/lib/format'
import { keys, useExportHistory, useMediaLibrary, useOwner, useProjects } from '@/lib/local/hooks'
import { storageUsage } from '@/lib/local/opfs'
import { useTitle } from '@/lib/useTitle'
import { LOOKS, usePreferences, VIDEO_FORMATS, type LookId, type VideoFormat } from '@/stores/preferences'
import { useSession } from '@/stores/session'
import { toast } from '@/stores/toast'
import { deleteAllExports, deleteAllMedia, deleteEverythingLocal } from './storage'

function Section({
  id,
  title,
  children,
  anchor,
}: {
  id: string
  title: string
  children: ReactNode
  /** Linkable as /app/settings#anchor. */
  anchor?: string
}) {
  return (
    <section
      id={anchor}
      aria-labelledby={id}
      className="border-t border-line py-10 first-of-type:border-t-0 first-of-type:pt-0"
    >
      <h2 id={id} className="mb-6 font-display text-xl font-semibold tracking-tight">
        {title}
      </h2>
      <div className="flex flex-col gap-5">{children}</div>
    </section>
  )
}

function Row({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
      <div className="min-w-0">
        <p className="text-fg">{label}</p>
        {hint ? <p className="mt-0.5 text-sm text-fg-subtle">{hint}</p> : null}
      </div>
      {children ? <div className="shrink-0">{children}</div> : null}
    </div>
  )
}

function Account() {
  const user = useSession((s) => s.user)
  const logout = useSession((s) => s.logout)
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  if (!user) return null
  const facts = [
    { k: 'Username', v: user.username },
    { k: 'Email', v: user.email },
    { k: 'Email verified', v: user.isVerified ? 'Yes' : 'No' },
    { k: 'Member since', v: user.createdAt ? formatDate(user.createdAt) : '–' },
    { k: 'Last login', v: user.lastLogin ? timeAgo(user.lastLogin) : '–' },
  ]
  return (
    <Section id="account-h" title="Account">
      <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {facts.map((f) => (
          <div key={f.k}>
            <dt className="text-sm text-fg-subtle">{f.k}</dt>
            <dd
              className="mt-0.5 truncate text-fg"
              data-testid={`account-${f.k.toLowerCase().replace(/\s/g, '-')}`}
            >
              {f.v}
            </dd>
          </div>
        ))}
      </dl>
      <div>
        <Button
          variant="secondary"
          loading={busy}
          onClick={async () => {
            setBusy(true)
            try {
              await logout()
              navigate('/login')
            } catch (e) {
              toast.error('Could not log out', errorMessage(e))
              setBusy(false)
            }
          }}
        >
          Log out
        </Button>
      </div>
    </Section>
  )
}

function Preferences() {
  const p = usePreferences()
  const notifyState = typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  return (
    <Section id="prefs-h" title="Preferences">
      <Row
        label="Default format"
        hint="New videos open in this format. Changing a video's format updates it."
      >
        <Tabs<VideoFormat>
          label="Default format"
          size="sm"
          value={p.defaultFormat}
          onChange={p.setDefaultFormat}
          items={VIDEO_FORMATS.map((f) => ({ value: f, label: f }))}
        />
      </Row>
      <Row label="Default look" hint="The layout new videos start with.">
        <Tabs<LookId>
          label="Default look"
          size="sm"
          value={p.defaultLook}
          onChange={p.setDefaultLook}
          items={LOOKS.map((l) => ({ value: l.id, label: l.label }))}
        />
      </Row>
      <Row
        label="Reduce motion"
        hint="Turns off interface animation. Your system setting is always respected."
      >
        <Switch label="Reduce motion" checked={p.reducedMotion} onChange={p.setReducedMotion} />
      </Row>
      <Row
        label="Notify me when a render is ready"
        hint={
          notifyState === 'denied'
            ? 'Notifications are blocked for this site in your browser settings.'
            : notifyState === 'unsupported'
              ? 'This browser does not support notifications.'
              : 'A system notification when a render finishes while you are in another tab.'
        }
      >
        <Switch
          label="Notify me when a render is ready"
          checked={p.notifications && notifyState === 'granted'}
          disabled={notifyState === 'denied' || notifyState === 'unsupported'}
          onChange={async (on) => {
            if (on && Notification.permission !== 'granted') {
              const result = await Notification.requestPermission()
              if (result !== 'granted') return
            }
            p.setNotifications(on)
          }}
        />
      </Row>
    </Section>
  )
}

function Storage() {
  const owner = useOwner()
  const qc = useQueryClient()
  const usage = useQuery({ queryKey: ['storage'], queryFn: storageUsage })
  const persisted = useQuery({
    queryKey: ['storage-persisted'],
    queryFn: async () => (await navigator.storage?.persisted?.()) ?? false,
  })
  const videos = useProjects()
  const media = useMediaLibrary()
  const exportsQ = useExportHistory()
  const [confirm, setConfirm] = useState<'exports' | 'media' | 'everything' | null>(null)
  const mediaBytes = useMemo(() => (media.data ?? []).reduce((s, a) => s + a.size, 0), [media.data])
  const exportBytes = useMemo(() => (exportsQ.data ?? []).reduce((s, a) => s + a.size, 0), [exportsQ.data])
  const pct = usage.data?.quota ? usage.data.usage / usage.data.quota : 0
  // What to delete first when the browser runs out of space (plan 15.2).
  const largest = useMemo(
    () =>
      [
        ...(media.data ?? []).map((a) => ({ key: a.id, name: a.name, kind: 'Media', size: a.size })),
        ...(exportsQ.data ?? []).map((x) => ({ key: x.id, name: x.fileName, kind: 'Export', size: x.size })),
      ]
        .sort((a, b) => b.size - a.size)
        .slice(0, 5),
    [media.data, exportsQ.data],
  )

  const refresh = () =>
    Promise.all(
      [
        keys.projects(owner),
        keys.media(owner),
        keys.exports(owner),
        keys.brand(owner),
        keys.jobHistory(owner),
        ['storage'],
      ].map((queryKey) => qc.invalidateQueries({ queryKey })),
    )

  return (
    <Section id="storage-h" title="Storage" anchor="storage">
      <div>
        {usage.isPending ? (
          <Skeleton className="h-10" />
        ) : usage.data && usage.data.quota > 0 ? (
          <>
            <p className="text-fg">
              <span className="font-display text-2xl font-semibold tracking-tight tabular-nums">
                {formatBytes(usage.data.usage)}
              </span>{' '}
              <span className="text-fg-subtle">
                used of {formatBytes(usage.data.quota)} this browser allows
              </span>
            </p>
            <Progress value={Math.max(pct, 0.004)} label="Storage used" className="mt-3 h-1.5" />
          </>
        ) : (
          <p className="text-fg-muted">This browser does not report how much storage is available.</p>
        )}
      </div>
      <Row
        label="Keep my videos"
        hint={
          persisted.data
            ? 'Allowed. The browser will not clear Animato’s storage on its own.'
            : 'Not yet allowed. The browser may clear stored videos when the disk runs low.'
        }
      >
        {persisted.data ? null : (
          <Button
            size="sm"
            variant="secondary"
            onClick={async () => {
              await navigator.storage?.persist?.()
              void qc.invalidateQueries({ queryKey: ['storage-persisted'] })
            }}
          >
            Allow storage
          </Button>
        )}
      </Row>
      <Row label="Exports" hint={`${exportsQ.data?.length ?? 0} files, ${formatBytes(exportBytes)}`}>
        <Button
          size="sm"
          variant="secondary"
          disabled={!exportsQ.data?.length}
          onClick={() => setConfirm('exports')}
        >
          Delete exports
        </Button>
      </Row>
      <Row
        label="Media"
        hint={`${media.data?.length ?? 0} files copied into this browser, ${formatBytes(mediaBytes)}`}
      >
        <Button
          size="sm"
          variant="secondary"
          disabled={!media.data?.length}
          onClick={() => setConfirm('media')}
        >
          Delete media
        </Button>
      </Row>
      {largest.length ? (
        <div data-testid="largest-files">
          <p className="text-sm text-fg">Largest files</p>
          <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
            {largest.map((f) => (
              <li key={f.key} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{f.name}</span>
                <span className="text-2xs text-fg-subtle">{f.kind}</span>
                <span className="w-20 text-right font-mono text-xs tabular-nums">{formatBytes(f.size)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <Row
        label="Everything local"
        hint="Videos, media, exports, brand kit and history for this account in this browser."
      >
        <Button size="sm" variant="danger" onClick={() => setConfirm('everything')}>
          Delete everything
        </Button>
      </Row>

      <ConfirmDialog
        open={confirm === 'exports'}
        onClose={() => setConfirm(null)}
        title="Delete all exports?"
        confirmLabel="Delete exports"
        body="Exported files are removed from this browser. Your videos stay, so you can export again."
        onConfirm={async () => {
          const n = await deleteAllExports(owner)
          await refresh()
          toast.success(`${n} ${n === 1 ? 'export' : 'exports'} deleted`)
        }}
      />
      <ConfirmDialog
        open={confirm === 'media'}
        onClose={() => setConfirm(null)}
        title="Delete all media?"
        confirmLabel="Delete media"
        body="Renders copied into this browser and files you imported are removed. Videos that use them will need the render imported again; the renders on Animato’s server are not affected."
        onConfirm={async () => {
          const n = await deleteAllMedia(owner)
          await refresh()
          toast.success(`${n} media ${n === 1 ? 'file' : 'files'} deleted`)
        }}
      />
      <ConfirmDialog
        open={confirm === 'everything'}
        onClose={() => setConfirm(null)}
        title="Delete everything in this browser?"
        confirmLabel="Delete everything"
        requireText="delete"
        testId="settings-delete-everything-confirm"
        body={`This removes ${videos.data?.length ?? 0} videos, their media and exports, your brand kit and your render history from this browser. It cannot be undone. Your account and the renders on Animato’s server are not affected.`}
        onConfirm={async () => {
          await deleteEverythingLocal(owner)
          qc.removeQueries({ queryKey: ['project'] })
          await refresh()
          toast.success('Local data deleted')
        }}
      />
    </Section>
  )
}

function Privacy() {
  return (
    <Section id="privacy-h" title="Privacy">
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <h3 className="text-sm font-medium text-fg">Sent to Animato’s server</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-fg-muted">
            <li>Your account details (username, email, password)</li>
            <li>The prompts you generate from</li>
            <li>Generated videos come from Animato’s storage to this browser</li>
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-medium text-fg">Never leaves this device</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-fg-muted">
            <li>Your voice recordings and the captions made from them</li>
            <li>Your edits, brand kit and imported files</li>
            <li>Your exports</li>
          </ul>
        </div>
      </div>
    </Section>
  )
}

const LICENCES: { name: string; licence: string }[] = [
  { name: 'Inter, Geist, JetBrains Mono (fonts)', licence: 'SIL Open Font License 1.1' },
  { name: 'React, Motion, TanStack Query, zustand, zod', licence: 'MIT' },
  { name: 'Lucide icons', licence: 'ISC' },
  { name: 'mediabunny (media files)', licence: 'MPL-2.0' },
  { name: 'Transformers.js (on-device speech recognition)', licence: 'Apache-2.0' },
]

function About() {
  return (
    <Section id="about-h" title="About">
      <p className="text-fg-muted">Animato {import.meta.env.VITE_APP_VERSION ?? '0.0.0'}, early access.</p>
      <dl className="divide-y divide-line text-sm">
        {LICENCES.map((l) => (
          <div key={l.name} className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:justify-between">
            <dt className="text-fg">{l.name}</dt>
            <dd className="text-fg-subtle">{l.licence}</dd>
          </div>
        ))}
      </dl>
    </Section>
  )
}

export default function SettingsPage() {
  useTitle('Settings')
  // /app/settings#storage (the storage-full toast) lands on that section.
  useEffect(() => {
    const id = location.hash.slice(1)
    if (id) requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }))
  }, [])
  return (
    <div className="mx-auto max-w-3xl px-4 pt-8 pb-24 sm:px-6 sm:pt-12">
      <h1 className="mb-12 font-display text-4xl font-semibold tracking-tighter">Settings</h1>
      <Account />
      <Preferences />
      <Storage />
      <Privacy />
      <About />
    </div>
  )
}
