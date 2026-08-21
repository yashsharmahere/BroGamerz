import { useEffect } from 'react'
import { retryAll, getQueueSize } from '../services/retryQueue'

const RETRY_INTERVAL_MS = 20000

// Drives the retry queue. Retrying only on the browser's `online` event isn't
// enough: an entry queued while already "online" (e.g. connected to WiFi that
// has no internet) would never get a retry, and a single failed retry on
// reconnect would strand the entry forever. So we also retry once on mount and
// on a steady interval while there is anything queued.
export function useRetryOnline() {
  useEffect(() => {
    const attempt = () => {
      if (navigator.onLine && getQueueSize() > 0) retryAll()
    }

    attempt() // drain anything left over from a previous visit
    window.addEventListener('online', attempt)
    const interval = setInterval(attempt, RETRY_INTERVAL_MS)

    return () => {
      window.removeEventListener('online', attempt)
      clearInterval(interval)
    }
  }, [])
}
