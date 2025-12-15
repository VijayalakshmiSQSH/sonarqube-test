import React, { useState, useEffect } from 'react'
import { getApiBaseUrl } from '../../utils/constants.js'

const EmployeesTab = () => {
  const [employees, setEmployees] = useState([])
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [formData, setFormData] = useState({
    role_ids: []
  })
  const [error, setError] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)
  const [removingRole, setRemovingRole] = useState(null)
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState('')
  const [roleSearchTerm, setRoleSearchTerm] = useState('')
  const [selectedRoleFilter, setSelectedRoleFilter] = useState([])
  const [showRoleFilter, setShowRoleFilter] = useState(false)
  const [showError, setShowError] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  // Close filter dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showRoleFilter && !event.target.closest('.role-filter-container')) {
        setShowRoleFilter(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showRoleFilter])

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('adminToken')
      
      // Fetch employees from the same endpoint as workforce page
      const employeesResponse = await fetch(`${getApiBaseUrl()}/api/employees`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      // Try to fetch roles, but don't fail if it doesn't work
      let rolesResponse = null
      try {
        rolesResponse = await fetch(`${getApiBaseUrl()}/admin/roles`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      } catch (rolesErr) {
        console.warn('Roles endpoint not available:', rolesErr)
      }

      let employeesData = []
      let rolesData = []
      let hasError = false

      // Handle employees response
      if (employeesResponse.ok) {
        const data = await employeesResponse.json()
        employeesData = data.employees || []
        setEmployees(employeesData)
      } else {
        console.error('Failed to fetch employees:', employeesResponse.status)
        hasError = true
      }

      // Handle roles response (optional)
      if (rolesResponse && rolesResponse.ok) {
        rolesData = await rolesResponse.json()
        setRoles(rolesData)
      } else {
        console.warn('Roles not available, using empty array')
        setRoles([])
      }

      // Only show error if employees failed to load
      if (hasError) {
        setError('Failed to fetch employee data')
        setShowError(true)
      } else {
        setError('')
        setShowError(true)
      }

    } catch (err) {
      console.error('Network error:', err)
      setError('Network error')
      setShowError(true)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setIsUpdating(true)

    try {
      const token = localStorage.getItem('adminToken')
      const response = await fetch(`${getApiBaseUrl()}/admin/employees/${selectedEmployee.id}/roles`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        setShowModal(false)
        setSelectedEmployee(null)
        setFormData({ role_ids: [] })
        fetchData()
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to update employee roles')
        setShowError(true)
      }
    } catch (err) {
      setError('Network error')
      setShowError(true)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleEditRoles = (employee) => {
    setSelectedEmployee(employee)
    setFormData({
      role_ids: employee.role ? [employee.role.id] : []
    })
    setRoleSearchTerm('') // Reset role search when opening modal
    setShowModal(true)
  }

  // Filter employees based on search term and role filter
  const filteredEmployees = employees.filter(employee => {
    // Text search filter
    let matchesSearch = true
    if (employeeSearchTerm) {
      const searchLower = employeeSearchTerm.toLowerCase()
      matchesSearch = (
        employee.first_name?.toLowerCase().includes(searchLower) ||
        employee.last_name?.toLowerCase().includes(searchLower) ||
        employee.email?.toLowerCase().includes(searchLower) ||
        employee.employee_id?.toLowerCase().includes(searchLower)
      )
    }

    // Role filter
    let matchesRole = true
    if (selectedRoleFilter.length > 0) {
      if (selectedRoleFilter.includes('no-role')) {
        // If "no-role" is selected, show employees with no role
        matchesRole = !employee.role
      } else {
        // Filter by specific roles
        if (employee.role) {
          matchesRole = selectedRoleFilter.includes(employee.role.id)
        } else {
          matchesRole = false
        }
      }
    }

    return matchesSearch && matchesRole
  })

  // Filter roles based on search term
  const filteredRoles = roles.filter(role => {
    if (!roleSearchTerm) return true
    const searchLower = roleSearchTerm.toLowerCase()
    return (
      role.role_name?.toLowerCase().includes(searchLower) ||
      role.role_description?.toLowerCase().includes(searchLower)
    )
  })

  const handleRemoveRole = async (employeeId, roleId) => {
    if (!window.confirm('Are you sure you want to remove this role from the employee?')) {
      return
    }

    setRemovingRole(roleId)
    try {
      const token = localStorage.getItem('adminToken')
      const response = await fetch(`${getApiBaseUrl()}/admin/employees/${employeeId}/roles/${roleId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        fetchData()
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to remove role')
        setShowError(true)
      }
    } catch (err) {
      setError('Network error')
      setShowError(true)
    } finally {
      setRemovingRole(null)
    }
  }

  const handleRoleFilterToggle = (roleId) => {
    setSelectedRoleFilter(prev => 
      prev.includes(roleId) 
        ? prev.filter(id => id !== roleId)
        : [...prev, roleId]
    )
  }

  const clearRoleFilter = () => {
    setSelectedRoleFilter([])
  }

  const closeError = () => {
    setShowError(false)
  }


  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
       {/* Error Message */}
       {error && showError && (
         <div className="bg-red-50 border border-red-200 rounded-md p-4">
           <div className="flex">
             <div className="flex-shrink-0">
               <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                 <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
               </svg>
             </div>
             <div className="ml-3 flex-1">
               <h3 className="text-sm font-medium text-red-800">{error}</h3>
             </div>
             <div className="ml-auto pl-3">
               <div className="-mx-1.5 -my-1.5">
                 <button
                   onClick={closeError}
                   className="inline-flex bg-red-50 rounded-md p-1.5 text-red-500 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 focus:ring-offset-red-50"
                 >
                   <span className="sr-only">Dismiss</span>
                   <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                     <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                   </svg>
                 </button>
               </div>
             </div>
           </div>
         </div>
       )}

      {/* Employees Table */}
      <div className="card p-6 animate-slide-in">
        {/* Header inside table */}
        <div className="mb-6 pb-6 border-b border-slate-200">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Employee Role Management</h1>
              <p className="text-slate-600 mt-1">Assign and manage roles for employees</p>
            </div>
          </div>
        </div>
        
         {/* Employee Search Bar and Filter */}
         <div className="mb-6">
           <div className="flex gap-3">
             {/* Search Input */}
             <div className="flex-1 relative">
               <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                 <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                 </svg>
               </div>
               <input
                 type="text"
                 placeholder="Search employees by name, email, or ID..."
                 value={employeeSearchTerm}
                 onChange={(e) => setEmployeeSearchTerm(e.target.value)}
                 className="block w-full pl-10 pr-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
               />
             </div>
             
             {/* Filter Button */}
             <div className="relative role-filter-container">
               <button
                 onClick={() => setShowRoleFilter(!showRoleFilter)}
                 className={`inline-flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
                   selectedRoleFilter.length > 0 
                     ? 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700 text-sm' 
                     : 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700 text-sm'
                 }`}
               >
                 <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.414A1 1 0 013 6.707V4z"/>
                 </svg>
                 Filter by Role
                 {selectedRoleFilter.length > 0 && (
                   <span className="bg-white text-blue-600 text-xs px-2 py-0.5 rounded-full">
                     {selectedRoleFilter.length}
                   </span>
                 )}
               </button>
               
               {/* Role Filter Dropdown */}
               {showRoleFilter && (
                 <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-slate-200 rounded-lg shadow-lg z-10">
                   <div className="p-3 border-b border-slate-200">
                     <div className="flex items-center justify-between">
                       <h4 className="text-sm font-medium text-slate-900">Filter by Role</h4>
                       {selectedRoleFilter.length > 0 && (
                         <button
                           onClick={clearRoleFilter}
                           className="text-xs text-blue-600 hover:text-blue-800"
                         >
                           Clear All
                         </button>
                       )}
                     </div>
                   </div>
                   <div className="max-h-48 overflow-y-auto">
                     {roles.map((role) => (
                       <label key={role.id} className="flex items-center space-x-2 p-3 hover:bg-slate-50 cursor-pointer">
                         <input
                           type="checkbox"
                           checked={selectedRoleFilter.includes(role.id)}
                           onChange={() => handleRoleFilterToggle(role.id)}
                           className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                         />
                         <span className="text-sm text-slate-700">{role.role_name}</span>
                       </label>
                     ))}
                     <label className="flex items-center space-x-2 p-3 hover:bg-slate-50 cursor-pointer border-t border-slate-200">
                       <input
                         type="checkbox"
                         checked={selectedRoleFilter.includes('no-role')}
                         onChange={() => handleRoleFilterToggle('no-role')}
                         className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                       />
                       <span className="text-sm text-slate-700">No Role Assigned</span>
                     </label>
                   </div>
                 </div>
               )}
             </div>
           </div>
         </div>
        {filteredEmployees.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-slate-900">
              {employeeSearchTerm ? 'No employees found' : 'No employees'}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {employeeSearchTerm ? 'Try adjusting your search criteria.' : 'No employees found in the system.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border-2 border-slate-200 shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gradient-to-r from-slate-50 to-slate-100">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Employee ID</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Name</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Email</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Roles</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {filteredEmployees.map((employee) => (
                  <tr key={employee.id} className="hover:bg-blue-50 transition-all duration-200">
                    <td className="py-3 px-4">
                      <span className="font-mono text-sm text-slate-600">{employee.employee_id}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-blue-600 font-medium text-sm">
                            {employee.first_name?.charAt(0) || 'E'}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">
                            {employee.first_name} {employee.last_name}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-slate-600">{employee.email}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {employee.role ? (
                          <div className="flex items-center space-x-1">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              {employee.role.role_name}
                            </span>
                            <button
                              onClick={() => handleRemoveRole(employee.id, employee.role.id)}
                              disabled={removingRole === employee.role.id}
                              className="text-red-400 hover:text-red-600 transition-colors p-0.5 rounded hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Remove role"
                            >
                              {removingRole === employee.role.id ? (
                                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                              ) : (
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                                </svg>
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400">No role assigned</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleEditRoles(employee)}
                        className="text-blue-600 hover:text-blue-800 transition-colors p-1 rounded hover:bg-blue-50 inline-flex items-center gap-1"
                        title="Manage roles"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                        </svg>
                        <span className="text-sm">Manage Roles</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">
                Manage Roles for {selectedEmployee.first_name} {selectedEmployee.last_name}
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
                    Assign Role
                  </label>
                  
                  {/* Role Search Bar */}
                  <div className="mb-3">
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                        </svg>
                      </div>
                      <input
                        type="text"
                        placeholder="Search roles..."
                        value={roleSearchTerm}
                        onChange={(e) => setRoleSearchTerm(e.target.value)}
                        className="block w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto border border-slate-300 rounded-lg p-3 bg-slate-50">
                    {filteredRoles.length > 0 ? (
                      <>
                        {filteredRoles.map((role) => (
                          <label key={role.id} className="flex items-center space-x-2 p-2 hover:bg-white rounded transition-colors">
                            <input
                              type="radio"
                              name="role_selection"
                              value={role.id}
                              checked={formData.role_ids.includes(role.id)}
                              onChange={() => setFormData({ role_ids: [role.id] })}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-slate-700">
                              {role.role_name}
                            </span>
                          </label>
                        ))}
                        <label className="flex items-center space-x-2 p-2 hover:bg-white rounded transition-colors">
                          <input
                            type="radio"
                            name="role_selection"
                            value=""
                            checked={formData.role_ids.length === 0}
                            onChange={() => setFormData({ role_ids: [] })}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-slate-700">
                            No Role
                          </span>
                        </label>
                      </>
                    ) : (
                      <div className="col-span-2 text-center py-4 text-slate-500">
                        {roleSearchTerm ? 'No roles found matching your search.' : 'No roles available.'}
                      </div>
                    )}
                  </div>
                </div>
              </form>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 bg-slate-50 rounded-b-xl">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isUpdating}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
              >
                {isUpdating ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Updating...
                  </>
                ) : (
                  'Update Role'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default EmployeesTab
