import { useState, useEffect, useRef, useCallback } from 'react'
import { STATIONS, PRICING } from '../config'
import { loadSessions, saveSession, clearSession } from '../services/storage'
import { playHourlyChime, showHourlyNotification } from '../services/audio'
import { getActiveSessions, saveActiveSessions } from '../services/sheetsApi'

function calcPrice(elapsedSecs, players) {
  const hours = elapsedSecs / 3600
  const rate = players >= 2 ? PRICING.ps5.multi * players : PRICING.ps5.single
  return Math.round(hours * rate)
}

function initialState() {
  const persisted = loadSessions()
  const state = {}
  STATIONS.forEach(s => {
    const saved = persisted[s.id]
    state[s.id] = {
      id: s.id,
      name: s.name,
      color: s.color,
      isRunning: saved?.isRunning || false,
      startTime: saved?.startTime || null,
      accumulatedSecs: saved?.accumulatedSecs || 0,
      players: saved?.players || 1,
      lastHourNotified: saved?.lastHourNotified || 0,
    }
  })
  return state
}

export function useSessions() {
  const [sessions, setSessions] = useState(initialState)
  const tickRef = useRef(null)
  const syncTimeoutRef = useRef(null)
  // Offset between server clock and local clock: serverTime - Date.now()
  // Kept in a ref so getElapsed always reads the latest value without re-creating the callback
  const clockOffsetRef = useRef(0)

  // "Server now" — local clock corrected by the last known offset
  const serverNow = useCallback(() => Date.now() + clockOffsetRef.current, [])

  const getElapsed = useCallback((session) => {
    if (!session.isRunning || !session.startTime) return session.accumulatedSecs
    return session.accumulatedSecs + Math.floor((serverNow() - session.startTime) / 1000)
  }, [serverNow])

  // Push current session state to Apps Script for cross-device sync
  const pushToCloud = useCallback((state) => {
    clearTimeout(syncTimeoutRef.current)
    syncTimeoutRef.current = setTimeout(() => {
      const toSync = {}
      Object.values(state).forEach(s => {
        toSync[s.id] = {
          id: s.id,
          isRunning: s.isRunning,
          startTime: s.startTime,
          accumulatedSecs: s.accumulatedSecs,
          players: s.players,
          lastHourNotified: s.lastHourNotified,
        }
      })
      saveActiveSessions(toSync).catch(() => {})
    }, 300) // debounce rapid changes
  }, [])

  // Fetch cloud state and merge into local — runs on mount and on visibility restore
  const syncFromCloud = useCallback(() => {
    getActiveSessions().then(res => {
      if (!res.ok || !res.data?.sessions) return
      // Sync clock offset so all devices use the same reference clock
      if (res.data.serverTime) {
        clockOffsetRef.current = res.data.serverTime - Date.now()
      }
      const cloud = res.data.sessions
      setSessions(prev => {
        let changed = false
        const next = { ...prev }
        Object.values(cloud).forEach(cs => {
          const local = prev[cs.id]
          if (!local) return
          // Cloud says running but local says idle → another device started it
          if (cs.isRunning && !local.isRunning) {
            next[cs.id] = { ...local, isRunning: true, startTime: cs.startTime, accumulatedSecs: cs.accumulatedSecs, players: cs.players }
            saveSession(cs.id, next[cs.id])
            changed = true
          }
          // Cloud says stopped but local says running → another device stopped it
          if (!cs.isRunning && local.isRunning) {
            const elapsed = local.accumulatedSecs + Math.floor((Date.now() - local.startTime) / 1000)
            next[cs.id] = { ...local, isRunning: false, startTime: null, accumulatedSecs: elapsed }
            saveSession(cs.id, next[cs.id])
            changed = true
          }
        })
        return changed ? next : prev
      })
    }).catch(() => {})
  }, [])

  useEffect(() => {
    syncFromCloud()
    const onVisible = () => { if (document.visibilityState === 'visible') syncFromCloud() }
    document.addEventListener('visibilitychange', onVisible)
    // Poll every 10s so a stop/start on another device is reflected within 10s
    const pollId = setInterval(syncFromCloud, 10000)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(pollId)
    }
  }, [syncFromCloud])

  // Tick every second to update elapsed time
  useEffect(() => {
    tickRef.current = setInterval(() => {
      setSessions(prev => {
        const next = { ...prev }
        let anyRunning = false

        Object.values(prev).forEach(s => {
          if (!s.isRunning) return
          anyRunning = true
          const elapsed = getElapsed(s)
          const completedHours = Math.floor(elapsed / 3600)

          if (completedHours > 0 && completedHours !== s.lastHourNotified) {
            playHourlyChime()
            showHourlyNotification(s.name, completedHours)
            next[s.id] = { ...s, lastHourNotified: completedHours }
            saveSession(s.id, next[s.id])
          }
        })

        // Always return a new object when a session is running so React re-renders
        // and sessionList recalculates elapsed from fresh Date.now()
        return anyRunning ? { ...next } : prev
      })
    }, 1000)

    return () => { clearInterval(tickRef.current); clearTimeout(syncTimeoutRef.current) }
  }, [getElapsed])

  const startSession = useCallback((stationId) => {
    setSessions(prev => {
      const s = prev[stationId]
      if (s.isRunning) return prev
      const updated = { ...s, isRunning: true, startTime: serverNow() }
      saveSession(stationId, updated)
      const next = { ...prev, [stationId]: updated }
      pushToCloud(next)
      return next
    })
  }, [serverNow, pushToCloud])

  const stopSession = useCallback((stationId) => {
    setSessions(prev => {
      const s = prev[stationId]
      if (!s.isRunning) return prev
      const elapsed = getElapsed(s)
      const updated = { ...s, isRunning: false, startTime: null, accumulatedSecs: elapsed }
      saveSession(stationId, updated)
      const next = { ...prev, [stationId]: updated }
      pushToCloud(next)
      return next
    })
  }, [getElapsed, pushToCloud])

  const setPlayers = useCallback((stationId, players) => {
    setSessions(prev => {
      const updated = { ...prev[stationId], players }
      saveSession(stationId, updated)
      const next = { ...prev, [stationId]: updated }
      pushToCloud(next)
      return next
    })
  }, [pushToCloud])

  const resetSession = useCallback((stationId) => {
    setSessions(prev => {
      const s = prev[stationId]
      const reset = { ...s, isRunning: false, startTime: null, accumulatedSecs: 0, lastHourNotified: 0 }
      clearSession(stationId)
      const next = { ...prev, [stationId]: reset }
      pushToCloud(next)
      return next
    })
  }, [pushToCloud])

  const sessionList = Object.values(sessions).map(s => ({
    ...s,
    elapsed: getElapsed(s),
    currentCharge: calcPrice(getElapsed(s), s.players),
  }))

  return { sessions: sessionList, startSession, stopSession, setPlayers, resetSession }
}
