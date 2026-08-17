// Local storage layer — persists data on device even without internet
const KEYS = {
  sessions: 'bg_active_sessions',
  revenue: 'bg_revenue_log',
  expenses: 'bg_expense_log',
  udhar: 'bg_udhar_log',
}

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch { return fallback }
}

function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
}

// ─── Active Sessions ──────────────────────────────────────────────────────────
export function loadSessions() {
  return load(KEYS.sessions, {})
}

export function saveSession(stationId, sessionData) {
  const sessions = loadSessions()
  sessions[stationId] = sessionData
  save(KEYS.sessions, sessions)
}

export function clearSession(stationId) {
  const sessions = loadSessions()
  delete sessions[stationId]
  save(KEYS.sessions, sessions)
}

// ─── Revenue Log ─────────────────────────────────────────────────────────────
export function loadRevenueLog() {
  return load(KEYS.revenue, [])
}

export function appendRevenue(entry) {
  const log = loadRevenueLog()
  const saved = { ...entry, id: Date.now(), savedAt: new Date().toISOString() }
  log.unshift(saved)
  save(KEYS.revenue, log.slice(0, 500))
  return saved
}

export function updateRevenue(id, updates) {
  const log = loadRevenueLog()
  const idx = log.findIndex(e => e.id === id)
  if (idx !== -1) log[idx] = { ...log[idx], ...updates, editedAt: new Date().toISOString() }
  save(KEYS.revenue, log)
  return log
}

export function deleteRevenue(id) {
  const log = loadRevenueLog().filter(e => e.id !== id)
  save(KEYS.revenue, log)
  return log
}

// Returns all sessions for a given date + stationIndex so we can recalculate Sheet totals
export function getDayStationTotal(date, stationIndex) {
  return loadRevenueLog()
    .filter(e => e.date === date && e.stationIndex === stationIndex)
    .reduce((sum, e) => sum + (e.amount || 0), 0)
}

// ─── Expense Log ─────────────────────────────────────────────────────────────
export function loadExpenseLog() {
  return load(KEYS.expenses, [])
}

export function appendExpense(entry) {
  const log = loadExpenseLog()
  const saved = { ...entry, id: Date.now(), savedAt: new Date().toISOString() }
  log.unshift(saved)
  save(KEYS.expenses, log.slice(0, 500))
  return saved
}

// ─── Udhar Log ───────────────────────────────────────────────────────────────
export function loadUdharLog() {
  return load(KEYS.udhar, [])
}

export function appendUdhar(entry) {
  const log = loadUdharLog()
  const saved = { ...entry, id: Date.now(), savedAt: new Date().toISOString() }
  log.unshift(saved)
  save(KEYS.udhar, log)
  return saved
}

export function updateUdhar(id, updates) {
  const log = loadUdharLog()
  const idx = log.findIndex(e => e.id === id)
  if (idx !== -1) { log[idx] = { ...log[idx], ...updates } }
  save(KEYS.udhar, log)
}

// ─── Summary helpers ─────────────────────────────────────────────────────────
export function getTodayRevenue() {
  const today = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD
  return loadRevenueLog()
    .filter(e => e.date === today)
    .reduce((sum, e) => sum + (e.amount || 0), 0)
}

export function getTodayCustomers() {
  const today = new Date().toLocaleDateString('en-CA')
  return loadRevenueLog()
    .filter(e => e.date === today)
    .reduce((sum, e) => sum + (e.players || 0), 0)
}

export function getMonthRevenue() {
  const month = new Date().toLocaleDateString('en-CA').slice(0, 7) // YYYY-MM
  return loadRevenueLog()
    .filter(e => e.date?.startsWith(month))
    .reduce((sum, e) => sum + (e.amount || 0), 0)
}
