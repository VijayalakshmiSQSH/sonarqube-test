import React, { useState, useEffect, memo, useRef } from 'react'
import LoadingSpinner from '../../components/LoadingSpinner.jsx'
import { getCookie, isUserLoggedIn } from '../../utils/helpers.js'
import { TOKEN, getApiBaseUrl } from '../../utils/constants.js'
import { usePermissions } from '../../context/PermissionContext.jsx'

// Notification Component
const Notification = ({ type, message, onClose, isVisible }) => {
  if (!isVisible) return null

  const bgColor = type === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
  const textColor = type === 'success' ? 'text-green-800' : 'text-red-800'
  const iconColor = type === 'success' ? 'text-green-400' : 'text-red-400'
  const titleColor = type === 'success' ? 'text-green-900' : 'text-red-900'

  return (
    <div className={`fixed top-4 right-4 z-[9999] max-w-sm w-full bg-white border-l-4 ${bgColor} shadow-lg rounded-lg p-4 transform transition-all duration-300 ease-in-out`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          {type === 'success' ? (
            <svg className={`h-6 w-6 ${iconColor}`} fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className={`h-6 w-6 ${iconColor}`} fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          )}
        </div>
        <div className="ml-3 w-0 flex-1">
          <p className={`text-sm font-semibold ${titleColor}`}>
            {type === 'success' ? 'Success!' : 'Error'}
          </p>
          <p className={`text-sm ${textColor} mt-1`}>
            {message}
          </p>
        </div>
        <div className="ml-4 flex-shrink-0 flex">
          <button
            onClick={onClose}
            className={`inline-flex ${textColor} hover:opacity-75 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-${type === 'success' ? 'green' : 'red'}-500`}
          >
            <span className="sr-only">Close</span>
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

const OverallUtilizationTab = memo(({
  employees,
  weeklyAllocations,
  projects,
  customers,
  searchTerm,
  filters,
  forecastLoading,
  forecastError,
  expandedDepartments,
  setExpandedDepartments,
  isAuthenticated,
  fetchProjects,
  updateAllocations, // Callback to update allocations optimistically
  editingAllocation,
  setEditingAllocation,
  onViewChange // Callback to notify parent of view changes
}) => {
  const { hasPermission } = usePermissions()
  const [viewType, setViewType] = useState('month') // 'month', 'quarter'
  const [currentDate, setCurrentDate] = useState(new Date())

  // Notify parent component when view changes
  useEffect(() => {
    if (onViewChange) {
      onViewChange({ viewType, currentDate })
    }
  }, [viewType, currentDate, onViewChange])

  // Helper function to check if allocation overlaps with any selected weeks
  const isAllocationInSelectedWeeks = (allocation) => {
    if (!filters.selected_weeks || filters.selected_weeks.length === 0) {
      return true // No weeks selected means "ALL weeks" (fallback case)
    }

    if (!allocation.start_date || !allocation.end_date) return false

    const allocationStart = new Date(allocation.start_date)
    const allocationEnd = new Date(allocation.end_date)

    // Check if allocation overlaps with any of the selected weeks
    return filters.selected_weeks.some(selectedWeek => {
      if (!selectedWeek.start || !selectedWeek.end) return false

      const weekStart = new Date(selectedWeek.start)
      const weekEnd = new Date(selectedWeek.end)

      return allocationStart <= weekEnd && allocationEnd >= weekStart
    })
  }
  const [expandedEmployees, setExpandedEmployees] = useState(new Set())
  const [notification, setNotification] = useState({ isVisible: false, type: '', message: '' })
  const [isSaving, setIsSaving] = useState(false)
  const [creatingAllocationFor, setCreatingAllocationFor] = useState(null) // Track which employee is having allocation created
  const [isUpdatingAllocation, setIsUpdatingAllocation] = useState(false) // Track update allocation loading state
  const [deleteConfirmation, setDeleteConfirmation] = useState(null) // Track delete confirmation popup
  const [isDeletingAllocation, setIsDeletingAllocation] = useState(false) // Track delete allocation loading state

  // State for Current Allocations Edit Modal
  const [currentAllocationsEditModal, setCurrentAllocationsEditModal] = useState(null)
  const [splitAllocations, setSplitAllocations] = useState({}) // Track split allocations by original allocation ID

  // New state for custom employee selection
  const [showCustomSelection, setShowCustomSelection] = useState(false)
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState(new Set())
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState('')
  const searchInputRef = useRef(null)


  // Helper function to show notifications
  const showNotification = (type, message) => {
    setNotification({ isVisible: true, type, message })
    // Auto-hide after 5 seconds
    setTimeout(() => {
      setNotification(prev => ({ ...prev, isVisible: false }))
    }, 5000)
  }

  const closeNotification = () => {
    setNotification(prev => ({ ...prev, isVisible: false }))
  }

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

    // Create full name from first_name and last_name
    const fullName = `${employee.first_name || ''} ${employee.last_name || ''}`.trim()

    try {
      // Employee status filter - only show active employees
      const isActiveEmployee = (employee.employee_status || 'Active') === 'Active'

      // Custom employee selection filter - if employees are selected, only show those
      const matchesCustomSelection = selectedEmployeeIds.size === 0 || selectedEmployeeIds.has(employee.id)

      // Search term filter with null checks
      const matchesSearch = !searchTerm ||
        (fullName && fullName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (employee.designation && employee.designation.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (employee.department && employee.department.toLowerCase().includes(searchTerm.toLowerCase()))

      // Forecast-specific filters with safety checks
      // Support parent department filter
      const matchesParentDepartment = (!filters.selected_parent_departments || filters.selected_parent_departments.length === 0) ||
        (filters.selected_parent_departments && filters.selected_parent_departments.includes(employee.parent_department))
      // Support both old single-value and new multi-select department filters
      const matchesDepartment = (!filters.selected_departments || filters.selected_departments.length === 0) &&
        (!filters.department || employee.department === filters.department) ||
        (filters.selected_departments && filters.selected_departments.includes(employee.department))
      // Support both old single-value and new multi-select role filters
      const matchesRole = (!filters.selected_roles || filters.selected_roles.length === 0) &&
        (!filters.role || employee.designation === filters.role) ||
        (filters.selected_roles && filters.selected_roles.includes(employee.designation))
      const matchesAllocationStatus = !filters.allocation_status || (() => {
        // Check if employee has any allocations 
        const hasAllocations = weeklyAllocations.some(allocation => {
          if (!allocation || allocation.employee_id !== employee.id || allocation.status !== 'Active') return false

          // Check if allocation overlaps with any selected weeks
          return isAllocationInSelectedWeeks(allocation)
        })

        switch (filters.allocation_status) {
          case 'Available':
            return !hasAllocations
          case 'Allocated':
            return hasAllocations
          default:
            return true
        }
      })()
      // Support both old single-value and new multi-select project filters
      const matchesProject = (!filters.selected_projects || filters.selected_projects.length === 0) &&
        (!filters.project || (() => {
          return weeklyAllocations.some(allocation => {
            if (!allocation || allocation.employee_id !== employee.id || allocation.project_id !== parseInt(filters.project)) return false

            // Check if allocation overlaps with any selected weeks
            return isAllocationInSelectedWeeks(allocation)
          })
        })()) ||
        (filters.selected_projects && (() => {
          return weeklyAllocations.some(allocation => {
            if (!allocation || allocation.employee_id !== employee.id || !filters.selected_projects.includes(allocation.project_id)) return false

            // Check if allocation overlaps with any selected weeks
            return isAllocationInSelectedWeeks(allocation)
          })
        })())

      // Customer filter - multi-select
      const matchesCustomer = (!filters.selected_customers || filters.selected_customers.length === 0) ||
        (() => {
          return weeklyAllocations.some(allocation => {
            if (!allocation || allocation.employee_id !== employee.id) return false

            // If a specific week is selected, check if allocation overlaps with that week
            if (filters.selected_week && filters.selected_week.start && filters.selected_week.end) {
              const weekStart = new Date(filters.selected_week.start)
              const weekEnd = new Date(filters.selected_week.end)

              if (!allocation.start_date || !allocation.end_date) return false
              const allocationStart = new Date(allocation.start_date)
              const allocationEnd = new Date(allocation.end_date)

              if (!(allocationStart <= weekEnd && allocationEnd >= weekStart)) return false
            }

            const project = projects.find(p => p.id === allocation.project_id)
            return project && filters.selected_customers.includes(project.customer_id)
          })
        })()

      // Project type filter - support both old single-value and new multi-select
      const matchesProjectType = (!filters.selected_project_types || filters.selected_project_types.length === 0) &&
        (!filters.project_type || (() => {
          return weeklyAllocations.some(allocation => {
            if (!allocation || allocation.employee_id !== employee.id) return false

            // If a specific week is selected, check if allocation overlaps with that week
            if (filters.selected_week && filters.selected_week.start && filters.selected_week.end) {
              const weekStart = new Date(filters.selected_week.start)
              const weekEnd = new Date(filters.selected_week.end)

              if (!allocation.start_date || !allocation.end_date) return false
              const allocationStart = new Date(allocation.start_date)
              const allocationEnd = new Date(allocation.end_date)

              if (!(allocationStart <= weekEnd && allocationEnd >= weekStart)) return false
            }

            const project = projects.find(p => p.id === allocation.project_id)
            return project && project.project_type === filters.project_type
          })
        })()) ||
        (filters.selected_project_types && (() => {
          return weeklyAllocations.some(allocation => {
            if (!allocation || allocation.employee_id !== employee.id) return false

            // If a specific week is selected, check if allocation overlaps with that week
            if (filters.selected_week && filters.selected_week.start && filters.selected_week.end) {
              const weekStart = new Date(filters.selected_week.start)
              const weekEnd = new Date(filters.selected_week.end)

              if (!allocation.start_date || !allocation.end_date) return false
              const allocationStart = new Date(allocation.start_date)
              const allocationEnd = new Date(allocation.end_date)

              if (!(allocationStart <= weekEnd && allocationEnd >= weekStart)) return false
            }

            const project = projects.find(p => p.id === allocation.project_id)
            return project && filters.selected_project_types.includes(project.project_type)
          })
        })())

      // Practice filter - multi-select
      const matchesPractice = (!filters.selected_practices_utilization || filters.selected_practices_utilization.length === 0) ||
        (filters.selected_practices_utilization && (() => {
          return weeklyAllocations.some(allocation => {
            if (!allocation || allocation.employee_id !== employee.id) return false

            // If a specific week is selected, check if allocation overlaps with that week
            if (filters.selected_week && filters.selected_week.start && filters.selected_week.end) {
              const weekStart = new Date(filters.selected_week.start)
              const weekEnd = new Date(filters.selected_week.end)

              if (!allocation.start_date || !allocation.end_date) return false
              const allocationStart = new Date(allocation.start_date)
              const allocationEnd = new Date(allocation.end_date)

              if (!(allocationStart <= weekEnd && allocationEnd >= weekStart)) return false
            }

            const project = projects.find(p => p.id === allocation.project_id)
            return project && filters.selected_practices_utilization.includes(project.practice)
          })
        })())

      // Utilization percentage filter - based on selected week or all weeks (supports multiselect and custom range)
      const matchesUtilizationPercentage = (() => {
        // Check if any utilization filters are active
        const hasUtilizationFilter =
          (filters.selected_utilization_ranges && filters.selected_utilization_ranges.length > 0) ||
          filters.custom_utilization_range ||
          filters.utilization_percentage // Backward compatibility

        if (!hasUtilizationFilter) return true

        // Get allocations for the employee
        let employeeAllocations
        // Filter allocations based on selected weeks
        employeeAllocations = weeklyAllocations.filter(allocation =>
          allocation &&
          allocation.employee_id === employee.id &&
          allocation.status === 'Active' &&
          isAllocationInSelectedWeeks(allocation)
        )

        // Group allocations by project to avoid double counting
        const projectAllocations = {}
        employeeAllocations.forEach(allocation => {
          const projectId = allocation.project_id
          if (!projectAllocations[projectId] ||
            new Date(allocation.start_date) > new Date(projectAllocations[projectId].start_date)) {
            projectAllocations[projectId] = allocation
          }
        })

        // Calculate total utilization percentage for selected weeks
        const totalUtilization = Object.values(projectAllocations).reduce((total, allocation) => {
          return total + (allocation.allocation_percentage || 0)
        }, 0)

        // Check against selected predefined ranges (multiselect)
        if (filters.selected_utilization_ranges && filters.selected_utilization_ranges.length > 0) {
          const matchesAnyRange = filters.selected_utilization_ranges.some(range => {
            switch (range) {
              case '0-25':
                return totalUtilization >= 0 && totalUtilization <= 25
              case '26-50':
                return totalUtilization >= 26 && totalUtilization <= 50
              case '51-75':
                return totalUtilization >= 51 && totalUtilization <= 75
              case '76-100':
                return totalUtilization >= 76 && totalUtilization <= 100
              case '100+':
                return totalUtilization > 100
              default:
                return false
            }
          })

          // If custom range is also set, employee must match at least one condition
          if (filters.custom_utilization_range) {
            const matchesCustom = totalUtilization >= filters.custom_utilization_range.min &&
              totalUtilization <= filters.custom_utilization_range.max
            return matchesAnyRange || matchesCustom
          }

          return matchesAnyRange
        }

        // Check against custom range only
        if (filters.custom_utilization_range) {
          return totalUtilization >= filters.custom_utilization_range.min &&
            totalUtilization <= filters.custom_utilization_range.max
        }

        // Backward compatibility: check old single-select filter
        if (filters.utilization_percentage) {
          switch (filters.utilization_percentage) {
            case '0-25':
              return totalUtilization >= 0 && totalUtilization <= 25
            case '26-50':
              return totalUtilization >= 26 && totalUtilization <= 50
            case '51-75':
              return totalUtilization >= 51 && totalUtilization <= 75
            case '76-100':
              return totalUtilization >= 76 && totalUtilization <= 100
            case '100+':
              return totalUtilization > 101 || totalUtilization == 101
            default:
              return true
          }
        }

        return true
      })()

      // Location filter - support both old single-value and new multi-select
      const employeeLocation = employee.city || employee.work_location_state
      const matchesLocation = (!filters.selected_locations || filters.selected_locations.length === 0) ||
        (filters.selected_locations && filters.selected_locations.includes(employeeLocation))

      return isActiveEmployee && matchesCustomSelection && matchesSearch && matchesParentDepartment && matchesDepartment && matchesRole && matchesAllocationStatus && matchesProject && matchesCustomer && matchesProjectType && matchesPractice && matchesUtilizationPercentage && matchesLocation
    } catch (error) {
      console.error('Error filtering employee:', employee, error)
      return false
    }
  })

  // Helper function to get week number of the year (ISO week calculation)
  const getWeekNumber = (date) => {
    // Create a new date object to avoid modifying the original
    const d = new Date(date)

    // Set to nearest Thursday: current date + 4 - current day number
    // Make Sunday's day number 7
    const dayOfWeek = d.getDay() || 7
    d.setDate(d.getDate() + 4 - dayOfWeek)

    // Get first day of year
    const yearStart = new Date(d.getFullYear(), 0, 1)

    // Calculate full weeks to nearest Thursday
    const weekNumber = Math.ceil((((d - yearStart) / 86400000) + 1) / 7)

    return weekNumber
  }

  // Helper function to format date in local timezone (fixes timezone shift issue)
  const formatDateLocal = (date) => {
    if (!date) return ''
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const formatDateReadable = (date) => {
    if (!date) return ''
    const d = new Date(date)
    const day = d.getDate()
    const month = d.toLocaleDateString('en-US', { month: 'long' })
    const year = d.getFullYear()
    return `${day} ${month} ${year}`
  }

  // Helper function to check if a week is the current week
  const isCurrentWeek = (weekStart, weekEnd) => {
    const today = new Date()
    const currentWeekStart = new Date(today)
    currentWeekStart.setDate(today.getDate() - today.getDay()) // Start of current week (Sunday)
    const currentWeekEnd = new Date(currentWeekStart)
    currentWeekEnd.setDate(currentWeekStart.getDate() + 6) // End of current week (Saturday)

    // Check if the week overlaps with the current week
    return weekStart <= currentWeekEnd && weekEnd >= currentWeekStart
  }

  // Helper function to get the start of a week (Sunday)
  const getWeekStart = (date) => {
    const weekStart = new Date(date)
    weekStart.setDate(date.getDate() - date.getDay()) // Start of week (Sunday)
    weekStart.setHours(0, 0, 0, 0) // Set to start of day to avoid timezone issues
    return weekStart
  }

  // Helper function to get the start of the current week (Sunday)
  const getCurrentWeekStart = () => {
    const today = new Date()
    return getWeekStart(today)
  }

  // Generate timeline periods based on view type
  const generateTimelinePeriods = () => {
    const periods = []
    const today = new Date(currentDate)

    if (viewType === 'month') {
      // Generate 2 months starting from current month
      const month1Start = new Date(today.getFullYear(), today.getMonth(), 1)
      const month1End = new Date(today.getFullYear(), today.getMonth() + 1, 0)
      const month2Start = new Date(today.getFullYear(), today.getMonth() + 1, 1)
      const month2End = new Date(today.getFullYear(), today.getMonth() + 2, 0)

      // Generate all weeks for the 2-month period
      const allWeeks = []
      const firstWeekStart = new Date(month1Start)
      firstWeekStart.setDate(1)
      // Adjust to start of week (Sunday)
      firstWeekStart.setDate(firstWeekStart.getDate() - firstWeekStart.getDay())

      let weekStart = new Date(firstWeekStart)

      while (weekStart <= month2End) {
        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekStart.getDate() + 6)

        // Only include weeks that overlap with either month
        if (weekStart <= month2End && weekEnd >= month1Start) {
          const weekNumber = getWeekNumber(weekStart)

          allWeeks.push({
            start: new Date(weekStart),
            end: new Date(weekEnd),
            label: `Week ${weekNumber}`,
            dateRange: `${weekStart.getDate()}-${weekEnd.getDate()}`
          })
        }

        weekStart.setDate(weekStart.getDate() + 7)
      }

      // Split weeks between the two months
      const month1Weeks = allWeeks.filter(week =>
        week.start <= month1End && week.end >= month1Start
      )
      const month2Weeks = allWeeks.filter(week =>
        week.start <= month2End && week.end >= month2Start
      )

      // Add first month
      periods.push({
        start: month1Start,
        end: month1End,
        label: month1Start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        fullLabel: month1Start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        weeks: month1Weeks
      })

      // Add second month
      periods.push({
        start: month2Start,
        end: month2End,
        label: month2Start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        fullLabel: month2Start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        weeks: month2Weeks
      })
    } else if (viewType === 'quarter') {
      // Generate rolling 3-month view starting from current month
      const currentMonth = currentDate.getMonth()
      const currentYear = currentDate.getFullYear()

      // Generate weeks for each of the 3 months
      for (let monthOffset = 0; monthOffset < 3; monthOffset++) {
        const monthIndex = currentMonth + monthOffset
        const monthStart = new Date(currentYear, monthIndex, 1)
        const monthEnd = new Date(currentYear, monthIndex + 1, 0)

        // Generate weeks for this month
        const weeks = []
        let weekStart = new Date(monthStart)
        // Adjust to start of week (Sunday)
        weekStart.setDate(weekStart.getDate() - weekStart.getDay())

        // Continue generating weeks until we reach the end of the month
        while (weekStart <= monthEnd) {
          const weekEnd = new Date(weekStart)
          weekEnd.setDate(weekStart.getDate() + 6)

          const weekNumber = getWeekNumber(weekStart)

          weeks.push({
            start: new Date(weekStart),
            end: new Date(weekEnd),
            label: `Week ${weekNumber}`,
            dateRange: `${weekStart.getDate()}-${weekEnd.getDate()}`
          })

          weekStart.setDate(weekStart.getDate() + 7)
        }

        const monthName = monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

        periods.push({
          start: monthStart,
          end: monthEnd,
          label: monthName,
          fullLabel: monthName,
          weeks: weeks
        })
      }
    }

    return periods
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

    return weeklyAllocations.filter(allocation => {
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
  }

  // Calculate total allocation for an employee in a specific week
  const getEmployeeWeekTotal = (employeeId, weekStart, weekEnd) => {
    try {
      const weekAllocations = getEmployeeWeekAllocations(employeeId, weekStart, weekEnd)
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

  const toggleEmployeeExpansion = (employeeId) => {
    setExpandedEmployees(prev => {
      const newSet = new Set(prev)
      if (newSet.has(employeeId)) {
        newSet.delete(employeeId)
      } else {
        newSet.add(employeeId)
      }
      return newSet
    })
  }

  // Navigation functions
  const navigatePeriod = (direction) => {
    const newDate = new Date(currentDate)
    if (viewType === 'month') {
      newDate.setMonth(newDate.getMonth() + direction)
    } else if (viewType === 'quarter') {
      // For rolling 3-month view, navigate by 1 month at a time
      newDate.setMonth(newDate.getMonth() + direction)
    }
    setCurrentDate(newDate)
  }

  const handleExportForecast = () => {
    const periods = generateTimelinePeriods()
    const employeesByDept = getEmployeesByDepartment()

    // Create CSV data with detailed project information
    let csvContent = "Employee Name,Department,Designation,Period,Week,Project Name,Allocation %\n"

    Object.entries(employeesByDept).forEach(([department, deptEmployees]) => {
      deptEmployees.forEach(employee => {
        periods.forEach(period => {
          period.weeks.forEach(week => {
            const weekAllocations = getEmployeeWeekAllocations(employee.id, week.start, week.end)

            if (weekAllocations.length > 0) {
              // Export each project allocation as a separate row
              weekAllocations.forEach(allocation => {
                const project = projects.find(p => p.id === allocation.project_id)
                const projectName = project ? project.name : 'Unknown Project'
                const employeeName = employee.name || `${employee.first_name || ''} ${employee.last_name || ''}`.trim()

                csvContent += `"${employeeName}","${employee.department}","${employee.designation}","${period.label}","${week.label}","${projectName}","${allocation.allocation_percentage}%"\n`
              })
            } else {
              // If no allocations, show as unallocated
              const employeeName = employee.name || `${employee.first_name || ''} ${employee.last_name || ''}`.trim()
              csvContent += `"${employeeName}","${employee.department}","${employee.designation}","${period.label}","${week.label}","Unallocated","0%"\n`
            }
          })
        })
      })
    })

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `timeline-${viewType}-${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Handle saving allocations to the database
  const handleSaveAllocations = async (allocationData) => {
    const token = getCookie(TOKEN)
    if (!token) {
      console.error('Authentication token not found')
      showNotification('error', 'Authentication token not found')
      return
    }

    setIsSaving(true)
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
          // Check if this is a weekly allocation update that needs splitting
          console.log('Checking allocation for weekly update:', {
            id: allocation.id,
            original_start_date: allocation.original_start_date,
            original_end_date: allocation.original_end_date,
            start_date: allocation.start_date,
            end_date: allocation.end_date,
            hasOriginalDates: !!(allocation.original_start_date && allocation.original_end_date),
            datesDiffer: allocation.original_start_date !== allocation.start_date || allocation.original_end_date !== allocation.end_date,
            isPartialWeek: allocation.isPartialWeek
          })

          // Check if this is a weekly allocation that needs splitting
          // We need to split if:
          // 1. It has original dates (indicating it's a week-specific allocation)
          // 2. The original dates are different from the current dates (indicating it spans multiple weeks)
          // 3. It's marked as a partial week
          if (allocation.original_start_date && allocation.original_end_date &&
            allocation.isPartialWeek &&
            (allocation.original_start_date !== allocation.start_date || allocation.original_end_date !== allocation.end_date)) {

            // This is a weekly allocation update - we need to split it
            const originalStart = new Date(allocation.original_start_date)
            const originalEnd = new Date(allocation.original_end_date)
            const weekStart = new Date(allocation.start_date)
            const weekEnd = new Date(allocation.end_date)

            console.log('Splitting weekly allocation update:', {
              originalStart: originalStart.toISOString().split('T')[0],
              originalEnd: originalEnd.toISOString().split('T')[0],
              weekStart: weekStart.toISOString().split('T')[0],
              weekEnd: weekEnd.toISOString().split('T')[0]
            })

            // Create new allocations for the periods before and after the selected week
            const newAllocations = []

            // Before the selected week
            if (originalStart < weekStart) {
              const beforeEnd = new Date(weekStart)
              beforeEnd.setDate(beforeEnd.getDate() - 1)

              if (originalStart <= beforeEnd) {
                newAllocations.push({
                  employee_id: allocation.employee_id,
                  project_id: allocation.project_id,
                  role: allocation.role,
                  allocation_percentage: allocation.original_allocation_percentage || allocation.allocation_percentage,
                  start_date: formatDateLocal(originalStart),
                  end_date: formatDateLocal(beforeEnd),
                  status: 'Active',
                  billable: allocation.billable
                })
              }
            }

            // The selected week (with updated values)
            newAllocations.push({
              employee_id: allocation.employee_id,
              project_id: allocation.project_id,
              role: allocation.role,
              allocation_percentage: allocation.allocation_percentage,
              start_date: formatDateLocal(weekStart),
              end_date: formatDateLocal(weekEnd),
              status: 'Active',
              billable: allocation.billable
            })

            // After the selected week
            if (originalEnd > weekEnd) {
              const afterStart = new Date(weekEnd)
              afterStart.setDate(afterStart.getDate() + 1)

              if (afterStart <= originalEnd) {
                newAllocations.push({
                  employee_id: allocation.employee_id,
                  project_id: allocation.project_id,
                  role: allocation.role,
                  allocation_percentage: allocation.original_allocation_percentage || allocation.allocation_percentage,
                  start_date: formatDateLocal(afterStart),
                  end_date: formatDateLocal(originalEnd),
                  status: 'Active',
                  billable: allocation.billable
                })
              }
            }

            // Delete the original allocation
            const deleteResponse = await fetch(`${getApiBaseUrl()}/api/allocations/${allocation.id}`, {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            })

            if (!deleteResponse.ok) {
              throw new Error('Failed to delete original allocation')
            }

            // Create new allocations for all periods
            const createPromises = newAllocations.map(async (newAlloc) => {
              const createResponse = await fetch(`${getApiBaseUrl()}/api/allocations`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(newAlloc)
              })

              if (!createResponse.ok) {
                const errorData = await createResponse.json()
                throw new Error(`Failed to create new allocation: ${errorData.error || 'Unknown error'}`)
              }

              const responseData = await createResponse.json()
              console.log('Allocation created successfully:', responseData)
              return responseData
            })

            return await Promise.all(createPromises)
          } else {
            // Regular allocation update (not weekly)
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

            const responseData = await response.json()
            console.log('Allocation updated successfully:', responseData)
            return responseData
          }
        })
        promises.push(...updatePromises)
      }

      // Handle removed allocations (soft delete by setting status to Inactive)
      if (allocationData.removed && allocationData.removed.length > 0) {
        const removePromises = allocationData.removed.map(async (allocation) => {
          // Only soft delete if it has a real ID (not a temporary one)
          if (allocation.id && allocation.id < 1000000000000) {
            const updatePayload = {
              status: 'Inactive' // Only send status for soft delete
            }

            const response = await fetch(`${getApiBaseUrl()}/api/allocations/${allocation.id}`, {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(updatePayload)
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
      const results = await Promise.all(promises)

      // Update state optimistically using API responses
      updateAllocations(prev => {
        let updated = [...prev]

        // Track IDs that need to be removed (split operations and deletions)
        const idsToRemove = new Set()

        // Process results in order: added, updated (including splits), removed
        let resultIndex = 0

        // Process added allocations
        if (allocationData.added && allocationData.added.length > 0) {
          allocationData.added.forEach(() => {
            const result = results[resultIndex++]
            if (result && result.allocation) {
              updated.push(result.allocation)
            }
          })
        }

        // Process updated allocations
        if (allocationData.updated && allocationData.updated.length > 0) {
          allocationData.updated.forEach(allocation => {
            const result = results[resultIndex++]

            if (Array.isArray(result)) {
              // Split operation: remove original, add new allocations
              idsToRemove.add(allocation.id)
              result.forEach(allocResult => {
                if (allocResult && allocResult.allocation) {
                  updated.push(allocResult.allocation)
                }
              })
            } else if (result && result.allocation) {
              // Regular update: replace existing
              updated = updated.map(a =>
                a.id === result.allocation.id ? result.allocation : a
              )
            }
          })
        }

        // Process removed allocations
        if (allocationData.removed && allocationData.removed.length > 0) {
          allocationData.removed.forEach(allocation => {
            if (allocation.id && allocation.id < 1000000000000) {
              idsToRemove.add(allocation.id)
            }
          })
        }

        // Remove all deleted/split allocations
        updated = updated.filter(a => !idsToRemove.has(a.id))

        return updated
      })

      console.log('Allocations saved successfully')

      // Show success notification
      showNotification('success', 'Allocations saved successfully!')
      // Note: Removed fetchProjects() call - using optimistic updates instead

    } catch (error) {
      console.error('Error saving allocations:', error)
      showNotification('error', 'Error saving allocations: ' + error.message)
    } finally {
      setIsSaving(false)
    }
  }

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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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

    // Filter employees based on search term and status
    const filteredEmployeesForSelection = employees.filter(employee => {
      if (!employee || (!employee.first_name && !employee.last_name)) return false

      // Only show active employees
      const isActiveEmployee = (employee.employee_status || 'Active') === 'Active'
      if (!isActiveEmployee) return false

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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-slate-600 mt-1">
              Select specific employees to display in the utilization view
            </p>
          </div>

          {/* Search Bar */}
          <div className="px-6 py-4 border-b border-slate-200">
            <div className="relative flex items-center bg-white border border-slate-300 rounded-lg px-3 py-2">
              <svg className="w-4 h-4 text-slate-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
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
                    className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all ${isSelected
                      ? 'bg-green-50 border-green-200'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center mr-3 ${isSelected
                      ? 'bg-green-700 border-green-700'
                      : 'border-slate-300'
                      }`}>
                      {isSelected && (
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
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

      {/* Notification */}
      <Notification
        type={notification.type}
        message={notification.message}
        isVisible={notification.isVisible}
        onClose={closeNotification}
      />

      {/* Delete Confirmation Popup */}
      {deleteConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Delete Allocation</h3>
                <p className="text-sm text-gray-500">This action cannot be undone.</p>
              </div>
            </div>

            {/* Allocation Period Warning */}
            {deleteConfirmation.allocation && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="font-medium text-red-900">Allocation Period</span>
                </div>
                <p className="text-sm text-red-700">
                  This will delete the entire allocation period: <strong>
                    {formatDateReadable(deleteConfirmation.allocation.start_date)} to {formatDateReadable(deleteConfirmation.allocation.end_date)}
                  </strong>
                </p>
                <p className="text-xs text-red-600 mt-1">
                  All weeks in this period will be removed.
                </p>
              </div>
            )}

            <p className="text-gray-700 mb-6">
              Are you sure you want to delete this allocation? This will set the allocation status to inactive.
            </p>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeleteConfirmation(null)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={deleteConfirmation.onConfirm}
                disabled={isDeletingAllocation}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {isDeletingAllocation && (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {isDeletingAllocation ? 'Deleting...' : 'Delete Allocation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View-specific Header */}
      <div className="px-6 py-4 border-b border-slate-200">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Overall Utilization Timeline</h2>
            <p className="text-sm text-slate-600 mt-1">
              {weeklyAllocations.length === 0 && forecastError
                ? "⚠️ Allocation data unavailable - showing employees only"
                : "Timeline View - Click on any cell to modify weekly allocations"
              }
            </p>
          </div>

          {/* View Type Toggle and Navigation */}
          <div className="flex items-center gap-4">
            {/* Custom Selection Button */}

            <button
              onClick={() => {
                setEmployeeSearchTerm('')
                setShowCustomSelection(true)
              }}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 border ${selectedEmployeeIds.size > 0
                ? 'bg-green-700 text-white border-green-700'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
              Select
              {selectedEmployeeIds.size > 0 && (
                <span className="bg-white text-green-700 px-2 py-0.5 rounded-full text-xs font-bold">
                  {selectedEmployeeIds.size}
                </span>
              )}
            </button>


            <div className="flex bg-slate-100 rounded-lg p-1">
              {['month', 'quarter'].map((type) => (
                <button
                  key={type}
                  onClick={() => setViewType(type)}
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-all duration-200 capitalize ${viewType === type
                    ? 'bg-white text-green-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                    }`}
                >
                  {type} View
                </button>
              ))}
            </div>

            {/* Date Navigation */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigatePeriod(-1)}
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-sm font-medium text-slate-700 min-w-[200px] text-center">
                {viewType === 'month' && (() => {
                  const currentMonth = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                  const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
                  const nextMonthStr = nextMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                  return `${currentMonth} - ${nextMonthStr}`
                })()}
                {viewType === 'quarter' && (() => {
                  const currentMonth = currentDate.getMonth()
                  const currentYear = currentDate.getFullYear()
                  const startMonth = new Date(currentYear, currentMonth, 1)
                  const endMonth = new Date(currentYear, currentMonth + 2, 1)
                  const startMonthStr = startMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                  const endMonthStr = endMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                  return `${startMonthStr} - ${endMonthStr}`
                })()}
              </span>
              <button
                onClick={() => navigatePeriod(1)}
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            <div className="flex gap-2">
              {weeklyAllocations.length > 0 && hasPermission('utilization-export') && (
                <button
                  onClick={handleExportForecast}
                  className="bg-green-700 text-white px-4 py-2 text-sm font-medium rounded-lg hover:bg-green-800"
                >
                  Export Timeline
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
      </div>

      {/* Timeline View */}
      <TimelineTable
        employees={filteredEmployees}
        weeklyAllocations={weeklyAllocations}
        projects={projects}
        generateTimelinePeriods={generateTimelinePeriods}
        getEmployeeWeekAllocations={getEmployeeWeekAllocations}
        getEmployeeWeekTotal={getEmployeeWeekTotal}
        getEmployeesByDepartment={getEmployeesByDepartment}
        onEditAllocation={setEditingAllocation}
        expandedDepartments={expandedDepartments}
        expandedEmployees={expandedEmployees}
        toggleDepartmentExpansion={toggleDepartmentExpansion}
        toggleEmployeeExpansion={toggleEmployeeExpansion}
        viewType={viewType}
        creatingAllocationFor={creatingAllocationFor}
        setCreatingAllocationFor={setCreatingAllocationFor}
        isCurrentWeek={isCurrentWeek}
        hasPermission={hasPermission}
        selectedWeeks={filters.selected_weeks || []}
      />

      {/* Allocation Editing Modal */}
      {editingAllocation && (
        <AllocationEditModal
          editingAllocation={editingAllocation}
          onClose={() => {
            setEditingAllocation(null)
            setCreatingAllocationFor(null)
          }}
          setEditingAllocation={setEditingAllocation}
          projects={projects}
          employees={employees}
          weeklyAllocations={weeklyAllocations}
          fetchProjects={fetchProjects}
          updateAllocations={updateAllocations}
          showNotification={showNotification}
          isSaving={isSaving}
          setIsSaving={setIsSaving}
          isUpdatingAllocation={isUpdatingAllocation}
          setIsUpdatingAllocation={setIsUpdatingAllocation}
          isDeletingAllocation={isDeletingAllocation}
          setIsDeletingAllocation={setIsDeletingAllocation}
          setExpandedDepartments={setExpandedDepartments}
          setExpandedEmployees={setExpandedEmployees}
          setDeleteConfirmation={setDeleteConfirmation}
          getWeekNumber={getWeekNumber}
          formatDateLocal={formatDateLocal}
          formatDateReadable={formatDateReadable}
          splitAllocations={splitAllocations}
          hasPermission={hasPermission}
          setSplitAllocations={setSplitAllocations}
          setCurrentAllocationsEditModal={setCurrentAllocationsEditModal}
          onSave={async (updatedAllocations) => {
            // Handle saving allocations
            await handleSaveAllocations(updatedAllocations)

            // Auto-expand the employee's department and the employee itself
            if (editingAllocation?.employee) {
              const employee = editingAllocation.employee
              const department = employee.department

              // Expand the department
              setExpandedDepartments(prev => new Set([...prev, department]))

              // Expand the employee
              setExpandedEmployees(prev => new Set([...prev, employee.id]))
            }

            // Clear the creating state
            setCreatingAllocationFor(null)

            // Close the modal
            setEditingAllocation(null)
          }}
        />
      )}

      {/* Current Allocations Edit Modal */}
      {currentAllocationsEditModal && (
        <CurrentAllocationsEditModal
          editingAllocation={currentAllocationsEditModal}
          onClose={() => setCurrentAllocationsEditModal(null)}
          projects={projects}
          showNotification={showNotification}
          formatDateReadable={formatDateReadable}
          getWeekNumber={getWeekNumber}
          splitAllocations={splitAllocations}
          setSplitAllocations={setSplitAllocations}
          setDeleteConfirmation={setDeleteConfirmation}
          isDeletingAllocation={isDeletingAllocation}
          setIsDeletingAllocation={setIsDeletingAllocation}
          isUpdatingAllocation={isUpdatingAllocation}
          setIsUpdatingAllocation={setIsUpdatingAllocation}
          fetchProjects={fetchProjects}
          updateAllocations={updateAllocations}
        />
      )}
    </>
  )
})

// Timeline Table Component
const TimelineTable = ({
  employees,
  weeklyAllocations,
  projects,
  generateTimelinePeriods,
  getEmployeeWeekAllocations,
  getEmployeeWeekTotal,
  getEmployeesByDepartment,
  onEditAllocation,
  expandedDepartments,
  expandedEmployees,
  toggleDepartmentExpansion,
  toggleEmployeeExpansion,
  viewType,
  creatingAllocationFor,
  setCreatingAllocationFor,
  isCurrentWeek,
  hasPermission,
  selectedWeeks = [] // Add selectedWeeks prop
}) => {
  const periods = generateTimelinePeriods()
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

  const handleCellClick = (employeeId, weekStart, weekEnd, period, week) => {
    const allocations = getEmployeeWeekAllocations(employeeId, weekStart, weekEnd)
    const employee = employees.find(emp => emp.id === employeeId)

    onEditAllocation({
      employeeId,
      employee,
      period,
      week,
      allocations,
      weekStart,
      weekEnd
    })
  }

  const getProjectName = (projectId) => {
    const project = projects.find(p => p.id === projectId)
    return project ? project.name : 'Unknown Project'
  }

  const getUtilizationColor = (percentage) => {
    if (percentage > 100) return 'bg-red-100 text-red-800'
    if (percentage >= 80) return 'bg-green-100 text-green-800'
    if (percentage >= 60) return 'bg-yellow-100 text-yellow-800'
    if (percentage >= 40) return 'bg-orange-100 text-orange-800'
    return 'bg-gray-100 text-gray-800'
  }

  // Helper function to check if a week is selected in the week filter
  const isWeekSelected = (weekStart, weekEnd) => {
    if (!selectedWeeks || selectedWeeks.length === 0) return false

    return selectedWeeks.some(selectedWeek => {
      if (!selectedWeek.start || !selectedWeek.end) return false

      const selectedWeekStart = new Date(selectedWeek.start)
      const selectedWeekEnd = new Date(selectedWeek.end)

      // Check if the week matches exactly or overlaps
      return weekStart.getTime() === selectedWeekStart.getTime() &&
        weekEnd.getTime() === selectedWeekEnd.getTime()
    })
  }

  return (
    <div className="overflow-x-auto max-w-full">
      <table className="w-full table-fixed">
        <thead className="bg-slate-50 sticky top-0 z-20">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider border-r border-slate-200 sticky left-0 bg-slate-50 z-10 w-80">
              Employee
            </th>
            {periods.map((period, periodIndex) => (
              <th key={periodIndex} colSpan={period.weeks.length} className="px-2 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider border-r border-slate-200">
                <div className="font-semibold">{period.label}</div>
              </th>
            ))}
          </tr>
          <tr>
            <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider border-r border-slate-200 sticky left-0 bg-slate-50 z-10 w-80">
              Projects
            </th>
            {periods.map((period, periodIndex) => (
              <React.Fragment key={periodIndex}>
                {period.weeks.map((week, weekIndex) => {
                  const isCurrent = isCurrentWeek(week.start, week.end)
                  const isSelected = isWeekSelected(week.start, week.end)

                  // Determine styling based on priority: selected > current > default
                  let headerClass = 'px-2 py-2 text-center text-xs font-medium uppercase tracking-wider border-r border-slate-200 w-24'
                  let labelClass = ''
                  let dateClass = 'text-xs mt-1'

                  if (isSelected) {
                    headerClass += ' bg-green-100 text-green-800 border-green-200'
                    labelClass = 'font-bold'
                    dateClass += ' text-green-600'
                  } else if (isCurrent) {
                    headerClass += ' bg-green-100 text-green-800 border-green-200'
                    labelClass = 'font-bold'
                    dateClass += ' text-green-700'
                  } else {
                    headerClass += ' text-slate-500'
                    dateClass += ' text-slate-400'
                  }

                  return (
                    <th key={weekIndex} className={headerClass}>
                      <div className={labelClass}>{week.label}</div>
                      <div className={dateClass}>
                        {week.dateRange}
                      </div>
                    </th>
                  )
                })}
              </React.Fragment>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-slate-200">
          {Object.keys(employeesByDept).length === 0 ? (
            <tr>
              <td colSpan={periods.reduce((total, period) => total + period.weeks.length, 0) + 1} className="px-6 py-8 text-center text-slate-500">
                No employees found. Please check if employees are properly loaded.
              </td>
            </tr>
          ) : (
            Object.entries(employeesByDept).map(([department, deptEmployees]) => (
              <React.Fragment key={department}>
                {/* Department Header Row */}
                <tr className="bg-slate-100 cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => toggleDepartmentExpansion(department)}>
                  <td colSpan={periods.reduce((total, period) => total + period.weeks.length, 0) + 1} className="px-6 py-3 text-sm font-semibold text-slate-900 uppercase tracking-wider">
                    <div className="flex items-center justify-between">
                      <span>{department} ({deptEmployees.length} employees)</span>
                      <svg
                        className={`w-4 h-4 transition-transform duration-200 ${expandedDepartments.has(department) ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </td>
                </tr>
                {/* Employee Rows */}
                {expandedDepartments.has(department) && deptEmployees.map((employee) => (
                  <React.Fragment key={employee.id}>
                    {/* Employee Utilization Row */}
                    <tr className="hover:bg-slate-50">
                      <td className="px-6 py-3 whitespace-nowrap border-r border-slate-200 sticky left-0 bg-white z-10 w-80">
                        <div className="flex items-center">
                          <button
                            onClick={() => toggleEmployeeExpansion(employee.id)}
                            className="mr-3 text-slate-400 hover:text-slate-600"
                          >
                            <svg
                              className={`w-4 h-4 transform transition-transform ${expandedEmployees.has(employee.id) ? 'rotate-90' : ''}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-green-700 truncate">
                              {`${employee.first_name || ''} ${employee.last_name || ''}`.trim()}
                            </div>
                            <div className="text-sm text-slate-500 truncate">
                              {employee.designation}
                            </div>
                          </div>
                          <div className="flex-shrink-0 ml-2">
                            {hasPermission('utilization-allocations-create') && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setCreatingAllocationFor(employee.id)
                                  onEditAllocation({
                                    isNewAllocation: true,
                                    employeeId: employee.id,
                                    employee: employee
                                  })
                                }}
                                disabled={creatingAllocationFor === employee.id}
                                className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded hover:bg-green-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                title="Add Allocation"
                              >
                                {creatingAllocationFor === employee.id ? (
                                  <>
                                    <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Creating...
                                  </>
                                ) : (
                                  '+ Allocation'
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      </td>
                      {periods.map((period, periodIndex) => (
                        <React.Fragment key={periodIndex}>
                          {period.weeks.map((week, weekIndex) => {
                            const weekTotal = getEmployeeWeekTotal(employee.id, week.start, week.end)
                            const isCurrent = isCurrentWeek(week.start, week.end)
                            const isSelected = isWeekSelected(week.start, week.end)

                            // Determine cell background based on priority: selected > current > default
                            let cellClass = 'px-2 py-3 text-center border-r border-slate-200 w-24'
                            if (isSelected) {
                              cellClass += ' bg-green-50'
                            } else if (isCurrent) {
                              cellClass += ' bg-green-50'
                            }

                            return (
                              <td key={weekIndex} className={cellClass}>
                                <div
                                  className={`inline-flex items-center px-3 py-2 rounded-full text-sm font-bold cursor-pointer transition-colors ${isSelected
                                    ? 'shadow-md bg-green-100 text-green-800'
                                    : isCurrent
                                      ? 'shadow-md'
                                      : 'hover:bg-green-50'
                                    } ${getUtilizationColor(weekTotal)}`}
                                  onClick={() => handleCellClick(employee.id, week.start, week.end, period, week)}
                                >
                                  {Math.round(weekTotal)}%
                                </div>
                              </td>
                            )
                          })}
                        </React.Fragment>
                      ))}
                    </tr>

                    {/* Project Breakdown Rows */}
                    {expandedEmployees.has(employee.id) && (() => {
                      const allProjects = new Set()
                      periods.forEach(period => {
                        period.weeks.forEach(week => {
                          const weekAllocations = getEmployeeWeekAllocations(employee.id, week.start, week.end)
                          weekAllocations.forEach(allocation => {
                            allProjects.add(allocation.project_id)
                          })
                        })
                      })

                      return Array.from(allProjects).map(projectId => {
                        const project = projects.find(p => p.id === projectId)
                        if (!project) return null

                        return (
                          <tr key={projectId} className="bg-slate-25">
                            <td className="px-6 py-2 text-sm text-slate-700 pl-12 border-r border-slate-200 sticky left-0 bg-white z-10 w-80">
                              <div className="flex items-center">
                                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                                {project.name}
                              </div>
                            </td>
                            {periods.map((period, periodIndex) => (
                              <React.Fragment key={periodIndex}>
                                {period.weeks.map((week, weekIndex) => {
                                  const weekAllocations = getEmployeeWeekAllocations(employee.id, week.start, week.end)
                                  const projectAllocation = weekAllocations.find(alloc => alloc.project_id === projectId)
                                  const allocation = projectAllocation?.allocation_percentage || 0
                                  const isCurrent = isCurrentWeek(week.start, week.end)
                                  const isSelected = isWeekSelected(week.start, week.end)

                                  // Determine cell background based on priority: selected > current > default
                                  let cellClass = 'px-2 py-2 text-center border-r border-slate-200 w-24'
                                  if (isSelected) {
                                    cellClass += ' bg-green-50'
                                  } else if (isCurrent) {
                                    cellClass += ' bg-green-50'
                                  }

                                  return (
                                    <td key={weekIndex} className={cellClass}>
                                      {allocation > 0 ? (
                                        <div
                                          className={`text-sm px-2 py-1 rounded cursor-pointer transition-colors ${isSelected
                                            ? 'bg-green-100 text-green-800 shadow-sm'
                                            : isCurrent
                                              ? 'bg-green-100 shadow-sm'
                                              : 'bg-green-50 hover:bg-green-100'
                                            }`}
                                          onClick={() => handleCellClick(employee.id, week.start, week.end, period, week)}
                                        >
                                          {allocation}%
                                        </div>
                                      ) : (
                                        <div
                                          className={`text-sm text-slate-400 cursor-pointer rounded px-2 py-1 transition-colors ${isSelected
                                            ? 'bg-green-50 text-green-600'
                                            : isCurrent
                                              ? 'bg-green-50'
                                              : 'hover:bg-green-50'
                                            }`}
                                          onClick={() => handleCellClick(employee.id, week.start, week.end, period, week)}
                                        >
                                          -
                                        </div>
                                      )}
                                    </td>
                                  )
                                })}
                              </React.Fragment>
                            ))}
                          </tr>
                        )
                      })
                    })()}
                  </React.Fragment>
                ))}
              </React.Fragment>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

// Allocation Edit Modal Component
const AllocationEditModal = ({
  editingAllocation,
  onClose,
  setEditingAllocation,
  projects,
  employees,
  weeklyAllocations,
  fetchProjects,
  updateAllocations, // Callback to update allocations optimistically
  showNotification,
  isSaving,
  setIsSaving,
  isUpdatingAllocation,
  setIsUpdatingAllocation,
  isDeletingAllocation,
  setIsDeletingAllocation,
  setExpandedDepartments,
  setExpandedEmployees,
  setDeleteConfirmation,
  getWeekNumber,
  formatDateLocal,
  hasPermission,
  formatDateReadable,
  splitAllocations,
  setSplitAllocations,
  setCurrentAllocationsEditModal,
  onSave
}) => {
  const [allocations, setAllocations] = useState([])
  const [originalAllocations, setOriginalAllocations] = useState([])
  const [deletedAllocationIds, setDeletedAllocationIds] = useState(new Set())
  const [pendingAllocations, setPendingAllocations] = useState([]) // New allocations waiting to be saved
  const [newAllocation, setNewAllocation] = useState({
    project_id: '',
    allocation_percentage: '',
    role: editingAllocation?.employee?.designation || editingAllocation?.employee?.role || '',
    start_date: '',
    end_date: ''
  })
  const [duplicateError, setDuplicateError] = useState('')

  // State for project search
  const [projectSearchTerm, setProjectSearchTerm] = useState('')
  const [showProjectDropdown, setShowProjectDropdown] = useState(false)

  // Week selector state
  const [startWeekMonth, setStartWeekMonth] = useState(new Date())
  const [endWeekMonth, setEndWeekMonth] = useState(new Date())
  const [selectedStartWeek, setSelectedStartWeek] = useState(null)
  const [selectedEndWeek, setSelectedEndWeek] = useState(null)

  // Helper function to get week-specific allocation data
  const getWeekSpecificAllocation = (allocation, weekStart, weekEnd) => {
    if (!allocation || !weekStart || !weekEnd) return null

    const allocationStart = new Date(allocation.start_date)
    const allocationEnd = new Date(allocation.end_date)

    // Calculate the intersection of allocation period with the selected week
    const intersectionStart = new Date(Math.max(allocationStart.getTime(), weekStart.getTime()))
    const intersectionEnd = new Date(Math.min(allocationEnd.getTime(), weekEnd.getTime()))

    // If there's no intersection, return null
    if (intersectionStart > intersectionEnd) return null

    return {
      ...allocation,
      start_date: formatDateLocal(intersectionStart), // Set to week-specific start date
      end_date: formatDateLocal(intersectionEnd),     // Set to week-specific end date
      week_start_date: formatDateLocal(intersectionStart),
      week_end_date: formatDateLocal(intersectionEnd),
      original_start_date: allocation.start_date,
      original_end_date: allocation.end_date,
      isPartialWeek: intersectionStart.getTime() !== allocationStart.getTime() ||
        intersectionEnd.getTime() !== allocationEnd.getTime()
    }
  }

  // Week utility functions (getWeekNumber and formatDateLocal are now passed as props from parent)

  const getWeekStart = (date) => {
    const weekStart = new Date(date)
    weekStart.setDate(date.getDate() - date.getDay())
    weekStart.setHours(0, 0, 0, 0) // Set to start of day to avoid timezone issues
    return weekStart
  }

  const getWeekEnd = (date) => {
    const weekEnd = new Date(date)
    weekEnd.setDate(date.getDate() + (6 - date.getDay()))
    weekEnd.setHours(23, 59, 59, 999) // Set to end of day
    return weekEnd
  }

  // Helper function to get the start of the current week (Sunday)
  const getCurrentWeekStart = () => {
    const today = new Date()
    return getWeekStart(today)
  }

  // Check if the selected week is in the past
  const isSelectedWeekInPast = () => {
    if (!editingAllocation?.weekStart) return false
    const currentWeekStart = getCurrentWeekStart()
    const selectedWeekStart = getWeekStart(editingAllocation.weekStart)

    // Set time to 00:00:00 to avoid timezone issues
    currentWeekStart.setHours(0, 0, 0, 0)
    selectedWeekStart.setHours(0, 0, 0, 0)

    // Only consider weeks that are strictly before the current week as "past"
    // The current week itself should be editable
    return selectedWeekStart.getTime() < currentWeekStart.getTime()
  }

  const formatWeekDisplay = (weekStart) => {
    const weekEnd = getWeekEnd(weekStart)
    const weekNumber = getWeekNumber(weekStart)
    const startMonth = weekStart.toLocaleDateString('en-US', { month: 'short' })
    const startDay = weekStart.getDate()
    const endMonth = weekEnd.toLocaleDateString('en-US', { month: 'short' })
    const endDay = weekEnd.getDate()

    return `Week ${weekNumber} (${startMonth} ${startDay} – ${endMonth} ${endDay})`
  }

  const getWeeksInMonth = (date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)

    const weeks = []
    let currentWeekStart = getWeekStart(firstDay)

    // For Start Week selector, we need to show more weeks to include past weeks
    // that might be relevant to the allocation period
    const startDate = new Date(firstDay)
    startDate.setDate(startDate.getDate() - 14) // Go back 2 weeks to show past weeks

    while (currentWeekStart <= lastDay) {
      const weekEnd = getWeekEnd(currentWeekStart)
      // Include weeks that have at least one day in the current month
      // OR are within 2 weeks before the current month (for past weeks)
      if ((weekEnd >= firstDay && currentWeekStart <= lastDay) ||
        (currentWeekStart >= startDate && currentWeekStart < firstDay)) {
        weeks.push({
          start: new Date(currentWeekStart),
          end: new Date(weekEnd),
          display: formatWeekDisplay(currentWeekStart)
        })
      }
      currentWeekStart.setDate(currentWeekStart.getDate() + 7)
    }

    return weeks
  }

  const navigateMonth = (currentMonth, direction, isStartWeek) => {
    const newMonth = new Date(currentMonth)
    newMonth.setMonth(currentMonth.getMonth() + direction)

    if (isStartWeek) {
      setStartWeekMonth(newMonth)
    } else {
      setEndWeekMonth(newMonth)
    }
  }

  const handleWeekSelection = (week, isStartWeek) => {
    if (isStartWeek) {
      setSelectedStartWeek(week)
      setNewAllocation({
        ...newAllocation,
        start_date: formatDateLocal(week.start)
      })
    } else {
      setSelectedEndWeek(week)
      setNewAllocation({
        ...newAllocation,
        end_date: formatDateLocal(week.end)
      })
    }
  }

  // Handle clicking outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showProjectDropdown && !event.target.closest('.project-dropdown-container')) {
        setShowProjectDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showProjectDropdown])

  // Initialize allocations when modal opens
  useEffect(() => {
    if (editingAllocation) {
      console.log('Modal opened with editingAllocation:', editingAllocation)
      const initialAllocations = editingAllocation.allocations || []

      // Convert to week-specific allocations
      const weekSpecificAllocations = initialAllocations
        .map(allocation => getWeekSpecificAllocation(allocation, editingAllocation.weekStart, editingAllocation.weekEnd))
        .filter(allocation => allocation !== null)

      // Consolidate allocations by project - keep only the latest one for each project
      const consolidatedAllocations = weekSpecificAllocations.reduce((acc, allocation) => {
        const existingAllocation = acc.find(accAlloc => accAlloc.project_id === allocation.project_id)

        if (!existingAllocation) {
          // First allocation for this project
          acc.push(allocation)
        } else {
          // Compare original start dates to keep the latest allocation
          const existingDate = new Date(existingAllocation.original_start_date)
          const currentDate = new Date(allocation.original_start_date)

          if (currentDate > existingDate) {
            // Replace with newer allocation
            const index = acc.findIndex(accAlloc => accAlloc.project_id === allocation.project_id)
            acc[index] = allocation
          }
        }

        return acc
      }, [])

      setAllocations(consolidatedAllocations)
      setOriginalAllocations(consolidatedAllocations)
      setDeletedAllocationIds(new Set()) // Reset deleted allocations

      // Set default dates for new allocation
      const weekStart = editingAllocation.weekStart
      const weekEnd = editingAllocation.weekEnd
      console.log('Week dates:', { weekStart, weekEnd })

      // Initialize week selectors
      if (weekStart) {
        setStartWeekMonth(new Date(weekStart))
        const startWeek = {
          start: new Date(weekStart),
          end: getWeekEnd(weekStart),
          display: formatWeekDisplay(weekStart)
        }
        setSelectedStartWeek(startWeek)
      }

      if (weekEnd) {
        setEndWeekMonth(new Date(weekEnd))
        const endWeek = {
          start: new Date(weekStart), // Use the same weekStart as the start week
          end: new Date(weekEnd),
          display: formatWeekDisplay(weekStart) // Use weekStart for consistent display
        }
        setSelectedEndWeek(endWeek)
      }

      setNewAllocation(prev => ({
        ...prev,
        start_date: weekStart ? formatDateLocal(weekStart) : '',
        end_date: weekEnd ? formatDateLocal(weekEnd) : ''
      }))

      // Reset search state
      setProjectSearchTerm('')
      setShowProjectDropdown(false)
    }
  }, [editingAllocation])

  // Handle adding allocation for week-specific modal (preview system)
  const handleAddAllocation = () => {
    if (newAllocation.project_id && newAllocation.allocation_percentage && newAllocation.allocation_percentage > 0) {
      // Validate allocation percentage - cannot exceed 100% for a single project
      if (newAllocation.allocation_percentage > 100) {
        setDuplicateError('Allocation cannot exceed 100% for a single project. Please reduce the allocation percentage.')
        return
      }

      // Validate date range
      if (newAllocation.start_date && newAllocation.end_date) {
        const startDate = new Date(newAllocation.start_date)
        const endDate = new Date(newAllocation.end_date)

        if (endDate < startDate) {
          showNotification('error', 'End date cannot be before start date. Please correct the dates.')
          return
        }
      }
      const projectId = parseInt(newAllocation.project_id)

      // Check if project is already assigned to this employee (including pending allocations)
      const isDuplicate = allocations.some(alloc => alloc.project_id === projectId) ||
        pendingAllocations.some(alloc => alloc.project_id === projectId)

      if (isDuplicate) {
        const project = projects.find(p => p.id === projectId)
        setDuplicateError(`Project "${project ? project.name : 'Unknown Project'}" is already assigned to this employee.`)
        return
      }

      // Clear any previous error
      setDuplicateError('')

      // Create pending allocation object
      const pendingAllocation = {
        id: `pending_${Date.now()}`, // Temporary ID for pending allocations
        employee_id: editingAllocation.employeeId,
        project_id: projectId,
        role: newAllocation.role || 'Team Member',
        allocation_percentage: parseInt(newAllocation.allocation_percentage),
        start_date: newAllocation.start_date || (editingAllocation.weekStart ? formatDateLocal(editingAllocation.weekStart) : ''),
        end_date: newAllocation.end_date || (editingAllocation.weekEnd ? formatDateLocal(editingAllocation.weekEnd) : ''),
        status: 'Active',
        billable: true,
        isPending: true // Flag to identify pending allocations
      }

      // Add to pending allocations
      setPendingAllocations(prev => [...prev, pendingAllocation])

      // Reset form
      setNewAllocation({
        project_id: '',
        allocation_percentage: '',
        role: '',
        start_date: editingAllocation.weekStart ? formatDateLocal(editingAllocation.weekStart) : '',
        end_date: editingAllocation.weekEnd ? formatDateLocal(editingAllocation.weekEnd) : '',
        dynamicRange: ''
      })

      // Reset search state
      setProjectSearchTerm('')
      setShowProjectDropdown(false)

      const project = projects.find(p => p.id === projectId)
      const projectName = project ? project.name : 'Unknown Project'
      showNotification('success', `Allocation for ${projectName} added to preview. Click "Save Allocations" to confirm.`)
    }
  }

  // Handle adding allocation for general allocation modal (direct save)
  const handleAddGeneralAllocation = async () => {
    // Validate all required fields
    const missingFields = []

    if (!newAllocation.project_id) {
      missingFields.push('Project')
    }
    if (!newAllocation.allocation_percentage || newAllocation.allocation_percentage <= 0) {
      missingFields.push('Allocation %')
    }
    if (!selectedStartWeek) {
      missingFields.push('Start Week')
    }
    if (!selectedEndWeek) {
      missingFields.push('End Week')
    }
    if (!newAllocation.role) {
      missingFields.push('Role')
    }

    if (missingFields.length > 0) {
      alert(`Please fill in all required fields: ${missingFields.join(', ')}`)
      return
    }

    if (newAllocation.project_id && newAllocation.allocation_percentage && newAllocation.allocation_percentage > 0) {
      // Validate date range
      if (newAllocation.start_date && newAllocation.end_date) {
        const startDate = new Date(newAllocation.start_date)
        const endDate = new Date(newAllocation.end_date)

        if (endDate < startDate) {
          showNotification('error', 'End date cannot be before start date. Please correct the dates.')
          return
        }
      }
      const projectId = parseInt(newAllocation.project_id)

      // Clear any previous error
      setDuplicateError('')

      // Set loading state
      setIsSaving(true)

      try {
        const token = getCookie(TOKEN)
        if (!token) {
          showNotification('error', 'Authentication token not found')
          return
        }

        // Find existing allocations for the same project and employee that overlap with the new date range
        const newStartDate = new Date(newAllocation.start_date || (selectedStartWeek ? formatDateLocal(selectedStartWeek.start) : ''))
        const newEndDate = new Date(newAllocation.end_date || (selectedEndWeek ? formatDateLocal(selectedEndWeek.end) : ''))

        const existingAllocations = weeklyAllocations.filter(allocation => {
          if (allocation.employee_id !== editingAllocation.employeeId ||
            allocation.project_id !== projectId ||
            allocation.status !== 'Active' ||
            deletedAllocationIds.has(allocation.id)) {
            return false
          }

          // Check if the existing allocation overlaps with the new date range
          const existingStartDate = new Date(allocation.start_date)
          const existingEndDate = new Date(allocation.end_date)

          // Two date ranges overlap if: start1 <= end2 AND start2 <= end1
          return existingStartDate <= newEndDate && newStartDate <= existingEndDate
        })

        // Handle overlapping allocations by splitting them
        const splitPromises = existingAllocations.map(async (existingAllocation) => {
          const existingStartDate = new Date(existingAllocation.start_date)
          const existingEndDate = new Date(existingAllocation.end_date)

          // Create new allocations for the non-overlapping parts
          const newAllocations = []

          // Before the new range
          if (existingStartDate < newStartDate) {
            const beforeEndDate = new Date(newStartDate)
            beforeEndDate.setDate(beforeEndDate.getDate() - 1)

            if (existingStartDate <= beforeEndDate) {
              newAllocations.push({
                employee_id: existingAllocation.employee_id,
                project_id: existingAllocation.project_id,
                role: existingAllocation.role,
                allocation_percentage: existingAllocation.allocation_percentage,
                start_date: formatDateLocal(existingStartDate),
                end_date: formatDateLocal(beforeEndDate),
                status: 'Active',
                billable: existingAllocation.billable
              })
            }
          }

          // After the new range
          if (existingEndDate > newEndDate) {
            const afterStartDate = new Date(newEndDate)
            afterStartDate.setDate(afterStartDate.getDate() + 1)

            if (afterStartDate <= existingEndDate) {
              newAllocations.push({
                employee_id: existingAllocation.employee_id,
                project_id: existingAllocation.project_id,
                role: existingAllocation.role,
                allocation_percentage: existingAllocation.allocation_percentage,
                start_date: formatDateLocal(afterStartDate),
                end_date: formatDateLocal(existingEndDate),
                status: 'Active',
                billable: existingAllocation.billable
              })
            }
          }

          // Delete the original allocation
          const deleteResponse = await fetch(`${getApiBaseUrl()}/api/allocations/${existingAllocation.id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          })

          if (!deleteResponse.ok) {
            const errorData = await deleteResponse.json()
            console.error('Failed to delete existing allocation:', errorData)
            throw new Error(`Failed to delete existing allocation: ${errorData.error || 'Unknown error'}`)
          }

          // Create new allocations for the non-overlapping parts
          const createPromises = newAllocations.map(async (newAlloc) => {
            const createResponse = await fetch(`${getApiBaseUrl()}/api/allocations`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(newAlloc)
            })

            if (!createResponse.ok) {
              const errorData = await createResponse.json()
              console.error('Failed to create split allocation:', errorData)
              throw new Error(`Failed to create split allocation: ${errorData.error || 'Unknown error'}`)
            }

            return await createResponse.json()
          })

          const createdAllocations = await Promise.all(createPromises)
          return { deleted: existingAllocation, created: createdAllocations }
        })

        // Wait for all overlapping allocations to be processed
        let splitResults = []
        if (splitPromises.length > 0) {
          splitResults = await Promise.all(splitPromises)
          const totalDeleted = splitResults.length
          const totalCreated = splitResults.reduce((sum, result) => sum + result.created.length, 0)
          console.log(`Processed ${totalDeleted} overlapping allocation(s), created ${totalCreated} new allocation(s)`)
        }

        const startDate = newAllocation.start_date || (selectedStartWeek ? formatDateLocal(selectedStartWeek.start) : '')
        const endDate = newAllocation.end_date || (selectedEndWeek ? formatDateLocal(selectedEndWeek.end) : '')

        const allocationPayload = {
          employee_id: editingAllocation.employeeId,
          project_id: projectId,
          role: newAllocation.role || 'Team Member',
          allocation_percentage: parseInt(newAllocation.allocation_percentage),
          start_date: startDate,
          end_date: endDate,
          status: 'Active',
          billable: true
        }

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
          throw new Error(errorData.error || 'Failed to save allocation')
        }

        const createdAllocation = await response.json()
        console.log('Allocation created successfully:', createdAllocation)

        // Update state optimistically
        if (createdAllocation.allocation) {
          updateAllocations(prev => {
            let updated = [...prev]

            // Remove split allocations that were replaced
            if (splitResults.length > 0) {
              splitResults.forEach(result => {
                if (result.deleted && result.deleted.id) {
                  updated = updated.filter(a => a.id !== result.deleted.id)
                }
                // Add newly created split allocations
                if (result.created && Array.isArray(result.created)) {
                  result.created.forEach(alloc => {
                    if (alloc.allocation) {
                      updated.push(alloc.allocation)
                    }
                  })
                }
              })
            }

            // Add the new allocation
            updated.push(createdAllocation.allocation)

            return updated
          })
        }

        // Reset form
        setNewAllocation({
          project_id: '',
          allocation_percentage: '',
          role: '',
          start_date: '',
          end_date: ''
        })

        // Reset search state
        setProjectSearchTerm('')
        setShowProjectDropdown(false)

        const project = projects.find(p => p.id === projectId)
        const projectName = project ? project.name : 'Unknown Project'

        // Show appropriate success message
        if (existingAllocations.length > 0) {
          const totalCreated = splitResults.reduce((sum, result) => sum + result.created.length, 0)
          if (totalCreated > 0) {
            showNotification('success', `Allocation for ${projectName} updated successfully! (Split ${existingAllocations.length} existing allocation(s) and preserved ${totalCreated} non-overlapping part(s))`)
          } else {
            showNotification('success', `Allocation for ${projectName} updated successfully! (Replaced ${existingAllocations.length} existing allocation(s))`)
          }
        } else {
          showNotification('success', `Allocation for ${projectName} created successfully!`)
        }

        // Note: Removed fetchProjects() call - using optimistic updates instead

        // Auto-expand the employee's department and the employee itself
        if (editingAllocation?.employee) {
          const employee = editingAllocation.employee
          const department = employee.department

          // Expand the department
          setExpandedDepartments(prev => new Set([...prev, department]))

          // Expand the employee
          setExpandedEmployees(prev => new Set([...prev, employee.id]))
        }

        // Close the modal after successful creation
        setTimeout(() => {
          onClose()
        }, 1000) // Small delay to show the success message

      } catch (error) {
        console.error('Error creating allocation:', error)
        showNotification('error', 'Error creating allocation: ' + error.message)
      } finally {
        setIsSaving(false)
      }
    }
  }

  const handleRemoveAllocation = async (allocationId) => {
    const allocation = allocations.find(alloc => alloc.id === allocationId)
    if (!allocation) return

    // Check if this is a partial week allocation
    if (allocation.isPartialWeek) {
      // For partial weeks, we need to split the allocation
      const weekStart = editingAllocation.weekStart
      const weekEnd = editingAllocation.weekEnd
      const originalStart = new Date(allocation.original_start_date)
      const originalEnd = new Date(allocation.original_end_date)

      try {
        const token = getCookie(TOKEN)
        if (!token) {
          showNotification('error', 'Authentication token not found')
          return
        }

        // Create new allocations for the periods before and after the selected week
        const newAllocations = []

        console.log('Splitting allocation:', {
          originalStart: originalStart.toISOString().split('T')[0],
          originalEnd: originalEnd.toISOString().split('T')[0],
          weekStart: weekStart.toISOString().split('T')[0],
          weekEnd: weekEnd.toISOString().split('T')[0]
        })

        // Before the selected week
        if (originalStart < weekStart) {
          const beforeEnd = new Date(weekStart)
          beforeEnd.setDate(beforeEnd.getDate() - 1)

          // Validate that the before period is valid
          if (originalStart <= beforeEnd) {
            newAllocations.push({
              employee_id: allocation.employee_id,
              project_id: allocation.project_id,
              role: allocation.role,
              allocation_percentage: allocation.allocation_percentage,
              start_date: formatDateLocal(originalStart),
              end_date: formatDateLocal(beforeEnd),
              status: 'Active',
              billable: allocation.billable
            })
            console.log('Added before allocation:', {
              start_date: originalStart.toISOString().split('T')[0],
              end_date: beforeEnd.toISOString().split('T')[0]
            })
          } else {
            console.log('Skipping before allocation - invalid date range')
          }
        }

        // After the selected week
        if (originalEnd > weekEnd) {
          const afterStart = new Date(weekEnd)
          afterStart.setDate(afterStart.getDate() + 1)

          // Validate that the after period is valid
          if (afterStart <= originalEnd) {
            newAllocations.push({
              employee_id: allocation.employee_id,
              project_id: allocation.project_id,
              role: allocation.role,
              allocation_percentage: allocation.allocation_percentage,
              start_date: formatDateLocal(afterStart),
              end_date: formatDateLocal(originalEnd),
              status: 'Active',
              billable: allocation.billable
            })
            console.log('Added after allocation:', {
              start_date: afterStart.toISOString().split('T')[0],
              end_date: originalEnd.toISOString().split('T')[0]
            })
          } else {
            console.log('Skipping after allocation - invalid date range')
          }
        }

        // If no valid new allocations were created, just delete the original allocation
        if (newAllocations.length === 0) {
          console.log('No valid new allocations to create, just deleting the original allocation')

          const deleteResponse = await fetch(`${getApiBaseUrl()}/api/allocations/${allocation.id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          })

          if (!deleteResponse.ok) {
            throw new Error('Failed to delete allocation')
          }

          const deleteResult = await deleteResponse.json()

          // Update state optimistically
          if (deleteResult.deleted_allocation_id) {
            updateAllocations(prev => prev.filter(a => a.id !== deleteResult.deleted_allocation_id))
          }

          showNotification('success', 'Allocation removed for this week!')

          // Remove from local state
          setAllocations(prev => prev.filter(alloc => alloc.id !== allocationId))
          setDeletedAllocationIds(prev => new Set([...prev, allocationId]))

          // Note: Removed fetchProjects() call - using optimistic updates instead

          // Close the modal after successful deletion
          onClose()
          return
        }

        // Delete the original allocation
        const deleteResponse = await fetch(`${getApiBaseUrl()}/api/allocations/${allocation.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status: 'Inactive' })
        })

        if (!deleteResponse.ok) {
          throw new Error('Failed to delete allocation')
        }

        // Create new allocations for the remaining periods and collect responses
        const createdAllocations = []
        for (const newAlloc of newAllocations) {
          // Validate the allocation data before sending
          if (!newAlloc.employee_id || !newAlloc.project_id || !newAlloc.start_date) {
            console.error('Invalid allocation data:', newAlloc)
            throw new Error('Invalid allocation data: missing required fields (employee_id, project_id, or start_date)')
          }

          // Validate date range if end_date is provided
          if (newAlloc.end_date) {
            const startDate = new Date(newAlloc.start_date)
            const endDate = new Date(newAlloc.end_date)
            if (endDate < startDate) {
              console.error('Invalid date range:', { start_date: newAlloc.start_date, end_date: newAlloc.end_date })
              throw new Error('Invalid date range: end_date cannot be before start_date')
            }
          }

          // Ensure allocation percentage is a number and handle end_date properly
          const validatedAlloc = {
            ...newAlloc,
            allocation_percentage: parseInt(newAlloc.allocation_percentage) || 0,
            billable: newAlloc.billable !== undefined ? newAlloc.billable : true,
            // Ensure end_date is not null or empty string
            end_date: newAlloc.end_date || null
          }

          // Remove end_date from payload if it's null to avoid issues
          if (validatedAlloc.end_date === null) {
            delete validatedAlloc.end_date
          }

          console.log('Creating new allocation with payload:', validatedAlloc)

          const createResponse = await fetch(`${getApiBaseUrl()}/api/allocations`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(validatedAlloc)
          })

          if (!createResponse.ok) {
            const errorData = await createResponse.json()
            console.error('Failed to create new allocation:', errorData)
            throw new Error(`Failed to create new allocation: ${errorData.error || 'Unknown error'}`)
          }

          const createdAllocation = await createResponse.json()
          console.log('New allocation created successfully:', createdAllocation)
          if (createdAllocation.allocation) {
            createdAllocations.push(createdAllocation.allocation)
          }
        }

        // Update state optimistically
        updateAllocations(prev => {
          // Remove the original allocation
          let updated = prev.filter(a => a.id !== allocation.id)
          // Add all newly created allocations from split
          return [...updated, ...createdAllocations]
        })

        showNotification('success', 'Allocation removed for this week only!')

        // Remove from local state
        setAllocations(prev => prev.filter(alloc => alloc.id !== allocationId))
        setDeletedAllocationIds(prev => new Set([...prev, allocationId]))

        // Note: Removed fetchProjects() call - using optimistic updates instead

        // Close the modal after successful deletion
        onClose()

      } catch (error) {
        console.error('Error removing week-specific allocation:', error)

        // If splitting fails, offer to just delete the entire allocation
        const shouldDeleteEntire = confirm(
          'Failed to split the allocation. Would you like to delete the entire allocation instead? ' +
          'This will remove the allocation for all weeks, not just this week.'
        )

        if (shouldDeleteEntire) {
          try {
            const token = getCookie(TOKEN)
            if (!token) {
              showNotification('error', 'Authentication token not found')
              return
            }

            // Just soft delete the entire allocation
            const deleteResponse = await fetch(`${getApiBaseUrl()}/api/allocations/${allocation.id}`, {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            })

            if (!deleteResponse.ok) {
              throw new Error('Failed to delete allocation')
            }

            const deleteResult = await deleteResponse.json()

            // Update state optimistically
            if (deleteResult.deleted_allocation_id) {
              updateAllocations(prev => prev.filter(a => a.id !== deleteResult.deleted_allocation_id))
            }

            showNotification('success', 'Allocation deleted successfully!')

            // Remove from local state
            setAllocations(prev => prev.filter(alloc => alloc.id !== allocationId))
            setDeletedAllocationIds(prev => new Set([...prev, allocationId]))

            // Note: Removed fetchProjects() call - using optimistic updates instead

            // Close the modal after successful deletion
            onClose()

          } catch (deleteError) {
            console.error('Error deleting entire allocation:', deleteError)
            showNotification('error', 'Error deleting allocation: ' + deleteError.message)
          }
        } else {
          showNotification('error', 'Allocation removal cancelled. The allocation remains unchanged.')
        }
      }
    } else {
      // For full week allocations, just remove normally
      setAllocations(prev => prev.filter(alloc => alloc.id !== allocationId))
    }
  }

  const handleProjectChange = (projectId) => {
    setNewAllocation({ ...newAllocation, project_id: projectId })
    setProjectSearchTerm('')
    setShowProjectDropdown(false)
    // Clear duplicate error when user changes project selection
    if (duplicateError) {
      setDuplicateError('')
    }
  }

  const handleUpdateAllocationLocal = (allocationId, updatedAllocation) => {
    const allocation = allocations.find(alloc => alloc.id === allocationId)
    if (!allocation) return

    // For weekly allocation editing, we should just update the allocation in place
    // The splitting logic should only happen when actually saving to the database
    // Preserve the original allocation percentage for splitting logic
    setAllocations(prev => prev.map(alloc =>
      alloc.id === allocationId ? {
        ...alloc,
        ...updatedAllocation,
        original_allocation_percentage: alloc.original_allocation_percentage || alloc.allocation_percentage
      } : alloc
    ))
  }

  const handleSave = async () => {
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

      // Include pending allocations as new allocations to be added
      const allAddedAllocations = [...addedAllocations, ...pendingAllocations]

      await onSave({
        added: allAddedAllocations,
        removed: removedAllocations,
        updated: updatedAllocations,
        unchanged: unchangedAllocations,
        all: [...allocations, ...pendingAllocations]
      })

      // Clear pending allocations after successful save
      setPendingAllocations([])
    } catch (error) {
      console.error('Error saving allocations:', error)
      showNotification('error', 'Error saving allocations: ' + error.message)
    }
  }

  const getTotalAllocation = () => {
    const currentTotal = allocations.reduce((total, alloc) => total + (alloc.allocation_percentage || 0), 0)
    const pendingTotal = pendingAllocations.reduce((total, alloc) => total + (alloc.allocation_percentage || 0), 0)
    return currentTotal + pendingTotal
  }

  // Validation function to check if any allocation exceeds 100% for a single project
  const hasInvalidAllocation = () => {
    // Check existing allocations
    const hasInvalidExisting = allocations.some(alloc => {
      const percentage = alloc.allocation_percentage || 0
      return percentage > 100
    })

    // Check pending allocations
    const hasInvalidPending = pendingAllocations.some(alloc => {
      const percentage = alloc.allocation_percentage || 0
      return percentage > 100
    })

    return hasInvalidExisting || hasInvalidPending
  }

  // Get validation error message
  const getAllocationValidationError = () => {
    if (hasInvalidAllocation()) {
      return 'One or more allocations exceed 100% for a single project. Please reduce the allocation percentage.'
    }
    if (getTotalAllocation() > 100) {
      return 'Total allocation exceeds 100%. Please adjust allocations.'
    }
    return null
  }

  const getProjectName = (projectId) => {
    const project = projects.find(p => p.id === projectId)
    return project ? project.name : 'Unknown Project'
  }

  // Filter projects based on search term
  const getFilteredProjects = () => {
    if (!projectSearchTerm.trim()) {
      return projects
    }
    return projects.filter(project =>
      project.name.toLowerCase().includes(projectSearchTerm.toLowerCase())
    )
  }

  // Handle project selection
  const handleProjectSelect = (projectId) => {
    setNewAllocation({ ...newAllocation, project_id: projectId })
    setProjectSearchTerm('')
    setShowProjectDropdown(false)
    // Clear duplicate error when user changes project selection
    if (duplicateError) {
      setDuplicateError('')
    }
  }

  // Handle project search input change
  const handleProjectSearchChange = (value) => {
    setProjectSearchTerm(value)
    setShowProjectDropdown(true)
    // Clear project selection if search doesn't match current selection
    if (newAllocation.project_id) {
      const selectedProject = projects.find(p => p.id === newAllocation.project_id)
      if (!selectedProject || !selectedProject.name.toLowerCase().includes(value.toLowerCase())) {
        setNewAllocation({ ...newAllocation, project_id: '' })
      }
    }
  }

  if (!editingAllocation) return null

  // State for editing existing allocation (week-specific edit)
  const [editForm, setEditForm] = useState({
    project_id: '',
    allocation_percentage: '',
    role: ''
  })

  // Initialize edit form when editing existing allocation (week-specific edit)
  useEffect(() => {
    if (editingAllocation?.isEditingExisting && editingAllocation?.allocation) {
      setEditForm({
        project_id: editingAllocation.allocation.project_id,
        allocation_percentage: editingAllocation.allocation.allocation_percentage,
        role: editingAllocation.allocation.role
      })
    }
  }, [editingAllocation])

  // Initialize edit form when editing full allocation
  useEffect(() => {
    if (editingAllocation?.isEditingFullAllocation && editingAllocation?.allocation) {
      setEditForm({
        project_id: editingAllocation.allocation.project_id,
        allocation_percentage: editingAllocation.allocation.allocation_percentage,
        role: editingAllocation.allocation.role
      })
    }
  }, [editingAllocation])

  // Handle updating full allocation (entire allocation period)
  const handleUpdateFullAllocation = async () => {
    if (!editingAllocation?.isEditingFullAllocation) return

    setIsUpdatingAllocation(true)
    try {
      const token = getCookie(TOKEN)
      if (!token) {
        showNotification('error', 'Authentication token not found')
        return
      }

      const allocation = editingAllocation.allocation

      // For full allocation editing, we simply update the entire allocation
      const allocationPayload = {
        employee_id: allocation.employee_id,
        project_id: editForm.project_id,
        role: editForm.role,
        allocation_percentage: editForm.allocation_percentage,
        start_date: allocation.start_date,
        end_date: allocation.end_date,
        status: 'Active',
        billable: allocation.billable
      }

      console.log('Updating full allocation payload:', allocationPayload)

      const response = await fetch(`${getApiBaseUrl()}/api/allocations/${allocation.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(allocationPayload)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to update allocation')
      }

      const result = await response.json()

      // Update state optimistically
      if (result.allocation) {
        updateAllocations(prev => {
          return prev.map(alloc =>
            alloc.id === allocation.id ? result.allocation : alloc
          )
        })
      }

      showNotification('success', 'Allocation updated successfully')

      // Close the modal
      onClose()

      // Refresh the data
      // await fetchProjects() // Removed to prevent unnecessary refetching

    } catch (error) {
      console.error('Error updating allocation:', error)
      showNotification('error', error.message || 'Failed to update allocation')
    } finally {
      setIsUpdatingAllocation(false)
    }
  }

  // Handle updating existing allocation (week-specific edit)
  const handleUpdateAllocation = async () => {
    if (!editingAllocation?.isEditingExisting) return

    setIsUpdatingAllocation(true)
    try {
      const token = getCookie(TOKEN)
      if (!token) {
        showNotification('error', 'Authentication token not found')
        return
      }

      const allocation = editingAllocation.allocation
      const weekStart = editingAllocation.weekStart
      const weekEnd = editingAllocation.weekEnd
      const originalStart = new Date(allocation.original_start_date || allocation.start_date)
      const originalEnd = new Date(allocation.original_end_date || allocation.end_date)

      // For weekly allocation editing, we always need to split the allocation
      // to ensure only the selected week is updated, regardless of whether it's a partial week or not
      console.log('Updating weekly allocation:', {
        originalStart: originalStart.toISOString().split('T')[0],
        originalEnd: originalEnd.toISOString().split('T')[0],
        weekStart: weekStart.toISOString().split('T')[0],
        weekEnd: weekEnd.toISOString().split('T')[0]
      })

      // Create new allocations for the periods before and after the selected week
      const newAllocations = []

      // Before the selected week
      if (originalStart < weekStart) {
        const beforeEnd = new Date(weekStart)
        beforeEnd.setDate(beforeEnd.getDate() - 1)

        if (originalStart <= beforeEnd) {
          newAllocations.push({
            employee_id: allocation.employee_id,
            project_id: allocation.project_id,
            role: allocation.role,
            allocation_percentage: allocation.allocation_percentage,
            start_date: formatDateLocal(originalStart),
            end_date: formatDateLocal(beforeEnd),
            status: 'Active',
            billable: allocation.billable
          })
        }
      }

      // The selected week (with updated values)
      newAllocations.push({
        employee_id: allocation.employee_id,
        project_id: parseInt(editForm.project_id),
        role: editForm.role,
        allocation_percentage: parseInt(editForm.allocation_percentage),
        start_date: formatDateLocal(weekStart),
        end_date: formatDateLocal(weekEnd),
        status: 'Active',
        billable: allocation.billable
      })

      // After the selected week
      if (originalEnd > weekEnd) {
        const afterStart = new Date(weekEnd)
        afterStart.setDate(afterStart.getDate() + 1)

        if (afterStart <= originalEnd) {
          newAllocations.push({
            employee_id: allocation.employee_id,
            project_id: allocation.project_id,
            role: allocation.role,
            allocation_percentage: allocation.allocation_percentage,
            start_date: formatDateLocal(afterStart),
            end_date: formatDateLocal(originalEnd),
            status: 'Active',
            billable: allocation.billable
          })
        }
      }

      // Delete the original allocation
      const deleteResponse = await fetch(`${getApiBaseUrl()}/api/allocations/${allocation.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!deleteResponse.ok) {
        throw new Error('Failed to delete original allocation')
      }

      // Create new allocations for all periods and collect responses
      const createdAllocations = []
      for (const newAlloc of newAllocations) {
        const createResponse = await fetch(`${getApiBaseUrl()}/api/allocations`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(newAlloc)
        })

        if (!createResponse.ok) {
          const errorData = await createResponse.json()
          throw new Error(`Failed to create new allocation: ${errorData.error || 'Unknown error'}`)
        }

        const result = await createResponse.json()
        if (result.allocation) {
          createdAllocations.push(result.allocation)
        }
      }

      // Update state optimistically
      updateAllocations(prev => {
        // Remove the original allocation
        let updated = prev.filter(a => a.id !== allocation.id)
        // Add all newly created allocations from split
        return [...updated, ...createdAllocations]
      })

      showNotification('success', 'Allocation updated successfully for this week only!')
      debugger
      // Note: Removed fetchProjects() call - using optimistic updates instead
      onClose()
    } catch (error) {
      console.error('Error updating allocation:', error)
      showNotification('error', 'Error updating allocation: ' + error.message)
    } finally {
      setIsUpdatingAllocation(false)
    }
  }

  // Handle editing existing allocation
  if (editingAllocation?.isEditingExisting) {

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold text-slate-900">
              Edit Allocation - {editingAllocation.employee?.first_name} {editingAllocation.employee?.last_name}
            </h3>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Project</label>
                <select
                  value={editForm.project_id}
                  onChange={(e) => setEditForm({ ...editForm, project_id: e.target.value })}
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
                  value={editForm.allocation_percentage}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 0
                    // Prevent values greater than 100
                    const clampedValue = value > 100 ? 100 : value
                    setEditForm({ ...editForm, allocation_percentage: clampedValue })
                  }}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${editForm.allocation_percentage > 100
                    ? 'border-red-300 focus:ring-red-500'
                    : 'border-slate-300 focus:ring-green-500'
                    }`}
                />
                {editForm.allocation_percentage > 100 && (
                  <p className="text-red-600 text-sm mt-1 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Allocation cannot exceed 100% for a single project
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                <input
                  type="text"
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  placeholder="e.g., Developer, Designer"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>

            {/* Display current week period as read-only information */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="font-medium text-green-900">Week Period</span>
              </div>
              <p className="text-sm text-green-800">
                This edit applies only to the current week: <strong>
                  {formatDateReadable(editingAllocation.weekStart)} to {formatDateReadable(editingAllocation.weekEnd)}
                </strong>
              </p>
              <p className="text-xs text-green-700 mt-1">
                The allocation dates remain unchanged for other weeks.
              </p>
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:text-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleUpdateAllocation}
              disabled={isUpdatingAllocation}
              className="px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {isUpdatingAllocation && (
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {isUpdatingAllocation ? 'Updating...' : 'Update Allocation'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Handle editing full allocation (entire allocation period)
  if (editingAllocation?.isEditingFullAllocation) {

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold text-slate-900">
              Edit Allocation - {editingAllocation.employee?.first_name} {editingAllocation.employee?.last_name}
            </h3>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Project</label>
                <select
                  value={editForm.project_id}
                  onChange={(e) => setEditForm({ ...editForm, project_id: e.target.value })}
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
                  value={editForm.allocation_percentage}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 0
                    // Prevent values greater than 100
                    const clampedValue = value > 100 ? 100 : value
                    setEditForm({ ...editForm, allocation_percentage: clampedValue })
                  }}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${editForm.allocation_percentage > 100
                    ? 'border-red-300 focus:ring-red-500'
                    : 'border-slate-300 focus:ring-green-500'
                    }`}
                />
                {editForm.allocation_percentage > 100 && (
                  <p className="text-red-600 text-sm mt-1 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Allocation cannot exceed 100% for a single project
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                <input
                  type="text"
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  placeholder="e.g., Developer, Designer"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>

            {/* Display allocation period as read-only information */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="font-medium text-green-900">Allocation Period</span>
              </div>
              <p className="text-sm text-green-700">
                This edit applies to the entire allocation period: <strong>
                  {formatDateReadable(editingAllocation.allocation.start_date)} to {formatDateReadable(editingAllocation.allocation.end_date)}
                </strong>
              </p>
              <p className="text-xs text-green-600 mt-1">
                All weeks in this period will be updated with the new values.
              </p>
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleUpdateFullAllocation}
              disabled={isUpdatingAllocation}
              className="px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isUpdatingAllocation ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Updating...
                </>
              ) : (
                'Update Allocation'
              )}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Handle new allocation creation (unified view)
  if (editingAllocation.isNewAllocation) {
    // Get current week start for filtering
    const currentWeekStart = getCurrentWeekStart()

    // Get all active allocations for this employee, excluding deleted ones and past allocations
    const employeeAllocations = weeklyAllocations.filter(allocation => {
      const allocationEndDate = new Date(allocation.end_date)
      const allocationEndWeekStart = getWeekStart(allocationEndDate)

      return allocation.employee_id === editingAllocation.employeeId &&
        allocation.status === 'Active' &&
        !deletedAllocationIds.has(allocation.id) &&
        allocationEndWeekStart >= currentWeekStart // Only show allocations that end in current week or later
    })

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold text-slate-900">
              Allocations - {editingAllocation.employee?.first_name} {editingAllocation.employee?.last_name}
            </h3>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {/* Add New Allocation */}
          <div className="border-t pt-6">
            <h4 className="text-lg font-medium text-slate-900 mb-4">Add New Allocation</h4>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Project</label>
                  <div className="relative project-dropdown-container">
                    <input
                      type="text"
                      value={projectSearchTerm || (newAllocation.project_id ? getProjectName(newAllocation.project_id) : '')}
                      onChange={(e) => handleProjectSearchChange(e.target.value)}
                      onFocus={() => setShowProjectDropdown(true)}
                      placeholder="Search projects..."
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${duplicateError
                        ? 'border-red-300 focus:ring-red-500'
                        : 'border-slate-300 focus:ring-green-500'
                        }`}
                    />
                    {showProjectDropdown && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {getFilteredProjects().length > 0 ? (
                          getFilteredProjects().map(project => {
                            const isAlreadyAssigned = allocations.some(alloc => alloc.project_id === project.id) ||
                              pendingAllocations.some(alloc => alloc.project_id === project.id)
                            return (
                              <button
                                key={project.id}
                                type="button"
                                onClick={() => handleProjectSelect(project.id)}
                                disabled={isAlreadyAssigned}
                                className={`w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors ${isAlreadyAssigned
                                  ? 'text-slate-400 cursor-not-allowed bg-slate-50'
                                  : 'text-slate-900'
                                  }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span>{project.name}</span>
                                  {isAlreadyAssigned && (
                                    <span className="text-xs text-slate-500">Already Assigned</span>
                                  )}
                                </div>
                              </button>
                            )
                          })
                        ) : (
                          <div className="px-3 py-2 text-slate-500 text-sm">
                            No projects found matching "{projectSearchTerm}"
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {duplicateError && (
                    <p className="text-red-600 text-sm mt-1 flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 0
                      // Prevent values greater than 100
                      const clampedValue = value > 100 ? 100 : value
                      setNewAllocation({ ...newAllocation, allocation_percentage: clampedValue })
                    }}
                    placeholder="e.g., 40"
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${newAllocation.allocation_percentage > 100
                      ? 'border-red-300 focus:ring-red-500'
                      : 'border-slate-300 focus:ring-green-500'
                      }`}
                  />
                  {newAllocation.allocation_percentage > 100 && (
                    <p className="text-red-600 text-sm mt-1 flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Allocation cannot exceed 100% for a single project
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Start Week</label>
                  <div className="border border-slate-300 rounded-lg p-3 bg-white">
                    <div className="flex items-center justify-between mb-2">
                      <button
                        type="button"
                        onClick={() => navigateMonth(startWeekMonth, -1, true)}
                        className="p-1 hover:bg-slate-100 rounded"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <span className="font-medium text-slate-700">
                        {startWeekMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      </span>
                      <button
                        type="button"
                        onClick={() => navigateMonth(startWeekMonth, 1, true)}
                        className="p-1 hover:bg-slate-100 rounded"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {getWeeksInMonth(startWeekMonth).map((week, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => handleWeekSelection(week, true)}
                          className={`w-full text-left p-2 rounded text-sm transition-colors ${selectedStartWeek &&
                            selectedStartWeek.start.getTime() === week.start.getTime()
                            ? 'bg-green-100 text-green-800 border border-green-300'
                            : 'hover:bg-slate-50'
                            }`}
                        >
                          {week.display}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">End Week</label>
                  <div className="border border-slate-300 rounded-lg p-3 bg-white">
                    <div className="flex items-center justify-between mb-2">
                      <button
                        type="button"
                        onClick={() => navigateMonth(endWeekMonth, -1, false)}
                        className="p-1 hover:bg-slate-100 rounded"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <span className="font-medium text-slate-700">
                        {endWeekMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      </span>
                      <button
                        type="button"
                        onClick={() => navigateMonth(endWeekMonth, 1, false)}
                        className="p-1 hover:bg-slate-100 rounded"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {getWeeksInMonth(endWeekMonth).map((week, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => handleWeekSelection(week, false)}
                          className={`w-full text-left p-2 rounded text-sm transition-colors ${selectedEndWeek &&
                            selectedEndWeek.start.getTime() === week.start.getTime()
                            ? 'bg-green-100 text-green-800 border border-green-300'
                            : 'hover:bg-slate-50'
                            }`}
                        >
                          {week.display}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                  <input
                    type="text"
                    value={newAllocation.role}
                    onChange={(e) => setNewAllocation({ ...newAllocation, role: e.target.value })}
                    placeholder="Enter role (e.g., Developer, Designer)"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:text-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAddGeneralAllocation}
              disabled={isSaving}
              className="px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {isSaving && (
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {isSaving ? 'Creating...' : 'Create Allocation'}
            </button>
          </div>
          {/* Current Allocations */}
          <div className="mb-6 mt-2">
            <h4 className="text-lg font-medium text-slate-900 mb-4">Current Allocations</h4>
            {employeeAllocations.length > 0 ? (
              <div className="overflow-x-auto">
                <table id="allocation-table" className="w-full border-collapse border border-slate-300">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="border border-slate-300 px-4 py-3 text-left font-medium text-slate-900">Project Name</th>
                      <th className="border border-slate-300 px-4 py-3 text-left font-medium text-slate-900">Start Week</th>
                      <th className="border border-slate-300 px-4 py-3 text-left font-medium text-slate-900">End Week</th>
                      <th className="border border-slate-300 px-4 py-3 text-left font-medium text-slate-900">Allocation %</th>
                      <th className="border border-slate-300 px-4 py-3 text-left font-medium text-slate-900">Role</th>
                      <th className="border border-slate-300 px-4 py-3 text-center font-medium text-slate-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      // Process allocations to show split allocations when available
                      const processedAllocations = []

                      employeeAllocations.forEach((allocation) => {
                        if (splitAllocations[allocation.id]) {
                          // Show split allocations instead of original
                          splitAllocations[allocation.id].forEach((splitAllocation, splitIndex) => {
                            processedAllocations.push({
                              ...splitAllocation,
                              isSplit: true,
                              originalId: allocation.id,
                              splitIndex
                            })
                          })
                        } else {
                          // Show original allocation
                          processedAllocations.push(allocation)
                        }
                      })

                      // Sort allocations by start date (ascending order)
                      const sortedAllocations = processedAllocations.sort((a, b) => {
                        const dateA = new Date(a.start_date)
                        const dateB = new Date(b.start_date)
                        return dateA - dateB
                      })

                      return sortedAllocations.map((allocation, index) => {
                        const project = projects.find(p => p.id === allocation.project_id)
                        const startDate = new Date(allocation.start_date)
                        const endDate = new Date(allocation.end_date)
                        // Calculate week start and end dates
                        const getWeekStart = (date) => {
                          const weekStart = new Date(date)
                          weekStart.setDate(date.getDate() - date.getDay())
                          return weekStart
                        }
                        const getWeekEnd = (date) => {
                          const weekEnd = new Date(date)
                          weekEnd.setDate(date.getDate() + (6 - date.getDay()))
                          return weekEnd
                        }

                        // Get the week that contains the start date
                        const startWeekStart = getWeekStart(startDate)
                        const startWeekEnd = getWeekEnd(startDate)
                        const startWeek = getWeekNumber(startWeekStart)

                        // Get the week that contains the end date
                        const endWeekStart = getWeekStart(endDate)
                        const endWeekEnd = getWeekEnd(endDate)
                        const endWeek = getWeekNumber(endWeekStart)

                        const startWeekDisplay = `W${startWeek} (${startWeekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${startWeekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`
                        const endWeekDisplay = `W${endWeek} (${endWeekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endWeekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`

                        return (
                          <tr key={allocation.id || index} className="hover:bg-slate-50">
                            <td className="border border-slate-300 px-4 py-3 text-slate-900">
                              {project?.name || 'Unknown Project'}
                            </td>
                            <td className="border border-slate-300 px-4 py-3 text-slate-600">
                              {startWeekDisplay}
                            </td>
                            <td className="border border-slate-300 px-4 py-3 text-slate-600">
                              {endWeekDisplay}
                            </td>
                            <td className="border border-slate-300 px-4 py-3">
                              <span className={`font-medium ${allocation.allocation_percentage > 100
                                ? 'text-red-600 font-bold'
                                : allocation.isSplit && allocation.splitIndex === 1
                                  ? 'text-orange-600 font-bold'
                                  : 'text-slate-900'
                                }`}>
                                {allocation.allocation_percentage}%
                                {allocation.isSplit && allocation.splitIndex === 1 && (
                                  <span className="ml-1 text-xs bg-orange-100 text-orange-800 px-1 py-0.5 rounded">
                                    New
                                  </span>
                                )}
                              </span>
                            </td>
                            <td className="border border-slate-300 px-4 py-3 text-slate-600">
                              {allocation.role}
                            </td>
                            <td className="border border-slate-300 px-4 py-3 text-center">
                              <div className="flex items-center justify-center space-x-2">
                                {hasPermission('utilization-allocations-edit') && (
                                  <button
                                    onClick={() => {
                                      // Open Current Allocations Edit Modal
                                      setCurrentAllocationsEditModal({
                                        allocation: allocation,
                                        employee: editingAllocation.employee
                                      })
                                    }}
                                    className="text-green-700 hover:text-green-800 transition-colors p-1"
                                    title="Edit allocation"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                )}
                                {hasPermission('utilization-allocations-delete') && (
                                  <button
                                    onClick={() => {
                                      // Show delete confirmation popup
                                      setDeleteConfirmation({
                                        onConfirm: async () => {
                                          setIsDeletingAllocation(true)
                                          try {
                                            const token = getCookie(TOKEN)
                                            if (!token) {
                                              showNotification('error', 'Authentication token not found')
                                              return
                                            }

                                            const response = await fetch(`${getApiBaseUrl()}/api/allocations/${allocation.id}`, {
                                              method: 'DELETE',
                                              headers: {
                                                'Authorization': `Bearer ${token}`,
                                                'Content-Type': 'application/json'
                                              }
                                            })

                                            if (!response.ok) {
                                              const errorData = await response.json()
                                              throw new Error(errorData.error || 'Failed to delete allocation')
                                            }

                                            const deleteResult = await response.json()

                                            // Update main table state optimistically
                                            if (deleteResult.deleted_allocation_id && updateAllocations) {
                                              updateAllocations(prev => prev.filter(a => a.id !== deleteResult.deleted_allocation_id))
                                            }

                                            showNotification('success', 'Allocation deleted successfully!')
                                            setDeletedAllocationIds(prev => new Set([...prev, allocation.id]))
                                            // if (fetchProjects) {
                                            //   await fetchProjects()
                                            // }
                                            setDeleteConfirmation(null)
                                          } catch (error) {
                                            console.error('Error deleting allocation:', error)
                                            showNotification('error', 'Error deleting allocation: ' + error.message)
                                            setDeleteConfirmation(null)
                                          } finally {
                                            setIsDeletingAllocation(false)
                                          }
                                        },
                                        allocation: allocation
                                      })
                                    }}
                                    disabled={isDeletingAllocation}
                                    className="text-red-600 hover:text-red-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed p-1"
                                    title="Delete allocation"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    })()}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                No allocations found for this employee
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">
              Edit Allocations - {editingAllocation.employee?.first_name} {editingAllocation.employee?.last_name}
            </h3>
            <p className="text-slate-600 mt-1">
              {editingAllocation.period?.label} - {editingAllocation.week?.label} ({editingAllocation.week?.dateRange})
            </p>
            <p className="text-sm text-green-700 mt-1">
              📅 Week Period: {formatDateReadable(editingAllocation.weekStart)} to {formatDateReadable(editingAllocation.weekEnd)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Current Allocations */}
        <div className="mb-6">
          <h4 className="text-lg font-medium text-slate-900 mb-4">Allocations for This Week</h4>
          {isSelectedWeekInPast() && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <p className="text-sm text-amber-800">
                  <strong>Historical Week:</strong> This week is in the past. Edit and delete options are disabled to preserve historical data.
                </p>
              </div>
            </div>
          )}
          <p className="text-sm text-slate-600 mb-4">
            Showing the latest allocation for each project that applies to the selected week. Multiple allocations for the same project are consolidated to show only the most recent one.
          </p>
          {(allocations.length > 0 || pendingAllocations.length > 0) ? (
            <div className="space-y-3">
              {/* Existing allocations */}
              {allocations.map((allocation, index) => (
                <AllocationEditCard
                  key={allocation.id}
                  allocation={allocation}
                  index={index}
                  projects={projects}
                  onUpdate={(updatedAllocation) => handleUpdateAllocationLocal(allocation.id, updatedAllocation)}
                  onRemove={() => handleRemoveAllocation(allocation.id)}
                  setDeleteConfirmation={setDeleteConfirmation}
                  isDeletingAllocation={isDeletingAllocation}
                  setIsDeletingAllocation={setIsDeletingAllocation}
                  isWeekInPast={isSelectedWeekInPast()}
                  hasPermission={hasPermission}
                />
              ))}

              {/* Pending allocations */}
              {pendingAllocations.map((allocation, index) => (
                <PendingAllocationCard
                  key={allocation.id}
                  allocation={allocation}
                  index={index}
                  projects={projects}
                  onRemove={(allocationId) => {
                    setPendingAllocations(prev => prev.filter(alloc => alloc.id !== allocationId))
                  }}
                  formatDateReadable={formatDateReadable}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <div className="text-lg font-medium mb-2">No allocations for this week</div>
              <div className="text-sm">Click "Add New Allocation" to create an allocation for this week period.</div>
            </div>
          )}

          {/* Total Allocation */}
          <div className="mt-4 p-4 bg-green-50 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="font-medium text-slate-900">Total Allocation:</span>
              <span className={`text-lg font-bold ${getTotalAllocation() > 100 ? 'text-red-600' :
                getTotalAllocation() === 100 ? 'text-green-600' : 'text-green-700'
                }`}>
                {getTotalAllocation()}%
              </span>
            </div>
            {getTotalAllocation() > 100 && (
              <p className="text-sm text-red-600 mt-2">⚠️ Employee is over-allocated</p>
            )}
            {/* Validation Error Message */}
            {getAllocationValidationError() && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-red-700 font-medium">{getAllocationValidationError()}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Add New Allocation */}
        {!isSelectedWeekInPast() && hasPermission('utilization-allocations-create') && (
          <div className="mb-6">
            <h4 className="text-lg font-medium text-slate-900 mb-4">Add New Allocation for This Week</h4>
            <p className="text-sm text-slate-600 mb-4">
              Create a new allocation that will apply to the selected week period.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Project</label>
                <div className="relative project-dropdown-container">
                  <input
                    type="text"
                    value={projectSearchTerm || (newAllocation.project_id ? getProjectName(newAllocation.project_id) : '')}
                    onChange={(e) => handleProjectSearchChange(e.target.value)}
                    onFocus={() => setShowProjectDropdown(true)}
                    placeholder="Search projects..."
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${duplicateError
                      ? 'border-red-300 focus:ring-red-500'
                      : 'border-slate-300 focus:ring-green-500'
                      }`}
                  />
                  {showProjectDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {getFilteredProjects().length > 0 ? (
                        getFilteredProjects().map(project => {
                          const isAlreadyAssigned = allocations.some(alloc => alloc.project_id === project.id) ||
                            pendingAllocations.some(alloc => alloc.project_id === project.id)
                          return (
                            <button
                              key={project.id}
                              type="button"
                              onClick={() => handleProjectSelect(project.id)}
                              disabled={isAlreadyAssigned}
                              className={`w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors ${isAlreadyAssigned
                                ? 'text-slate-400 cursor-not-allowed bg-slate-50'
                                : 'text-slate-900'
                                }`}
                            >
                              <div className="flex items-center justify-between">
                                <span>{project.name}</span>
                                {isAlreadyAssigned && (
                                  <span className="text-xs text-slate-500">Already Assigned</span>
                                )}
                              </div>
                            </button>
                          )
                        })
                      ) : (
                        <div className="px-3 py-2 text-slate-500 text-sm">
                          No projects found matching "{projectSearchTerm}"
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {duplicateError && (
                  <p className="text-red-600 text-sm mt-1 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 0
                    // Prevent values greater than 100
                    const clampedValue = value > 100 ? 100 : value
                    setNewAllocation({ ...newAllocation, allocation_percentage: clampedValue })
                    // Clear duplicate error when user changes allocation
                    if (duplicateError) {
                      setDuplicateError('')
                    }
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                {newAllocation.allocation_percentage > 100 && (
                  <p className="text-red-600 text-sm mt-1 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Allocation cannot exceed 100% for a single project
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                <input
                  type="text"
                  value={newAllocation.role}
                  onChange={(e) => setNewAllocation({ ...newAllocation, role: e.target.value })}
                  placeholder="Enter role (e.g., Developer, Designer)"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div className="flex items-end">
                <button
                  onClick={handleAddAllocation}
                  disabled={!newAllocation.project_id || newAllocation.allocation_percentage <= 0 || newAllocation.allocation_percentage > 100 || duplicateError}
                  className="w-full bg-green-700 text-white px-4 py-2 rounded-lg hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  Add to Preview
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:text-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={
              isSaving ||
              (allocations.length === 0 && pendingAllocations.length === 0) ||
              !hasPermission('utilization-allocations-create') ||
              hasInvalidAllocation() ||
              getTotalAllocation() > 100
            }
            className={`${hasPermission('utilization-allocations-create') && !hasInvalidAllocation() && getTotalAllocation() <= 100 ? 'bg-green-700 hover:bg-green-800' : 'bg-gray-400 cursor-not-allowed'} px-4 py-2 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2`}
            title={
              hasInvalidAllocation() || getTotalAllocation() > 100
                ? getAllocationValidationError()
                : hasPermission('utilization-allocations-create')
                  ? "Save Allocations"
                  : "Save Allocations (No Permission)"
            }
          >
            {isSaving && (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {isSaving ? 'Saving...' : `Save Allocations${pendingAllocations.length > 0 ? ` (${pendingAllocations.length} pending)` : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// AllocationEditCard Component
const AllocationEditCard = ({ allocation, index, projects, onUpdate, onRemove, setDeleteConfirmation, isDeletingAllocation, setIsDeletingAllocation, isWeekInPast = false, hasPermission }) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState({
    project_id: allocation.project_id,
    allocation_percentage: allocation.allocation_percentage,
    role: allocation.role
  })

  const handleSave = () => {
    onUpdate(editData)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditData({
      project_id: allocation.project_id,
      allocation_percentage: allocation.allocation_percentage,
      role: allocation.role
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Project</label>
              <select
                value={editData.project_id}
                onChange={(e) => setEditData({ ...editData, project_id: parseInt(e.target.value) })}
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
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 0
                  // Prevent values greater than 100
                  const clampedValue = value > 100 ? 100 : value
                  setEditData({ ...editData, allocation_percentage: clampedValue })
                }}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${editData.allocation_percentage > 100
                  ? 'border-red-300 focus:ring-red-500'
                  : 'border-slate-300 focus:ring-green-500'
                  }`}
              />
              {editData.allocation_percentage > 100 && (
                <p className="text-red-600 text-sm mt-1 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Allocation cannot exceed 100% for a single project
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
              <input
                type="text"
                value={editData.role}
                onChange={(e) => setEditData({ ...editData, role: e.target.value })}
                placeholder="e.g., Developer, Designer"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          {/* Display current week period as read-only information */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <svg className="w-4 h-4 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="font-medium text-green-900 text-sm">Week Period</span>
            </div>
            <p className="text-xs text-green-800">
              This edit applies only to the current week. The allocation dates remain unchanged for other weeks.
            </p>
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
              {allocation.week_start_date || allocation.start_date} to {allocation.week_end_date || allocation.end_date}
              {allocation.isPartialWeek && (
                <span className="ml-2 text-xs text-orange-600 bg-orange-100 px-2 py-1 rounded">
                  Partial Week
                </span>
              )}
            </div>
            {allocation.isPartialWeek && (
              <div className="text-xs text-slate-500 mt-1">
                Full allocation: {allocation.original_start_date} to {allocation.original_end_date}
              </div>
            )}
          </div>
          {!isWeekInPast && (
            <div className="flex items-center space-x-2">
              {hasPermission('utilization-allocations-edit') && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-green-700 hover:text-green-800 transition-colors"
                  title="Edit allocation"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              )}
              {hasPermission('utilization-allocations-delete') && (
                <button
                  onClick={() => {
                    // Show delete confirmation popup instead of alert
                    setDeleteConfirmation({
                      onConfirm: async () => {
                        setIsDeletingAllocation(true)
                        try {
                          await onRemove(allocation.id)
                          // Close the confirmation popup after successful deletion
                          setDeleteConfirmation(null)
                        } catch (error) {
                          // Close the popup even on error
                          setDeleteConfirmation(null)
                        } finally {
                          setIsDeletingAllocation(false)
                        }
                      }
                    })
                  }}
                  disabled={isDeletingAllocation}
                  className="text-red-600 hover:text-red-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  title="Remove allocation for this week"
                >
                  {isDeletingAllocation ? (
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// PendingAllocationCard Component
const PendingAllocationCard = ({ allocation, index, projects, onRemove, formatDateReadable }) => {
  const getProjectName = (projectId) => {
    const project = projects.find(p => p.id === projectId)
    return project ? project.name : 'Unknown Project'
  }

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="font-medium text-slate-900">{getProjectName(allocation.project_id)}</div>
            <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-1 rounded-full font-medium">
              Pending
            </span>
          </div>
          <div className="text-sm text-slate-600">
            {allocation.role} • {allocation.allocation_percentage}% •
            {formatDateReadable(allocation.start_date)} to {formatDateReadable(allocation.end_date)}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onRemove(allocation.id)}
            className="text-red-600 hover:text-red-800 transition-colors flex items-center gap-1"
            title="Remove pending allocation"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

// Current Allocations Edit Modal Component
const CurrentAllocationsEditModal = ({
  editingAllocation,
  onClose,
  projects,
  showNotification,
  formatDateReadable,
  getWeekNumber,
  splitAllocations,
  setSplitAllocations,
  setDeleteConfirmation,
  isDeletingAllocation,
  setIsDeletingAllocation,
  isUpdatingAllocation,
  setIsUpdatingAllocation,
  fetchProjects,
  updateAllocations
}) => {
  const [isPartialPeriodEdit, setIsPartialPeriodEdit] = useState(false)
  const [editData, setEditData] = useState({
    project_id: editingAllocation?.allocation?.project_id || '',
    allocation_percentage: editingAllocation?.allocation?.allocation_percentage || '',
    role: editingAllocation?.allocation?.role || '',
    start_date: '',
    end_date: ''
  })
  const [splitDetected, setSplitDetected] = useState(false)
  const [splitSegments, setSplitSegments] = useState([])
  const [isSplittingAllocation, setIsSplittingAllocation] = useState(false)

  // Week selector state
  const [startWeekMonth, setStartWeekMonth] = useState(new Date())
  const [endWeekMonth, setEndWeekMonth] = useState(new Date())
  const [selectedStartWeek, setSelectedStartWeek] = useState(null)
  const [selectedEndWeek, setSelectedEndWeek] = useState(null)

  // Partial Period Edit week selector state
  const [partialStartWeekMonth, setPartialStartWeekMonth] = useState(new Date())
  const [partialEndWeekMonth, setPartialEndWeekMonth] = useState(new Date())
  const [selectedPartialStartWeek, setSelectedPartialStartWeek] = useState(null)
  const [selectedPartialEndWeek, setSelectedPartialEndWeek] = useState(null)

  // Partial Period Edit data
  const [partialEditData, setPartialEditData] = useState({
    project_id: '',
    allocation_percentage: '',
    role: ''
  })

  // Helper function to format date in local timezone
  const formatDateLocal = (date) => {
    if (!date) return ''
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Week utility functions
  const getWeekStart = (date) => {
    const weekStart = new Date(date)
    weekStart.setDate(date.getDate() - date.getDay())
    weekStart.setHours(0, 0, 0, 0) // Set to start of day to avoid timezone issues
    return weekStart
  }

  const getWeekEnd = (date) => {
    const weekEnd = new Date(date)
    weekEnd.setDate(date.getDate() + (6 - date.getDay()))
    weekEnd.setHours(23, 59, 59, 999) // Set to end of day
    return weekEnd
  }

  const formatWeekDisplay = (weekStart) => {
    const weekEnd = getWeekEnd(weekStart)
    const weekNumber = getWeekNumber(weekStart)
    const startMonth = weekStart.toLocaleDateString('en-US', { month: 'short' })
    const startDay = weekStart.getDate()
    const endMonth = weekEnd.toLocaleDateString('en-US', { month: 'short' })
    const endDay = weekEnd.getDate()

    return `Week ${weekNumber} (${startMonth} ${startDay} – ${endMonth} ${endDay})`
  }

  const getWeeksInMonth = (date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)

    const weeks = []
    let currentWeekStart = getWeekStart(firstDay)

    // For Start Week selector, we need to show more weeks to include past weeks
    // that might be relevant to the allocation period
    const startDate = new Date(firstDay)
    startDate.setDate(startDate.getDate() - 14) // Go back 2 weeks to show past weeks

    while (currentWeekStart <= lastDay) {
      const weekEnd = getWeekEnd(currentWeekStart)
      // Include weeks that have at least one day in the current month
      // OR are within 2 weeks before the current month (for past weeks)
      if ((weekEnd >= firstDay && currentWeekStart <= lastDay) ||
        (currentWeekStart >= startDate && currentWeekStart < firstDay)) {
        weeks.push({
          start: new Date(currentWeekStart),
          end: new Date(weekEnd),
          display: formatWeekDisplay(currentWeekStart)
        })
      }
      currentWeekStart.setDate(currentWeekStart.getDate() + 7)
    }

    return weeks
  }

  const navigateMonth = (currentMonth, direction, isStartWeek) => {
    const newMonth = new Date(currentMonth)
    newMonth.setMonth(currentMonth.getMonth() + direction)

    if (isStartWeek) {
      setStartWeekMonth(newMonth)
    } else {
      setEndWeekMonth(newMonth)
    }
  }

  const handleWeekSelection = (week, isStartWeek) => {
    if (isStartWeek) {
      setSelectedStartWeek(week)
      setEditData({
        ...editData,
        start_date: formatDateLocal(week.start)
      })
    } else {
      setSelectedEndWeek(week)
      setEditData({
        ...editData,
        end_date: formatDateLocal(week.end)
      })
    }
  }

  // Get current week start (Sunday of current week)
  const getCurrentWeekStart = () => {
    const today = new Date()
    return getWeekStart(today)
  }

  // Check if a week is in the past (before current week)
  const isWeekInPast = (weekStart) => {
    const currentWeekStart = getCurrentWeekStart()

    // Set time to 00:00:00 to avoid timezone issues
    const normalizedWeekStart = new Date(weekStart)
    const normalizedCurrentWeekStart = new Date(currentWeekStart)
    normalizedWeekStart.setHours(0, 0, 0, 0)
    normalizedCurrentWeekStart.setHours(0, 0, 0, 0)

    // Only consider weeks that are strictly before the current week as "past"
    // The current week itself should be selectable
    return normalizedWeekStart.getTime() < normalizedCurrentWeekStart.getTime()
  }

  // Check if the allocation spans past weeks
  const hasPastWeeks = () => {
    if (!selectedStartWeek) return false
    return isWeekInPast(selectedStartWeek.start)
  }

  // Partial Period Edit helper functions
  const handlePartialWeekSelection = (week, isStartWeek) => {
    if (isStartWeek) {
      setSelectedPartialStartWeek(week)
      setPartialEditData(prev => ({
        ...prev,
        start_date: formatDateLocal(week.start)
      }))
    } else {
      setSelectedPartialEndWeek(week)
      setPartialEditData(prev => ({
        ...prev,
        end_date: formatDateLocal(week.end)
      }))
    }

    // Recalculate split segments after a short delay to ensure state is updated
    setTimeout(() => {
      recalculatePartialSplitSegments()
    }, 100)
  }

  const navigatePartialMonth = (currentMonth, direction, isStartWeek) => {
    const newMonth = new Date(currentMonth)
    newMonth.setMonth(currentMonth.getMonth() + direction)

    if (isStartWeek) {
      setPartialStartWeekMonth(newMonth)
    } else {
      setPartialEndWeekMonth(newMonth)
    }
  }

  // Recalculate split segments for partial period edit
  const recalculatePartialSplitSegments = () => {
    if (!editingAllocation?.allocation || !selectedPartialStartWeek || !selectedPartialEndWeek) {
      setSplitDetected(false)
      setSplitSegments([])
      return
    }

    const originalAllocation = editingAllocation.allocation
    const originalStart = new Date(originalAllocation.start_date)
    const originalEnd = new Date(originalAllocation.end_date)
    const newStart = selectedPartialStartWeek.start
    const newEnd = selectedPartialEndWeek.end

    const segments = []

    // First segment: original start to new start - 1 day (if new start is after original start)
    if (newStart > originalStart) {
      const firstEnd = new Date(newStart)
      firstEnd.setDate(firstEnd.getDate() - 1)
      segments.push({
        start: originalStart,
        end: firstEnd,
        allocation: originalAllocation.allocation_percentage,
        type: 'original'
      })
    }

    // New segment: new start to new end
    segments.push({
      start: newStart,
      end: newEnd,
      allocation: partialEditData.allocation_percentage || 0,
      type: 'new'
    })

    // Last segment: new end + 1 day to original end (if new end is before original end)
    if (newEnd < originalEnd) {
      const lastStart = new Date(newEnd)
      lastStart.setDate(lastStart.getDate() + 1)
      segments.push({
        start: lastStart,
        end: originalEnd,
        allocation: originalAllocation.allocation_percentage,
        type: 'original'
      })
    }

    setSplitSegments(segments)
    setSplitDetected(segments.length > 1)
  }

  // Recalculate split segments when partial edit data changes
  useEffect(() => {
    if (isPartialPeriodEdit) {
      recalculatePartialSplitSegments()
    }
  }, [partialEditData.allocation_percentage, selectedPartialStartWeek, selectedPartialEndWeek, isPartialPeriodEdit])

  // Get the effective start week (current week if allocation spans past weeks)
  const getEffectiveStartWeek = () => {
    if (!selectedStartWeek) return null

    if (hasPastWeeks()) {
      // If allocation spans past weeks, start from current week
      const currentWeekStart = getCurrentWeekStart()
      return {
        start: currentWeekStart,
        end: getWeekEnd(currentWeekStart),
        display: formatWeekDisplay(currentWeekStart)
      }
    }

    return selectedStartWeek
  }

  // Initialize edit data when modal opens
  useEffect(() => {
    if (editingAllocation?.allocation) {
      const allocation = editingAllocation.allocation
      setEditData({
        project_id: allocation.project_id,
        allocation_percentage: allocation.allocation_percentage,
        role: allocation.role,
        start_date: formatDateLocal(new Date(allocation.start_date)),
        end_date: formatDateLocal(new Date(allocation.end_date))
      })
      setIsPartialPeriodEdit(false)
      setSplitDetected(false)
      setSplitSegments([])

      // Initialize week selectors with current allocation dates
      const startDate = new Date(allocation.start_date)
      const endDate = new Date(allocation.end_date)
      const currentWeekStart = getCurrentWeekStart()

      setStartWeekMonth(startDate)
      setEndWeekMonth(endDate)

      // If the original start date is in the past, default to current week
      const effectiveStartDate = startDate < currentWeekStart ? currentWeekStart : startDate

      const startWeek = {
        start: getWeekStart(effectiveStartDate),
        end: getWeekEnd(effectiveStartDate),
        display: formatWeekDisplay(getWeekStart(effectiveStartDate))
      }
      setSelectedStartWeek(startWeek)

      const endWeek = {
        start: getWeekStart(endDate),
        end: getWeekEnd(endDate),
        display: formatWeekDisplay(getWeekStart(endDate))
      }
      setSelectedEndWeek(endWeek)
    }
  }, [editingAllocation])

  // Scroll to selected weeks when they change
  useEffect(() => {
    if (selectedStartWeek) {
      // Find the week button and scroll it into view
      setTimeout(() => {
        const startWeekButtons = document.querySelectorAll('[data-week-start]')
        startWeekButtons.forEach(button => {
          if (button.textContent.includes(selectedStartWeek.display)) {
            button.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        })
      }, 100)
    }
  }, [selectedStartWeek])

  useEffect(() => {
    if (selectedEndWeek) {
      // Find the week button and scroll it into view
      setTimeout(() => {
        const endWeekButtons = document.querySelectorAll('[data-week-end]')
        endWeekButtons.forEach(button => {
          if (button.textContent.includes(selectedEndWeek.display)) {
            button.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        })
      }, 100)
    }
  }, [selectedEndWeek])

  const handleChangeTimeline = () => {
    setIsPartialPeriodEdit(true)

    // Initialize partial edit data with current allocation values
    setPartialEditData({
      project_id: editingAllocation?.allocation?.project_id || '',
      allocation_percentage: editingAllocation?.allocation?.allocation_percentage || '',
      role: editingAllocation?.allocation?.role || ''
    })

    // Initialize partial week selectors to current month
    const currentDate = new Date()
    setPartialStartWeekMonth(currentDate)
    setPartialEndWeekMonth(currentDate)
    setSelectedPartialStartWeek(null)
    setSelectedPartialEndWeek(null)

    // Clear any existing split detection
    setSplitDetected(false)
    setSplitSegments([])
  }

  // Function to recalculate split segments when dates change
  const recalculateSplitSegments = (startDate, endDate) => {
    if (!startDate || !endDate) return

    const originalStart = new Date(editingAllocation.allocation.start_date)
    const originalEnd = new Date(editingAllocation.allocation.end_date)
    const newStart = new Date(startDate)
    const newEnd = new Date(endDate)

    const segments = []
    const originalAllocationPercentage = editingAllocation.allocation.allocation_percentage

    // First segment: original start to new start - 1 day (only if there's a gap)
    if (originalStart < newStart) {
      const firstEnd = new Date(newStart)
      firstEnd.setDate(firstEnd.getDate() - 1)
      segments.push({
        start: originalStart,
        end: firstEnd,
        allocation: originalAllocationPercentage,
        type: 'original'
      })
    }

    // New segment: new start to new end
    segments.push({
      start: newStart,
      end: newEnd,
      allocation: editData.allocation_percentage,
      type: 'new'
    })

    // Last segment: new end + 1 day to original end (only if there's a gap)
    if (newEnd < originalEnd) {
      const lastStart = new Date(newEnd)
      lastStart.setDate(lastStart.getDate() + 1)
      segments.push({
        start: lastStart,
        end: originalEnd,
        allocation: originalAllocationPercentage,
        type: 'original'
      })
    }

    setSplitSegments(segments)
  }

  const handleSave = async () => {
    const originalAllocation = editingAllocation.allocation
    const token = getCookie(TOKEN)

    // Debug token retrieval
    console.log('Token retrieval debug:', {
      TOKEN: TOKEN,
      token: token,
      allCookies: document.cookie,
      isUserLoggedIn: isUserLoggedIn()
    })

    if (!token) {
      console.error('Authentication token not found')
      showNotification('error', 'Authentication token not found. Please login again.')
      return
    }

    // Handle Partial Period Edit
    if (isPartialPeriodEdit) {
      if (!selectedPartialStartWeek || !selectedPartialEndWeek || !partialEditData.project_id || !partialEditData.allocation_percentage) {
        showNotification('error', 'Please fill in all required fields for the partial period edit.')
        return
      }

      setIsSplittingAllocation(true)
      try {
        const splitSegmentsForAPI = []
        const originalStart = new Date(originalAllocation.start_date)
        const originalEnd = new Date(originalAllocation.end_date)
        const newStart = selectedPartialStartWeek.start
        const newEnd = selectedPartialEndWeek.end

        // First segment: original start to new start - 1 day (if new start is after original start)
        if (newStart > originalStart) {
          const firstEnd = new Date(newStart)
          firstEnd.setDate(firstEnd.getDate() - 1)
          splitSegmentsForAPI.push({
            start_date: formatDateLocal(originalStart),
            end_date: formatDateLocal(firstEnd),
            allocation_percentage: originalAllocation.allocation_percentage,
            role: originalAllocation.role
          })
        }

        // New segment: new start to new end
        splitSegmentsForAPI.push({
          start_date: formatDateLocal(newStart),
          end_date: formatDateLocal(newEnd),
          allocation_percentage: partialEditData.allocation_percentage,
          role: partialEditData.role
        })

        // Last segment: new end + 1 day to original end (if new end is before original end)
        if (newEnd < originalEnd) {
          const lastStart = new Date(newEnd)
          lastStart.setDate(lastStart.getDate() + 1)
          splitSegmentsForAPI.push({
            start_date: formatDateLocal(lastStart),
            end_date: formatDateLocal(originalEnd),
            allocation_percentage: originalAllocation.allocation_percentage,
            role: originalAllocation.role
          })
        }

        console.log('Partial period edit split segments:', splitSegmentsForAPI)

        const response = await fetch(`${getApiBaseUrl()}/api/allocations/split`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            original_allocation_id: originalAllocation.id,
            split_segments: splitSegmentsForAPI
          })
        })

        if (!response.ok) {
          const errorData = await response.json()
          console.error('Split allocation error:', errorData)
          throw new Error(errorData.error || 'Failed to split allocation')
        }

        const result = await response.json()
        setSplitAllocations(prev => ({
          ...prev,
          [originalAllocation.id]: result.new_allocations
        }))

        // Update main table state optimistically
        if (result.new_allocations && updateAllocations) {
          updateAllocations(prev => {
            // Remove the original allocation
            let updated = prev.filter(a => a.id !== originalAllocation.id)
            // Add all new split allocations
            return [...updated, ...result.new_allocations]
          })
        }

        // if (fetchProjects) {
        //   await fetchProjects()
        // }

        showNotification('success', 'Partial period allocation created successfully!')
        onClose()
      } catch (error) {
        console.error('Error creating partial period allocation:', error)
        showNotification('error', `Failed to create partial period allocation: ${error.message}`)
      } finally {
        setIsSplittingAllocation(false)
      }
      return
    }

    // Check if we need to handle past week protection or complex splitting
    const currentWeekStart = getCurrentWeekStart()
    const originalStart = new Date(originalAllocation.start_date)
    const originalEnd = new Date(originalAllocation.end_date)
    const newStart = selectedStartWeek ? selectedStartWeek.start : originalStart
    const newEnd = selectedEndWeek ? selectedEndWeek.end : originalEnd

    const hasPastWeeksInOriginal = originalStart < currentWeekStart
    const hasPastWeeksInNew = newStart < currentWeekStart
    const needsComplexSplitting = hasPastWeeksInOriginal || isPartialPeriodEdit || splitDetected

    if (needsComplexSplitting) {
      // Handle complex splitting scenarios
      setIsSplittingAllocation(true)
      try {
        const splitSegmentsForAPI = []

        // Determine the scenario type
        const isShrinking = newEnd < originalEnd
        const isExpanding = newEnd > originalEnd
        const isChangingStartWeek = newStart.getTime() !== originalStart.getTime()
        const isMidwayUpdate = newStart > currentWeekStart && newEnd <= originalEnd && !isShrinking && !isExpanding
        const hasGap = hasPastWeeksInOriginal && newStart > currentWeekStart

        console.log('Allocation update scenario:', {
          isShrinking,
          isExpanding,
          isChangingStartWeek,
          isMidwayUpdate,
          hasGap,
          hasPastWeeksInOriginal,
          originalStart: formatDateLocal(originalStart),
          originalEnd: formatDateLocal(originalEnd),
          newStart: formatDateLocal(newStart),
          newEnd: formatDateLocal(newEnd),
          currentWeekStart: formatDateLocal(currentWeekStart)
        })

        // Scenario 1: Past weeks protection (only preserve if new start is after current week)
        // If user is changing the start week to a future week, don't preserve past weeks
        if (hasPastWeeksInOriginal && newStart <= currentWeekStart) {
          const pastEnd = new Date(currentWeekStart.getTime() - 24 * 60 * 60 * 1000)

          if (originalStart < currentWeekStart && originalStart <= pastEnd) {
            splitSegmentsForAPI.push({
              start_date: formatDateLocal(originalStart),
              end_date: formatDateLocal(pastEnd),
              allocation_percentage: originalAllocation.allocation_percentage,
              role: originalAllocation.role
            })
          }
        }

        // Scenario 2: Gap weeks are not needed when user is changing the start week
        // The system will simply create the new allocation period as requested

        // Scenario 3: Handle the new allocation period
        const effectiveNewStart = newStart < currentWeekStart ? currentWeekStart : newStart

        // Only add the new segment if it's valid
        if (effectiveNewStart <= newEnd) {
          splitSegmentsForAPI.push({
            start_date: formatDateLocal(effectiveNewStart),
            end_date: formatDateLocal(newEnd),
            allocation_percentage: editData.allocation_percentage,
            role: editData.role
          })
        }

        // Scenario 4: Handle remaining period (only for shrinking)
        // For shrinking: delete excess weeks (don't create remaining segments)
        // For expanding: no remaining period needed
        // For midway: no remaining period needed

        // Validate that we have at least one segment
        if (splitSegmentsForAPI.length === 0) {
          throw new Error('No valid allocation segments to create')
        }

        // Validate each segment has required fields
        for (let i = 0; i < splitSegmentsForAPI.length; i++) {
          const segment = splitSegmentsForAPI[i]
          if (!segment.start_date || !segment.end_date || segment.allocation_percentage === undefined || segment.allocation_percentage === null || !segment.role) {
            console.error(`Segment ${i + 1} validation failed:`, {
              segment: segment,
              start_date: segment.start_date,
              end_date: segment.end_date,
              allocation_percentage: segment.allocation_percentage,
              role: segment.role
            })
            throw new Error(`Segment ${i + 1} is missing required fields`)
          }

          // Validate date format
          const startDate = new Date(segment.start_date)
          const endDate = new Date(segment.end_date)
          if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            throw new Error(`Segment ${i + 1} has invalid date format`)
          }

          // Validate date order
          if (startDate > endDate) {
            console.error(`Segment ${i + 1} validation error:`, {
              segment: segment,
              startDate: startDate.toISOString(),
              endDate: endDate.toISOString(),
              startDateStr: segment.start_date,
              endDateStr: segment.end_date
            })
            throw new Error(`Segment ${i + 1} has start date after end date: ${segment.start_date} > ${segment.end_date}`)
          }
        }

        // Debug logging
        console.log('Split allocation request:', {
          original_allocation_id: originalAllocation.id,
          split_segments: splitSegmentsForAPI,
          originalStart: formatDateLocal(originalStart),
          originalEnd: formatDateLocal(originalEnd),
          newStart: formatDateLocal(newStart),
          newEnd: formatDateLocal(newEnd),
          currentWeekStart: formatDateLocal(currentWeekStart)
        })

        // Debug each segment
        splitSegmentsForAPI.forEach((segment, index) => {
          console.log(`Segment ${index + 1}:`, {
            start_date: segment.start_date,
            end_date: segment.end_date,
            allocation_percentage: segment.allocation_percentage,
            role: segment.role,
            hasAllFields: !!(segment.start_date && segment.end_date && segment.allocation_percentage !== undefined && segment.role)
          })
        })

        // Call the split allocation API
        const response = await fetch(`${getApiBaseUrl()}/api/allocations/split`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            original_allocation_id: originalAllocation.id,
            split_segments: splitSegmentsForAPI
          })
        })

        if (!response.ok) {
          const errorData = await response.json()
          console.error('Split allocation error:', errorData)
          throw new Error(errorData.error || 'Failed to split allocation')
        }

        const result = await response.json()

        // Store split allocations for UI display
        setSplitAllocations(prev => ({
          ...prev,
          [originalAllocation.id]: result.new_allocations
        }))

        // Update main table state optimistically
        if (result.new_allocations && updateAllocations) {
          updateAllocations(prev => {
            // Remove the original allocation
            let updated = prev.filter(a => a.id !== originalAllocation.id)
            // Add all new split allocations
            return [...updated, ...result.new_allocations]
          })
        }

        // Refresh the dashboard data
        // if (fetchProjects) {
        //   await fetchProjects()
        // }

        showNotification('success', 'Allocation updated successfully!')
        onClose()
      } catch (error) {
        console.error('Error splitting allocation:', error)
        showNotification('error', `Failed to update allocation: ${error.message}`)
      } finally {
        setIsSplittingAllocation(false)
      }
    } else if (isPartialPeriodEdit && splitDetected) {
      // Handle manual split allocation using the new API
      setIsSplittingAllocation(true)
      try {
        // Prepare split segments for the API
        const splitSegmentsForAPI = []

        // Process all segments in order
        splitSegments.forEach(segment => {
          if (segment.type === 'original') {
            // Original allocation segment
            splitSegmentsForAPI.push({
              start_date: segment.start.toISOString().split('T')[0],
              end_date: segment.end.toISOString().split('T')[0],
              allocation_percentage: segment.allocation,
              role: originalAllocation.role
            })
          } else if (segment.type === 'new') {
            // New allocation segment
            splitSegmentsForAPI.push({
              start_date: segment.start.toISOString().split('T')[0],
              end_date: segment.end.toISOString().split('T')[0],
              allocation_percentage: editData.allocation_percentage,
              role: editData.role
            })
          }
        })

        // Call the split allocation API
        const response = await fetch(`${getApiBaseUrl()}/api/allocations/split`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            original_allocation_id: originalAllocation.id,
            split_segments: splitSegmentsForAPI
          })
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to split allocation')
        }

        const result = await response.json()

        // Store split allocations for UI display
        setSplitAllocations(prev => ({
          ...prev,
          [originalAllocation.id]: result.new_allocations
        }))

        // Update main table state optimistically
        if (result.new_allocations && updateAllocations) {
          updateAllocations(prev => {
            // Remove the original allocation
            let updated = prev.filter(a => a.id !== originalAllocation.id)
            // Add all new split allocations
            return [...updated, ...result.new_allocations]
          })
        }

        // Refresh the dashboard data
        // if (fetchProjects) {
        //   await fetchProjects()
        // }

        showNotification('success', 'Allocation split and updated successfully!')
        onClose()
      } catch (error) {
        console.error('Error splitting allocation:', error)
        showNotification('error', `Failed to split allocation: ${error.message}`)
      } finally {
        setIsSplittingAllocation(false)
      }
    } else {
      // Handle simple edit - update the existing allocation
      setIsUpdatingAllocation(true)
      try {
        const updatePayload = {
          project_id: editData.project_id,
          allocation_percentage: editData.allocation_percentage,
          role: editData.role,
          start_date: selectedStartWeek ? formatDateLocal(selectedStartWeek.start) : editData.start_date,
          end_date: selectedEndWeek ? formatDateLocal(selectedEndWeek.end) : editData.end_date
        }

        const response = await fetch(`${getApiBaseUrl()}/api/allocations/${originalAllocation.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(updatePayload)
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to update allocation')
        }

        const result = await response.json()

        // Update state optimistically
        if (result.allocation) {
          updateAllocations(prev => {
            return prev.map(alloc =>
              alloc.id === originalAllocation.id ? result.allocation : alloc
            )
          })
        }

        // Refresh the dashboard data
        // if (fetchProjects) {
        //   await fetchProjects()
        // }

        showNotification('success', 'Allocation updated successfully!')
        onClose()
      } catch (error) {
        console.error('Error updating allocation:', error)
        showNotification('error', `Failed to update allocation: ${error.message}`)
      } finally {
        setIsUpdatingAllocation(false)
      }
    }
  }

  const getProjectName = (projectId) => {
    const project = projects.find(p => p.id === projectId)
    return project ? project.name : 'Unknown Project'
  }

  // Helper function for partial edit project search
  const getFilteredProjectsForPartial = () => {
    if (!partialEditData.project_id) return projects
    return projects.filter(p =>
      p.name.toLowerCase().includes(partialEditData.project_id.toLowerCase())
    )
  }

  if (!editingAllocation?.allocation) return null

  const originalStart = new Date(editingAllocation.allocation.start_date)
  const originalEnd = new Date(editingAllocation.allocation.end_date)

  // Get the week start dates for proper week display
  const originalStartWeekStart = getWeekStart(originalStart)
  const originalEndWeekStart = getWeekStart(originalEnd)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">
              Edit Allocation - {getProjectName(editingAllocation.allocation.project_id)}
            </h3>
            <p className="text-slate-600 mt-1">
              Employee: {editingAllocation.employee?.first_name} {editingAllocation.employee?.last_name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Period Notice */}
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="font-medium text-green-900">Current Period</span>
          </div>
          <p className="text-sm text-green-800">
            This edit applies to the entire period: <strong>
              {formatWeekDisplay(originalStartWeekStart)} to {formatWeekDisplay(originalEndWeekStart)}
            </strong>
          </p>
        </div>

        {/* Editable Fields */}
        <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 ${isPartialPeriodEdit ? 'opacity-50 pointer-events-none' : ''}`}>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Project</label>
            <select
              value={editData.project_id}
              onChange={(e) => setEditData({ ...editData, project_id: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {projects.map(project => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {isPartialPeriodEdit ? 'New Allocation %' : 'Allocation %'}
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={editData.allocation_percentage}
              onChange={(e) => {
                const value = parseInt(e.target.value) || 0
                // Prevent values greater than 100
                const newPercentage = value > 100 ? 100 : value
                setEditData({ ...editData, allocation_percentage: newPercentage })
                if (isPartialPeriodEdit && editData.start_date && editData.end_date) {
                  recalculateSplitSegments(editData.start_date, editData.end_date)
                }
              }}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${editData.allocation_percentage > 100
                ? 'border-red-300 focus:ring-red-500'
                : 'border-slate-300 focus:ring-green-500'
                }`}
            />
            {editData.allocation_percentage > 100 && (
              <p className="text-red-600 text-sm mt-1 flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Allocation cannot exceed 100% for a single project
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
            <input
              type="text"
              value={editData.role}
              onChange={(e) => setEditData({ ...editData, role: e.target.value })}
              placeholder="e.g., Developer, Designer"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        {/* Allocation Update Warning */}
        {/* {(hasPastWeeks() || isPartialPeriodEdit) && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"/>
              </svg>
              <span className="font-medium text-amber-900">Smart Allocation Update</span>
            </div>
            <p className="text-sm text-amber-700 mb-2">
              The system will automatically split and manage your allocation to preserve historical data and handle complex scenarios.
            </p>
            <div className="text-sm text-amber-700">
              <p className="font-medium mb-1">What will happen:</p>
              <ul className="list-disc list-inside space-y-1">
                <li><strong>Past weeks:</strong> Remain unchanged (preserving historical data)</li>
                <li><strong>Selected period:</strong> Updated with your new allocation percentage</li>
                <li><strong>Unselected periods:</strong> Maintained or removed as needed</li>
                <li><strong>Automatic splitting:</strong> Creates separate allocation segments</li>
              </ul>
            </div>
          </div>
        )} */}

        {/* Start Week and End Week Fields */}
        <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 ${isPartialPeriodEdit ? 'opacity-50 pointer-events-none' : ''}`}>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Start Week
              <span className="text-xs text-gray-500 ml-2">(Past weeks disabled)</span>
              <svg className="w-4 h-4 inline-block ml-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" title="Past weeks cannot be selected to preserve historical data">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </label>
            <div className="border border-slate-300 rounded-lg p-3 bg-white">
              <div className="flex items-center justify-between mb-2">
                <button
                  type="button"
                  onClick={() => navigateMonth(startWeekMonth, -1, true)}
                  className="p-1 hover:bg-slate-100 rounded"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="font-medium text-slate-700">
                  {startWeekMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </span>
                <button
                  type="button"
                  onClick={() => navigateMonth(startWeekMonth, 1, true)}
                  className="p-1 hover:bg-slate-100 rounded"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {getWeeksInMonth(startWeekMonth).map((week, index) => {
                  const isSelected = selectedStartWeek &&
                    formatDateLocal(selectedStartWeek.start) === formatDateLocal(week.start)
                  const isCurrentWeek = formatDateLocal(week.start) === formatDateLocal(getCurrentWeekStart())
                  const isPastWeek = isWeekInPast(week.start) && !isCurrentWeek
                  const isDisabled = isPastWeek

                  return (
                    <button
                      key={index}
                      type="button"
                      data-week-start
                      disabled={isDisabled}
                      onClick={() => !isDisabled && handleWeekSelection(week, true)}
                      className={`w-full text-left p-2 rounded text-sm transition-colors ${isSelected
                        ? 'bg-green-100 text-green-800 border border-green-300'
                        : isDisabled
                          ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
                          : isCurrentWeek
                            ? 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                            : 'hover:bg-slate-50'
                        }`}
                      title={
                        isDisabled
                          ? 'Past weeks cannot be selected as start week'
                          : isCurrentWeek
                            ? 'Current week - selectable'
                            : ''
                      }
                    >
                      <div className="flex items-center justify-between">
                        <span>{week.display}</span>
                        {isCurrentWeek && (
                          <span className="text-xs bg-green-200 text-green-800 px-1 py-0.5 rounded text-xs">
                            Current
                          </span>
                        )}
                        {isPastWeek && (
                          <span className="text-xs bg-gray-200 text-gray-600 px-1 py-0.5 rounded text-xs">
                            Past
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">End Week</label>
            <div className="border border-slate-300 rounded-lg p-3 bg-white">
              <div className="flex items-center justify-between mb-2">
                <button
                  type="button"
                  onClick={() => navigateMonth(endWeekMonth, -1, false)}
                  className="p-1 hover:bg-slate-100 rounded"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="font-medium text-slate-700">
                  {endWeekMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </span>
                <button
                  type="button"
                  onClick={() => navigateMonth(endWeekMonth, 1, false)}
                  className="p-1 hover:bg-slate-100 rounded"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {getWeeksInMonth(endWeekMonth).map((week, index) => {
                  const isSelected = selectedEndWeek &&
                    formatDateLocal(selectedEndWeek.start) === formatDateLocal(week.start)

                  return (
                    <button
                      key={index}
                      type="button"
                      data-week-end
                      onClick={() => handleWeekSelection(week, false)}
                      className={`w-full text-left p-2 rounded text-sm transition-colors ${isSelected
                        ? 'bg-green-100 text-green-800 border border-green-300'
                        : 'hover:bg-slate-50'
                        }`}
                    >
                      {week.display}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Change Timeline Link */}
        {!isPartialPeriodEdit && (
          <div className="mb-6">
            <button
              onClick={handleChangeTimeline}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 text-green-800 rounded-lg hover:bg-green-100 hover:border-green-300 transition-all duration-200 font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Edit a Partial Period
            </button>
          </div>
        )}

        {/* Partial Period Edit Fields */}
        {isPartialPeriodEdit && (
          <div className="mb-6">
            <h4 className="text-lg font-medium text-slate-900 mb-4">Partial Period Edit</h4>

            {/* Project, Allocation %, and Role fields for Partial Period Edit */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Project</label>
                <select
                  value={partialEditData.project_id}
                  onChange={(e) => setPartialEditData(prev => ({
                    ...prev,
                    project_id: parseInt(e.target.value)
                  }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Select a project...</option>
                  {projects.map(project => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Allocation %</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={partialEditData.allocation_percentage}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 0
                    // Prevent values greater than 100
                    const clampedValue = value > 100 ? 100 : value
                    setPartialEditData(prev => ({
                      ...prev,
                      allocation_percentage: clampedValue
                    }))
                  }}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${partialEditData.allocation_percentage > 100
                    ? 'border-red-300 focus:ring-red-500'
                    : 'border-slate-300 focus:ring-green-500'
                    }`}
                />
                {partialEditData.allocation_percentage > 100 && (
                  <p className="text-red-600 text-sm mt-1 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Allocation cannot exceed 100% for a single project
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                <input
                  type="text"
                  value={partialEditData.role}
                  onChange={(e) => setPartialEditData(prev => ({
                    ...prev,
                    role: e.target.value
                  }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>

            {/* Week Selectors for Partial Period Edit */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Start Week (New Segment)
                </label>
                <div className="border border-slate-300 rounded-lg p-3 bg-white">
                  <div className="flex items-center justify-between mb-2">
                    <button
                      type="button"
                      onClick={() => navigatePartialMonth(partialStartWeekMonth, -1, true)}
                      className="p-1 hover:bg-slate-100 rounded"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <span className="font-medium text-slate-700">
                      {partialStartWeekMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </span>
                    <button
                      type="button"
                      onClick={() => navigatePartialMonth(partialStartWeekMonth, 1, true)}
                      className="p-1 hover:bg-slate-100 rounded"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {getWeeksInMonth(partialStartWeekMonth).map((week, index) => {
                      const isSelected = selectedPartialStartWeek &&
                        formatDateLocal(selectedPartialStartWeek.start) === formatDateLocal(week.start)
                      const isPastWeek = isWeekInPast(week.start)
                      const isDisabled = isPastWeek
                      const isCurrentWeek = formatDateLocal(week.start) === formatDateLocal(getCurrentWeekStart())

                      return (
                        <button
                          key={index}
                          type="button"
                          disabled={isDisabled}
                          onClick={() => !isDisabled && handlePartialWeekSelection(week, true)}
                          className={`w-full text-left p-2 rounded text-sm transition-colors ${isSelected
                            ? 'bg-green-100 text-green-800 border border-green-300'
                            : isDisabled
                              ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
                              : isCurrentWeek
                                ? 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                                : 'hover:bg-slate-50'
                            }`}
                          title={
                            isDisabled
                              ? 'Past weeks cannot be selected as start week'
                              : isCurrentWeek
                                ? 'Current week - selectable'
                                : ''
                          }
                        >
                          <div className="flex items-center justify-between">
                            <span>{week.display}</span>
                            {isCurrentWeek && (
                              <span className="text-xs bg-green-200 text-green-800 px-1 py-0.5 rounded text-xs">
                                Current
                              </span>
                            )}
                            {isPastWeek && (
                              <span className="text-xs bg-gray-200 text-gray-600 px-1 py-0.5 rounded text-xs">
                                Past
                              </span>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">End Week (New Segment)</label>
                <div className="border border-slate-300 rounded-lg p-3 bg-white">
                  <div className="flex items-center justify-between mb-2">
                    <button
                      type="button"
                      onClick={() => navigatePartialMonth(partialEndWeekMonth, -1, false)}
                      className="p-1 hover:bg-slate-100 rounded"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <span className="font-medium text-slate-700">
                      {partialEndWeekMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </span>
                    <button
                      type="button"
                      onClick={() => navigatePartialMonth(partialEndWeekMonth, 1, false)}
                      className="p-1 hover:bg-slate-100 rounded"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {getWeeksInMonth(partialEndWeekMonth).map((week, index) => {
                      const isSelected = selectedPartialEndWeek &&
                        formatDateLocal(selectedPartialEndWeek.start) === formatDateLocal(week.start)

                      return (
                        <button
                          key={index}
                          type="button"
                          onClick={() => handlePartialWeekSelection(week, false)}
                          className={`w-full text-left p-2 rounded text-sm transition-colors ${isSelected
                            ? 'bg-green-100 text-green-800 border border-green-300'
                            : 'hover:bg-slate-50'
                            }`}
                        >
                          {week.display}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Cancel Partial Period Edit Button */}
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => {
                  setIsPartialPeriodEdit(false)
                  setPartialEditData({
                    project_id: '',
                    allocation_percentage: '',
                    role: ''
                  })
                  setSelectedPartialStartWeek(null)
                  setSelectedPartialEndWeek(null)
                  setSplitDetected(false)
                  setSplitSegments([])
                }}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 transition-colors border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancel Partial Edit
              </button>
            </div>
          </div>
        )}

        {/* Split Detection Feedback */}
        {splitDetected && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span className="font-medium text-yellow-900">Split Detected</span>
            </div>
            <p className="text-sm text-yellow-700 mb-2">
              The new allocation <strong>{isPartialPeriodEdit ? partialEditData.allocation_percentage : editData.allocation_percentage}%</strong> will be applied to the selected period.
            </p>
            <div className="text-sm text-yellow-700">
              <p className="font-medium mb-1">Surrounding segments will retain the original {editingAllocation.allocation.allocation_percentage}% allocation:</p>
              <ul className="list-disc list-inside space-y-1">
                {splitSegments.filter(seg => seg.type === 'original').map((segment, index) => (
                  <li key={index}>
                    {formatDateReadable(segment.start)} – {formatDateReadable(segment.end)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3">
          {/* <button
            onClick={() => {
              // Show delete confirmation popup
              setDeleteConfirmation({
                onConfirm: async () => {
                  setIsDeletingAllocation(true)
                  try {
                    const token = getCookie(TOKEN)
                    if (!token) {
                      showNotification('error', 'Authentication token not found')
                      return
                    }

                    const updatePayload = {
                      status: 'Inactive'
                    }

                    const response = await fetch(`${getApiBaseUrl()}/api/allocations/${editingAllocation.allocation.id}`, {
                      method: 'PUT',
                      headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify(updatePayload)
                    })

                    if (!response.ok) {
                      const errorData = await response.json()
                      throw new Error(errorData.error || 'Failed to delete allocation')
                    }

                    showNotification('success', 'Allocation deleted successfully!')
                    if (fetchProjects) {
                      await fetchProjects()
                    }
                    setDeleteConfirmation(null)
                    onClose()
                  } catch (error) {
                    console.error('Error deleting allocation:', error)
                    showNotification('error', 'Error deleting allocation: ' + error.message)
                    setDeleteConfirmation(null)
                  } finally {
                    setIsDeletingAllocation(false)
                  }
                },
                allocation: editingAllocation.allocation
              })
            }}
            disabled={isDeletingAllocation}
            className="px-4 py-2 text-red-600 hover:text-red-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDeletingAllocation ? 'Deleting...' : 'Delete Allocation'}
          </button> */}
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:text-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSplittingAllocation || isUpdatingAllocation}
            className={`px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${(hasPastWeeks() || isPartialPeriodEdit)
              ? 'bg-amber-600 hover:bg-amber-700'
              : 'bg-green-700 hover:bg-green-800'
              }`}
          >
            {isSplittingAllocation ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Updating Allocation...
              </div>
            ) : isUpdatingAllocation ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Updating...
              </div>
            ) : (
              (hasPastWeeks() || isPartialPeriodEdit) ? 'Update Allocation' : 'Update Allocation'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

OverallUtilizationTab.displayName = 'OverallUtilizationTab'

export default OverallUtilizationTab
