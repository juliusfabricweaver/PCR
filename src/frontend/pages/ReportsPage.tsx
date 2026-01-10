import { useState, useEffect } from 'react'
import { Loading, Alert } from '@/components/ui'
import { pdfService } from '@/services/pdf.service'
import { useAuth } from '@/context/AuthContext'
import { apiRequest } from '@/utils/api'

interface PCRReport {
  id: string
  status: string
  created_at: string
  updated_at: string
  report_number?: string | null
  form_data?: any
}

const ReportsPage = () => {
  const { token, isAuthenticated } = useAuth()
  const [reports, setReports] = useState<PCRReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchReports()
  }, [])

  const fetchReports = async () => {
    try {
      setLoading(true)

      if (!isAuthenticated || !token) {
        setError('Please log in to view reports')
        setLoading(false)
        return
      }

      const data = await apiRequest('/pcr')
      setReports(data.data || [])
    } catch (err) {
      setError('Failed to load PCR reports')
      console.error('Error fetching reports:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleViewReport = async (reportId: string) => {
    try {
      if (!token) {
        setError('Authentication required')
        return
      }

      const data = await apiRequest(`/pcr/${reportId}`)
      const reportData = data.data

      // Show PDF preview using the existing PDF service
      await pdfService.showDownloadPreview(reportData.form_data)
    } catch (err) {
      setError('Failed to load report details')
      console.error('Error loading report:', err)
    }
  }

  const handleEditDraft = (reportId: string) => {
    // Navigate to PCR form with draft ID as URL parameter
    const params = new URLSearchParams({ draftId: reportId })
    window.location.href = `/pcr/new?${params.toString()}`
  }

  const handleDeleteReport = async (reportId: string, status: string) => {
    const what = status === 'draft' ? 'this draft' : 'this submission'
    const ok = window.confirm(`Delete ${what}? This cannot be undone.`)
    if (!ok) return

    try {
      if (!token) {
        setError('Authentication required')
        return
      }

      await apiRequest(`/pcr/${reportId}`, { method: 'DELETE' })

      // Optimistic UI: remove from state
      setReports(prev => prev.filter(r => r.id !== reportId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete report')
      console.error('Error deleting report:', err)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      timeZone: 'Etc/GMT+8',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatFallbackId = (dateString: string) => {
    const date = new Date(new Date(dateString).toLocaleString('en-US', { timeZone: 'Etc/GMT+8' }))
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}${month}${day}_${hours}${minutes}`
  }

  const displayReportId = (report: PCRReport) => {
    const rn = (report.report_number ?? '').trim()
    return rn ? rn : formatFallbackId(report.created_at)
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">PCR Reports</h1>
          <p className="mt-1 text-sm text-gray-600">
            View completed PCR submissions
          </p>
        </div>
        <Loading />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">PCR Reports</h1>
        <p className="mt-1 text-sm text-gray-600">
          View PCR submissions and drafts
        </p>
      </div>

      {error && (
        <Alert type="error" message={error} onClose={() => setError('')} />
      )}

      <div className="card">
        <div className="card-body">
          {reports.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-500">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    vectorEffect="non-scaling-stroke"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No PCR reports</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Create or submit a PCR form to see reports and drafts here.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Report ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Updated
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reports.map((report) => (
                    <tr
                      key={report.id}
                      className={`hover:bg-gray-50 ${report.status === 'submitted' ? 'cursor-pointer' : ''}`}
                      onClick={report.status === 'submitted' ? () => handleViewReport(report.id) : undefined}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {displayReportId(report)}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            report.status === 'submitted'
                              ? 'bg-green-100 text-green-800'
                              : report.status === 'draft'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {report.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(report.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(report.updated_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          {report.status === 'draft' ? (
                            <>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleEditDraft(report.id) }}
                                className="text-blue-600 hover:text-blue-900 font-medium"
                              >
                                Edit Draft
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleViewReport(report.id) }}
                                className="text-green-600 hover:text-green-900 font-medium"
                              >
                                Preview
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleViewReport(report.id) }}
                              className="text-blue-600 hover:text-blue-900 font-medium"
                            >
                              View PDF
                            </button>
                          )}

                          {/* Delete (works for both draft and submitted) */}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteReport(report.id, report.status) }}
                            className="text-red-600 hover:text-red-800 font-medium"

                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ReportsPage