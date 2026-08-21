import { useState, useEffect } from 'react'

// Tracks the device's connectivity. NOTE: navigator.onLine is only false when
// there is no network interface at all (WiFi off / airplane mode). If you are
// connected to a WiFi access point that itself has no internet (e.g. the café
// line is down), navigator.onLine stays true — so this is a fast hint, not the
// whole truth. The retry queue (a write that actually failed) is the reliable
// signal for "connected but can't reach the server."
export function useOnlineStatus() {
  const [online, setOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine
  )

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  return online
}
