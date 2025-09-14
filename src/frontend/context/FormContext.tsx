import React, { createContext, useContext, useReducer, useCallback } from 'react'
import { validationRules } from '@/utils'
import type { FormContextType, PCRFormData } from '@/types'

interface FormState {
  data: Partial<PCRFormData>
  errors: Record<string, string>
  isDirty: boolean
  isValid: boolean
}

type FormAction =
  | { type: 'UPDATE_FIELD'; payload: { field: keyof PCRFormData; value: any } }
  | { type: 'UPDATE_NESTED_FIELD'; payload: { section: string; field: string; value: any } }
  | { type: 'SET_ERROR'; payload: { field: string; error: string } }
  | { type: 'CLEAR_ERROR'; payload: { field: string } }
  | { type: 'VALIDATE_ALL' }
  | { type: 'RESET' }
  | { type: 'LOAD_DATA'; payload: Partial<PCRFormData> }

const initialState: FormState = {
  data: {
    vitalSigns: [{}],
    vitalSigns2: [{}],
    airwayManagement: [],
    hemorrhageControl: [],
    immobilization: [],
    oxygenProtocol: {
      reasonForO2Therapy: [],
    },
  },
  errors: {},
  isDirty: false,
  isValid: false,
}

// Validation rules for PCR form
const validationSchema = {
  // Required fields from form_inputs.md
  date: [(value: string) => validationRules.required(value), 'Date is required'],
  location: [(value: string) => validationRules.required(value), 'Location is required'],
  callNumber: [(value: string) => validationRules.required(value), 'Call number is required'],
  reportNumber: [(value: string) => validationRules.required(value), 'Report number is required'],
  supervisor: [(value: string) => validationRules.required(value), 'Supervisor is required'],
  timeNotified: [(value: string) => validationRules.required(value), 'Time notified is required'],
  onScene: [(value: string) => validationRules.required(value), 'On scene time is required'],
  clearedScene: [(value: string) => validationRules.required(value), 'Cleared scene time is required'],
  firstAgencyOnScene: [(value: string) => validationRules.required(value), 'First agency on scene is required'],
  patientName: [(value: string) => validationRules.required(value), 'Patient name is required'],
  positionOfPatient: [(value: string) => validationRules.required(value), 'Position of patient is required'],
  comments: [(value: string) => validationRules.required(value), 'Call description is required'],
  transferComments: [(value: string) => validationRules.required(value), 'Transfer of care is required'],
  patientCareTransferred: [(value: string) => validationRules.required(value), 'Patient care transferred is required'],
  timeCareTransferred: [(value: string) => validationRules.required(value), 'Time care transferred is required'],
  
  // Email validation
  emergencyContactEmail: [(value: string) => !value || value.includes('@'), 'Please enter a valid email'],
  
  // Time format validation
  timeNotified: [(value: string) => !value || /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value), 'Please use HH:MM format'],
  onScene: [(value: string) => !value || /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value), 'Please use HH:MM format'],
  clearedScene: [(value: string) => !value || /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value), 'Please use HH:MM format'],
  timeCareTransferred: [(value: string) => !value || /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value), 'Please use HH:MM format'],
  
  // Number validation
  age: [(value: string) => !value || (Number(value) >= 0 && Number(value) <= 150), 'Please enter a valid age'],
  scale: [(value: number) => !value || (value >= 1 && value <= 10), 'Scale must be between 1-10'],

  // Age or DOB validation - at least one must be filled
  ageOrDob: [(data: Partial<PCRFormData>) => {
    const age = data.age;
    const dob = data.dob;
    return !!(age && age.trim()) || !!(dob && dob.trim());
  }, 'Either age or date of birth must be provided'],
} as Record<string, [(value: any) => boolean, string][]>

const formReducer = (state: FormState, action: FormAction): FormState => {
  switch (action.type) {
    case 'UPDATE_FIELD':
      return {
        ...state,
        data: {
          ...state.data,
          [action.payload.field]: action.payload.value,
        },
        isDirty: true,
      }
      
    case 'UPDATE_NESTED_FIELD':
      return {
        ...state,
        data: {
          ...state.data,
          [action.payload.section]: {
            ...(state.data[action.payload.section as keyof PCRFormData] as any),
            [action.payload.field]: action.payload.value,
          },
        },
        isDirty: true,
      }
      
    case 'SET_ERROR':
      return {
        ...state,
        errors: {
          ...state.errors,
          [action.payload.field]: action.payload.error,
        },
        isValid: Object.keys({
          ...state.errors,
          [action.payload.field]: action.payload.error,
        }).length === 0,
      }
      
    case 'CLEAR_ERROR':
      const newErrors = { ...state.errors }
      delete newErrors[action.payload.field]
      return {
        ...state,
        errors: newErrors,
        isValid: Object.keys(newErrors).length === 0,
      }
      
    case 'VALIDATE_ALL':
      const allErrors: Record<string, string> = {}
      
      Object.entries(validationSchema).forEach(([field, rules]) => {
        const value = field === 'ageOrDob' ? state.data : state.data[field as keyof PCRFormData]

        for (const [rule, message] of rules) {
          if (!rule(value)) {
            allErrors[field] = message
            break
          }
        }
      })
      
      return {
        ...state,
        errors: allErrors,
        isValid: Object.keys(allErrors).length === 0,
      }
      
    case 'RESET':
      return initialState
      
    case 'LOAD_DATA':
      return {
        ...state,
        data: {
          ...initialState.data,
          ...action.payload,
        },
        isDirty: false,
      }
      
    default:
      return state
  }
}

const FormContext = createContext<FormContextType | undefined>(undefined)

interface FormProviderProps {
  children: React.ReactNode
}

export const FormProvider: React.FC<FormProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(formReducer, initialState)

  const updateField = useCallback((field: keyof PCRFormData, value: any) => {
    dispatch({ type: 'UPDATE_FIELD', payload: { field, value } })
    
    // Clear error for this field if it exists
    if (state.errors[field]) {
      dispatch({ type: 'CLEAR_ERROR', payload: { field } })
    }
  }, [state.errors])

  const updateNestedField = useCallback((section: string, field: string, value: any) => {
    dispatch({ type: 'UPDATE_NESTED_FIELD', payload: { section, field, value } })
  }, [])

  const validateField = useCallback((field: string): boolean => {
    const rules = validationSchema[field]
    if (!rules) return true

    const value = field === 'ageOrDob' ? state.data : state.data[field as keyof PCRFormData]

    for (const [rule, message] of rules) {
      if (!rule(value)) {
        dispatch({ type: 'SET_ERROR', payload: { field, error: message } })
        return false
      }
    }

    dispatch({ type: 'CLEAR_ERROR', payload: { field } })
    return true
  }, [state.data])

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' })
  }, [])

  const contextValue: FormContextType = {
    data: state.data,
    updateField,
    updateNestedField,
    errors: state.errors,
    isDirty: state.isDirty,
    isValid: state.isValid,
    reset,
    validateField,
  }

  return (
    <FormContext.Provider value={contextValue}>
      {children}
    </FormContext.Provider>
  )
}

export const useForm = (): FormContextType => {
  const context = useContext(FormContext)
  if (!context) {
    throw new Error('useForm must be used within a FormProvider')
  }
  return context
}
