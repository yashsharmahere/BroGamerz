import { useLocation, useNavigate } from 'react-router-dom'
import { Gamepad2, PlusCircle, ReceiptText, LayoutDashboard, Wallet, AlertCircle } from 'lucide-react'
import { useQueueStatus } from '../hooks/useQueueStatus'

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

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-bg-secondary border-t border-border safe-bottom z-50">
      {queueSize > 0 && (
        <div className="px-4 py-2 bg-accent-orange/10 border-b border-accent-orange/30 flex items-center gap-2">
          <AlertCircle size={14} className="text-accent-orange" />
          <p className="text-xs text-accent-orange font-medium">
            {queueSize} operation{queueSize > 1 ? 's' : ''} waiting to sync · will retry when online
          </p>
        </div>
      )}
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
