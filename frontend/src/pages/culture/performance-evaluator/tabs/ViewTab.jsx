import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import apiClient from '../../../../utils/auth.js'
import { useEmployees } from '../../../../context/EmployeeContext.jsx'
import { usePermissions } from '../../../../context/PermissionContext.jsx'
import { useAuth } from '../../../../context/AuthContext.jsx'
import { getCookie } from '../../../../utils/helpers.js'
import { TOKEN, getApiBaseUrl } from '../../../../utils/constants.js'

const ViewTab = () => {
  const { getAllEmployees } = useEmployees()
  const allEmployees = getAllEmployees()
  const { hasPermission } = usePermissions()
  const { user } = useAuth()
  const [hierarchyEmployeeIds, setHierarchyEmployeeIds] = useState(new Set())
  const [projectTeamEmployeeIds, setProjectTeamEmployeeIds] = useState(new Set())
  const [hierarchyLoading, setHierarchyLoading] = useState(false)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState('')
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false)
  const [showAllEmployees, setShowAllEmployees] = useState(false)
  const employeeDropdownRef = useRef(null)
  // 12-month window navigation - track the end month (most recent month in the window)
  const [windowEndMonth, setWindowEndMonth] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() + 1 }
  })
  const [historyData, setHistoryData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [exporting, setExporting] = useState(false)
  const loadHistoryAbortControllerRef = useRef(null)
  
  // Get current user's employee ID from email
  const getCurrentUserEmployeeId = useMemo(() => {
    if (!user?.email) return null
    const employee = allEmployees.find(emp => emp.email === user.email)
    return employee?.id || null
  }, [user?.email, allEmployees])

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
        console.warn('Failed to fetch user hierarchy')
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

  // Fetch user hierarchy and project team when component mounts or when employee ID changes
  useEffect(() => {
    const employeeId = getCurrentUserEmployeeId
    
    // Always fetch hierarchy and project team (user has permission to access page, but only sees their hierarchy/project teams)
    if (employeeId) {
      fetchUserHierarchy(employeeId)
    }
  }, [getCurrentUserEmployeeId, fetchUserHierarchy, user?.email])
  
  // Filter employees based on hierarchy and project teams
  const filteredEmployees = useMemo(() => {
    // Combine hierarchy and project team employee IDs
    const allowedEmployeeIds = new Set([
      ...hierarchyEmployeeIds,
      ...projectTeamEmployeeIds
    ])
    
    let filtered = allEmployees
    
    // Filter to show only employees in current user's hierarchy or project teams
    if (allowedEmployeeIds.size > 0) {
      filtered = filtered.filter(emp => {
        return allowedEmployeeIds.has(emp.id)
      })
    } else {
      // If hierarchy/project teams haven't loaded yet, show empty list (will show loading state)
      filtered = []
    }
    
    // Apply status filter (only active employees)
    return filtered.filter(emp => emp.employee_status !== 'Inactive')
  }, [allEmployees, hierarchyEmployeeIds, projectTeamEmployeeIds])

  // Filter employees for search dropdown
  const searchableEmployees = useMemo(() => {
    if (!employeeSearchTerm.trim()) {
      // Show first 20 or all if showAllEmployees is true
      return showAllEmployees ? filteredEmployees : filteredEmployees.slice(0, 20)
    }
    
    // When searching, filter through all employees
    const filtered = filteredEmployees.filter(emp => {
      const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase()
      const email = emp.email?.toLowerCase() || ''
      const department = emp.department?.toLowerCase() || ''
      const designation = (emp.designation || emp.zoho_role || '').toLowerCase()
      const searchLower = employeeSearchTerm.toLowerCase()
      
      return fullName.includes(searchLower) || 
             email.includes(searchLower) || 
             department.includes(searchLower) || 
             designation.includes(searchLower)
    })
    
    // Limit to 20 results when searching
    return filtered.slice(0, 20)
  }, [filteredEmployees, employeeSearchTerm, showAllEmployees])
  
  const loadHistory = async () => {
    // Cancel any in-flight request
    if (loadHistoryAbortControllerRef.current) {
      loadHistoryAbortControllerRef.current.abort()
    }
    
    if (!selectedEmployeeId) {
      setHistoryData(null)
      setError(null)
      setLoading(false)
      return
    }
    
    // Create new abort controller for this request
    const abortController = new AbortController()
    loadHistoryAbortControllerRef.current = abortController
    
    setLoading(true)
    setError(null)
    
    // Store the employee ID at the start of the request
    const currentEmployeeId = selectedEmployeeId
    
    try {
      // Use windowEndMonth as the reference period for the API
      const response = await apiClient.get(
        `/api/culture/performance-evaluations/employee/${currentEmployeeId}/history`,
        {
          params: {
            period_month: windowEndMonth.month,
            period_year: windowEndMonth.year
          },
          signal: abortController.signal
        }
      )
      
      // Check if the request was aborted or if employee changed
      if (abortController.signal.aborted) {
        return
      }
      
      // Verify the employee ID is still the same (user didn't switch employees)
      if (selectedEmployeeId !== currentEmployeeId) {
        return
      }
      
      setHistoryData(response.data)
    } catch (err) {
      // Don't set error if request was aborted (axios uses CanceledError)
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED' || err.message === 'canceled') {
        return
      }
      
      // Check if employee changed during the request
      if (selectedEmployeeId !== currentEmployeeId) {
        return
      }
      
      console.error('Error loading history:', err)
      const errorMessage = err.response?.data?.error || err.response?.data?.details || err.message || 'Failed to load history'
      setError(errorMessage)
    } finally {
      // Only update loading state if this is still the current request
      if (selectedEmployeeId === currentEmployeeId && !abortController.signal.aborted) {
        setLoading(false)
      }
    }
  }

  // Auto-load history when employee or window changes
  useEffect(() => {
    // Cancel any pending requests when dependencies change
    if (loadHistoryAbortControllerRef.current) {
      loadHistoryAbortControllerRef.current.abort()
      loadHistoryAbortControllerRef.current = null
    }
    
    if (selectedEmployeeId) {
      loadHistory()
    } else {
      // Clear history and error when employee is deselected
      setHistoryData(null)
      setError(null)
      setLoading(false)
    }
    
    // Cleanup: cancel request on unmount
    return () => {
      if (loadHistoryAbortControllerRef.current) {
        loadHistoryAbortControllerRef.current.abort()
        loadHistoryAbortControllerRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEmployeeId, windowEndMonth])
  
  const exportToCSV = async () => {
    if (!selectedEmployeeId) {
      setError('Please select an employee')
      return
    }
    
    setExporting(true)
    setError(null)
    
    try {
      const response = await apiClient.get(
        '/api/culture/performance-evaluations/export',
        {
          params: {
            employee_id: selectedEmployeeId,
            period_month: windowEndMonth.month,
            period_year: windowEndMonth.year
          },
          responseType: 'blob'
        }
      )
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `performance_evaluations_export_${new Date().toISOString().split('T')[0]}.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (err) {
      console.error('Error exporting:', err)
      setError('Failed to export data')
    } finally {
      setExporting(false)
    }
  }
  
  // Calculate start month (11 months before end month)
  const windowStartMonth = useMemo(() => {
    const endDate = new Date(windowEndMonth.year, windowEndMonth.month - 1, 1)
    const startDate = new Date(endDate)
    startDate.setMonth(startDate.getMonth() - 11)
    return { year: startDate.getFullYear(), month: startDate.getMonth() + 1 }
  }, [windowEndMonth])

  // Format month for display
  const formatMonthDisplay = (year, month) => {
    const date = new Date(year, month - 1, 1)
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  }

  // Navigate the 12-month window
  const navigateWindow = (direction) => {
    setWindowEndMonth(prev => {
      const currentDate = new Date(prev.year, prev.month - 1, 1)
      const newDate = new Date(currentDate)
      newDate.setMonth(newDate.getMonth() + direction)
      return { year: newDate.getFullYear(), month: newDate.getMonth() + 1 }
    })
  }

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (employeeDropdownRef.current && !employeeDropdownRef.current.contains(event.target)) {
        setShowEmployeeDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])
  

  // Update selectedEmployeeId when selectedEmployee changes
  useEffect(() => {
    if (selectedEmployee) {
      setSelectedEmployeeId(selectedEmployee.id.toString())
    } else {
      setSelectedEmployeeId('')
    }
  }, [selectedEmployee])

  const handleEmployeeSelect = (employee) => {
    setSelectedEmployee(employee)
    setEmployeeSearchTerm(`${employee.first_name} ${employee.last_name}`)
    setShowEmployeeDropdown(false)
  }

  const handleEmployeeSearchChange = (value) => {
    setEmployeeSearchTerm(value)
    setShowEmployeeDropdown(true)
    setShowAllEmployees(false) // Reset show all when searching
    if (!value) {
      setSelectedEmployee(null)
      setSelectedEmployeeId('')
    }
  }

  const clearEmployeeSelection = () => {
    // Cancel any in-flight request
    if (loadHistoryAbortControllerRef.current) {
      loadHistoryAbortControllerRef.current.abort()
      loadHistoryAbortControllerRef.current = null
    }
    
    setSelectedEmployee(null)
    setSelectedEmployeeId('')
    setEmployeeSearchTerm('')
    setShowEmployeeDropdown(false)
    setShowAllEmployees(false)
    // Clear history and error when employee is deselected
    setHistoryData(null)
    setError(null)
    setLoading(false)
  }


  
  // Criteria list matching backend
  const criteriaList = [
    { name: 'Domain Mastery', category: 'Role Effectiveness' },
    { name: 'Execution Quality', category: 'Role Effectiveness' },
    { name: 'Hustle & Grit', category: 'Core Values & Work Ethic' },
    { name: 'Learning Velocity', category: 'Core Values & Work Ethic' },
    { name: 'Organized Execution', category: 'Core Values & Work Ethic' },
    { name: 'Professional Maturity', category: 'Core Values & Work Ethic' },
    { name: 'Team Amplifier', category: 'Core Values & Work Ethic' },
    { name: 'Resourcefulness', category: 'SquareShift DNA' },
    { name: 'Chaos Navigation', category: 'SquareShift DNA' },
    { name: 'Solution Builder', category: 'SquareShift DNA' },
    { name: 'Speed with Judgment', category: 'SquareShift DNA' },
    { name: 'Direct Communication', category: 'SquareShift DNA' },
    { name: 'Mentorship', category: 'Growth & Leadership' },
    { name: 'Initiative Taking', category: 'Growth & Leadership' },
    { name: 'Strategic Thinking', category: 'Growth & Leadership' },
    { name: 'Influence', category: 'Growth & Leadership' },
    { name: 'Building for Scale', category: 'Growth & Leadership' },
  ]
  
  const getCategoryCriteria = (category) => {
    return criteriaList.filter(c => c.category === category)
  }
  
  const getScoreForPeriod = (periodData, criterionName) => {
    if (!periodData.evaluation) return null
    const criterion = periodData.criteria.find(c => c.criterion_name === criterionName)
    return criterion?.score || null
  }
  
  const getSectionAverage = (periodData, category) => {
    if (!periodData.evaluation) return null
    const categoryCriteria = getCategoryCriteria(category)
    const scores = categoryCriteria
      .map(c => getScoreForPeriod(periodData, c.name))
      .filter(s => s !== null)
    if (scores.length === 0) return null
    return (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)
  }
  
  const getOverallScore = (periodData) => {
    if (!periodData.evaluation) return null
    const evaluation = periodData.evaluation
    if (!evaluation.role_effectiveness_score || !evaluation.values_score || !evaluation.dna_score || !evaluation.leadership_score) return null
    return (
      (evaluation.role_effectiveness_score * 0.20) +
      (evaluation.values_score * 0.35) +
      (evaluation.dna_score * 0.30) +
      (evaluation.leadership_score * 0.15)
    ).toFixed(2)
  }
  
  const formatMonthYear = (month, year) => {
    const date = new Date(year, month - 1)
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  }
  
  const getScoreColor = (score) => {
    if (score === null) return 'text-slate-400'
    if (score >= 4) return 'text-green-600 font-semibold'
    if (score >= 3) return 'text-yellow-600 font-semibold'
    if (score >= 2) return 'text-orange-600 font-semibold'
    return 'text-red-600 font-semibold'
  }
  
  const getTalentBadgeClass = (segment) => {
    switch (segment) {
      case 'Star': return 'bg-yellow-100 text-yellow-800'
      case 'High Potential': return 'bg-blue-100 text-blue-800'
      case 'Core': return 'bg-green-100 text-green-800'
      case 'Development Zone': return 'bg-red-100 text-red-800'
      default: return 'bg-slate-100 text-slate-800'
    }
  }
  
  if (!historyData && !loading) {
    return (
      <div>
        <div className="flex gap-4 mb-6">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">
              Select Employee
            </label>
            <div className="relative" ref={employeeDropdownRef}>
              <div className="relative">
                <input
                  type="text"
                  value={employeeSearchTerm}
                  onChange={(e) => handleEmployeeSearchChange(e.target.value)}
                  onFocus={() => setShowEmployeeDropdown(true)}
                  placeholder="Search employees..."
                  className="block w-full px-3 py-1.5 pr-8 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500"
                />
                {employeeSearchTerm && (
                  <button
                    onClick={clearEmployeeSelection}
                    className="absolute inset-y-0 right-6 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowEmployeeDropdown(!showEmployeeDropdown)}
                  className="absolute inset-y-0 right-0 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                  style={{ paddingRight: '6px' }}
                >
                  <svg className={`w-4 h-4 transition-transform duration-200 ${showEmployeeDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
                  </svg>
                </button>
              </div>
              
              {/* Dropdown */}
              {showEmployeeDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded-md shadow-lg max-h-60 overflow-auto">
                  {hierarchyLoading ? (
                    <div className="px-3 py-4 text-sm text-slate-500 flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-green-200 border-t-green-700 rounded-full animate-spin"></div>
                      Loading employees...
                    </div>
                  ) : searchableEmployees.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-slate-500">
                      {hierarchyEmployeeIds.size === 0 && projectTeamEmployeeIds.size === 0 && getCurrentUserEmployeeId
                        ? 'No employees found in your hierarchy or project teams. You can only view performance evaluations for employees who report to you or are in your project teams.'
                        : 'No employees found'}
                    </div>
                  ) : (
                    <>
                      {searchableEmployees.map(emp => (
                        <button
                          key={emp.id}
                          onClick={() => handleEmployeeSelect(emp)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                        >
                          <div className="font-medium text-slate-900">
                            {emp.first_name} {emp.last_name}
                          </div>
                          <div className="text-xs text-slate-500">
                            {emp.department} • {emp.designation || emp.zoho_role || 'N/A'}
                          </div>
                        </button>
                      ))}
                      
                      {/* Show more button when not searching and there are more employees */}
                      {!employeeSearchTerm.trim() && !showAllEmployees && filteredEmployees.length > 20 && (
                        <button
                          onClick={() => setShowAllEmployees(true)}
                          className="w-full text-left px-3 py-2 text-sm text-green-700 hover:bg-green-50 focus:bg-green-50 focus:outline-none border-t border-slate-200"
                        >
                          Show all {filteredEmployees.length} employees...
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-end gap-2">
            {/* 12-Month Window Navigation */}
            <div className="flex items-center gap-2 px-4 py-1 bg-white border border-slate-300 rounded-lg">
              <button
                onClick={() => navigateWindow(-1)}
                className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                type="button"
                title="Previous month"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/>
                </svg>
              </button>
              <span className="text-sm font-medium text-slate-700 min-w-[200px] text-center">
                {formatMonthDisplay(windowStartMonth.year, windowStartMonth.month)} - {formatMonthDisplay(windowEndMonth.year, windowEndMonth.month)}
              </span>
              <button
                onClick={() => navigateWindow(1)}
                className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                type="button"
                title="Next month"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
                </svg>
              </button>
          </div>
            <button
              onClick={loadHistory}
            disabled={!selectedEmployeeId || loading}
            className={`px-4 py-2 text-sm rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${
              historyData 
                ? 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50' 
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
            >
              {loading ? (
                <>
                <div className={`animate-spin rounded-full h-4 w-4 border-b-2 ${historyData ? 'border-slate-600' : 'border-white'}`}></div>
                  Loading...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                  </svg>
                  Load History
                </>
              )}
            </button>
          </div>
        </div>
        
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 flex items-center justify-between gap-4">
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="flex-shrink-0 text-red-600 hover:text-red-800 focus:outline-none"
              type="button"
              aria-label="Close error message"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
        )}
        
        <div className="text-center py-12 text-slate-500">
          <p>Select an employee to view evaluation history</p>
        </div>
      </div>
    )
  }
  
  return (
    <div>
      <div className="flex gap-4 mb-6">
        <div className="flex-1">
          <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">
            Select Employee
          </label>
          <div className="relative" ref={employeeDropdownRef}>
            <div className="relative">
              <input
                type="text"
                value={employeeSearchTerm}
                onChange={(e) => handleEmployeeSearchChange(e.target.value)}
                onFocus={() => setShowEmployeeDropdown(true)}
                placeholder="Search employees..."
                className="block w-full px-3 py-1.5 pr-8 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500"
              />
              {employeeSearchTerm && (
                <button
                  onClick={clearEmployeeSelection}
                  className="absolute inset-y-0 right-6 flex items-center text-slate-400 hover:text-slate-600"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowEmployeeDropdown(!showEmployeeDropdown)}
                className="absolute inset-y-0 right-0 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                style={{ paddingRight: '6px' }}
              >
                <svg className={`w-4 h-4 transition-transform duration-200 ${showEmployeeDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
                </svg>
              </button>
            </div>
            
            {/* Dropdown */}
            {showEmployeeDropdown && (
              <div className="absolute z-[9999] w-full mt-1 bg-white border border-slate-300 rounded-md shadow-lg max-h-60 overflow-auto">
                {hierarchyLoading ? (
                  <div className="px-3 py-4 text-sm text-slate-500 flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-green-200 border-t-green-700 rounded-full animate-spin"></div>
                    Loading employees...
                  </div>
                ) : searchableEmployees.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-slate-500">
                    {hierarchyEmployeeIds.size === 0 && projectTeamEmployeeIds.size === 0 && getCurrentUserEmployeeId
                      ? 'No employees found in your hierarchy or project teams. You can only view performance evaluations for employees who report to you or are in your project teams.'
                      : 'No employees found'}
                  </div>
                ) : (
                  <>
                    {searchableEmployees.map(emp => (
                      <button
                        key={emp.id}
                        onClick={() => handleEmployeeSelect(emp)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                      >
                        <div className="font-medium text-slate-900">
                          {emp.first_name} {emp.last_name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {emp.department} • {emp.designation || emp.zoho_role || 'N/A'}
                        </div>
                      </button>
                    ))}
                    
                    {/* Show more button when not searching and there are more employees */}
                    {!employeeSearchTerm.trim() && !showAllEmployees && filteredEmployees.length > 20 && (
                      <button
                        onClick={() => setShowAllEmployees(true)}
                        className="w-full text-left px-3 py-2 text-sm text-green-700 hover:bg-green-50 focus:bg-green-50 focus:outline-none border-t border-slate-200"
                      >
                        Show all {filteredEmployees.length} employees...
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
        </div>
        </div>
        <div className="flex items-end gap-2">
          {/* 12-Month Window Navigation */}
          <div className="flex items-center gap-2 px-4 py-1 bg-white border border-slate-300 rounded-lg">
            <button
              onClick={() => navigateWindow(-1)}
              className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
              type="button"
              title="Previous month"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/>
              </svg>
            </button>
            <span className="text-sm font-medium text-slate-700 min-w-[200px] text-center">
              {formatMonthDisplay(windowStartMonth.year, windowStartMonth.month)} - {formatMonthDisplay(windowEndMonth.year, windowEndMonth.month)}
            </span>
            <button
              onClick={() => navigateWindow(1)}
              className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
              type="button"
              title="Next month"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
              </svg>
            </button>
          </div>
          <button
            onClick={loadHistory}
            disabled={!selectedEmployeeId || loading}
            className={`px-4 py-2 text-sm rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${
              historyData 
                ? 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50' 
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {loading ? (
              <>
                <div className={`animate-spin rounded-full h-4 w-4 border-b-2 ${historyData ? 'border-slate-600' : 'border-white'}`}></div>
                Loading...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
                Load History
              </>
            )}
          </button>
          {historyData && (
            <button
              onClick={exportToCSV}
              disabled={exporting}
              className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {exporting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Exporting...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                  Export CSV
                </>
              )}
            </button>
          )}
        </div>
      </div>
      
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 flex items-center justify-between gap-4">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="flex-shrink-0 text-red-600 hover:text-red-800 focus:outline-none"
            type="button"
            aria-label="Close error message"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      )}
      
      {loading && (
        <div className="text-center py-12">
          <div className="flex items-center justify-center gap-3">
            <div className="w-4 h-4 border-2 border-green-200 border-t-green-700 rounded-full animate-spin"></div>
            <p className="text-slate-600 text-sm">Loading history...</p>
          </div>
        </div>
      )}
      
      {historyData && !loading && (
        <div className="overflow-x-auto border border-slate-300 rounded-lg">
          <table className="w-full border-collapse min-w-[1200px]">
            <thead>
              <tr className="bg-green-600 text-white">
                <th className="text-left p-3 text-xs font-semibold uppercase sticky left-0 bg-green-600 z-10 min-w-[280px] border-r border-green-700">
                  Criteria
                </th>
                {historyData.history.map((period, idx) => {
                  const isCurrent = idx === 0
                  return (
                    <th
                      key={`${period.period_year}-${period.period_month}`}
                      className={`p-3 text-xs font-semibold uppercase text-center border-r border-green-700 ${
                        isCurrent ? 'bg-green-800' : ''
                      }`}
                    >
                      {formatMonthYear(period.period_month, period.period_year)}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {/* Role Effectiveness */}
              <tr className="bg-slate-100">
                <td colSpan={13} className="p-3 text-xs font-semibold uppercase text-slate-600 border-b border-slate-300">
                  Role Effectiveness (20% Weight)
                </td>
              </tr>
              {getCategoryCriteria('Role Effectiveness').map(crit => (
                <tr key={crit.name} className="border-b border-slate-200 hover:bg-slate-50">
                  <td className="p-3 sticky left-0 bg-white z-10 border-r border-slate-200">
                    <div className="font-medium text-sm">{crit.name}</div>
                  </td>
                  {historyData.history.map(period => {
                    const score = getScoreForPeriod(period, crit.name)
                    return (
                      <td key={`${period.period_year}-${period.period_month}`} className="p-3 text-center border-r border-slate-200">
                        <span className={getScoreColor(score)}>
                          {score !== null ? score : '—'}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              ))}
              <tr className="bg-green-50 border-b-2 border-green-200">
                <td className="p-3 text-right font-semibold sticky left-0 bg-green-50 z-10 border-r border-green-200">
                  Section Average →
                </td>
                {historyData.history.map(period => {
                  const avg = getSectionAverage(period, 'Role Effectiveness')
                  return (
                    <td key={`${period.period_year}-${period.period_month}`} className="p-3 text-center font-semibold text-green-700 border-r border-green-200">
                      {avg !== null ? avg : '—'}
                    </td>
                  )
                })}
              </tr>
              
              {/* Core Values & Work Ethic */}
              <tr className="bg-slate-100">
                <td colSpan={13} className="p-3 text-xs font-semibold uppercase text-slate-600 border-b border-slate-300">
                  Core Values & Work Ethic (35% Weight)
                </td>
              </tr>
              {getCategoryCriteria('Core Values & Work Ethic').map(crit => (
                <tr key={crit.name} className="border-b border-slate-200 hover:bg-slate-50">
                  <td className="p-3 sticky left-0 bg-white z-10 border-r border-slate-200">
                    <div className="font-medium text-sm">{crit.name}</div>
                  </td>
                  {historyData.history.map(period => {
                    const score = getScoreForPeriod(period, crit.name)
                    return (
                      <td key={`${period.period_year}-${period.period_month}`} className="p-3 text-center border-r border-slate-200">
                        <span className={getScoreColor(score)}>
                          {score !== null ? score : '—'}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              ))}
              <tr className="bg-green-50 border-b-2 border-green-200">
                <td className="p-3 text-right font-semibold sticky left-0 bg-green-50 z-10 border-r border-green-200">
                  Section Average →
                </td>
                {historyData.history.map(period => {
                  const avg = getSectionAverage(period, 'Core Values & Work Ethic')
                  return (
                    <td key={`${period.period_year}-${period.period_month}`} className="p-3 text-center font-semibold text-green-700 border-r border-green-200">
                      {avg !== null ? avg : '—'}
                    </td>
                  )
                })}
              </tr>
              
              {/* SquareShift DNA */}
              <tr className="bg-slate-100">
                <td colSpan={13} className="p-3 text-xs font-semibold uppercase text-slate-600 border-b border-slate-300">
                  SquareShift DNA (30% Weight)
                </td>
              </tr>
              {getCategoryCriteria('SquareShift DNA').map(crit => (
                <tr key={crit.name} className="border-b border-slate-200 hover:bg-slate-50">
                  <td className="p-3 sticky left-0 bg-white z-10 border-r border-slate-200">
                    <div className="font-medium text-sm">{crit.name}</div>
                  </td>
                  {historyData.history.map(period => {
                    const score = getScoreForPeriod(period, crit.name)
                    return (
                      <td key={`${period.period_year}-${period.period_month}`} className="p-3 text-center border-r border-slate-200">
                        <span className={getScoreColor(score)}>
                          {score !== null ? score : '—'}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              ))}
              <tr className="bg-green-50 border-b-2 border-green-200">
                <td className="p-3 text-right font-semibold sticky left-0 bg-green-50 z-10 border-r border-green-200">
                  Section Average →
                </td>
                {historyData.history.map(period => {
                  const avg = getSectionAverage(period, 'SquareShift DNA')
                  return (
                    <td key={`${period.period_year}-${period.period_month}`} className="p-3 text-center font-semibold text-green-700 border-r border-green-200">
                      {avg !== null ? avg : '—'}
                    </td>
                  )
                })}
              </tr>
              
              {/* Growth & Leadership */}
              <tr className="bg-slate-100">
                <td colSpan={13} className="p-3 text-xs font-semibold uppercase text-slate-600 border-b border-slate-300">
                  Growth & Leadership (15% Weight)
                </td>
              </tr>
              {getCategoryCriteria('Growth & Leadership').map(crit => (
                <tr key={crit.name} className="border-b border-slate-200 hover:bg-slate-50">
                  <td className="p-3 sticky left-0 bg-white z-10 border-r border-slate-200">
                    <div className="font-medium text-sm">{crit.name}</div>
                  </td>
                  {historyData.history.map(period => {
                    const score = getScoreForPeriod(period, crit.name)
                    return (
                      <td key={`${period.period_year}-${period.period_month}`} className="p-3 text-center border-r border-slate-200">
                        <span className={getScoreColor(score)}>
                          {score !== null ? score : '—'}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              ))}
              <tr className="bg-green-50 border-b-2 border-green-200">
                <td className="p-3 text-right font-semibold sticky left-0 bg-green-50 z-10 border-r border-green-200">
                  Section Average →
                </td>
                {historyData.history.map(period => {
                  const avg = getSectionAverage(period, 'Growth & Leadership')
                  return (
                    <td key={`${period.period_year}-${period.period_month}`} className="p-3 text-center font-semibold text-green-700 border-r border-green-200">
                      {avg !== null ? avg : '—'}
                    </td>
                  )
                })}
              </tr>
              
              {/* Overall Score */}
              <tr className="bg-green-600 text-white">
                <td className="p-3 text-right font-bold sticky left-0 bg-green-600 z-10 border-r border-green-700">
                  OVERALL WEIGHTED SCORE →
                </td>
                {historyData.history.map(period => {
                  const overall = getOverallScore(period)
                  return (
                    <td key={`${period.period_year}-${period.period_month}`} className="p-3 text-center font-bold border-r border-green-700">
                      {overall !== null ? overall : '—'}
                    </td>
                  )
                })}
              </tr>
              
              {/* Talent Segment */}
              <tr className="border-b-2 border-slate-300">
                <td className="p-3 text-right font-semibold sticky left-0 bg-white z-10 border-r border-slate-200">
                  Talent Segment →
                </td>
                {historyData.history.map(period => {
                  const segment = period.evaluation?.talent_segment
                  return (
                    <td key={`${period.period_year}-${period.period_month}`} className="p-3 text-center border-r border-slate-200">
                      {segment ? (
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${getTalentBadgeClass(segment)}`}>
                          {segment}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  )
                })}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default ViewTab

