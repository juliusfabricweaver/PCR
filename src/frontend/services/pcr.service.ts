/**
 * PCR form service for submissions and drafts
 */
import type { PCRFormData, ApiResponse } from '@/types'

interface SubmissionResponse {
  success: boolean
  data?: {
    id: string
    submittedAt: string
  }
  message?: string
}

interface DraftResponse {
  success: boolean
  data?: {
    id: string
    savedAt: string
  }
  message?: string
}

interface PCRReport {
  id: string
  formData: PCRFormData
  submittedAt: string
  submittedBy: string
}

export class PCRService {
  private baseUrl: string = '/api'

  /**
   * Get authentication token from localStorage
   */
  private getAuthToken(): string | null {
    return localStorage.getItem('pcr_token')
  }

  /**
   * Make authenticated request
   */
  private async makeRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
    const token = this.getAuthToken()

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    })

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Authentication required')
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const contentType = response.headers.get('content-type')
    if (contentType?.includes('application/json')) {
      return await response.json()
    } else {
      return response as unknown as T
    }
  }

  /**
   * Submit completed PCR form
   */
  async submitPCR(formData: PCRFormData, printTimestamp?: string): Promise<SubmissionResponse> {
    try {
      const response = await this.makeRequest<ApiResponse>(`${this.baseUrl}/submissions`, {
        method: 'POST',
        body: JSON.stringify({
          data: {
            ...formData,
            ...(printTimestamp ? { printedAt: printTimestamp, printConfirmed: true } : {})
          }
        })
      })

      return {
        success: response.success,
        data: response.data,
        message: response.message
      }
    } catch (error) {
      console.error('PCR submission failed:', error)
      throw error
    }
  }

  /**
   * Save draft PCR form
   */
  async saveDraft(formData: Partial<PCRFormData>, draftId?: string): Promise<DraftResponse> {
    try {
      const url = draftId
        ? `${this.baseUrl}/pcr/drafts/${draftId}`
        : `${this.baseUrl}/pcr/drafts`

      const method = draftId ? 'PUT' : 'POST'

      const response = await this.makeRequest<ApiResponse>(url, {
        method,
        body: JSON.stringify({ data: formData })
      })

      return {
        success: response.success,
        data: response.data,
        message: response.message
      }
    } catch (error) {
      console.error('Draft save failed:', error)
      throw error
    }
  }

  /**
   * Load draft PCR form
   */
  async loadDraft(draftId: string): Promise<Partial<PCRFormData> | null> {
    try {
      const response = await this.makeRequest<ApiResponse>(`${this.baseUrl}/pcr/drafts/${draftId}`)

      if (response.success && response.data) {
        return response.data.formData
      }

      return null
    } catch (error) {
      console.error('Draft load failed:', error)
      return null
    }
  }

  /**
   * Get list of user's drafts
   */
  async getDrafts(): Promise<Array<{ id: string, savedAt: string, title?: string }>> {
    try {
      const response = await this.makeRequest<ApiResponse>(`${this.baseUrl}/pcr/drafts`)

      if (response.success && response.data) {
        return response.data
      }

      return []
    } catch (error) {
      console.error('Failed to load drafts:', error)
      return []
    }
  }

  /**
   * Delete a draft
   */
  async deleteDraft(draftId: string): Promise<void> {
    try {
      await this.makeRequest(`${this.baseUrl}/pcr/drafts/${draftId}`, {
        method: 'DELETE'
      })
    } catch (error) {
      console.error('Draft deletion failed:', error)
      throw error
    }
  }

  /**
   * Get submitted PCR reports
   */
  async getSubmissions(): Promise<PCRReport[]> {
    try {
      const response = await this.makeRequest<ApiResponse>(`${this.baseUrl}/submissions`)

      if (response.success && response.data) {
        return response.data
      }

      return []
    } catch (error) {
      console.error('Failed to load submissions:', error)
      return []
    }
  }

  /**
   * Get specific PCR report by ID
   */
  async getSubmission(id: string): Promise<PCRReport | null> {
    try {
      const response = await this.makeRequest<ApiResponse>(`${this.baseUrl}/submissions/${id}`)

      if (response.success && response.data) {
        return response.data
      }

      return null
    } catch (error) {
      console.error('Failed to load submission:', error)
      return null
    }
  }

  /**
   * Auto-save functionality - saves to localStorage as fallback
   */
  autoSave(formData: Partial<PCRFormData>, key: string = 'current'): void {
    try {
      const draftKey = `pcr_draft_${key}`
      localStorage.setItem(draftKey, JSON.stringify({
        data: formData,
        savedAt: new Date().toISOString()
      }))
    } catch (error) {
      console.warn('Auto-save to localStorage failed:', error)
    }
  }

  /**
   * Load auto-saved data from localStorage
   */
  loadAutoSave(key: string = 'current'): Partial<PCRFormData> | null {
    try {
      const draftKey = `pcr_draft_${key}`
      const saved = localStorage.getItem(draftKey)

      if (saved) {
        const parsed = JSON.parse(saved)
        return parsed.data
      }

      return null
    } catch (error) {
      console.warn('Failed to load auto-save data:', error)
      return null
    }
  }

  /**
   * Clear auto-saved data
   */
  clearAutoSave(key: string = 'current'): void {
    try {
      const draftKey = `pcr_draft_${key}`
      localStorage.removeItem(draftKey)
    } catch (error) {
      console.warn('Failed to clear auto-save data:', error)
    }
  }

  /**
   * Validate form data before submission
   */
  validateForSubmission(formData: PCRFormData): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    // Required fields
    if (!formData.date) errors.push('Date is required')
    if (!formData.location) errors.push('Location is required')
    if (!formData.callNumber) errors.push('Call number is required')
    if (!formData.reportNumber) errors.push('Report number is required')
    if (!formData.supervisor) errors.push('Supervisor is required')
    if (!formData.timeNotified) errors.push('Time notified is required')
    if (!formData.onScene) errors.push('On scene time is required')
    if (!formData.clearedScene) errors.push('Cleared scene time is required')
    if (!formData.firstAgencyOnScene) errors.push('First agency on scene is required')
    if (!formData.patientName) errors.push('Patient name is required')
    if (!formData.positionOfPatient) errors.push('Position of patient is required')
    if (!formData.comments) errors.push('Call description is required')
    if (!formData.transferComments) errors.push('Transfer of care is required')
    if (!formData.patientCareTransferred) errors.push('Patient care transferred is required')
    if (!formData.timeCareTransferred) errors.push('Time care transferred is required')

    return {
      isValid: errors.length === 0,
      errors
    }
  }
}

export const pcrService = new PCRService()