/**
 * Autosave service for seamless backend integration with encryption
 */
import { ApiResponse, PCRFormData } from '@/types'

interface AutosaveOptions {
  debounceMs?: number
  maxRetries?: number
  retryDelayMs?: number
}

interface DraftMetadata {
  id?: number
  createdAt: string
  expiresAt: string
  isEncrypted: boolean
  version: number
}

interface SavedDraft {
  metadata: DraftMetadata
  data: Partial<PCRFormData>
}

export class AutosaveService {
  private baseUrl: string
  private authToken: string | null = null
  private options: Required<AutosaveOptions>
  private abortController: AbortController | null = null

  constructor(baseUrl: string = '/api', options: AutosaveOptions = {}) {
    this.baseUrl = baseUrl
    this.options = {
      debounceMs: options.debounceMs ?? 2000,
      maxRetries: options.maxRetries ?? 3,
      retryDelayMs: options.retryDelayMs ?? 1000,
    }
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
  }

  /**
   * Save draft to backend with encryption
   */
  async saveDraft(
    data: Partial<PCRFormData>,
    draftId?: number
  ): Promise<{ success: boolean; draftId: number; expiresAt: string }> {
    const url = draftId ? `${this.baseUrl}/drafts/${draftId}` : `${this.baseUrl}/drafts`
    const method = draftId ? 'PUT' : 'POST'

    // Cancel any pending save request
    if (this.abortController) {
      this.abortController.abort()
    }

    this.abortController = new AbortController()

    const response = await this.makeRequest<ApiResponse>(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(this.authToken && { Authorization: `Bearer ${this.authToken}` }),
      },
      body: JSON.stringify({ data }),
      signal: this.abortController.signal,
    })

    if (!response.success) {
      throw new Error(response.message || 'Failed to save draft')
    }

    return {
      success: true,
      draftId: response.data.id,
      expiresAt: response.data.expiresAt,
    }
  }

  /**
   * Load draft from backend with decryption
   */
  async loadDraft(draftId: number): Promise<SavedDraft> {
    const url = `${this.baseUrl}/drafts/${draftId}`

    const response = await this.makeRequest<ApiResponse>(url, {
      method: 'GET',
      headers: {
        ...(this.authToken && { Authorization: `Bearer ${this.authToken}` }),
      },
    })

    if (!response.success) {
      throw new Error(response.message || 'Failed to load draft')
    }

    return {
      metadata: {
        id: response.data.id,
        createdAt: response.data.createdAt,
        expiresAt: response.data.expiresAt,
        isEncrypted: true,
        version: 1,
      },
      data: response.data.data,
    }
  }

  /**
   * Get all drafts for current user
   */
  async getUserDrafts(page: number = 1, limit: number = 10): Promise<{
    drafts: DraftMetadata[]
    total: number
    pages: number
  }> {
    const url = `${this.baseUrl}/drafts?page=${page}&limit=${limit}`

    const response = await this.makeRequest<ApiResponse>(url, {
      method: 'GET',
      headers: {
        ...(this.authToken && { Authorization: `Bearer ${this.authToken}` }),
      },
    })

    if (!response.success) {
      throw new Error(response.message || 'Failed to load drafts')
    }

    return {
      drafts: response.data.items.map((item: any) => ({
        id: item.id,
        createdAt: item.created_at,
        expiresAt: item.expires_at,
        isEncrypted: true,
        version: 1,
      })),
      total: response.data.total,
      pages: response.data.pages,
    }
  }

  /**
   * Delete draft
   */
  async deleteDraft(draftId: number): Promise<boolean> {
    const url = `${this.baseUrl}/drafts/${draftId}`

    const response = await this.makeRequest<ApiResponse>(url, {
      method: 'DELETE',
      headers: {
        ...(this.authToken && { Authorization: `Bearer ${this.authToken}` }),
      },
    })

    return response.success
  }

  /**
   * Check connection to backend
   */
  async checkConnection(): Promise<boolean> {
    try {
      const response = await this.makeRequest(`${this.baseUrl}/health`, {
        method: 'GET',
        timeout: 5000,
      })
      return true
    } catch {
      return false
    }
  }

  /**
   * Get sync status with backend
   */
  async getSyncStatus(): Promise<{
    connected: boolean
    lastSync: string | null
    pendingChanges: number
  }> {
    const connected = await this.checkConnection()
    
    return {
      connected,
      lastSync: localStorage.getItem('pcr_last_sync'),
      pendingChanges: this.getPendingChangesCount(),
    }
  }

  /**
   * Handle offline sync when connection is restored
   */
  async syncOfflineChanges(): Promise<{ synced: number; failed: number }> {
    const pendingKeys = this.getPendingDraftKeys()
    let synced = 0
    let failed = 0

    for (const key of pendingKeys) {
      try {
        const draftData = localStorage.getItem(key)
        if (!draftData) continue

        const data = JSON.parse(draftData)
        await this.saveDraft(data)
        localStorage.removeItem(key)
        synced++
      } catch {
        failed++
      }
    }

    if (synced > 0) {
      localStorage.setItem('pcr_last_sync', new Date().toISOString())
    }

    return { synced, failed }
  }

  /**
   * Make HTTP request with retries and error handling
   */
  private async makeRequest<T = any>(
    url: string, 
    options: RequestInit & { timeout?: number } = {}
  ): Promise<T> {
    const { timeout = 10000, ...fetchOptions } = options
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= this.options.maxRetries; attempt++) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), timeout)

        const response = await fetch(url, {
          ...fetchOptions,
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const contentType = response.headers.get('content-type')
        if (contentType?.includes('application/json')) {
          return await response.json()
        } else {
          return response as unknown as T
        }
      } catch (error) {
        lastError = error as Error
        
        // Don't retry on abort
        if (error instanceof DOMException && error.name === 'AbortError') {
          throw error
        }

        // Don't retry on auth errors
        if (error instanceof Error && error.message.includes('401')) {
          throw error
        }

        if (attempt < this.options.maxRetries) {
          await new Promise(resolve => 
            setTimeout(resolve, this.options.retryDelayMs * attempt)
          )
        }
      }
    }

    throw lastError || new Error('Request failed after maximum retries')
  }

  /**
   * Get count of pending offline changes
   */
  private getPendingChangesCount(): number {
    return this.getPendingDraftKeys().length
  }

  /**
   * Get keys of pending draft changes
   */
  private getPendingDraftKeys(): string[] {
    const keys = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith('pcr_draft_pending_')) {
        keys.push(key)
      }
    }
    return keys
  }

  /**
   * Store draft offline for later sync
   */
  storeOfflineDraft(data: Partial<PCRFormData>, draftKey: string) {
    const key = `pcr_draft_pending_${draftKey}_${Date.now()}`
    localStorage.setItem(key, JSON.stringify(data))
  }

  /**
   * Clean up aborted requests
   */
  cleanup() {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
  }
}

export const autosaveService = new AutosaveService()