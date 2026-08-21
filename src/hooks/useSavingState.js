import { useState, useCallback } from 'react'

export function useSavingState() {
  const [isSaving, setIsSaving] = useState(false)

  const withSaving = useCallback(async (fn) => {
    setIsSaving(true)
    try {
      await fn()
    } finally {
      setIsSaving(false)
    }
  }, [])

  return { isSaving, withSaving }
}
