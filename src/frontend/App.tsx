import React, { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { Layout } from '@/components/layout'
import { Loading } from '@/components/ui'
import { LoginPage, PCRPage } from '@/pages'
import { AuthProvider, NotificationProvider, FormProvider, useAuth } from '@/context'
import { useTimeout } from '@/hooks'
import DashboardPage from './pages/DashboardPage'
import ReportsPage from './pages/ReportsPage'
import UserManagementPage from './pages/UserManagementPage'

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAuth()

  console.log('ProtectedRoute - Auth state:', { isAuthenticated, isLoading, user })

  if (isLoading) {
    console.log('ProtectedRoute - Still loading')
    return <Loading text="Loading..." overlay />
  }

  if (!isAuthenticated) {
    console.log('ProtectedRoute - Not authenticated, redirecting to login')
    return <Navigate to="/login" replace />
  }

  console.log('ProtectedRoute - Authenticated, rendering children')
  return <>{children}</>
}

// Main Application Component
const AppContent: React.FC = () => {
  const { user, logout, isAuthenticated, isLoading } = useAuth()
  const navigate = useNavigate()
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('pcr_theme')
    return saved ? saved === 'dark' : false
  })
  const [currentPath, setCurrentPath] = useState(window.location.pathname)

  // Session timeout management
  useTimeout({
    timeoutDuration: 30 * 60 * 1000, // 30 minutes
    warningDuration: 5 * 60 * 1000, // 5 minutes warning
    enabled: isAuthenticated,
  })

  // Theme toggle
  const toggleTheme = () => {
    const newTheme = !darkMode
    setDarkMode(newTheme)
    localStorage.setItem('pcr_theme', newTheme ? 'dark' : 'light')

    if (newTheme) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  // Initialize theme
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [darkMode])

  // Handle navigation
  const handleNavigate = (href: string) => {
    navigate(href)
    setCurrentPath(href)
  }

  if (isLoading) {
    return <Loading text="Initializing application..." overlay />
  }

  if (!isAuthenticated) {
    return <LoginPage />
  }

  return (
    <Layout
      currentPath={currentPath}
      user={
        user
          ? {
              name: `${user.firstName} ${user.lastName}`,
              role: user.role,
            }
          : undefined
      }
      onLogout={logout}
      onNavigate={handleNavigate}
      darkMode={darkMode}
      onToggleTheme={toggleTheme}
    >
      <Routes>
        {/* Dashboard */}
        <Route
          path="/dashboard"
          element={
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Welcome back, {user?.firstName}! Here's your PCR system overview.
                </p>
              </div>
            </div>
          }
        />

        {/* New PCR Form */}
        <Route
          path="/pcr/new"
          element={
            <FormProvider>
              <PCRPage />
            </FormProvider>
          }
        />

        {/* PCR Reports */}
        <Route
          path="/pcr"
          element={<ReportsPage />}
        />

        {/* Reports Route (alias for /pcr) */}
        <Route
          path="/reports"
          element={<ReportsPage />}
        />

        {/* Logs - Placeholder */}
        <Route
          path="/logs"
          element={
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                Activity Logs
              </h1>
              <p className="text-gray-600 dark:text-gray-400">Activity logs coming soon...</p>
            </div>
          }
        />

        {/* Admin Routes */}
        <Route
          path="/admin/users"
          element={<UserManagementPage />}
        />

        <Route
          path="/admin/settings"
          element={
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                System Settings
              </h1>
              <p className="text-gray-600 dark:text-gray-400">System settings coming soon...</p>
            </div>
          }
        />

        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* 404 Page */}
        <Route
          path="*"
          element={
            <div className="text-center space-y-4">
              <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">404</h1>
              <p className="text-gray-600 dark:text-gray-400">Page not found</p>
              <button onClick={() => handleNavigate('/dashboard')} className="btn btn-primary">
                Go to Dashboard
              </button>
            </div>
          }
        />
      </Routes>
    </Layout>
  )
}

// Main App Component with Providers
const App: React.FC = () => {
  return (
    <NotificationProvider>
      <AuthProvider>
        <div className="App">
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <AppContent />
                </ProtectedRoute>
              }
            />
          </Routes>
        </div>
      </AuthProvider>
    </NotificationProvider>
  )
}

export default App
