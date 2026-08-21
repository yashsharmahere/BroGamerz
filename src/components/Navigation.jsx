import { useLocation, useNavigate } from 'react-router-dom'
import { Gamepad2, PlusCircle, ReceiptText, LayoutDashboard, Wallet, AlertCircle, WifiOff } from 'lucide-react'
import { useQueueStatus } from '../hooks/useQueueStatus'
import { useOnlineStatus } from '../hooks/useOnlineStatus'

const tabs = [
  { path: '/',          icon: Gamepad2,     label: 'Sessions' },
  { path: '/add',       icon: PlusCircle,   label: 'Add Data' },
  { path: '/expense',   icon: ReceiptText,  label: 'Expense' },
  { path: '/udhar',     icon: Wallet,       label: 'Udhar' },
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
]

export default function Navigation() {
  const location = useLocation()
  const navigate = useNavigate()
  const queueSize = useQueueStatus()
  const online = useOnlineStatus()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-bg-secondary border-t border-border safe-bottom z-50">
      {!online ? (
        // No network at all (WiFi off / airplane mode) — shown immediately.
        <div className="px-4 py-2 bg-accent-red/10 border-b border-accent-red/30 flex items-center gap-2">
          <WifiOff size={14} className="text-accent-red shrink-0" />
          <p className="text-xs text-accent-red font-medium">
            You're offline · entries are saved on this device and will sync automatically when you reconnect
          </p>
        </div>
      ) : queueSize > 0 ? (
        // Connected, but writes are still pending (e.g. WiFi up but no internet,
        // or a reconnect still draining) — the reliable "not fully synced" signal.
        <div className="px-4 py-2 bg-accent-orange/10 border-b border-accent-orange/30 flex items-center gap-2">
          <AlertCircle size={14} className="text-accent-orange shrink-0" />
          <p className="text-xs text-accent-orange font-medium">
            {queueSize} entr{queueSize > 1 ? 'ies' : 'y'} waiting to sync · retrying…
          </p>
        </div>
      ) : null}
      <div className="flex">
        {tabs.map(({ path, icon: Icon, label }) => {
          const active = location.pathname === path
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 transition-colors duration-150
                ${active ? 'text-accent-blue' : 'text-text-muted'}`}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
              <span className={`text-[10px] font-medium tracking-wide ${active ? 'text-accent-blue' : 'text-text-muted'}`}>
                {label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
