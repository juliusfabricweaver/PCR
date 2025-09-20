import React, { forwardRef } from 'react'
import { cn } from '@/utils'

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  helpText?: string
  resize?: 'none' | 'both' | 'horizontal' | 'vertical'
  /** Treat as required and, if empty, show a custom message suggesting DNO/UTO when unknown */
  requireUnknown?: boolean
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({
  label,
  error,
  helpText,
  resize = 'vertical',
  className,
  required,
  requireUnknown,
  id,
  onInvalid,
  onInput,
  ...props
}, ref) => {
  const textareaId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`

  const resizeClasses = {
    none: 'resize-none',
    both: 'resize',
    horizontal: 'resize-x',
    vertical: 'resize-y',
  }

  const handleInvalid: React.FormEventHandler<HTMLTextAreaElement> = (e) => {
    if (requireUnknown) {
      e.currentTarget.setCustomValidity('Please fill in (use DNO or UTO if unknown)')
    }
    if (onInvalid) onInvalid(e)
  }

  const handleInput: React.FormEventHandler<HTMLTextAreaElement> = (e) => {
    e.currentTarget.setCustomValidity('')
    if (onInput) onInput(e)
  }

  const isRequired = required || requireUnknown

  return (
    <div className="space-y-1">
      {label && (
        <label
          htmlFor={textareaId}
          className={cn('form-label', isRequired && 'form-label-required')}
        >
          {label}
        </label>
      )}
      
      <textarea
        ref={ref}
        id={textareaId}
        className={cn(
          'form-input min-h-[80px]',
          resizeClasses[resize],
          error && 'form-input-error',
          className
        )}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={
          error ? `${textareaId}-error` : helpText ? `${textareaId}-help` : undefined
        }
        required={isRequired}
        onInvalid={handleInvalid}
        onInput={handleInput}
        {...props}
      />
      
      {error && (
        <p id={`${textareaId}-error`} className="form-error" role="alert">
          {error}
        </p>
      )}
      
      {helpText && !error && (
        <p id={`${textareaId}-help`} className="form-help">
          {helpText}
        </p>
      )}
    </div>
  )
})

Textarea.displayName = 'Textarea'

export default Textarea