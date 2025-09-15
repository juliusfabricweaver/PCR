import React, { useEffect, useState } from 'react'
import Checkbox from './Checkbox'
import { cn } from '@/utils'

type Option = { value: string; label: string }

interface CheckboxGroupProps {
  name: string
  label: string
  options: Option[]
  value: string[]
  onChange: (next: string[]) => void
  className?: string
  error?: string
}

const CheckboxGroup: React.FC<CheckboxGroupProps> = ({
  name, label, options, value = [], onChange, className, error,
}) => {
  const selected = Array.isArray(value) ? value : []
  const [expanded, setExpanded] = useState<boolean>(selected.length > 0)

  useEffect(() => {
    setExpanded(selected.length > 0)
  }, [selected.length])

  const toggleOption = (optValue: string, checked: boolean) => {
    const set = new Set(selected)
    checked ? set.add(optValue) : set.delete(optValue)
    onChange(Array.from(set))
  }

  const toggleParent = (checked: boolean) => {
    setExpanded(checked)
    if (!checked) onChange([]) // collapse clears children
  }

  const parentId = `${name}-parent`

  return (
    <div className={cn('space-y-3', className)}>
      {/* Header row with explicit text label */}
      <div className="flex items-center gap-2">
        <Checkbox
          id={parentId}
          name={`${name}-parent`}
          checked={expanded}
          onChange={(e) => toggleParent(e.currentTarget.checked)}
          aria-invalid={Boolean(error)}
        />
        <label
          htmlFor={parentId}
          className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer"
        >
          {label}
        </label>
      </div>

      {/* Children appear only when expanded */}
      {expanded && (
        <div className="ml-7 space-y-2">
          {options.map((opt) => {
            const id = `${name}-${opt.value.replace(/\s+/g, '-')}`
            const isChecked = selected.includes(opt.value)
            return (
              <div key={opt.value} className="flex items-center gap-2">
                <Checkbox
                  id={id}
                  name={name}
                  checked={isChecked}
                  onChange={(e) => toggleOption(opt.value, e.currentTarget.checked)}
                  aria-invalid={Boolean(error)}
                />
                <label
                  htmlFor={id}
                  className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer"
                >
                  {opt.label}
                </label>
              </div>
            )
          })}
        </div>
      )}

      {error && <p className="form-error ml-7">{error}</p>}
    </div>
  )
}

export default CheckboxGroup