/**
 * PDF generation and printing service for PCR reports
 */
import jsPDF from 'jspdf'
import type { PCRFormData, VitalSign, VitalSigns2 } from '@/types'
import { OxygenProtocol } from '../types'

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

// Helper: ensures enough space on page
const PAGE_GUARD = 6;
function ensureSpaceFor(pdf: jsPDF, options: Required<PDFOptions>, y: number, needed: number) {
  const pageH = pdf.internal.pageSize.getHeight()
  const bottom = options.margins.bottom + PAGE_GUARD
  if (y + needed > pageH - bottom) {
    pdf.addPage()
    return options.margins.top
  }
  return y
}

// Helper: render a row of fields with column spans
function renderFieldsRow(
  pdf: jsPDF,
  fields: { label: string; value: string | number }[],
  spans: number[],
  y: number,
  options: Required<PDFOptions>,
  contentWidth: number
): number {
  const colUnit = contentWidth / 4
  let x = options.margins.left

  // compute line height in mm
  const lineH = pdf.getLineHeightFactor() * (pdf.getFontSize() * 0.3528)
  let neededLinesMax = 1

  // First pass: measure how many lines each value will wrap to
  const measured = fields.map((field, i) => {
    const span = spans[i] || 1
    const maxWidth = colUnit * span
    pdf.setFont('helvetica', 'bold')
    const label = field.label ?? ''
    const labelW = pdf.getTextWidth(label + ' ')
    const valueMaxW = Math.max(4, maxWidth - labelW)

    const raw = String(field.value ?? '')
    pdf.setFont('helvetica', 'normal')
    const lines = pdf.splitTextToSize(raw, valueMaxW)
    neededLinesMax = Math.max(neededLinesMax, Math.max(1, lines.length))

    return { label, labelW, valueMaxW, lines, maxWidth }
  })

  // ensure page break if needed
  const pageH = pdf.internal.pageSize.getHeight()
  const bottom = options.margins.bottom
  const neededHeight = neededLinesMax * lineH
  if (y + neededHeight > pageH - bottom) {
    pdf.addPage()
    y = options.margins.top
  }

  // Second pass: draw
  let xCursor = options.margins.left
  measured.forEach((m, i) => {
    // label
    pdf.setFont('helvetica', 'bold')
    pdf.text(m.label, xCursor, y)

    // value
    pdf.setFont('helvetica', 'normal')
    const xVal = xCursor + m.labelW
    m.lines.forEach((ln, idx) => {
      pdf.text(ln, xVal, y + idx * lineH)
    })

    xCursor += m.maxWidth
  })

  return y + neededHeight + 1 // small spacer
}

	// Add this helper near renderFieldsRow
	function renderMultilineBlock(
    pdf: jsPDF,
    label: string,
    value: string,
    y: number,
    options: Required<PDFOptions>,
    contentWidth: number
  ): number {
    const pageHeight = pdf.internal.pageSize.getHeight();
    const left = options.margins.left;
    const bottom = options.margins.bottom;
    const lineHeight = pdf.getLineHeightFactor() * (pdf.getFontSize() * 0.3528);

    // Ensure there's space for at least one line
    if (y + lineHeight > pageHeight - bottom) {
      pdf.addPage();
      y = options.margins.top;
    }

    // Draw label (bold)
    pdf.setFont('helvetica', 'bold');
    pdf.text(label, left, y);

    // Wrap value to remaining width
    const labelWidth = pdf.getTextWidth(label + ' ');
    const valueMaxWidth = Math.max(10, contentWidth - labelWidth);
    const lines = pdf.splitTextToSize(value || '', valueMaxWidth);

    // Draw value (normal), aligned to the right of the label
    pdf.setFont('helvetica', 'normal');
    const xVal = left + labelWidth;

    if (lines.length === 0) {
      // keep the row height even when empty
      y += lineHeight + 2;
      return y;
    }

    for (let i = 0; i < lines.length; i++) {
      if (y + lineHeight > pageHeight - bottom) {
        pdf.addPage();
        y = options.margins.top;
      }
      pdf.text(lines[i], xVal, y);
      y += lineHeight;
    }

    return y + 1; // small spacer after the block
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

      // Injury Canvas (if available and enabled)
      if (opts.includeImages && data.injuryCanvas) {
        yPosition = await this.addInjuryCanvas(pdf, data.injuryCanvas, opts, yPosition, contentWidth, data)
      }

      // Vital Signs
      if (data.vitalSigns?.length) {
        yPosition = this.addVitalSigns(pdf, data.vitalSigns, opts, yPosition, contentWidth)
      }

      // Oxygen Protocol
      if (data.oxygenProtocol) {
        yPosition = this.addOxygenProtocol(pdf, data.oxygenProtocol, data.vitalSigns2, opts, yPosition, contentWidth)
      }

      // Transport Information
      yPosition = this.addTransportInformation(pdf, data, opts, yPosition, contentWidth)

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
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 h-[90vh] flex flex-col">
        <div class="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Print Preview</h3>
          <div class="flex space-x-2">
            <button id="print-btn" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
              Print
            </button>
            <button id="close-btn" class="px-2 py-2 text-gray-500 hover:text-gray-700 dark:text-gray-400">
              ✕
            </button>
          </div>
        </div>
        <div class="flex-1 min-h-0 p-4 overflow-hidden">
          <iframe 
            src="${result.url}#toolbar=0" 
            class="w-full h-full border rounded flex-1"
            title="PDF Preview"
          ></iframe>
        </div>
      </div>
    `

    document.body.appendChild(modal)

    // Event handlers
    const printBtn = modal.querySelector('#print-btn')
    const closeBtn = modal.querySelector('#close-btn')

    printBtn?.addEventListener('click', () => {
      this.printPDF(result.url)
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
		iframe.style.position = 'fixed'
		iframe.style.right = '0'
		iframe.style.bottom = '0'
		iframe.style.width = '0'
		iframe.style.height = '0'
		iframe.style.border = '0'
		iframe.src = url

		document.body.appendChild(iframe)

		iframe.onload = () => {
			const win = iframe.contentWindow
			if (!win) return

			const cleanup = () => {
				try {
					// Remove listeners first
					if ('onafterprint' in win) {
						win.removeEventListener('afterprint', cleanup as any)
					} else if (win.matchMedia) {
						mql?.removeEventListener
							? mql.removeEventListener('change', mqlListener)
							: mql.removeListener(mqlListener)
					}
				} catch {}
				// Then remove iframe
				document.body.removeChild(iframe)
			}

			// Fallback for browsers without onafterprint on the iframe window
			let mql: MediaQueryList | null = null
			const mqlListener = (e: MediaQueryListEvent) => {
				// when print dialog closes, matches goes from true -> false
				if (!e.matches) cleanup()
			}

			// Prefer onafterprint
			if ('onafterprint' in win) {
				win.addEventListener('afterprint', cleanup as any)
			} else if (win.matchMedia) {
				mql = win.matchMedia('print')
				if (mql.addEventListener) mql.addEventListener('change', mqlListener)
				else mql.addListener(mqlListener)
			}

			// Ensure focus, then trigger print
			try { win.focus() } catch {}
			setTimeout(() => win.print(), 50)
		}
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
    
    // Title with logo aligned together
    const logoPath = '/images/vcrt_logo.png' // path from public
    const logoSize = 8                       // square logo 
    const x = options.margins.left
    const y = yPosition                      // baseline for alignment

    // Add logo
    pdf.addImage(logoPath, 'PNG', x, y - logoSize + 3, logoSize, logoSize)

    // Add text aligned with logo vertically
    pdf.setFontSize(12)
    pdf.setFont('helvetica', 'bold')
    pdf.text('Patient Care Report', x + logoSize + 3, y)

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
    const boxHeight = 8
    const boxX = options.margins.left
    const boxWidth = pdf.internal.pageSize.getWidth() - options.margins.left - options.margins.right
    const boxY = yPosition
    pdf.setFillColor(100, 100, 100)
    pdf.rect(boxX, boxY, boxWidth, boxHeight, 'F')
    pdf.setTextColor(255, 255, 255)
    pdf.text('RESPONSE AND PATIENT INFORMATION', boxX + 2, boxY + boxHeight - 3)
    pdf.setTextColor(0, 0, 0)
    yPosition += boxHeight + 6

    pdf.setFontSize(8)
    pdf.setFont('helvetica', 'normal')
    
    
    // First set of basic info
    yPosition = renderFieldsRow(
      pdf,
      [
        { label: 'Date:', value: data.date || '' },
        { label: 'Location:', value: data.location || '' },
        { label: 'Call #:', value: data.callNumber || '' },
        { label: 'Report #:', value: data.reportNumber || '' },
      ],
      [1, 1, 1, 1], 
      yPosition,
      options,
      contentWidth
    )
    
    // Second set of basic info
    const responders = [
      data.responder1 || '',
      data.responder2 || '',
      data.responder3 || ''
    ].filter(r => r.trim() !== '').join(', ')
    yPosition = renderFieldsRow(
      pdf,
      [
        { label: 'Supervisor:', value: data.supervisor || '' },
        { label: 'Primary PSM:', value: data.primaryPSM || '' },
        { label: 'Responders:', value: responders },
      ],
      [1, 1, 2], 
      yPosition,
      options,
      contentWidth
    )

    // Third set of basic info
    yPosition = renderFieldsRow(
      pdf,
      [
        { label: 'Time Notified:', value: data.timeNotified || '' },
        { label: 'On Scene:', value: data.onScene || '' },
        { label: 'Transport Arrived:', value: data.transportArrived || 'N/A' },
        { label: 'Cleared:', value: data.clearedScene || '' },
      ],
      [1, 1, 1, 1], 
      yPosition,
      options,
      contentWidth
    )

    // Fourth set of basic info
    yPosition = renderFieldsRow(
      pdf,
      [
        { label: 'Paramedics Called by:', value: data.paramedicsCalledBy || 'N/A' },
        { label: 'First Agency on Scene:', value: data.firstAgencyOnScene || '' },
      ],
      [2, 2], 
      yPosition,
      options,
      contentWidth
    )

    pdf.setDrawColor(0)
    pdf.setLineWidth(0.4)
    pdf.line(
      options.margins.left,
      yPosition,
      pdf.internal.pageSize.getWidth() - options.margins.right,
      yPosition
    )

    return yPosition + 4

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
    pdf.setFontSize(8)
    pdf.setFont('helvetica', 'normal')
    yPosition += 2
    
    // First set of patient info
    yPosition = renderFieldsRow(
      pdf,
      [
        { label: 'Patient Name:', value: data.patientName || '' },
        { label: 'DOB:', value: data.dob || 'Not Recorded' },
        { label: 'Age:', value: data.age ? data.age.toString() : 'Not Recorded' },
        { label: 'Sex:', value: data.sex || '' },
      ],
      [1, 1, 1, 1], 
      yPosition,
      options,
      contentWidth
    )

    // Second set of patient info
    yPosition = renderFieldsRow(
      pdf,
      [
        { label: 'Status:', value: data.status || '' },
        { label: 'Student/Employee #:', value: data.studentEmployeeNumber || ' Not Recorded' },
        { label: 'Workplace Injury?:', value: data.workplaceInjury || '' },
      ],
      [1, 1, 1], 
      yPosition,
      options,
      contentWidth
    )

    // Third set of patient info
    yPosition = renderFieldsRow(
      pdf,
      [
        { label: 'Emergency Contact Name (Relationship):', value: data.emergencyContactName || '' },
        { label: 'Contacted?:', value: data.contacted || '' },
        { label: 'Contacted by:', value: data.contactedBy || '' },
      ],
      [2, 1, 1], 
      yPosition,
      options,
      contentWidth
    )

    return yPosition

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
    const boxHeight = 8
    const boxX = options.margins.left
    const boxWidth = pdf.internal.pageSize.getWidth() - options.margins.left - options.margins.right
    const boxY = yPosition
    pdf.setFillColor(100, 100, 100)
    pdf.rect(boxX, boxY, boxWidth, boxHeight, 'F')
    pdf.setTextColor(255, 255, 255)
    pdf.text('PATIENT MEDICAL HISTORY / REASON FOR RESPONSE', boxX + 2, boxY + boxHeight - 3)
    pdf.setTextColor(0, 0, 0)
    yPosition += boxHeight + 6

    pdf.setFontSize(8)
    pdf.setFont('helvetica', 'normal')

    yPosition = renderMultilineBlock(
      pdf, `Chief Complaint:`, data.chiefComplaint || '', yPosition, options, contentWidth
    )
    yPosition = renderMultilineBlock(
      pdf, `Signs & Symptoms:`, data.signsSymptoms|| '', yPosition, options, contentWidth
    )
    yPosition = renderMultilineBlock(
      pdf, `Allergies:`, data.allergies || '', yPosition, options, contentWidth
    )
    yPosition = renderMultilineBlock(
      pdf, `Medications:`, data.medications || '', yPosition, options, contentWidth
    )
    yPosition = renderMultilineBlock(
      pdf, `Pertinent Medical History:`, data.medicalHistory || '', yPosition, options, contentWidth
    )
    yPosition = renderMultilineBlock(
      pdf, `Last Meal:`, data.lastMeal || '', yPosition, options, contentWidth
    )
    
    pdf.setDrawColor(0)
    pdf.setLineWidth(0.4)
    pdf.line(
      options.margins.left,
      yPosition,
      pdf.internal.pageSize.getWidth() - options.margins.right,
      yPosition
    )
    yPosition += 6

    yPosition = renderMultilineBlock(
      pdf, `Rapid Body Survey Findings:`, data.bodySurvey || '', yPosition, options, contentWidth
    )

    return yPosition
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
    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'bold')
    const boxHeight = 8
    const boxX = options.margins.left
    const boxWidth = pdf.internal.pageSize.getWidth() - options.margins.left - options.margins.right
    const boxY = yPosition
    pdf.setFillColor(100, 100, 100)
    pdf.rect(boxX, boxY, boxWidth, boxHeight, 'F')
    pdf.setTextColor(255, 255, 255)
    pdf.text('TREATMENT PERFORMED / PHYSICAL FINDINGS', boxX + 2, boxY + boxHeight - 3)
    pdf.setTextColor(0, 0, 0)
    yPosition += boxHeight + 6
    
    pdf.setFontSize(8)
    pdf.setFont('helvetica', 'normal')
    
    const airwayManagement = Array.isArray(data.airwayManagement) && data.airwayManagement.length > 0
    ? data.airwayManagement.join(', ')
    : ''
    yPosition = renderFieldsRow( pdf, [{ label: 'Airway Management:', value: airwayManagement || ' N/A' }], [4], yPosition, options, contentWidth )
    
    yPosition = renderFieldsRow(
      pdf,
      [
        { label: 'CPR Time Started:', value: data.timeStarted || ' N/A' },
        { label: 'CPR Number of Cycles:', value: data.numberOfCycles || ' N/A' },
      ],
      [2, 2], 
      yPosition,
      options,
      contentWidth
    )

    yPosition = renderFieldsRow(
      pdf,
      [
        { label: 'AED Number of Shocks:', value: data.numberOfShocks || ' N/A' },
        { label: 'Shock Not Advised:', value: data.shockNotAdvised || ' N/A' },
      ],
      [2, 2], 
      yPosition,
      options,
      contentWidth
    )

    const hemorrhageControl = Array.isArray(data.hemorrhageControl) && data.hemorrhageControl.length > 0
    ? data.hemorrhageControl.join(', ')
    : ''
    const hasTourniquet =
      Array.isArray(data.hemorrhageControl) &&
      data.hemorrhageControl.includes('Tourniquet');
    yPosition = renderFieldsRow( 
      pdf, 
      [
        { label: 'Hemorrhage Control:', value: hemorrhageControl || ' N/A' },
        { label: 'Tourniquet Time:', value: hasTourniquet ? (data.timeApplied || '') : ' N/A' },
        { label: 'Turns:', value: hasTourniquet ? (String(data.numberOfTurns ?? '')) : ' N/A' },
      ],
      [2, 1, 1], 
      yPosition, 
      options, 
      contentWidth 
    )

    const immobilization = Array.isArray(data.immobilization) && data.immobilization.length > 0
    ? data.immobilization.join(', ')
    : ''
    yPosition = renderFieldsRow( 
      pdf, 
      [
        { label: 'Immobilization:', value: immobilization || ' N/A' },
        { label: 'Patient Position:', value: data.positionOfPatient || '' },
      ], 
      [2, 2], 
      yPosition, 
      options, 
      contentWidth,
    )

    return yPosition
  }

  /**
   * Add injury canvas drawing
   */
  private async addInjuryCanvas(
    pdf: jsPDF,
    canvasData: string,
    options: Required<PDFOptions>,
    yPosition: number,
    contentWidth: number,
    data: PCRFormData
  ): Promise<number> {
    try {
      pdf.setDrawColor(0)
      pdf.setLineWidth(0.4)
      pdf.line(
        options.margins.left,
        yPosition,
        pdf.internal.pageSize.getWidth() - options.margins.right,
        yPosition
      )
      yPosition += 6

      pdf.setFont('helvetica', 'bold')
      pdf.text('Pain Assessment:', options.margins.left, yPosition)

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

      // Two-column layout (left: text, right: image)
      const columnGap = 8
      const leftColWidth = (contentWidth - columnGap) / 2
      const imgWidth = (contentWidth - columnGap) / 2
      const imgHeight = imgWidth * 0.4 // Maintain your chosen aspect ratio
      const startY = yPosition

      // --- Draw image on the RIGHT half ---
      const rightX = options.margins.left + leftColWidth + columnGap
      pdf.addImage(
        imageDataUrl,
        'PNG',
        rightX,
        startY,
        imgWidth,
        imgHeight
      )

      // --- Render OPQRST on the LEFT half ---
      let yText = startY
      yText += 6
      yText = renderMultilineBlock(
        pdf, 'Onset:', data.onset || '', yText, options, leftColWidth
      )
      yText = renderMultilineBlock(
        pdf, 'Provocation:', data.provocation || '', yText, options, leftColWidth
      )
      yText = renderMultilineBlock(
        pdf, 'Quality:', data.quality || '', yText, options, leftColWidth
      )
      yText = renderMultilineBlock(
        pdf, 'Radiation:', data.radiation || '', yText, options, leftColWidth
      )
      yText = renderFieldsRow(
        pdf, [{ label: 'Scale:', value: data.scale || '' }], [4], yText, options, leftColWidth
      )
      yText = renderFieldsRow(
        pdf, [{ label: 'Time:', value: data.time || '' }], [4], yText, options, leftColWidth
      )

      // Advance Y by the taller of image vs text, plus a small spacer
      const textHeight = yText - startY
      return startY + Math.max(imgHeight, textHeight) + 5
    } catch (error) {
      console.error('Failed to add injury canvas:', error)
      return yPosition
    }
  }

  /**
   * Add O2 Protocol
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
    const headerBarH = 8
    const x0 = options.margins.left
    const pageH = pdf.internal.pageSize.getHeight()
    const bottom = options.margins.bottom

    const headers = ['Time', 'Pulse', 'Resp', 'B/P', 'LOC,GCS', 'Skin,Temp', 'Pupils']
    const nCols = headers.length
    const colW = contentWidth / nCols
    const cellPadX = 1.5
    const lineH = pdf.getLineHeightFactor() * (pdf.getFontSize() * 0.3528)

    const drawSectionHeader = () => {
      const boxX = x0
      const boxW = contentWidth
      const boxY = yPosition
      pdf.setFillColor(100, 100, 100)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(9)
      pdf.rect(boxX, boxY, boxW, headerBarH, 'F')
      pdf.setTextColor(255, 255, 255)
      pdf.text('VITAL SIGNS', boxX + 2, boxY + headerBarH - 3)
      pdf.setTextColor(0, 0, 0)
      yPosition += headerBarH + 4  
    }

    const drawTableHeader = () => {
      pdf.setFillColor(220, 220, 220)
      const rowH = Math.max(6, lineH + 2)
      pdf.rect(x0, yPosition, contentWidth, rowH, 'F')
      pdf.setFontSize(8)
      pdf.setFont('helvetica', 'bold')
      for (let i = 0; i < nCols; i++) {
        const cellX = x0 + i * colW
        pdf.text(headers[i], cellX + colW / 2, yPosition + rowH - 2, { align: 'center' })
      }
      pdf.setDrawColor(0)
      pdf.rect(x0, yPosition, contentWidth, rowH)
      for (let i = 1; i < nCols; i++) {
        const vx = x0 + i * colW
        pdf.line(vx, yPosition, vx, yPosition + rowH)
      }
      yPosition += rowH
      pdf.setFont('helvetica', 'normal')
    }

    const ensureRoom = (need: number) => {
      if (yPosition + need > pageH - bottom) {
        pdf.addPage()
        yPosition = options.margins.top
        drawSectionHeader()
        drawTableHeader()
      }
    }

    drawSectionHeader()
    drawTableHeader()

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)

    for (const v of vitalSigns) {
      const rowVals = [
        v.time ?? '',
        v.pulse ?? '',
        v.resp ?? '',
        v.bp ?? '',
        v.loc ?? '',
        v.skin ?? '',
        v.pupils ?? '',
      ].map(String)

      const cellLines: string[][] = []
      let rowLinesMax = 1
      for (let i = 0; i < nCols; i++) {
        const maxW = colW - 2 * cellPadX
        const lines = pdf.splitTextToSize(rowVals[i], Math.max(4, maxW))
        cellLines.push(lines)
        rowLinesMax = Math.max(rowLinesMax, Math.max(1, lines.length))
      }

      const rowH = rowLinesMax * lineH + 2
      ensureRoom(rowH)

      pdf.rect(x0, yPosition, contentWidth, rowH)
      for (let i = 1; i < nCols; i++) {
        const vx = x0 + i * colW
        pdf.line(vx, yPosition, vx, yPosition + rowH)
      }

      for (let i = 0; i < nCols; i++) {
        const cellCX = x0 + i * colW + colW / 2   
        const startY = yPosition + lineH         
        const lines = cellLines[i]
        for (let k = 0; k < lines.length; k++) {
          pdf.text(lines[k], cellCX, startY + k * lineH, { align: 'center' })
        }
      }

      yPosition += rowH
    }

    return yPosition + 4
  }

  /**
   * Add O2 Protocol
   */
  private addOxygenProtocol(
    pdf: jsPDF,
    oxygenProtocol: OxygenProtocol,
    vitalSigns2: VitalSigns2[],
    options: Required<PDFOptions>,
    yPosition: number,
    contentWidth: number
  ): number {
    const boxHeight = 8
    yPosition = ensureSpaceFor(pdf, options, yPosition, boxHeight + 6)
    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'bold')
    const boxX = options.margins.left
    const boxWidth = pdf.internal.pageSize.getWidth() - options.margins.left - options.margins.right
    const boxY = yPosition
    pdf.setFillColor(100, 100, 100)
    pdf.rect(boxX, boxY, boxWidth, boxHeight, 'F')
    pdf.setTextColor(255, 255, 255)
    pdf.text('OXYGEN PROTOCOL', boxX + 2, boxY + boxHeight - 3)
    pdf.setTextColor(0, 0, 0)
    yPosition += boxHeight + 6

    pdf.setFontSize(8)
    pdf.setFont('helvetica', 'normal')

    // 1) Oxygen Saturation Assessment
    const hasSaturationAny =
      !!oxygenProtocol?.saturation_range || oxygenProtocol?.spo2 !== undefined || !!oxygenProtocol?.spo2_acceptable
    if (hasSaturationAny) {
      yPosition = renderFieldsRow(
        pdf,
        [
          { label: 'Saturation Target Range: ', value: oxygenProtocol?.saturation_range || '' },
          { label: 'Initial SpO2 %:', value: oxygenProtocol?.spo2 || '' },
          { label: 'Initial SpO2 Acceptable:', value: oxygenProtocol?.spo2_acceptable || '' },
        ],
        [2, 1, 1],
        yPosition,
        options,
        contentWidth
      )
    }

    // 2) Oxygen Therapy Decision
    if (oxygenProtocol?.oxygen_given) {
      yPosition = renderFieldsRow(
        pdf,
        [
          { label: 'Oxygen Therapy Given?: ', value: oxygenProtocol.oxygen_given || '' },
          { label: 'Who Started Therapy: ', value: String(oxygenProtocol.whoStartedTherapy ?? ' N/A') },
        ],
        [2, 2],
        yPosition,
        options,
        contentWidth
      )

      // Reason (string or array)
      const reason = Array.isArray(oxygenProtocol?.reasonForO2Therapy)
        ? oxygenProtocol.reasonForO2Therapy.filter(Boolean).join(', ')
        : (oxygenProtocol?.reasonForO2Therapy ?? '')
      if (oxygenProtocol.oxygen_given === 'yes' && reason) {
        yPosition = renderFieldsRow(
          pdf,
          [{ label: 'Reason for O2 Therapy: ', value: reason }],
          [4],
          yPosition,
          options,
          contentWidth
        )
      }

      // Times
      const hasTimes = !!oxygenProtocol?.timeTherapyStarted || !!oxygenProtocol?.timeTherapyEnded
      if (oxygenProtocol.oxygen_given === 'yes' && hasTimes) {
        yPosition = renderFieldsRow(
          pdf,
          [
            { label: 'Time Therapy Started: ', value: oxygenProtocol?.timeTherapyStarted || '' },
            { label: 'Time Therapy Ended: ', value: oxygenProtocol?.timeTherapyEnded || '' },
          ],
          [2, 2],
          yPosition,
          options,
          contentWidth
        )
      }

      // Initial flow + device
      const hasInitFlowDevice = oxygenProtocol?.flowRate != null || !!oxygenProtocol?.deliveryDevice
      if (oxygenProtocol.oxygen_given === 'yes' && hasInitFlowDevice) {
        yPosition = renderFieldsRow(
          pdf,
          [
            { label: 'Delivery Device:', value: oxygenProtocol?.deliveryDevice || '' },
            { label: 'Initial Flow Rate (L/min):', value: oxygenProtocol?.flowRate || '' },
          ],
          [2, 2],
          yPosition,
          options,
          contentWidth
        )
      }

    // 3) Flow Rate Alterations table (transposed)
		const alterations = (oxygenProtocol?.flowRateAlterations || []).filter(
			(a) => (a?.time && a.time.trim() !== '') || (a?.flowRate && String(a.flowRate).trim() !== '')
		)

  if (oxygenProtocol.oxygen_given === 'yes' && alterations.length > 0) {
    // table metrics (we need these BEFORE drawing to know required height)
    const labels = ['Time of Change', 'Flow Rate (L/min)']
    const nRows = labels.length
    const rowHeight = 6
    const labelColWidth = Math.min(30, contentWidth * 0.25)
    const nDataCols = Math.max(1, alterations.length)
    const denom = Math.max(8, nDataCols)
    const dataColWidth = (contentWidth - labelColWidth) / denom
    const tableHeight = nRows * rowHeight

    // need: spacing before header (4) + header line (4) + table + trailing spacer (6)
    const needed = 4 + 4 + tableHeight + 6
    yPosition = ensureSpaceFor(pdf, options, yPosition, needed)

    // small sub-header
    yPosition += 4
    pdf.setFont('helvetica', 'bold')
    pdf.text('Flow Rate Alterations:', options.margins.left, yPosition)
    pdf.setFont('helvetica', 'normal')
    yPosition += 4

    const x0 = options.margins.left
    const tableWidth = labelColWidth + nDataCols * dataColWidth

    // left header column background
    pdf.setFillColor(220, 220, 220)
    pdf.rect(x0, yPosition, labelColWidth, tableHeight, 'F')

    // outer border (actual used width)
    pdf.setDrawColor(0)
    pdf.rect(x0, yPosition, tableWidth, tableHeight)

    // black vertical separator after labels column
    const sepX = x0 + labelColWidth
    pdf.line(sepX, yPosition, sepX, yPosition + tableHeight)

    // vertical lines between data columns
    for (let c = 1; c < nDataCols; c++) {
      const vx = x0 + labelColWidth + c * dataColWidth
      pdf.line(vx, yPosition, vx, yPosition + tableHeight)
    }

    // horizontal lines between rows
    for (let r = 1; r < nRows; r++) {
      const hy = yPosition + r * rowHeight
      pdf.line(x0, hy, x0 + tableWidth, hy)
    }

    // row labels
    pdf.setFontSize(8)
    pdf.setFont('helvetica', 'bold')
    labels.forEach((label, r) => {
      pdf.text(label, x0 + (labelColWidth / 2), yPosition + r * rowHeight + 4, { align: 'center' })
    })

    // data cells
    pdf.setFont('helvetica', 'normal')
    for (let c = 0; c < nDataCols; c++) {
      const a = alterations[c] || {}
      const colValues = [a?.time ?? '', a?.flowRate != null ? String(a.flowRate) : '']
      colValues.forEach((cell, r) => {
        const cellX = x0 + labelColWidth + c * dataColWidth
        const cellY = yPosition + r * rowHeight
        pdf.text(String(cell), cellX + (dataColWidth / 2), cellY + 4, { align: 'center' })
      })
    }

    yPosition += tableHeight + 6
  }

      // 4) End of Therapy
      const hasEnd = !!oxygenProtocol?.reasonForEndingTherapy || !!oxygenProtocol?.whoStartedTherapy
      if (hasEnd) {
        // Reason
        if (oxygenProtocol?.reasonForEndingTherapy) {
          yPosition = renderMultilineBlock(
            pdf,
            `Reason for Ending Therapy:`, oxygenProtocol.reasonForEndingTherapy || '',
            yPosition,
            options,
            contentWidth
          )
        }
      }
    }
    
    const readings = (vitalSigns2 ?? []).filter(v => {
      const s = (v?.spo2 ?? '');
      return s !== null && s !== undefined && String(s).trim() !== '';
    });

    if (readings.length > 0) {
      pdf.setDrawColor(0)
      pdf.setLineWidth(0.4)
      pdf.line(
        options.margins.left,
        yPosition,
        pdf.internal.pageSize.getWidth() - options.margins.right,
        yPosition
      )
      yPosition += 6
    }

    pdf.setFont('helvetica', 'bold')
    pdf.text('SpO2 Readings:', options.margins.left, yPosition)
    pdf.setFont('helvetica', 'normal')
    yPosition += 4

    const labels = ['Time', 'SpO2 (%)'] // rows
    const nRows = labels.length
    const nDataCols = Math.max(1, (vitalSigns2?.length || 0))

    const x0 = options.margins.left
    const rowHeight = 6
    const labelColWidth = Math.min(30, contentWidth * 0.25) // left header column

    // columns take 1/8 width unless more than 8 entries, then fit all
    const denom = Math.max(8, nDataCols)
    const dataColWidth = (contentWidth - labelColWidth) / denom
    const tableWidth = labelColWidth + nDataCols * dataColWidth
    const tableHeight = nRows * rowHeight

    // Left header column background
    pdf.setFillColor(220, 220, 220)
    pdf.rect(x0, yPosition, labelColWidth, tableHeight, 'F')

    // Outer border (use actual used width)
    pdf.setDrawColor(0)
    pdf.rect(x0, yPosition, tableWidth, tableHeight)

    // *** BLACK vertical line after the labels column ***
    const sepX = x0 + labelColWidth
    pdf.line(sepX, yPosition, sepX, yPosition + tableHeight)

    // Vertical lines between data columns
    for (let c = 1; c < nDataCols; c++) {
      const vx = x0 + labelColWidth + c * dataColWidth
      pdf.line(vx, yPosition, vx, yPosition + tableHeight)
    }

    // Horizontal lines between rows
    for (let r = 1; r < nRows; r++) {
      const hy = yPosition + r * rowHeight
      pdf.line(x0, hy, x0 + tableWidth, hy)
    }

    // Row labels (left header col)
    pdf.setFontSize(8)
    pdf.setFont('helvetica', 'bold')
    labels.forEach((label, r) => {
      pdf.text(label, x0 + (labelColWidth / 2), yPosition + r * rowHeight + 4, { align: 'center' })
    })

    // Data cells
    pdf.setFont('helvetica', 'normal')
    for (let c = 0; c < nDataCols; c++) {
      const vital = vitalSigns2[c] || {}
      const colValues = [
        vital.time ?? '',
        (vital.spo2 != null ? String(vital.spo2) : ''),
      ]

      colValues.forEach((cell, r) => {
        const cellX = x0 + labelColWidth + c * dataColWidth
        const cellY = yPosition + r * rowHeight
        pdf.text(String(cell), cellX + (dataColWidth / 2), cellY + 4, { align: 'center' }) 
      })
    }

    yPosition += tableHeight + 4

    return yPosition
  }


  /**
   * Add comments and transport information
   */
  private addTransportInformation(
    pdf: jsPDF,
    data: PCRFormData,
    options: Required<PDFOptions>,
    yPosition: number,
    contentWidth: number
  ): number {
    const boxHeight = 8
    yPosition = ensureSpaceFor(pdf, options, yPosition, boxHeight + 6)
    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'bold')
    const boxX = options.margins.left
    const boxWidth = pdf.internal.pageSize.getWidth() - options.margins.left - options.margins.right
    const boxY = yPosition
    pdf.setFillColor(100, 100, 100)
    pdf.rect(boxX, boxY, boxWidth, boxHeight, 'F')
    pdf.setTextColor(255, 255, 255)
    pdf.text('CALL DESCRIPTION', boxX + 2, boxY + boxHeight - 3)
    pdf.setTextColor(0, 0, 0)
    yPosition += boxHeight + 6

    pdf.setFontSize(8)
    pdf.setFont('helvetica', 'normal')

    yPosition = renderMultilineBlock(
      pdf,
      '',
      (data.comments || '').trim(),
      yPosition,
      options,
      contentWidth
    );
    
    const boxHeight2 = 8
    yPosition = ensureSpaceFor(pdf, options, yPosition, boxHeight2 + 6)
    const boxX2 = options.margins.left
    const boxWidth2 = pdf.internal.pageSize.getWidth() - options.margins.left - options.margins.right
    const boxY2 = yPosition
    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'bold')
    pdf.setFillColor(100, 100, 100)
    pdf.rect(boxX2, boxY2, boxWidth2, boxHeight2, 'F')
    pdf.setTextColor(255, 255, 255)
    pdf.text('PATIENT TRANSFER DETAILS', boxX2 + 2, boxY2 + boxHeight2 - 3)
    pdf.setTextColor(0, 0, 0)
    yPosition += boxHeight2 + 6

    pdf.setFontSize(8)
    pdf.setFont('helvetica', 'normal')

    const transferFields: { label: string; value: string }[] = [
      { label: 'Patient Care Transferred To: ', value: data.patientCareTransferred || '' },
    ]

    let spans: number[] = [2, 2]

    // Conditionally add the extra field based on who received care
    if (data.patientCareTransferred === 'Paramedics' && data.unitNumber) {
      transferFields.push({ label: 'Unit #:', value: data.unitNumber })
      transferFields.push({ label: 'Time Care Transferred: ', value: data.timeCareTransferred || '' })
      spans = [2, 1, 1]
    } else if (data.patientCareTransferred === 'Police' && data.badgeNumber) {
      transferFields.push({ label: 'Badge #:', value: data.badgeNumber })
      transferFields.push({ label: 'Time Care Transferred: ', value: data.timeCareTransferred || '' })
      spans = [2, 1, 1]
    } else if (data.patientCareTransferred === 'Clinic' && data.clinicName) {
      transferFields.push({ label: 'Clinic:', value: data.clinicName })
      transferFields.push({ label: 'Time Care Transferred: ', value: data.timeCareTransferred || '' })
      spans = [2, 1, 1]
    } else {
      transferFields.push({ label: 'Time Care Transferred: ', value: data.timeCareTransferred || '' })
      spans = [3, 1]
    }

    yPosition = renderFieldsRow(
      pdf,
      transferFields,
      spans,
      yPosition,
      options,
      contentWidth
    )

    pdf.setFont('helvetica', 'bold')
		pdf.text('Comments: ', options.margins.left, yPosition)
		pdf.setFont('helvetica', 'normal')
		yPosition += 4

    yPosition = renderMultilineBlock(
      pdf,
      '',
      (data.transferComments || '').trim(),
      yPosition,
      options,
      contentWidth
    );

    return yPosition + 4
  }

  /**
   * Signatures + footer strip pinned to the very bottom of the page.
   * It reserves a fixed-height area above the bottom margin, regardless of current y.
   */
  private addSignaturesAndFooter(
    pdf: jsPDF,
    data: PCRFormData,
    options: Required<PDFOptions>,
    yPosition: number,
  ): number {
    const pageW = pdf.internal.pageSize.getWidth()
    const pageH = pdf.internal.pageSize.getHeight()

    // Layout
    const stripHeight = 32
    const labelGap = 4
    const boxHeight = 14
    const boxPadX = 3
    const topLineGap = 4

    const bottom = options.margins.bottom
    const x0 = options.margins.left
    const x1 = pageW - options.margins.right

    // Page collision check
    const stripTopY = pageH - bottom - stripHeight
    if (yPosition > stripTopY - topLineGap) {
      pdf.addPage()
    }

    const sigTopY = pageH - options.margins.bottom - stripHeight
    const sigBottomY = pageH - options.margins.bottom

    // Separator line above strip
    pdf.setDrawColor(0)
    pdf.setLineWidth(0.4)
    pdf.line(x0, sigTopY - 2, x1, sigTopY - 2)

    // Always 4 equal quarters
    const totalWidth = x1 - x0
    const colW = totalWidth / 4

    const titles = ['Supervisor', 'Responder 1', 'Responder 2', 'Responder 3']
    const names  = [
      data.supervisor ?? '',
      data.responder1 ?? '',
      data.responder2 ?? '',
      data.responder3 ?? '',
    ]

    const labelY = sigTopY + 4
    const nameY  = labelY + 4
    const boxY   = nameY + labelGap

    for (let i = 0; i < 4; i++) {
      const colX = x0 + i * colW
      const boxX = colX + boxPadX
      const boxW = colW - 2 * boxPadX

      const title = titles[i]
      const name  = names[i]

      // Draw logic:
      // - Supervisor column always drawn
      // - Responder columns drawn only if name present
      const shouldDraw = i === 0 || (name && String(name).trim() !== '')
      if (!shouldDraw) continue

      // Title
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(8)
      pdf.setTextColor(0, 0, 0)
      pdf.text(title, colX + colW / 2, labelY, { align: 'center' })

      // Name (if provided)
      if (name) {
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(8)
        pdf.text(String(name), colX + colW / 2, nameY, { align: 'center' })
      }

      // Signature box
      pdf.setFillColor(230, 230, 230)
      pdf.setDrawColor(200, 200, 200)
      pdf.setLineWidth(0.2)
      pdf.rect(boxX, boxY, boxW, boxHeight, 'FD')
    }

    return sigBottomY
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