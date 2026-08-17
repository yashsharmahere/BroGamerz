import { useLocation, useNavigate } from 'react-router-dom'
import { Gamepad2, PlusCircle, ReceiptText, LayoutDashboard, Wallet } from 'lucide-react'

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

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-bg-secondary border-t border-border safe-bottom z-50">
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
