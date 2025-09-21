import { useState, useEffect } from 'react'
import { Plus, UserCog, Shield, User as UserIcon, Edit, Trash2 } from 'lucide-react'
import { Button, Loading, Alert, Modal } from '@/components/ui'
import { Input, Select } from '@/components/forms'
import { useAuth } from '@/context/AuthContext'
import type { User } from '@/types'

interface CreateUserForm {
  username: string
  password: string
  firstName: string
  lastName: string
  role: 'user' | 'admin'
}

interface EditUserForm {
  firstName: string
  lastName: string
  isActive: boolean
}

const UserManagementPage = () => {
  const { token, isAuthenticated, user: currentUser } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createForm, setCreateForm] = useState<CreateUserForm>({
    username: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'user'
  })
  const [formErrors, setFormErrors] = useState<Partial<CreateUserForm>>({})

  // Edit user state
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [updating, setUpdating] = useState(false)
  const [editForm, setEditForm] = useState<EditUserForm>({
    firstName: '',
    lastName: '',
    isActive: true
  })
  const [editFormErrors, setEditFormErrors] = useState<Partial<EditUserForm>>({})

  useEffect(() => {
    if (currentUser?.role !== 'admin') {
      setError('Access denied. Admin privileges required.')
      setLoading(false)
      return
    }
    fetchUsers()
  }, [currentUser])

  const fetchUsers = async () => {
    try {
      setLoading(true)

      if (!isAuthenticated || !token) {
        setError('Please log in to view users')
        setLoading(false)
        return
      }

      const response = await fetch('/api/users', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch users')
      }

      const data = await response.json()
      setUsers(data.data || [])
    } catch (err) {
      setError('Failed to load users')
      console.error('Error fetching users:', err)
    } finally {
      setLoading(false)
    }
  }

  const validateForm = (): boolean => {
    const errors: Partial<CreateUserForm> = {}

    if (!createForm.username.trim()) {
      errors.username = 'Username is required'
    } else if (createForm.username.length < 3) {
      errors.username = 'Username must be at least 3 characters'
    }

    if (!createForm.password.trim()) {
      errors.password = 'Password is required'
    } else if (createForm.password.length < 8) {
      errors.password = 'Password must be at least 8 characters'
    }

    if (!createForm.firstName.trim()) {
      errors.firstName = 'First name is required'
    }

    if (!createForm.lastName.trim()) {
      errors.lastName = 'Last name is required'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleCreateUser = async () => {
    if (!validateForm()) return

    try {
      setCreating(true)

      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(createForm),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create user')
      }

      await fetchUsers()
      setShowCreateModal(false)
      setCreateForm({
        username: '',
        password: '',
        firstName: '',
        lastName: '',
        role: 'user'
      })
      setFormErrors({})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user')
      console.error('Error creating user:', err)
    } finally {
      setCreating(false)
    }
  }

  const handleToggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isActive: !currentStatus
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update user status')
      }

      await fetchUsers()
    } catch (err) {
      setError('Failed to update user status')
      console.error('Error updating user status:', err)
    }
  }

  const handleEditUser = (user: User) => {
    setEditingUser(user)
    setEditForm({
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role as 'user' | 'admin',
      isActive: user.isActive
    })
    setEditFormErrors({})
    setShowEditModal(true)
  }

  const handleDeleteUser = async (userId: string) => {
    if (userId === currentUser?.id) {
      setError("You can't delete your own account while logged in.")
      return
    }

    const sure = window.confirm('Delete this user? This cannot be undone.')
    if (!sure) return

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(body?.message || 'Failed to delete user')
      }

      setShowEditModal(false)
      setEditingUser(null)
      await fetchUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user')
      console.error('Error deleting user:', err)
    }
  }

  const validateEditForm = (): boolean => {
    const errors: Partial<EditUserForm> = {}

    if (!editForm.firstName.trim()) {
      errors.firstName = 'First name is required'
    }

    if (!editForm.lastName.trim()) {
      errors.lastName = 'Last name is required'
    }

    setEditFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleUpdateUser = async () => {
    if (!validateEditForm() || !editingUser) return

    try {
      setUpdating(true)

      const response = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editForm),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update user')
      }

      await fetchUsers()
      setShowEditModal(false)
      setEditingUser(null)
      setEditForm({
        firstName: '',
        lastName: '',
        role: 'user',
        isActive: true
      })
      setEditFormErrors({})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user')
      console.error('Error updating user:', err)
    } finally {
      setUpdating(false)
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

  const getRoleIcon = (role: string) => {
    return role === 'admin' ? (
      <Shield className="w-4 h-4 text-blue-600" />
    ) : (
      <UserIcon className="w-4 h-4 text-gray-600" />
    )
  }

  if (currentUser?.role !== 'admin') {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center py-16">
          <Shield className="mx-auto h-12 w-12 text-gray-400" />
          <h2 className="mt-4 text-lg font-medium text-gray-900">Access Denied</h2>
          <p className="mt-1 text-sm text-gray-500">
            You need admin privileges to access user management.
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage system users and their permissions
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
            <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
            <p className="mt-1 text-sm text-gray-600">
              Manage system users and their permissions
            </p>
          </div>
          <Button
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setShowCreateModal(true)}
          >
            Create User
          </Button>
        </div>
      </div>

      {error && (
        <Alert type="error" message={error} onClose={() => setError('')} />
      )}

      <div className="card">
        <div className="card-body">
          {users.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-500">
                <UserCog className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No users found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Get started by creating your first user.
                </p>
              </div>
            </div>
          ) : (
            <>
              {users.length > 0 && (
                <div className="mb-4 text-sm text-gray-500 flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Scroll horizontally to view all columns
                </div>
              )}
              <div className="overflow-x-auto shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[160px]">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[160px]">
                      Last Login
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[180px]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                              <UserIcon className="h-5 w-5 text-gray-600" />
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {user.firstName} {user.lastName}
                            </div>
                            <div className="text-sm text-gray-500">
                              @{user.username}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {getRoleIcon(user.role)}
                          <span className={`ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            user.role === 'admin'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {user.role}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            user.isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(user.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {user.lastLogin ? formatDate(user.lastLogin) : 'Never'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditUser(user)}
                            leftIcon={<Edit className="w-4 h-4" />}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleUserStatus(user.id, user.isActive)}
                            disabled={user.id === currentUser?.id}
                            className="text-gray-600 hover:text-gray-900"
                          >
                            {user.isActive ? 'Deactivate' : 'Activate'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Create User Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false)
          setFormErrors({})
        }}
        title="Create New User"
        size="md"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="First Name"
              value={createForm.firstName}
              onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })}
              error={formErrors.firstName}
              required
            />
            <Input
              label="Last Name"
              value={createForm.lastName}
              onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })}
              error={formErrors.lastName}
              required
            />
          </div>

          <Input
            label="Username"
            value={createForm.username}
            onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
            error={formErrors.username}
            required
            helpText="Must be at least 3 characters long"
          />

          <Input
            label="Password"
            type="password"
            value={createForm.password}
            onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
            error={formErrors.password}
            required
            helpText="Must be at least 8 characters long"
          />

          <Select
            label="Role"
            value={createForm.role}
            onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as 'user' | 'admin' })}
            options={[
              { value: 'user', label: 'User' },
              { value: 'admin', label: 'Administrator' },
            ]}
            required
          />

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button
              variant="secondary"
              onClick={() => {
                setShowCreateModal(false)
                setFormErrors({})
              }}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateUser}
              loading={creating}
              disabled={creating}
            >
              Create User
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false)
          setEditingUser(null)
          setEditFormErrors({})
        }}
        title={`Edit User: ${editingUser?.username}`}
        size="md"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="First Name"
              value={editForm.firstName}
              onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
              error={editFormErrors.firstName}
              required
            />
            <Input
              label="Last Name"
              value={editForm.lastName}
              onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
              error={editFormErrors.lastName}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {editingUser?.role !== 'admin' ? (
              <Select
                label="Status"
                value={editForm.isActive ? 'active' : 'inactive'}
                onChange={(e) => setEditForm({ ...editForm, isActive: e.target.value === 'active' })}
                options={[
                  { value: 'active', label: 'Active' },
                  { value: 'inactive', label: 'Inactive' },
                ]}
                required
              />
            ) : (
              // Optional read-only hint for admins:
              <div className="text-sm text-gray-500">
                Status: <span className="font-medium">Active</span> (admins cannot be deactivated)
              </div>
            )}
          </div>

          <div className="flex justify-between items-center pt-4 border-t">
            {/* Left: Delete */}
            <Button
              variant="ghost"
              leftIcon={<Trash2 className="w-4 h-4" />}
              className="bg-red-600 text-white border border-red-600 hover:bg-red-700 hover:border-red-700 focus:outline-none focus:ring-2 focus:ring-red-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => editingUser && handleDeleteUser(editingUser.id)}
              disabled={updating || editingUser?.id === currentUser?.id}
            >
              Delete User
            </Button>

            {/* Right: Cancel / Update */}
            <div className="space-x-3">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowEditModal(false)
                  setEditingUser(null)
                  setEditFormErrors({})
                }}
                disabled={updating}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdateUser}
                loading={updating}
                disabled={updating}
              >
                Update User
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default UserManagementPage