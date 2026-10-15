import { useTitle } from '@/lib/useTitle'

export default function SettingsPage() {
  useTitle('Settings')
  return <div className="p-8 text-fg-muted">Settings</div>
}
