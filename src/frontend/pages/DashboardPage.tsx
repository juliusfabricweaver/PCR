import { useAuth } from '@/hooks/useAuth'
import { formatDate } from '@/shared/utils'

const DashboardPage = () => {
  const { user } = useAuth()

  // Mock data for dashboard
  const stats = [
    { name: 'Total PCRs', value: '248', change: '+12%', changeType: 'positive' },
    { name: 'This Month', value: '32', change: '+8%', changeType: 'positive' },
    { name: 'Pending Review', value: '5', change: '-2%', changeType: 'negative' },
    { name: 'Completed Today', value: '8', change: '+15%', changeType: 'positive' },
  ]

  const recentPCRs = [
    {
      id: '1',
      patientName: 'John Smith',
      incidentNumber: 'INC-2024-001',
      date: '2024-01-15',
      status: 'completed',
      priority: 'medium',
    },
    {
      id: '2',
      patientName: 'Jane Doe',
      incidentNumber: 'INC-2024-002',
      date: '2024-01-15',
      status: 'pending',
      priority: 'high',
    },
    {
      id: '3',
      patientName: 'Bob Johnson',
      incidentNumber: 'INC-2024-003',
      date: '2024-01-14',
      status: 'draft',
      priority: 'low',
    },
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-success-100 text-success-800'
      case 'pending': return 'bg-warning-100 text-warning-800'
      case 'draft': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-danger-100 text-danger-800'
      case 'medium': return 'bg-warning-100 text-warning-800'
      case 'low': return 'bg-success-100 text-success-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Welcome section */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {user?.firstName}!
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Here's what's happening with your PCR reports today.
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {stats.map((stat) => (
          <div key={stat.name} className="">
            <div className="card-body">
              <div className="flex items-center">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600 truncate">
                    {stat.name}
                  </p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {stat.value}
                  </p>
                </div>
                <div
                  className={`inline-flex items-baseline px-2.5 py-0.5 rounded-full text-sm font-medium ${
                    stat.changeType === 'positive'
                      ? 'bg-success-100 text-success-800'
                      : 'bg-danger-100 text-danger-800'
                  }`}
                >
                  {stat.change}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent PCRs */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Recent PCRs</h3>
            <p className="mt-1 text-sm text-gray-600">
              Your most recent patient care reports
            </p>
          </div>
          <div className="card-body">
            <div className="space-y-4">
              {recentPCRs.map((pcr) => (
                <div
                  key={pcr.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-gray-900">
                        {pcr.patientName}
                      </h4>
                      <div className="flex items-center space-x-2">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                            pcr.status
                          )}`}
                        >
                          {pcr.status}
                        </span>
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(
                            pcr.priority
                          )}`}
                        >
                          {pcr.priority}
                        </span>
                      </div>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">
                      {pcr.incidentNumber} • {formatDate(pcr.date)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <a
                href="/pcr"
                className="text-sm font-medium text-primary-600 hover:text-primary-500"
              >
                View all PCRs →
              </a>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Quick Actions</h3>
            <p className="mt-1 text-sm text-gray-600">
              Common tasks and shortcuts
            </p>
          </div>
          <div className="card-body">
            <div className="space-y-4">
              <a
                href="/pcr/new"
                className="flex items-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors group"
              >
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center text-primary-600 group-hover:bg-primary-200">
                    📋
                  </div>
                </div>
                <div className="ml-4">
                  <h4 className="text-sm font-medium text-gray-900">Create New PCR</h4>
                  <p className="text-sm text-gray-600">Start a new patient care report</p>
                </div>
              </a>


              <a
                href="/reports"
                className="flex items-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors group"
              >
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center text-primary-600 group-hover:bg-primary-200">
                    📈
                  </div>
                </div>
                <div className="ml-4">
                  <h4 className="text-sm font-medium text-gray-900">Generate Reports</h4>
                  <p className="text-sm text-gray-600">Create analytics and summaries</p>
                </div>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardPage
