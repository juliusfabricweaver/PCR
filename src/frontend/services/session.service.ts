/**
 * Session management service for authentication and concurrent session handling
 */
import { ApiResponse } from '@/types'

interface SessionInfo {
  id: string
  userId: number
  deviceId: string
  ipAddress: string
  userAgent: string
  createdAt: string
  lastActivity: string
  expiresAt: string
  isActive: boolean
}

interface ConcurrentSessionData {
  maxSessions: number
  activeSessions: SessionInfo[]
  currentSession: SessionInfo
}

export class SessionService {
  private baseUrl: string
  private authToken: string | null = null
  private sessionId: string | null = null
  private deviceId: string

  constructor(baseUrl: string = '/api') {
    this.baseUrl = baseUrl
    this.deviceId = this.generateDeviceId()
  }

  /**
   * Set authentication token
   */
  setAuthToken(token: string) {
    this.authToken = token
  }

  /**
   * Clear authentication token
   */
  clearAuthToken() {
    this.authToken = null
    this.sessionId = null
  }

  /**
   * Initialize session after login
   */
  async initializeSession(token: string): Promise<SessionInfo> {
    this.authToken = token
    
    const response = await this.makeRequest<ApiResponse>(`${this.baseUrl}/auth/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        deviceId: this.deviceId,
        userAgent: navigator.userAgent,
      }),
    })

    if (!response.success) {
      throw new Error(response.message || 'Failed to initialize session')
    }

    this.sessionId = response.data.id
    return response.data
  }

  /**
   * Extend current session
   */
  async extendSession(): Promise<{ expiresAt: string }> {
    if (!this.authToken || !this.sessionId) {
      throw new Error('No active session to extend')
    }

    const response = await this.makeRequest<ApiResponse>(`${this.baseUrl}/auth/session/extend`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.authToken}`,
      },
    })

    if (!response.success) {
      throw new Error(response.message || 'Failed to extend session')
    }

    return response.data
  }

  /**
   * Invalidate current session (logout)
   */
  async invalidateSession(): Promise<void> {
    if (!this.authToken || !this.sessionId) return

    try {
      await this.makeRequest(`${this.baseUrl}/auth/session/invalidate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.authToken}`,
        },
      })
    } catch (error) {
      console.warn('Failed to invalidate session on server:', error)
    } finally {
      this.clearAuthToken()
    }
  }

  /**
   * Get active sessions for current user
   */
  async getActiveSessions(): Promise<ConcurrentSessionData> {
    if (!this.authToken) {
      throw new Error('No authentication token')
    }

    const response = await this.makeRequest<ApiResponse>(`${this.baseUrl}/auth/sessions`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.authToken}`,
      },
    })

    if (!response.success) {
      throw new Error(response.message || 'Failed to get active sessions')
    }

    return response.data
  }

  /**
   * Terminate a specific session
   */
  async terminateSession(sessionId: string): Promise<void> {
    if (!this.authToken) {
      throw new Error('No authentication token')
    }

    const response = await this.makeRequest<ApiResponse>(`${this.baseUrl}/auth/session/${sessionId}/terminate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.authToken}`,
      },
    })

    if (!response.success) {
      throw new Error(response.message || 'Failed to terminate session')
    }
  }

  /**
   * Terminate all other sessions
   */
  async terminateOtherSessions(): Promise<{ terminatedCount: number }> {
    if (!this.authToken) {
      throw new Error('No authentication token')
    }

    const response = await this.makeRequest<ApiResponse>(`${this.baseUrl}/auth/sessions/terminate-others`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.authToken}`,
      },
    })

    if (!response.success) {
      throw new Error(response.message || 'Failed to terminate other sessions')
    }

    return response.data
  }

  /**
   * Check if session is still valid
   */
  async validateSession(): Promise<boolean> {
    if (!this.authToken || !this.sessionId) return false

    try {
      const response = await this.makeRequest<ApiResponse>(`${this.baseUrl}/auth/session/validate`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.authToken}`,
        },
      })

      return response.success && response.data.isValid
    } catch {
      return false
    }
  }

  /**
   * Update session activity (heartbeat)
   */
  async updateActivity(): Promise<void> {
    if (!this.authToken || !this.sessionId) return

    try {
      await this.makeRequest(`${this.baseUrl}/auth/session/activity`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.authToken}`,
        },
      })
    } catch (error) {
      console.warn('Failed to update session activity:', error)
    }
  }

  /**
   * Get session information
   */
  async getSessionInfo(): Promise<SessionInfo> {
    if (!this.authToken || !this.sessionId) {
      throw new Error('No active session')
    }

    const response = await this.makeRequest<ApiResponse>(`${this.baseUrl}/auth/session/info`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.authToken}`,
      },
    })

    if (!response.success) {
      throw new Error(response.message || 'Failed to get session info')
    }

    return response.data
  }

  /**
   * Handle session conflict (when user logs in from different location)
   */
  async handleSessionConflict(action: 'terminate_others' | 'terminate_current'): Promise<void> {
    if (action === 'terminate_others') {
      await this.terminateOtherSessions()
    } else {
      await this.invalidateSession()
    }
  }

  /**
   * Set up automatic session monitoring
   */
  startSessionMonitoring(intervalMs: number = 60000): () => void {
    const interval = setInterval(async () => {
      try {
        await this.updateActivity()
        const isValid = await this.validateSession()
        
        if (!isValid) {
          console.warn('Session is no longer valid')
          this.clearAuthToken()
          // Trigger logout in the application
          window.dispatchEvent(new CustomEvent('session-invalid'))
        }
      } catch (error) {
        console.error('Session monitoring error:', error)
      }
    }, intervalMs)

    return () => clearInterval(interval)
  }

  /**
   * Generate unique device identifier
   */
  private generateDeviceId(): string {
    const stored = localStorage.getItem('pcr_device_id')
    if (stored) return stored

    const deviceId = 'device_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now()
    localStorage.setItem('pcr_device_id', deviceId)
    return deviceId
  }

  /**
   * Get device information
   */
  getDeviceInfo(): {
    deviceId: string
    userAgent: string
    platform: string
    language: string
  } {
    return {
      deviceId: this.deviceId,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
    }
  }

  /**
   * Make HTTP request with error handling
   */
  private async makeRequest<T = any>(url: string, options: RequestInit = {}): Promise<T> {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      })

      if (!response.ok) {
        if (response.status === 401) {
          this.clearAuthToken()
          throw new Error('Session expired')
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const contentType = response.headers.get('content-type')
      if (contentType?.includes('application/json')) {
        return await response.json()
      } else {
        return response as unknown as T
      }
    } catch (error) {
      console.error('Session service request failed:', error)
      throw error
    }
  }

  /**
   * Get current session ID
   */
  getCurrentSessionId(): string | null {
    return this.sessionId
  }

  /**
   * Check if user has active session
   */
  hasActiveSession(): boolean {
    return !!(this.authToken && this.sessionId)
  }

  /**
   * Clean up session data
   */
  cleanup(): void {
    this.clearAuthToken()
  }
}

/**
 * Concurrent Session Manager Component
 */
export interface ConcurrentSessionManagerProps {
  onSessionConflict: (sessions: SessionInfo[], current: SessionInfo) => void
  maxSessions?: number
}

export class ConcurrentSessionManager {
  private service: SessionService
  private onConflict: (sessions: SessionInfo[], current: SessionInfo) => void
  private maxSessions: number

  constructor(service: SessionService, props: ConcurrentSessionManagerProps) {
    this.service = service
    this.onConflict = props.onSessionConflict
    this.maxSessions = props.maxSessions || 3
  }

  /**
   * Check for session conflicts
   */
  async checkForConflicts(): Promise<void> {
    try {
      const sessionData = await this.service.getActiveSessions()
      
      if (sessionData.activeSessions.length > this.maxSessions) {
        this.onConflict(sessionData.activeSessions, sessionData.currentSession)
      }
    } catch (error) {
      console.error('Failed to check session conflicts:', error)
    }
  }

  /**
   * Start monitoring for concurrent sessions
   */
  startMonitoring(intervalMs: number = 120000): () => void {
    const interval = setInterval(() => {
      this.checkForConflicts()
    }, intervalMs)

    return () => clearInterval(interval)
  }
}

export const sessionService = new SessionService()