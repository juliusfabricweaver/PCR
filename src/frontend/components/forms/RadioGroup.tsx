import React, { forwardRef } from 'react'
import { cn } from '@/utils'

interface RadioOption {
  value: string
  label: string
  description?: string
  disabled?: boolean
}

interface RadioGroupProps {
  name: string
  label?: string
  options: RadioOption[]
  value?: string
  onChange: (value: string) => void
  error?: string
  helpText?: string
  orientation?: 'horizontal' | 'vertical'
  required?: boolean
  disabled?: boolean
}

const RadioGroup = forwardRef<HTMLFieldSetElement, RadioGroupProps>(({
  name,
  label,
  options,
  value,
  onChange,
  error,
  helpText,
  orientation = 'vertical',
  required = false,
  disabled = false,
}, ref) => {
  const groupId = `radio-group-${Math.random().toString(36).substr(2, 9)}`

  return (
    <fieldset ref={ref} className="space-y-2">
      {label && (
        <legend className={cn('form-label', required && 'form-label-required')}>
          {label}
        </legend>
      )}
      
      <div
        className={cn(
          'space-y-3',
          orientation === 'horizontal' && 'flex flex-wrap gap-6 space-y-0'
        )}
        role="radiogroup"
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={
          error ? `${groupId}-error` : helpText ? `${groupId}-help` : undefined
        }
      >
        {options.map((option, index) => {
          const radioId = `${name}-${index}`
          const isSelected = value === option.value
          const isDisabled = disabled || option.disabled
          
          return (
            <div key={option.value} className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  type="radio"
                  id={radioId}
                  name={name}
                  value={option.value}
                  checked={isSelected}
                  onChange={(e) => onChange(e.target.value)}
                  disabled={isDisabled}
                  className={cn(
                    'w-4 h-4 text-primary-600 bg-white border-gray-300 focus:ring-primary-500',
                    'focus:ring-2 focus:ring-offset-0 dark:bg-gray-700 dark:border-gray-600',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                    error && 'border-emergency-500 focus:ring-emergency-500'
                  )}
                  required={required && index === 0} // Only first radio needs required for HTML validation
                />
              </div>
              
              <div className="ml-3">
                <label
                  htmlFor={radioId}
                  className={cn(
                    'text-sm font-medium cursor-pointer',
                    isDisabled 
                      ? 'text-gray-400 cursor-not-allowed'
                      : 'text-gray-700 dark:text-gray-300'
                  )}
                >
                  {option.label}
                </label>
                
                {option.description && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {option.description}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
      
      {error && (
        <p id={`${groupId}-error`} className="form-error" role="alert">
          {error}
        </p>
      )}
      
      {helpText && !error && (
        <p id={`${groupId}-help`} className="form-help">
          {helpText}
        </p>
      )}
    </fieldset>
  )
})

RadioGroup.displayName = 'RadioGroup'

export default RadioGroup