/**
 * PDF generation and printing service for PCR reports
 */
import jsPDF from 'jspdf'
import type { PCRFormData, VitalSign, VitalSigns2 } from '@/types'

interface PDFOptions {
  includeImages?: boolean
  orientation?: 'portrait' | 'landscape'
  format?: 'a4' | 'letter' | 'legal'
  fontSize?: number
  margins?: {
    top: number
    right: number
    bottom: number
    left: number
  }
}

interface PrintOptions {
  showPreview?: boolean
  printerName?: string
  copies?: number
  colorMode?: 'color' | 'grayscale' | 'blackwhite'
  paperSize?: 'letter' | 'a4' | 'legal'
  orientation?: 'portrait' | 'landscape'
}

interface PDFGenerationResult {
  blob: Blob
  url: string
  filename: string
  size: number
}

export class PDFService {
  private defaultOptions: Required<PDFOptions> = {
    includeImages: true,
    orientation: 'portrait',
    format: 'letter',
    fontSize: 8, // Smaller font for single page
    margins: {
      top: 10,
      right: 10,
      bottom: 10,
      left: 10,
    },
  }


  /**
   * Generate comprehensive PDF report
   */
  async generatePDFReport(
    data: PCRFormData,
    options: PDFOptions = {}
  ): Promise<PDFGenerationResult> {
    const opts = { ...this.defaultOptions, ...options }
    const pdf = new jsPDF({
      orientation: opts.orientation,
      unit: 'mm',
      format: opts.format,
    })

    let yPosition = opts.margins.top
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const contentWidth = pageWidth - opts.margins.left - opts.margins.right

    // Set font
    pdf.setFontSize(opts.fontSize)

    try {
      // Header
      yPosition = this.addHeader(pdf, opts, yPosition)

      // Basic Information
      yPosition = this.addBasicInformation(pdf, data, opts, yPosition, contentWidth)

      // Patient Information
      yPosition = this.addPatientInformation(pdf, data, opts, yPosition, contentWidth)

      // Medical History
      yPosition = this.addMedicalHistory(pdf, data, opts, yPosition, contentWidth)

      // Assessment
      yPosition = this.addAssessment(pdf, data, opts, yPosition, contentWidth)

      // Vital Signs
      if (data.vitalSigns?.length) {
        yPosition = this.addVitalSigns(pdf, data.vitalSigns, opts, yPosition, contentWidth)
      }

      // Secondary Assessment
      if (data.vitalSigns2?.length) {
        yPosition = this.addSecondaryAssessment(pdf, data.vitalSigns2, opts, yPosition, contentWidth)
      }

      // Treatment & Procedures
      yPosition = this.addTreatmentAndProcedures(pdf, data, opts, yPosition, contentWidth)

      // Transport Information
      yPosition = this.addTransportInformation(pdf, data, opts, yPosition, contentWidth)

      // Injury Canvas (if available and enabled)
      if (opts.includeImages && data.injuryCanvas) {
        yPosition = await this.addInjuryCanvas(pdf, data.injuryCanvas, opts, yPosition, contentWidth)
      }

      // Signatures and Footer
      yPosition = this.addSignaturesAndFooter(pdf, data, opts, yPosition, contentWidth)

      // Generate blob and URL
      const pdfBlob = pdf.output('blob')
      const url = URL.createObjectURL(pdfBlob)
      const filename = this.generateFilename(data)

      return {
        blob: pdfBlob,
        url,
        filename,
        size: pdfBlob.size,
      }
    } catch (error) {
      console.error('PDF generation failed:', error)
      throw new Error('Failed to generate PDF report')
    }
  }

  /**
   * Show print preview modal
   */
  async showPrintPreview(data: PCRFormData, options: PDFOptions = {}): Promise<void> {
    const result = await this.generatePDFReport(data, options)
    
    // Create preview modal
    const modal = document.createElement('div')
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'
    modal.innerHTML = `
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
        <div class="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Print Preview</h3>
          <div class="flex space-x-2">
            <button id="print-btn" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
              Print
            </button>
            <button id="download-btn" class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
              Download PDF
            </button>
            <button id="close-btn" class="px-2 py-2 text-gray-500 hover:text-gray-700 dark:text-gray-400">
              ✕
            </button>
          </div>
        </div>
        <div class="flex-1 p-4 overflow-hidden">
          <iframe 
            src="${result.url}" 
            class="w-full h-full border rounded"
            title="PDF Preview"
          ></iframe>
        </div>
      </div>
    `

    document.body.appendChild(modal)

    // Event handlers
    const printBtn = modal.querySelector('#print-btn')
    const downloadBtn = modal.querySelector('#download-btn')
    const closeBtn = modal.querySelector('#close-btn')

    printBtn?.addEventListener('click', () => {
      this.printPDF(result.url)
    })

    downloadBtn?.addEventListener('click', () => {
      this.downloadPDF(result.blob, result.filename)
    })

    const closeModal = () => {
      document.body.removeChild(modal)
      URL.revokeObjectURL(result.url)
    }

    closeBtn?.addEventListener('click', closeModal)
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal()
    })

    // ESC key handler
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeModal()
        document.removeEventListener('keydown', handleEsc)
      }
    }
    document.addEventListener('keydown', handleEsc)
  }

  /**
   * Print PDF directly
   */
  printPDF(url: string, options: PrintOptions = {}): void {
    const iframe = document.createElement('iframe')
    iframe.style.display = 'none'
    iframe.src = url
    
    document.body.appendChild(iframe)
    
    iframe.onload = () => {
      iframe.contentWindow?.print()
      setTimeout(() => {
        document.body.removeChild(iframe)
      }, 1000)
    }
  }

  /**
   * Download PDF file
   */
  downloadPDF(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  /**
   * Create "Confirm Printed" workflow
   */
  async confirmPrintedWorkflow(
    data: PCRFormData,
    onConfirm: (confirmed: boolean, timestamp: string) => void
  ): Promise<void> {
    const result = await this.generatePDFReport(data)
    
    // Show print confirmation modal
    const modal = document.createElement('div')
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'
    modal.innerHTML = `
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
        <div class="p-6">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Print Confirmation
          </h3>
          <div class="mb-6">
            <div class="flex items-center space-x-2 mb-4">
              <button id="preview-print-btn" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                Preview & Print
              </button>
              <button id="direct-print-btn" class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
                Direct Print
              </button>
            </div>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              Please print the PCR report and confirm below when completed.
            </p>
          </div>
          <div class="flex space-x-3">
            <button id="confirm-printed-btn" class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400" disabled>
              Confirm Printed
            </button>
            <button id="cancel-btn" class="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
              Cancel
            </button>
          </div>
        </div>
      </div>
    `

    document.body.appendChild(modal)

    let printAttempted = false

    // Event handlers
    const previewPrintBtn = modal.querySelector('#preview-print-btn')
    const directPrintBtn = modal.querySelector('#direct-print-btn')
    const confirmBtn = modal.querySelector('#confirm-printed-btn') as HTMLButtonElement
    const cancelBtn = modal.querySelector('#cancel-btn')

    previewPrintBtn?.addEventListener('click', () => {
      this.showPrintPreview(data)
      printAttempted = true
      confirmBtn.disabled = false
    })

    directPrintBtn?.addEventListener('click', () => {
      this.printPDF(result.url)
      printAttempted = true
      confirmBtn.disabled = false
    })

    confirmBtn?.addEventListener('click', () => {
      const timestamp = new Date().toISOString()
      onConfirm(true, timestamp)
      document.body.removeChild(modal)
      URL.revokeObjectURL(result.url)
    })

    cancelBtn?.addEventListener('click', () => {
      onConfirm(false, '')
      document.body.removeChild(modal)
      URL.revokeObjectURL(result.url)
    })
  }

  /**
   * Add header to PDF
   */
  private addHeader(pdf: jsPDF, options: Required<PDFOptions>, yPosition: number): number {
    const pageWidth = pdf.internal.pageSize.getWidth()
    
    // Title
    pdf.setFontSize(12)
    pdf.setFont('helvetica', 'bold')
    pdf.text('PATIENT CARE REPORT', pageWidth / 2, yPosition, { align: 'center' })
    
    // Timestamp
    pdf.setFontSize(7)
    pdf.setFont('helvetica', 'normal')
    const timestamp = new Date().toLocaleString()
    pdf.text(`Generated: ${timestamp}`, pageWidth - options.margins.right, yPosition, { align: 'right' })
    
    return yPosition + 8
  }

  /**
   * Add basic information section
   */
  private addBasicInformation(
    pdf: jsPDF,
    data: PCRFormData,
    options: Required<PDFOptions>,
    yPosition: number,
    contentWidth: number
  ): number {
    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'bold')
    pdf.text('BASIC INFO', options.margins.left, yPosition)
    yPosition += 5

    pdf.setFontSize(7)
    pdf.setFont('helvetica', 'normal')
    
    const basicFields = [
      { label: 'Date:', value: data.date || '' },
      { label: 'Location:', value: data.location || '' },
      { label: 'Call#:', value: data.callNumber || '' },
      { label: 'Report#:', value: data.reportNumber || '' },
      { label: 'Supervisor:', value: data.supervisor || '' },
      { label: 'PSM:', value: data.primaryPSM || '' },
      { label: 'Notified:', value: data.timeNotified || '' },
      { label: 'On Scene:', value: data.onScene || '' },
      { label: 'Cleared:', value: data.clearedScene || '' },
      { label: 'First Agency:', value: data.firstAgencyOnScene || '' },
    ]

    // Three columns layout for more compact display
    const columnWidth = contentWidth / 3
    for (let i = 0; i < basicFields.length; i++) {
      const field = basicFields[i]
      const x = options.margins.left + (i % 3) * columnWidth
      if (i % 3 === 0 && i > 0) yPosition += 3
      
      const text = `${field.label} ${field.value}`
      pdf.text(text.substring(0, 25), x, yPosition) // Limit text length
    }

    return yPosition + 8
  }

  /**
   * Add patient information section
   */
  private addPatientInformation(
    pdf: jsPDF,
    data: PCRFormData,
    options: Required<PDFOptions>,
    yPosition: number,
    contentWidth: number
  ): number {
    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'bold')
    pdf.text('PATIENT INFO', options.margins.left, yPosition)
    yPosition += 4

    pdf.setFontSize(7)
    pdf.setFont('helvetica', 'normal')
    
    const patientFields = [
      { label: 'Name:', value: data.patientName || '' },
      { label: 'DOB:', value: data.dob || '' },
      { label: 'Age:', value: data.age ? data.age.toString() : '' },
      { label: 'Sex:', value: data.sex || '' },
      { label: 'Status:', value: data.status || '' },
      { label: 'Emergency Contact:', value: data.emergencyContactName || '' },
    ]

    // Three columns layout
    const columnWidth = contentWidth / 3
    for (let i = 0; i < patientFields.length; i++) {
      const field = patientFields[i]
      const x = options.margins.left + (i % 3) * columnWidth
      if (i % 3 === 0 && i > 0) yPosition += 3
      
      const text = `${field.label} ${field.value}`
      pdf.text(text.substring(0, 25), x, yPosition)
    }

    return yPosition + 6
  }

  /**
   * Add medical history section
   */
  private addMedicalHistory(
    pdf: jsPDF,
    data: PCRFormData,
    options: Required<PDFOptions>,
    yPosition: number,
    contentWidth: number
  ): number {
    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'bold')
    pdf.text('MEDICAL HISTORY', options.margins.left, yPosition)
    yPosition += 4

    pdf.setFontSize(7)
    pdf.setFont('helvetica', 'normal')
    
    const medicalFields = [
      { label: 'Chief Complaint:', value: data.chiefComplaint || '' },
      { label: 'Signs/Symptoms:', value: data.signsSymptoms || '' },
      { label: 'Allergies:', value: data.allergies || '' },
      { label: 'Medications:', value: data.medications || '' },
    ]

    for (const field of medicalFields) {
      if (field.value) {
        // Compact single-line format
        const truncatedValue = field.value.substring(0, 60) + (field.value.length > 60 ? '...' : '')
        pdf.text(`${field.label} ${truncatedValue}`, options.margins.left, yPosition)
        yPosition += 3
      }
    }

    return yPosition + 4
  }

  /**
   * Add assessment section
   */
  private addAssessment(
    pdf: jsPDF,
    data: PCRFormData,
    options: Required<PDFOptions>,
    yPosition: number,
    contentWidth: number
  ): number {
    pdf.setFont('helvetica', 'bold')
    pdf.text('ASSESSMENT', options.margins.left, yPosition)
    yPosition += 8

    pdf.setFont('helvetica', 'normal')
    
    if (data.bodySurvey) {
      pdf.text('Rapid Body Survey:', options.margins.left, yPosition)
      yPosition += 5
      const lines = pdf.splitTextToSize(data.bodySurvey, contentWidth - 10)
      pdf.text(lines, options.margins.left + 10, yPosition)
      yPosition += (lines.length * 5) + 5
    }

    if (data.positionOfPatient) {
      pdf.text(`Position of Patient: ${data.positionOfPatient}`, options.margins.left, yPosition)
      yPosition += 8
    }

    return yPosition + 10
  }

  /**
   * Add vital signs table
   */
  private addVitalSigns(
    pdf: jsPDF,
    vitalSigns: VitalSign[],
    options: Required<PDFOptions>,
    yPosition: number,
    contentWidth: number
  ): number {
    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'bold')
    pdf.text('VITAL SIGNS', options.margins.left, yPosition)
    yPosition += 4

    // Only show first 3 vital sign entries to save space
    const limitedVitals = vitalSigns.slice(0, 3).filter(v => v.time || v.pulse || v.respiration)
    
    if (limitedVitals.length > 0) {
      const headers = ['Time', 'Pulse', 'Resp', 'BP', 'O2Sat']
      const colWidth = contentWidth / headers.length
      
      pdf.setFontSize(7)
      pdf.setFont('helvetica', 'bold')
      headers.forEach((header, i) => {
        pdf.text(header, options.margins.left + (i * colWidth), yPosition)
      })
      yPosition += 3

      pdf.setFont('helvetica', 'normal')
      limitedVitals.forEach((vital) => {
        const row = [
          vital.time || '',
          vital.pulse || '',
          vital.respiration || '',
          vital.bloodPressure || '',
          vital.oxygenSaturation || '',
        ]
        
        row.forEach((cell, i) => {
          const text = cell.toString().substring(0, 8) // Limit cell text
          pdf.text(text, options.margins.left + (i * colWidth), yPosition)
        })
        yPosition += 3
      })
    }

    return yPosition + 4
  }

  /**
   * Add secondary assessment
   */
  private addSecondaryAssessment(
    pdf: jsPDF,
    vitalSigns2: VitalSigns2[],
    options: Required<PDFOptions>,
    yPosition: number,
    contentWidth: number
  ): number {
    pdf.setFont('helvetica', 'bold')
    pdf.text('SECONDARY ASSESSMENT', options.margins.left, yPosition)
    yPosition += 8

    // Table headers
    const headers = ['Time', 'Pulse', 'Blood Pressure', 'Respiration', 'O2 Sat', 'Temperature', 'Skin']
    const colWidth = contentWidth / headers.length
    
    pdf.setFont('helvetica', 'bold')
    headers.forEach((header, i) => {
      pdf.text(header, options.margins.left + (i * colWidth), yPosition)
    })
    yPosition += 6

    // Table data
    pdf.setFont('helvetica', 'normal')
    vitalSigns2.forEach((vital) => {
      const row = [
        vital.time || '',
        vital.pulse || '',
        vital.bloodPressure || '',
        vital.respiration || '',
        vital.oxygenSaturation || '',
        vital.temperature || '',
        vital.skin || '',
      ]
      
      row.forEach((cell, i) => {
        pdf.text(cell.toString(), options.margins.left + (i * colWidth), yPosition)
      })
      yPosition += 5
    })

    return yPosition + 10
  }

  /**
   * Add treatment and procedures section
   */
  private addTreatmentAndProcedures(
    pdf: jsPDF,
    data: PCRFormData,
    options: Required<PDFOptions>,
    yPosition: number,
    contentWidth: number
  ): number {
    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'bold')
    pdf.text('TREATMENT & PROCEDURES', options.margins.left, yPosition)
    yPosition += 4

    pdf.setFontSize(7)
    pdf.setFont('helvetica', 'normal')
    
    // Add treatment data in compact format
    const treatments = []
    if (data.airwayManagement?.length) treatments.push(`Airway: ${data.airwayManagement.join(', ')}`)
    if (data.hemorrhageControl?.length) treatments.push(`Hemorrhage: ${data.hemorrhageControl.join(', ')}`)
    if (data.immobilization?.length) treatments.push(`Immob: ${data.immobilization.join(', ')}`)
    if (data.positionOfPatient) treatments.push(`Position: ${data.positionOfPatient}`)
    
    for (const treatment of treatments) {
      const truncated = treatment.substring(0, 80) + (treatment.length > 80 ? '...' : '')
      pdf.text(truncated, options.margins.left, yPosition)
      yPosition += 3
    }

    return yPosition + 4
  }

  /**
   * Add transport information
   */
  private addTransportInformation(
    pdf: jsPDF,
    data: PCRFormData,
    options: Required<PDFOptions>,
    yPosition: number,
    contentWidth: number
  ): number {
    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'bold')
    pdf.text('TRANSPORT & TRANSFER', options.margins.left, yPosition)
    yPosition += 4

    pdf.setFontSize(7)
    pdf.setFont('helvetica', 'normal')
    
    if (data.patientCareTransferred) {
      pdf.text(`Transferred to: ${data.patientCareTransferred}`, options.margins.left, yPosition)
      yPosition += 3
    }
    if (data.timeCareTransferred) {
      pdf.text(`Time: ${data.timeCareTransferred}`, options.margins.left, yPosition)
      yPosition += 3
    }
    if (data.comments) {
      const truncated = data.comments.substring(0, 100) + (data.comments.length > 100 ? '...' : '')
      pdf.text(`Description: ${truncated}`, options.margins.left, yPosition)
      yPosition += 3
    }

    return yPosition + 4
  }

  /**
   * Add injury canvas drawing
   */
  private async addInjuryCanvas(
    pdf: jsPDF,
    canvasData: string,
    options: Required<PDFOptions>,
    yPosition: number,
    contentWidth: number
  ): Promise<number> {
    try {
      pdf.setFont('helvetica', 'bold')
      pdf.text('INJURY DIAGRAM', options.margins.left, yPosition)
      yPosition += 10

      // Extract image data from canvas data
      let imageDataUrl = canvasData
      
      try {
        const parsedCanvasData = JSON.parse(canvasData)
        if (parsedCanvasData.imageData) {
          // New format with both fabric data and image data
          imageDataUrl = parsedCanvasData.imageData
        }
        // If no imageData property, fall back to assuming it's already an image data URL
      } catch (parseError) {
        // If parsing fails, assume canvasData is already an image data URL
        console.log('Canvas data is not JSON, assuming it\'s an image data URL')
      }

      // Add canvas image - smaller size for single page
      const imgWidth = contentWidth * 0.5
      const imgHeight = imgWidth * 0.4 // Maintain aspect ratio
      
      pdf.addImage(
        imageDataUrl,
        'PNG',
        options.margins.left + (contentWidth - imgWidth) / 2,
        yPosition,
        imgWidth,
        imgHeight
      )

      return yPosition + imgHeight + 5
    } catch (error) {
      console.error('Failed to add injury canvas:', error)
      return yPosition
    }
  }

  /**
   * Add signatures and footer
   */
  private addSignaturesAndFooter(
    pdf: jsPDF,
    data: PCRFormData,
    options: Required<PDFOptions>,
    yPosition: number,
    contentWidth: number
  ): number {
    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'bold')
    pdf.text('SIGNATURES', options.margins.left, yPosition)
    yPosition += 4

    pdf.setFontSize(7)
    pdf.setFont('helvetica', 'normal')
    
    // Compact signature info
    const sigWidth = contentWidth / 2 - 10
    
    // Primary responder
    pdf.text(`PSM: ${data.primaryPSM || '_________________'}`, options.margins.left, yPosition)
    
    // Supervisor
    pdf.text(`Supervisor: ${data.supervisor || '_________________'}`, options.margins.left + sigWidth, yPosition)
    
    yPosition += 6

    // Date and time
    const now = new Date()
    pdf.text(`Date: ${now.toLocaleDateString()} Time: ${now.toLocaleTimeString()}`, options.margins.left, yPosition)

    return yPosition + 4
  }

  /**
   * Generate filename for PDF
   */
  private generateFilename(data: PCRFormData): string {
    const date = data.date ? new Date(data.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
    const callNumber = data.callNumber || 'unknown'
    const patientName = data.patientName ? data.patientName.replace(/[^a-zA-Z0-9]/g, '_') : 'patient'
    
    return `PCR_${date}_${callNumber}_${patientName}.pdf`
  }

  /**
   * Validate data before PDF generation
   */
  validateDataForPDF(data: PCRFormData): { isValid: boolean; errors: string[] } {
    const errors: string[] = []
    
    if (!data.date) errors.push('Date is required')
    if (!data.patientName) errors.push('Patient name is required')
    if (!data.callNumber) errors.push('Call number is required')
    if (!data.reportNumber) errors.push('Report number is required')
    
    return {
      isValid: errors.length === 0,
      errors,
    }
  }

  /**
   * Get PDF generation statistics
   */
  getStats(): {
    generatedPDFs: number
    totalSize: number
    averageGenerationTime: number
  } {
    // This would be implemented with actual tracking
    return {
      generatedPDFs: 0,
      totalSize: 0,
      averageGenerationTime: 0,
    }
  }
}

export const pdfService = new PDFService()