/**
 * Session timeout management hook with warning modal and extension capability
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useNotification } from '@/context/NotificationContext'

interface SessionTimeoutConfig {
  timeoutMinutes?: number
  warningMinutes?: number
  checkIntervalSeconds?: number
  autoExtendOnActivity?: boolean
}

interface SessionTimeoutState {
  isActive: boolean
  timeRemaining: number
  showWarning: boolean
  lastActivity: Date
}

interface UseSessionTimeoutReturn {
  sessionState: SessionTimeoutState
  extendSession: () => Promise<void>
  endSession: () => void
  resetTimeout: () => void
  isSessionActive: boolean
}

export const useSessionTimeout = (config: SessionTimeoutConfig = {}): UseSessionTimeoutReturn => {
  const {
    timeoutMinutes = 15,
    warningMinutes = 1,
    checkIntervalSeconds = 30,
    autoExtendOnActivity = true,
  } = config

  const { logout, extendSession: authExtendSession } = useAuth()
  const { showNotification } = useNotification()

  const [sessionState, setSessionState] = useState<SessionTimeoutState>({
    isActive: true,
    timeRemaining: timeoutMinutes * 60 * 1000, // milliseconds
    showWarning: false,
    lastActivity: new Date(),
  })

  const timeoutRef = useRef<NodeJS.Timeout>()
  const warningTimeoutRef = useRef<NodeJS.Timeout>()
  const checkIntervalRef = useRef<NodeJS.Timeout>()
  const activityListeners = useRef<(() => void)[]>([])

  /**
   * Reset the session timeout
   */
  const resetTimeout = useCallback(() => {
    const now = new Date()
    setSessionState(prev => ({
      ...prev,
      timeRemaining: timeoutMinutes * 60 * 1000,
      showWarning: false,
      lastActivity: now,
      isActive: true,
    }))

    // Clear existing timeouts
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current)

    // Set warning timeout (show warning X minutes before timeout)
    const warningTime = (timeoutMinutes - warningMinutes) * 60 * 1000
    warningTimeoutRef.current = setTimeout(() => {
      setSessionState(prev => ({ ...prev, showWarning: true }))
      showNotification(
        `Your session will expire in ${warningMinutes} minute${warningMinutes > 1 ? 's' : ''}. Click to extend.`,
        'warning'
      )
    }, warningTime)

    // Set main timeout
    timeoutRef.current = setTimeout(() => {
      handleSessionTimeout()
    }, timeoutMinutes * 60 * 1000)
  }, [timeoutMinutes, warningMinutes, showNotification])

  /**
   * Handle session timeout
   */
  const handleSessionTimeout = useCallback(() => {
    setSessionState(prev => ({ 
      ...prev, 
      isActive: false, 
      timeRemaining: 0,
      showWarning: false 
    }))
    
    showNotification('Your session has expired due to inactivity.', 'error')
    logout()
  }, [logout, showNotification])

  /**
   * Extend the session
   */
  const extendSession = useCallback(async () => {
    try {
      await authExtendSession()
      resetTimeout()
      showNotification('Session extended successfully', 'success')
    } catch (error) {
      console.error('Failed to extend session:', error)
      showNotification('Failed to extend session', 'error')
      handleSessionTimeout()
    }
  }, [authExtendSession, resetTimeout, showNotification, handleSessionTimeout])

  /**
   * End session manually
   */
  const endSession = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current)
    if (checkIntervalRef.current) clearInterval(checkIntervalRef.current)
    
    setSessionState(prev => ({ 
      ...prev, 
      isActive: false, 
      timeRemaining: 0,
      showWarning: false 
    }))
    
    logout()
  }, [logout])

  /**
   * Track user activity
   */
  const handleActivity = useCallback(() => {
    if (autoExtendOnActivity && sessionState.isActive) {
      const now = new Date()
      const timeSinceLastActivity = now.getTime() - sessionState.lastActivity.getTime()
      
      // Only reset if it's been more than 1 minute since last activity
      if (timeSinceLastActivity > 60000) {
        resetTimeout()
      } else {
        // Just update last activity time
        setSessionState(prev => ({ ...prev, lastActivity: now }))
      }
    }
  }, [autoExtendOnActivity, sessionState.isActive, sessionState.lastActivity, resetTimeout])

  /**
   * Update time remaining counter
   */
  const updateTimeRemaining = useCallback(() => {
    setSessionState(prev => {
      if (!prev.isActive) return prev

      const now = new Date()
      const elapsed = now.getTime() - prev.lastActivity.getTime()
      const remaining = Math.max(0, timeoutMinutes * 60 * 1000 - elapsed)

      return {
        ...prev,
        timeRemaining: remaining,
      }
    })
  }, [timeoutMinutes])

  // Initialize session timeout
  useEffect(() => {
    resetTimeout()
    
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current)
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current)
    }
  }, [resetTimeout])

  // Set up activity listeners
  useEffect(() => {
    if (!autoExtendOnActivity) return

    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
    
    const throttledHandleActivity = throttle(handleActivity, 1000) // Throttle to once per second

    activityEvents.forEach(event => {
      document.addEventListener(event, throttledHandleActivity, { passive: true })
      activityListeners.current.push(() => {
        document.removeEventListener(event, throttledHandleActivity)
      })
    })

    return () => {
      activityListeners.current.forEach(cleanup => cleanup())
      activityListeners.current = []
    }
  }, [autoExtendOnActivity, handleActivity])

  // Set up time remaining update interval
  useEffect(() => {
    checkIntervalRef.current = setInterval(updateTimeRemaining, checkIntervalSeconds * 1000)
    
    return () => {
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current)
    }
  }, [updateTimeRemaining, checkIntervalSeconds])

  return {
    sessionState,
    extendSession,
    endSession,
    resetTimeout,
    isSessionActive: sessionState.isActive,
  }
}

/**
 * Session timeout warning modal component
 */
export const SessionTimeoutModal: React.FC<{
  isOpen: boolean
  timeRemaining: number
  onExtend: () => void
  onEndSession: () => void
}> = ({ isOpen, timeRemaining, onExtend, onEndSession }) => {
  if (!isOpen) return null

  const minutes = Math.floor(timeRemaining / (1000 * 60))
  const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          <div className="flex items-center mb-4">
            <div className="flex-shrink-0">
              <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 18.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                Session Timeout Warning
              </h3>
            </div>
          </div>
          
          <div className="mb-6">
            <p className="text-gray-700 dark:text-gray-300 mb-2">
              Your session will expire in:
            </p>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400 text-center bg-gray-100 dark:bg-gray-700 rounded-lg py-3">
              {minutes}:{seconds.toString().padStart(2, '0')}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 text-center">
              You will be automatically logged out due to inactivity.
            </p>
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={onExtend}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Extend Session
            </button>
            <button
              onClick={onEndSession}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Logout Now
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Session status indicator component
 */
export const SessionStatusIndicator: React.FC<{
  isActive: boolean
  timeRemaining: number
  showTime?: boolean
}> = ({ isActive, timeRemaining, showTime = true }) => {
  if (!isActive) return null

  const minutes = Math.floor(timeRemaining / (1000 * 60))
  const isNearExpiry = minutes < 5

  return (
    <div className={`flex items-center space-x-2 text-sm ${
      isNearExpiry ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'
    }`}>
      <div className={`w-2 h-2 rounded-full ${
        isNearExpiry ? 'bg-red-500 animate-pulse' : 'bg-green-500'
      }`} />
      {showTime && (
        <span>
          Session: {minutes}m remaining
        </span>
      )}
    </div>
  )
}

/**
 * Throttle function to limit function calls
 */
function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean
  return function (this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}