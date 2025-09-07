import { useEffect, useRef, useCallback, useState } from 'react'
import { debounce } from '@/utils'
import { useNotification } from '@/context/NotificationContext'
import { autosaveService } from '@/services/autosave.service'
import { useAuth } from '@/context/AuthContext'

interface UseAutosaveOptions {
  key: string
  data: any
  interval?: number
  enabled?: boolean
  onSave?: (data: any) => Promise<void>
  onError?: (error: Error) => void
  enableBackendSync?: boolean
  offlineMode?: boolean
}

export const useAutosave = ({
  key,
  data,
  interval = 60000, // 60 seconds (reduced frequency)
  enabled = true,
  onSave,
  onError,
  enableBackendSync = false, // Disabled for demo - no backend
  offlineMode = true, // Enabled for demo - use localStorage only
}: UseAutosaveOptions) => {
  const { showNotification } = useNotification()
  const { token } = useAuth()
  const lastSavedRef = useRef<string>('')
  const intervalRef = useRef<NodeJS.Timeout>()
  const isFirstRun = useRef(true)
  const [syncStatus, setSyncStatus] = useState({ connected: true, syncing: false })
  const [draftId, setDraftId] = useState<number | null>(null)

  const safeStringify = useCallback((obj: any) => {
    const seen = new WeakSet()
    return JSON.stringify(obj, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular Reference]'
        }
        seen.add(value)
      }
      return value
    })
  }, [])

  const cleanupOldDrafts = useCallback(() => {
    try {
      const keysToRemove = []
      const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000) // 1 week ago
      
      // Find old PCR drafts
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith('pcr_draft_') && key.endsWith('_timestamp')) {
          const timestamp = localStorage.getItem(key)
          if (timestamp && parseInt(timestamp) < oneWeekAgo) {
            const baseKey = key.replace('_timestamp', '')
            keysToRemove.push(key, baseKey)
          }
        }
      }
      
      // Remove old drafts
      keysToRemove.forEach(key => localStorage.removeItem(key))
      
      return keysToRemove.length > 0
    } catch (error) {
      console.warn('Failed to cleanup old drafts:', error)
      return false
    }
  }, [])

  const saveToLocalStorage = useCallback((dataToSave: any) => {
    try {
      const serializedData = safeStringify(dataToSave)
      localStorage.setItem(`pcr_draft_${key}`, serializedData)
      localStorage.setItem(`pcr_draft_${key}_timestamp`, Date.now().toString())
      lastSavedRef.current = serializedData
      return true
    } catch (error) {
      console.error('Failed to save to localStorage:', error)
      
      // If quota exceeded, try to cleanup and retry once
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.warn('LocalStorage quota exceeded, attempting cleanup...')
        const cleanedUp = cleanupOldDrafts()
        
        if (cleanedUp) {
          try {
            const serializedData = safeStringify(dataToSave)
            localStorage.setItem(`pcr_draft_${key}`, serializedData)
            localStorage.setItem(`pcr_draft_${key}_timestamp`, Date.now().toString())
            lastSavedRef.current = serializedData
            console.log('Successfully saved after cleanup')
            return true
          } catch (retryError) {
            console.error('Failed to save even after cleanup:', retryError)
            return false
          }
        }
      }
      
      return false
    }
  }, [key, safeStringify, cleanupOldDrafts])

  const debouncedSave = useCallback(
    debounce(async (dataToSave: any) => {
      if (!enabled) return

      const serializedData = safeStringify(dataToSave)
      
      // Don't save if data hasn't changed
      if (serializedData === lastSavedRef.current) return

      setSyncStatus(prev => ({ ...prev, syncing: true }))

      try {
        // Save to localStorage first (always works)
        const localSaveSuccess = saveToLocalStorage(dataToSave)
        
        // Try backend sync if enabled and connected
        if (enableBackendSync && token && !offlineMode) {
          try {
            autosaveService.setAuthToken(token)
            const result = await autosaveService.saveDraft(dataToSave, draftId || undefined)
            
            if (!draftId) {
              setDraftId(result.draftId)
            }
            
            setSyncStatus({ connected: true, syncing: false })
            
            if (!isFirstRun.current) {
              showNotification('Draft saved automatically', 'success')
            }
          } catch (backendError) {
            console.warn('Backend save failed, storing offline:', backendError)
            autosaveService.storeOfflineDraft(dataToSave, key)
            setSyncStatus({ connected: false, syncing: false })
            
            if (!isFirstRun.current && localSaveSuccess) {
              showNotification('Draft saved locally (offline)', 'warning')
            }
          }
        } else if (localSaveSuccess && !isFirstRun.current) {
          // Silent save - no notification for local saves in offline mode
          console.log('Draft saved locally (silent)')
        } else if (!localSaveSuccess && !isFirstRun.current) {
          // Show error if localStorage save failed
          showNotification('Failed to save draft - storage full', 'error')
        }

        // If onSave callback is provided, try to save to server
        if (onSave) {
          await onSave(dataToSave)
        }

        isFirstRun.current = false
      } catch (error) {
        console.error('Autosave error:', error)
        setSyncStatus(prev => ({ ...prev, syncing: false }))
        if (onError) {
          onError(error as Error)
        } else {
          showNotification('Failed to save draft', 'error')
        }
      }
    }, 5000), // Debounce saves by 5 seconds (reduced frequency)
    [enabled, saveToLocalStorage, onSave, onError, showNotification, enableBackendSync, token, offlineMode, draftId, key, safeStringify]
  )

  // Load draft from backend or localStorage
  const loadDraft = useCallback(async (fromBackend = true) => {
    try {
      // Try loading from backend first if enabled and connected
      if (fromBackend && enableBackendSync && token && !offlineMode) {
        try {
          autosaveService.setAuthToken(token)
          const drafts = await autosaveService.getUserDrafts(1, 1)
          
          if (drafts.drafts.length > 0) {
            const latestDraft = drafts.drafts[0]
            const draft = await autosaveService.loadDraft(latestDraft.id!)
            setDraftId(latestDraft.id!)
            
            return {
              data: draft.data,
              timestamp: new Date(latestDraft.createdAt),
              age: Date.now() - new Date(latestDraft.createdAt).getTime(),
              source: 'backend' as const,
              expiresAt: new Date(latestDraft.expiresAt),
            }
          }
        } catch (backendError) {
          console.warn('Backend load failed, falling back to local:', backendError)
          setSyncStatus({ connected: false, syncing: false })
        }
      }
      
      // Fallback to localStorage
      const saved = localStorage.getItem(`pcr_draft_${key}`)
      const timestamp = localStorage.getItem(`pcr_draft_${key}_timestamp`)
      
      if (saved && timestamp) {
        const savedData = JSON.parse(saved)
        const savedTime = new Date(parseInt(timestamp))
        
        return {
          data: savedData,
          timestamp: savedTime,
          age: Date.now() - savedTime.getTime(),
          source: 'local' as const,
        }
      }
    } catch (error) {
      console.error('Failed to load draft:', error)
    }
    
    return null
  }, [key, enableBackendSync, token, offlineMode])

  // Clear draft from backend and localStorage
  const clearDraft = useCallback(async () => {
    try {
      // Clear from backend if available
      if (draftId && enableBackendSync && token && !offlineMode) {
        try {
          autosaveService.setAuthToken(token)
          await autosaveService.deleteDraft(draftId)
          setDraftId(null)
        } catch (backendError) {
          console.warn('Backend clear failed:', backendError)
        }
      }
      
      // Clear from localStorage
      localStorage.removeItem(`pcr_draft_${key}`)
      localStorage.removeItem(`pcr_draft_${key}_timestamp`)
    } catch (error) {
      console.error('Failed to clear draft:', error)
    }
  }, [key, draftId, enableBackendSync, token, offlineMode])

  // Check if draft exists
  const hasDraft = useCallback(async (checkBackend = true) => {
    try {
      // Check backend first if enabled
      if (checkBackend && enableBackendSync && token && !offlineMode) {
        try {
          autosaveService.setAuthToken(token)
          const drafts = await autosaveService.getUserDrafts(1, 1)
          if (drafts.drafts.length > 0) {
            return true
          }
        } catch (backendError) {
          console.warn('Backend draft check failed:', backendError)
        }
      }
      
      // Check localStorage
      return localStorage.getItem(`pcr_draft_${key}`) !== null
    } catch (error) {
      console.error('Failed to check draft existence:', error)
      return false
    }
  }, [key, enableBackendSync, token, offlineMode])

  // Auto-save effect
  useEffect(() => {
    if (!enabled || !data) return

    debouncedSave(data)

    return () => {
      debouncedSave.cancel?.()
    }
  }, [data, enabled, debouncedSave])

  // Periodic save (backup)
  useEffect(() => {
    if (!enabled || interval <= 0) return

    intervalRef.current = setInterval(() => {
      if (data) {
        const serializedData = safeStringify(data)
        // Only save if data has changed since last save
        if (serializedData !== lastSavedRef.current) {
          saveToLocalStorage(data)
        }
      }
    }, interval)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [enabled, interval, data, saveToLocalStorage])

  // Sync offline changes when connection is restored
  const syncOfflineChanges = useCallback(async () => {
    if (!enableBackendSync || !token || offlineMode) return
    
    try {
      setSyncStatus(prev => ({ ...prev, syncing: true }))
      autosaveService.setAuthToken(token)
      const result = await autosaveService.syncOfflineChanges()
      
      if (result.synced > 0) {
        showNotification(`Synced ${result.synced} offline changes`, 'success')
      }
      
      setSyncStatus({ connected: true, syncing: false })
    } catch (error) {
      console.error('Offline sync failed:', error)
      setSyncStatus({ connected: false, syncing: false })
    }
  }, [enableBackendSync, token, offlineMode, showNotification])

  // Monitor connection status
  useEffect(() => {
    if (!enableBackendSync || !token) return
    
    const checkConnection = async () => {
      const status = await autosaveService.getSyncStatus()
      setSyncStatus(prev => ({ ...prev, connected: status.connected }))
      
      // Auto-sync offline changes when connection is restored
      if (status.connected && status.pendingChanges > 0) {
        await syncOfflineChanges()
      }
    }
    
    // Check connection immediately
    checkConnection()
    
    // Set up periodic connection checks
    const connectionInterval = setInterval(checkConnection, 30000) // Check every 30 seconds
    
    return () => clearInterval(connectionInterval)
  }, [enableBackendSync, token, syncOfflineChanges])

  // Initial cleanup and setup
  useEffect(() => {
    // Cleanup old drafts on mount to prevent quota issues
    cleanupOldDrafts()
  }, [cleanupOldDrafts])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      autosaveService.cleanup()
    }
  }, [])

  return {
    loadDraft,
    clearDraft,
    hasDraft,
    saveNow: () => debouncedSave(data),
    syncStatus,
    syncOfflineChanges,
    draftId,
  }
}
