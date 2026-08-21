import { useEffect } from 'react'
import { retryAll } from '../services/retryQueue'

export function useRetryOnline() {
  useEffect(() => {
    const handleOnline = async () => {
      await retryAll()
    }

    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])
}
