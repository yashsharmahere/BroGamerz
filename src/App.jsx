import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ToastProvider } from './components/Toast'
import Navigation from './components/Navigation'
import Sessions from './pages/Sessions'
import AddData from './pages/AddData'
import AddExpense from './pages/AddExpense'
import Udhar from './pages/Udhar'
import Dashboard from './pages/Dashboard'
import { useRetryOnline } from './hooks/useRetryOnline'

export default function App() {
  useRetryOnline()

  return (
    <ToastProvider>
      <BrowserRouter>
        <div className="flex flex-col h-screen bg-bg-primary overflow-hidden">
          {/* Main content area — leaves room for bottom nav */}
          <div className="flex-1 overflow-hidden" style={{ paddingBottom: 'calc(60px + env(safe-area-inset-bottom))' }}>
            <div className="h-full overflow-y-auto">
              <Routes>
                <Route path="/" element={<Sessions />} />
                <Route path="/add" element={<AddData />} />
                <Route path="/expense" element={<AddExpense />} />
                <Route path="/udhar" element={<Udhar />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>
          </div>
          <Navigation />
        </div>
      </BrowserRouter>
    </ToastProvider>
  )
}
