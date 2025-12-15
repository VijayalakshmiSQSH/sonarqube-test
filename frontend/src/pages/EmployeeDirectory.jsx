import React, { useState, useMemo, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useEmployees } from '../context/EmployeeContext.jsx'
import { usePermissions } from '../context/PermissionContext.jsx'
import Header from '../components/Header.jsx'
import BulkImport from '../components/BulkImport.jsx'
import AIFilterChatbot from '../components/AIFilterChatbot.jsx'
import { getCookie } from '../utils/helpers.js'
import { TOKEN, getApiBaseUrl } from '../utils/constants.js'

// Custom scrollbar styles for MultiSelect dropdowns
const scrollbarStyles = `
  .scrollbar-thin {
    scrollbar-width: thin;
  }
  
  .scrollbar-thin::-webkit-scrollbar {
    width: 6px;
  }
  
  .scrollbar-thin::-webkit-scrollbar-track {
    background: #f1f5f9;
  }
  
  .scrollbar-thin::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 3px;
  }
  
  .scrollbar-thin::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
  }
`

// Multi-Select Component
const MultiSelect = ({
  label,
  options,
  selectedValues,
  onSelectionChange,
  placeholder = "Select options...",
  searchPlaceholder = "Filter options...",
  getEmployeeCount = null
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const dropdownRef = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
        setSearchTerm('')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Filter options based on search term
  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Handle option selection
  const handleOptionToggle = (value) => {
    const currentValues = selectedValues || []
    const newSelection = currentValues.includes(value)
      ? currentValues.filter(v => v !== value)
      : [...currentValues, value]
    
    // Ensure no duplicates
    const uniqueSelection = [...new Set(newSelection)]
    onSelectionChange(uniqueSelection)
  }

  // Handle select all
  const handleSelectAll = () => {
    const currentValues = selectedValues || []
    const filteredValues = filteredOptions.map(opt => opt.value)
    const allFilteredSelected = filteredValues.every(value => currentValues.includes(value))
    
    if (allFilteredSelected) {
      // Deselect all filtered options
      onSelectionChange(currentValues.filter(v => !filteredValues.includes(v)))
    } else {
      // Select all filtered options
      const newSelection = [...new Set([...currentValues, ...filteredValues])]
      onSelectionChange(newSelection)
    }
  }

  // Get display text for selected values
  const getDisplayText = () => {
    const currentValues = selectedValues || []
    if (currentValues.length === 0) return placeholder
    if (currentValues.length === 1) {
      const option = options.find(opt => opt.value === currentValues[0])
      if (!option) return placeholder
      
      // If we have employee count function, show count
      if (getEmployeeCount) {
        const count = getEmployeeCount(option.value)
        return `${option.label} (${count})`
      }
      return option.label
    }
    return `${currentValues.length} selected`
  }

  // Check if all filtered options are selected
  const currentValues = selectedValues || []
  const allFilteredSelected = filteredOptions.length > 0 && 
    filteredOptions.every(opt => currentValues.includes(opt.value))

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-medium text-slate-700 mb-2">{label}</label>
      
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800 focus:border-green-800 bg-white text-left flex items-center justify-between"
      >
        <span className="text-slate-900">
          {getDisplayText()}
        </span>
        <svg 
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
        </svg>
      </button>

      {/* Selected Tags */}
      {currentValues.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {currentValues.map((value, index) => {
            const option = options.find(opt => opt.value === value)
            if (!option) return null
            
            // Get employee count if function is provided
            const employeeCount = getEmployeeCount ? getEmployeeCount(value) : null
            const displayText = employeeCount !== null ? `${option.label} (${employeeCount})` : option.label
            
            return (
              <span
                key={typeof value === 'object' && value !== null 
                  ? `${option.label}-${index}` 
                  : value}
                className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-md"
              >
                {displayText}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleOptionToggle(value)
                  }}
                  className="text-blue-600 hover:text-blue-800"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </span>
            )
          })}
        </div>
      )}

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-66 overflow-hidden">
          {/* Search Input */}
          <div className="p-3 border-b border-slate-200">
            <div className="relative">
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 pl-8 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-800 focus:border-green-800 text-sm"
                onClick={(e) => e.stopPropagation()}
              />
              <svg className="absolute left-2 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-2.5 w-4 h-4 text-gray-400 hover:text-gray-600"
                >
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Select All Option */}
          {filteredOptions.length > 0 && (
            <div className="p-2 border-b border-slate-200">
              <label className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 rounded cursor-pointer">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={handleSelectAll}
                  className="rounded border-gray-300 text-blue-600 focus:ring-green-800"
                />
                <span className="text-sm font-medium text-slate-900">
                  {allFilteredSelected ? 'Deselect All' : 'Select All'}
                </span>
              </label>
            </div>
          )}

          {/* Options List */}
          <div className="max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 hover:scrollbar-thumb-gray-400">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">No options found</div>
            ) : (
              filteredOptions.map((option, index) => (
                <label
                  key={typeof option.value === 'object' && option.value !== null 
                    ? `${option.label}-${index}` 
                    : option.value}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={currentValues.includes(option.value)}
                    onChange={() => handleOptionToggle(option.value)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-green-800"
                  />
                  <span className="text-sm text-slate-900">{option.label}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const EmployeeDirectory = ({
  embedded = false,
  projects = [],
  weeklyAllocations = [],
  allocationLoading = false,
  allocationError = null
}) => {
  const { searchEmployees, getAllEmployees, loading, deleteEmployee, updateEmployee, refreshEmployees } = useEmployees()
  const { hasPermission, loading: permissionsLoading } = usePermissions()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchTerm, setSearchTerm] = useState('')
  const [filters, setFilters] = useState({
    parentDepartment: [],
    department: [],
    location: [],
    role: [],
    project: [],
    status: ['Active'],
    experience: [],
    skills: [],
    rates: []
  })
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' })
  const [showFilters, setShowFilters] = useState(false)
  const [showAIFilter, setShowAIFilter] = useState(false)
  const [aiFilteredEmployees, setAiFilteredEmployees] = useState(null)
  const [aiFilterLoading, setAiFilterLoading] = useState(false)
  const [showBulkImportModal, setShowBulkImportModal] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [showEmployeeModal, setShowEmployeeModal] = useState(false)
  const [deletingEmployee, setDeletingEmployee] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editFormData, setEditFormData] = useState({})
  const [successMessage, setSuccessMessage] = useState('')
  const [expandedRows, setExpandedRows] = useState(new Set())
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [employeeToDelete, setEmployeeToDelete] = useState(null)

  // Context menu state
  const [showContextMenu, setShowContextMenu] = useState(false)
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 })
  const [contextMenuEmployee, setContextMenuEmployee] = useState(null)

  const allEmployees = getAllEmployees()

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

  // Calculate average utilization for all employees using AllocationAnalysis formula
  const calculateAverageUtilization = () => {
    if (!allEmployees || allEmployees.length === 0 || !weeklyAllocations || weeklyAllocations.length === 0) {
      return 0
    }

    const weekRange = getCurrentWeekRange()

    // Check if allocation overlaps with current week
    const isAllocationInCurrentWeek = (allocation) => {
      if (!allocation.start_date || !allocation.end_date) return false

      const allocationStart = new Date(allocation.start_date)
      const allocationEnd = new Date(allocation.end_date)

      return allocationStart <= weekRange.end && allocationEnd >= weekRange.start
    }

    // Group allocations by employee (matching AllocationAnalysis approach)
    const employeeAllocations = {}
    weeklyAllocations.forEach(allocation => {
      if (allocation.status === 'Active' && isAllocationInCurrentWeek(allocation)) {
        if (!employeeAllocations[allocation.employee_id]) {
          employeeAllocations[allocation.employee_id] = []
        }
        employeeAllocations[allocation.employee_id].push(allocation)
      }
    })

    let totalAllocationPercentage = 0
    let employeesWithAllocations = 0

    // Process each employee (matching AllocationAnalysis approach)
    allEmployees.forEach(employee => {
      const allocations = employeeAllocations[employee.id] || []

      if (allocations.length > 0) {
        employeesWithAllocations++

        // Calculate total allocation for this employee
        const totalAllocation = allocations.reduce((sum, alloc) => {
          return sum + (alloc.allocation_percentage || 0)
        }, 0)

        totalAllocationPercentage += totalAllocation
      }
    })

    // Overall Utilization = Sum of all employee allocation percentages ÷ Total employees
    return allEmployees.length > 0 ? (totalAllocationPercentage / allEmployees.length) : 0
  }

  // Check if allocation overlaps with current week
  const isAllocationInCurrentWeek = (allocation) => {
    if (!allocation.start_date || !allocation.end_date) return false

    const weekRange = getCurrentWeekRange()
    const allocationStart = new Date(allocation.start_date)
    const allocationEnd = new Date(allocation.end_date)

    return allocationStart <= weekRange.end && allocationEnd >= weekRange.start
  }

  // Get current week projects for an employee
  const getEmployeeCurrentProjects = (employeeId) => {
    if (!weeklyAllocations || !Array.isArray(weeklyAllocations)) return []

    const employeeAllocations = weeklyAllocations.filter(
      alloc => alloc.employee_id === employeeId &&
        alloc.status === 'Active' &&
        isAllocationInCurrentWeek(alloc)
    )

    // Get unique projects with their allocation percentages
    const projectMap = new Map()
    employeeAllocations.forEach(allocation => {
      const projectId = allocation.project_id
      const project = projects.find(p => p.id === projectId)
      if (project) {
        if (projectMap.has(projectId)) {
          // Add to existing allocation percentage
          projectMap.get(projectId).allocation_percentage += allocation.allocation_percentage || 0
        } else {
          projectMap.set(projectId, {
            ...project,
            allocation_percentage: allocation.allocation_percentage || 0
          })
        }
      }
    })

    return Array.from(projectMap.values())
  }

  // Handle navigation state messages
  useEffect(() => {
    if (location.state?.message) {
      setSuccessMessage(location.state.message)

      // Refresh employee data when returning from edit page
      if (refreshEmployees) {
        refreshEmployees()
      }

      // Clear the message after 5 seconds
      const timer = setTimeout(() => {
        setSuccessMessage('')
      }, 5000)

      // Clear the location state to prevent message from showing again on refresh
      navigate(location.pathname, { replace: true, state: {} })

      return () => clearTimeout(timer)
    }
  }, [location.state, navigate, location.pathname, refreshEmployees])

  // Auto-hide success message
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage('')
      }, 5000)

      return () => clearTimeout(timer)
    }
  }, [successMessage])

  // Add click outside listener for context menu
  useEffect(() => {
    if (showContextMenu) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [showContextMenu])

  // Get unique values for filter dropdowns
  const uniqueParentDepartments = [...new Set(allEmployees.map(emp => emp.parent_department).filter(Boolean))]
  
  // Get departments based on selected parent departments (cascading filter)
  const getFilteredDepartments = useMemo(() => {
    if (filters.parentDepartment.length === 0) {
      // If no parent department selected, show all departments
      return [...new Set(allEmployees.map(emp => emp.department).filter(Boolean))]
    } else {
      // Only show departments that belong to selected parent departments
      return [...new Set(allEmployees
        .filter(emp => 
          emp.parent_department && 
          filters.parentDepartment.includes(emp.parent_department) &&
          emp.department
        )
        .map(emp => emp.department)
        .filter(Boolean)
      )]
    }
  }, [allEmployees, filters.parentDepartment])
  
  // Get designations/roles based on selected departments (cascading filter)
  const getFilteredRoles = useMemo(() => {
    if (filters.department.length === 0) {
      // If no department selected, show all designations
      return [...new Set(allEmployees
        .map(emp => emp.designation || emp.title)
        .filter(Boolean)
      )]
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
      )]
    }
  }, [allEmployees, filters.department])
  
  const uniqueLocations = [...new Set(allEmployees.map(emp => emp.city || emp.location).filter(Boolean))]

  // Count active filters (excluding status when it's set to default 'Active')
  const activeFiltersCount = Object.entries(filters).filter(([key, value]) => {
    if (key === 'status') return Array.isArray(value) && value.length > 0 && !(value.length === 1 && value.includes('Active'))
    return Array.isArray(value) ? value.length > 0 : value !== ''
  }).length

  // Filter and sort employees
  const filteredAndSortedEmployees = useMemo(() => {
    try {
      // If AI filter is loading, return empty array to show loader
      if (aiFilterLoading) {
        return []
      }


      console.log("aiFilteredEmployees", aiFilteredEmployees)
      // Use AI filtered employees if available, otherwise use regular filtering.
      let filtered = aiFilteredEmployees || searchEmployees(searchTerm, filters) || []

      // Apply search term to AI filtered employees if search term exists
      if (aiFilteredEmployees && searchTerm && searchTerm.trim()) {
        const searchLower = searchTerm.toLowerCase().trim()
        filtered = filtered.filter(emp => {
          try {
            // Handle both mock data field names and backend field names
            const firstName = (emp.first_name || emp.firstName || '').toString()
            const lastName = (emp.last_name || emp.lastName || '').toString()
            const email = (emp.email || '').toString()
            const employeeId = (emp.employee_id || emp.employeeId || emp.id || '').toString()
            const parentDepartment = (emp.parent_department || '').toString()
            const department = (emp.department || '').toString()
            const designation = (emp.designation || emp.title || '').toString()
            const location = (emp.city || emp.location || '').toString()
            
            const matches = 
              firstName.toLowerCase().includes(searchLower) ||
              lastName.toLowerCase().includes(searchLower) ||
              email.toLowerCase().includes(searchLower) ||
              employeeId.toLowerCase().includes(searchLower) ||
              parentDepartment.toLowerCase().includes(searchLower) ||
              department.toLowerCase().includes(searchLower) ||
              designation.toLowerCase().includes(searchLower) ||
              location.toLowerCase().includes(searchLower) ||
              // Search in full name
              `${firstName} ${lastName}`.toLowerCase().includes(searchLower)
            
            return matches
          } catch (error) {
            console.warn('Error filtering employee:', emp, error)
            return false
          }
        })
      }

      // Apply project filter if specified (only if not using AI filters).
      if (!aiFilteredEmployees && filters.project && filters.project.length > 0 && projects && weeklyAllocations) {
        const projectIds = filters.project.map(id => parseInt(id))
        const projectAllocations = weeklyAllocations.filter(alloc =>
          projectIds.includes(alloc.project_id) && alloc.status === 'Active'
        )
        const employeeIdsInProject = new Set(projectAllocations.map(alloc => alloc.employee_id))

        filtered = filtered.filter(emp => {
          const empId = emp.id || emp.employee_id || emp.employeeId
          return employeeIdsInProject.has(parseInt(empId))
        })
      }

      // Apply sorting
      if (sortConfig.key) {
        filtered.sort((a, b) => {
          try {
            let aValue, bValue

            if (sortConfig.key === 'name') {
              aValue = `${a.first_name || a.firstName || ''} ${a.last_name || a.lastName || ''}`.trim()
              bValue = `${b.first_name || b.firstName || ''} ${b.last_name || b.lastName || ''}`.trim()
            } else if (sortConfig.key === 'employee_id') {
              aValue = a.employee_id || a.employeeId || a.id || ''
              bValue = b.employee_id || b.employeeId || b.id || ''
            } else if (sortConfig.key === 'designation') {
              aValue = a.designation || a.title || ''
              bValue = b.designation || b.title || ''
            } else if (sortConfig.key === 'total_experience') {
              aValue = a.total_experience || a.experience || 0
              bValue = b.total_experience || b.experience || 0
            } else {
              aValue = a[sortConfig.key] || ''
              bValue = b[sortConfig.key] || ''
            }

            // Handle numeric values
            if (sortConfig.key === 'total_experience') {
              const aNum = typeof aValue === 'string' ? parseFloat(aValue) || 0 : aValue
              const bNum = typeof bValue === 'string' ? parseFloat(bValue) || 0 : bValue
              return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum
            }

            // Handle string values
            if (aValue < bValue) {
              return sortConfig.direction === 'asc' ? -1 : 1
            }
            if (aValue > bValue) {
              return sortConfig.direction === 'asc' ? 1 : -1
            }
            return 0
          } catch (error) {
            console.warn('Error sorting employees:', error)
            return 0
          }
        })
      }

      return filtered
    } catch (error) {
      console.error('Error in filteredAndSortedEmployees:', error)
      return []
    }
  }, [searchTerm, filters, sortConfig, searchEmployees, projects, weeklyAllocations, aiFilteredEmployees, aiFilterLoading])

  // Debug filter state
  useEffect(() => {
    console.log('Current filters:', filters)
    console.log('Active filters count:', activeFiltersCount)
  }, [filters, activeFiltersCount])

  const handleSort = (key) => {
    let direction = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
  }

  // Get all active projects for an employee (for export purposes)
  const getEmployeeAllActiveProjects = (employeeId) => {
    if (!weeklyAllocations || !Array.isArray(weeklyAllocations)) return []

    const employeeAllocations = weeklyAllocations.filter(
      alloc => alloc.employee_id === employeeId &&
        alloc.status === 'Active'
    )

    // Get unique projects with their allocation percentages
    const projectMap = new Map()
    employeeAllocations.forEach(allocation => {
      const projectId = allocation.project_id
      const project = projects.find(p => p.id === projectId)
      if (project) {
        if (projectMap.has(projectId)) {
          // Add to existing allocation percentage
          projectMap.get(projectId).allocation_percentage += allocation.allocation_percentage || 0
        } else {
          projectMap.set(projectId, {
            ...project,
            allocation_percentage: allocation.allocation_percentage || 0
          })
        }
      }
    })

    return Array.from(projectMap.values())
  }

  // Handle export functionality
  const handleExport = () => {
    console.log('Export data debug:', {
      weeklyAllocations: weeklyAllocations?.length || 0,
      projects: projects?.length || 0,
      employees: filteredAndSortedEmployees?.length || 0
    })

    const exportData = filteredAndSortedEmployees.map(employee => {
      // Get all active projects for this employee (not just current week)
      const activeProjects = getEmployeeAllActiveProjects(employee.id)
      const projectNames = activeProjects.map(p => p.name).join('; ')

      console.log(`Employee ${employee.id} (${employee.first_name} ${employee.last_name}):`, {
        activeProjects: activeProjects.length,
        projectNames: projectNames || 'No projects'
      })

      return {
        'Employee ID': employee.employee_id || employee.employeeId || employee.id,
        'Name': `${employee.first_name || employee.firstName || ''} ${employee.last_name || employee.lastName || ''}`.trim(),
        'Email': employee.email || 'N/A',
        'Parent Department': employee.parent_department || 'N/A',
        'Department': employee.department || 'N/A',
        'Role': employee.designation || employee.title || 'N/A',
        'Manager': employee.reporting_manager_name || 'N/A',
        'Experience': formatExperience(employee.total_experience || employee.experience),
        'Billing Rate': employee.billing_rate_per_hour ? `$${employee.billing_rate_per_hour}/hr` : 'N/A',
        'Skills': 'N/A',
        'Projects': projectNames || 'N/A',
        'Status': employee.employee_status || 'N/A'
      }
    })

    // Convert to CSV
    const headers = Object.keys(exportData[0] || {})
    const csvContent = [
      headers.join(','),
      ...exportData.map(row => headers.map(header => `"${row[header]}"`).join(','))
    ].join('\n')

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `employees_export_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Helper function to convert months to years for display
  const formatExperience = (experience) => {
    if (!experience || experience === 0) return 'N/A'

    // Handle string format like "5 years"
    if (typeof experience === 'string') {
      return experience
    }

    // Handle numeric format
    const value = Number(experience)
    if (isNaN(value)) return 'N/A'

    // If value is less than 1.0, treat as months (multiply by 100)
    if (value < 1.0) {
      const months = Math.round(value * 100)
      return `${months} month${months !== 1 ? 's' : ''}`
    } else {
      // If value is 1.0 or above, treat as years
      const formatted = value.toFixed(2)

      // Handle specific formatting rules
      if (formatted.endsWith('.00')) {
        // 2.00 → 2 years
        return `${Math.floor(value)} years`
      } else if (formatted.endsWith('.10')) {
        // 2.10 → 2.10 years (keep .10 format)
        return `${formatted} years`
      } else if (formatted.endsWith('.01')) {
        // 2.01 → 2.1 years (convert .01 to .1)
        return `${(Math.floor(value) + 0.1).toFixed(1)} years`
      } else if (formatted.endsWith('0') && !formatted.endsWith('.10')) {
        // 2.90 → 2.9 years (remove trailing zero but not .10)
        return `${parseFloat(formatted)} years`
      } else {
        // 2.11 → 2.11 years (keep as is)
        return `${formatted} years`
      }
    }
  }

  const clearFilters = () => {
    setSearchTerm('')
    setFilters({
      parentDepartment: [],
      department: [],
      location: [],
      role: [],
      project: [],
      status: ['Active'],
      experience: [],
      skills: [],
      rates: []
    })
    setSortConfig({ key: null, direction: 'asc' })
    setShowAIFilter(false)
    setShowFilters(false)
    setAiFilteredEmployees(null) // Clear AI filtered results
    setAiFilterLoading(false) // Clear AI filter loading state
  }

  // Handle AI filter application - fetch filtered employees from server
  const handleAIFilterApply = async (aiFilters) => {
    console.log('Applying AI filters:', aiFilters)

    // If no filters, clear AI filtered results
    if (!aiFilters || aiFilters.length === 0) {
      setAiFilteredEmployees(null)
      setShowFilters(false)
      setAiFilterLoading(false)
      return
    }

    // Set loading state
    setAiFilterLoading(true)
    setAiFilteredEmployees(null) // Clear previous results

    try {
      // Fetch filtered employees from backend
      const token = getCookie(TOKEN)
      if (!token) {
        console.error('No authentication token found')
        setAiFilterLoading(false)
        return
      }

      const response = await fetch(`${getApiBaseUrl()}/api/ai/filter-apply`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ filters: aiFilters, tableName: "employees" })
      })

      if (response.ok) {
        const data = await response.json()
        console.log('Filtered employees received:', data)

        // Update the filtered employees state with server results
        setAiFilteredEmployees(data.data || [])
        setShowFilters(false) // Hide regular filters when AI filter is applied
      } else {
        console.error('Error applying filters:', response.statusText)
        throw new Error('Failed to apply filters')
      }
    } catch (error) {
      console.error('Error fetching filtered employees:', error)
      throw error // Re-throw to let AIFilterChatbot handle the error message
    } finally {
      setAiFilterLoading(false)
    }
  }

  // Handle chatbot close - clear AI filter state
  const onChatbotClose = () => {
    setShowAIFilter(false)
    setAiFilteredEmployees(null)
    setAiFilterLoading(false)
  }

  console.log("filteredAndSortedEmployees", filteredAndSortedEmployees)

  const removeFilter = (filterKey) => {
    setFilters(prev => ({ 
      ...prev, 
      [filterKey]: filterKey === 'status' ? ['Active'] : [] 
    }))
  }

  // Handle row click to open employee modal
  const handleRowClick = (employee) => {
    setSelectedEmployee(employee)
    setShowEmployeeModal(true)
    setIsEditing(false)
    
    // Normalize manager name for matching
    const normalizeManagerName = (name) => {
      if (!name) return ''
      return name.trim().replace(/\s+/g, ' ')
    }
    
    // Get stored manager name
    const storedManagerName = normalizeManagerName(employee.manager || employee.reporting_manager_name || '')
    
    // Format date for date input (YYYY-MM-DD)
    const formatDateForInput = (dateValue) => {
      if (!dateValue) return ''
      if (typeof dateValue === 'string') {
        if (dateValue.includes('T')) {
          return dateValue.split('T')[0]
        }
        // Try to parse DD-MM-YYYY or DD/MM/YYYY formats
        const dateMatch = dateValue.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/)
        if (dateMatch) {
          const [, day, month, year] = dateMatch
          return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
        }
        if (dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
          return dateValue
        }
      }
      return ''
    }
    
    // Initialize edit form data
    setEditFormData({
      firstName: employee.firstName || employee.first_name || '',
      lastName: employee.lastName || employee.last_name || '',
      email: employee.email || '',
      phone: employee.phone || employee.mobile_number || '',
      dateOfBirth: formatDateForInput(employee.dateOfBirth || employee.date_of_birth || ''),
      title: employee.title || employee.designation || '',
      parentDepartment: employee.parent_department || '',
      department: employee.department || '',
      location: employee.location || employee.city || '',
      manager: storedManagerName, // Use normalized manager name
      employmentType: employee.employmentType || employee.employment_type || '',
      hireDate: formatDateForInput(employee.hireDate || employee.date_of_joining || ''),
      salary: employee.salary || '',
      employeeStatus: employee.employee_status || 'Active'
    })
  }

  // Handle edit employee from row click
  const handleEditFromRow = (employee) => {
    // Ensure we have the correct employee ID
    const employeeId = employee.id || employee.employee_id || employee.employeeId
    if (employeeId) {
      navigate(`/employee/${employeeId}/edit`)
    } else {
      console.error('No valid employee ID found:', employee)
      alert('Error: Unable to find employee ID for editing')
    }
  }

  // Handle edit employee - now inline editing
  const handleEditEmployee = () => {
    setIsEditing(true)
  }

  // Handle form input changes
  const handleEditInputChange = (field, value) => {
    setEditFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  // Handle save changes
  const handleSaveChanges = async () => {
    if (!selectedEmployee) return

    // Map form data to backend field names
    const backendData = {
      first_name: editFormData.firstName,
      last_name: editFormData.lastName,
      email: editFormData.email,
      mobile_number: editFormData.phone,
      date_of_birth: editFormData.dateOfBirth,
      designation: editFormData.title,
      parent_department: editFormData.parentDepartment,
      department: editFormData.department,
      city: editFormData.location,
      employment_type: editFormData.employmentType,
      date_of_joining: editFormData.hireDate,
      employee_status: editFormData.employeeStatus
    }

    console.log('Saving employee changes:', backendData)
    const result = await updateEmployee(selectedEmployee.id, backendData)
    console.log('Save result:', result)

    if (result.success) {
      setIsEditing(false)
      // Update the selected employee with new data
      setSelectedEmployee(prev => ({ ...prev, ...result.employee }))
      console.log('Employee updated successfully')
    } else {
      alert('Error updating employee: ' + result.error)
    }
  }

  // Handle cancel edit
  const handleCancelEdit = () => {
    setIsEditing(false)
    // Reset form data to original values
    if (selectedEmployee) {
      setEditFormData({
        firstName: selectedEmployee.firstName || selectedEmployee.first_name || '',
        lastName: selectedEmployee.lastName || selectedEmployee.last_name || '',
        email: selectedEmployee.email || '',
        phone: selectedEmployee.phone || selectedEmployee.mobile_number || '',
        dateOfBirth: selectedEmployee.dateOfBirth || selectedEmployee.date_of_birth || '',
        title: selectedEmployee.title || selectedEmployee.designation || '',
        parentDepartment: selectedEmployee.parent_department || '',
        department: selectedEmployee.department || '',
        location: selectedEmployee.location || selectedEmployee.city || '',
        manager: selectedEmployee.manager || '',
        employmentType: selectedEmployee.employmentType || selectedEmployee.employment_type || 'Full-time',
        hireDate: selectedEmployee.hireDate || selectedEmployee.date_of_joining || '',
        salary: selectedEmployee.salary || '',
        employeeStatus: selectedEmployee.employee_status || 'Active'
      })
    }
  }

  // Handle delete employee - show confirmation modal
  const handleDeleteEmployee = (employeeId, employeeName) => {
    setEmployeeToDelete({ id: employeeId, name: employeeName })
    setShowDeleteConfirm(true)
  }

  // Confirm and perform deletion
  const confirmDeleteEmployee = async () => {
    if (!employeeToDelete) return

    setShowDeleteConfirm(false)
    setDeletingEmployee(employeeToDelete.id)
    
    try {
      // Ensure we have the correct employee ID format
      const idToDelete = employeeToDelete.id || selectedEmployee?.id || selectedEmployee?.employee_id || selectedEmployee?.employeeId
      console.log('Deleting employee with ID:', idToDelete)

      const result = await deleteEmployee(idToDelete)
      if (result.success) {
        setShowEmployeeModal(false)
        setSelectedEmployee(null)
        console.log('Employee deleted successfully')
        // Employee list will be automatically updated by the context
      } else {
        alert('Error deleting employee: ' + result.error)
      }
    } catch (error) {
      console.error('Error in handleDeleteEmployee:', error)
      alert('Error deleting employee: ' + error.message)
    } finally {
      setDeletingEmployee(null)
      setEmployeeToDelete(null)
    }
  }

  // Cancel deletion
  const cancelDeleteEmployee = () => {
    setShowDeleteConfirm(false)
    setEmployeeToDelete(null)
  }

  // Close modal
  const closeEmployeeModal = () => {
    setShowEmployeeModal(false)
    setSelectedEmployee(null)
  }


  // Context menu handlers
  const handleRightClick = (e, employee) => {
    e.preventDefault()
    e.stopPropagation()

    setContextMenuPosition({ x: e.clientX, y: e.clientY })
    setContextMenuEmployee(employee)
    setShowContextMenu(true)
  }

  const handleViewProfile = () => {
    if (contextMenuEmployee) {
      const employeeId = contextMenuEmployee.id || contextMenuEmployee.employee_id || contextMenuEmployee.employeeId
      navigate(`/employee-profile/${employeeId}`)
    }
    setShowContextMenu(false)
    setContextMenuEmployee(null)
  }

  const handleClickOutside = (e) => {
    if (showContextMenu && !e.target.closest('.context-menu')) {
      setShowContextMenu(false)
      setContextMenuEmployee(null)
    }
  }


  const SortIcon = ({ column }) => (
    <svg
      className={`w-4 h-4 transition-transform duration-200 ${sortConfig.key === column && sortConfig.direction === 'desc' ? 'rotate-180' : ''
        } ${sortConfig.key === column ? 'text-blue-600' : 'text-slate-400'}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16V4m0 0L3 8m4-4l4 4" />
    </svg>
  )

  // Loading Spinner Component
  const LoadingSpinner = () => (
    <div className="flex items-center justify-center py-12">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="text-slate-600 font-medium">Loading employees...</p>
      </div>
    </div>
  )

  // Empty State Component
  const EmptyState = () => (
    <div className="flex items-center justify-center py-12">
      <div className="text-center">
        <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-slate-900">No employees found</h3>
        <p className="mt-1 text-sm text-slate-500">
          {searchTerm || Object.values(filters).some(f => f !== '')
            ? 'Try adjusting your search or filters.'
            : 'Get started by adding your first employee.'
          }
        </p>
        {!searchTerm && !Object.values(filters).some(f => f !== '') && (
          <div className="mt-6">
            <Link
              to="/employee/create"
              className="btn-primary"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add Employee
            </Link>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className={embedded ? "" : "min-h-screen bg-slate-100 font-sans"}>
      {/* Inject scrollbar styles */}
      <style>{scrollbarStyles}</style>
      {!embedded && <Header />}

      {/* Show loader while permissions are being fetched */}
      {permissionsLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-slate-600">Loading Employee Directory...</p>
          </div>
        </div>
      )}
      <main className={embedded ? "" : "max-w-[97%] mx-auto px-4 sm:px-6 lg:px-8 py-8"}>
        {!embedded && (
          <div className="mb-8 animate-fade-in">
            <h1 className="page-title text-xl">Employee Directory</h1>
            <p className="page-subtitle">Manage and search your organization's workforce</p>
          </div>
        )}

        {/* Show content only when permissions are loaded and user has permission */}
        {!permissionsLoading && hasPermission('view-workforce') && (
          <>
            {/* Success Message */}
            {successMessage && (
              <div className="mb-6 animate-slide-in">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                        <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <p className="text-green-800 font-medium">{successMessage}</p>
                  </div>
                  <button
                    onClick={() => setSuccessMessage('')}
                    className="text-green-600 hover:text-green-800 transition-colors"
                    title="Close message"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
              {/* Employees Card */}
              <div className="card p-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Employees</p>
                    <p className="text-medium font-bold text-slate-900">{allEmployees.length}</p>
                  </div>
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Avg Bill Rate Card */}
              <div className="card p-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Avg Bill Rate</p>
                    <p className="text-medium font-bold text-slate-900">$0/hr</p>
                  </div>
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Utilization Card */}
              <div className="card p-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Utilization</p>
                    <p className="text-medium font-bold text-slate-900">
                      {allocationLoading ? (
                        <span className="text-sm text-slate-400">Loading...</span>
                      ) : allocationError ? (
                        <span className="text-sm text-red-400">Error</span>
                      ) : (
                        `${calculateAverageUtilization().toFixed(1)}%`
                      )}
                    </p>
                  </div>
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            <div className="card p-6 animate-slide-in">
              {/* Enhanced Search Bar */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-6">
                  {/* Search Bar */}
                  <div className="relative max-w-md">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search employees,dept,role,location..."
                      className="input-field pl-10 text-sm py-2 shadow-sm w-96"
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Action Buttons - Aligned to the right */}
                  <div className="flex gap-2">
                    {/* AI Filter Button - Only show when regular filters are not active */}
                    {!showFilters && activeFiltersCount === 0 ? (
                      <button
                        onClick={() => {
                          setShowAIFilter(!showAIFilter)
                          if (showAIFilter) {
                            setShowFilters(false) // Hide regular filters when AI filter is shown
                          }
                        }}
                        className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 border ${showAIFilter
                          ? 'bg-green-800 text-white border-green-800'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                          }`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        AI Filter
                      </button>
                    ) : null}

                    {/* Regular Filters Button - Only show when AI filter is not active */}
                    {!showAIFilter && !aiFilteredEmployees ? (
                      <button
                        onClick={() => {
                          setShowFilters(!showFilters)
                          if (showFilters) {
                            setShowAIFilter(false) // Hide AI filter when regular filters are shown
                          }
                        }}
                        className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 border ${showFilters || activeFiltersCount > 0
                          ? 'bg-green-700 text-white border-green-700'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                          }`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                        </svg>
                        Filters
                        <svg className={`w-4 h-4 transition-transform duration-200 ${showFilters ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    ) : null}

                    {hasPermission('workforce-employees-add') && (
                      <Link
                        to="/employee/create"
                        className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-white bg-green-700 rounded-lg hover:bg-green-800 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Add Employee
                      </Link>
                    )}
                    {hasPermission('workforce-import') && (
                      <button
                        onClick={() => setShowBulkImportModal(true)}
                        className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6" />
                        </svg>
                        Import
                      </button>
                    )}
                    {hasPermission('workforce-export') && (
                      <button
                        onClick={() => handleExport()}
                        className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Export
                      </button>
                    )}
                  </div>
                </div>

                {/* Expandable Filters Panel */}
                {showFilters && (
                  <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-lg animate-fade-in">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-slate-900">Filter Options</h3>
                      <button
                        onClick={() => setShowFilters(false)}
                        className="text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* Parent Department Filter */}
                      <MultiSelect
                        label="Parent Department"
                        options={uniqueParentDepartments.map(dept => ({ value: dept, label: dept }))}
                        selectedValues={filters.parentDepartment}
                        onSelectionChange={(values) => {
                          // When parent department changes, filter departments and clear invalid selections
                          const newFilters = { ...filters, parentDepartment: values }
                          
                          // If parent department is cleared, keep all departments but remove invalid selections
                          if (values.length === 0) {
                            // No parent department selected, allow all departments
                            // But remove any department selections that don't exist
                            setFilters(newFilters)
                          } else {
                            // Parent department selected, filter departments
                            // Remove department selections that don't belong to selected parent departments
                            const validDepartments = filters.department.filter(dept => {
                              return allEmployees.some(emp => 
                                emp.department === dept &&
                                emp.parent_department &&
                                values.includes(emp.parent_department)
                              )
                            })
                            newFilters.department = validDepartments
                            
                            // Also update role filter based on new department filter
                            if (validDepartments.length > 0) {
                              const validRoles = filters.role.filter(role => {
                                return allEmployees.some(emp => 
                                  (emp.designation === role || emp.title === role) &&
                                  validDepartments.includes(emp.department)
                                )
                              })
                              newFilters.role = validRoles
                            } else {
                              newFilters.role = []
                            }
                          }
                          setFilters(newFilters)
                        }}
                        placeholder="All Parent Departments"
                        searchPlaceholder="Filter parent departments..."
                      />

                      {/* Department Filter */}
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
                        placeholder={filters.parentDepartment.length > 0 ? "All Departments" : "All Departments"}
                        searchPlaceholder="Filter departments..."
                      />

                      {/* Role Filter (Designations) */}
                      <MultiSelect
                        label="Role"
                        options={getFilteredRoles.map(role => ({ value: role, label: role }))}
                        selectedValues={filters.role}
                        onSelectionChange={(values) => setFilters({ ...filters, role: values })}
                        placeholder={filters.department.length > 0 ? "All Roles" : "All Roles"}
                        searchPlaceholder="Filter roles/designations..."
                      />

                      {/* Location Filter */}
                      <MultiSelect
                        label="Location"
                        options={uniqueLocations.map(location => ({ value: location, label: location }))}
                        selectedValues={filters.location}
                        onSelectionChange={(values) => setFilters({ ...filters, location: values })}
                        placeholder="All Locations"
                        searchPlaceholder="Filter locations..."
                      />

                      {/* Status Filter */}
                      <MultiSelect
                        label="Status"
                        options={[
                          { value: 'Active', label: 'Active' },
                          { value: 'Inactive', label: 'Inactive' },
                          { value: 'Resigned', label: 'Resigned' },
                          { value: 'Terminated', label: 'Terminated' }
                        ]}
                        selectedValues={filters.status}
                        onSelectionChange={(values) => setFilters({ ...filters, status: values })}
                        placeholder="All Status"
                        searchPlaceholder="Filter status..."
                      />

                      {/* Experience Filter */}
                      <MultiSelect
                        label="Experience"
                        options={[
                          { value: '0-1', label: '0-1 years' },
                          { value: '1-3', label: '1-3 years' },
                          { value: '3-5', label: '3-5 years' },
                          { value: '5-8', label: '5-8 years' },
                          { value: '8-10', label: '8-10 years' },
                          { value: '10+', label: '10+ years' }
                        ]}
                        selectedValues={filters.experience}
                        onSelectionChange={(values) => setFilters({ ...filters, experience: values })}
                        placeholder="All Experience"
                        searchPlaceholder="Filter experience..."
                      />

                      {/* All Skills Filter */}
                      <MultiSelect
                        label="All Skills"
                        options={[]} // Will be populated when skills data is available
                        selectedValues={filters.skills}
                        onSelectionChange={(values) => setFilters({ ...filters, skills: values })}
                        placeholder="All Skills"
                        searchPlaceholder="Filter skills..."
                      />

                      {/* All Projects Filter */}
                      <MultiSelect
                        label="All Projects"
                        options={projects.map(project => ({ value: project.id.toString(), label: project.name }))}
                        selectedValues={filters.project}
                        onSelectionChange={(values) => setFilters({ ...filters, project: values })}
                        placeholder="All Projects"
                        searchPlaceholder="Filter projects..."
                      />

                      {/* All Rates Filter */}
                      <MultiSelect
                        label="All Rates"
                        options={[]} // Will be populated when rates data is available
                        selectedValues={filters.rates}
                        onSelectionChange={(values) => setFilters({ ...filters, rates: values })}
                        placeholder="All Rates"
                        searchPlaceholder="Filter rates..."
                      />
                    </div>

                    {/* Filter Actions */}
                    <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-200">
                      <button
                        onClick={clearFilters}
                        className="px-3 py-2 text-sm text-slate-600 hover:text-slate-800 font-medium transition-colors"
                      >
                        Clear all filters
                      </button>
                      <button
                        onClick={() => setShowFilters(false)}
                        className="px-3 py-2 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-800 transition-colors"
                      >
                        Apply Filters
                      </button>
                    </div>
                  </div>
                )}

              </div>

              {/* Enhanced Table */}
              <div className="overflow-x-auto rounded-xl border-2 border-slate-200 shadow-sm">
                {loading || aiFilterLoading ? (
                  <LoadingSpinner />
                ) : filteredAndSortedEmployees.length === 0 ? (
                  <EmptyState />
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gradient-to-r from-slate-50 to-slate-100">
                      <tr>
                        <th className="text-left py-3 px-4 font-semibold text-slate-700 w-8"></th>
                        <th
                          className="text-left py-3 px-4 font-semibold text-slate-700 cursor-pointer hover:bg-slate-200 transition-all duration-200 group"
                          onClick={() => handleSort('employee_id')}
                        >
                          <div className="flex items-center gap-2">
                            Employee ID
                            <SortIcon column="employee_id" />
                          </div>
                        </th>
                        <th
                          className="text-left py-3 px-4 font-semibold text-slate-700 cursor-pointer hover:bg-slate-200 transition-all duration-200 group"
                          onClick={() => handleSort('name')}
                        >
                          <div className="flex items-center gap-2">
                            Name
                            <SortIcon column="name" />
                          </div>
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-slate-700">Email</th>
                        <th
                          className="text-left py-3 px-4 font-semibold text-slate-700 cursor-pointer hover:bg-slate-200 transition-all duration-200 group"
                          onClick={() => handleSort('parent_department')}
                        >
                          <div className="flex items-center gap-2">
                            Parent Department
                            <SortIcon column="parent_department" />
                          </div>
                        </th>
                        <th
                          className="text-left py-3 px-4 font-semibold text-slate-700 cursor-pointer hover:bg-slate-200 transition-all duration-200 group"
                          onClick={() => handleSort('department')}
                        >
                          <div className="flex items-center gap-2">
                            Department
                            <SortIcon column="department" />
                          </div>
                        </th>
                        <th
                          className="text-left py-3 px-4 font-semibold text-slate-700 cursor-pointer hover:bg-slate-200 transition-all duration-200 group"
                          onClick={() => handleSort('designation')}
                        >
                          <div className="flex items-center gap-2">
                            Role
                            <SortIcon column="designation" />
                          </div>
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-slate-700">Manager</th>
                        <th
                          className="text-left py-3 px-4 font-semibold text-slate-700 cursor-pointer hover:bg-slate-200 transition-all duration-200 group"
                          onClick={() => handleSort('total_experience')}
                        >
                          <div className="flex items-center gap-2">
                            Experience
                            <SortIcon column="total_experience" />
                          </div>
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-slate-700">Billing Rate</th>
                        <th className="text-left py-3 px-4 font-semibold text-slate-700">Projects</th>
                        <th className="text-left py-3 px-4 font-semibold text-slate-700">Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                      {filteredAndSortedEmployees.map((employee) => {
                        const isExpanded = expandedRows.has(employee.id)
                        return (
                          <React.Fragment key={employee.id}>
                            <tr
                              className={`hover:bg-blue-50 transition-all duration-200 group ${
                                hasPermission('workforce-table-click') ? 'cursor-pointer' : 'cursor-default'
                              }`}
                              onClick={hasPermission('workforce-table-click') ? () => handleRowClick(employee) : undefined}
                              onContextMenu={hasPermission('workforce-table-click') ? (e) => handleRightClick(e, employee) : undefined}
                            >
                              <td className="py-3 px-4">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    const newExpandedRows = new Set(expandedRows)
                                    if (isExpanded) {
                                      newExpandedRows.delete(employee.id)
                                    } else {
                                      newExpandedRows.add(employee.id)
                                    }
                                    setExpandedRows(newExpandedRows)
                                  }}
                                  className="text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                  <svg
                                    className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                  </svg>
                                </button>
                              </td>
                              <td className="py-3 px-4">
                                <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded text-slate-700">
                                  {employee.employee_id || employee.employeeId || employee.id}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <span className="text-green-700 hover:text-green-800 font-semibold transition-all duration-200">
                                  {employee.first_name || employee.firstName} {employee.last_name || employee.lastName}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-slate-600">
                                <div className="truncate" title={employee.email || 'N/A'}>
                                  {employee.email || 'N/A'}
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium text-green-800">
                                  {employee.parent_department || 'N/A'}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium bg-green-100 text-green-800">
                                  {employee.department || 'N/A'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-slate-700">{employee.designation || employee.title || 'N/A'}</td>
                              <td className="py-3 px-4 text-slate-600">
                                {employee.reporting_manager_name || employee.manager || 'N/A'}
                              </td>
                              <td className="py-3 px-4 text-slate-600">
                                {formatExperience(employee.total_experience)}
                              </td>
                              <td className="py-3 px-4 text-slate-600">$0/hr</td>
                              <td className="py-3 px-4">
                                {(() => {
                                  const currentProjects = getEmployeeCurrentProjects(employee.id)
                                  if (allocationLoading) {
                                    return <span className="text-xs text-slate-400">Loading...</span>
                                  }
                                  if (allocationError) {
                                    return <span className="text-xs text-red-400">Error</span>
                                  }
                                  if (currentProjects.length === 0) {
                                    return <span className="text-xs text-slate-400">No projects</span>
                                  }
                                  return (
                                    <div className="space-y-1">
                                      {currentProjects.slice(0, 3).map((project, index) => (
                                        <div key={project.id} className="text-xs">
                                          <div className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium bg-blue-100 text-blue-800" title={project.name}>
                                            {project.name}
                                          </div>
                                        </div>
                                      ))}
                                      {currentProjects.length > 3 && (
                                        <div className="text-xs text-slate-400">
                                          +{currentProjects.length - 3} more
                                        </div>
                                      )}
                                    </div>
                                  )
                                })()}
                              </td>
                              <td className="py-3 px-4">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${(employee.employee_status || 'Active') === 'Active'
                                  ? 'bg-green-100 text-green-800'
                                  : (employee.employee_status || 'Active') === 'Inactive'
                                    ? 'bg-red-100 text-red-800'
                                    : (employee.employee_status || 'Active') === 'On Leave'
                                      ? 'bg-yellow-100 text-yellow-800'
                                      : 'bg-gray-100 text-gray-800'
                                  }`}>
                                  {employee.employee_status || 'Active'}
                                </span>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr>
                                <td colSpan="11" className="px-4 py-4 bg-slate-50">
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                    {/* Skills Summary */}
                                    <div className="card p-4">
                                      <h4 className="font-semibold text-slate-900 mb-2">Skills Summary</h4>
                                      <div className="text-sm text-slate-600">
                                        <p>No skills data available</p>
                                      </div>
                                    </div>

                                    {/* Current Projects */}
                                    <div className="card p-4">
                                      <h4 className="font-semibold text-slate-900 mb-2">Current Projects</h4>
                                      <div className="text-sm text-slate-600">
                                        {(() => {
                                          const currentProjects = getEmployeeCurrentProjects(employee.id)
                                          if (allocationLoading) {
                                            return <p>Loading project assignments...</p>
                                          }
                                          if (allocationError) {
                                            return <p className="text-red-500">Error loading projects</p>
                                          }
                                          if (currentProjects.length === 0) {
                                            return <p>No project assignments</p>
                                          }
                                          return (
                                            <div className="space-y-2">
                                              {currentProjects.map((project) => (
                                                <div key={project.id} className="flex justify-between items-center p-2 bg-slate-50 rounded">
                                                  <div>
                                                    <div className="font-medium text-slate-700">{project.name}</div>
                                                    <div className="text-xs text-slate-500">
                                                      {project.status} • {project.client || 'No client'}
                                                    </div>
                                                  </div>
                                                  <div className="text-right">
                                                    <div className="font-semibold text-blue-600">
                                                      {project.allocation_percentage}%
                                                    </div>
                                                    <div className="text-xs text-slate-500">
                                                      {new Date(project.start_date).toLocaleDateString()} - {new Date(project.end_date).toLocaleDateString()}
                                                    </div>
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          )
                                        })()}
                                      </div>
                                    </div>

                                    {/* Rate History */}
                                    <div className="card p-4">
                                      <h4 className="font-semibold text-slate-900 mb-2">Rate History</h4>
                                      <div className="text-sm text-slate-600">
                                        <p>No rate history available</p>
                                      </div>
                                    </div>

                                    {/* Documents */}
                                    <div className="card p-4">
                                      <h4 className="font-semibold text-slate-900 mb-2">Documents</h4>
                                      <div className="text-sm text-slate-600">
                                        <p>No documents uploaded</p>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Enhanced Results Footer */}
              {!loading && filteredAndSortedEmployees.length > 0 && (
                <div className="flex items-center justify-between mt-6 pt-6 border-t-2 border-slate-200">
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-slate-600 font-medium">
                      Showing <span className="font-bold text-slate-900">{filteredAndSortedEmployees.length}</span> of <span className="font-bold text-slate-900">{allEmployees.length}</span> employees
                    </div>
                    {aiFilteredEmployees ? (
                      <div className="text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded-full font-medium">
                        AI Filtered
                      </div>
                    ) : null}
                    {searchTerm && (
                      <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full font-medium">
                        Search: "{searchTerm}"
                      </div>
                    )}
                    {filteredAndSortedEmployees.length !== allEmployees.length && !searchTerm && !aiFilteredEmployees && (
                      <div className="text-xs text-green-800 bg-green-50 px-2 py-1 rounded-full font-medium">
                        Filtered results
                      </div>
                    )}
                  </div>
                  {(activeFiltersCount > 0 || searchTerm || aiFilteredEmployees) && (
                    <button
                      onClick={clearFilters}
                      className="text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-semibold transition-all duration-200 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Reset All Filters
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        )}
        {/* No permissions message - only show when not loading */}
        {!permissionsLoading && !hasPermission('view-workforce') && (<div className="text-center py-12">
          <div className="mx-auto w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-slate-900 mb-2">Access Restricted</h3>
          <p className="text-slate-500">You don't have permission to access the Employee Directory.</p>
          <p className="text-sm text-slate-400 mt-2">Please contact your administrator for access.</p>
        </div>
        )}
      </main>

      {/* Bulk Import Modal */}
      {showBulkImportModal && (
        <BulkImport
          onClose={() => setShowBulkImportModal(false)}
          onImportComplete={(result) => {
            setShowBulkImportModal(false)
          }}
        />
      )}

      {/* Employee Details Modal */}
      {showEmployeeModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold text-lg">
                    {(selectedEmployee.first_name || selectedEmployee.firstName || '').charAt(0)}
                    {(selectedEmployee.last_name || selectedEmployee.lastName || '').charAt(0)}
                  </span>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">
                    {selectedEmployee.first_name || selectedEmployee.firstName} {selectedEmployee.last_name || selectedEmployee.lastName}
                  </h2>
                  <p className="text-slate-600 font-medium">
                    {selectedEmployee.designation || selectedEmployee.title || 'N/A'}
                  </p>
                </div>
              </div>
              <button
                onClick={closeEmployeeModal}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Personal Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-900 border-b border-slate-200 pb-2">Personal Information</h3>

                  {/* Employee ID - Read Only */}
                  <div>
                    <label className="block text-sm font-medium text-slate-600">Employee ID</label>
                    <p className="text-slate-900 font-mono bg-slate-100 px-3 py-2 rounded-lg">
                      {selectedEmployee.employee_id || selectedEmployee.employeeId || selectedEmployee.id}
                    </p>
                  </div>

                  {/* First Name */}
                  <div>
                    <label className="block text-sm font-medium text-slate-600">First Name</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editFormData.firstName}
                        onChange={(e) => handleEditInputChange('firstName', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800"
                      />
                    ) : (
                      <p className="text-slate-900">{selectedEmployee.first_name || selectedEmployee.firstName || 'N/A'}</p>
                    )}
                  </div>

                  {/* Last Name */}
                  <div>
                    <label className="block text-sm font-medium text-slate-600">Last Name</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editFormData.lastName}
                        onChange={(e) => handleEditInputChange('lastName', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800"
                      />
                    ) : (
                      <p className="text-slate-900">{selectedEmployee.last_name || selectedEmployee.lastName || 'N/A'}</p>
                    )}
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-sm font-medium text-slate-600">Email</label>
                    {isEditing ? (
                      <input
                        type="email"
                        value={editFormData.email}
                        onChange={(e) => handleEditInputChange('email', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800"
                      />
                    ) : (
                      <p className="text-slate-900">{selectedEmployee.email || 'N/A'}</p>
                    )}
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-sm font-medium text-slate-600">Phone</label>
                    {isEditing ? (
                      <input
                        type="tel"
                        value={editFormData.phone}
                        onChange={(e) => handleEditInputChange('phone', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800"
                      />
                    ) : (
                      <p className="text-slate-900">{selectedEmployee.phone || selectedEmployee.mobile_number || 'N/A'}</p>
                    )}
                  </div>

                  {/* Date of Birth */}
                  <div>
                    <label className="block text-sm font-medium text-slate-600">Date of Birth</label>
                    {isEditing ? (
                      <input
                        type="date"
                        value={editFormData.dateOfBirth}
                        onChange={(e) => handleEditInputChange('dateOfBirth', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800"
                      />
                    ) : (
                      <p className="text-slate-900">{selectedEmployee.dateOfBirth || selectedEmployee.date_of_birth || 'N/A'}</p>
                    )}
                  </div>
                </div>

                {/* Job Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-900 border-b border-slate-200 pb-2">Job Information</h3>

                  {/* Title/Designation */}
                  <div>
                    <label className="block text-sm font-medium text-slate-600">Role</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editFormData.title}
                        onChange={(e) => handleEditInputChange('title', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800"
                      />
                    ) : (
                      <p className="text-slate-900">{selectedEmployee.title || selectedEmployee.designation || 'N/A'}</p>
                    )}
                  </div>

                  {/* Department */}
                  <div>
                    <label className="block text-sm font-medium text-slate-600">Department</label>
                    {isEditing ? (
                      <select
                        value={editFormData.department}
                        onChange={(e) => handleEditInputChange('department', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800"
                      >
                        <option value="">Select Department</option>
                        {uniqueDepartments.map(dept => (
                          <option key={dept} value={dept}>{dept}</option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-slate-900">{selectedEmployee.department || 'N/A'}</p>
                    )}
                  </div>

                  {/* Location */}
                  <div>
                    <label className="block text-sm font-medium text-slate-600">Location</label>
                    {isEditing ? (
                      <select
                        value={editFormData.location}
                        onChange={(e) => handleEditInputChange('location', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800"
                      >
                        <option value="">Select Location</option>
                        {uniqueLocations.map(location => (
                          <option key={location} value={location}>{location}</option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-slate-900">{selectedEmployee.city || selectedEmployee.location || 'N/A'}</p>
                    )}
                  </div>

                  {/* Employment Type */}
                  <div>
                    <label className="block text-sm font-medium text-slate-600">Employment Type</label>
                    {isEditing ? (
                      <select
                        value={editFormData.employmentType || ''}
                        onChange={(e) => handleEditInputChange('employmentType', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800"
                      >
                        <option value="">Select employment type</option>
                        <option value="Full-time">Full-time</option>
                        <option value="Part-time">Part-time</option>
                        <option value="Contract">Contract</option>
                        <option value="Permanent">Permanent</option>
                        <option value="Intern">Intern</option>
                      </select>
                    ) : (
                      <p className="text-slate-900">{selectedEmployee.employmentType || selectedEmployee.employment_type || 'N/A'}</p>
                    )}
                  </div>

                  {/* Hire Date */}
                  <div>
                    <label className="block text-sm font-medium text-slate-600">Hire Date</label>
                    {isEditing ? (
                      <input
                        type="date"
                        value={editFormData.hireDate}
                        onChange={(e) => handleEditInputChange('hireDate', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800"
                      />
                    ) : (
                      <p className="text-slate-900">{selectedEmployee.hireDate || selectedEmployee.date_of_joining || 'N/A'}</p>
                    )}
                  </div>

                  {/* Status */}
                  <div>
                    <label className="block text-sm font-medium text-slate-600">Status</label>
                    {isEditing ? (
                      <select
                        value={editFormData.employeeStatus || 'Active'}
                        onChange={(e) => handleEditInputChange('employeeStatus', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800"
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                        <option value="Resigned">Resigned</option>
                        <option value="Terminated">Terminated</option>
                      </select>
                    ) : (
                      <p className="text-slate-900">{selectedEmployee.employee_status || 'Active'}</p>
                    )}
                  </div>

                  {/* Experience - Read Only */}
                  <div>
                    <label className="block text-sm font-medium text-slate-600">Experience</label>
                    <p className="text-slate-900">{formatExperience(selectedEmployee.total_experience || selectedEmployee.experience)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between gap-4 p-6 border-t border-slate-200 bg-slate-50 rounded-b-xl">
              <div className="flex items-center gap-2">
                <button
                  onClick={closeEmployeeModal}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium transition-colors"
                >
                  Close
                </button>
              </div>

              <div className="flex items-center gap-2">
                {hasPermission('workforce-employees-edit') && (
                  <button
                    onClick={() => handleEditFromRow(selectedEmployee)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit Employee
                  </button>
                )}
                {hasPermission('workforce-employees-delete') && (
                  <button
                    onClick={() => handleDeleteEmployee(selectedEmployee.id, `${selectedEmployee.first_name || selectedEmployee.firstName} ${selectedEmployee.last_name || selectedEmployee.lastName}`)}
                    disabled={deletingEmployee === selectedEmployee.id}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deletingEmployee === selectedEmployee.id ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Deleting...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete Employee
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* AI Filter Chatbot */}
      {showAIFilter ? (
        <AIFilterChatbot
          onClose={onChatbotClose}
          onApplyFilters={handleAIFilterApply}
          tableName="employees"
          defaultMessage={ "Hello! How can I help you filter the employee list today?"}
        />
      ) : null}

      {/* Context Menu */}
      {showContextMenu && contextMenuEmployee && (
        <div
          className="context-menu fixed bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-50 min-w-[160px]"
          style={{
            left: contextMenuPosition.x,
            top: contextMenuPosition.y,
          }}
        >
          <button
            onClick={handleViewProfile}
            className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            View Profile
          </button>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {showDeleteConfirm && employeeToDelete && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={cancelDeleteEmployee}
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
                  <h3 className="text-lg font-semibold text-slate-900">Delete Employee</h3>
                  <p className="text-sm text-slate-600 mt-1">This action cannot be undone</p>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              <div className="mb-4">
                <p className="text-slate-900 font-medium mb-2">
                  Are you sure you want to delete <span className="text-red-600 font-semibold">{employeeToDelete.name}</span>?
                </p>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-4">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-amber-900 mb-2">The following will be deleted:</p>
                      <ul className="text-sm text-amber-800 space-y-1 list-disc list-inside">
                        <li>All project allocations</li>
                        <li>All KRA assignments and allocations</li>
                        <li>All goals and milestones</li>
                        <li>All employee skills</li>
                        <li>All certificates</li>
                        <li>Hierarchy relationships</li>
                      </ul>
                      <p className="text-sm font-semibold text-amber-900 mt-3">Subordinates will have their reporting manager set to None.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 bg-slate-50 rounded-b-xl">
              <button
                onClick={cancelDeleteEmployee}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteEmployee}
                disabled={deletingEmployee === employeeToDelete.id}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {deletingEmployee === employeeToDelete.id ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Deleting...
                  </>
                ) : (
                  'Delete Employee'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default EmployeeDirectory