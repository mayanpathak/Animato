import type { ChangeEvent, MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { Check, Clapperboard, MoreHorizontal } from 'lucide-react'
import { Badge } from '@/components/ui/misc'
import { IconButton } from '@/components/ui/button'
import { Menu, type MenuItem } from '@/components/ui/menu'
import { cn } from '@/lib/cn'
import { formatDuration, timeAgo } from '@/lib/format'
import { timelineDuration } from '@/features/editor/model/timeline'
import type { Project } from '@/lib/local/models'
import { aspectLabel, placeholderGradient } from '../lib'

export interface ProjectItemProps {
  project: Project
  selected: boolean
  selecting: boolean
  onToggle: (shift: boolean) => void
  menu: (MenuItem | 'separator')[]
}

function frameStyle(p: Project) {
  const { width, height } = p.timeline
  return width >= height ? { width: `${Math.min(64, (width / height) * 40)}%` } : { height: '62%' }
}

export function ProjectThumb({ project, className }: { project: Project; className?: string }) {
  const { width, height } = project.timeline
  const landscape = width / height > 1.5
  return (
    <div
      className={cn('relative aspect-video overflow-hidden bg-surface-2', className)}
      style={project.thumbnail ? undefined : { backgroundImage: placeholderGradient(project.id) }}
    >
      {project.thumbnail ? (
        landscape ? (
          <img
            src={project.thumbnail}
            alt=""
            className="size-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <>
            <img
              src={project.thumbnail}
              alt=""
              aria-hidden
              className="absolute inset-0 size-full scale-110 object-cover opacity-40 blur-xl"
              loading="lazy"
            />
            <img
              src={project.thumbnail}
              alt=""
              className="relative size-full object-contain"
              loading="lazy"
              decoding="async"
            />
          </>
        )
      ) : (
        <div className="absolute inset-0 grid place-items-center">
          <div
            className="grid place-items-center rounded-md border border-line-strong bg-canvas/30 text-fg-subtle backdrop-blur-sm"
            style={{ aspectRatio: `${width} / ${height}`, ...frameStyle(project) }}
          >
            <Clapperboard className="size-4" aria-hidden />
          </div>
        </div>
      )}
    </div>
  )
}

function SelectBox({
  name,
  selected,
  visible,
  onToggle,
  className,
}: {
  name: string
  selected: boolean
  visible: boolean
  onToggle: (shift: boolean) => void
  className?: string
}) {
  return (
    <label
      className={cn(
        'relative grid size-8 cursor-pointer place-items-center transition-opacity duration-150',
        visible || selected
          ? 'opacity-100'
          : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:has-[:focus-visible]:opacity-100',
        className,
      )}
    >
      <input
        type="checkbox"
        className="peer sr-only"
        checked={selected}
        aria-label={`Select ${name}`}
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          onToggle((e.nativeEvent as unknown as MouseEvent).shiftKey === true)
        }
      />
      <span
        aria-hidden
        className={cn(
          'grid size-[18px] place-items-center rounded-[5px] border shadow-sm transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent-ring',
          selected
            ? 'border-transparent bg-gradient-accent text-white'
            : 'border-line-strong bg-glass-strong text-transparent backdrop-blur-md hover:border-fg-faint',
        )}
      >
        <Check className="size-3" strokeWidth={3} />
      </span>
    </label>
  )
}

function CardMenu({
  name,
  items,
  className,
}: {
  name: string
  items: ProjectItemProps['menu']
  className?: string
}) {
  return (
    <Menu
      items={items}
      trigger={(p) => (
        <IconButton {...p} label={`Actions for ${name}`} size="sm" variant="ghost" className={className}>
          <MoreHorizontal />
        </IconButton>
      )}
    />
  )
}

function useOpenHandler(selecting: boolean, onToggle: (shift: boolean) => void) {
  return (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey) return
    if (e.shiftKey || selecting) {
      e.preventDefault()
      onToggle(e.shiftKey)
    }
  }
}

export function ProjectCard({ project, selected, selecting, onToggle, menu }: ProjectItemProps) {
  const onClick = useOpenHandler(selecting, onToggle)
  const duration = timelineDuration(project.timeline)
  return (
    <div
      data-testid="project-card"
      className={cn(
        'group relative overflow-hidden rounded-xl border bg-surface-1 shadow-inner-highlight transition-[border-color,box-shadow,transform] duration-200',
        selected ? 'border-accent/60 shadow-glow' : 'border-line hover:border-line-strong',
      )}
    >
      <Link
        to={`/app/projects/${project.id}/edit`}
        onClick={onClick}
        className="block rounded-xl outline-offset-[-2px]"
        aria-label={`Open ${project.name}`}
      >
        <div className="relative">
          <ProjectThumb
            project={project}
            className="transition-transform duration-500 ease-out-expo group-hover:scale-[1.015]"
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-linear-to-t from-canvas/70 to-transparent" />
          <span className="absolute right-2.5 bottom-2 rounded-sm bg-canvas/70 px-1.5 py-0.5 font-mono text-2xs text-fg-muted tabular-nums backdrop-blur-sm">
            {duration > 0 ? formatDuration(duration) : 'Empty'}
          </span>
        </div>
        <div className="flex flex-col gap-2 p-3.5">
          <div className="flex items-start justify-between gap-3">
            <h3 className="min-w-0 truncate text-sm font-medium text-fg">{project.name}</h3>
            <Badge className="font-mono">{aspectLabel(project.timeline)}</Badge>
          </div>
          <div className="flex min-h-5 items-center gap-1.5 overflow-hidden">
            {project.tags.slice(0, 3).map((t) => (
              <span key={t} className="truncate rounded-sm bg-surface-3 px-1.5 py-px text-2xs text-fg-muted">
                {t}
              </span>
            ))}
            {project.tags.length > 3 ? (
              <span className="text-2xs text-fg-subtle">+{project.tags.length - 3}</span>
            ) : null}
            <span className="ml-auto shrink-0 text-2xs text-fg-subtle">
              Edited {timeAgo(project.updatedAt)}
            </span>
          </div>
        </div>
      </Link>
      <SelectBox
        name={project.name}
        selected={selected}
        visible={selecting}
        onToggle={onToggle}
        className="absolute top-1.5 left-1.5"
      />
      <div className="absolute top-2 right-2">
        <CardMenu
          name={project.name}
          items={menu}
          className="bg-glass-strong text-fg-muted backdrop-blur-md hover:bg-surface-4"
        />
      </div>
    </div>
  )
}

export function ProjectRow({ project, selected, selecting, onToggle, menu }: ProjectItemProps) {
  const onClick = useOpenHandler(selecting, onToggle)
  const duration = timelineDuration(project.timeline)
  return (
    <div
      data-testid="project-card"
      className={cn(
        'group relative flex items-center gap-2 rounded-lg border px-2 py-2 transition-colors sm:gap-3',
        selected
          ? 'border-accent/50 bg-accent-soft'
          : 'border-transparent hover:border-line hover:bg-surface-1',
      )}
    >
      <SelectBox name={project.name} selected={selected} visible={selecting} onToggle={onToggle} />
      <Link
        to={`/app/projects/${project.id}/edit`}
        onClick={onClick}
        aria-label={`Open ${project.name}`}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-md"
      >
        <ProjectThumb project={project} className="w-20 shrink-0 rounded-md border border-line sm:w-24" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-fg">{project.name}</p>
          <div className="mt-0.5 flex items-center gap-1.5 overflow-hidden text-2xs text-fg-subtle">
            <span className="sm:hidden">{timeAgo(project.updatedAt)}</span>
            {project.tags.slice(0, 4).map((t) => (
              <span
                key={t}
                className="hidden truncate rounded-sm bg-surface-3 px-1.5 py-px text-fg-muted sm:inline"
              >
                {t}
              </span>
            ))}
            {project.tags.length === 0 ? (
              <span className="hidden text-fg-subtle sm:inline">No tags</span>
            ) : null}
          </div>
        </div>
        <Badge className="hidden font-mono md:inline-flex">{aspectLabel(project.timeline)}</Badge>
        <span className="hidden w-14 text-right font-mono text-xs text-fg-muted tabular-nums sm:block">
          {duration > 0 ? formatDuration(duration) : '–'}
        </span>
        <span className="hidden w-28 text-right text-xs text-fg-subtle md:block">
          {timeAgo(project.updatedAt)}
        </span>
      </Link>
      <CardMenu name={project.name} items={menu} />
    </div>
  )
}
