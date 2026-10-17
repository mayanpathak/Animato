// The app has two places (plan 3.1): Videos and the video page. Everything
// else lives in the avatar menu or the command palette.
export const ROUTES = {
  videos: '/app',
  newVideo: '/app/new',
  video: (id: string) => `/app/v/${encodeURIComponent(id)}`,
  brand: '/app/brand',
  settings: '/app/settings',
  pricing: '/pricing',
} as const

/** Appendix B, shown by the shortcuts sheet. */
export const SHORTCUTS: { keys: string[]; where: string; action: string }[] = [
  { keys: ['N'], where: 'App', action: 'New video' },
  { keys: ['⌘', 'K'], where: 'App', action: 'Command palette' },
  { keys: ['?'], where: 'App', action: 'Keyboard shortcuts' },
  { keys: ['⌘', '↵'], where: 'Composer', action: 'Generate' },
  { keys: ['Space'], where: 'Video', action: 'Play or pause' },
  { keys: ['J', 'K', 'L'], where: 'Video', action: 'Back, pause, forward' },
  { keys: ['←', '→'], where: 'Video', action: 'Previous or next frame (Shift: 1 s)' },
  { keys: ['⌘', 'Z'], where: 'Video', action: 'Undo (⇧⌘Z redo)' },
  { keys: ['S'], where: 'Timeline', action: 'Split at playhead' },
  { keys: ['Delete'], where: 'Timeline', action: 'Delete clip (Shift: ripple)' },
]
