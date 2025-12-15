import React, { useState, useMemo } from 'react'
import { usePermissions } from '../../context/PermissionContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { useEmployees } from '../../context/EmployeeContext.jsx'
import KRAForm from '../../components/KRAForm.jsx'
import KRAImport from '../../components/KRAImport.jsx'
import MultiSelect from '../../components/MultiSelect.jsx'

const KRAManagementTab = ({ kras, loading, onAdd, onUpdate, onDelete, onRefresh }) => {
  const { hasPermission } = usePermissions()
  const { user } = useAuth()
  const { getAllEmployees } = useEmployees()
  const allEmployees = getAllEmployees()
  
  const [searchTerm, setSearchTerm] = useState('')
  const [filters, setFilters] = useState({
    department: [],
    role: [],
    impact: []
  })
  const [expandedKRA, setExpandedKRA] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingKRA, setEditingKRA] = useState(null)
  const [showFilters, setShowFilters] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [showImport, setShowImport] = useState(false)

  // Get all departments from employees (dynamic filter options)
  const getFilteredDepartments = useMemo(() => {
    return [...new Set(allEmployees.map(emp => emp.department).filter(Boolean))].sort()
  }, [allEmployees])
  
  // Get designations/roles based on selected departments (cascading filter)
  const getFilteredRoles = useMemo(() => {
    if (filters.department.length === 0) {
      // If no department selected, show all designations from employees
      return [...new Set(allEmployees
        .map(emp => emp.designation || emp.title)
        .filter(Boolean)
      )].sort()
    } else {
      // Only show designations that belong to selected departments
      return [...new Set(allEmployees
        .filter(emp => 
          emp.department && 
          filters.department.includes(emp.department) &&
          (emp.designation || emp.title)
        )
        .map(emp => emp.designation || emp.title)
        .filter(Boolean)
      )].sort()
    }
  }, [allEmployees, filters.department])
  
  // Impact options
  const impacts = ['Low', 'Medium', 'High']

  // Count active filters
  const activeFiltersCount = Object.entries(filters).filter(([key, value]) => {
    return Array.isArray(value) ? value.length > 0 : value !== ''
  }).length

  // Filter KRAs based on search and filters (optimized with useMemo)
  const filteredKRAs = useMemo(() => {
    return kras.filter(kra => {
      const matchesSearch = !searchTerm || 
        kra.kra_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        kra.description?.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesDepartment = filters.department.length === 0 || filters.department.includes(kra.department)
      const matchesRole = filters.role.length === 0 || filters.role.includes(kra.role)
      const matchesImpact = filters.impact.length === 0 || filters.impact.includes(kra.impact)
      
      return matchesSearch && matchesDepartment && matchesRole && matchesImpact
    })
  }, [kras, searchTerm, filters])

  const clearFilters = () => {
    setSearchTerm('')
    setFilters({
      department: [],
      role: [],
      impact: []
    })
  }

  const toggleExpand = (kraId) => {
    setExpandedKRA(expandedKRA === kraId ? null : kraId)
  }

  const handleImpactChange = async (kra, newImpact) => {
    if (hasPermission('kra-edit')) {
      await onUpdate(kra.id, { impact: newImpact })
    }
  }

  const handleEdit = (kra) => {
    setEditingKRA(kra)
    setShowForm(true)
  }

  const handleAdd = () => {
    setEditingKRA(null)
    setShowForm(true)
  }

  const handleFormSubmit = async (kraData) => {
    setFormLoading(true)
    try {
      if (editingKRA) {
        const result = await onUpdate(editingKRA.id, kraData)
        if (result.success) {
          setShowForm(false)
          setEditingKRA(null)
        }
        return result
      } else {
        const result = await onAdd(kraData)
        if (result.success) {
          setShowForm(false)
        }
        return result
      }
    } finally {
      setFormLoading(false)
    }
  }

  const handleFormClose = () => {
    setShowForm(false)
    setEditingKRA(null)
  }

  const handleImport = () => {
    setShowImport(true)
  }

  const handleImportClose = () => {
    setShowImport(false)
  }

  const handleImportComplete = (result) => {
    // Refresh the KRAs list after successful import
    console.log('Import completed:', result)
    if (onRefresh) {
      console.log('Calling onRefresh to refresh KRAs data...')
      onRefresh()
    } else {
      console.log('onRefresh function not available')
    }
  }

  const handleDelete = async (kraId) => {
    if (window.confirm('Are you sure you want to delete this KRA?')) {
      await onDelete(kraId)
    }
  }

  const handleExport = () => {
    if (!hasPermission('kra-export')) {
      alert('You do not have permission to export KRA data.')
      return
    }

    if (filteredKRAs.length === 0) {
      alert('No KRAs to export.')
      return
    }

    // Prepare export data in the same format as import template
    const exportData = filteredKRAs.map(kra => ({
      'KRA Title': kra.kra_title || '',
      'Department': kra.department || '',
      'Role': kra.role || '',
      'Year': kra.year || '',
      'Impact': kra.impact || 'Low',
      'Description': kra.description || '',
      'Expectations': kra.expectations && kra.expectations.length > 0 
        ? kra.expectations.join(';') 
        : ''
    }))

    // Convert to CSV format (same as import template)
    const headers = ['KRA Title', 'Department', 'Role', 'Year', 'Impact', 'Description', 'Expectations']
    const csvContent = [
      headers.join(','),
      ...exportData.map(row => 
        headers.map(header => {
          const value = row[header] || ''
          // Escape quotes and wrap in quotes if contains comma, quote, or newline
          const escaped = value.toString().replace(/"/g, '""')
          return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped
        }).join(',')
      )
    ].join('\n')

    // Add BOM for proper UTF-8 encoding (same as import template)
    const BOM = '\uFEFF'
    const csvWithBOM = BOM + csvContent

    // Create and download file
    const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `KRA_Export_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    // Clean up the URL object
    setTimeout(() => URL.revokeObjectURL(url), 100)
  }

  // Function to get impact level styling based on permission and impact value
  const getImpactStyling = (hasEditPermission, impact) => {
    if (!hasEditPermission) {
      return 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
    }
    
    switch (impact) {
      case 'High':
        return 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200'
      case 'Medium':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-200'
      default:
        return 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200'
    }
  }


  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200">
      {/* Search and Filters Bar */}
      <div className="p-2 border-b border-slate-200">
        <div className="flex items-center justify-between">
          {/* Search Bar */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
            </div>
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search KRAs..." 
              className="input-field pl-10 text-sm py-2 shadow-sm w-96"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            )}
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-2">
            {/* Filters Button */}
                   <button
                     onClick={() => setShowFilters(!showFilters)}
                     className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 border ${
                       showFilters || activeFiltersCount > 0
                         ? 'bg-green-800 text-white border-green-800'
                         : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                     }`}
                   >
                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/>
                     </svg>
                     Filters
                     {activeFiltersCount > 0 && (
                       <span className="bg-white text-green-700 text-xs font-bold px-1.5 py-0.5 rounded-full">
                         {activeFiltersCount}
                       </span>
                     )}
                     <svg className={`w-4 h-4 transition-transform duration-200 ${showFilters ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
                     </svg>
                   </button>
            
           
              <button 
                onClick={handleImport}
                className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                Import
              </button>
            
            {hasPermission('kra-export') && (
              <button 
                onClick={handleExport}
                className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                Export
              </button>
            )}
            
             
              <button 
                onClick={handleAdd}
                disabled={!hasPermission('kra-add')}
                className={`inline-flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  hasPermission('kra-add')
                    ? 'text-white bg-green-800 hover:bg-green-900'
                    : 'text-slate-400 bg-slate-100 cursor-not-allowed'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                </svg>
                Add KRA
              </button>
            
          </div>
        </div>

        {/* Expandable Filters Panel */}
        {showFilters && (
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 mt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Filter Options</h3>
              <button
                onClick={() => setShowFilters(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div className="px-4 py-3">
              <div className="flex flex-col md:flex-row gap-3">
                {/* Department Filter */}
                <div className="flex-1">
                  <MultiSelect
                    label="Department"
                    options={getFilteredDepartments.map(dept => ({ value: dept, label: dept }))}
                    selectedValues={filters.department}
                    onSelectionChange={(values) => {
                      // When department changes, clear role filter if selected roles are no longer valid
                      const newFilters = { ...filters, department: values }
                      if (values.length === 0 || 
                          filters.role.length === 0 || 
                          filters.role.some(role => {
                            // Check if this role still exists in the new department filter
                            const roleExists = allEmployees.some(emp => 
                              (emp.designation === role || emp.title === role) &&
                              (values.length === 0 || values.includes(emp.department))
                            )
                            return !roleExists
                          })) {
                        // Keep valid roles, remove invalid ones
                        if (values.length > 0) {
                          const validRoles = filters.role.filter(role => {
                            return allEmployees.some(emp => 
                              (emp.designation === role || emp.title === role) &&
                              values.includes(emp.department)
                            )
                          })
                          newFilters.role = validRoles
                        } else {
                          // If no departments selected, keep all roles
                        }
                      }
                      setFilters(newFilters)
                    }}
                    placeholder="All Departments"
                    searchPlaceholder="Filter departments..."
                  />
                </div>

                {/* Role Filter */}
                <div className="flex-1">
                  <MultiSelect
                    label="Role"
                    options={getFilteredRoles.map(role => ({ value: role, label: role }))}
                    selectedValues={filters.role}
                    onSelectionChange={(values) => setFilters({ ...filters, role: values })}
                    placeholder={filters.department.length > 0 ? "Filtered by Department" : "All Roles"}
                    searchPlaceholder="Filter roles/designations..."
                  />
                </div>

                {/* Impact Filter */}
                <div className="flex-1">
                  <MultiSelect
                    label="Impact"
                    options={impacts.map(impact => ({ value: impact, label: impact }))}
                    selectedValues={filters.impact}
                    onSelectionChange={(values) => setFilters({...filters, impact: values})}
                    placeholder="All Impact Levels"
                    searchPlaceholder="Filter impact levels..."
                  />
                </div>
              </div>
              
              {/* Clear Filters Button */}
              <div className="mt-3 flex justify-end">
                <button
                  onClick={clearFilters}
                  className="text-sm text-slate-600 hover:text-slate-800 transition-colors"
                  disabled={activeFiltersCount === 0}
                >
                  Clear all filters
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* KRA Table */}
      <div className="overflow-x-auto rounded-b-xl">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="w-8 h-8 border-4 border-green-200 border-t-green-700 rounded-full animate-spin"></div>
            <span className="ml-3 text-slate-600">Loading KRAs...</span>
          </div>
        ) : filteredKRAs.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            <h3 className="mt-2 text-sm font-medium text-slate-900">No KRAs found</h3>
            <p className="mt-1 text-sm text-slate-500">
              {searchTerm || Object.values(filters).some(f => f !== '') 
                ? 'Try adjusting your search or filters.' 
                : 'Get started by adding your first KRA.'
              }
            </p>
                   {!searchTerm && !Object.values(filters).some(f => f !== '') && hasPermission('kra-add') && (
                     <div className="mt-6">
                       <button
                         onClick={handleAdd}
                         disabled={!hasPermission('kra-add')}
                         className={`inline-flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                           hasPermission('kra-add')
                             ? 'text-white bg-green-700 hover:bg-green-800'
                             : 'text-slate-400 bg-slate-100 cursor-not-allowed'
                         }`}
                       >
                         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                         </svg>
                         Add KRA
                       </button>
                     </div>
                   )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gradient-to-r from-slate-50 to-slate-100">
              <tr>
                <th className="text-left py-3 px-4 font-semibold text-slate-700">KRA Title</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-700">Department</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-700">Role</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-700">Year</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-700">Impact</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredKRAs.map((kra) => (
                <React.Fragment key={kra.id}>
                  <tr 
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => toggleExpand(kra.id)}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleExpand(kra.id)
                          }}
                          className="text-slate-400 hover:text-slate-600 transition-colors p-1"
                          title={expandedKRA === kra.id ? 'Collapse details' : 'Expand details'}
                        >
                          <svg 
                            className={`w-4 h-4 transition-transform duration-200 ${expandedKRA === kra.id ? 'rotate-90' : ''}`} 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
                          </svg>
                        </button>
                        <span className="text-green-700 font-medium">{kra.kra_title}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-700">{kra.department}</td>
                    <td className="py-3 px-4 text-slate-700">{kra.role}</td>
                    <td className="py-3 px-4 text-slate-700">
                      {kra.year ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
                          {kra.year}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">N/A</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <select 
                        value={kra.impact}
                        onChange={(e) => {
                          e.stopPropagation()
                          handleImpactChange(kra, e.target.value)
                        }}
                        onClick={(e) => e.stopPropagation()}
                        disabled={!hasPermission('kra-edit')}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-all duration-200 ${getImpactStyling(hasPermission('kra-edit'), kra.impact)}`}
                      >
                        {impacts.map(impact => (
                          <option key={impact} value={impact} className="bg-white text-slate-700">{impact}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        
                          <button
                            onClick={() => handleEdit(kra)}
                            disabled={!hasPermission('kra-edit')}
                            className={`p-1 transition-colors ${
                              hasPermission('kra-edit')
                                ? 'text-green-700 hover:text-green-800'
                                : 'text-slate-400 cursor-not-allowed'
                            }`}
                            title={hasPermission('kra-edit') ? "Edit KRA" : "No permission to edit KRA"}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                            </svg>
                          </button>
                        
                        
                          <button
                            onClick={() => handleDelete(kra.id)}
                            disabled={!hasPermission('kra-delete')}
                            className={`p-1 transition-colors ${
                              hasPermission('kra-delete')
                                ? 'text-red-600 hover:text-red-800'
                                : 'text-slate-400 cursor-not-allowed'
                            }`}
                            title={hasPermission('kra-delete') ? "Delete KRA" : "No permission to delete KRA"}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                            </svg>
                          </button>

                      </div>
                    </td>
                  </tr>
                  
                  {/* Expandable Details Row */}
                  {expandedKRA === kra.id && (
                    <tr>
                      <td colSpan="6" className="px-4 py-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* KRA Description Card */}
                          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                              <h4 className="font-semibold text-slate-900 text-sm">
                                KRA Description
                              </h4>
                            </div>
                            <p className="text-slate-700 text-sm leading-relaxed">
                              {kra.description || 'No description provided'}
                            </p>
                          </div>
                          
                          {/* Expectations Card */}
                          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <h4 className="font-semibold text-slate-900 text-sm">
                                Expectations / Outcomes
                              </h4>
                            </div>
                            {kra.expectations && kra.expectations.length > 0 ? (
                              <ul className="list-disc pl-4 space-y-1 text-slate-700 text-sm">
                                {kra.expectations.map((exp, index) => (
                                  <li key={index}>{exp}</li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-slate-500 text-sm">No expectations defined</p>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* KRA Form Modal */}
      <KRAForm
        isOpen={showForm}
        onClose={handleFormClose}
        onSubmit={handleFormSubmit}
        editingKRA={editingKRA}
        loading={formLoading}
        existingKRAs={kras}
      />

      {/* KRA Import Modal */}
      <KRAImport
        isOpen={showImport}
        onClose={handleImportClose}
        onImportComplete={handleImportComplete}
      />
    </div>
  )
}

export default KRAManagementTab