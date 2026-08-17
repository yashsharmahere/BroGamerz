import { APPS_SCRIPT_URL } from '../config'

const isConfigured = () => Boolean(APPS_SCRIPT_URL)

async function callScript(payload) {
  if (!isConfigured()) return { ok: false, reason: 'not_configured' }
  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    return { ok: true, data }
  } catch (err) {
    console.error('Sheets API error:', err)
    return { ok: false, reason: 'network_error' }
  }
}

async function getFromScript(params) {
  if (!isConfigured()) return { ok: false, reason: 'not_configured' }
  try {
    const url = new URL(APPS_SCRIPT_URL)
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
    url.searchParams.set('_t', Date.now()) // bust cache
    const res = await fetch(url.toString(), { cache: 'no-store' })
    const data = await res.json()
    return { ok: true, data }
  } catch (err) {
    console.error('Sheets API error:', err)
    return { ok: false, reason: 'network_error' }
  }
}

export function configured() {
  return isConfigured()
}

// Log a completed PS5 session to Daily Revenue tab + Sessions sheet (for cross-device log)
export async function logSession({ id, date, station, stationIndex, amount, players, durationMins, notes, savedAt }) {
  return callScript({
    action: 'logSession',
    id,
    date,
    station,
    stationIndex,
    amount,
    players,
    durationMins,
    notes: notes || '',
    savedAt,
  })
}

// Log an expense to Expenses tab
export async function logExpense({ date, paidBy, category, description, amount, paymentMethod, recurring, notes }) {
  return callScript({
    action: 'logExpense',
    date,
    paidBy,
    category,
    description,
    amount,
    paymentMethod,
    recurring: recurring || 'One-time',
    notes: notes || '',
  })
}

// Log advance/udhar to Udhar tab
export async function logUdhar({ customerName, amount, type, date, notes }) {
  return callScript({ action: 'logUdhar', customerName, amount, type, date, notes: notes || '' })
}

// Log other/manual revenue entry
export async function logManualRevenue({ date, otherRevenue, customers, notes }) {
  return callScript({ action: 'logManualRevenue', date, otherRevenue, customers, notes: notes || '' })
}

// Get dashboard data
export async function getDashboard() {
  return getFromScript({ action: 'getDashboard' })
}

// Get udhar list
export async function getUdharList() {
  return getFromScript({ action: 'getUdhar' })
}

// Get daily revenue for a date range
export async function getDailyRevenue(month) {
  return getFromScript({ action: 'getDailyRevenue', month })
}

// Overwrite a station's daily total (used after editing/deleting a session)
export async function updateDayRevenue({ date, stationIndex, newTotal }) {
  return callScript({ action: 'updateDayRevenue', date, stationIndex, newTotal })
}

// Mark an udhar/advance entry as settled in the Sheet
export async function settleUdhar({ customerName, amount, type, date }) {
  return callScript({ action: 'settleUdhar', customerName, amount, type, date })
}

// Cross-device session sync via Apps Script PropertiesService
export async function getActiveSessions() {
  return getFromScript({ action: 'getActiveSessions' })
}

export async function saveActiveSessions(sessions) {
  return callScript({ action: 'saveActiveSessions', sessions })
}

// Shared session log (Sessions sheet) — individual entries with IDs
export async function getSessions(month) {
  return getFromScript({ action: 'getSessions', month })
}

export async function getExpenses() {
  return getFromScript({ action: 'getExpenses' })
}

export async function updateSessionInSheet(entry) {
  return callScript({ action: 'updateSession', ...entry })
}

export async function deleteSessionFromSheet(id) {
  return callScript({ action: 'deleteSession', id })
}
