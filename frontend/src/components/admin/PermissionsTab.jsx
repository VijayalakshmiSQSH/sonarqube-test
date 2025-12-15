import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { getApiBaseUrl } from '../../utils/constants.js'

const PermissionsTab = () => {
  const [permissions, setPermissions] = useState([])
  const [filteredPermissions, setFilteredPermissions] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingPermission, setEditingPermission] = useState(null)
  const [formData, setFormData] = useState({
    permission_name: '',
    permission_description: ''
  })
  const [error, setError] = useState('')
  const [showErrorToast, setShowErrorToast] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchPermissions()
  }, [])

  // Filter permissions based on search term
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredPermissions(permissions)
    } else {
      const filtered = permissions.filter(permission =>
        permission.permission_name.toLowerCase().includes(searchTerm.toLowerCase())
      )
      setFilteredPermissions(filtered)
    }
  }, [permissions, searchTerm])

  const fetchPermissions = async () => {
    try {
      const token = localStorage.getItem('adminToken')
      const response = await fetch(`${getApiBaseUrl()}/admin/permissions`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setPermissions(data)
      } else {
        setError('Failed to fetch permissions')
      }
    } catch (err) {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const token = localStorage.getItem('adminToken')
      const url = editingPermission 
        ? `${getApiBaseUrl()}/admin/permissions/${editingPermission.id}`
        : `${getApiBaseUrl()}/admin/permissions`
      
      const method = editingPermission ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        setShowModal(false)
        setEditingPermission(null)
        setFormData({ permission_name: '', permission_description: '' })
        fetchPermissions()
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to save permission')
        setShowErrorToast(true)
      }
    } catch (err) {
      setError('Network error')
      setShowErrorToast(true)
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = (permission) => {
    setEditingPermission(permission)
    setFormData({
      permission_name: permission.permission_name,
      permission_description: permission.permission_description || ''
    })
    setSubmitting(false)
    setShowModal(true)
  }

  const handleDelete = async (permissionId) => {
    if (!window.confirm('Are you sure you want to delete this permission?')) {
      return
    }

    try {
      const token = localStorage.getItem('adminToken')
      const response = await fetch(`${getApiBaseUrl()}/admin/permissions/${permissionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        fetchPermissions()
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to delete permission')
      }
    } catch (err) {
      setError('Network error')
    }
  }

  const openCreateModal = () => {
    setEditingPermission(null)
    setFormData({ permission_name: '', permission_description: '' })
    setSubmitting(false)
    setError('')
    setShowErrorToast(false)
    setShowModal(true)
  }

  const closeErrorToast = () => {
    setShowErrorToast(false)
    setError('')
  }

  // Auto-dismiss error toast after 5 seconds
  useEffect(() => {
    if (showErrorToast) {
      const timer = setTimeout(() => {
        closeErrorToast()
      }, 8000)
      return () => clearTimeout(timer)
    }
  }, [showErrorToast])

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Permissions Table */}
      <div className="card p-6 animate-slide-in">
        {/* Header inside table */}
        <div className="mb-6 pb-6 border-b border-slate-200">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Permissions Management</h1>
              <p className="text-slate-600 mt-1">Manage system permissions for role-based access control</p>
            </div>
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
              </svg>
              Add Permission
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search permissions by name (e.g., create, edit, delete...)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            )}
          </div>
        </div>
        {permissions.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-slate-900">No permissions</h3>
            <p className="mt-1 text-sm text-slate-500">Get started by creating a new permission.</p>
          </div>
        ) : filteredPermissions.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <h3 className="mt-2 text-sm font-medium text-slate-900">No permissions found</h3>
            <p className="mt-1 text-sm text-slate-500">Try adjusting your search terms.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border-2 border-slate-200 shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gradient-to-r from-slate-50 to-slate-100">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Permission Name</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Description</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Created</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {filteredPermissions.map((permission) => (
                  <tr key={permission.id} className="hover:bg-blue-50 transition-all duration-200">
                    <td className="py-3 px-4">
                      <span className="font-medium text-slate-900">{permission.permission_name}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {permission.permission_description || 'No description'}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {new Date(permission.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(permission)}
                          className="text-blue-600 hover:text-blue-800 transition-colors p-1 rounded hover:bg-blue-50"
                          title="Edit permission"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(permission.id)}
                          className="text-red-600 hover:text-red-800 transition-colors p-1 rounded hover:bg-red-50"
                          title="Delete permission"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                          </svg>
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

      {/* Error Toast */}
      {showErrorToast && createPortal(
        <div className="fixed inset-0 z-[60] flex items-start justify-center pt-20 pointer-events-none">
          <div className="bg-red-50 border border-red-200 rounded-lg shadow-lg p-4 max-w-md w-full mx-4 pointer-events-auto">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-sm font-medium text-red-800">{error}</h3>
              </div>
              <div className="ml-4 flex-shrink-0">
                <button
                  onClick={closeErrorToast}
                  className="text-red-400 hover:text-red-600 transition-colors"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal */}
      {showModal && createPortal(
        <div className="fixed top-0 left-0 right-0 bottom-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">
                {editingPermission ? 'Edit Permission' : 'Create Permission'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Permission Name
                  </label>
                  <input
                    type="text"
                    value={formData.permission_name}
                    onChange={(e) => setFormData({ ...formData, permission_name: e.target.value })}
                    disabled={submitting}
                    className={`w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      submitting ? 'bg-gray-100 cursor-not-allowed' : ''
                    }`}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.permission_description}
                    onChange={(e) => setFormData({ ...formData, permission_description: e.target.value })}
                    rows={3}
                    disabled={submitting}
                    className={`w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      submitting ? 'bg-gray-100 cursor-not-allowed' : ''
                    }`}
                  />
                </div>
              </form>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 bg-slate-50 rounded-b-xl">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                disabled={submitting}
                className={`px-4 py-2 font-medium transition-colors ${
                  submitting 
                    ? 'text-slate-400 cursor-not-allowed' 
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors flex items-center gap-2 ${
                  submitting 
                    ? 'bg-blue-400 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {submitting && (
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {submitting ? 'Creating...' : (editingPermission ? 'Update' : 'Create')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export default PermissionsTab
