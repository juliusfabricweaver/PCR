import React, { useState, useEffect } from 'react'
import { Send, RotateCcw, AlertTriangle, Clock, CheckCircle, Save } from 'lucide-react'
import { Button, Card, Alert, Modal } from '@/components/ui'
import {
  Input,
  Select,
  RadioGroup,
  Checkbox,
  CheckboxGroup,
  DatePicker,
  TimePicker,
  Textarea,
  FormSection,
} from '@/components/forms'
import { VitalSignsTable, InjuryCanvas, OxygenProtocolForm } from '@/components/composite'
import { useForm } from '../context/FormContext'
import { useNotification } from '../context/NotificationContext'
import { useAuth } from '../context/AuthContext'
import { cn, getCurrentTime, formatDate } from '../utils'
import { pdfService } from '../services/pdf.service'
import type { PCRFormData, VitalSign, VitalSigns2 } from '../types'

const PCRPage: React.FC = () => {
  const { data, updateField, errors, isDirty, isValid, reset, validateField, loadData } = useForm()
  const { showNotification } = useNotification()
  const { token, isAuthenticated } = useAuth()
  const [showUnsavedChangesModal, setShowUnsavedChangesModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingDraft, setIsLoadingDraft] = useState(false)
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null)
  const [isSavingDraft, setIsSavingDraft] = useState(false)
  const lastAutoCommentsRef = React.useRef<string>('')

  useEffect(() => {
    const loadDraftFromUrl = async () => {
      const urlParams = new URLSearchParams(window.location.search)
      const draftId = urlParams.get('draftId')

      if (draftId && isAuthenticated && token) {
        setIsLoadingDraft(true)
        setCurrentDraftId(draftId)

        try {
          const response = await fetch(`/api/pcr/${draftId}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          })

          if (!response.ok) {
            throw new Error('Failed to load draft')
          }

          const data = await response.json()
          const draftData = data.data

          if (draftData.status === 'draft') {
            loadData(draftData.form_data)
            showNotification('Draft loaded successfully', 'success')
          } else {
            showNotification('This report is not a draft and cannot be edited', 'error')
          }
        } catch (error) {
          console.error('Failed to load draft:', error)
          showNotification('Failed to load draft', 'error')
        } finally {
          setIsLoadingDraft(false)
        }
      }

      if (!data.date) {
        const todayISO = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        updateField('date', todayISO);
      }
    }

    loadDraftFromUrl()
  }, [isAuthenticated, token, loadData, showNotification])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Validate form data for PDF generation
      const validation = pdfService.validateDataForPDF(data)
      if (!validation.isValid) {
        showNotification(`Please complete required fields: ${validation.errors.join(', ')}`, 'error')
        setIsSubmitting(false)
        return
      }

      // Generate PDF and show print confirmation workflow
      await pdfService.confirmPrintedWorkflow(data, async (confirmed, timestamp) => {
        if (confirmed) {
          try {
            // Update existing draft or create new submission
            const url = currentDraftId ? `/api/pcr/${currentDraftId}` : '/api/submissions'
            const method = currentDraftId ? 'PUT' : 'POST'

            const response = await fetch(url, {
              method,
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify(
                currentDraftId
                  ? {
                      form_data: {
                        ...data,
                        printedAt: timestamp,
                        printConfirmed: true
                      },
                      status: 'submitted'
                    }
                  : {
                      data: {
                        ...data,
                        printedAt: timestamp,
                        printConfirmed: true
                      }
                    }
              )
            })

            if (!response.ok) {
              throw new Error('Failed to submit PCR form')
            }

            showNotification(
              currentDraftId
                ? 'Draft updated and submitted successfully'
                : 'PCR form submitted successfully',
              'success'
            )
            reset()
          } catch (submitError) {
            console.error('Submission failed:', submitError)
            showNotification('Failed to submit PCR form to server', 'error')
          }
        } else {
          // User cancelled - don't submit to backend
          showNotification('Form submission cancelled', 'info')
        }
        setIsSubmitting(false)
      })
    } catch (error) {
      console.error('PDF generation failed:', error)
      showNotification('Failed to generate PDF report', 'error')
      setIsSubmitting(false)
    }
  }

  const handleReset = () => {
    if (isDirty) {
      setShowUnsavedChangesModal(true)
    } else {
      reset()
      showNotification('Form reset successfully', 'success')
    }
  }

  const confirmReset = () => {
    reset()
    setShowUnsavedChangesModal(false)
    showNotification('Form reset successfully', 'success')
  }

  const handleSaveDraft = async () => {
    if (!isAuthenticated || !token) {
      showNotification('Please log in to save drafts', 'error')
      return
    }

    setIsSavingDraft(true)

    try {
      // If we're editing an existing draft, update it. Otherwise create new draft.
      const url = currentDraftId ? `/api/pcr/${currentDraftId}` : '/api/pcr'
      const method = currentDraftId ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          form_data: data,
          status: 'draft'
        })
      })

      if (!response.ok) {
        throw new Error('Failed to save draft')
      }

      const responseData = await response.json()

      // If this was a new draft, update our current draft ID
      if (!currentDraftId && responseData.data?.id) {
        setCurrentDraftId(responseData.data.id)
        // Update URL to include draft ID for future saves
        const newUrl = new URL(window.location.href)
        newUrl.searchParams.set('draftId', responseData.data.id)
        window.history.replaceState({}, '', newUrl.toString())
      }

      showNotification('Draft saved successfully', 'success')
    } catch (error) {
      console.error('Save draft failed:', error)
      showNotification('Failed to save draft', 'error')
    } finally {
      setIsSavingDraft(false)
    }
  }

  const handleVitalSignsChange = (vitalSigns: VitalSign[]) => {
    updateField('vitalSigns', vitalSigns)
  }

  const handleVitalSigns2Change = (vitalSigns2: VitalSigns2[]) => {
    updateField('vitalSigns2', vitalSigns2)
  }

  const calculateAgeFromDOB = (dob: string): number => {
    const birthDate = new Date(dob)
    const today = new Date()
    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }

    return age
  }

  const handleDOBChange = (dob: string) => {
    updateField('dob', dob)

    if (dob && dob.trim()) {
      const calculatedAge = calculateAgeFromDOB(dob)
      if (calculatedAge >= 0 && calculatedAge <= 150) {
        updateField('age', calculatedAge.toString())
      }
    }

    // Clear age/DOB validation error when either field is updated
    if (errors.ageOrDob) {
      validateField('ageOrDob')
    }
  }

  const handleAgeChange = (age: string) => {
    updateField('age', age)

    // Clear age/DOB validation error when either field is updated
    if (errors.ageOrDob) {
      validateField('ageOrDob')
    }
  }

  // Test function to fill sample data
  const fillSampleData = () => {
    const sampleData: Partial<PCRFormData> = {
      // --- Basic Information (required) ---
      date: formatDate(new Date()),                 
      location: 'Morisset 6th floor',
      callNumber: '002',
      reportNumber: '2025-001',
      supervisor: 'Hailey Bieber',
      primaryPSM: 'Kim Kardashian',
      responder1: 'Frodo Baggins',
      responder2: 'Cersei Lannister',
      responder3: 'Tony Stark',
      timeNotified: '14:30',
      workplaceInjury: 'No',
      onScene: '14:35',
      clearedScene: '15:15',
      firstAgencyOnScene: 'Protection Services',

      // Optional-but-nice
      transportArrived: '15:10',
      paramedicsCalledBy: 'Responder 1',

      // --- Patient Information ---
      patientName: 'Harry Potter',                 
      age: '25',                                                            
      sex: 'Male',
      status: 'Student',

      // requireUnknown fields in this section
      studentEmployeeNumber: '300718038',
      emergencyContactName: 'Lily Potter (Mother)',
      emergencyContactPhone: '(613) 671-3781',
      contacted: 'Yes',
      contactedBy: 'Harry Potter',

      // --- Treatment / Findings ---
      positionOfPatient: 'Seated',                
      airwayManagement: ['Positioning'],
      hemorrhageControl: ['Direct Pressure'],
      immobilization: [],

      // CPR/AED (optional)
      timeStarted: '',
      numberOfCycles: '',
      numberOfShocks: '',
      shockNotAdvised: '',

      // --- OPQRST (optional) ---
      onset: 'Acute',
      provocation: 'Movement worsens',
      quality: 'Sharp',
      radiation: 'None',
      scale: 4 as any, 
      time: '14:20',

      // --- Medical History (all these textareas were set with requireUnknown) ---
      chiefComplaint: 'Injured knee',
      signsSymptoms: 'Panic attack symptoms, bleeding right knee',
      allergies: 'Bee stings',
      medications: 'DNO',
      medicalHistory: 'Nothing to note',
      lastMeal: 'Happy Meal, 2 hours ago, sat well',
      bodySurvey: 'No other findings',

      // --- Oxygen Protocol (optional) ---
      oxygenProtocol: {
        saturation_range: '94–98%',
        spo2: '96',
        spo2_acceptable: 'Yes',
      } as any,

      // --- Additional Information (required group) ---
      transferComments: 'Patient care transferred to paramedics yada yada yada.',
      patientCareTransferred: 'Paramedics',        
      unitNumber: 'A-123',                         
      timeCareTransferred: '15:12',                
    }

    Object.entries(sampleData).forEach(([key, value]) => {
      updateField(key as keyof PCRFormData, value as any)
    })
    showNotification('Sample data filled for testing', 'info')
  }


  const hasTourniquet =
    Array.isArray(data.hemorrhageControl) &&
    data.hemorrhageControl.includes('Tourniquet')

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {currentDraftId ? 'Edit Patient Care Report Draft' : 'Patient Care Report'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {isLoadingDraft 
              ? 'Loading draft...'
              : currentDraftId
                ? 'Editing existing draft - complete and submit when ready'
                : 'Complete all required fields to submit the report'
            }
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Test buttons for development */}
          <Button 
            type="button" 
            variant="outline" 
            size="sm" 
            onClick={fillSampleData}
          >
            Fill Sample Data
          </Button>

          {!isDirty && isValid && (
            <div className="flex items-center space-x-1 text-green-600 dark:text-green-400">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm">All changes saved</span>
            </div>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {isLoadingDraft && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="text-gray-900 dark:text-gray-100">Loading draft...</span>
              </div>
            </div>
          </div>
        )}
        {/* Basic Information */}
        <FormSection
          title="Basic Information"
          subtitle="Essential call details and response information"
          required
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <DatePicker
              label="Date"
              value={data.date ?? ''}   // don’t show fallback directly here
              onChange={(v: any) => {
                const next = typeof v === 'string' ? v : v?.target?.value ?? '';
                updateField('date', next);
              }}
              error={errors.date}
              required
            />

            <Input
              label="Location"
              value={data.location || ''}
              onChange={e => updateField('location', e.target.value)}
              error={errors.location}
              placeholder="Incident location"
              required
            />

            <Input
              label="Call Number"
              value={data.callNumber || ''}
              onChange={e => updateField('callNumber', e.target.value)}
              error={errors.callNumber}
              placeholder="Call #"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Input
              label="Report Number"
              value={data.reportNumber || ''}
              onChange={e => updateField('reportNumber', e.target.value)}
              error={errors.reportNumber}
              placeholder="Report #"
              required
            />

            <Input
              label="Supervisor"
              value={data.supervisor || ''}
              onChange={e => updateField('supervisor', e.target.value)}
              error={errors.supervisor}
              placeholder="Supervisor name"
              required
            />

            <Input
              label="Primary PSM"
              value={data.primaryPSM || ''}
              onChange={e => updateField('primaryPSM', e.target.value)}
              placeholder="Primary PSM name"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Responder 1"
              value={data.responder1 || ''}
              onChange={e => updateField('responder1', e.target.value)}
              placeholder="First responder name"
            />

            <Input
              label="Responder 2"
              value={data.responder2 || ''}
              onChange={e => updateField('responder2', e.target.value)}
              placeholder="Second responder name"
            />

            <Input
              label="Responder 3"
              value={data.responder3 || ''}
              onChange={e => updateField('responder3', e.target.value)}
              placeholder="Third responder name"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <TimePicker
              label="Time Notified"
              value={data.timeNotified || ''}
              onChange={e => updateField('timeNotified', e.target.value)}
              error={errors.timeNotified}
              required
            />

            <TimePicker
              label="On Scene"
              value={data.onScene || ''}
              onChange={e => updateField('onScene', e.target.value)}
              error={errors.onScene}
              required
            />

            <TimePicker
              label="Transport Arrived"
              value={data.transportArrived || ''}
              onChange={e => updateField('transportArrived', e.target.value)}
            />

            <TimePicker
              label="Cleared Scene"
              value={data.clearedScene || ''}
              onChange={e => updateField('clearedScene', e.target.value)}
              error={errors.clearedScene}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Paramedics Called by"
              value={data.paramedicsCalledBy || ''}
              onChange={e => updateField('paramedicsCalledBy', e.target.value)}
              placeholder="Who called paramedics"
            />

            <Input
              label="First Agency on Scene"
              value={data.firstAgencyOnScene || ''}
              onChange={e => updateField('firstAgencyOnScene', e.target.value)}
              error={errors.firstAgencyOnScene}
              placeholder="First responding agency"
              required
            />
          </div>
        </FormSection>

        {/* Patient Information */}
        <FormSection
          title="Patient Information"
          subtitle="Patient demographics and contact details"
          required
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Input
              label="Patient Name"
              value={data.patientName || ''}
              onChange={e => updateField('patientName', e.target.value)}
              error={errors.patientName}
              placeholder="Full name"
              required
            />

            <DatePicker
              label="Date of Birth"
              value={data.dob || ''}
              onChange={e => handleDOBChange(e.target.value)}
            />

            <Input
              label="Age"
              type="number"
              min="0"
              max="150"
              value={data.age || ''}
              onChange={e => handleAgeChange(e.target.value)}
              error={errors.age}
              placeholder="Age in years"
              required
            />
          </div>

          {errors.ageOrDob && (
            <Alert variant="error" className="mb-4">
              {errors.ageOrDob}
            </Alert>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RadioGroup
              name="sex"
              label="Sex"
              options={[
                { value: 'Male', label: 'Male' },
                { value: 'Female', label: 'Female' },
                { value: 'Different from gender', label: 'Different from gender' },
                { value: 'Does not want to disclose', label: 'Does not want to disclose' },
                { value: 'Other', label: 'Other' },
              ]}
              value={data.sex}
              onChange={value => updateField('sex', value)}
            />

            {data.sex === 'Other' && (
              <Input
                label="Other Sex (specify)"
                value={data.otherSex || ''}
                onChange={e => updateField('otherSex', e.target.value)}
                placeholder="Please specify"
              />
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RadioGroup
              name="status"
              label="Status"
              options={[
                { value: 'Student', label: 'Student' },
                { value: 'Employee', label: 'Employee' },
                { value: 'Visitor/Other', label: 'Visitor/Other' },
              ]}
              value={data.status}
              onChange={value => updateField('status', value)}
            />

            {data.status === 'Visitor/Other' && (
              <Input
                label="Visitor/Other (specify)"
                value={data.visitorText || ''}
                onChange={e => updateField('visitorText', e.target.value)}
                placeholder="Please specify"
                requireUnknown
              />
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <RadioGroup
              name="workplaceInjury"
              label="Workplace Injury?"
              options={[
                { value: 'Yes', label: 'Yes' },
                { value: 'No', label: 'No' },
              ]}
              orientation="horizontal"
              value={data.workplaceInjury}
              onChange={value => updateField('workplaceInjury', value)}
            />

            <Input
              label="Student/Employee Number"
              value={data.studentEmployeeNumber || ''}
              onChange={e => updateField('studentEmployeeNumber', e.target.value)}
              placeholder="ID number"
              requireUnknown
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Emergency Contact Name (and Relationship)"
              value={data.emergencyContactName || ''}
              onChange={e => updateField('emergencyContactName', e.target.value)}
              placeholder="Contact person name and relationship"
              requireUnknown
            />

            <Input
              label="Emergency Contact Phone"
              type="tel"
              value={data.emergencyContactPhone || ''}
              onChange={e => updateField('emergencyContactPhone', e.target.value)}
              placeholder="Phone number"
              requireUnknown
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <RadioGroup
              name="contacted"
              label="Contacted?"
              options={[
                { value: 'Yes', label: 'Yes' },
                { value: 'No', label: 'No' },
              ]}
              orientation="horizontal"
              value={data.contacted}
              onChange={value => updateField('contacted', value)}
            />

            <Input
              label="Contacted by"
              value={data.contactedBy || ''}
              onChange={e => updateField('contactedBy', e.target.value)}
              placeholder="Who made contact"
              requireUnknown
            />
          </div>
        </FormSection>

        {/* Medical History */}
        <FormSection
          title="Patient Medical History"
          subtitle="Medical background and assessment findings"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Textarea
              label="Chief Complaint"
              value={data.chiefComplaint || ''}
              onChange={e => updateField('chiefComplaint', e.target.value)}
              placeholder="Primary reason for call..."
              rows={3}
              requireUnknown
            />

            <Textarea
              label="Signs and Symptoms"
              value={data.signsSymptoms || ''}
              onChange={e => updateField('signsSymptoms', e.target.value)}
              placeholder="Observable signs and reported symptoms..."
              rows={3}
              requireUnknown
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Textarea
              label="Allergies"
              value={data.allergies || ''}
              onChange={e => updateField('allergies', e.target.value)}
              placeholder="Known allergies and reactions..."
              rows={2}
              requireUnknown
            />

            <Textarea
              label="Medications"
              value={data.medications || ''}
              onChange={e => updateField('medications', e.target.value)}
              placeholder="Current medications (name, dose, reason, taken as prescribed)..."
              rows={2}
              requireUnknown
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Textarea
              label="Pertinent Medical History"
              value={data.medicalHistory || ''}
              onChange={e => updateField('medicalHistory', e.target.value)}
              placeholder="Relevant medical history..."
              rows={2}
              requireUnknown
            />

            <Textarea
              label="Last Meal"
              value={data.lastMeal || ''}
              onChange={e => updateField('lastMeal', e.target.value)}
              placeholder="When and what was last consumed, and whether it sat well..."
              rows={2}
              requireUnknown
            />
          </div>

          <Textarea
            label="Rapid Body Survey Findings"
            value={data.bodySurvey || ''}
            onChange={e => updateField('bodySurvey', e.target.value)}
            placeholder="Physical examination findings..."
            rows={3}
            requireUnknown
          />
        </FormSection>

        {/* Treatment Performed */}
		    <FormSection 
			    title="Treatment Performed" 
			    subtitle="Interventions and care provided to the patient"
		    >
			    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
				    <div className="space-y-4">
					    <CheckboxGroup
						    name="airwayManagement"
						    label="Airway Management"
						    options={[
							    { value: 'Suctioning', label: 'Suctioning' },
							    { value: 'Positioning', label: 'Positioning' },
							    { value: 'OPA', label: 'OPA' },
							    { value: 'BVM', label: 'BVM' },
							    { value: 'Pocket Mask', label: 'Pocket Mask' },
							    { value: 'Other', label: 'Other' },
						    ]}
						    value={Array.isArray(data.airwayManagement) ? data.airwayManagement : []}
						    onChange={(value) => updateField('airwayManagement', value)}
					    />

              <CheckboxGroup
                name="hemorrhageControl"
                label="Hemorrhage Control"
                options={[
                  { value: 'Direct Pressure', label: 'Direct Pressure' },
                  { value: 'Dressing', label: 'Dressing' },
                  { value: 'Tourniquet', label: 'Tourniquet' },
                ]}
                value={Array.isArray(data.hemorrhageControl) ? data.hemorrhageControl : []}
                onChange={(value) => {
                  updateField('hemorrhageControl', value)
                  if (!value.includes('Tourniquet')) {
                    updateField('timeApplied', '')
                    updateField('numberOfTurns', '')
                  }
                }}
              />

              <CheckboxGroup
                name="immobilization"
                label="Immobilization"
                options={[
                  { value: 'C-Collar', label: 'C-Collar' },
                  { value: 'Splints', label: 'Splints' },
                  { value: 'C-spine Manually Held', label: 'C-spine Manually Held' },
                ]}
                value={Array.isArray(data.immobilization) ? data.immobilization : []}
                onChange={(value) => updateField('immobilization', value)}
              />
            </div>

            <div className="space-y-4">
              <div className="border rounded-lg p-4 space-y-3">
                <h4 className="font-medium text-gray-900 dark:text-gray-100">CPR</h4>
                <div className="grid grid-cols-2 gap-3">
                  <TimePicker
                    label="Time Started"
                    value={data.timeStarted || ''}
                    onChange={(e) => updateField('timeStarted', e.target.value)}
                  />
                  <Input
                    label="Number of Cycles"
                    type="number"
                    value={data.numberOfCycles || ''}
                    onChange={(e) => updateField('numberOfCycles', e.target.value)}
                    placeholder="0"
                  />
                 </div>
              </div>

              <div className="border rounded-lg p-4 space-y-3">
                <h4 className="font-medium text-gray-900 dark:text-gray-100">AED</h4>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Shocks (#)"
                    type="number"
                    value={data.numberOfShocks || ''}
                    onChange={(e) => updateField('numberOfShocks', e.target.value)}
                    placeholder="0"
                  />
                  <Input
                    label="Shock Not Advised (#)"
                    type="number"
                    value={data.shockNotAdvised || ''}
                    onChange={(e) => updateField('shockNotAdvised', e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>

              {hasTourniquet && (
                <div className="border rounded-lg p-4 space-y-3">
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">Tourniquet</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <TimePicker
                      label="Time Applied"
                      value={data.timeApplied || ''}
                      onChange={(e) => updateField('timeApplied', e.target.value)}
                    />
                    <Input
                      label="Number of Turns"
                      type="number"
                      value={data.numberOfTurns || ''}
                      onChange={(e) => updateField('numberOfTurns', e.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <Input
            label="Position of Patient"
            value={data.positionOfPatient || ''}
            onChange={(e) => updateField('positionOfPatient', e.target.value)}
            error={errors.positionOfPatient}
            placeholder="Patient position"
            required
          />
        </FormSection>


        {/* OPQRST Assessment */}
        <FormSection 
          title="OPQRST Assessment" 
          subtitle="Pain and symptom assessment"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Input
              label="Onset"
              value={data.onset || ''}
              onChange={(e) => updateField('onset', e.target.value)}
              placeholder="Acute/chronic"
            />
            
            <Input
              label="Provocation"
              value={data.provocation || ''}
              onChange={(e) => updateField('provocation', e.target.value)}
              placeholder="What makes it better/worse?"
            />
            
            <Input
              label="Quality"
              value={data.quality || ''}
              onChange={(e) => updateField('quality', e.target.value)}
              placeholder="How does it feel?"
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Input
              label="Radiation"
              value={data.radiation || ''}
              onChange={(e) => updateField('radiation', e.target.value)}
              placeholder="Where does it radiate?"
            />
            
            <Input
              label="Scale (1-10)"
              type="number"
              min="1"
              max="10"
              value={data.scale || ''}
              onChange={(e) => updateField('scale', e.target.value)}
              placeholder="Pain scale"
            />
            
            <Input
              label="Time"
              value={data.time || ''}
              onChange={(e) => updateField('time', e.target.value)}
              placeholder="What time did it occur?"
            />
          </div>
        </FormSection>

        {/* Injury Location */}
        <FormSection 
          title="Injury Location" 
          subtitle="Mark injury locations on body diagram"
        >
          <InjuryCanvas
            value={data.injuryCanvas}
            onChange={(value) => updateField('injuryCanvas', value)}
          />
        </FormSection>

        {/* Vital Signs Table 1 */}
        <FormSection 
          title="Vital Signs" 
          subtitle="Patient vital signs measurements"
        >
          <VitalSignsTable
            data={data.vitalSigns || []}
            onChange={handleVitalSignsChange}
          />
        </FormSection>

        {/* Oxygen Protocol */}
        <FormSection 
          title="Oxygen Protocol" 
          subtitle="Oxygen therapy administration details"
        >
          <OxygenProtocolForm
            data={data.oxygenProtocol || {}}
            onChange={(oxygenProtocolData) => updateField('oxygenProtocol', oxygenProtocolData)}
            errors={errors}
          />
        </FormSection>

        {/* Vital Signs Table 2 */}
        <FormSection 
          title="Additional Vital Signs" 
          subtitle="SpO2 measurements over time"
        >
          <VitalSignsTable
            data={data.vitalSigns2 || []}
            onChange={handleVitalSigns2Change}
            title="SpO2 Measurements"
            columns={[
              { key: 'time' as keyof VitalSigns2, label: 'Time', width: 'w-24' },
              { key: 'spo2' as keyof VitalSigns2, label: 'SPO2', width: 'w-24' },
            ]}
          />
        </FormSection>

        {/* Additional Information */}
        <FormSection 
          title="Additional Information" 
          subtitle="Call details and patient transfer information"
          required
        >
          <div className="space-y-4">
            <Textarea
              label="Call Description"
              value={data.comments || ''}
              onChange={(e) => updateField('comments', e.target.value)}
              error={errors.comments}
              placeholder="Detailed description of the call..."
              rows={4}
              required
            />
            
            <Textarea
              label="Transfer of Care"
              value={data.transferComments || ''}
              onChange={(e) => updateField('transferComments', e.target.value)}
              error={errors.transferComments}
              placeholder="Details about patient transfer..."
              rows={3}
              required
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <RadioGroup
                name="patientCareTransferred"
                label="Patient Care Transferred"
                options={[
                  { value: 'Paramedics', label: 'Paramedics' },
                  { value: 'Police', label: 'Police' },
                  { value: 'Self', label: 'Self' },
                  { value: 'Family/Friend', label: 'Family/Friend' },
                  { value: 'Clinic', label: 'Clinic' },
                ]}
                value={data.patientCareTransferred}
                onChange={(value) => updateField('patientCareTransferred', value)}
                error={errors.patientCareTransferred}
                required
              />
              
              {data.patientCareTransferred === 'Paramedics' && (
                <Input
                  label="Unit Number"
                  value={data.unitNumber || ''}
                  onChange={(e) => updateField('unitNumber', e.target.value)}
                  placeholder="Paramedic unit number"
                  requireUnknown
                />
              )}

              {data.patientCareTransferred === 'Police' && (
                <Input
                  label="Badge Number"
                  value={data.badgeNumber || ''}
                  onChange={(e) => updateField('badgeNumber', e.target.value)}
                  placeholder="Police badge number"
                  requireUnknown
                />
              )}

              {data.patientCareTransferred === 'Clinic' && (
                <Input
                  label="Clinic Name"
                  value={data.clinicName || ''}
                  onChange={(e) => updateField('clinicName', e.target.value)}
                  placeholder="Clinic name"
                  requireUnknown
                />
              )}
            </div>
            
            <TimePicker
              label="Time Care Transferred"
              value={data.timeCareTransferred || ''}
              onChange={(e) => updateField('timeCareTransferred', e.target.value)}
              error={errors.timeCareTransferred}
              required
            />
          </div>
        </FormSection>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-6 border-t border-gray-200 dark:border-gray-700">
          <div className="flex space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              leftIcon={<RotateCcw className="w-4 h-4" />}
            >
              Reset Form
            </Button>
          </div>

          <div className="flex items-center space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleSaveDraft}
              loading={isSavingDraft}
              disabled={isSavingDraft}
              leftIcon={<Save className="w-4 h-4" />}
            >
              {isSavingDraft ? 'Saving...' : 'Save Draft'}
            </Button>

            <div className="relative">
              <Button
                type="submit"
                loading={isSubmitting}
                disabled={isSubmitting}
                leftIcon={<Send className="w-4 h-4" />}
              >
                {isSubmitting ? 'Submitting...' : 'Submit PCR'}
              </Button>
              
              {!isValid && Object.keys(errors).length > 0 && (
                <div className="absolute bottom-full mb-2 right-0 w-64 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded text-sm text-red-700 dark:text-red-300">
                  <p className="font-medium mb-1">Required fields missing:</p>
                  <ul className="text-xs space-y-1">
                    {Object.entries(errors).slice(0, 5).map(([field, error]) => (
                      <li key={field}>• {error}</li>
                    ))}
                    {Object.keys(errors).length > 5 && (
                      <li>• ... and {Object.keys(errors).length - 5} more</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </form>

      {/* Unsaved Changes Modal */}
      <Modal
        isOpen={showUnsavedChangesModal}
        onClose={() => setShowUnsavedChangesModal(false)}
        title="Unsaved Changes"
      >
        <div className="space-y-4">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-gray-900 dark:text-gray-100">
                You have unsaved changes that will be lost if you reset the form.
              </p>
              <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                Are you sure you want to continue?
              </p>
            </div>
          </div>

          <div className="flex space-x-3 pt-4">
            <Button variant="outline" onClick={() => setShowUnsavedChangesModal(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmReset}>
              Reset Form
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default PCRPage
