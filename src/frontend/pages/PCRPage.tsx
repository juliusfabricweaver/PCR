import React, { useState } from 'react'
import { Send, RotateCcw, AlertTriangle, Clock, CheckCircle } from 'lucide-react'
import { Button, Card, Alert, Modal } from '@/components/ui'
import {
  Input,
  Select,
  RadioGroup,
  Checkbox,
  DatePicker,
  TimePicker,
  Textarea,
  FormSection,
} from '@/components/forms'
import { VitalSignsTable, InjuryCanvas, OxygenProtocolForm } from '@/components/composite'
import { useForm } from '../context/FormContext'
import { useNotification } from '../context/NotificationContext'
import { cn, getCurrentTime, formatDate } from '../utils'
import { pdfService } from '../services/pdf.service'
import type { PCRFormData, VitalSign, VitalSigns2 } from '../types'

const PCRPage: React.FC = () => {
  const { data, updateField, errors, isDirty, isValid, reset, validateField } = useForm()
  const { showNotification } = useNotification()
  const [showUnsavedChangesModal, setShowUnsavedChangesModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [testMode, setTestMode] = useState(false)


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
            // Submit to backend API after PDF is confirmed printed
            const response = await fetch('/api/submissions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('pcr_token')}`
              },
              body: JSON.stringify({
                data: {
                  ...data,
                  printedAt: timestamp,
                  printConfirmed: true
                }
              })
            })

            if (!response.ok) {
              throw new Error('Failed to submit PCR form')
            }

            showNotification('PCR form submitted successfully', 'success')
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
      date: formatDate(new Date()),
      location: 'Main Campus - Building A',
      callNumber: 'PCR-2025-001',
      reportNumber: 'RPT-001',
      supervisor: 'John Smith',
      timeNotified: '14:30',
      onScene: '14:35',
      clearedScene: '15:45',
      firstAgencyOnScene: 'Campus Security',
      patientName: 'Test Patient',
      age: 25,
      sex: 'Male',
      positionOfPatient: 'Supine',
      comments: 'Sample call description for testing PDF generation functionality.',
      transferComments: 'Patient care transferred to paramedics without incident.',
      patientCareTransferred: 'Paramedics',
      timeCareTransferred: '15:40',
      chiefComplaint: 'Minor injury - testing',
      primaryPSM: 'Jane Doe'
    }

    Object.entries(sampleData).forEach(([key, value]) => {
      updateField(key as keyof PCRFormData, value)
    })
    showNotification('Sample data filled for testing', 'info')
  }

  // Test PDF generation without validation
  const testPDFGeneration = async () => {
    setIsSubmitting(true)
    try {
      await pdfService.confirmPrintedWorkflow(data, async (confirmed, timestamp) => {
        if (confirmed) {
          showNotification('PDF test completed successfully!', 'success')
        } else {
          showNotification('PDF test cancelled', 'info')
        }
        setIsSubmitting(false)
      })
    } catch (error) {
      console.error('PDF test failed:', error)
      showNotification('PDF test failed', 'error')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Patient Care Report
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Complete all required fields to submit the report
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
          
          <Button 
            type="button" 
            variant="outline" 
            size="sm" 
            onClick={testPDFGeneration}
            loading={isSubmitting}
          >
            Test PDF
          </Button>

          {isDirty && (
            <div className="flex items-center space-x-1 text-amber-600 dark:text-amber-400">
              <Clock className="w-4 h-4" />
              <span className="text-sm">Unsaved changes</span>
            </div>
          )}

          {!isDirty && isValid && (
            <div className="flex items-center space-x-1 text-green-600 dark:text-green-400">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm">All changes saved</span>
            </div>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Information */}
        <FormSection
          title="Basic Information"
          subtitle="Essential call details and response information"
          required
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <DatePicker
              label="Date"
              value={data.date || formatDate(new Date())}
              onChange={e => updateField('date', e.target.value)}
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
              placeholder="Supervising officer"
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
              placeholder="First responder"
            />

            <Input
              label="Responder 2"
              value={data.responder2 || ''}
              onChange={e => updateField('responder2', e.target.value)}
              placeholder="Second responder"
            />

            <Input
              label="Responder 3"
              value={data.responder3 || ''}
              onChange={e => updateField('responder3', e.target.value)}
              placeholder="Third responder"
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
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Emergency Contact Name"
              value={data.emergencyContactName || ''}
              onChange={e => updateField('emergencyContactName', e.target.value)}
              placeholder="Contact person name"
            />

            <Input
              label="Emergency Contact Phone"
              type="tel"
              value={data.emergencyContactPhone || ''}
              onChange={e => updateField('emergencyContactPhone', e.target.value)}
              placeholder="Phone number"
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
            />

            <Textarea
              label="Signs and Symptoms"
              value={data.signsSymptoms || ''}
              onChange={e => updateField('signsSymptoms', e.target.value)}
              placeholder="Observable signs and reported symptoms..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Textarea
              label="Allergies"
              value={data.allergies || ''}
              onChange={e => updateField('allergies', e.target.value)}
              placeholder="Known allergies..."
              rows={2}
            />

            <Textarea
              label="Medications"
              value={data.medications || ''}
              onChange={e => updateField('medications', e.target.value)}
              placeholder="Current medications..."
              rows={2}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Textarea
              label="Pertinent Medical History"
              value={data.medicalHistory || ''}
              onChange={e => updateField('medicalHistory', e.target.value)}
              placeholder="Relevant medical history..."
              rows={2}
            />

            <Textarea
              label="Last Meal"
              value={data.lastMeal || ''}
              onChange={e => updateField('lastMeal', e.target.value)}
              placeholder="When and what was last consumed..."
              rows={2}
            />
          </div>

          <Textarea
            label="Rapid Body Survey Findings"
            value={data.bodySurvey || ''}
            onChange={e => updateField('bodySurvey', e.target.value)}
            placeholder="Physical examination findings..."
            rows={3}
          />
        </FormSection>

        {/* Treatment Performed */}
        <FormSection 
          title="Treatment Performed" 
          subtitle="Interventions and care provided to the patient"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <Checkbox
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
                value={data.airwayManagement || []}
                onChange={(value) => updateField('airwayManagement', value)}
              />
              
              {Array.isArray(data.airwayManagement) && data.airwayManagement.includes('Other') && (
                <Input
                  label="Other Airway Management (specify)"
                  value={data.airwayManagementOther || ''}
                  onChange={(e) => updateField('airwayManagementOther', e.target.value)}
                  placeholder="Please specify"
                />
              )}
              
              <Checkbox
                name="hemorrhageControl"
                label="Hemorrhage Control"
                options={[
                  { value: 'Direct Pressure', label: 'Direct Pressure' },
                  { value: 'Dressing', label: 'Dressing' },
                  { value: 'Tourniquet', label: 'Tourniquet' },
                ]}
                value={data.hemorrhageControl || []}
                onChange={(value) => updateField('hemorrhageControl', value)}
              />
              
              <Checkbox
                name="immobilization"
                label="Immobilization"
                options={[
                  { value: 'C-Collar', label: 'C-Collar' },
                  { value: 'Splints', label: 'Splints' },
                  { value: 'C-spine Manually Held', label: 'C-spine Manually Held' },
                ]}
                value={data.immobilization || []}
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
              placeholder="When did it start?"
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
            
            <TimePicker
              label="Time"
              value={data.time || ''}
              onChange={(e) => updateField('time', e.target.value)}
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
              { key: 'spo2' as keyof VitalSigns2, label: 'SPO2', width: 'w-20' },
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
