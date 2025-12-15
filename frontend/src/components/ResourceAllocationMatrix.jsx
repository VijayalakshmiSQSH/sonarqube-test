import React, { useState, useRef, useEffect } from 'react'

const ResourceAllocationMatrix = ({ employees, projects, allocations, searchTerm, filters }) => {
  const [expandedDepartments, setExpandedDepartments] = useState(new Set())
  
  // New state for custom employee selection
  const [showCustomSelection, setShowCustomSelection] = useState(false)
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState(new Set())
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState('')
  const searchInputRef = useRef(null)

  // Get current week date range
  const getCurrentWeekRange = () => {
    const today = new Date()
    const currentWeekStart = new Date(today)
    currentWeekStart.setDate(today.getDate() - today.getDay()) // Start of current week (Sunday)
    const currentWeekEnd = new Date(currentWeekStart)
    currentWeekEnd.setDate(currentWeekStart.getDate() + 6)
    
    return {
      start: currentWeekStart,
      end: currentWeekEnd
    }
  }

  // Check if allocation overlaps with current week
  const isAllocationInCurrentWeek = (allocation) => {
    if (!allocation.start_date || !allocation.end_date) return false
    
    const weekRange = getCurrentWeekRange()
    const allocationStart = new Date(allocation.start_date)
    const allocationEnd = new Date(allocation.end_date)
    
    return allocationStart <= weekRange.end && allocationEnd >= weekRange.start
  }

  // Calculate total allocation for an employee (current week only)
  const getEmployeeTotalAllocation = (employeeId) => {
    const employeeAllocations = allocations.filter(
      alloc => alloc.employee_id === employeeId && 
                alloc.status === 'Active' &&
                isAllocationInCurrentWeek(alloc)
    )
    
    // Consolidate allocations by project - keep only the latest one for each project
    const consolidatedAllocations = employeeAllocations.reduce((acc, allocation) => {
      const existingAllocation = acc.find(accAlloc => accAlloc.project_id === allocation.project_id)
      
      if (!existingAllocation) {
        // First allocation for this project
        acc.push(allocation)
      } else {
        // Compare start dates to keep the latest allocation
        const existingDate = new Date(existingAllocation.start_date)
        const currentDate = new Date(allocation.start_date)
        
        if (currentDate > existingDate) {
          // Replace with newer allocation
          const index = acc.findIndex(accAlloc => accAlloc.project_id === allocation.project_id)
          acc[index] = allocation
        }
      }
      
      return acc
    }, [])
    
    // Sum all consolidated project allocations
    return consolidatedAllocations.reduce((total, alloc) => total + alloc.allocation_percentage, 0)
  }

  // Filter employees based on search term and filters
  const filteredEmployees = employees.filter(employee => {
    if (!employee || (!employee.first_name && !employee.last_name)) return false
    
    // Filter to show only active employees
    const isActive = (employee.employee_status || 'Active') === 'Active'
    if (!isActive) return false
    
    // Create full name from first_name and last_name
    const fullName = `${employee.first_name || ''} ${employee.last_name || ''}`.trim()
    
    // Custom employee selection filter - if employees are selected, only show those
    const matchesCustomSelection = selectedEmployeeIds.size === 0 || selectedEmployeeIds.has(employee.id)
    
    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      const matchesSearch = 
        fullName.toLowerCase().includes(searchLower) ||
        employee.department?.toLowerCase().includes(searchLower) ||
        employee.designation?.toLowerCase().includes(searchLower)
      
      if (!matchesSearch) return false
    }

    // Resource type filter
    if (filters.resource_type && employee.designation !== filters.resource_type) {
      return false
    }

    // Skill level filter
    if (filters.skill_level) {
      const experience = employee.total_experience || 0
      const experienceYears = experience / 12
      
      switch (filters.skill_level) {
        case 'Junior':
          if (experienceYears >= 2) return false
          break
        case 'Mid':
          if (experienceYears < 2 || experienceYears >= 5) return false
          break
        case 'Senior':
          if (experienceYears < 5) return false
          break
        default:
          break
      }
    }

    // Utilization filter
    if (filters.utilization) {
      const totalAllocation = getEmployeeTotalAllocation(employee.id)
      
      switch (filters.utilization) {
        case 'available':
          if (totalAllocation > 0) return false
          break
        case 'low':
          if (totalAllocation <= 0 || totalAllocation > 50) return false
          break
        case 'medium':
          if (totalAllocation <= 50 || totalAllocation > 100) return false
          break
        case 'high':
          if (totalAllocation <= 100) return false
          break
        default:
          break
      }
    }

    // Allocation Status filter
    if (filters.allocation_status) {
      const totalAllocation = getEmployeeTotalAllocation(employee.id)
      
      switch (filters.allocation_status) {
        case 'available':
          if (totalAllocation > 0) return false
          break
        case 'allocated':
          if (totalAllocation <= 0) return false
          break
        default:
          break
      }
    }

    // Project filter - support both old single-value and new multi-select (utilization and matrix views)
    if (filters.project || (filters.selected_projects && filters.selected_projects.length > 0) || (filters.selected_projects_matrix && filters.selected_projects_matrix.length > 0)) {
      const employeeAllocations = allocations.filter(
        alloc => alloc.employee_id === employee.id && 
                  alloc.status === 'Active' &&
                  isAllocationInCurrentWeek(alloc)
      )
      
      // Check if employee has any allocation to the selected project(s)
      const hasProjectAllocation = employeeAllocations.some(allocation => {
        // Support old single project filter
        if (filters.project) {
          return allocation.project_id === parseInt(filters.project)
        }
        // Support new multi-select project filter (utilization view)
        if (filters.selected_projects && filters.selected_projects.length > 0) {
          return filters.selected_projects.includes(allocation.project_id)
        }
        // Support new multi-select project filter (matrix view)
        if (filters.selected_projects_matrix && filters.selected_projects_matrix.length > 0) {
          return filters.selected_projects_matrix.includes(allocation.project_id)
        }
        return false
      })
      
      if (!hasProjectAllocation) return false
    }

    // Project type filter - support both old single-value and new multi-select (utilization and matrix views)
    if (filters.project_type || (filters.selected_project_types && filters.selected_project_types.length > 0) || (filters.selected_project_types_matrix && filters.selected_project_types_matrix.length > 0)) {
      const employeeAllocations = allocations.filter(
        alloc => alloc.employee_id === employee.id && 
                  alloc.status === 'Active' &&
                  isAllocationInCurrentWeek(alloc)
      )
      
      // Check if employee has any allocation to projects of the selected type(s)
      const hasProjectTypeAllocation = employeeAllocations.some(allocation => {
        const project = projects.find(p => p.id === allocation.project_id)
        if (!project) return false
        
        // Support old single project type filter
        if (filters.project_type) {
          return project.project_type === filters.project_type
        }
        // Support new multi-select project type filter (utilization view)
        if (filters.selected_project_types && filters.selected_project_types.length > 0) {
          return filters.selected_project_types.includes(project.project_type)
        }
        // Support new multi-select project type filter (matrix view)
        if (filters.selected_project_types_matrix && filters.selected_project_types_matrix.length > 0) {
          return filters.selected_project_types_matrix.includes(project.project_type)
        }
        return false
      })
      
      if (!hasProjectTypeAllocation) return false
    }

    // Practice filter - multi-select (matrix view)
    if (filters.selected_practices_matrix && filters.selected_practices_matrix.length > 0) {
      const employeeAllocations = allocations.filter(
        alloc => alloc.employee_id === employee.id && 
                  alloc.status === 'Active' &&
                  isAllocationInCurrentWeek(alloc)
      )
      
      // Check if employee has any allocation to projects of the selected practice(s)
      const hasPracticeAllocation = employeeAllocations.some(allocation => {
        const project = projects.find(p => p.id === allocation.project_id)
        if (!project || !project.practice) return false
        
        return filters.selected_practices_matrix.includes(project.practice)
      })
      
      if (!hasPracticeAllocation) return false
    }

    return matchesCustomSelection
  })

  // Group employees by department
  const getEmployeesByDepartment = (employees) => {
    const grouped = {}
    employees.forEach(employee => {
      const department = employee.department || 'Unassigned'
      if (!grouped[department]) {
        grouped[department] = []
      }
      grouped[department].push(employee)
    })
    
    // Sort departments alphabetically, but put 'Unassigned' at the end
    const sortedGrouped = {}
    const sortedKeys = Object.keys(grouped).sort((a, b) => {
      if (a === 'Unassigned') return 1
      if (b === 'Unassigned') return -1
      return a.localeCompare(b)
    })
    
    sortedKeys.forEach(key => {
      sortedGrouped[key] = grouped[key]
    })
    
    return sortedGrouped
  }

  // Initialize expanded departments with all departments only once
  React.useEffect(() => {
    const departments = Object.keys(getEmployeesByDepartment(filteredEmployees))
    setExpandedDepartments(prev => {
      // Only initialize if no departments are currently expanded
      if (prev.size === 0 && departments.length > 0) {
        return new Set(departments)
      }
      return prev
    })
  }, [employees]) // Use employees instead of filteredEmployees to avoid frequent re-initialization

  const toggleDepartmentExpansion = (department) => {
    setExpandedDepartments(prev => {
      const newSet = new Set(prev)
      if (newSet.has(department)) {
        newSet.delete(department)
      } else {
        newSet.add(department)
      }
      return newSet
    })
  }


  // Get employee allocations for a specific project slot (current week only)
  const getEmployeeProjectAllocation = (employeeId, projectSlotIndex) => {
    // Get all active allocations for this employee in current week
    const employeeAllocations = allocations.filter(
      alloc => alloc.employee_id === employeeId && 
                alloc.status === 'Active' &&
                isAllocationInCurrentWeek(alloc)
    )
    
    // Consolidate allocations by project - keep only the latest one for each project
    const consolidatedAllocations = employeeAllocations.reduce((acc, allocation) => {
      const existingAllocation = acc.find(accAlloc => accAlloc.project_id === allocation.project_id)
      
      if (!existingAllocation) {
        // First allocation for this project
        acc.push(allocation)
      } else {
        // Compare start dates to keep the latest allocation
        const existingDate = new Date(existingAllocation.start_date)
        const currentDate = new Date(allocation.start_date)
        
        if (currentDate > existingDate) {
          // Replace with newer allocation
          const index = acc.findIndex(accAlloc => accAlloc.project_id === allocation.project_id)
          acc[index] = allocation
        }
      }
      
      return acc
    }, [])
    
    // Sort by allocation percentage (descending)
    const sortedAllocations = consolidatedAllocations
      .sort((a, b) => b.allocation_percentage - a.allocation_percentage)
    
    // Return the allocation at the specified slot index, or 0 if no allocation
    if (sortedAllocations[projectSlotIndex]) {
      return sortedAllocations[projectSlotIndex].allocation_percentage
    }
    return 0
  }

  // Get allocation details for a specific project slot
  const getEmployeeProjectAllocationDetails = (employeeId, projectSlotIndex) => {
    // Get all active allocations for this employee in current week
    const employeeAllocations = allocations.filter(
      alloc => alloc.employee_id === employeeId && 
                alloc.status === 'Active' &&
                isAllocationInCurrentWeek(alloc)
    )
    
    // Consolidate allocations by project - keep only the latest one for each project
    const consolidatedAllocations = employeeAllocations.reduce((acc, allocation) => {
      const existingAllocation = acc.find(accAlloc => accAlloc.project_id === allocation.project_id)
      
      if (!existingAllocation) {
        // First allocation for this project
        acc.push(allocation)
      } else {
        // Compare start dates to keep the latest allocation
        const existingDate = new Date(existingAllocation.start_date)
        const currentDate = new Date(allocation.start_date)
        
        if (currentDate > existingDate) {
          // Replace with newer allocation
          const index = acc.findIndex(accAlloc => accAlloc.project_id === allocation.project_id)
          acc[index] = allocation
        }
      }
      
      return acc
    }, [])
    
    // Sort by allocation percentage (descending)
    const sortedAllocations = consolidatedAllocations
      .sort((a, b) => b.allocation_percentage - a.allocation_percentage)
    
    return sortedAllocations[projectSlotIndex] || null
  }


  // Get project name by ID
  const getProjectName = (projectId) => {
    const project = projects.find(proj => proj.id === projectId)
    return project ? project.name : 'Unknown Project'
  }


  // Handle loading state
  if (!allocations || !Array.isArray(allocations)) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-700"></div>
        <span className="ml-2 text-slate-600">Loading allocation matrix...</span>
      </div>
    )
  }

  // Use static project columns (Project 1, Project 2, Project 3, Project 4)
  // These are not tied to actual project names, just slots for allocation display
  const staticProjectColumns = [
    { id: 'project_1', name: 'Project 1', index: 0 },
    { id: 'project_2', name: 'Project 2', index: 1 },
    { id: 'project_3', name: 'Project 3', index: 2 },
    { id: 'project_4', name: 'Project 4', index: 3 }
  ]

  // Calculate dynamic summary statistics (current week only)
  const calculateSummaryStats = () => {
    const totalEmployees = filteredEmployees.length
    const totalAllocations = allocations.filter(alloc => 
      alloc.status === 'Active' && isAllocationInCurrentWeek(alloc)
    ).length
    
    // Calculate utilization statistics
    const employeeUtilizations = filteredEmployees.map(emp => ({
      id: emp.id,
      totalAllocation: getEmployeeTotalAllocation(emp.id)
    }))
    
    const overAllocatedEmployees = employeeUtilizations.filter(emp => emp.totalAllocation > 100).length
    const availableEmployees = employeeUtilizations.filter(emp => emp.totalAllocation === 0).length
    const lowUtilizationEmployees = employeeUtilizations.filter(emp => emp.totalAllocation > 0 && emp.totalAllocation <= 50).length
    const mediumUtilizationEmployees = employeeUtilizations.filter(emp => emp.totalAllocation > 50 && emp.totalAllocation <= 100).length
    const fullyAllocatedEmployees = employeeUtilizations.filter(emp => emp.totalAllocation === 100).length
    
    // Calculate average utilization
    const totalUtilization = employeeUtilizations.reduce((sum, emp) => sum + emp.totalAllocation, 0)
    const averageUtilization = totalEmployees > 0 ? Math.round(totalUtilization / totalEmployees) : 0
    
    // Calculate available capacity (employees with < 100% allocation)
    const availableCapacity = employeeUtilizations.reduce((sum, emp) => {
      return sum + Math.max(0, 100 - emp.totalAllocation)
    }, 0)
    const averageAvailableCapacity = totalEmployees > 0 ? Math.round(availableCapacity / totalEmployees) : 0
    
    return {
      totalAllocations,
      overAllocatedEmployees,
      availableEmployees,
      lowUtilizationEmployees,
      mediumUtilizationEmployees,
      fullyAllocatedEmployees,
      averageUtilization,
      averageAvailableCapacity
    }
  }

  const summaryStats = calculateSummaryStats()

  // Export Matrix functionality
  const handleExportMatrix = () => {
    const employeesByDept = getEmployeesByDepartment(filteredEmployees)
    
    // Create CSV data
    let csvContent = "Employee,Department,Designation"
    staticProjectColumns.forEach(column => {
      csvContent += `,${column.name}`
    })
    csvContent += ",Total Allocation\n"
    
    Object.entries(employeesByDept).forEach(([department, deptEmployees]) => {
      deptEmployees.forEach(employee => {
        const employeeName = `${employee.first_name || ''} ${employee.last_name || ''}`.trim()
        csvContent += `"${employeeName}","${employee.department || 'N/A'}","${employee.designation || 'N/A'}"`
        
        staticProjectColumns.forEach((column, index) => {
          const allocation = getEmployeeProjectAllocation(employee.id, index)
          const allocationDetails = getEmployeeProjectAllocationDetails(employee.id, index)
          if (allocation > 0 && allocationDetails) {
            const projectName = getProjectName(allocationDetails.project_id)
            csvContent += `,"${allocation}% (${projectName})"`
          } else {
            csvContent += `,"-"`
          }
        })
        
        const totalAllocation = getEmployeeTotalAllocation(employee.id)
        csvContent += `,"${totalAllocation}%"\n`
      })
    })
    
    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `resource-matrix-${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const employeesByDepartment = getEmployeesByDepartment(filteredEmployees)

  // Custom Selection Modal Component
  const CustomSelectionModal = () => {
    if (!showCustomSelection) return null

    // Focus the search input when modal opens
    useEffect(() => {
      if (showCustomSelection && searchInputRef.current) {
        searchInputRef.current.focus()
      }
    }, [showCustomSelection])

    // Filter employees based on search term and active status
    const filteredEmployeesForSelection = employees.filter(employee => {
      if (!employee || (!employee.first_name && !employee.last_name)) return false
      
      // Filter to show only active employees
      const isActive = (employee.employee_status || 'Active') === 'Active'
      if (!isActive) return false
      
      const fullName = `${employee.first_name || ''} ${employee.last_name || ''}`.trim()
      return !employeeSearchTerm || fullName.toLowerCase().includes(employeeSearchTerm.toLowerCase())
    })

    const toggleEmployeeSelection = (employeeId) => {
      setSelectedEmployeeIds(prev => {
        const newSet = new Set(prev)
        if (newSet.has(employeeId)) {
          newSet.delete(employeeId)
        } else {
          newSet.add(employeeId)
        }
        return newSet
      })
    }

    const clearSelection = () => {
      setSelectedEmployeeIds(new Set())
    }

    const selectAll = () => {
      setSelectedEmployeeIds(new Set(filteredEmployeesForSelection.map(emp => emp.id)))
    }

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Custom Employee Selection</h3>
              <button
                onClick={() => setShowCustomSelection(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <p className="text-sm text-slate-600 mt-1">
              Select specific employees to display in the resource allocation matrix
            </p>
          </div>

          {/* Search Bar */}
          <div className="px-6 py-4 border-b border-slate-200">
            <div className="relative flex items-center bg-white border border-slate-300 rounded-lg px-3 py-2">
              <svg className="w-4 h-4 text-slate-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search employees..."
                value={employeeSearchTerm}
                onChange={(e) => setEmployeeSearchTerm(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                onKeyUp={(e) => e.stopPropagation()}
                onKeyPress={(e) => e.stopPropagation()}
                className="flex-1 outline-none text-sm pr-6"
                autoFocus
              />
              {employeeSearchTerm && (
                <button
                  type="button"
                  onClick={() => setEmployeeSearchTerm('')}
                  className="absolute right-2 text-slate-400 hover:text-slate-600 transition-colors"
                  title="Clear search"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="px-6 py-3 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={selectAll}
                  className="px-3 py-1 text-sm text-green-700 hover:text-green-800 font-medium"
                >
                  Select All
                </button>
                <button
                  onClick={clearSelection}
                  className="px-3 py-1 text-sm text-red-600 hover:text-red-700 font-medium"
                >
                  Clear All
                </button>
              </div>
              <div className="text-sm text-slate-600">
                {selectedEmployeeIds.size} of {filteredEmployeesForSelection.length} selected
              </div>
            </div>
          </div>

          {/* Employee List */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="space-y-2">
              {filteredEmployeesForSelection.map(employee => {
                const fullName = `${employee.first_name || ''} ${employee.last_name || ''}`.trim()
                const isSelected = selectedEmployeeIds.has(employee.id)
                
                return (
                  <div
                    key={employee.id}
                    onClick={() => toggleEmployeeSelection(employee.id)}
                    className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all ${
                      isSelected 
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center mr-3 ${
                      isSelected 
                        ? 'bg-green-700 border-green-700' 
                        : 'border-slate-300'
                    }`}>
                      {isSelected && (
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                        </svg>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-slate-900">{fullName}</div>
                      <div className="text-sm text-slate-500">
                        {employee.designation} • {employee.department}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50">
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowCustomSelection(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowCustomSelection(false)}
                className="px-4 py-2 text-sm font-medium text-white bg-green-700 border border-transparent rounded-lg hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Apply Selection
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Custom Selection Modal */}
      <CustomSelectionModal />
      {/* Matrix Header */}
      <div className="bg-white rounded-lg border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Resource Allocation Matrix</h3>
              <p className="text-sm text-slate-600 mt-1">
                Employee allocations across {staticProjectColumns.length} project slots
              </p>
            </div>
            <div className="flex items-center gap-4">
              {/* Summary Cards */}
              {/* <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-100 rounded-full"></div>
                  <span className="text-sm font-medium text-slate-700">
                    Over-allocated: {summaryStats.overAllocatedEmployees}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-100 rounded-full"></div>
                  <span className="text-sm font-medium text-slate-700">
                    Available: {summaryStats.availableEmployees}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-100 rounded-full"></div>
                  <span className="text-sm font-medium text-slate-700">
                    Avg Utilization: {summaryStats.averageUtilization}%
                  </span>
                </div>
              </div> */}
              <div className="flex gap-2">
                {/* Custom Selection Button */}
                <button
                  onClick={() => {
                    setEmployeeSearchTerm('')
                    setShowCustomSelection(true)
                  }}
                  className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 border ${
                    selectedEmployeeIds.size > 0
                      ? 'bg-green-700 text-white border-green-700'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"/>
                  </svg>
                  Select
                  {selectedEmployeeIds.size > 0 && (
                    <span className="bg-white text-green-700 px-2 py-0.5 rounded-full text-xs font-bold">
                      {selectedEmployeeIds.size}
                    </span>
                  )}
                </button>
                <button 
                  onClick={handleExportMatrix}
                  className="bg-green-700 text-white px-4 py-2 text-sm font-medium rounded-lg hover:bg-green-800"
                >
                  Export Matrix
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Employee Matrix Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider border-r border-slate-200">
                  Employee
                </th>
                {staticProjectColumns.map((column) => (
                  <th key={column.id} className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider border-r border-slate-200 min-w-[120px]">
                    <div className="font-semibold text-slate-700">{column.name}</div>
                  </th>
                ))}
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-100">
                  Total Allocation
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {Object.entries(employeesByDepartment).map(([department, deptEmployees]) => (
                <React.Fragment key={department}>
                  {/* Department Header Row */}
                  <tr className="bg-slate-100 hover:bg-slate-100">
                    <td colSpan={staticProjectColumns.length + 2} className="px-6 py-3">
                      <button
                        onClick={() => toggleDepartmentExpansion(department)}
                        className="w-full text-left flex items-center justify-between rounded-lg px-2 py-1 transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <svg
                            className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${
                              expandedDepartments.has(department) ? 'rotate-90' : ''
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          <div className='flex '>
                            <h3 className="pl-3 pr-1  text-sm font-semibold text-slate-900 uppercase tracking-wider">{department}</h3>
                            <p className=" text-sm font-semibold text-slate-900 uppercase tracking-wider">({deptEmployees.length} employees)</p>
                          </div>
                        </div>
                      </button>
                    </td>
                  </tr>

                  {/* Department Employees */}
                  {expandedDepartments.has(department) && deptEmployees.map((employee) => {
                    const totalAllocation = getEmployeeTotalAllocation(employee.id)
                    const isOverAllocated = totalAllocation > 100
                    
                    return (
                      <tr 
                        key={employee.id} 
                        className={`hover:bg-slate-50 transition-colors ${
                          isOverAllocated ? 'bg-red-50 hover:bg-red-100' : ''
                        }`}
                      >
                        {/* Employee Info */}
                        <td className="px-4 py-4 border-r border-slate-200">
                          <div className="space-y-1">
                            <div className="text-sm font-medium text-green-700">{`${employee.first_name || ''} ${employee.last_name || ''}`.trim()}</div>
                            <div className="text-sm text-slate-500">{employee.designation}</div>
                          </div>
                        </td>

                        {/* Project Allocations */}
                        {staticProjectColumns.map((column, index) => {
                          const allocation = getEmployeeProjectAllocation(employee.id, index)
                          const allocationDetails = getEmployeeProjectAllocationDetails(employee.id, index)
                          
                          return (
                            <td key={column.id} className="px-4 py-4 text-center border-r border-slate-200">
                              {allocation > 0 ? (
                                <div className="group relative">
                                  <div className={`inline-flex flex-col items-center space-y-1 px-3 py-2 rounded-lg transition-all ${
                                    allocation > 100 ? 'bg-red-100 text-red-800' :
                                    allocation > 75 ? 'bg-orange-100 text-orange-800' :
                                    allocation > 50 ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-green-100 text-green-800'
                                  }`}>
                                    <div className="text-sm font-semibold">{allocation}%</div>
                                    <div className="text-xs opacity-75">
                                      {allocationDetails ? getProjectName(allocationDetails.project_id) : 'Unknown'}
                                    </div>
                                  </div>
                                  
                                  {/* Tooltip */}
                                  {allocationDetails && (
                                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-slate-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10 whitespace-nowrap">
                                      <div className="font-medium">{allocationDetails.role}</div>
                                      <div>Start: {new Date(allocationDetails.start_date).toLocaleDateString()}</div>
                                      {allocationDetails.end_date && (
                                        <div>End: {new Date(allocationDetails.end_date).toLocaleDateString()}</div>
                                      )}
                                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-slate-900"></div>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="text-slate-300 text-sm">-</div>
                              )}
                            </td>
                          )
                        })}

                        {/* Total Allocation */}
                        <td className="px-4 py-4 text-center bg-slate-50">
                          <div className={`inline-flex items-center space-x-2 px-3 py-2 rounded-lg ${
                            isOverAllocated ? 'bg-red-100 text-red-800' :
                            totalAllocation === 100 ? 'bg-green-100 text-green-800' :
                            totalAllocation > 0 ? 'bg-green-100 text-green-800' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            <div className="text-sm font-semibold">{totalAllocation}%</div>
                            {isOverAllocated && (
                              <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Matrix Legend */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-100 rounded"></div>
                <span className="text-xs text-slate-600">0-50%</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-yellow-100 rounded"></div>
                <span className="text-xs text-slate-600">51-75%</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-orange-100 rounded"></div>
                <span className="text-xs text-slate-600">76-100%</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-red-100 rounded"></div>
                <span className="text-xs text-slate-600">Over 100%</span>
              </div>
            </div>
            <div className="text-xs text-slate-500">
              {filteredEmployees.length} employees • {staticProjectColumns.length} project slots
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ResourceAllocationMatrix
