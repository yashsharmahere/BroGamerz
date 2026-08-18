import { initializeApp } from 'firebase/app'
import { getDatabase, ref, set, update, onValue } from 'firebase/database'
import { FIREBASE_CONFIG } from '../config'

const app = initializeApp(FIREBASE_CONFIG)
export const db = getDatabase(app)

const R = (path) => ref(db, `brogamerz/${path}`)

// ─── Connection & Clock ───────────────────────────────────────────────────────
export const subscribeConnected = (cb) =>
  onValue(ref(db, '.info/connected'), snap => cb(snap.val() ?? false))

export const subscribeServerOffset = (cb) =>
  onValue(ref(db, '.info/serverTimeOffset'), snap => cb(snap.val() ?? 0))

// ─── Active Sessions (real-time timer sync) ───────────────────────────────────
export const subscribeActiveSessions = (cb) =>
  onValue(R('activeSessions'), snap => cb(snap.val() ?? {}))

export const pushActiveSessions = (sessions) =>
  set(R('activeSessions'), sessions)

// ─── Session Log ──────────────────────────────────────────────────────────────
export const subscribeSessions = (cb) =>
  onValue(R('sessions'), snap => {
    const val = snap.val() ?? {}
    cb(Object.values(val).filter(s => s && (s.amount || 0) > 0).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')))
  })

// Used only by the one-time Sheets→Firebase migration. Day-to-day, the Google
// Sheet's onEdit trigger is the single writer to /sessions (full-node rebuild).
export const writeSession = (entry) => set(R(`sessions/${entry.id}`), entry)

// ─── Expenses ─────────────────────────────────────────────────────────────────
export const subscribeExpenses = (cb) =>
  onValue(R('expenses'), snap => {
    const val = snap.val() ?? {}
    cb(Object.values(val))
  })

export const writeExpense = (entry) => set(R(`expenses/${entry.id}`), entry)

// ─── Udhar ────────────────────────────────────────────────────────────────────
export const subscribeUdhar = (cb) =>
  onValue(R('udhar'), snap => {
    const val = snap.val() ?? {}
    cb(Object.values(val))
  })

export const writeUdhar = (entry) => set(R(`udhar/${entry.id}`), entry)

export const updateUdharFb = (id, updates) => update(R(`udhar/${id}`), updates)
