import { Clapperboard, FolderOpen, Home, LayoutTemplate, Palette, Settings, Sparkles, type LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

export const NAV: NavItem[] = [
  { to: '/app', label: 'Home', icon: Home, end: true },
  { to: '/app/create', label: 'Create', icon: Sparkles },
  { to: '/app/projects', label: 'Projects', icon: FolderOpen },
  { to: '/app/templates', label: 'Templates', icon: LayoutTemplate },
  { to: '/app/brand', label: 'Brand kit', icon: Palette },
  { to: '/app/settings', label: 'Settings', icon: Settings },
]

export const EDITOR_ICON = Clapperboard
