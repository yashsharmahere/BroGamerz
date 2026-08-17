import { useState, useEffect, useCallback } from 'react'
import { TrendingUp, TrendingDown, Users, Gamepad2, IndianRupee, RefreshCw, Wifi, WifiOff } from 'lucide-react'
import {
  loadRevenueLog, loadExpenseLog, loadUdharLog,
  getTodayRevenue, getTodayCustomers, getMonthRevenue
} from '../services/storage'
import { getDashboard, configured } from '../services/sheetsApi'

// ─── Session cache (survives tab switches, cleared on browser close) ──────────
const CACHE_KEY = 'bg_dash_cache'
function getCache() {
  try { return JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null') } catch { return null }
}
function setCache(data) {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(data)) } catch {}
}

// ─── Sub-components ────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, color = 'blue' }) {
  const colors = {
    blue:   { bg: 'bg-accent-blue/10',   text: 'text-accent-blue',   border: 'border-accent-blue/20' },
    green:  { bg: 'bg-accent-green/10',  text: 'text-accent-green',  border: 'border-accent-green/20' },
    red:    { bg: 'bg-accent-red/10',    text: 'text-accent-red',    border: 'border-accent-red/20' },
    purple: { bg: 'bg-accent-purple/10', text: 'text-accent-purple', border: 'border-accent-purple/20' },
    orange: { bg: 'bg-accent-orange/10', text: 'text-accent-orange', border: 'border-accent-orange/20' },
  }
  const c = colors[color]
  return (
    <div className={`stat-card border ${c.border}`}>
      <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center mb-2`}>
        <Icon size={15} className={c.text} />
      </div>
      <p className="text-2xl font-bold text-text-primary leading-tight">{value}</p>
      <p className="text-xs text-text-muted mt-0.5">{label}</p>
      {sub && (
        <p className={`text-xs font-medium mt-1 ${sub === 'Loss' ? 'text-accent-red' : 'text-accent-green'}`}>
          {sub}
        </p>
      )}
    </div>
  )
}

function ProgressBar({ label, amount, total, color = 'blue' }) {
  const pct = total > 0 ? Math.min((amount / total) * 100, 100) : 0
  const bars = { blue: 'bg-accent-blue', purple: 'bg-accent-purple', green: 'bg-accent-green', orange: 'bg-accent-orange', red: 'bg-accent-red' }
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-text-secondary">{label}</span>
        <span className="font-semibold text-text-primary">₹{amount.toLocaleString('en-IN')}</span>
      </div>
      <div className="h-1.5 bg-bg-secondary rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${bars[color] || bars.blue}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="stat-card animate-pulse">
      <div className="w-8 h-8 rounded-lg bg-bg-secondary mb-2" />
      <div className="h-6 w-24 bg-bg-secondary rounded-md mb-1.5" />
      <div className="h-3 w-16 bg-bg-secondary rounded-md" />
    </div>
  )
}

function SyncBadge({ status, syncedAt }) {
  if (status === 'syncing') return (
    <div className="flex items-center gap-1.5 text-xs text-text-muted">
      <RefreshCw size={11} className="animate-spin" />Syncing…
    </div>
  )
  if (status === 'error') return (
    <div className="flex items-center gap-1.5 text-xs text-accent-orange">
      <WifiOff size={11} />Sheet offline
    </div>
  )
  if (status === 'synced') return (
    <div className="flex items-center gap-1.5 text-xs text-accent-green">
      <Wifi size={11} />{syncedAt ? `Synced ${syncedAt}` : 'Synced'}
    </div>
  )
  return null
}

const CAT_COLORS = {
  'Equipment': 'blue', 'Game Purchase': 'purple', 'Repairs/Maintenance': 'orange',
  'Miscellaneous': 'red', 'Marketing': 'green', 'Rent': 'orange',
  'Electricity': 'orange', 'Internet': 'blue', 'Food/Drinks': 'green',
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [local, setLocal]           = useState(null)
  const [sheets, setSheets]         = useState(() => getCache())  // init from cache instantly
  const [syncStatus, setSyncStatus] = useState(() => getCache() ? 'synced' : 'idle')
  const [syncedAt, setSyncedAt]     = useState(null)
  const [fetching, setFetching]     = useState(false)

  const buildLocal = useCallback(() => {
    const expenses = loadExpenseLog()
    const udhar    = loadUdharLog()
    const month    = new Date().toLocaleDateString('en-CA').slice(0, 7)
    return {
      todayCustomers:  getTodayCustomers(),
      monthExpenses:   expenses.filter(e => e.date?.startsWith(month)).reduce((s, e) => s + (e.amount || 0), 0),
      pendingUdhar:    udhar.filter(e => !e.settled && e.type === 'udhar').reduce((s, e) => s + e.amount, 0),
      pendingAdvance:  udhar.filter(e => !e.settled && e.type === 'advance').reduce((s, e) => s + e.amount, 0),
    }
  }, [])

  const fetchSheets = useCallback(async () => {
    if (!configured() || fetching) return
    setFetching(true)
    setSyncStatus('syncing')
    try {
      const res = await getDashboard()
      if (res.ok && res.data && !res.data.error) {
        setSheets(res.data)
        setCache(res.data)
        setSyncStatus('synced')
        setSyncedAt(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }))
      } else {
        setSyncStatus('error')
      }
    } catch {
      setSyncStatus('error')
    } finally {
      setFetching(false)
    }
  }, [fetching])

  useEffect(() => {
    setLocal(buildLocal())
    fetchSheets()
  }, [])  // only on mount — cache handles re-visits

  const handleRefresh = () => {
    setLocal(buildLocal())
    setFetching(false)   // reset so fetchSheets runs
    setTimeout(fetchSheets, 0)
  }

  const s = sheets
  const l = local || {}

  // ── Numbers ────────────────────────────────────────────────────────────────
  const todayRevenue   = s?.today?.revenue   ?? 0
  const todayCustomers = s?.today?.customers ?? 0   // from Sheet (requires Code.gs redeploy)
  const monthRevenue   = s?.month?.revenue   ?? 0
  const monthExpenses  = s?.month?.expenses  ?? (l.monthExpenses ?? 0)
  const monthCustomers = s?.month?.customers ?? 0
  const netProfit      = monthRevenue - monthExpenses

  const ps5_1      = s?.allTime?.ps5_1    ?? 0
  const ps5_2      = s?.allTime?.ps5_2    ?? 0
  const otherRev   = s?.allTime?.otherRev ?? 0
  const totalRev   = ps5_1 + ps5_2 + otherRev
  const totalExp   = s?.allTime?.expenses ?? 0

  const avgPerCust = monthCustomers > 0 ? Math.round(monthRevenue / monthCustomers) : 0

  const sortedCats  = Object.entries(s?.categoryTotals ?? {}).sort((a, b) => b[1] - a[1])
  const totalExpAll = sortedCats.reduce((sum, [, v]) => sum + v, 0)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Dashboard</h1>
          <div className="mt-1">
            <SyncBadge status={syncStatus} syncedAt={syncedAt} />
          </div>
        </div>
        <button onClick={handleRefresh} disabled={fetching}
          className="w-9 h-9 rounded-xl bg-bg-card border border-border flex items-center justify-center disabled:opacity-50">
          <RefreshCw size={15} className={`text-text-secondary ${fetching ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col gap-5">

        {/* TODAY */}
        <section>
          <p className="text-[11px] font-semibold text-text-muted uppercase tracking-widest mb-2.5">Today</p>
          <div className="grid grid-cols-2 gap-3">
            {!sheets && fetching ? (
              <><SkeletonCard /><SkeletonCard /></>
            ) : (
              <>
                <StatCard label="Revenue" value={`₹${todayRevenue.toLocaleString('en-IN')}`} icon={IndianRupee} color="green" />
                <StatCard label="Customers" value={todayCustomers} icon={Users} color="blue" />
              </>
            )}
          </div>
        </section>

        {/* THIS MONTH */}
        <section>
          <p className="text-[11px] font-semibold text-text-muted uppercase tracking-widest mb-2.5">
            {new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {!sheets && fetching ? (
              <><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></>
            ) : (
              <>
                <StatCard label="Revenue" value={`₹${monthRevenue.toLocaleString('en-IN')}`} icon={TrendingUp} color="green" />
                <StatCard label="Expenses" value={`₹${monthExpenses.toLocaleString('en-IN')}`} icon={TrendingDown} color="red" />
                <StatCard
                  label="Net P&L"
                  value={`₹${Math.abs(netProfit).toLocaleString('en-IN')}`}
                  sub={monthRevenue > 0 || monthExpenses > 0 ? (netProfit >= 0 ? 'Profit' : 'Loss') : undefined}
                  icon={netProfit >= 0 ? TrendingUp : TrendingDown}
                  color={monthRevenue > 0 || monthExpenses > 0 ? (netProfit >= 0 ? 'green' : 'red') : 'green'}
                />
                <StatCard label="Customers" value={monthCustomers} icon={Users} color="blue" />
              </>
            )}
          </div>
          {avgPerCust > 0 && (
            <div className="mt-3 card flex items-center justify-between py-3">
              <p className="text-sm text-text-secondary">Avg revenue / customer</p>
              <p className="text-sm font-bold text-text-primary">₹{avgPerCust.toLocaleString('en-IN')}</p>
            </div>
          )}
        </section>

        {/* STATION BREAKDOWN */}
        {totalRev > 0 && (
          <div className="card flex flex-col gap-3.5">
            <p className="text-sm font-semibold text-text-primary">Revenue by Station</p>
            <ProgressBar label="PS5 Station 1" amount={ps5_1} total={totalRev} color="blue" />
            <ProgressBar label="PS5 Station 2" amount={ps5_2} total={totalRev} color="purple" />
            {otherRev > 0 && <ProgressBar label="Other" amount={otherRev} total={totalRev} color="green" />}
          </div>
        )}

        {/* EXPENSE BREAKDOWN */}
        {sortedCats.length > 0 && (
          <div className="card flex flex-col gap-3.5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-text-primary">Expenses by Category</p>
              <span className="text-xs text-accent-green bg-accent-green/10 px-2 py-0.5 rounded-full">from Sheet</span>
            </div>
            {sortedCats.map(([cat, amt]) => (
              <ProgressBar key={cat} label={cat} amount={amt} total={totalExpAll} color={CAT_COLORS[cat] || 'blue'} />
            ))}
            <div className="flex justify-between text-xs pt-1 border-t border-border">
              <span className="text-text-muted">Total all-time expenses</span>
              <span className="font-bold text-text-primary">₹{totalExpAll.toLocaleString('en-IN')}</span>
            </div>
          </div>
        )}

        {/* UDHAR */}
        {(l.pendingUdhar > 0 || l.pendingAdvance > 0) && (
          <div className="card grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-text-muted">Pending Udhar</p>
              <p className="text-xl font-bold text-accent-red mt-1">₹{l.pendingUdhar.toLocaleString('en-IN')}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Advance Held</p>
              <p className="text-xl font-bold text-accent-green mt-1">₹{l.pendingAdvance.toLocaleString('en-IN')}</p>
            </div>
          </div>
        )}

        {/* ALL TIME */}
        <div className="card">
          <p className="text-sm font-semibold text-text-primary mb-3">All Time</p>
          <div className="grid grid-cols-3 gap-y-4">
            {[
              { label: 'Revenue',  value: `₹${totalRev.toLocaleString('en-IN')}` },
              { label: 'Expenses', value: `₹${totalExp.toLocaleString('en-IN')}` },
              { label: 'Net P&L',  value: `₹${Math.abs(totalRev - totalExp).toLocaleString('en-IN')}` },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-[11px] text-text-muted">{label}</p>
                <p className="text-sm font-bold text-text-primary mt-0.5">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Empty state */}
        {totalRev === 0 && monthExpenses === 0 && !fetching && (
          <div className="card flex flex-col items-center py-10 gap-3 text-center">
            <Gamepad2 size={36} className="text-text-muted" />
            <p className="text-text-secondary text-sm">No data yet — start a session or add an entry.</p>
          </div>
        )}

      </div>
    </div>
  )
}
