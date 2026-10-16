import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  Clapperboard,
  FolderPlus,
  HardDrive,
  LayoutTemplate,
  Palette,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/field'
import { Ring, Skeleton } from '@/components/ui/misc'
import { cn } from '@/lib/cn'
import { formatBytes, timeAgo } from '@/lib/format'
import { useJobHistory, useProjects } from '@/lib/local/hooks'
import type { Project } from '@/lib/local/models'
import { storageUsage } from '@/lib/local/opfs'
import { ease } from '@/lib/motion'
import { useTitle } from '@/lib/useTitle'
import { useSession } from '@/stores/session'
import { createPathFor, readPendingPrompt } from '@/features/auth/pendingPrompt'
import { HomeEmpty } from './HomeEmpty'
import { RecentJobs } from './RecentJobs'

function greeting(hour: number): string {
  if (hour < 5) return 'Working late'
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function QuickPrompt() {
  const navigate = useNavigate()
  const [prompt, setPrompt] = useState('')
  const [engine, setEngine] = useState<'auto' | 'manim' | 'remotion'>('auto')

  const go = (e?: FormEvent) => {
    e?.preventDefault()
    const q = new URLSearchParams()
    if (prompt.trim()) q.set('prompt', prompt.trim())
    q.set('engine', engine)
    navigate(`/app/create?${q.toString()}`)
  }

  return (
    <form
      onSubmit={go}
      className="group relative overflow-hidden rounded-2xl border border-line-strong bg-surface-1 shadow-inner-highlight transition-[border-color,box-shadow] duration-200 focus-within:border-accent/50 focus-within:shadow-glow"
    >
      <label htmlFor="home-quick-prompt" className="sr-only">
        Describe an animation
      </label>
      <textarea
        id="home-quick-prompt"
        data-testid="home-quick-prompt"
        rows={2}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) go()
        }}
        placeholder="Describe an animation… e.g. a pendulum's phase portrait drawing itself as it swings"
        className="block w-full resize-none bg-transparent px-4 pt-4 pb-2 text-base leading-relaxed text-fg placeholder:text-fg-faint focus:outline-none sm:px-5"
      />
      <div className="flex flex-wrap items-center gap-2 px-3 pb-3 sm:px-4">
        <label htmlFor="home-engine" className="sr-only">
          Engine
        </label>
        <Select
          id="home-engine"
          value={engine}
          onChange={(e) => setEngine(e.target.value as typeof engine)}
          className="w-36"
        >
          <option value="auto">Auto engine</option>
          <option value="manim">Manim</option>
          <option value="remotion">Remotion</option>
        </Select>
        <span className="hidden text-2xs text-fg-faint sm:inline">
          Opens in Prompt Studio with all options
        </span>
        <Button type="submit" className="ml-auto" rightIcon={<ArrowRight className="size-4" />}>
          Generate
        </Button>
      </div>
    </form>
  )
}

const ACTIONS: { to: string; label: string; body: string; icon: LucideIcon }[] = [
  { to: '/app/create', label: 'New animation', body: 'Prompt Studio', icon: Sparkles },
  { to: '/app/projects?new=1', label: 'Empty project', body: 'Start on the timeline', icon: FolderPlus },
  { to: '/app/templates', label: 'Templates', body: 'Proven prompts', icon: LayoutTemplate },
  { to: '/app/brand', label: 'Brand kit', body: 'Colours and fonts', icon: Palette },
]

function QuickActions() {
  return (
    <nav aria-label="Quick actions" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {ACTIONS.map((a) => (
        <Link
          key={a.to}
          to={a.to}
          className="group flex items-center gap-3 rounded-xl border border-line bg-surface-1 p-3 transition-colors hover:border-line-strong hover:bg-surface-2"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-surface-2 text-fg-muted transition-colors group-hover:text-accent">
            <a.icon className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-fg">{a.label}</span>
            <span className="block truncate text-2xs text-fg-subtle">{a.body}</span>
          </span>
        </Link>
      ))}
    </nav>
  )
}

function ProjectCard({ project, index }: { project: Project; index: number }) {
  return (
    <motion.li
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: ease.outExpo, delay: index * 0.05 }}
    >
      <Link
        to={`/app/projects/${project.id}/edit`}
        className="group block overflow-hidden rounded-xl border border-line bg-surface-1 transition-colors hover:border-line-strong"
      >
        <span className="relative block aspect-video overflow-hidden bg-surface-2">
          {project.thumbnail ? (
            <img
              src={project.thumbnail}
              alt=""
              className="size-full object-cover transition-transform duration-500 ease-out-expo group-hover:scale-[1.03]"
            />
          ) : (
            <span className="absolute inset-0 grid place-items-center bg-gradient-accent-soft">
              <Clapperboard className="size-6 text-fg-faint" />
            </span>
          )}
          <span className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-black/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        </span>
        <span className="block px-3 py-2.5">
          <span className="block truncate text-sm font-medium text-fg">{project.name}</span>
          <span className="block text-2xs text-fg-subtle">Edited {timeAgo(project.updatedAt)}</span>
        </span>
      </Link>
    </motion.li>
  )
}

function ContinueEditing({ projects, loading }: { projects: Project[]; loading: boolean }) {
  return (
    <section aria-labelledby="continue-h">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="continue-h" className="font-display text-base font-semibold tracking-tight">
          Continue editing
        </h2>
        <Link to="/app/projects" className="text-xs text-fg-subtle hover:text-fg">
          All projects
        </Link>
      </div>
      {loading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i}>
              <Skeleton className="aspect-video rounded-xl" />
              <Skeleton className="mt-2 h-3 w-3/4" />
            </div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong px-4 py-8 text-center text-sm text-fg-subtle">
          Open a finished render in the editor and it will show up here.
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {projects.slice(0, 4).map((p, i) => (
            <ProjectCard key={p.id} project={p} index={i} />
          ))}
        </ul>
      )}
    </section>
  )
}

function StorageCard({ projects, jobs }: { projects: number | null; jobs: number | null }) {
  const { data } = useQuery({ queryKey: ['storage'], queryFn: storageUsage, refetchInterval: 30_000 })
  const pct = data && data.quota ? data.usage / data.quota : 0
  return (
    <section aria-labelledby="storage-h" className="surface-card rounded-2xl p-5">
      <div className="flex items-center gap-2">
        <HardDrive className="size-4 text-fg-subtle" />
        <h2 id="storage-h" className="font-display text-base font-semibold tracking-tight">
          Local storage
        </h2>
      </div>
      <div className="mt-4 flex items-center gap-5">
        <Ring value={Math.max(pct, data ? 0.01 : 0)} size={88} stroke={7}>
          <span className="font-mono text-sm text-fg tabular-nums">
            {data ? `${pct < 0.01 && pct > 0 ? '<1' : Math.round(pct * 100)}%` : '—'}
          </span>
        </Ring>
        <dl className="min-w-0 flex-1 space-y-2 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-fg-subtle">Used</dt>
            <dd className="font-mono text-xs text-fg tabular-nums">{data ? formatBytes(data.usage) : '—'}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-fg-subtle">Available</dt>
            <dd className="font-mono text-xs text-fg tabular-nums">{data ? formatBytes(data.quota) : '—'}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-fg-subtle">Projects</dt>
            <dd className="font-mono text-xs text-fg tabular-nums">{projects ?? '—'}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-fg-subtle">Renders</dt>
            <dd className="font-mono text-xs text-fg tabular-nums">{jobs ?? '—'}</dd>
          </div>
        </dl>
      </div>
      <p className="mt-4 text-2xs leading-relaxed text-fg-faint">
        Projects, media and exports live in this browser. Clearing site data removes them.{' '}
        <Link to="/app/settings" className="text-fg-subtle underline-offset-2 hover:text-fg hover:underline">
          Manage
        </Link>
      </p>
    </section>
  )
}

export default function HomePage() {
  useTitle('Home')
  const navigate = useNavigate()
  const user = useSession((s) => s.user)
  const history = useJobHistory()
  const projects = useProjects()
  const [hour] = useState(() => new Date().getHours())

  // A prompt typed before signing up is waiting: take it to Prompt Studio.
  useEffect(() => {
    const pending = readPendingPrompt()
    if (pending) navigate(createPathFor(pending), { replace: true })
  }, [navigate])

  const jobs = history.data ?? []
  const list = projects.data ?? []
  const loaded = !history.isPending && !projects.isPending
  const isNew = loaded && jobs.length === 0 && list.length === 0

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <motion.header
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: ease.outExpo }}
        className="mb-6"
      >
        <p className="text-sm text-fg-subtle">{greeting(hour)},</p>
        <h1 className="font-display text-3xl font-semibold tracking-tighter sm:text-4xl">
          <span className="text-gradient">{user?.username ?? 'there'}</span>
          <span className="text-fg">. What are we making?</span>
        </h1>
      </motion.header>

      <div className="space-y-6">
        <QuickPrompt />
        <QuickActions />

        {isNew ? (
          <HomeEmpty />
        ) : (
          <>
            <div className={cn('grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]')}>
              <RecentJobs jobs={jobs.slice(0, 6)} loading={history.isPending} />
              <StorageCard
                projects={projects.isPending ? null : list.length}
                jobs={history.isPending ? null : jobs.length}
              />
            </div>
            <ContinueEditing projects={list} loading={projects.isPending} />
          </>
        )}
      </div>
    </div>
  )
}
