import { useState, useEffect } from 'react'
import { getQueueSize } from '../services/retryQueue'

export function useQueueStatus() {
  const [queueSize, setQueueSize] = useState(getQueueSize())

  useEffect(() => {
    const checkQueue = () => setQueueSize(getQueueSize())

    const interval = setInterval(checkQueue, 1000)
    window.addEventListener('online', checkQueue)
    window.addEventListener('offline', checkQueue)

    return () => {
      clearInterval(interval)
      window.removeEventListener('online', checkQueue)
      window.removeEventListener('offline', checkQueue)
    }
  }, [])

  return queueSize
}
