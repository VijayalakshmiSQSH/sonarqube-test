import React, { useState, useEffect, useMemo, useRef } from 'react'
import { usePermissions } from '../../context/PermissionContext.jsx'
import { useEmployees } from '../../context/EmployeeContext.jsx'
import LoadingSpinner from '../../components/LoadingSpinner.jsx'
import { getApiBaseUrl, TOKEN } from '../../utils/constants.js'
import { getCookie } from '../../utils/helpers.js'
import { animationStyles } from './LearningManagementComponents.jsx'
import AddProgram from './AddProgram.jsx'
import EditProgram from './EditProgram.jsx'

const LearningManagement = () => {
  const { hasPermission } = usePermissions()
  const { getAllEmployees } = useEmployees()
  const [loading, setLoading] = useState(false)
  const [programs, setPrograms] = useState([])
  const [viewMode, setViewMode] = useState('list') // 'list', 'add', 'edit'
  const [editingProgram, setEditingProgram] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState('all') // 'all', 'Training', 'Certification'
  const [deletingProgramId, setDeletingProgramId] = useState(null) // Track which program is being deleted
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false) // Show custom delete confirmation modal
  const [programToDelete, setProgramToDelete] = useState(null) // Program to be deleted

  // Get employees from context (already loaded on Skills.jsx page load)
  const employeesList = getAllEmployees()
  
  // Create employee options for dropdowns and employee map - memoized to prevent unnecessary recalculations
  const { employees, employeeMap } = useMemo(() => {
          // Create employee options for dropdowns
          const employeeOptions = employeesList.map(emp => ({
            value: emp.id || emp.employee_id || emp.employeeId,
            label: `${emp.first_name || emp.firstName || ''} ${emp.last_name || emp.lastName || ''}`.trim()
          }))
          
          // Create a map of employee ID to employee object for quick lookup
          const map = {}
          employeesList.forEach(emp => {
            const id = emp.id || emp.employee_id || emp.employeeId
            if (id) {
        // Store as both number and string key to handle both formats
        const numId = typeof id === 'string' ? parseInt(id, 10) : id
        const strId = String(id)
        const name = `${emp.first_name || emp.firstName || ''} ${emp.last_name || emp.lastName || ''}`.trim()
        map[numId] = { id: numId, name }
        if (strId !== String(numId)) {
          map[strId] = { id: numId, name }
              }
            }
          })
    
    return { employees: employeeOptions, employeeMap: map }
  }, [employeesList])

  // Helper function to map owner IDs to owner objects with names
  const mapOwners = (ownerIds, map) => {
    if (!Array.isArray(ownerIds) || ownerIds.length === 0) return []
    
    return ownerIds.map(ownerId => {
      // Convert to number if it's a string
      const id = typeof ownerId === 'string' ? parseInt(ownerId, 10) : ownerId
      // Try both number and string key lookups
      const employee = map[id] || map[String(id)]
      return employee ? { id: id, name: employee.name } : { id: id, name: 'Unknown' }
    })
  }

  // Fetch programs from API (fetch all programs, no filters)
  const fetchPrograms = async () => {
    // Check permission before making API call
    if (!hasPermission('learning-management-view')) {
      console.warn('User does not have learning-management-view permission')
      setPrograms([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const token = getCookie(TOKEN)
      const url = `${getApiBaseUrl()}/api/programs`
      
      // Fetch all programs without filters (client-side filtering)
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        const programsList = data.programs || []
        
        // Transform programs to match UI format
        const transformedPrograms = programsList.map(program => {
          // Get participants array (IDs) - preserve original for edit form
          const participantsArray = Array.isArray(program.participants) 
            ? program.participants 
            : []
          
          // Calculate participants count for display
          const participantsCount = participantsArray.length
          
          // Get owner IDs and map them to names using current employeeMap
          const ownerIds = Array.isArray(program.owners) ? program.owners : []
          const mappedOwners = mapOwners(ownerIds, employeeMap)
          
          return {
            id: program.program_id,
            program_name: program.program_name,
            program_type: program.program_type, // 'Training' or 'Certification'
            estimated_duration: program.estimated_duration,
            description: program.description,
            category_tags: program.category_tags,
            // Store owner IDs for future updates
            ownerIds: ownerIds,
            // Mapped owners with names
            owners: mappedOwners,
            // Resources are already in correct format
            resources: program.resources || [],
            // Store participants array (IDs) for edit form
            participants: participantsArray,
            // Store participants count for display
            participantsCount: participantsCount,
            // Store full data for edit view
            ...program,
            // Override with mapped owners and participants to ensure correct format
            owners: mappedOwners,
            participants: participantsArray
          }
        })
        
        setPrograms(transformedPrograms)
      } else if (response.status === 403) {
        // Handle permission denied
        const errorData = await response.json().catch(() => ({ error: 'Permission denied' }))
        console.error('Permission denied:', errorData)
        setPrograms([])
        // You could show a toast notification here
      } else {
        console.error('Failed to fetch programs:', response.status, response.statusText)
        setPrograms([])
      }
    } catch (error) {
      console.error('Error fetching programs:', error)
      setPrograms([])
    } finally {
      setLoading(false)
    }
  }

  // Fetch programs when component mounts or when employeeMap becomes available
  useEffect(() => {
    fetchPrograms()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only fetch on mount

  // Track the last employeeMap keys to prevent unnecessary updates
  const lastEmployeeMapKeysRef = useRef('')
  
  // Update owner names when employee map becomes available or changes
  // Only update if owner names are missing or "Unknown", not if they already have names
  useEffect(() => {
    if (Object.keys(employeeMap).length > 0 && programs.length > 0) {
      // Create a string representation of employeeMap keys to detect actual changes
      const currentMapKeys = Object.keys(employeeMap).sort().join(',')
      
      // Skip if employeeMap hasn't actually changed (same keys)
      if (currentMapKeys === lastEmployeeMapKeysRef.current && lastEmployeeMapKeysRef.current !== '') {
        return
      }
      
      // Update the ref
      lastEmployeeMapKeysRef.current = currentMapKeys
      
      // Use functional update to get the latest programs state
      setPrograms(currentPrograms => {
        // Check if any programs need owner name updates
        const needsUpdate = currentPrograms.some(program => {
          if (!program.owners || program.owners.length === 0) {
            return program.ownerIds && program.ownerIds.length > 0
          }
          // Check if any owner has "Unknown" or missing name (but not if they already have valid names)
          return program.owners.some(owner => {
            const ownerName = typeof owner === 'object' ? owner.name : null
            return !ownerName || ownerName === 'Unknown'
          })
        })
        
        if (!needsUpdate) {
          return currentPrograms // No update needed, return current state
        }
        
        // Update owner names only for programs that need it
        const updatedPrograms = currentPrograms.map(program => {
          // Get owner IDs
        let ownerIds = program.ownerIds || []
        if (!ownerIds.length && Array.isArray(program.owners)) {
          ownerIds = program.owners.map(o => (typeof o === 'object' && o.id ? o.id : o))
        }
        
          // Only update if owners are missing or have "Unknown" names
          const currentOwners = program.owners || []
          const hasUnknownOwners = currentOwners.some(owner => {
            const ownerName = typeof owner === 'object' ? owner.name : null
            return !ownerName || ownerName === 'Unknown'
          })
          
          if (!hasUnknownOwners && currentOwners.length > 0) {
            // Owners already have valid names, don't update
            return program
          }
          
          // Map owner IDs to names
          const mappedOwners = mapOwners(ownerIds, employeeMap)
          
          return {
            ...program,
            owners: mappedOwners
          }
        })
        
        // Only return updated programs if there are actual changes
        const hasChanges = updatedPrograms.some((updated, index) => {
          const currentOwnersStr = JSON.stringify(currentPrograms[index].owners || [])
          const updatedOwnersStr = JSON.stringify(updated.owners)
          return currentOwnersStr !== updatedOwnersStr
        })
        
        return hasChanges ? updatedPrograms : currentPrograms
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeMap])

  const handleAddProgram = () => {
    setViewMode('add')
    setEditingProgram(null)
  }

  const handleEditProgram = (program) => {
    // Open edit view immediately with program from list
    // EditProgram component will fetch fresh data and show spinner
    setViewMode('edit')
    setEditingProgram(program)
  }

  const handleCancel = () => {
    setViewMode('list')
    setEditingProgram(null)
  }

  // Helper function to ensure all modules and submodules have IDs
  const ensureModuleIds = (modules) => {
    if (!Array.isArray(modules)) return []
    
    const generateModuleId = () => {
      return `module_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }

    const generateSubmoduleId = () => {
      return `submodule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }
    
    return modules.map(module => ({
      ...module,
      module_id: module.module_id || generateModuleId(),
      submodules: (module.submodules || []).map(submodule => ({
        ...submodule,
        submodule_id: submodule.submodule_id || generateSubmoduleId()
      }))
    }))
  }

  const handleSubmit = async (formData) => {
    try {
      setLoading(true)
      const token = getCookie(TOKEN)
      
      // Ensure all modules and submodules have IDs before submitting
      const modulesWithIds = ensureModuleIds(formData.modules || [])
      
      // Prepare the data for API
      const payload = {
        program_name: formData.program_name,
        program_type: formData.program_type,
        version: formData.version || null,
        description: formData.description || null,
        category_tags: formData.category_tags || null,
        estimated_duration: formData.estimated_duration || null,
        modules: modulesWithIds,
        owners: formData.owners || [],
        resources: formData.resources || [],
        participants: formData.participants || []
      }
      
      // Only include certificate_id if it's explicitly set (not null)
      // For Certification programs, if certificate_id is not provided, backend will preserve existing value
      if (formData.program_type === 'Certification' && formData.selectedCertificate) {
        payload.certificate_id = formData.selectedCertificate
      } else if (formData.program_type === 'Training') {
        // For Training programs, explicitly set to null
        payload.certificate_id = null
      }
      
      const url = editingProgram 
        ? `${getApiBaseUrl()}/api/programs/${editingProgram.id}`
        : `${getApiBaseUrl()}/api/programs`
      
      const method = editingProgram ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })
      
      if (!response.ok) {
        // Try to parse error as JSON, but handle HTML error pages
        let errorMessage = 'Failed to save program'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorData.message || errorMessage
        } catch (e) {
          // If response is not JSON (e.g., HTML error page), use status text
          errorMessage = `Server error: ${response.status} ${response.statusText}`
        }
        throw new Error(errorMessage)
      }
      
      const result = await response.json()
      console.log('Program saved successfully:', result)
      
      // Refresh programs list
      await fetchPrograms()
      
      // Go back to list view
      setViewMode('list')
      setEditingProgram(null)
      
      // Show success message (you can add a toast notification here)
      alert(editingProgram ? 'Program updated successfully!' : 'Program created successfully!')
      
    } catch (error) {
      console.error('Error saving program:', error)
      alert(`Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteProgram = (programId = null) => {
    const idToDelete = programId || editingProgram?.id
    if (!idToDelete) return
    
    // Find the program to show in confirmation
    const program = programs.find(p => p.id === idToDelete)
    if (program) {
      setProgramToDelete(program)
      setShowDeleteConfirm(true)
    }
  }

  const confirmDeleteProgram = async () => {
    if (!programToDelete) return
    
    try {
      setDeletingProgramId(programToDelete.id)
      const token = getCookie(TOKEN)
      const response = await fetch(`${getApiBaseUrl()}/api/programs/${programToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        // Remove program from local state instead of refreshing
        setPrograms(prevPrograms => prevPrograms.filter(p => p.id !== programToDelete.id))
        
        // If deleting from edit mode, go back to list
        if (editingProgram && editingProgram.id === programToDelete.id) {
          setViewMode('list')
          setEditingProgram(null)
        }
        
        alert('Program deleted successfully!')
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Failed to delete program' }))
        throw new Error(errorData.error || 'Failed to delete program')
      }
    } catch (error) {
      console.error('Error deleting program:', error)
      alert(`Error: ${error.message}`)
    } finally {
      setDeletingProgramId(null)
      setShowDeleteConfirm(false)
      setProgramToDelete(null)
    }
  }

  const cancelDeleteProgram = () => {
    setShowDeleteConfirm(false)
    setProgramToDelete(null)
  }

  const handlePreviewProgram = () => {
    // TODO: Implement preview functionality
    console.log('Preview program:', editingProgram)
  }

  // Filter programs client-side (similar to certificates tab in Skills.jsx)
  const filteredPrograms = programs.filter(program => {
    // Filter by search term
    const matchesSearch = !searchTerm.trim() || 
      program.program_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      program.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      program.category_tags?.toLowerCase().includes(searchTerm.toLowerCase())
    
    // Filter by program type
    const matchesType = typeFilter === 'all' || program.program_type === typeFilter
    
    return matchesSearch && matchesType
  })

  const totalPrograms = programs.length
  const totalParticipants = programs.reduce((sum, p) => {
    const count = Array.isArray(p.participants) ? p.participants.length : (p.participantsCount || 0)
    return sum + count
  }, 0)
  const totalOwners = new Set(programs.flatMap(p => p.owners?.map(o => o.id) || [])).size

  // Prevent access to add view if user doesn't have permission
  useEffect(() => {
    if (viewMode === 'add' && !hasPermission('learning-management-add')) {
      setViewMode('list')
    }
  }, [viewMode, hasPermission])

  if (loading) {
    return <LoadingSpinner />
  }

  // Add Program View - Only allow if user has permission
  if (viewMode === 'add') {
    if (!hasPermission('learning-management-add')) {
      return null
    }
    return (
      <AddProgram
        employees={employees}
        onCancel={handleCancel}
        onSubmit={handleSubmit}
      />
    )
  }

  // Edit Program View
  if (viewMode === 'edit') {
    return (
      <EditProgram
        program={editingProgram}
        employees={employees}
        onCancel={handleCancel}
        onSubmit={handleSubmit}
        onDelete={handleDeleteProgram}
        onPreview={handlePreviewProgram}
      />
    )
  }

  // List View
  return (
    <>
      <style>{animationStyles}</style>
      <div className="animate-fade-in">
        {/* Page Header */}
        <div className="mb-2 animate-fade-in mb-2">
          <h1 className="page-title text-xl">Learning & Training Programs</h1>
        </div>

        {/* Stats Cards */}
        <div className="card p-4 mb-2">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-medium font-semibold text-slate-900">Programs Overview</h3>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center border border-slate-200 rounded-xl px-1 py-1 bg-slate-50">
              <div className="text-medium font-bold text-slate-900">{totalPrograms}</div>
              <div className="text-xs text-slate-600 uppercase mt-1">Total Programs</div>
            </div>
            <div className="text-center border border-slate-200 rounded-xl px-1 py-1 bg-slate-50">
              <div className="text-medium font-bold text-slate-900">{totalParticipants}</div>
              <div className="text-xs text-slate-600 uppercase mt-1">Participants</div>
            </div>
            <div className="text-center border border-slate-200 rounded-xl px-1 py-1 bg-slate-50">
              <div className="text-medium font-bold text-slate-900">{totalOwners}</div>
              <div className="text-xs text-slate-600 uppercase mt-1">Owners</div>
            </div>
          </div>
        </div>

        {/* Programs Management Section */}
        <div className="card p-4 mb-2">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-medium font-semibold text-slate-900">Programs ({filteredPrograms.length})</h3>
            {hasPermission('learning-management-add') && (
              <button
                onClick={handleAddProgram}
                className="px-3 py-2 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 transition-all duration-200 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                </svg>
                Add Program
              </button>
            )}
          </div>
          
          {/* Search and Filter Controls */}
          <div className="mb-6 space-y-4">
            <div className="flex flex-row gap-4">
              {/* Search Box */}
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Search programs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-800 focus:border-transparent transition-all duration-200"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 transition-colors"
                    type="button"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                )}
              </div>
              
              {/* Type Filter */}
              <div className="flex-1">
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-800 focus:border-transparent transition-all duration-200 cursor-pointer"
                >
                  <option value="all">All Types</option>
                  <option value="Training">Training</option>
                  <option value="Certification">Certification</option>
                </select>
              </div>
            </div>
          </div>

          {/* Programs Table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Program Name</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Program Owners</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Resources</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Type</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Participants</th>
                      {(hasPermission('learning-management-edit') || hasPermission('learning-management-delete')) && (
                        <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                      )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {filteredPrograms.length > 0 ? (
                  filteredPrograms.map(program => (
                    <tr key={program.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-slate-900">{program.program_name}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex gap-2 flex-wrap">
                          {program.owners && program.owners.length > 0 ? (
                            program.owners.map(owner => {
                              // Owner should already be in {id, name} format from our mapping
                              const ownerId = typeof owner === 'object' ? owner.id : owner
                              const ownerName = typeof owner === 'object' ? owner.name : 'Unknown'
                              
                              // Don't show "Loading..." or "Unknown" if we can look it up from employeeMap
                              const displayName = ownerName && ownerName !== 'Loading...' && ownerName !== 'Unknown' 
                                ? ownerName 
                                : (employeeMap[ownerId]?.name || employeeMap[String(ownerId)]?.name || 'Unknown')
                              
                              return (
                                <span key={ownerId} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                              </svg>
                                  {displayName}
                            </span>
                              )
                            })
                          ) : (
                            <span className="text-xs text-slate-400 italic">No owners</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-1">
                          {program.resources?.map((resource, idx) => (
                            <a key={idx} href={resource.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline">
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/>
                              </svg>
                              {resource.title}
                            </a>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          program.program_type === 'Training' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {program.program_type}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-center text-sm text-slate-500">
                        {Array.isArray(program.participants) ? program.participants.length : (program.participantsCount || 0)}
                      </td>
                      {(hasPermission('learning-management-edit') || hasPermission('learning-management-delete')) && (
                        <td className="px-4 py-4 whitespace-nowrap text-center text-sm font-medium">
                          <div className="flex gap-2 justify-center">
                            {hasPermission('learning-management-edit') && (
                              <>
                                <button
                                  onClick={() => handleEditProgram(program)}
                                  className="text-indigo-600 hover:text-indigo-900 transition-colors"
                                >
                                  Edit
                                </button>
                                {hasPermission('learning-management-delete') && (
                                  <span className="text-slate-300">|</span>
                                )}
                              </>
                            )}
                            {hasPermission('learning-management-delete') && (
                              <button
                                onClick={() => handleDeleteProgram(program.id)}
                                className="text-red-600 hover:text-red-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                disabled={deletingProgramId === program.id || loading}
                              >
                                {deletingProgramId === program.id ? (
                                  <>
                                    <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <span>Deleting...</span>
                                  </>
                                ) : (
                                  'Delete'
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={(hasPermission('learning-management-edit') || hasPermission('learning-management-delete')) ? 6 : 5} className="px-4 py-8 text-center text-sm text-slate-500 italic">
                      {!hasPermission('learning-management-view') ? (
                        <div className="flex flex-col items-center gap-2">
                          <p>You don't have permission to view programs.</p>
                          <p className="text-xs">Please contact your administrator to request access.</p>
                        </div>
                      ) : (
                        <>
                          No programs found.{hasPermission('learning-management-add') && ' Click "Add Program" to create one.'}
                        </>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Custom Delete Confirmation Modal */}
      {showDeleteConfirm && programToDelete && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={cancelDeleteProgram}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900">Delete Program</h3>
                  <p className="text-sm text-slate-600 mt-1">This action cannot be undone</p>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              <div className="mb-4">
                <p className="text-sm text-slate-700 mb-2">
                  Are you sure you want to delete the program <span className="font-semibold text-slate-900">"{programToDelete.program_name}"</span>?
                </p>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-red-800 mb-1">Warning</p>
                      <p className="text-sm text-red-700">
                        This will also delete all related participant records from the employee_program_participation table.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={cancelDeleteProgram}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 transition-colors"
                disabled={deletingProgramId === programToDelete.id}
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteProgram}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                disabled={deletingProgramId === programToDelete.id}
              >
                {deletingProgramId === programToDelete.id ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Deleting...</span>
                  </>
                ) : (
                  'Delete Program'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default LearningManagement

