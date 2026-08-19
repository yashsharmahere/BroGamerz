import { useState, useEffect, useCallback, useMemo, memo } from 'react'
import { Play, Square, Plus, Minus, Zap, Pencil, Gamepad2, Wifi, WifiOff, ChevronDown, ChevronRight, FileSpreadsheet } from 'lucide-react'
import { useSessions } from '../hooks/useSessions'
import EndSessionModal from '../components/EndSessionModal'
import EditSessionModal from '../components/EditSessionModal'
import { useToast } from '../components/Toast'
import {
  appendRevenue, loadRevenueLog, updateRevenue, deleteRevenue
} from '../services/storage'
import { logSession, updateSessionInSheet, deleteSessionFromSheet } from '../services/sheetsApi'
import { subscribeSessions, subscribeConnected } from '../services/firebaseDb'
import { playConfirmBeep, requestNotificationPermission } from '../services/audio'

function formatTime(secs) {
  const h = String(Math.floor(secs / 3600)).padStart(2, '0')
  const m = String(Math.floor((secs % 3600) / 60)).padStart(2, '0')
  const s = String(secs % 60).padStart(2, '0')
  return `${h}:${m}:${s}`
}


function formatTimeOfDay(isoString) {
  if (!isoString) return ''
  return new Date(isoString).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}

const COLOR = {
  blue:   { ring: 'ring-accent-blue', glow: 'shadow-accent-blue/30', amount: 'text-accent-blue', dot: 'bg-accent-blue' },
  purple: { ring: 'ring-accent-purple', glow: 'shadow-accent-purple/30', amount: 'text-accent-purple', dot: 'bg-accent-purple' },
}

// ─── Active Session Card ───────────────────────────────────────────────────────
function SessionCard({ session, onStart, onStop, onSetPlayers }) {
  const c = COLOR[session.color] || COLOR.blue
  return (
    <div className={`card flex flex-col gap-4 transition-all duration-300
      ${session.isRunning ? `ring-1 ${c.ring} shadow-lg ${c.glow}` : ''}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">{session.name}</p>
        <span className={session.isRunning ? 'badge-active' : 'badge-idle'}>
          <span className={`w-1.5 h-1.5 rounded-full ${session.isRunning ? 'bg-accent-green animate-pulse' : 'bg-text-muted'}`} />
          {session.isRunning ? 'Active' : 'Idle'}
        </span>
      </div>

      <div className="text-center py-2">
        <div className={`timer-display text-5xl font-bold tracking-tight ${session.isRunning ? 'text-text-primary' : 'text-text-muted'}`}>
          {formatTime(session.elapsed)}
        </div>
        <div className={`mt-2 text-2xl font-bold ${session.isRunning ? c.amount : 'text-text-muted'}`}>
          ₹{session.currentCharge.toLocaleString('en-IN')}
        </div>
      </div>

      <div className="flex items-center justify-center gap-4">
        <button onClick={() => onSetPlayers(session.id, Math.max(1, session.players - 1))}
          className="w-9 h-9 rounded-full bg-bg-secondary border border-border flex items-center justify-center text-text-secondary active:scale-90 transition-transform">
          <Minus size={16} />
        </button>
        <div className="flex flex-col items-center min-w-[60px]">
          <span className="text-xl font-bold text-text-primary">{session.players}</span>
          <span className="text-[11px] text-text-muted">{session.players === 1 ? 'player' : 'players'}</span>
        </div>
        <button onClick={() => onSetPlayers(session.id, Math.min(6, session.players + 1))}
          className="w-9 h-9 rounded-full bg-bg-secondary border border-border flex items-center justify-center text-text-secondary active:scale-90 transition-transform">
          <Plus size={16} />
        </button>
      </div>

      {!session.isRunning ? (
        <button onClick={() => onStart(session.id)}
          className="w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2
                     bg-accent-blue/10 text-accent-blue border border-accent-blue/30 active:scale-[0.98] transition-all">
          <Play size={17} fill="currentColor" />Start Session
        </button>
      ) : (
        <button onClick={() => onStop(session.id)}
          className="w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2
                     bg-accent-red/10 text-accent-red border border-accent-red/30 active:scale-[0.98] transition-all">
          <Square size={17} fill="currentColor" />Stop Session
        </button>
      )}
    </div>
  )
}

const STATION_META = {
  1: { name: 'PS5 Station 1', color: 'text-accent-blue' },
  2: { name: 'PS5 Station 2', color: 'text-accent-purple' },
  0: { name: 'Other', color: 'text-accent-green' },
}

// A single app-logged session (child row, editable)
const SessionChildRow = memo(function SessionChildRow({ entry, onEdit }) {
  return (
    <div className="flex items-center gap-3 py-2 pl-8">
      <span className="w-1.5 h-1.5 rounded-full bg-text-muted/50 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-text-secondary">
          {formatTimeOfDay(entry.savedAt) || 'Session'}
          {entry.players ? ` · ${entry.players} ${entry.players === 1 ? 'player' : 'players'}` : ''}
          {entry.editedAt ? ' · edited' : ''}
        </p>
        {entry.notes ? <p className="text-[11px] text-text-muted italic truncate">{entry.notes}</p> : null}
      </div>
      <span className="text-sm font-semibold text-text-primary shrink-0">₹{(entry.amount || 0).toLocaleString('en-IN')}</span>
      <button
        onClick={() => onEdit(entry)}
        className="w-7 h-7 rounded-lg bg-bg-secondary border border-border flex items-center justify-center active:scale-90 shrink-0"
      >
        <Pencil size={11} className="text-text-muted" />
      </button>
    </div>
  )
})

// An amount that was entered/changed directly in the Google Sheet (read-only)
const SheetChildRow = memo(function SheetChildRow({ entry }) {
  return (
    <div className="flex items-center gap-3 py-2 pl-8">
      <FileSpreadsheet size={12} className="text-accent-green/70 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-text-secondary flex items-center gap-1.5">
          Sheet total
          <span className="text-[10px] text-text-muted bg-bg-secondary px-1.5 py-0.5 rounded-full">from sheet</span>
        </p>
        <p className="text-[11px] text-text-muted">edit this in the Google Sheet</p>
      </div>
      <span className="text-sm font-semibold text-text-primary shrink-0">₹{(entry.amount || 0).toLocaleString('en-IN')}</span>
      <span className="w-7 h-7 shrink-0" />
    </div>
  )
})

// One station for a day: parent shows the station total (always = the sheet
// cell); children are the individual app sessions + any direct-sheet amount.
const StationGroup = memo(function StationGroup({ stationIndex, entries, onEdit }) {
  const [open, setOpen] = useState(true)
  const meta = STATION_META[stationIndex] || { name: `Station ${stationIndex}`, color: 'text-text-secondary' }
  const total = entries.reduce((s, e) => s + (e.amount || 0), 0)
  const sessions = entries.filter(e => e.source !== 'sheet').sort((a, b) => (a.savedAt || '').localeCompare(b.savedAt || ''))
  const sheetEntries = entries.filter(e => e.source === 'sheet')

  // Pure sheet total (no app sessions) → a single non-expandable row
  if (sessions.length === 0) {
    return (
      <div className="flex items-center gap-3 py-3 border-b border-border last:border-0">
        <div className="w-8 h-8 rounded-lg bg-bg-secondary flex items-center justify-center shrink-0">
          <Gamepad2 size={14} className={meta.color} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${meta.color}`}>{meta.name}</p>
          <p className="text-[11px] text-text-muted">from Google Sheet</p>
        </div>
        <span className="text-sm font-bold text-text-primary shrink-0">₹{total.toLocaleString('en-IN')}</span>
      </div>
    )
  }

  return (
    <div className="border-b border-border last:border-0">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center gap-2.5 py-3">
        {open ? <ChevronDown size={15} className="text-text-muted shrink-0" /> : <ChevronRight size={15} className="text-text-muted shrink-0" />}
        <div className="w-8 h-8 rounded-lg bg-bg-secondary flex items-center justify-center shrink-0">
          <Gamepad2 size={14} className={meta.color} />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className={`text-sm font-semibold ${meta.color}`}>{meta.name}</p>
          <p className="text-[11px] text-text-muted">
            {sessions.length} session{sessions.length > 1 ? 's' : ''}{sheetEntries.length ? ' + sheet' : ''}
          </p>
        </div>
        <span className="text-sm font-bold text-text-primary shrink-0">₹{total.toLocaleString('en-IN')}</span>
      </button>
      {open && (
        <div className="pb-1">
          {sessions.map(e => <SessionChildRow key={e.id} entry={e} onEdit={onEdit} />)}
          {sheetEntries.map(e => <SheetChildRow key={e.id} entry={e} />)}
        </div>
      )}
    </div>
  )
})

// ─── Session History ───────────────────────────────────────────────────────────
const SessionHistory = memo(function SessionHistory({ log, onEdit, isLive }) {
  const [showAll, setShowAll] = useState(false)

  const liveIndicator = (
    <div className="flex items-center gap-1.5 text-xs">
      {isLive
        ? <><span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" /><span className="text-accent-green">Live</span></>
        : <><WifiOff size={11} className="text-text-muted" /><span className="text-text-muted">Offline</span></>
      }
    </div>
  )

  const header = (
    <div className="flex items-center justify-between px-0.5">
      <p className="text-[11px] font-semibold text-text-muted uppercase tracking-widest">Session Log</p>
      {liveIndicator}
    </div>
  )

  if (log.length === 0) return (
    <div className="flex flex-col gap-2">
      {header}
      <div className="card flex flex-col items-center py-8 gap-2 text-center">
        <Gamepad2 size={28} className="text-text-muted" />
        <p className="text-sm text-text-secondary">No sessions logged yet</p>
        <p className="text-xs text-text-muted">Completed sessions will appear here</p>
      </div>
    </div>
  )

  const groups = []
  const seen = {}
  log.forEach(e => {
    if (!seen[e.date]) { seen[e.date] = []; groups.push({ date: e.date, entries: seen[e.date] }) }
    seen[e.date].push(e)
  })

  const today = new Date().toLocaleDateString('en-CA')
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('en-CA')

  function dateLabel(d) {
    if (d === today) return 'Today'
    if (d === yesterday) return 'Yesterday'
    return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  }

  const visible = showAll ? groups : groups.slice(0, 2)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-0.5">
        <div className="flex items-center gap-3">
          <p className="text-[11px] font-semibold text-text-muted uppercase tracking-widest">Session Log</p>
          {groups.length > 2 && (
            <button onClick={() => setShowAll(v => !v)} className="text-xs text-accent-blue">
              {showAll ? 'Show less' : `+${groups.length - 2} days`}
            </button>
          )}
        </div>
        {liveIndicator}
      </div>

      {visible.map(({ date, entries }) => {
        const dayTotal = entries.reduce((s, e) => s + (e.amount || 0), 0)
        const byStation = {}
        entries.forEach(e => { (byStation[e.stationIndex] = byStation[e.stationIndex] || []).push(e) })
        const stationOrder = [1, 2, 0].filter(si => byStation[si])
        return (
          <div key={date} className="card p-0 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-bg-secondary border-b border-border">
              <p className="text-xs font-semibold text-text-secondary">{dateLabel(date)}</p>
              <p className="text-xs font-bold text-text-primary">₹{dayTotal.toLocaleString('en-IN')}</p>
            </div>
            <div className="px-4">
              {stationOrder.map(si => (
                <StationGroup key={si} stationIndex={si} entries={byStation[si]} onEdit={onEdit} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
})

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function Sessions() {
  const { sessions, startSession, stopSession, setPlayers, resetSession } = useSessions()
  const [endingSession, setEndingSession] = useState(null)
  const [editingEntry, setEditingEntry] = useState(null)
  const [log, setLog] = useState(() => loadRevenueLog())
  const [firebaseSessions, setFirebaseSessions] = useState([])
  const [fbLoaded, setFbLoaded] = useState(false)
  const [isLive, setIsLive] = useState(false)
  const [deletingIds, setDeletingIds] = useState({}) // ids removed locally, awaiting sheet round-trip
  const toast = useToast()

  useEffect(() => { requestNotificationPermission() }, [])

  // Firebase real-time listeners
  useEffect(() => {
    const unsubSessions = subscribeSessions(data => { setFirebaseSessions(data); setFbLoaded(true) })
    const unsubConnected = subscribeConnected(connected => setIsLive(connected))
    return () => { unsubSessions(); unsubConnected() }
  }, [])

  // Once Firebase confirms a deletion (the id is gone from its data), stop
  // tracking it. A fallback timer clears it anyway so a failed delete reappears.
  useEffect(() => {
    const ids = Object.keys(deletingIds)
    if (ids.length === 0) return
    const fbIds = new Set(firebaseSessions.map(s => String(s.id)))
    const confirmed = ids.filter(id => !fbIds.has(id))
    if (confirmed.length > 0) {
      setDeletingIds(prev => {
        const next = { ...prev }
        confirmed.forEach(id => delete next[id])
        return next
      })
    }
  }, [firebaseSessions, deletingIds])

  const refreshLog = useCallback(() => setLog(loadRevenueLog()), [])
  const handleEditEntry = useCallback((entry) => setEditingEntry(entry), [])

  // ── Stop flow ───────────────────────────────────────────────────────────────
  const handleStop = (stationId) => {
    const session = sessions.find(s => s.id === stationId)
    if (!session || session.elapsed < 10) { resetSession(stationId); return }
    setEndingSession({ id: stationId })
  }

  const handleConfirmEnd = async ({ amount, players, durationMins, notes }) => {
    const stationId = endingSession.id
    const session = sessions.find(s => s.id === stationId)
    const date = new Date().toLocaleDateString('en-CA')
    const stationIndex = stationId === 'ps5_1' ? 1 : 2
    const entry = { date, station: session.name, stationIndex, amount, players, durationMins, notes }

    const saved = appendRevenue(entry)
    refreshLog()
    playConfirmBeep()
    toast(`Session saved · ₹${amount.toLocaleString('en-IN')}`, 'success')
    // Log to the Sheet — the Sheet's onEdit trigger is the single writer to Firebase
    logSession({ ...saved }).catch(() => {})
    stopSession(stationId)
    resetSession(stationId)
    setEndingSession(null)
  }

  // ── Edit flow ───────────────────────────────────────────────────────────────
  const handleSaveEdit = async (updated) => {
    updateRevenue(updated.id, updated)
    refreshLog()
    // Update the Sheet — the server recomputes the day's Daily Revenue total from
    // the Sessions tab (authoritative), so we don't push a local total here.
    updateSessionInSheet(updated).catch(() => {})
    toast('Session updated', 'success')
    setEditingEntry(null)
  }

  const handleDelete = async (id) => {
    deleteRevenue(id)
    refreshLog()
    // Hide it right away (optimistic) — Firebase catches up after the sheet
    // round-trip. Fallback timer clears the flag so a failed delete reappears.
    setDeletingIds(prev => ({ ...prev, [String(id)]: true }))
    setTimeout(() => {
      setDeletingIds(prev => { const next = { ...prev }; delete next[String(id)]; return next })
    }, 15000)
    // Delete from the Sheet — the server recomputes the day's Daily Revenue total
    // from the remaining sessions, so we don't push a local total here.
    deleteSessionFromSheet(id).catch(() => {})
    toast('Session deleted', 'success')
    setEditingEntry(null)
  }

  // The Google Sheet (via Firebase) is the source of truth for the log. Firebase
  // carries each session by its real id, so we merge by id: show every Firebase
  // entry (this reflects sheet adds, edits AND deletes), plus any local entry
  // saved in the last 30s that Firebase hasn't caught up on yet — that gives
  // instant feedback right after ending a session, without duplicating it once
  // the sheet round-trips, and without ever resurrecting a deleted entry.
  const mergedLog = useMemo(() => {
    const byDate = (a, b) => (b.date || '').localeCompare(a.date || '')

    // Offline or Firebase not ready yet → fall back to the on-device log.
    if (!fbLoaded) return [...log].sort(byDate)

    const fbIds = new Set(firebaseSessions.map(s => String(s.id)))
    const now = Date.now()
    const pendingLocal = log.filter(e => {
      const t = e.savedAt ? Date.parse(e.savedAt) : 0
      return (now - t) < 30000 && !fbIds.has(String(e.id))
    })
    return [...firebaseSessions, ...pendingLocal]
      .filter(e => !deletingIds[String(e.id)]) // hide entries being deleted
      .sort(byDate)
  }, [log, firebaseSessions, fbLoaded, deletingIds])

  const totalActive = sessions.filter(s => s.isRunning).length
  const totalRevenue = sessions.reduce((sum, s) => sum + (s.isRunning ? s.currentCharge : 0), 0)
  const liveEndingSession = endingSession ? sessions.find(s => s.id === endingSession.id) ?? null : null

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Bro Gamerz</h1>
          <p className="text-xs text-text-secondary mt-0.5">
            {totalActive === 0 ? 'No active sessions' : `${totalActive} station${totalActive > 1 ? 's' : ''} running`}
          </p>
        </div>
        {totalActive > 0 && (
          <div className="flex items-center gap-1.5 bg-accent-green/10 border border-accent-green/30 rounded-xl px-3 py-1.5">
            <Zap size={13} className="text-accent-green" fill="currentColor" />
            <span className="text-sm font-bold text-accent-green">₹{totalRevenue.toLocaleString('en-IN')}</span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col gap-4">
        {sessions.map(session => (
          <SessionCard key={session.id} session={session}
            onStart={startSession} onStop={handleStop} onSetPlayers={setPlayers} />
        ))}

        <div className="card flex-row items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent-blue/10 flex items-center justify-center shrink-0">
            <span className="text-accent-blue text-xs font-bold">₹</span>
          </div>
          <p className="text-text-secondary text-xs">
            <span className="text-text-primary font-medium">₹120/hr</span> · 1 player &nbsp;|&nbsp;
            <span className="text-text-primary font-medium">₹100/hr</span> per player · 2+ players
          </p>
        </div>

        <SessionHistory log={mergedLog} onEdit={handleEditEntry} isLive={isLive} />
      </div>

      {liveEndingSession && (
        <EndSessionModal
          session={liveEndingSession}
          onConfirm={handleConfirmEnd}
          onCancel={() => setEndingSession(null)}
        />
      )}
      {editingEntry && (
        <EditSessionModal
          entry={editingEntry}
          onSave={handleSaveEdit}
          onDelete={handleDelete}
          onCancel={() => setEditingEntry(null)}
        />
      )}
    </div>
  )
}
