import React from 'react'
import { Input, Select, RadioGroup, Checkbox, TimePicker, Textarea } from '@/components/forms'
import { FormSection } from '@/components/forms'
import { Card, Button } from '@/components/ui'
import { Plus, Trash2 } from 'lucide-react'
import type { OxygenProtocol } from '@/types'

interface OxygenProtocolFormProps {
  data: OxygenProtocol
  onChange: (data: Partial<OxygenProtocol>) => void
  errors?: Record<string, string>
}

const OxygenProtocolForm: React.FC<OxygenProtocolFormProps> = ({
  data,
  onChange,
  errors = {},
}) => {
  const handleFieldChange = (field: keyof OxygenProtocol, value: any) => {
    onChange({ ...data, [field]: value })
  }

  const handleReasonChange = (reasons: string[]) => {
    onChange({ ...data, reasonForO2Therapy: reasons })
  }

  const handleFlowRateChange = (index: number, field: 'time' | 'flowRate', value: string) => {
    const alterations = data.flowRateAlterations || []
    const newAlterations = [...alterations]
    
    if (!newAlterations[index]) {
      newAlterations[index] = {}
    }
    
    newAlterations[index] = { ...newAlterations[index], [field]: value }
    onChange({ ...data, flowRateAlterations: newAlterations })
  }

  const addFlowRateRow = () => {
    const alterations = data.flowRateAlterations || []
    onChange({ 
      ...data, 
      flowRateAlterations: [...alterations, { time: '', flowRate: '' }] 
    })
  }

  const removeFlowRateRow = (index: number) => {
    const alterations = data.flowRateAlterations || []
    const newAlterations = alterations.filter((_, i) => i !== index)
    onChange({ ...data, flowRateAlterations: newAlterations })
  }

  const saturationOptions = [
    { value: 'copd', label: 'COPD (88-92%)' },
    { value: 'other', label: 'Other (94-98%)' },
  ]

  const deliveryDeviceOptions = [
    { value: 'NC', label: 'Nasal Cannula (NC)' },
    { value: 'NRB', label: 'Non-Rebreather Mask (NRB)' },
    { value: 'BVM', label: 'Bag Valve Mask (BVM)' },
  ]

  const whoStartedOptions = [
    { value: 'Protection', label: 'Protection Services' },
    { value: 'VCRT', label: 'VCRT' },
    { value: 'Lifeguard', label: 'Lifeguard' },
  ]

  const reasonOptions = [
    'Respiratory distress',
    'Low oxygen saturation',
    'Chest pain',
    'Shortness of breath',
    'Altered mental status',
    'Cardiac arrest',
    'Trauma with respiratory compromise',
    'Medical emergency',
    'Other',
  ]

  return (
    <div className="space-y-6">
      <FormSection title="Oxygen Saturation Assessment">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <RadioGroup
            name="saturation_range"
            label="Saturation Target Range"
            options={saturationOptions}
            value={data.saturation_range}
            onChange={(value) => handleFieldChange('saturation_range', value as 'copd' | 'other')}
            error={errors.saturation_range}
          />
          
          <Input
            label="Initial SpO₂ %"
            type="number"
            min="0"
            max="100"
            value={data.spo2 || ''}
            onChange={(e) => handleFieldChange('spo2', e.target.value)}
            error={errors.spo2}
            placeholder="98"
          />
        </div>
        
        <RadioGroup
          name="spo2_acceptable"
          label="Initial SpO₂ Acceptable?"
          options={[
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
          ]}
          orientation="horizontal"
          value={data.spo2_acceptable}
          onChange={(value) => handleFieldChange('spo2_acceptable', value as 'yes' | 'no')}
          error={errors.spo2_acceptable}
        />
      </FormSection>

      <FormSection title="Oxygen Therapy Decision">
        <RadioGroup
          name="oxygen_given"
          label="Oxygen Therapy Given?"
          options={[
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
          ]}
          orientation="horizontal"
          value={data.oxygen_given}
          onChange={(value) => handleFieldChange('oxygen_given', value as 'yes' | 'no')}
          error={errors.oxygen_given}
        />

        {data.oxygen_given === 'yes' && (
          <Card>
            <Card.Body>
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900 dark:text-gray-100">
                  Therapy Details
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <TimePicker
                    label="Time Therapy Started"
                    value={data.timeTherapyStarted || ''}
                    onChange={(e) => handleFieldChange('timeTherapyStarted', e.target.value)}
                    error={errors.timeTherapyStarted}
                    required
                  />

                  <TimePicker
                    label="Time Therapy Ended"
                    value={data.timeTherapyEnded || ''}
                    onChange={(e) => handleFieldChange('timeTherapyEnded', e.target.value)}
                    error={errors.timeTherapyEnded}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Initial Flow Rate (L/min)"
                    type="number"
                    min="0"
                    max="15"
                    value={data.flowRate || ''}
                    onChange={(e) => handleFieldChange('flowRate', e.target.value)}
                    error={errors.flowRate}
                    placeholder="2"
                  />

                  <RadioGroup
                    name="deliveryDevice"
                    label="Delivery Device"
                    options={deliveryDeviceOptions}
                    value={data.deliveryDevice}
                    onChange={(value) => handleFieldChange('deliveryDevice', value as 'NC' | 'NRB' | 'BVM')}
                    error={errors.deliveryDevice}
                  />
                </div>
              </div>
            </Card.Body>
          </Card>
        )}
      </FormSection>

      {data.oxygen_given === 'yes' && (
        <>
          <FormSection title="Responders on Call">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Supervisor"
                value={data.o2_supervisor || ''}
                onChange={(e) => handleFieldChange('o2_supervisor', e.target.value)}
                error={errors.o2_supervisor}
              />
              
              <Input
                label="Responder 1"
                value={data.o2_responder1 || ''}
                onChange={(e) => handleFieldChange('o2_responder1', e.target.value)}
                error={errors.o2_responder1}
              />
              
              <Input
                label="Responder 2"
                value={data.o2_responder2 || ''}
                onChange={(e) => handleFieldChange('o2_responder2', e.target.value)}
                error={errors.o2_responder2}
              />
              
              <Input
                label="Responder 3"
                value={data.o2_responder3 || ''}
                onChange={(e) => handleFieldChange('o2_responder3', e.target.value)}
                error={errors.o2_responder3}
              />
            </div>
          </FormSection>

          <FormSection title="Reason for Oxygen Therapy">
            <Checkbox
              name="reasonForO2Therapy"
              label="Reason for O2 Therapy"
              options={reasonOptions.map(reason => ({ value: reason, label: reason }))}
              value={data.reasonForO2Therapy || []}
              onChange={(value) => handleReasonChange(value)}
            />
            
            {data.reasonForO2Therapy?.includes('Other') && (
              <Input
                label="Other Reason (specify)"
                value={data.reasonForO2TherapyOther || ''}
                onChange={(e) => handleFieldChange('reasonForO2TherapyOther', e.target.value)}
                error={errors.reasonForO2TherapyOther}
                placeholder="Describe the other reason..."
              />
            )}
          </FormSection>

          <FormSection title="Flow Rate Alterations">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Record any changes to the oxygen flow rate during therapy
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addFlowRateRow}
                  leftIcon={<Plus className="w-4 h-4" />}
                >
                  Add Change
                </Button>
              </div>

              {(data.flowRateAlterations || []).map((alteration, index) => (
                <Card key={index}>
                  <Card.Body>
                    <div className="flex items-end space-x-4">
                      <div className="flex-1">
                        <TimePicker
                          label="Time of Change"
                          value={alteration.time || ''}
                          onChange={(e) => handleFlowRateChange(index, 'time', e.target.value)}
                        />
                      </div>
                      
                      <div className="flex-1">
                        <Input
                          label="New Flow Rate (L/min)"
                          type="number"
                          min="0"
                          max="15"
                          value={alteration.flowRate || ''}
                          onChange={(e) => handleFlowRateChange(index, 'flowRate', e.target.value)}
                        />
                      </div>
                      
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeFlowRateRow(index)}
                        className="text-emergency-500 hover:text-emergency-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </Card.Body>
                </Card>
              ))}
            </div>
          </FormSection>

          <FormSection title="End of Therapy">
            <div className="space-y-4">
              <Textarea
                label="Reason for Ending Therapy"
                value={data.reasonForEndingTherapy || ''}
                onChange={(e) => handleFieldChange('reasonForEndingTherapy', e.target.value)}
                error={errors.reasonForEndingTherapy}
                placeholder="Describe why oxygen therapy was discontinued..."
                rows={3}
              />
              
              <RadioGroup
                name="whoStartedTherapy"
                label="Who Started Therapy"
                options={whoStartedOptions}
                value={data.whoStartedTherapy}
                onChange={(value) => handleFieldChange('whoStartedTherapy', value as 'Protection' | 'VCRT' | 'Lifeguard')}
                error={errors.whoStartedTherapy}
              />
            </div>
          </FormSection>
        </>
      )}
    </div>
  )
}

export default OxygenProtocolForm