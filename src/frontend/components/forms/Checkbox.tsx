import React, { forwardRef } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/utils'

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
  description?: string
  error?: string
  indeterminate?: boolean
}

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(({
  label,
  description,
  error,
  indeterminate = false,
  className,
  ...props
}, ref) => {
  const checkboxId = props.id || `checkbox-${Math.random().toString(36).substr(2, 9)}`

  return (
    <div className="space-y-1">
      <div className="flex items-center">
        <div className="flex items-center h-4">
          <div className="relative w-4 h-4 translate-y-[-5px]">
            <input
              ref={ref}
              type="checkbox"
              id={checkboxId}
              className={cn(
                'appearance-none bg-none checked:bg-none',  
                'w-4 h-4 text-primary-600 bg-white border-gray-300 rounded focus:ring-primary-500',
                'focus:ring-2 focus:ring-offset-0 dark:bg-gray-700 dark:border-gray-600',
                'checked:bg-primary-600 checked:border-primary-600',
                'disabled:cursor-not-allowed disabled:opacity-50',
                error && 'border-emergency-500 focus:ring-emergency-500',
                className
              )}
              aria-invalid={error ? 'true' : 'false'}
              aria-describedby={
                error ? `${checkboxId}-error` : description ? `${checkboxId}-description` : undefined
              }
              {...props}
            />
            {indeterminate && (
              <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <div className="w-2 h-0.5 bg-primary-600 rounded-full" />
              </div>
            )}
            {props.checked && !indeterminate && (
              <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <Check className="w-3 h-3 text-white block translate-y-[6px]" strokeWidth={3} />
              </div>
            )}
          </div>
        </div>
        
        {label && (
          <div className="ml-3">
            <label
              htmlFor={checkboxId}
              className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer"
            >
              {label}
            </label>
            {description && (
              <p
                id={`${checkboxId}-description`}
                className="text-sm text-gray-500 dark:text-gray-400"
              >
                {description}
              </p>
            )}
          </div>
        )}
      </div>
      
      {error && (
        <p id={`${checkboxId}-error`} className="form-error ml-7" role="alert">
          {error}
        </p>
      )}
    </div>
  )
})

Checkbox.displayName = 'Checkbox'

export default Checkbox