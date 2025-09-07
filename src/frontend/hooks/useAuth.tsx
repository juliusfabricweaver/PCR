import { createContext, useContext } from 'react'
import { User } from '@/types'

export interface AuthContextType {
  user: User | null
  login: (credentials: { username: string; password: string }) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  loading: boolean
  error: string | null
}

export const AuthContext = createContext<AuthContextType | null>(null)

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}