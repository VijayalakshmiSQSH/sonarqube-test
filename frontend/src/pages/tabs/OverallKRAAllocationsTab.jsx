import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { usePermissions } from '../../context/PermissionContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { useEmployees } from '../../context/EmployeeContext.jsx'
import { getApiBaseUrl, TOKEN } from '../../utils/constants.js'
import { getCookie } from '../../utils/helpers.js'

// Multi-Select Component
const MultiSelect = ({
  label,
  options,
  selectedValues,
  onSelectionChange,
  placeholder = "Select options...",
  searchPlaceholder = "Filter options..."
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
        <span className="text-black">
          {getDisplayText()}
        </span>
        <svg 
          className={`w-4 h-4 text-black transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
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
            
            return (
              <span
                key={value}
                className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-md"
              >
                {option.label}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleOptionToggle(value)
                  }}
                  className="text-green-700 hover:text-green-800"
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
                  className="rounded border-gray-300 text-green-800 focus:ring-green-800"
                />
                <span className="text-sm font-medium text-black">
                  {allFilteredSelected ? 'Deselect All' : 'Select All'}
                </span>
              </label>
            </div>
          )}

          {/* Options List */}
          <div className="max-h-48 overflow-y-auto scrollbar-thin">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">No options found</div>
            ) : (
              filteredOptions.map((option, index) => (
                <label
                  key={option.value}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={currentValues.includes(option.value)}
                    onChange={() => handleOptionToggle(option.value)}
                    className="rounded border-gray-300 text-green-800 focus:ring-green-800"
                  />
                  <span className="text-sm text-black">{option.label}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const OverallKRAAllocationsTab = () => {
  const { hasPermission } = usePermissions()
  const { user } = useAuth()
  const { getAllEmployees } = useEmployees()
  const [allocations, setAllocations] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedYears, setSelectedYears] = useState([])
  const [selectedQuarters, setSelectedQuarters] = useState([])
  const [selectedStatus, setSelectedStatus] = useState(['Active'])
  const [showFilters, setShowFilters] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedEmployees, setExpandedEmployees] = useState(new Set())
  const [expandedKRAs, setExpandedKRAs] = useState(new Set()) // Track expanded KRAs: "employeeId-kraId"
  const [generating, setGenerating] = useState(false)
  const [selectedSimpleYear, setSelectedSimpleYear] = useState(new Date().getFullYear()) // Simple year filter (defaults to current year)
  const [sortOrder, setSortOrder] = useState(null) // null, 'asc', or 'desc'
  const [hierarchyEmployeeIds, setHierarchyEmployeeIds] = useState(new Set()) // Employee IDs in current user's hierarchy
  const [projectTeamEmployeeIds, setProjectTeamEmployeeIds] = useState(new Set()) // Employee IDs from projects where user is PM
  const [currentUserEmployeeId, setCurrentUserEmployeeId] = useState(null) // Current logged-in user's employee ID
  const [hierarchyLoading, setHierarchyLoading] = useState(false)

  // Generate year options dynamically from KRA years in allocations
  const getYearOptions = useMemo(() => {
    const allYears = new Set()
    allocations.forEach(alloc => {
      const kraAllocations = alloc.allocation_data?.kra_allocations || []
      kraAllocations.forEach(kra => {
        const kraYear = kra.kra_year
        if (kraYear !== null && kraYear !== undefined) {
          // Handle both string and number years
          const yearNum = typeof kraYear === 'string' ? parseInt(kraYear) : kraYear
          if (!isNaN(yearNum)) {
            allYears.add(yearNum)
          }
        }
      })
    })
    
    // If no years found, default to current year range
    if (allYears.size === 0) {
      const currentYear = new Date().getFullYear()
      for (let i = currentYear - 5; i <= currentYear + 2; i++) {
        allYears.add(i)
      }
    }
    
    return Array.from(allYears).sort((a, b) => b - a).map(year => ({
      value: year.toString(),
      label: year.toString()
    }))
  }, [allocations])

  // Quarter options
  const quarterOptions = [
    { value: 'Q1', label: 'Q1 (January - March)' },
    { value: 'Q2', label: 'Q2 (April - June)' },
    { value: 'Q3', label: 'Q3 (July - September)' },
    { value: 'Q4', label: 'Q4 (October - December)' }
  ]

  // Get current user's employee ID from email
  const getCurrentUserEmployeeId = useMemo(() => {
    if (!user?.email) return null
    const employees = getAllEmployees()
    const employee = employees.find(emp => emp.email === user.email)
    return employee?.id || null
  }, [user?.email, getAllEmployees])

  // Extract all employee IDs from hierarchy tree recursively
  const extractEmployeeIdsFromTree = (node) => {
    if (!node) return []
    const ids = [node.id]
    if (node.children && node.children.length > 0) {
      node.children.forEach(child => {
        ids.push(...extractEmployeeIdsFromTree(child))
      })
    }
    return ids
  }

  // Fetch current user's hierarchy to get all employees under them
  const fetchUserHierarchy = useCallback(async (employeeId) => {
    if (!employeeId) return
    
    setHierarchyLoading(true)
    try {
      const token = getCookie(TOKEN)
      const baseUrl = getApiBaseUrl()
      
      // Fetch hierarchy employees
      const hierarchyResponse = await fetch(`${baseUrl}/api/employee-tree/employee/${employeeId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      let hierarchyIds = new Set()
      if (hierarchyResponse.ok) {
        const data = await hierarchyResponse.json()
        if (data.success && data.tree) {
          // Extract all employee IDs from the tree (including the root employee)
          const employeeIds = extractEmployeeIdsFromTree(data.tree)
          hierarchyIds = new Set(employeeIds)
          setHierarchyEmployeeIds(hierarchyIds)
        }
      } else {
        console.warn('Failed to fetch user hierarchy, will show all employees if permission allows')
      }
      
      // Fetch project team employees (employees from projects where user is PM)
      const projectTeamResponse = await fetch(`${baseUrl}/api/employee-tree/project-team-employees/${employeeId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      let projectTeamIds = new Set()
      if (projectTeamResponse.ok) {
        const projectData = await projectTeamResponse.json()
        if (projectData.success && projectData.employee_ids) {
          projectTeamIds = new Set(projectData.employee_ids)
          setProjectTeamEmployeeIds(projectTeamIds)
        }
      } else {
        console.warn('Failed to fetch project team employees')
      }
      
    } catch (err) {
      console.error('Error fetching user hierarchy or project team:', err)
      // If fetch fails, set empty sets (will rely on permission check)
      setHierarchyEmployeeIds(new Set())
      setProjectTeamEmployeeIds(new Set())
    } finally {
      setHierarchyLoading(false)
    }
  }, [])

  // Fetch all allocations once on component mount
  const fetchAllocations = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const token = getCookie(TOKEN)
      const baseUrl = getApiBaseUrl()
      
      // Fetch ALL allocations without any filters
      const url = `${baseUrl}/api/overall-kra-allocations`
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setAllocations(data)
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to fetch allocations')
      }
    } catch (err) {
      console.error('Error fetching allocations:', err)
      setError('Failed to fetch allocations')
    } finally {
      setLoading(false)
    }
  }

  // Generate allocations
  const handleGenerateAllocations = async () => {
    if (!hasPermission('kra-edit')) {
      alert('You do not have permission to generate allocations.')
      return
    }

    // For generation, we need at least one year
    if (selectedYears.length === 0) {
      alert('Please select at least one year to generate allocations.')
      return
    }

    setGenerating(true)
    try {
      const token = getCookie(TOKEN)
      const baseUrl = getApiBaseUrl()
      
      // Generate for each selected year
      let totalCreated = 0
      let totalUpdated = 0
      
      for (const year of selectedYears) {
        const response = await fetch(`${baseUrl}/api/overall-kra-allocations/generate`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            year: parseInt(year)
          })
        })
        
        if (response.ok) {
          const data = await response.json()
          totalCreated += data.created || 0
          totalUpdated += data.updated || 0
        } else {
          const errorData = await response.json()
          console.error(`Error generating allocations for year ${year}:`, errorData.error)
        }
      }
      
      alert(`Successfully generated allocations! Created: ${totalCreated}, Updated: ${totalUpdated}`)
      await fetchAllocations() // Refresh the list
    } catch (err) {
      console.error('Error generating allocations:', err)
      setError('Failed to generate allocations')
    } finally {
      setGenerating(false)
    }
  }

  // Update current user employee ID when user or employees change
  useEffect(() => {
    const employeeId = getCurrentUserEmployeeId
    setCurrentUserEmployeeId(employeeId)
    
    // Check permission once
    const canViewAll = hasPermission('view-all-kra-list')
    
    // Fetch hierarchy and project team if employee ID is available and user doesn't have view-all permission
    if (employeeId && !canViewAll) {
      fetchUserHierarchy(employeeId)
    } else if (canViewAll) {
      // If user has view-all permission, clear filters (show all)
      setHierarchyEmployeeIds(new Set())
      setProjectTeamEmployeeIds(new Set())
    }
  }, [getCurrentUserEmployeeId, fetchUserHierarchy, hasPermission, user?.email])

  // Fetch all allocations once on component mount
  useEffect(() => {
    fetchAllocations()
  }, []) // Only run once on mount

  // Helper to get quarter from date
  const getQuarterFromDate = (dateString) => {
    if (!dateString) return null
    const date = new Date(dateString)
    const month = date.getMonth() + 1 // 1-12
    if (month <= 3) return 'Q1'
    if (month <= 6) return 'Q2'
    if (month <= 9) return 'Q3'
    return 'Q4'
  }

  // Extract numeric weight from a goal, supporting multiple possible field names
  const getGoalWeight = (goal) => {
    const possibleKeys = [
      'weight',
      'weightage',
      'weightage_percentage',
      'weightage_percent',
      'goal_weight'
    ]
    for (const key of possibleKeys) {
      if (goal && goal[key] !== undefined && goal[key] !== null) {
        const raw = goal[key]
        if (typeof raw === 'number') {
          if (!Number.isNaN(raw)) return raw
        } else if (typeof raw === 'string') {
          // Extract first float from strings like "20%", "20.5 percent"
          const match = raw.match(/\d+(?:\.\d+)?/)
          if (match) {
            const num = parseFloat(match[0])
            if (!Number.isNaN(num)) return num
          }
        }
      }
    }
    return null
  }

  // Helper to check if goal matches quarter filter
  const goalMatchesQuarterFilter = (goal) => {
    if (!goal.start_date) return false
    
    const goalQuarter = getQuarterFromDate(goal.start_date)
    
    // Check quarter filter
    if (selectedQuarters.length > 0 && !selectedQuarters.includes(goalQuarter)) {
      return false
    }
    
    return true
  }

  // Navigate to previous year
  const handlePreviousYear = () => {
    setSelectedSimpleYear(prev => prev - 1)
  }

  // Navigate to next year
  const handleNextYear = () => {
    setSelectedSimpleYear(prev => prev + 1)
  }

  // Toggle sort order
  const handleSortToggle = () => {
    if (sortOrder === null) {
      setSortOrder('desc') // Start with descending (highest rating first)
    } else if (sortOrder === 'desc') {
      setSortOrder('asc') // Then ascending (lowest rating first)
    } else {
      setSortOrder(null) // Then no sort
    }
  }

  // Check if KRA matches year filter
  const kraMatchesYearFilter = (kra) => {
    const kraYear = kra.kra_year
    if (kraYear === null || kraYear === undefined) return false
    
    // Handle both string and number years
    const yearNum = typeof kraYear === 'string' ? parseInt(kraYear) : kraYear
    if (isNaN(yearNum)) return false
    
    // Check year filter - prioritize multi-select, then simple year filter
    if (selectedYears.length > 0) {
      // Multi-select year filter is active
      if (!selectedYears.includes(yearNum.toString())) {
        return false
      }
    } else if (selectedSimpleYear !== null) {
      // Simple year filter is active (only when multi-select is not active)
      if (yearNum !== selectedSimpleYear) {
        return false
      }
    }
    
    return true
  }

  // Calculate weighted average rating for a KRA (completed goals only)
  // Using Boosted Weighted Rating Formula: Σ(Rᵢ × Wᵢ) / 100
  // Where Rᵢ = Rating of each goal (out of 5), Wᵢ = Weight of each goal (in %)
  const calculateKraWeightedRating = (kra) => {
    const goals = kra.goals || []
    const goalsForKra = goals.filter(g =>
      (g?.status || '').toLowerCase() === 'completed' &&
      g?.goal_rating !== undefined && g?.goal_rating !== null &&
      !Number.isNaN(Number(g.goal_rating))
    )

    if (goalsForKra.length === 0) return null

    let weightedSum = 0
    goalsForKra.forEach(goal => {
      let weight = getGoalWeight(goal)
      const rating = Number(goal.goal_rating)
      
      // Skip if weight or rating is invalid
      if (weight === null || Number.isNaN(weight) || Number.isNaN(rating)) {
        return
      }
      
      // Multiply each goal's rating by its weight (weight is already in percentage)
      weightedSum += weight * rating
    })

    // Divide by 100 because weights are percentage-based
    // Formula: Σ(Rᵢ × Wᵢ) / 100
    const overallRating = weightedSum / 100
    
    // Ensure within 0-5 range
    return Math.max(0, Math.min(5, overallRating))
  }

  // Calculate overall rating for an employee (average of all KRA ratings)
  const calculateOverallRating = (kraAllocations) => {
    if (!kraAllocations || kraAllocations.length === 0) return 0
    
    const ratings = kraAllocations
      .map(kra => {
        // Use calculated weighted rating if available, otherwise use kra_rating
        const calculatedRating = calculateKraWeightedRating(kra)
        return calculatedRating !== null ? calculatedRating : kra.kra_rating
      })
      .filter(rating => rating !== null && rating !== undefined && !Number.isNaN(rating))
    
    if (ratings.length === 0) return 0
    
    const sum = ratings.reduce((a, b) => a + b, 0)
    return (sum / ratings.length).toFixed(2)
  }

  // Filter allocations by year, quarter, search term, and hierarchy permission (frontend filtering)
  const filteredAllocations = useMemo(() => {
    let filtered = allocations

    // Filter by hierarchy permission first (before other filters)
    // If user has 'view-all-kra-list' permission, show all employees
    // Otherwise, show only employees in their hierarchy OR from projects where they are PM
    if (!hasPermission('view-all-kra-list')) {
      // Combine hierarchy and project team employee IDs
      const allowedEmployeeIds = new Set([
        ...hierarchyEmployeeIds,
        ...projectTeamEmployeeIds
      ])
      
      // Filter to show only employees in current user's hierarchy or project teams
      if (allowedEmployeeIds.size > 0) {
        filtered = filtered.filter(alloc => {
          const employee = alloc.employee
          if (!employee) return false
          return allowedEmployeeIds.has(employee.id)
        })
      } else {
        // If neither hierarchy nor project teams are loaded yet and user doesn't have view-all permission,
        // show empty list (or show only current user)
        if (currentUserEmployeeId) {
          filtered = filtered.filter(alloc => {
            const employee = alloc.employee
            return employee && employee.id === currentUserEmployeeId
          })
        } else {
          // No employee ID found, show empty
          filtered = []
        }
      }
    }
    // If user has 'view-all-kra-list' permission, show all allocations (no hierarchy filter)

    // Filter by search term (employee name, email, ID)
    if (searchTerm.trim()) {
      filtered = filtered.filter(alloc => {
        const employee = alloc.employee
        if (!employee) return false
        
        const fullName = `${employee.first_name} ${employee.last_name}`.toLowerCase()
        const email = employee.email?.toLowerCase() || ''
        const employeeId = employee.employee_id?.toString().toLowerCase() || ''
        
        return fullName.includes(searchTerm.toLowerCase()) ||
               email.includes(searchTerm.toLowerCase()) ||
               employeeId.includes(searchTerm.toLowerCase())
      })
    }

    // Filter by employee status
    if (selectedStatus.length > 0) {
      filtered = filtered.filter(alloc => {
        const employee = alloc.employee
        if (!employee) return false
        return selectedStatus.includes(employee.employee_status || 'Active')
      })
    }

    // Filter KRAs by year and goals by quarter
    filtered = filtered.map(alloc => {
      const kraAllocations = alloc.allocation_data?.kra_allocations || []
      
      // Filter KRAs by year and goals by quarter
      const filteredKraAllocations = kraAllocations
        .map(kra => {
          // First check if KRA matches year filter (both multi-select and simple year filter)
          if (!kraMatchesYearFilter(kra)) {
            return null
          }
          
          // Filter goals by quarter
          const allGoals = kra.goals || []
          const filteredGoals = allGoals.filter(goal => goalMatchesQuarterFilter(goal))
          
          // Only include KRAs that have at least one goal after filtering
          if (filteredGoals.length === 0) {
            return null
          }
          
          // Recalculate KRA rating with filtered goals (only completed goals)
          // Filter only completed goals with valid ratings
          const completedGoals = filteredGoals.filter(g =>
            (g?.status || '').toLowerCase() === 'completed' &&
            g?.goal_rating !== undefined && g?.goal_rating !== null &&
            !Number.isNaN(Number(g.goal_rating))
          )
          
          let kraRating = null
          if (completedGoals.length > 0) {
            // Calculate weighted rating: Σ(Rᵢ × Wᵢ) / 100
            let weightedSum = 0
            completedGoals.forEach(goal => {
              const weight = getGoalWeight(goal)
              const rating = Number(goal.goal_rating)
              
              // Skip if weight or rating is invalid
              if (weight === null || Number.isNaN(weight) || Number.isNaN(rating)) {
                return
              }
              
              weightedSum += weight * rating
            })
            
            const calculatedRating = weightedSum / 100
            kraRating = Number(Math.max(0, Math.min(5, calculatedRating)).toFixed(2))
          }
          
          return {
            ...kra,
            goals: filteredGoals,
            kra_rating: kraRating
          }
        })
        .filter(kra => kra !== null) // Remove null entries
      
      // Only include allocation if it has KRAs after filtering
      if (filteredKraAllocations.length === 0) {
        return null
      }
      
      return {
        ...alloc,
        allocation_data: {
          ...alloc.allocation_data,
          kra_allocations: filteredKraAllocations
        }
      }
    }).filter(alloc => alloc !== null) // Remove allocations with no KRAs

    // Sort by overall rating if sort order is set
    if (sortOrder) {
      filtered = [...filtered].sort((a, b) => {
        const kraAllocationsA = a.allocation_data?.kra_allocations || []
        const kraAllocationsB = b.allocation_data?.kra_allocations || []
        const ratingA = parseFloat(calculateOverallRating(kraAllocationsA)) || 0
        const ratingB = parseFloat(calculateOverallRating(kraAllocationsB)) || 0
        
        if (sortOrder === 'desc') {
          return ratingB - ratingA // Descending: highest first
        } else {
          return ratingA - ratingB // Ascending: lowest first
        }
      })
    }

    return filtered
  }, [allocations, selectedYears, selectedQuarters, selectedStatus, searchTerm, selectedSimpleYear, sortOrder, hasPermission, hierarchyEmployeeIds, projectTeamEmployeeIds, currentUserEmployeeId])

  // Get display years text
  const getYearsDisplayText = () => {
    if (selectedYears.length === 0) return 'All Years'
    if (selectedYears.length === 1) return selectedYears[0]
    return `${selectedYears.length} years selected`
  }

  // Get display quarters text
  const getQuartersDisplayText = () => {
    if (selectedQuarters.length === 0) return 'All Quarters'
    if (selectedQuarters.length === 1) {
      const quarter = quarterOptions.find(q => q.value === selectedQuarters[0])
      return quarter ? quarter.label.split(' ')[0] : selectedQuarters[0]
    }
    return `${selectedQuarters.length} quarters selected`
  }

  // Toggle employee expansion
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

  // Toggle KRA expansion
  const toggleKRAExpansion = (employeeId, kraId) => {
    const key = `${employeeId}-${kraId}`
    setExpandedKRAs(prev => {
      const newSet = new Set(prev)
      if (newSet.has(key)) {
        newSet.delete(key)
      } else {
        newSet.add(key)
      }
      return newSet
    })
  }

  // Format date helper
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  // Get status color helper
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'on-hold':
      case 'on_hold':
        return 'bg-yellow-100 text-yellow-800'
      case 'pending':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // Format status display text
  const formatStatusDisplay = (status) => {
    if (!status) return 'N/A'
    if (status.toLowerCase() === 'in_progress' || status.toLowerCase() === 'in-progress') {
      return 'In Progress'
    }
    return status
  }

  // Render fractional star rating (supports halves) e.g., 3.5, 2.08
  const renderFractionalStarRating = (rating) => {
    if (!rating || rating === 0) return null
    
    const stars = []
    const starPath = "M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
    
    for (let i = 0; i < 5; i++) {
      const remainder = rating - i
      const fillPercent = Math.max(0, Math.min(1, remainder)) * 100
      stars.push(
        <span key={i} className="relative inline-block w-4 h-4" style={{ lineHeight: 0 }}>
          {/* Background star (unfilled) */}
          <svg
            className="absolute inset-0 w-4 h-4 text-gray-300"
            fill="currentColor"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d={starPath} />
          </svg>
          {/* Foreground star (filled portion) */}
          <svg
            className="absolute inset-0 w-4 h-4 text-yellow-400"
            fill="currentColor"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
            style={{ clipPath: `inset(0 ${100 - fillPercent}% 0 0)` }}
          >
            <path d={starPath} />
          </svg>
        </span>
      )
    }
    return <div className="flex items-center gap-0.5">{stars}</div>
  }

  // Render star rating (for goals - simple version)
  const renderStarRating = (rating) => {
    if (!rating || rating === 0) return null
    
    const stars = []
    const fullStars = Math.floor(rating)
    const hasHalfStar = rating % 1 >= 0.5
    
    for (let i = 0; i < 5; i++) {
      const isFilled = i < fullStars || (i === fullStars && hasHalfStar)
      stars.push(
        <svg
          key={i}
          className={`w-4 h-4 ${isFilled ? 'text-yellow-400' : 'text-gray-300'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      )
    }
    
    return (
      <div className="flex items-center gap-0.5">
        {stars}
        <span className="text-sm text-slate-600 ml-1">({rating}/5)</span>
      </div>
    )
  }

  if (!hasPermission('kra-view')) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
        <h2 className="text-xl font-bold text-slate-900 mb-2">Access Denied</h2>
        <p className="text-slate-600">You don't have permission to view Overall KRA Allocations.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <p className="text-red-800">Error: {error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-600 hover:text-red-800 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Filters and Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-2 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              {/* <h2 className="text-base font-semibold text-slate-900">Overall KRA ratings</h2> */}
              
              {/* Search Input */}
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                  </svg>
                </div>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search Employee..."
                  className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-800 focus:border-green-800"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                )}
              </div>

              {/* Generate Button */}
              {/* {hasPermission('kra-edit') && (
                <button
                  onClick={handleGenerateAllocations}
                  disabled={generating || selectedYears.length === 0}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                    generating || selectedYears.length === 0
                      ? 'bg-green-600 cursor-not-allowed text-white'
                      : 'bg-green-800 text-white hover:bg-green-900'
                  }`}
                >
                  {generating ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Generating...
                    </div>
                  ) : (
                    'Generate Allocations'
                  )}
                </button>
              )} */}
            </div>
            
            <div className="flex items-center gap-2">
              {/* Simple Year Navigation Filter */}
              <div className={`inline-flex items-center gap-1 px-2 py-1.5 border rounded-lg transition-all duration-200 ${
                selectedYears.length > 0
                  ? 'bg-slate-100 border-slate-300 text-slate-400 cursor-not-allowed'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}>
                <button
                  onClick={handlePreviousYear}
                  disabled={selectedYears.length > 0}
                  className={`p-1 rounded transition-colors ${
                    selectedYears.length > 0
                      ? 'text-slate-300 cursor-not-allowed'
                      : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                  }`}
                  title="Previous year"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/>
                  </svg>
                </button>
                <span className={`px-2 py-0.5 text-xs font-medium min-w-[50px] text-center ${
                  selectedYears.length > 0 ? 'text-slate-400' : 'text-slate-900'
                }`}>
                  {selectedSimpleYear}
                </span>
                <button
                  onClick={handleNextYear}
                  disabled={selectedYears.length > 0}
                  className={`p-1 rounded transition-colors ${
                    selectedYears.length > 0
                      ? 'text-slate-300 cursor-not-allowed'
                      : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                  }`}
                  title="Next year"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
                  </svg>
                </button>
              </div>
              
              {/* Sort Button */}
              <button
                onClick={handleSortToggle}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 border ${
                  sortOrder === null
                    ? 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    : sortOrder === 'desc'
                    ? 'bg-green-800 text-white border-green-800'
                    : 'bg-green-700 text-white border-green-700'
                }`}
                title={sortOrder === null ? 'Sort by rating' : sortOrder === 'desc' ? 'Sorting: Highest first' : 'Sorting: Lowest first'}
              >
                {sortOrder === 'desc' ? (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"/>
                  </svg>
                ) : sortOrder === 'asc' ? (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18"/>
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"/>
                  </svg>
                )}
                <span className="text-xs">Sort</span>
              </button>
              
              {/* Filters Button */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 border ${
                  showFilters || selectedYears.length > 0 || selectedQuarters.length > 0 || (selectedStatus.length > 0 && !(selectedStatus.length === 1 && selectedStatus.includes('Active')))
                    ? 'bg-green-800 text-white border-green-800'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/>
                </svg>
                Filters
                <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${showFilters ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Expandable Filters Panel */}
        {showFilters && (
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
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
                {/* Year Multi-Select */}
                <div className="flex-1">
                  <MultiSelect
                    label="Year"
                    options={getYearOptions}
                    selectedValues={selectedYears}
                    onSelectionChange={setSelectedYears}
                    placeholder={selectedYears.length === 0 ? selectedSimpleYear.toString() : "All Years"}
                    searchPlaceholder="Filter years..."
                  />
                </div>
                
                {/* Quarter Multi-Select */}
                <div className="flex-1">
                  <MultiSelect
                    label="Quarter"
                    options={quarterOptions}
                    selectedValues={selectedQuarters}
                    onSelectionChange={setSelectedQuarters}
                    placeholder="All Quarters"
                    searchPlaceholder="Filter quarters..."
                  />
                </div>

                {/* Status Multi-Select */}
                <div className="flex-1">
                  <MultiSelect
                    label="Status"
                    options={[
                      { value: 'Active', label: 'Active' },
                      { value: 'Inactive', label: 'Inactive' },
                      { value: 'Resigned', label: 'Resigned' },
                      { value: 'Terminated', label: 'Terminated' }
                    ]}
                    selectedValues={selectedStatus}
                    onSelectionChange={setSelectedStatus}
                    placeholder="All Status"
                    searchPlaceholder="Filter status..."
                  />
                </div>
              </div>
              
              {/* Clear Filters Button */}
              <div className="mt-3 flex justify-end">
                <button
                  onClick={() => {
                    setSelectedYears([])
                    setSelectedQuarters([])
                    setSelectedStatus(['Active'])
                  }}
                  className="text-sm text-slate-600 hover:text-slate-800 transition-colors"
                  disabled={selectedYears.length === 0 && selectedQuarters.length === 0 && (selectedStatus.length === 0 || (selectedStatus.length === 1 && selectedStatus.includes('Active')))}
                >
                  Clear all filters
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Active Filters Display */}
        {(selectedYears.length > 0 || selectedQuarters.length > 0 || (selectedStatus.length > 0 && !(selectedStatus.length === 1 && selectedStatus.includes('Active')))) && (
          <div className="px-4 py-3 border-b border-slate-200">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <span className="font-medium">Active Filters:</span>
              {selectedYears.length > 0 && (
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded-md">
                  {getYearsDisplayText()}
                </span>
              )}
              {selectedQuarters.length > 0 && (
                <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-md">
                  {getQuartersDisplayText()}
                </span>
              )}
              {selectedStatus.length > 0 && !(selectedStatus.length === 1 && selectedStatus.includes('Active')) && (
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-md">
                  {selectedStatus.length === 1 ? selectedStatus[0] : `${selectedStatus.length} statuses`}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Allocations List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-4">
          {(loading || hierarchyLoading) ? (
            <div className="flex justify-center items-center py-12">
              <div className="w-8 h-8 border-4 border-green-200 border-t-green-800 rounded-full animate-spin"></div>
              <span className="ml-3 text-slate-600">Loading allocations...</span>
            </div>
          ) : filteredAllocations.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-12 h-12 text-slate-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
              </svg>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No Allocations Found</h3>
              <p className="text-slate-600 mb-4">
                {searchTerm
                  ? 'No employees match your search criteria'
                  : !hasPermission('view-all-kra-list') && hierarchyEmployeeIds.size === 0 && projectTeamEmployeeIds.size === 0 && currentUserEmployeeId
                    ? 'No employees found in your hierarchy or project teams. You can only view KRA allocations for employees who report to you or are in your project teams.'
                    : selectedYears.length === 0 && selectedQuarters.length === 0
                      ? 'Please select at least one filter (Year or Quarter) to view allocations, or click "Generate Allocations" to create them.'
                      : 'No allocations found matching the selected filters. Click "Generate Allocations" to create them.'
                }
              </p>
              {hasPermission('kra-edit') && !searchTerm && selectedYears.length > 0 && (
                <button
                  onClick={handleGenerateAllocations}
                  disabled={generating}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-green-800 text-white rounded-lg hover:bg-green-900 transition-colors disabled:opacity-50"
                >
                  Generate Allocations
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAllocations.map((allocation) => {
                const employee = allocation.employee
                if (!employee) return null
                
                const employeeId = employee.id
                const isExpanded = expandedEmployees.has(employeeId)
                const kraAllocations = allocation.allocation_data?.kra_allocations || []
                const overallRating = calculateOverallRating(kraAllocations)
                
                return (
                  <div key={allocation.id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                    {/* Employee Header */}
                    <button
                      onClick={() => toggleEmployeeExpansion(employeeId)}
                      className="w-full text-left p-3 hover:bg-slate-50 transition-colors flex justify-between items-center"
                    >
                      <div className="flex items-center gap-2">
                        <svg
                          className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
                        </svg>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-base font-semibold text-slate-900">
                              {employee.first_name} {employee.last_name}
                            </span>
                            <span className="text-xs text-slate-500">
                              ({employee.employee_id || `EMP-${employee.id}`})
                            </span>
                          </div>
                          {kraAllocations.length > 0 && (
                            <span className="px-1.5 py-0.5 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                              {kraAllocations.length} KRA{kraAllocations.length !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {overallRating > 0 && (
                          <div className="flex items-center gap-1">
                            <svg
                              className="w-4 h-4 text-yellow-400"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                            <span className="text-sm font-semibold text-slate-900">({overallRating}/5)</span>
                          </div>
                        )}
                      </div>
                    </button>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="border-t border-slate-200 bg-slate-50 p-3 space-y-2">
                        {kraAllocations.length === 0 ? (
                          <p className="text-sm text-slate-500 text-center py-4">
                            No KRA allocations found for this employee
                          </p>
                        ) : (
                          kraAllocations.map((kra, kraIndex) => {
                            const goalsCount = kra.goals?.length || 0
                            const kraKey = `${employeeId}-${kra.kra_id || kraIndex}`
                            const isKRAExpanded = expandedKRAs.has(kraKey)
                            // Calculate accurate KRA rating using weighted formula
                            const kraWeightedRating = calculateKraWeightedRating(kra)
                            const kraRating = kraWeightedRating !== null ? kraWeightedRating : kra.kra_rating
                            
                            return (
                              <div key={kra.kra_id || kraIndex} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                                {/* KRA Header - Clickable to toggle goals */}
                                <button
                                  onClick={() => toggleKRAExpansion(employeeId, kra.kra_id || kraIndex)}
                                  className="w-full text-left p-2.5 hover:bg-slate-50 transition-colors flex justify-between items-center"
                                >
                                  <div className="flex items-center gap-2 flex-1">
                                    <svg
                                      className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isKRAExpanded ? 'rotate-90' : ''}`}
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
                                    </svg>
                                    <div className="flex-1">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-sm font-medium text-slate-900">
                                          KRA: {kra.kra_name}
                                        </span>
                                        {goalsCount > 0 && (
                                          <span className="px-1.5 py-0.5 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                                            {goalsCount} Goal{goalsCount !== 1 ? 's' : ''}
                                          </span>
                                        )}
                                        {(kra.kra_year || allocation.year) && (
                                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
                                            {kra.kra_year || allocation.year}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  {kraRating && (
                                    <div className="flex items-center gap-1.5">
                                      {renderFractionalStarRating(kraRating)}
                                      <span className="text-xs text-slate-600">({Number(kraRating).toFixed(2)}/5)</span>
                                    </div>
                                  )}
                                </button>
                                
                                {/* Goals Table - Collapsible */}
                                {isKRAExpanded && (
                                  <div className="border-t border-slate-200 bg-slate-50">
                                    {goalsCount > 0 ? (
                                      <div className="p-2">
                                        <div className="overflow-x-auto">
                                          <table className="w-full text-xs">
                                            <thead className="bg-slate-100">
                                              <tr>
                                                <th className="px-2 py-1.5 text-left font-semibold text-slate-700 text-xs">Goal Description</th>
                                                <th className="px-2 py-1.5 text-left font-semibold text-slate-700 text-xs">Quarter</th>
                                                <th className="px-2 py-1.5 text-left font-semibold text-slate-700 text-xs">Start Date</th>
                                                <th className="px-2 py-1.5 text-left font-semibold text-slate-700 text-xs">End Date</th>
                                                <th className="px-2 py-1.5 text-left font-semibold text-slate-700 text-xs">Status</th>
                                                <th className="px-2 py-1.5 text-left font-semibold text-slate-700 text-xs">Weightage</th>
                                                <th className="px-2 py-1.5 text-left font-semibold text-slate-700 text-xs">Rating</th>
                                                <th className="px-2 py-1.5 text-left font-semibold text-slate-700 text-xs">Rated By</th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200 bg-white">
                                              {kra.goals.map((goal, goalIndex) => (
                                                  <tr key={goal.goal_id || goalIndex} className="hover:bg-slate-50">
                                                    <td className="px-2 py-2">
                                                      <div className="flex items-center gap-2">
                                                        <svg className="w-3.5 h-3.5 text-green-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"/>
                                                        </svg>
                                                        <span className="text-slate-900 text-xs">{goal.goal_description}</span>
                                                      </div>
                                                    </td>
                                                    <td className="px-2 py-2">
                                                      {goal.quarter ? (
                                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
                                                          {goal.quarter}
                                                        </span>
                                                      ) : (
                                                        <span className="text-slate-400 text-xs">N/A</span>
                                                      )}
                                                    </td>
                                                    <td className="px-2 py-2 text-slate-600 text-xs">{formatDate(goal.start_date)}</td>
                                                    <td className="px-2 py-2 text-slate-600 text-xs">{formatDate(goal.end_date)}</td>
                                                    <td className="px-2 py-2">
                                                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(goal.status)}`}>
                                                        {formatStatusDisplay(goal.status)}
                                                      </span>
                                                    </td>
                                                    <td className="px-2 py-2 text-slate-600 text-xs">{goal.weightage ? `${goal.weightage}%` : '0%'}</td>
                                                    <td className="px-2 py-2">
                                                      {goal.goal_rating ? (
                                                        renderStarRating(goal.goal_rating)
                                                      ) : (
                                                        <span className="text-slate-400 text-xs">Not rated</span>
                                                      )}
                                                    </td>
                                                    <td className="px-2 py-2 text-slate-600 text-xs">
                                                      {goal.rated_by && goal.rated_by !== 'N/A' ? goal.rated_by : '-'}
                                                    </td>
                                                  </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="p-3">
                                        <p className="text-sm text-slate-500 italic text-center">No goals assigned</p>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )
                          })
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default OverallKRAAllocationsTab
