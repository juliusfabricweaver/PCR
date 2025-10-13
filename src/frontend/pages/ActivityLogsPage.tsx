import { useState, useEffect } from 'react'
import { History, Filter, Calendar, User, Activity, RefreshCw, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { Button, Loading, Alert } from '@/components/ui'
import { Input, Select } from '@/components/forms'
import { useAuth } from '@/context/AuthContext'
import { apiRequest } from '@/utils/api'
import type { ActivityLog, PaginatedResponse } from '@/types'

interface LogFilters {
  action: string
  user_id: string
  dateFrom: string
  dateTo: string
  page: number
  limit: number
}

const ActivityLogsPage = () => {
  const { token, isAuthenticated, user: currentUser } = useAuth()
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState<LogFilters>({
    action: '',
    user_id: '',
    dateFrom: '',
    dateTo: '',
    page: 1,
    limit: 50
  })
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (currentUser?.role !== 'admin') {
      setError('Access denied. Admin privileges required.')
      setLoading(false)
      return
    }
    fetchLogs()
  }, [currentUser, filters])

  const fetchLogs = async () => {
    try {
      if (!refreshing) setLoading(true)

      if (!isAuthenticated || !token) {
        setError('Please log in to view activity logs')
        setLoading(false)
        return
      }

      const queryParams = new URLSearchParams()
      queryParams.append('page', filters.page.toString())
      queryParams.append('limit', filters.limit.toString())

      if (filters.action) queryParams.append('action', filters.action)
      if (filters.user_id) queryParams.append('user_id', filters.user_id)
      if (filters.dateFrom) queryParams.append('dateFrom', filters.dateFrom)
      if (filters.dateTo) queryParams.append('dateTo', filters.dateTo)

      const data: PaginatedResponse<ActivityLog> = await apiRequest(`/logs?${queryParams.toString()}`)
      setLogs(data.items || [])
      setTotalPages(data.totalPages || 1)
      setTotalCount(data.totalCount || 0)
    } catch (err) {
      setError('Failed to load activity logs')
      console.error('Error fetching logs:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = () => {
    setRefreshing(true)
    fetchLogs()
  }

  const handlePageChange = (newPage: number) => {
    setFilters(prev => ({ ...prev, page: newPage }))
  }

  const handleFilterChange = (key: keyof LogFilters, value: string | number) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }))
  }

  const clearFilters = () => {
    setFilters({
      action: '',
      user_id: '',
      dateFrom: '',
      dateTo: '',
      page: 1,
      limit: 50
    })
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      timeZone: 'Etc/GMT+8',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const getActionBadgeColor = (action: string) => {
    const colors: Record<string, string> = {
      login: 'bg-green-100 text-green-800',
      logout: 'bg-gray-100 text-gray-800',
      create_user: 'bg-blue-100 text-blue-800',
      update_user: 'bg-yellow-100 text-yellow-800',
      create_pcr: 'bg-purple-100 text-purple-800',
      update_pcr: 'bg-orange-100 text-orange-800',
      submit_pcr: 'bg-green-100 text-green-800',
      delete_pcr: 'bg-red-100 text-red-800',
    }
    return colors[action] || 'bg-gray-100 text-gray-800'
  }

  const formatUserName = (log: ActivityLog) => {
    if (log.first_name && log.last_name) {
      return `${log.first_name} ${log.last_name}`
    }
    if (log.username) {
      return `@${log.username}`
    }
    return 'Unknown User'
  }

  const parseDetails = (details: string | undefined) => {
    if (!details) return null
    try {
      return JSON.parse(details)
    } catch {
      return null
    }
  }

  if (currentUser?.role !== 'admin') {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center py-16">
          <History className="mx-auto h-12 w-12 text-gray-400" />
          <h2 className="mt-4 text-lg font-medium text-gray-900">Access Denied</h2>
          <p className="mt-1 text-sm text-gray-500">
            You need admin privileges to access activity logs.
          </p>
        </div>
      </div>
    )
  }

  if (loading && !refreshing) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Activity Logs</h1>
          <p className="mt-1 text-sm text-gray-600">
            Monitor system activity and user actions
          </p>
        </div>
        <Loading />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Activity Logs</h1>
            <p className="mt-1 text-sm text-gray-600">
              Monitor system activity and user actions across the platform
            </p>
            {totalCount > 0 && (
              <p className="mt-2 text-sm text-gray-500">
                Showing {logs.length} of {totalCount} activities
              </p>
            )}
          </div>
          <Button
            leftIcon={<RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />}
            onClick={handleRefresh}
            disabled={refreshing}
            variant="secondary"
          >
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Alert type="error" message={error} onClose={() => setError('')} />
      )}

      {/* Filters */}
      <div className="card mb-6">
        <div className="card-body">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Filters</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Select
              label="Action"
              value={filters.action}
              onChange={(e) => handleFilterChange('action', e.target.value)}
              options={[
                { value: '', label: 'All Actions' },
                { value: 'login', label: 'Login' },
                { value: 'logout', label: 'Logout' },
                { value: 'create_user', label: 'Create User' },
                { value: 'update_user', label: 'Update User' },
                { value: 'delete_user', label: 'Delete User' },
                { value: 'create_pcr', label: 'Create PCR' },
                { value: 'update_pcr', label: 'Update PCR' },
                { value: 'submit_pcr', label: 'Submit PCR' },
                { value: 'delete_pcr', label: 'Delete PCR' },
              ]}
            />

            <Input
              label="User ID"
              placeholder="Filter by user ID"
              value={filters.user_id}
              onChange={(e) => handleFilterChange('user_id', e.target.value)}
            />

            <Input
              label="Date From"
              type="date"
              value={filters.dateFrom}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
            />

            <Input
              label="Date To"
              type="date"
              value={filters.dateTo}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
            />

            <div className="flex flex-col justify-end">
              <Button
                variant="secondary"
                onClick={clearFilters}
                className="w-full"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Activity Logs Table */}
      <div className="card">
        <div className="card-body">
          {logs.length === 0 ? (
            <div className="text-center py-8">
              <Activity className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No activity logs found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {Object.values(filters).some(v => v) ?
                  'Try adjusting your filters to see more results.' :
                  'System activity will appear here as users interact with the platform.'
                }
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[180px]">
                        Timestamp
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">
                        User
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[140px]">
                        Action
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                        Resource
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[150px]">
                        IP Address
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">
                        Details
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {logs.map((log) => {
                      const details = parseDetails(log.details)
                      return (
                        <tr key={log.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatDate(log.created_at)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-8 w-8">
                                <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center">
                                  <User className="h-4 w-4 text-gray-600" />
                                </div>
                              </div>
                              <div className="ml-3">
                                <div className="text-sm font-medium text-gray-900">
                                  {formatUserName(log)}
                                </div>
                                <div className="text-xs text-gray-500">
                                  ID: {log.user_id}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getActionBadgeColor(log.action)}`}>
                              {log.action.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {log.resource_type ? (
                              <div>
                                <div className="font-medium">{log.resource_type}</div>
                                {log.resource_id && (
                                  <div className="text-xs text-gray-500 truncate max-w-[100px]">
                                    {log.resource_id}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {log.ip_address || <span className="text-gray-400">-</span>}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {details ? (
                              <div className="max-w-[200px]">
                                <div className="text-xs text-gray-500">
                                  {details.method} {details.url}
                                </div>
                                <div className="text-xs text-gray-500">
                                  Status: {details.statusCode}
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 mt-4">
                  <div className="flex flex-1 justify-between sm:hidden">
                    <Button
                      onClick={() => handlePageChange(filters.page - 1)}
                      disabled={filters.page <= 1}
                      variant="secondary"
                    >
                      Previous
                    </Button>
                    <Button
                      onClick={() => handlePageChange(filters.page + 1)}
                      disabled={filters.page >= totalPages}
                      variant="secondary"
                    >
                      Next
                    </Button>
                  </div>
                  <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700">
                        Showing page <span className="font-medium">{filters.page}</span> of{' '}
                        <span className="font-medium">{totalPages}</span>
                      </p>
                    </div>
                    <div>
                      <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm">
                        <Button
                          onClick={() => handlePageChange(filters.page - 1)}
                          disabled={filters.page <= 1}
                          variant="secondary"
                          leftIcon={<ChevronLeft className="w-4 h-4" />}
                        >
                          Previous
                        </Button>
                        <Button
                          onClick={() => handlePageChange(filters.page + 1)}
                          disabled={filters.page >= totalPages}
                          variant="secondary"
                          rightIcon={<ChevronRight className="w-4 h-4" />}
                        >
                          Next
                        </Button>
                      </nav>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default ActivityLogsPage