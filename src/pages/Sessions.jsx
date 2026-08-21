import { useState, useEffect, useCallback, useMemo, memo } from 'react'
import { Play, Square, Plus, Minus, Zap, Pencil, Gamepad2, Wifi, WifiOff } from 'lucide-react'
import { useSessions } from '../hooks/useSessions'
import EndSessionModal from '../components/EndSessionModal'
import EditSessionModal from '../components/EditSessionModal'
import { useToast } from '../components/Toast'
import {
  appendRevenue, loadRevenueLog, updateRevenue, deleteRevenue, getDayStationTotal
} from '../services/storage'
import { logSession, updateDayRevenue, updateSessionInSheet, deleteSessionFromSheet } from '../services/sheetsApi'
import { writeSession, updateSessionFb, deleteSessionFb, subscribeSessions, subscribeConnected } from '../services/firebaseDb'
import { playConfirmBeep, requestNotificationPermission } from '../services/audio'
import { queueOperation } from '../services/retryQueue'

function formatTime(secs) {
  const h = String(Math.floor(secs / 3600)).padStart(2, '0')
  const m = String(Math.floor((secs % 3600) / 60)).padStart(2, '0')
  const s = String(secs % 60).padStart(2, '0')
  return `${h}:${m}:${s}`
}

function formatMins(mins) {
  if (!mins) return '—'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h > 0 && m > 0) return `${h}h ${m}m`
  if (h > 0) return `${h}h`
  return `${m}m`
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

// ─── Log Entry Row ─────────────────────────────────────────────────────────────
const LogEntry = memo(function LogEntry({ entry, onEdit }) {
  const stationColors = { 1: 'text-accent-blue', 2: 'text-accent-purple', 0: 'text-accent-green' }
  const color = stationColors[entry.stationIndex] ?? 'text-text-secondary'

  return (
    <div className="flex items-center gap-3 py-3 border-b border-border last:border-0">
      <div className="w-8 h-8 rounded-lg bg-bg-secondary flex items-center justify-center shrink-0">
        <Gamepad2 size={14} className={color} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={`text-sm font-semibold ${color}`}>{entry.station || `Station ${entry.stationIndex}`}</p>
          {entry.editedAt && <span className="text-[10px] text-text-muted bg-bg-secondary px-1.5 py-0.5 rounded-full">edited</span>}
        </div>
        <p className="text-xs text-text-muted mt-0.5">
          {formatMins(entry.durationMins)}
          {entry.players ? ` · ${entry.players} ${entry.players === 1 ? 'player' : 'players'}` : ''}
          {entry.savedAt ? ` · ${formatTimeOfDay(entry.savedAt)}` : ''}
        </p>
        {entry.notes ? <p className="text-xs text-text-muted italic mt-0.5 truncate">{entry.notes}</p> : null}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-sm font-bold text-text-primary">₹{(entry.amount || 0).toLocaleString('en-IN')}</span>
        <button
          onClick={() => onEdit(entry)}
          className="w-7 h-7 rounded-lg bg-bg-secondary border border-border flex items-center justify-center active:scale-90"
        >
          <Pencil size={12} className="text-text-muted" />
        </button>
      </div>
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
        const dayTotal = entries.reduce((s, e) => s + e.amount, 0)
        return (
          <div key={date} className="card p-0 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-bg-secondary border-b border-border">
              <p className="text-xs font-semibold text-text-secondary">{dateLabel(date)}</p>
              <p className="text-xs font-bold text-text-primary">₹{dayTotal.toLocaleString('en-IN')}</p>
            </div>
            <div className="px-4">
              {entries.map(e => <LogEntry key={e.id} entry={e} onEdit={onEdit} />)}
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
  const [isLive, setIsLive] = useState(false)
  const toast = useToast()

  useEffect(() => { requestNotificationPermission() }, [])

  // Firebase real-time listeners
  useEffect(() => {
    const unsubSessions = subscribeSessions(data => setFirebaseSessions(data))
    const unsubConnected = subscribeConnected(connected => setIsLive(connected))
    return () => { unsubSessions(); unsubConnected() }
  }, [])

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
    // Write to Firebase (real-time) + Sheets (backup)
    writeSession(saved).catch(err => {
      queueOperation(() => writeSession(saved), 'writeSession', {})
    })
    logSession({ ...saved }).catch(err => {
      queueOperation(() => logSession({ ...saved }), 'logSession', {})
    })
    stopSession(stationId)
    resetSession(stationId)
    setEndingSession(null)
  }

  // ── Edit flow ───────────────────────────────────────────────────────────────
  const handleSaveEdit = async (updated) => {
    updateRevenue(updated.id, updated)
    refreshLog()
    // Firebase (real-time) + Sheets (backup)
    updateSessionFb(updated.id, updated).catch(err => {
      queueOperation(() => updateSessionFb(updated.id, updated), 'updateSessionFb', {})
    })
    updateSessionInSheet(updated).catch(err => {
      queueOperation(() => updateSessionInSheet(updated), 'updateSessionInSheet', {})
    })
    const newTotal = getDayStationTotal(updated.date, updated.stationIndex)
    updateDayRevenue({ date: updated.date, stationIndex: updated.stationIndex, newTotal }).catch(err => {
      queueOperation(
        () => updateDayRevenue({ date: updated.date, stationIndex: updated.stationIndex, newTotal }),
        'updateDayRevenue',
        {}
      )
    })
    if (updated.stationIndex !== editingEntry.stationIndex || updated.date !== editingEntry.date) {
      const origTotal = getDayStationTotal(editingEntry.date, editingEntry.stationIndex)
      updateDayRevenue({ date: editingEntry.date, stationIndex: editingEntry.stationIndex, newTotal: origTotal }).catch(err => {
        queueOperation(
          () => updateDayRevenue({ date: editingEntry.date, stationIndex: editingEntry.stationIndex, newTotal: origTotal }),
          'updateDayRevenue',
          {}
        )
      })
    }
    toast('Session updated', 'success')
    setEditingEntry(null)
  }

  const handleDelete = async (id) => {
    const entry = editingEntry
    deleteRevenue(id)
    refreshLog()
    // Firebase (real-time) + Sheets (backup)
    deleteSessionFb(id).catch(err => {
      queueOperation(() => deleteSessionFb(id), 'deleteSessionFb', {})
    })
    deleteSessionFromSheet(id).catch(err => {
      queueOperation(() => deleteSessionFromSheet(id), 'deleteSessionFromSheet', {})
    })
    const newTotal = getDayStationTotal(entry.date, entry.stationIndex)
    updateDayRevenue({ date: entry.date, stationIndex: entry.stationIndex, newTotal }).catch(err => {
      queueOperation(
        () => updateDayRevenue({ date: entry.date, stationIndex: entry.stationIndex, newTotal }),
        'updateDayRevenue',
        {}
      )
    })
    toast('Session deleted', 'success')
    setEditingEntry(null)
  }

  // Merge local log + Firebase sessions by ID (Firebase fills in cross-device entries)
  const mergedLog = useMemo(() => {
    const byId = {}
    log.forEach(e => { byId[String(e.id)] = e })
    firebaseSessions.forEach(s => {
      const key = String(s.id)
      if (!byId[key]) byId[key] = { ...s, fromCloud: true }
    })
    return Object.values(byId).sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  }, [log, firebaseSessions])

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
