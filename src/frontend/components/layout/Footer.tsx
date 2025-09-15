import React from 'react'
import { cn } from '@/utils'

interface FooterProps {
  className?: string
}

const Footer: React.FC<FooterProps> = ({ className }) => {
  const currentYear = new Date().getFullYear()

  return (
    <footer className={cn(
      'bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4',
      className
    )}>
      <div className="flex flex-col sm:flex-row justify-between items-center space-y-2 sm:space-y-0">
        <div className="flex flex-col sm:flex-row items-center space-y-1 sm:space-y-0 sm:space-x-6">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            © {currentYear} PCR System. All rights reserved.
          </p>
          <div className="flex items-center space-x-4 text-xs text-gray-400 dark:text-gray-500">
            <button 
              type="button"
              className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              Privacy Policy
            </button>
            <span>•</span>
            <button 
              type="button"
              className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              Terms of Service
            </button>
            <span>•</span>
            <button 
              type="button"
              className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              Support
            </button>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
