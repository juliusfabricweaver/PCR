import React, { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/utils'
import type { FormSectionProps } from '@/types'

const FormSection: React.FC<FormSectionProps> = ({
  title,
  subtitle,
  children,
  isCollapsible = false,
  defaultOpen = true,
  required = false,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  const toggleOpen = () => {
    if (isCollapsible) {
      setIsOpen(!isOpen)
    }
  }

  return (
    <div className="mb-8">
      <div
        className={cn(
          'border-b border-gray-200 pb-4 mb-6 dark:border-gray-700',
          isCollapsible && 'cursor-pointer select-none'
        )}
        onClick={toggleOpen}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className={cn(
              'text-xl font-semibold text-gray-900 dark:text-gray-100',
              required && 'after:content-["*"] after:text-emergency-500 after:ml-1'
            )}>
              {title}
            </h2>
            {subtitle && (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {subtitle}
              </p>
            )}
          </div>
          
          {isCollapsible && (
            <button
              type="button"
              className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
              aria-expanded={isOpen}
              aria-controls={`section-${title.replace(/\s+/g, '-').toLowerCase()}`}
            >
              {isOpen ? (
                <ChevronDown className="w-5 h-5" />
              ) : (
                <ChevronRight className="w-5 h-5" />
              )}
            </button>
          )}
        </div>
      </div>
      
      {isOpen && (
        <div
          id={`section-${title.replace(/\s+/g, '-').toLowerCase()}`}
          className="space-y-6"
        >
          {children}
        </div>
      )}
    </div>
  )
}

export default FormSection