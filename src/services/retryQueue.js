// Retry queue for cloud writes that fail due to network issues
// Stores failed operations locally and retries when connection is restored

const QUEUE_KEY = 'bg_retry_queue'
const MAX_RETRIES = 5

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

export function queueOperation(operation, operationName, params) {
  const queue = loadQueue()
  queue.push({
    id: generateId(),
    operation,
    operationName,
    params,
    retries: 0,
    queuedAt: new Date().toISOString(),
  })
  saveQueue(queue)
}

export async function retryAll() {
  const queue = loadQueue()
  if (queue.length === 0) return

  const stillFailed = []

  for (const item of queue) {
    try {
      const result = await item.operation(...Object.values(item.params))

      if (result && !result.ok) {
        item.retries++
        if (item.retries < MAX_RETRIES) {
          stillFailed.push(item)
        }
      }
    } catch (err) {
      item.retries++
      if (item.retries < MAX_RETRIES) {
        stillFailed.push(item)
      }
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
