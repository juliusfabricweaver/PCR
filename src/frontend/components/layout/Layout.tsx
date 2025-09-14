import React, { useState } from 'react'
import Header from './Header'
import Sidebar from './Sidebar'
import Footer from './Footer'
import { cn } from '@/utils'

interface LayoutProps {
  children: React.ReactNode
  currentPath?: string
  user?: {
    name: string
    role: string
    avatar?: string
  }
  onLogout?: () => void
  onNavigate?: (href: string) => void
  darkMode?: boolean
  onToggleTheme?: () => void
}

const Layout: React.FC<LayoutProps> = ({
  children,
  currentPath = '/',
  user,
  onLogout,
  onNavigate,
  darkMode = false,
  onToggleTheme,
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen)
  }

  const closeSidebar = () => {
    setSidebarOpen(false)
  }

  return (
    <div className={cn('min-h-screen bg-gray-50 dark:bg-gray-900', darkMode && 'dark')}>
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          isOpen={sidebarOpen}
          currentPath={currentPath}
          onNavigate={onNavigate}
          onClose={closeSidebar}
          user={user}
        />

        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <Header
            user={user}
            onLogout={onLogout}
            onToggleTheme={onToggleTheme}
            onToggleSidebar={toggleSidebar}
            darkMode={darkMode}
            sidebarOpen={sidebarOpen}
          />

          {/* Main content */}
          <main className="flex-1 overflow-y-auto p-6">
            <div className="max-w-7xl mx-auto">
              {children}
            </div>
          </main>

          {/* Footer */}
          <Footer />
        </div>
      </div>
    </div>
  )
}

export default Layout