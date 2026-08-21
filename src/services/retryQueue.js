// Retry queue for cloud writes that fail due to network issues.
//
// Failed operations are persisted in localStorage and retried when the
// connection is restored. Because localStorage can only hold JSON, the queue
// stores a *serializable descriptor* — an operation name plus its payload —
// NOT a function (functions do not survive JSON.stringify and would come back
// undefined, so the queue could never actually replay them). At retry time the
// descriptor is dispatched through the HANDLERS registry below.

import {
  logSession, logManualRevenue, logExpense, logUdhar, settleUdhar,
  updateSessionInSheet, deleteSessionFromSheet, updateDayRevenue,
} from './sheetsApi'
import {
  writeSession, writeExpense, writeUdhar, updateUdharFb,
} from './firebaseDb'

const QUEUE_KEY = 'bg_retry_queue'
const MAX_RETRIES = 5

// Each handler takes a single JSON-serializable payload and performs the write.
// The same handler is used for both the live attempt and every later retry, so
// a queued operation replays byte-for-byte identically.
const HANDLERS = {
  logSession:             (p) => logSession(p),
  logManualRevenue:       (p) => logManualRevenue(p),
  logExpense:             (p) => logExpense(p),
  logUdhar:               (p) => logUdhar(p),
  settleUdhar:            (p) => settleUdhar(p),
  updateSessionInSheet:   (p) => updateSessionInSheet(p),
  deleteSessionFromSheet: (p) => deleteSessionFromSheet(p.id),
  updateDayRevenue:       (p) => updateDayRevenue(p),
  writeSession:           (p) => writeSession(p),
  writeExpense:           (p) => writeExpense(p),
  writeUdhar:             (p) => writeUdhar(p),
  updateUdharFb:          (p) => updateUdharFb(p.id, p.updates),
}

function loadQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveQueue(queue) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
  } catch {}
}

function generateId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`
}

// Persist a failed operation (by name + payload) for later retry.
export function queueOperation(operationName, payload) {
  if (!HANDLERS[operationName]) {
    console.warn('queueOperation: unknown operation', operationName)
    return
  }
  const queue = loadQueue()
  queue.push({
    id: generateId(),
    operationName,
    payload,
    retries: 0,
    queuedAt: new Date().toISOString(),
  })
  saveQueue(queue)
}

// A write "failed" if it threw/rejected OR resolved with { ok: false }. The
// Sheets layer (callScript) swallows network errors and resolves { ok: false }
// rather than rejecting, so a plain `.catch()` would never fire — this checks
// both signals. Firebase SDK writes resolve to undefined and self-heal offline.
function failed(result) {
  return result && result.ok === false
}

// Run an operation now; queue it for retry if it fails. Returns the result of
// the live attempt. Both the live call and later retries go through the same
// registered handler, keyed by operationName.
export async function runOrQueue(operationName, payload) {
  const handler = HANDLERS[operationName]
  if (!handler) {
    console.warn('runOrQueue: unknown operation', operationName)
    return { ok: false, reason: 'unknown_operation' }
  }
  try {
    const result = await handler(payload)
    if (failed(result)) queueOperation(operationName, payload)
    return result
  } catch (err) {
    queueOperation(operationName, payload)
    return { ok: false, reason: 'exception' }
  }
}

export async function retryAll() {
  const queue = loadQueue()
  if (queue.length === 0) return

  const stillFailed = []

  for (const item of queue) {
    const handler = HANDLERS[item.operationName]
    if (!handler) continue // unknown op from an older build — drop it

    try {
      const result = await handler(item.payload)
      if (failed(result)) {
        item.retries++
        if (item.retries < MAX_RETRIES) stillFailed.push(item)
      }
    } catch (err) {
      item.retries++
      if (item.retries < MAX_RETRIES) stillFailed.push(item)
    }
  }

  saveQueue(stillFailed)
}

export function getQueueSize() {
  return loadQueue().length
}

export function clearQueue() {
  saveQueue([])
}
