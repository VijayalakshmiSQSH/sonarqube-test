import React, { useState, useEffect, memo, useRef } from 'react'
import LoadingSpinner from '../../components/LoadingSpinner.jsx'
import { getCookie } from '../../utils/helpers.js'
import { TOKEN, getApiBaseUrl } from '../../utils/constants.js'

const SixWeekForecastTab = memo(({ 
  employees, 
  weeklyAllocations, 
  projects, 
  searchTerm, 
  filters, 
  forecastLoading, 
  forecastError, 
  expandedDepartments, 
  setExpandedDepartments, 
  isAuthenticated,
  fetchProjects,
  editingAllocation,
  setEditingAllocation
}) => {
  // New state for custom employee selection
  const [showCustomSelection, setShowCustomSelection] = useState(false)
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState(new Set())
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState('')
  const searchInputRef = useRef(null)

  // Initialize expanded departments for forecast view
  useEffect(() => {
    if (employees.length > 0) {
      const departments = Object.keys(getEmployeesByDepartment())
      setExpandedDepartments(prev => {
        // Only initialize if no departments are currently expanded
        if (prev.size === 0 && departments.length > 0) {
          return new Set(departments)
        }
        return prev
      })
    }
  }, [employees.length])

  // Filter employees for forecast tab based on search term and filters
  const filteredEmployees = employees.filter(employee => {
    // Add safety checks for employee data
    if (!employee || (!employee.first_name && !employee.last_name)) return false
    
    // Filter to show only active employees
    const isActive = (employee.employee_status || 'Active') === 'Active'
    if (!isActive) return false
    
    // Create full name from first_name and last_name
    const fullName = `${employee.first_name || ''} ${employee.last_name || ''}`.trim()
    
    try {
      // Custom employee selection filter - if employees are selected, only show those
      const matchesCustomSelection = selectedEmployeeIds.size === 0 || selectedEmployeeIds.has(employee.id)
      
      // Search term filter with null checks
      const matchesSearch = !searchTerm || 
        (fullName && fullName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (employee.designation && employee.designation.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (employee.department && employee.department.toLowerCase().includes(searchTerm.toLowerCase()))
      
      // Forecast-specific filters with safety checks
      // Support both old single-value and new multi-select department filters (utilization and forecast views)
      const matchesDepartment = (!filters.selected_departments || filters.selected_departments.length === 0) && 
        (!filters.selected_departments_forecast || filters.selected_departments_forecast.length === 0) &&
        (!filters.department || employee.department === filters.department) ||
        (filters.selected_departments && filters.selected_departments.includes(employee.department)) ||
        (filters.selected_departments_forecast && filters.selected_departments_forecast.includes(employee.department))
      // Support both old single-value and new multi-select role filters (utilization and forecast views)
      const matchesRole = (!filters.selected_roles || filters.selected_roles.length === 0) && 
        (!filters.selected_roles_forecast || filters.selected_roles_forecast.length === 0) &&
        (!filters.role || employee.designation === filters.role) ||
        (filters.selected_roles && filters.selected_roles.includes(employee.designation)) ||
        (filters.selected_roles_forecast && filters.selected_roles_forecast.includes(employee.designation))
      const matchesAllocationStatus = !filters.allocation_status || (() => {
        // Get current week for allocation status calculation
        const today = new Date()
        const currentWeekStart = new Date(today)
        currentWeekStart.setDate(today.getDate() - today.getDay()) // Start of current week (Sunday)
        const currentWeekEnd = new Date(currentWeekStart)
        currentWeekEnd.setDate(currentWeekStart.getDate() + 6)
        
        // Check if employee has any allocations in the project_allocations table
        const hasAllocations = weeklyAllocations.some(allocation => 
          allocation && allocation.employee_id === employee.id && allocation.status === 'Active'
        )
        
        switch (filters.allocation_status) {
          case 'Available':
            return !hasAllocations
          case 'Allocated':
            return hasAllocations
          default:
            return true
        }
      })()
      // Support both old single-value and new multi-select project filters (utilization and forecast views)
      const matchesProject = (!filters.selected_projects || filters.selected_projects.length === 0) && 
        (!filters.selected_projects_forecast || filters.selected_projects_forecast.length === 0) &&
        (!filters.project || weeklyAllocations.some(allocation => 
          allocation && allocation.employee_id === employee.id && allocation.project_id === parseInt(filters.project)
        )) ||
        (filters.selected_projects && weeklyAllocations.some(allocation => 
          allocation && allocation.employee_id === employee.id && 
          filters.selected_projects.includes(allocation.project_id)
        )) ||
        (filters.selected_projects_forecast && weeklyAllocations.some(allocation => 
          allocation && allocation.employee_id === employee.id && 
          filters.selected_projects_forecast.includes(allocation.project_id)
        ))
      
      // Project type filter - support both old single-value and new multi-select (utilization and forecast views)
      const matchesProjectType = (!filters.selected_project_types || filters.selected_project_types.length === 0) && 
        (!filters.selected_project_types_forecast || filters.selected_project_types_forecast.length === 0) &&
        (!filters.project_type || weeklyAllocations.some(allocation => {
          if (!allocation || allocation.employee_id !== employee.id) return false
          const project = projects.find(p => p.id === allocation.project_id)
          return project && project.project_type === filters.project_type
        })) ||
        (filters.selected_project_types && weeklyAllocations.some(allocation => {
          if (!allocation || allocation.employee_id !== employee.id) return false
          const project = projects.find(p => p.id === allocation.project_id)
          return project && filters.selected_project_types.includes(project.project_type)
        })) ||
        (filters.selected_project_types_forecast && weeklyAllocations.some(allocation => {
          if (!allocation || allocation.employee_id !== employee.id) return false
          const project = projects.find(p => p.id === allocation.project_id)
          return project && filters.selected_project_types_forecast.includes(project.project_type)
        }))
      
      // Practice filter - multi-select (forecast view)
      const matchesPractice = (!filters.selected_practices_forecast || filters.selected_practices_forecast.length === 0) ||
        (filters.selected_practices_forecast && weeklyAllocations.some(allocation => {
          if (!allocation || allocation.employee_id !== employee.id) return false
          const project = projects.find(p => p.id === allocation.project_id)
          return project && filters.selected_practices_forecast.includes(project.practice)
        }))
      
      return matchesCustomSelection && matchesSearch && matchesDepartment && matchesRole && matchesAllocationStatus && matchesProject && matchesProjectType && matchesPractice
    } catch (error) {
      console.error('Error filtering employee:', employee, error)
      return false
    }
  })

  // Get current week dates (6 weeks starting from current week)
  const getWeekDates = () => {
    const weeks = []
    const today = new Date()
    const currentWeekStart = new Date(today)
    currentWeekStart.setDate(today.getDate() - today.getDay()) // Start of current week (Sunday)
    
    for (let i = 0; i < 6; i++) {
      const weekStart = new Date(currentWeekStart)
      weekStart.setDate(currentWeekStart.getDate() + (i * 7))
      
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekStart.getDate() + 6)
      
      weeks.push({
        start: weekStart,
        end: weekEnd,
        label: `Week ${i + 1}`,
        dateRange: `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}-${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
      })
    }
    return weeks
  }

  // Get allocations for a specific employee and week
  const getEmployeeWeekAllocations = (employeeId, weekStart, weekEnd) => {
    if (!weeklyAllocations || !Array.isArray(weeklyAllocations)) {
      return []
    }
    
    if (!employeeId || !weekStart || !weekEnd) {
      console.warn('Invalid parameters for getEmployeeWeekAllocations:', { employeeId, weekStart, weekEnd })
      return []
    }
    
    const weekAllocations = weeklyAllocations.filter(allocation => {
      if (!allocation || allocation.employee_id !== employeeId) return false
      
      try {
        const allocationStart = new Date(allocation.start_date)
        const allocationEnd = allocation.end_date ? new Date(allocation.end_date) : new Date('2099-12-31')
        
        // Validate dates
        if (isNaN(allocationStart.getTime()) || isNaN(allocationEnd.getTime())) {
          console.warn('Invalid date in allocation:', allocation)
          return false
        }
        
        // Check if allocation overlaps with the week
        return allocationStart <= weekEnd && allocationEnd >= weekStart
      } catch (error) {
        console.error('Error processing allocation date:', error, allocation)
        return false
      }
    })
    
    // Consolidate allocations by project - keep only the latest one for each project
    const consolidatedAllocations = weekAllocations.reduce((acc, allocation) => {
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
    
    return consolidatedAllocations
  }

  // Calculate total allocation for an employee in a specific week
  const getEmployeeWeekTotal = (employeeId, weekStart, weekEnd) => {
    try {
      const weekAllocations = getEmployeeWeekAllocations(employeeId, weekStart, weekEnd)
      
      // weekAllocations are already consolidated by getEmployeeWeekAllocations
      return weekAllocations.reduce((total, allocation) => {
        const percentage = allocation.allocation_percentage || 0
        return total + (typeof percentage === 'number' ? percentage : 0)
      }, 0)
    } catch (error) {
      console.error('Error calculating employee week total:', error, { employeeId, weekStart, weekEnd })
      return 0
    }
  }

  // Group employees by department
  const getEmployeesByDepartment = () => {
    const employeesToUse = filteredEmployees
    if (!employeesToUse || !Array.isArray(employeesToUse)) {
      return {}
    }
    
    const grouped = {}
    employeesToUse.forEach(employee => {
      if (!employee) return
      const dept = employee.department || 'Unassigned'
      if (!grouped[dept]) {
        grouped[dept] = []
      }
      grouped[dept].push(employee)
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

  const handleExportForecast = () => {
    const weeks = getWeekDates()
    const employeesByDept = getEmployeesByDepartment()
    
    // Create CSV data with detailed project information
    let csvContent = "Employee Name,Department,Designation,Week,Project Name,Allocation %\n"
    
    Object.entries(employeesByDept).forEach(([department, deptEmployees]) => {
      deptEmployees.forEach(employee => {
        weeks.forEach(week => {
          const weekAllocations = getEmployeeWeekAllocations(employee.id, week.start, week.end)
          
          if (weekAllocations.length > 0) {
            // Export each project allocation as a separate row
            weekAllocations.forEach(allocation => {
              const project = projects.find(p => p.id === allocation.project_id)
              const projectName = project ? project.name : 'Unknown Project'
              const employeeName = employee.name || `${employee.first_name || ''} ${employee.last_name || ''}`.trim()
              
              csvContent += `"${employeeName}","${employee.department}","${employee.designation}","${week.label}","${projectName}","${allocation.allocation_percentage}%"\n`
            })
          } else {
            // If no allocations, show as unallocated
            const employeeName = employee.name || `${employee.first_name || ''} ${employee.last_name || ''}`.trim()
            csvContent += `"${employeeName}","${employee.department}","${employee.designation}","${week.label}","Unallocated","0%"\n`
          }
        })
      })
    })
    
    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `forecast-${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // COMMENTED OUT: Handle saving allocations to the database - Making forecast view-only
  /* const handleSaveAllocations = async (allocationData) => {
    const token = getCookie(TOKEN)
    if (!token) {
      console.error('Authentication token not found')
      return
    }

    try {
      const promises = []

      // Handle added allocations
      if (allocationData.added && allocationData.added.length > 0) {
        console.log('Saving added allocations:', allocationData.added)
        const addPromises = allocationData.added.map(async (allocation) => {
          const allocationPayload = {
            employee_id: allocation.employee_id,
            project_id: allocation.project_id,
            role: allocation.role,
            allocation_percentage: allocation.allocation_percentage,
            start_date: allocation.start_date,
            end_date: allocation.end_date,
            status: 'Active',
            billable: true
          }
          
          console.log('Sending allocation payload:', allocationPayload)

          const response = await fetch(`${getApiBaseUrl()}/api/allocations`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(allocationPayload)
          })

          if (!response.ok) {
            const errorData = await response.json()
            console.error('Failed to save allocation:', errorData)
            console.error('Allocation payload:', allocationPayload)
            throw new Error(errorData.error || 'Failed to save allocation')
          }

          return await response.json()
        })
        promises.push(...addPromises)
      }

      // Handle updated allocations
      if (allocationData.updated && allocationData.updated.length > 0) {
        console.log('Saving updated allocations:', allocationData.updated)
        const updatePromises = allocationData.updated.map(async (allocation) => {
          const allocationPayload = {
            employee_id: allocation.employee_id,
            project_id: allocation.project_id,
            role: allocation.role,
            allocation_percentage: allocation.allocation_percentage,
            start_date: allocation.start_date,
            end_date: allocation.end_date,
            status: 'Active',
            billable: true
          }
          
          console.log('Updating allocation payload:', allocationPayload)

          const response = await fetch(`${getApiBaseUrl()}/api/allocations/${allocation.id}`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(allocationPayload)
          })

          if (!response.ok) {
            const errorData = await response.json()
            console.error('Failed to update allocation:', errorData)
            console.error('Update payload:', allocationPayload)
            throw new Error(errorData.error || 'Failed to update allocation')
          }

          return await response.json()
        })
        promises.push(...updatePromises)
      }

      // Handle removed allocations
      if (allocationData.removed && allocationData.removed.length > 0) {
        const removePromises = allocationData.removed.map(async (allocation) => {
          // Only delete if it has a real ID (not a temporary one)
          if (allocation.id && allocation.id < 1000000000000) {
            const response = await fetch(`${getApiBaseUrl()}/api/allocations/${allocation.id}`, {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            })

            if (!response.ok) {
              const errorData = await response.json()
              console.error('Failed to delete allocation:', errorData)
              console.error('Allocation ID:', allocation.id)
              throw new Error(errorData.error || 'Failed to delete allocation')
            }

            return await response.json()
          }
        })
        promises.push(...removePromises)
      }

      // Wait for all operations to complete
      await Promise.all(promises)
      
      // Refresh the data after saving
      if (fetchProjects) {
        await fetchProjects()
      }
      
      console.log('Allocations saved successfully')
      
      // Show success message
      alert('Allocations saved successfully!')
      
    } catch (error) {
      console.error('Error saving allocations:', error)
      alert('Error saving allocations: ' + error.message)
    }
  } */

  if (forecastLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner message="Loading forecast data..." size="medium" />
      </div>
    )
  }

  // Show a more helpful message when allocation data is missing
  if (forecastError && employees.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6 m-6">
        <div className="text-center">
          <svg className="mx-auto h-12 w-12 text-green-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <h3 className="text-lg font-medium text-green-900 mb-2">Forecast Data Unavailable</h3>
          <p className="text-green-800 mb-4">{forecastError}</p>
          <p className="text-sm text-green-700 mb-4">
            This usually happens when the allocation service is temporarily unavailable. 
            You can still use the Projects tab normally.
          </p>
          <button 
            onClick={() => fetchProjects && fetchProjects()}
            className="bg-green-700 text-white px-4 py-2 rounded-lg hover:bg-green-800 transition-colors"
          >
            Retry Loading
          </button>
        </div>
      </div>
    )
  }

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
              Select specific employees to display in the forecast view
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
    <>
      {/* Custom Selection Modal */}
      <CustomSelectionModal />

      {/* View-specific Header */}
      <div className="px-6 py-4 border-b border-slate-200">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Employee Weekly Allocation</h2>
            <p className="text-sm text-slate-600 mt-1">
              {weeklyAllocations.length === 0 && forecastError 
                ? "⚠️ Allocation data unavailable - showing employees only" 
                : "Primary Allocation Interface - Click on any cell to modify allocations"
              }
            </p>
          </div>
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
            {weeklyAllocations.length > 0 && (
              <button 
                onClick={handleExportForecast}
                className="bg-green-700 text-white px-4 py-2 text-sm font-medium rounded-lg hover:bg-green-800"
              >
                Export Forecast
              </button>
            )}
            {weeklyAllocations.length === 0 && forecastError && (
              <button 
                onClick={() => fetchProjects && fetchProjects()}
                className="bg-orange-600 text-white px-4 py-2 text-sm font-medium rounded-lg hover:bg-orange-700"
              >
                Retry Allocation Data
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 6-Week Forecast View */}
      <WeeklyAllocationTable
        employees={filteredEmployees}
        weeklyAllocations={weeklyAllocations}
        projects={projects}
        getWeekDates={getWeekDates}
        getEmployeeWeekAllocations={getEmployeeWeekAllocations}
        getEmployeeWeekTotal={getEmployeeWeekTotal}
        getEmployeesByDepartment={getEmployeesByDepartment}
        onEditAllocation={setEditingAllocation} // Set the viewing allocation state
        expandedDepartments={expandedDepartments}
        toggleDepartmentExpansion={toggleDepartmentExpansion}
      />

      {/* View-Only Allocation Modal */}
      {editingAllocation && (
        <AllocationViewModal
          editingAllocation={editingAllocation}
          onClose={() => setEditingAllocation(null)}
          projects={projects}
        />
      )}
    </>
  )
})

// Weekly Allocation Table Component
const WeeklyAllocationTable = ({ 
  employees, 
  weeklyAllocations, 
  projects, 
  getWeekDates, 
  getEmployeeWeekAllocations, 
  getEmployeeWeekTotal, 
  getEmployeesByDepartment,
  onEditAllocation,
  expandedDepartments,
  toggleDepartmentExpansion
}) => {
  const weeks = getWeekDates()
  const employeesByDept = getEmployeesByDepartment()

  // Add safety checks
  if (!employees || employees.length === 0) {
    return (
      <div className="p-8 text-center">
        <h3 className="text-lg font-medium text-slate-900 mb-2">No Employees Found</h3>
        <p className="text-slate-500">No employees are available for allocation.</p>
      </div>
    )
  }

  if (!weeklyAllocations || !Array.isArray(weeklyAllocations)) {
    return (
      <div className="p-8 text-center">
        <h3 className="text-lg font-medium text-slate-900 mb-2">Loading Allocations</h3>
        <p className="text-slate-500">Please wait while we load allocation data...</p>
      </div>
    )
  }

  const handleCellClick = (employeeId, weekStart, weekEnd) => {
    // View-only: Display allocations without edit capabilities
    const allocations = getEmployeeWeekAllocations(employeeId, weekStart, weekEnd)
    const employee = employees.find(emp => emp.id === employeeId)
    const week = weeks.find(w => w.start.getTime() === weekStart.getTime())
    
    // Set the viewing allocation data (no edit capabilities)
    onEditAllocation({
      employeeId,
      employee,
      week,
      allocations,
      weekStart,
      weekEnd,
      isViewOnly: true // Flag to indicate this is view-only
    })
  }

  const getProjectName = (projectId) => {
    const project = projects.find(p => p.id === projectId)
    return project ? project.name : 'Unknown Project'
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider border-r border-slate-200">
              Employee
            </th>
            {weeks.map((week, index) => (
              <th key={index} className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider border-r border-slate-200">
                <div>{week.label}</div>
                <div className="text-xs text-slate-400 mt-1">{week.dateRange}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-slate-200">
          {Object.keys(employeesByDept).length === 0 ? (
            <tr>
              <td colSpan={weeks.length + 1} className="px-6 py-8 text-center text-slate-500">
                No employees found. Please check if employees are properly loaded.
              </td>
            </tr>
          ) : (
            Object.entries(employeesByDept).map(([department, deptEmployees]) => (
            <React.Fragment key={department}>
              {/* Department Header Row */}
              <tr className="bg-slate-100 cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => toggleDepartmentExpansion(department)}>
                <td colSpan={weeks.length + 1} className="px-6 py-3 text-sm font-semibold text-slate-900 uppercase tracking-wider">
                  <div className="flex items-center justify-between">
                    <span>{department} ({deptEmployees.length} employees)</span>
                    <svg 
                      className={`w-4 h-4 transition-transform duration-200 ${expandedDepartments.has(department) ? 'rotate-180' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
                    </svg>
                  </div>
                </td>
              </tr>
              {/* Employee Rows */}
              {expandedDepartments.has(department) && deptEmployees.map((employee) => (
                <tr key={employee.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 whitespace-nowrap border-r border-slate-200">
                    <div>
                      <div className="text-sm font-medium text-green-700">{`${employee.first_name || ''} ${employee.last_name || ''}`.trim()}</div>
                      <div className="text-sm text-slate-500">{employee.designation}</div>
                    </div>
                  </td>
                  {weeks.map((week, weekIndex) => {
                    const weekAllocations = getEmployeeWeekAllocations(employee.id, week.start, week.end)
                    const weekTotal = getEmployeeWeekTotal(employee.id, week.start, week.end)
                    
                    return (
                      <td key={weekIndex} className="px-4 py-4 border-r border-slate-200">
                        <div 
                          className="min-h-[80px] cursor-pointer hover:bg-green-50 rounded-lg p-2 transition-colors"
                          onClick={() => handleCellClick(employee.id, week.start, week.end)}
                        >
                          {/* Project Cards */}
                          <div className="space-y-1 mb-2">
                            {weekAllocations.slice(0, 3).map((allocation, index) => (
                              <div 
                                key={allocation.id} 
                                className={`text-xs p-1 rounded border ${
                                  index % 2 === 0 ? 'bg-green-100 border-green-200' : 'bg-yellow-100 border-yellow-200'
                                }`}
                              >
                                <div className="font-medium truncate">{getProjectName(allocation.project_id)}</div>
                                <div className="text-slate-600">{allocation.allocation_percentage}%</div>
                              </div>
                            ))}
                            {weekAllocations.length > 3 && (
                              <div className="text-xs text-slate-500 text-center">
                                +{weekAllocations.length - 3} more
                              </div>
                            )}
                          </div>
                          
                          {/* Total */}
                          <div className="text-xs font-medium text-center pt-1">
                            {weekTotal === 0 ? 'No allocation' : `Total: ${weekTotal}%`}
                          </div>
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </React.Fragment>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

// View-Only Allocation Modal Component
const AllocationViewModal = ({ 
  editingAllocation, 
  onClose, 
  projects
}) => {
  const getProjectName = (projectId) => {
    const project = projects.find(p => p.id === projectId)
    return project ? project.name : 'Unknown Project'
  }

  const getTotalAllocation = () => {
    const allocations = editingAllocation.allocations || []
    return allocations.reduce((total, alloc) => total + (alloc.allocation_percentage || 0), 0)
  }

  if (!editingAllocation) return null

  const allocations = editingAllocation.allocations || []

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">
              View Allocations - {editingAllocation.employee?.first_name} {editingAllocation.employee?.last_name}
            </h3>
            <p className="text-slate-600 mt-1">
              Week: {editingAllocation.week?.label} ({editingAllocation.week?.dateRange})
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Current Allocations */}
        <div className="mb-6">
          <h4 className="text-lg font-medium text-slate-900 mb-4">Current Allocations</h4>
          {allocations.length > 0 ? (
            <div className="space-y-3">
              {allocations.map((allocation, index) => (
                <div key={allocation.id} className="bg-slate-50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-slate-900">{getProjectName(allocation.project_id)}</div>
                      <div className="text-sm text-slate-600">
                        {allocation.role} • {allocation.allocation_percentage}% • 
                        {allocation.start_date} to {allocation.end_date}
                      </div>
                    </div>
                    <div className="text-sm text-slate-500">
                      {allocation.allocation_percentage}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <div className="text-lg font-medium mb-2">No allocations for this week</div>
              <div className="text-sm">This employee has no project allocations for the selected week.</div>
            </div>
          )}
          
          {/* Total Allocation */}
          <div className="mt-4 p-4 bg-green-50 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="font-medium text-slate-900">Total Allocation:</span>
              <span className={`text-lg font-bold ${
                getTotalAllocation() > 100 ? 'text-red-600' : 
                getTotalAllocation() === 100 ? 'text-green-600' : 'text-green-700'
              }`}>
                {getTotalAllocation()}%
              </span>
            </div>
            {getTotalAllocation() > 100 && (
              <p className="text-sm text-red-600 mt-2">⚠️ Employee is over-allocated</p>
            )}
            {getTotalAllocation() === 0 && (
              <p className="text-sm text-slate-600 mt-2">Employee is available for new assignments</p>
            )}
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// COMMENTED OUT: Allocation Edit Modal Component - Making forecast view-only
/*
const AllocationEditModal = ({ 
  editingAllocation, 
  onClose, 
  projects, 
  employees, 
  weeklyAllocations, 
  onSave 
}) => {
  const [allocations, setAllocations] = useState([])
  const [originalAllocations, setOriginalAllocations] = useState([])
  const [isSaving, setIsSaving] = useState(false)
  const [newAllocation, setNewAllocation] = useState({
    project_id: '',
    allocation_percentage: 0,
    role: '',
    start_date: '',
    end_date: ''
  })
  const [duplicateError, setDuplicateError] = useState('')

  // Initialize allocations when modal opens
  useEffect(() => {
    if (editingAllocation) {
      console.log('Modal opened with editingAllocation:', editingAllocation)
      const initialAllocations = editingAllocation.allocations || []
      setAllocations(initialAllocations)
      setOriginalAllocations(initialAllocations)
      
      // Set default dates for new allocation
      const weekStart = editingAllocation.weekStart
      const weekEnd = editingAllocation.weekEnd
      console.log('Week dates:', { weekStart, weekEnd })
      setNewAllocation(prev => ({
        ...prev,
        start_date: weekStart ? weekStart.toISOString().split('T')[0] : '',
        end_date: weekEnd ? weekEnd.toISOString().split('T')[0] : ''
      }))
    }
  }, [editingAllocation])

  const handleAddAllocation = () => {
    if (newAllocation.project_id && newAllocation.allocation_percentage > 0) {
      const projectId = parseInt(newAllocation.project_id)
      
      // Check if project is already assigned to this employee
      const isDuplicate = allocations.some(alloc => alloc.project_id === projectId)
      
      if (isDuplicate) {
        const project = projects.find(p => p.id === projectId)
        setDuplicateError(`Project "${project ? project.name : 'Unknown Project'}" is already assigned to this employee.`)
        return
      }
      
      // Clear any previous error
      setDuplicateError('')
      
      const project = projects.find(p => p.id === projectId)
      const startDate = newAllocation.start_date || (editingAllocation.weekStart ? editingAllocation.weekStart.toISOString().split('T')[0] : '')
      const endDate = newAllocation.end_date || (editingAllocation.weekEnd ? editingAllocation.weekEnd.toISOString().split('T')[0] : '')
      
      console.log('Adding allocation with dates:', { startDate, endDate, weekStart: editingAllocation.weekStart, weekEnd: editingAllocation.weekEnd })
      
      const newAlloc = {
        id: Date.now(), // Temporary ID
        project_id: projectId,
        project_name: project ? project.name : 'Unknown Project',
        allocation_percentage: parseInt(newAllocation.allocation_percentage),
        role: newAllocation.role || 'Team Member',
        start_date: startDate,
        end_date: endDate,
        employee_id: editingAllocation.employeeId
      }
      
      setAllocations(prev => [...prev, newAlloc])
      setNewAllocation({
        project_id: '',
        allocation_percentage: 0,
        role: '',
        start_date: editingAllocation.weekStart ? editingAllocation.weekStart.toISOString().split('T')[0] : '',
        end_date: editingAllocation.weekEnd ? editingAllocation.weekEnd.toISOString().split('T')[0] : ''
      })
    }
  }

  const handleRemoveAllocation = (allocationId) => {
    setAllocations(prev => prev.filter(alloc => alloc.id !== allocationId))
  }

  const handleProjectChange = (projectId) => {
    setNewAllocation({...newAllocation, project_id: projectId})
    // Clear duplicate error when user changes project selection
    if (duplicateError) {
      setDuplicateError('')
    }
  }

  const handleUpdateAllocation = (allocationId, updatedAllocation) => {
    setAllocations(prev => prev.map(alloc => 
      alloc.id === allocationId ? { ...alloc, ...updatedAllocation } : alloc
    ))
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      // Determine which allocations were added, removed, and updated
      const addedAllocations = allocations.filter(alloc => 
        !originalAllocations.some(orig => orig.id === alloc.id)
      )
      const removedAllocations = originalAllocations.filter(orig => 
        !allocations.some(alloc => alloc.id === orig.id)
      )
      const updatedAllocations = allocations.filter(alloc => {
        const original = originalAllocations.find(orig => orig.id === alloc.id)
        return original && (
          original.project_id !== alloc.project_id ||
          original.allocation_percentage !== alloc.allocation_percentage ||
          original.role !== alloc.role ||
          original.start_date !== alloc.start_date ||
          original.end_date !== alloc.end_date
        )
      })
      const unchangedAllocations = allocations.filter(alloc => {
        const original = originalAllocations.find(orig => orig.id === alloc.id)
        return original && (
          original.project_id === alloc.project_id &&
          original.allocation_percentage === alloc.allocation_percentage &&
          original.role === alloc.role &&
          original.start_date === alloc.start_date &&
          original.end_date === alloc.end_date
        )
      })

      await onSave({
        added: addedAllocations,
        removed: removedAllocations,
        updated: updatedAllocations,
        unchanged: unchangedAllocations,
        all: allocations
      })
    } finally {
      setIsSaving(false)
    }
  }

  const getTotalAllocation = () => {
    return allocations.reduce((total, alloc) => total + (alloc.allocation_percentage || 0), 0)
  }

  const getProjectName = (projectId) => {
    const project = projects.find(p => p.id === projectId)
    return project ? project.name : 'Unknown Project'
  }

  if (!editingAllocation) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">
              Edit Allocations - {editingAllocation.employee?.first_name} {editingAllocation.employee?.last_name}
            </h3>
            <p className="text-slate-600 mt-1">
              Week: {editingAllocation.week?.label} ({editingAllocation.week?.dateRange})
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="mb-6">
          <h4 className="text-lg font-medium text-slate-900 mb-4">Current Allocations</h4>
          {allocations.length > 0 ? (
            <div className="space-y-3">
              {allocations.map((allocation, index) => (
                <AllocationEditCard
                  key={allocation.id}
                  allocation={allocation}
                  index={index}
                  projects={projects}
                  onUpdate={(updatedAllocation) => handleUpdateAllocation(allocation.id, updatedAllocation)}
                  onRemove={() => handleRemoveAllocation(allocation.id)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              No allocations for this week
            </div>
          )}
          
          <div className="mt-4 p-4 bg-green-50 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="font-medium text-slate-900">Total Allocation:</span>
              <span className={`text-lg font-bold ${
                getTotalAllocation() > 100 ? 'text-red-600' : 
                getTotalAllocation() === 100 ? 'text-green-600' : 'text-green-700'
              }`}>
                {getTotalAllocation()}%
              </span>
            </div>
            {getTotalAllocation() > 100 && (
              <p className="text-sm text-red-600 mt-2">⚠️ Employee is over-allocated</p>
            )}
          </div>
        </div>

        <div className="mb-6">
          <h4 className="text-lg font-medium text-slate-900 mb-4">Add New Allocation</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Project</label>
              <select
                value={newAllocation.project_id}
                onChange={(e) => handleProjectChange(e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                  duplicateError 
                    ? 'border-red-300 focus:ring-red-500' 
                    : 'border-slate-300 focus:ring-green-500'
                }`}
              >
                <option value="">Select Project</option>
                {projects.map(project => {
                  const isAlreadyAssigned = allocations.some(alloc => alloc.project_id === project.id)
                  return (
                    <option 
                      key={project.id} 
                      value={project.id}
                      disabled={isAlreadyAssigned}
                    >
                      {project.name}{isAlreadyAssigned ? ' (Already Assigned)' : ''}
                    </option>
                  )
                })}
              </select>
              {duplicateError && (
                <p className="text-red-600 text-sm mt-1 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  {duplicateError}
                </p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Allocation %</label>
              <input
                type="number"
                min="1"
                max="100"
                value={newAllocation.allocation_percentage}
                onChange={(e) => setNewAllocation({...newAllocation, allocation_percentage: parseInt(e.target.value) || 0})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
              <input
                type="text"
                value={newAllocation.role}
                onChange={(e) => setNewAllocation({...newAllocation, role: e.target.value})}
                placeholder="e.g., Developer, Designer"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            
            <div className="flex items-end">
              <button
                onClick={handleAddAllocation}
                disabled={!newAllocation.project_id || newAllocation.allocation_percentage <= 0 || duplicateError}
                className="w-full bg-green-700 text-white px-4 py-2 rounded-lg hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Add Allocation
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:text-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isSaving && (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {isSaving ? 'Saving...' : 'Save Allocations'}
          </button>
        </div>
      </div>
    </div>
  )
}
*/

// COMMENTED OUT: AllocationEditCard Component - Making forecast view-only
/*
const AllocationEditCard = ({ allocation, index, projects, onUpdate, onRemove }) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState({
    project_id: allocation.project_id,
    allocation_percentage: allocation.allocation_percentage,
    role: allocation.role,
    start_date: allocation.start_date,
    end_date: allocation.end_date
  })

  const handleSave = () => {
    onUpdate(editData)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditData({
      project_id: allocation.project_id,
      allocation_percentage: allocation.allocation_percentage,
      role: allocation.role,
      start_date: allocation.start_date,
      end_date: allocation.end_date
    })
    setIsEditing(false)
  }

  const getProjectName = (projectId) => {
    const project = projects.find(p => p.id === projectId)
    return project ? project.name : 'Unknown Project'
  }

  return (
    <div className="bg-slate-50 rounded-lg p-4">
      {isEditing ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Project</label>
              <select
                value={editData.project_id}
                onChange={(e) => setEditData({...editData, project_id: parseInt(e.target.value)})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {projects.map(project => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Allocation %</label>
              <input
                type="number"
                min="1"
                max="100"
                value={editData.allocation_percentage}
                onChange={(e) => setEditData({...editData, allocation_percentage: parseInt(e.target.value) || 0})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
              <input
                type="text"
                value={editData.role}
                onChange={(e) => setEditData({...editData, role: e.target.value})}
                placeholder="e.g., Developer, Designer"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
              <input
                type="date"
                value={editData.start_date}
                onChange={(e) => setEditData({...editData, start_date: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
              <input
                type="date"
                value={editData.end_date}
                onChange={(e) => setEditData({...editData, end_date: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
          
          <div className="flex justify-end space-x-2">
            <button
              onClick={handleCancel}
              className="px-3 py-1 text-sm text-slate-600 hover:text-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-3 py-1 text-sm bg-green-700 text-white rounded-lg hover:bg-green-800 transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="font-medium text-slate-900">{getProjectName(allocation.project_id)}</div>
            <div className="text-sm text-slate-600">
              {allocation.role} • {allocation.allocation_percentage}% • 
              {allocation.start_date} to {allocation.end_date}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsEditing(true)}
              className="text-green-700 hover:text-green-800 transition-colors"
              title="Edit allocation"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
              </svg>
            </button>
            <button
              onClick={onRemove}
              className="text-red-600 hover:text-red-800 transition-colors"
              title="Remove allocation"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
*/

SixWeekForecastTab.displayName = 'SixWeekForecastTab'

export default SixWeekForecastTab
