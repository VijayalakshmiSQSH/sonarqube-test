import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import apiClient from '../../../../utils/auth.js'
import { useEmployees } from '../../../../context/EmployeeContext.jsx'
import { usePermissions } from '../../../../context/PermissionContext.jsx'
import { useAuth } from '../../../../context/AuthContext.jsx'
import { getCookie } from '../../../../utils/helpers.js'
import { TOKEN, getApiBaseUrl } from '../../../../utils/constants.js'

const CRITERIA_DEFINITIONS = [
  { name: 'Domain Mastery', category: 'Role Effectiveness', description: 'How skilled is this employee in their chosen area of work?' },
  { name: 'Execution Quality', category: 'Role Effectiveness', description: 'How effective at delivering results in their role?' },
  { name: 'Hustle & Grit', category: 'Core Values & Work Ethic', description: 'Works hard, stretches, goes extra mile' },
  { name: 'Learning Velocity', category: 'Core Values & Work Ethic', description: 'Picks up new skills/domains/tools quickly' },
  { name: 'Organized Execution', category: 'Core Values & Work Ethic', description: 'Structured, methodical, consistent' },
  { name: 'Professional Maturity', category: 'Core Values & Work Ethic', description: 'Reliable, accountable, follows through' },
  { name: 'Team Amplifier', category: 'Core Values & Work Ethic', description: 'Collaborates, helps others, shares knowledge' },
  { name: 'Resourcefulness', category: 'SquareShift DNA', description: 'Figures it out without complaining about lack of resources' },
  { name: 'Chaos Navigation', category: 'SquareShift DNA', description: 'Handles multiple priorities and context switches smoothly' },
  { name: 'Solution Builder', category: 'SquareShift DNA', description: 'Brings options and recommendations, not just problems' },
  { name: 'Speed with Judgment', category: 'SquareShift DNA', description: '70% decision today over 100% decision next month' },
  { name: 'Direct Communication', category: 'SquareShift DNA', description: 'Thick skin, strong voice, escalates early and often' },
  { name: 'Mentorship', category: 'Growth & Leadership', description: 'Develops others, teaches actively' },
  { name: 'Initiative Taking', category: 'Growth & Leadership', description: 'Spots and solves problems proactively' },
  { name: 'Strategic Thinking', category: 'Growth & Leadership', description: 'Sees bigger picture beyond immediate task' },
  { name: 'Influence', category: 'Growth & Leadership', description: 'Drives outcomes through/with others' },
  { name: 'Building for Scale', category: 'Growth & Leadership', description: 'Creates systems, not just solutions' },
]

const EvaluateTab = () => {
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
  const [selectedPeriod, setSelectedPeriod] = useState('')
  const [periodSearchTerm, setPeriodSearchTerm] = useState('')
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false)
  const [calendarView, setCalendarView] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() })
  const periodDropdownRef = useRef(null)
  const [criteriaScores, setCriteriaScores] = useState({})
  const [openRatingDropdowns, setOpenRatingDropdowns] = useState({})
  const ratingDropdownRefs = useRef({})
  const errorRef = useRef(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  
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
  
  // Generate list of periods (last 24 months)
  const availablePeriods = useMemo(() => {
    const periods = []
    const now = new Date()
    for (let i = 0; i < 24; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const year = date.getFullYear()
      const month = date.getMonth() + 1
      const monthStr = String(month).padStart(2, '0')
      const value = `${year}-${monthStr}`
      const monthName = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      periods.push({ value, label: monthName, year, month })
    }
    return periods
  }, [])

  // Filter periods based on search
  const filteredPeriods = useMemo(() => {
    if (!periodSearchTerm.trim()) {
      return availablePeriods
    }
    const searchLower = periodSearchTerm.toLowerCase()
    return availablePeriods.filter(period => 
      period.label.toLowerCase().includes(searchLower) ||
      period.value.includes(searchLower)
    )
  }, [availablePeriods, periodSearchTerm])

  // Generate calendar months for the current view year
  const calendarMonths = useMemo(() => {
    const months = []
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    for (let i = 0; i < 12; i++) {
      const month = i + 1
      const monthStr = String(month).padStart(2, '0')
      const value = `${calendarView.year}-${monthStr}`
      const isSelected = selectedPeriod === value
      const isCurrentMonth = calendarView.year === new Date().getFullYear() && month === new Date().getMonth() + 1
      months.push({ 
        value, 
        label: monthNames[i], 
        month, 
        year: calendarView.year,
        isSelected,
        isCurrentMonth
      })
    }
    return months
  }, [calendarView.year, selectedPeriod])

  // Navigate calendar year
  const navigateCalendarYear = (direction) => {
    setCalendarView(prev => ({
      ...prev,
      year: prev.year + direction
    }))
  }

  // Rating options
  const ratingOptions = [
    { value: '', label: 'Not Rated' },
    { value: '5', label: '5 - Exceptional' },
    { value: '4', label: '4 - Exceeds Expectations' },
    { value: '3', label: '3 - Meets Expectations' },
    { value: '2', label: '2 - Development Needed' },
    { value: '1', label: '1 - Critical Gap' }
  ]

  // Get rating label for display
  const getRatingLabel = (value) => {
    // Convert to string for comparison since ratingOptions use string values
    const stringValue = value !== null && value !== undefined ? String(value) : ''
    const option = ratingOptions.find(opt => opt.value === stringValue)
    return option ? option.label : 'Not Rated'
  }

  // Open rating dropdown
  const openRatingDropdown = (criterionName) => {
    setOpenRatingDropdowns(prev => ({
      ...prev,
      [criterionName]: true
    }))
  }

  // Toggle rating dropdown
  const toggleRatingDropdown = (criterionName) => {
    setOpenRatingDropdowns(prev => ({
      ...prev,
      [criterionName]: !prev[criterionName]
    }))
  }

  // Close rating dropdown
  const closeRatingDropdown = (criterionName) => {
    setOpenRatingDropdowns(prev => ({
      ...prev,
      [criterionName]: false
    }))
  }

  // Handle rating select
  const handleRatingSelect = (criterionName, value) => {
    handleScoreChange(criterionName, value)
    closeRatingDropdown(criterionName)
  }

  // Auto-scroll to error when it appears
  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [error])

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (employeeDropdownRef.current && !employeeDropdownRef.current.contains(event.target)) {
        setShowEmployeeDropdown(false)
      }
      if (periodDropdownRef.current && !periodDropdownRef.current.contains(event.target)) {
        setShowPeriodDropdown(false)
      }
      // Close rating dropdowns
      Object.keys(ratingDropdownRefs.current).forEach(criterionName => {
        const ref = ratingDropdownRefs.current[criterionName]
        if (ref && !ref.contains(event.target)) {
          closeRatingDropdown(criterionName)
        }
      })
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])
   
  // Set default period to current month and update period search term
  useEffect(() => {
    if (!selectedPeriod) {
      const now = new Date()
      const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      setSelectedPeriod(defaultPeriod)
      const period = availablePeriods.find(p => p.value === defaultPeriod)
      if (period) {
        setPeriodSearchTerm(period.label)
      }
    } else {
      // Update search term when period changes externally
      const period = availablePeriods.find(p => p.value === selectedPeriod)
      if (period) {
        setPeriodSearchTerm(period.label)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  
  // Update period search term when selectedPeriod changes
  useEffect(() => {
    const period = availablePeriods.find(p => p.value === selectedPeriod)
    if (period) {
      setPeriodSearchTerm(period.label)
    }
  }, [selectedPeriod, availablePeriods])

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
    setSelectedEmployee(null)
    setSelectedEmployeeId('')
    setEmployeeSearchTerm('')
    setShowEmployeeDropdown(false)
    setShowAllEmployees(false)
  }

  const handlePeriodSelect = (period) => {
    setSelectedPeriod(period.value)
    setPeriodSearchTerm(period.label)
    setShowPeriodDropdown(false)
    // Update calendar view to show the selected period's year
    if (period.year) {
      setCalendarView({ year: period.year, month: period.month - 1 })
    }
  }

  const handlePeriodInputClick = () => {
    // Open calendar when clicking input
    setShowPeriodDropdown(true)
  }

  const clearPeriodSelection = () => {
    const now = new Date()
    const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    setSelectedPeriod(defaultPeriod)
    const period = availablePeriods.find(p => p.value === defaultPeriod)
    if (period) {
      setPeriodSearchTerm(period.label)
    }
    setCalendarView({ year: now.getFullYear(), month: now.getMonth() })
    setShowPeriodDropdown(false)
  }

  // Update calendar view when selected period changes
  useEffect(() => {
    if (selectedPeriod) {
      const [year, month] = selectedPeriod.split('-')
      setCalendarView({ year: parseInt(year), month: parseInt(month) - 1 })
    }
  }, [selectedPeriod])
  
  // Fetch and load existing ratings when employee/period changes
  useEffect(() => {
    const fetchExistingRatings = async () => {
    if (!selectedEmployeeId || !selectedPeriod) {
      setCriteriaScores({})
        return
      }

      try {
        setLoading(true)
        const [year, month] = selectedPeriod.split('-')
        
        // Fetch evaluation history for the employee and period
        const response = await apiClient.get(
          `/api/culture/performance-evaluations/employee/${selectedEmployeeId}/history`,
          {
            params: {
              period_month: parseInt(month),
              period_year: parseInt(year)
            }
          }
        )

        if (response.data && response.data.history && response.data.history.length > 0) {
          // The first item in history is the selected period
          const currentPeriodData = response.data.history[0]
          
          if (currentPeriodData.evaluation && currentPeriodData.criteria && currentPeriodData.criteria.length > 0) {
            // Convert criteria array to criteriaScores object format
            const scores = {}
            currentPeriodData.criteria.forEach(criterion => {
              if (criterion.score !== null && criterion.score !== undefined) {
                scores[criterion.criterion_name] = criterion.score
              }
            })
            setCriteriaScores(scores)
          } else {
            // No existing evaluation, clear scores
            setCriteriaScores({})
          }
        } else {
          // No history data, clear scores
          setCriteriaScores({})
        }
      } catch (err) {
        console.error('Error fetching existing ratings:', err)
        // If error (e.g., 404), clear scores - no existing evaluation
        setCriteriaScores({})
      } finally {
        setLoading(false)
      }
    }

    fetchExistingRatings()
  }, [selectedEmployeeId, selectedPeriod])
  
  const handleScoreChange = (criterionName, score) => {
    const newScores = { ...criteriaScores }
    if (score === '' || score === null) {
      delete newScores[criterionName]
    } else {
      newScores[criterionName] = parseInt(score)
    }
    setCriteriaScores(newScores)
  }
  
  // Calculate section averages
  const sectionAverages = useMemo(() => {
    const categories = ['Role Effectiveness', 'Core Values & Work Ethic', 'SquareShift DNA', 'Growth & Leadership']
    const averages = {}
    
    categories.forEach(category => {
      const categoryCriteria = CRITERIA_DEFINITIONS.filter(c => c.category === category)
      const scores = categoryCriteria
        .map(c => criteriaScores[c.name])
        .filter(s => s !== undefined && s !== null)
      
      if (scores.length > 0) {
        averages[category] = scores.reduce((a, b) => a + b, 0) / scores.length
      } else {
        averages[category] = null
      }
    })
    
    return averages
  }, [criteriaScores])
  
  // Calculate overall score
  const overallScore = useMemo(() => {
    const role = sectionAverages['Role Effectiveness']
    const values = sectionAverages['Core Values & Work Ethic']
    const dna = sectionAverages['SquareShift DNA']
    const leadership = sectionAverages['Growth & Leadership']
    
    if (role === null || values === null || dna === null || leadership === null) {
      return null
    }
    
    return (role * 0.20) + (values * 0.35) + (dna * 0.30) + (leadership * 0.15)
  }, [sectionAverages])
  
  // Determine talent segment
  const talentSegment = useMemo(() => {
    if (overallScore === null) return null
    if (overallScore >= 4.5) return 'Star'
    if (overallScore >= 3.8) return 'High Potential'
    if (overallScore >= 3.0) return 'Core'
    return 'Development Zone'
  }, [overallScore])
  
  const getTalentBadgeClass = (segment) => {
    switch (segment) {
      case 'Star': return 'bg-yellow-100 text-yellow-800'
      case 'High Potential': return 'bg-blue-100 text-blue-800'
      case 'Core': return 'bg-green-100 text-green-800'
      case 'Development Zone': return 'bg-red-100 text-red-800'
      default: return 'bg-slate-100 text-slate-800'
    }
  }
  
  const getScoreColor = (score) => {
    if (score === null || score === undefined) return 'text-slate-400'
    if (score >= 4) return 'text-green-600'
    if (score >= 3) return 'text-yellow-600'
    if (score >= 2) return 'text-orange-600'
    return 'text-red-600'
  }
  
  const handleSave = async () => {
    if (!selectedEmployeeId || !selectedPeriod) {
      setError('Please select both employee and period')
      return
    }
    
    // Validate all 17 criteria are rated
    const unratedCriteria = CRITERIA_DEFINITIONS.filter(c => 
      criteriaScores[c.name] === undefined || criteriaScores[c.name] === null
    )
    if (unratedCriteria.length > 0) {
      const criteriaNames = unratedCriteria.map(c => c.name).join(', ')
      setError(`Please rate all 17 criteria before saving. Missing: ${criteriaNames}`)
      return
    }
    
    setSaving(true)
    setError(null)
    setSuccess(null)
    
    try {
      const [year, month] = selectedPeriod.split('-')
      
      // Ensure all scores are integers (not strings) and all 17 criteria are included
      const formattedCriteriaScores = {}
      CRITERIA_DEFINITIONS.forEach(criterion => {
        const score = criteriaScores[criterion.name]
        if (score !== undefined && score !== null) {
          const intScore = parseInt(score)
          if (isNaN(intScore) || intScore < 1 || intScore > 5) {
            throw new Error(`Invalid score for ${criterion.name}: ${score}`)
          }
          formattedCriteriaScores[criterion.name] = intScore
        } else {
          // This shouldn't happen due to validation, but throw error if it does
          throw new Error(`Missing score for ${criterion.name}`)
        }
      })
      
      // Verify we have all 17 criteria
      if (Object.keys(formattedCriteriaScores).length !== 17) {
        setError(`Invalid criteria count. Expected 17, got ${Object.keys(formattedCriteriaScores).length}`)
        setSaving(false)
        return
      }
      
      const response = await apiClient.post('/api/culture/performance-evaluations', {
        employee_id: parseInt(selectedEmployeeId),
        period_month: parseInt(month),
        period_year: parseInt(year),
        criteria_scores: formattedCriteriaScores
      })
      
      // Update criteriaScores from response to ensure consistency
      if (response.data && response.data.criteria && response.data.criteria.length > 0) {
        const savedScores = {}
        response.data.criteria.forEach(criterion => {
          if (criterion.score !== null && criterion.score !== undefined) {
            savedScores[criterion.criterion_name] = criterion.score
          }
        })
        setCriteriaScores(savedScores)
      }
      
      setSuccess('Evaluation saved successfully!')
      
      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(null), 5000)
    } catch (err) {
      console.error('Error saving evaluation:', err)
      console.error('Error response:', err.response?.data)
      const errorMessage = err.response?.data?.error || err.response?.data?.details || err.message || 'Failed to save evaluation'
      setError(errorMessage)
      // Auto-scroll to error
      setTimeout(() => {
        errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    } finally {
      setSaving(false)
    }
  }
  
  const handleReset = () => {
    if (window.confirm('Are you sure you want to reset all ratings? This cannot be undone.')) {
      setCriteriaScores({})
      setError(null)
      setSuccess(null)
    }
  }
  
  const getCategoryCriteria = (category) => {
    return CRITERIA_DEFINITIONS.filter(c => c.category === category)
  }
  
  const renderCategorySection = (category, weight, icon) => {
    const criteria = getCategoryCriteria(category)
    const average = sectionAverages[category]
    
    return (
      <div className="border border-slate-300 rounded-lg mb-6">
        <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 flex-shrink-0">
              {icon}
            </div>
            <h3 className="text-sm font-semibold uppercase">{category}</h3>
          </div>
          <span className="bg-white/20 px-3 py-1 rounded text-xs font-semibold">{weight * 100}% Weight</span>
        </div>
        
        <div className="divide-y divide-slate-200">
          {criteria.map(criterion => {
            const score = criteriaScores[criterion.name]
            const isOpen = openRatingDropdowns[criterion.name] || false
            const ratingLabel = getRatingLabel(score)
            const isEmployeeSelected = !!selectedEmployeeId
            
            return (
              <div key={criterion.name} className="p-4 flex items-center gap-4">
                <div className="flex-1">
                  <h4 className="font-semibold text-sm text-slate-900 mb-1">{criterion.name}</h4>
                  <p className="text-xs text-slate-600">{criterion.description}</p>
                </div>
                <div 
                  className="relative min-w-[200px]" 
                  ref={(el) => {
                    if (el) {
                      ratingDropdownRefs.current[criterion.name] = el
                    }
                  }}
                >
                  <div className="relative">
                    <input
                      type="text"
                      value={isEmployeeSelected ? ratingLabel : ''}
                      readOnly
                      onClick={(e) => {
                        e.stopPropagation()
                        if (!isEmployeeSelected) {
                          openRatingDropdown(criterion.name)
                        } else if (!isOpen) {
                          openRatingDropdown(criterion.name)
                        }
                      }}
                      placeholder={isEmployeeSelected ? "Select rating..." : "Select an employee first"}
                      className={`block w-full px-3 py-1.5 pr-8 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 ${
                        isEmployeeSelected 
                          ? 'cursor-pointer bg-white' 
                          : 'cursor-not-allowed bg-slate-50 text-slate-400'
                      }`}
                    />
                    {score && isEmployeeSelected && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleScoreChange(criterion.name, '')
                          closeRatingDropdown(criterion.name)
                        }}
                        className="absolute inset-y-0 right-6 flex items-center text-slate-400 hover:text-slate-600"
                        type="button"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (isEmployeeSelected) {
                          toggleRatingDropdown(criterion.name)
                        } else {
                          openRatingDropdown(criterion.name)
                        }
                      }}
                      className={`absolute inset-y-0 right-0 flex items-center focus:outline-none ${
                        isEmployeeSelected 
                          ? 'text-slate-400 hover:text-slate-600' 
                          : 'text-slate-300 cursor-not-allowed'
                      }`}
                      style={{ paddingRight: '6px' }}
                      disabled={!isEmployeeSelected}
                    >
                      <svg className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
                      </svg>
                    </button>
                  </div>
                  
                  {/* Dropdown */}
                  {isOpen && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-slate-300 rounded-md shadow-lg max-h-60 overflow-auto">
                      {!isEmployeeSelected ? (
                        <div className="px-3 py-4 text-sm text-slate-500 text-center">
                          Please select an employee to rate them
                        </div>
                      ) : (
                        ratingOptions.map(option => (
                          <button
                            key={option.value}
                            onClick={() => handleRatingSelect(criterion.name, option.value)}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 focus:bg-slate-50 focus:outline-none ${
                              score === option.value ? 'bg-green-50 text-green-700' : ''
                            }`}
                          >
                            <div className="font-medium">{option.label}</div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
                <div className={`text-2xl font-bold min-w-[50px] text-center ${getScoreColor(score)}`}>
                  {score || '—'}
                </div>
              </div>
            )
          })}
        </div>
        
        <div className="bg-slate-50 px-4 py-3 flex justify-end items-center gap-3 border-t border-slate-200 rounded-b-lg">
          <span className="text-sm text-slate-600">Section Average:</span>
          <span className="text-xl font-bold text-green-700">
            {average !== null ? average.toFixed(2) : '—'}
          </span>
        </div>
      </div>
    )
  }
  
  return (
    <div>
      <div className="flex gap-4 mb-6">
        <div className="flex-1">
          <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">
            Select Employee to Evaluate
          </label>
          <div className="relative" ref={employeeDropdownRef}>
            <div className="relative">
                <input
                  type="text"
                  value={employeeSearchTerm}
                  onChange={(e) => handleEmployeeSearchChange(e.target.value)}
                  onFocus={() => setShowEmployeeDropdown(true)}
                  placeholder="Search employees..."
                  className="block w-full px-3 py-1.5 pr-8 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500"
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
        <div className="flex-1">
          <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">
            Evaluation Period
          </label>
          <div className="relative" ref={periodDropdownRef}>
            <div className="relative">
          <input
                type="text"
                value={periodSearchTerm}
                readOnly
                onClick={handlePeriodInputClick}
                onFocus={() => setShowPeriodDropdown(true)}
                placeholder="Select period..."
                className="block w-full px-3 py-1.5 pr-8 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 cursor-pointer bg-white"
              />
              {periodSearchTerm && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    clearPeriodSelection()
                  }}
                  className="absolute inset-y-0 right-6 flex items-center text-slate-400 hover:text-slate-600"
                  type="button"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowPeriodDropdown(!showPeriodDropdown)
                }}
                className="absolute inset-y-0 right-0 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                style={{ paddingRight: '6px' }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                </svg>
              </button>
            </div>
            
            {/* Calendar Dropdown */}
            {showPeriodDropdown && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded-md shadow-lg">
                <div className="p-3">
                  {/* Year Navigation */}
                  <div className="flex items-center justify-between mb-3">
                    <button
                      onClick={() => navigateCalendarYear(-1)}
                      className="p-1 hover:bg-slate-100 rounded transition-colors"
                      type="button"
                    >
                      <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/>
                      </svg>
                    </button>
                    <div className="font-semibold text-sm text-slate-900">{calendarView.year}</div>
                    <button
                      onClick={() => navigateCalendarYear(1)}
                      className="p-1 hover:bg-slate-100 rounded transition-colors"
                      type="button"
                    >
                      <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
                      </svg>
                    </button>
                  </div>
                  
                  {/* Month Grid */}
                  <div className="grid grid-cols-3 gap-2">
                    {calendarMonths.map(month => (
                      <button
                        key={month.value}
                        onClick={() => handlePeriodSelect(month)}
                        className={`px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                          month.isSelected
                            ? 'bg-green-600 text-white'
                            : month.isCurrentMonth
                            ? 'bg-green-50 text-green-700 border border-green-200'
                            : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {month.label.substring(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {error && (
        <div 
          ref={errorRef}
          className="fixed top-4 right-4 z-[9999] bg-white border-2 border-red-300 text-red-700 px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 max-w-md"
        >
          <svg className="w-5 h-5 flex-shrink-0 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <span className="text-sm font-medium flex-1">{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-500 hover:text-red-700 flex-shrink-0"
            type="button"
            aria-label="Close error"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      )}
      
      {success && (
        <div className="fixed top-4 right-4 z-[9999] bg-white border-2 border-green-300 text-green-700 px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 max-w-md">
          <svg className="w-5 h-5 flex-shrink-0 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <span className="text-sm font-medium flex-1">{success}</span>
          <button
            onClick={() => setSuccess(null)}
            className="text-green-500 hover:text-green-700 flex-shrink-0"
            type="button"
            aria-label="Close notification"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      )}
      
      {loading && (
        <div className="text-center py-12">
          <div className="flex items-center justify-center gap-3">
            <div className="w-4 h-4 border-2 border-green-200 border-t-green-700 rounded-full animate-spin"></div>
            <p className="text-slate-600 text-sm">Loading evaluation...</p>
          </div>
        </div>
      )}
      
      {!loading && (
        <>
          {renderCategorySection('Role Effectiveness', 0.20, (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
            </svg>
          ))}
          {renderCategorySection('Core Values & Work Ethic', 0.35, (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
          ))}
          {renderCategorySection('SquareShift DNA', 0.30, (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
            </svg>
          ))}
          {renderCategorySection('Growth & Leadership', 0.15, (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
            </svg>
          ))}
          
          {/* Summary Panel */}
          <div className="border-2 border-green-600 rounded-lg p-6 bg-green-50 mb-6">
            <h3 className="text-sm font-semibold uppercase text-green-800 mb-4">Evaluation Summary</h3>
            <div className="grid grid-cols-5 gap-4">
              <div className="bg-green-600 text-white p-5 rounded-lg text-center">
                <div className="text-3xl font-bold mb-1">
                  {overallScore !== null ? overallScore.toFixed(2) : '—'}
                </div>
                <div className="text-xs uppercase mb-2">Overall Score</div>
                {talentSegment && (
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${getTalentBadgeClass(talentSegment)}`}>
                    {talentSegment}
                  </span>
                )}
              </div>
              <div className="bg-white p-5 rounded-lg text-center border border-slate-200">
                <div className="text-3xl font-bold text-green-600 mb-1">
                  {sectionAverages['Role Effectiveness'] !== null ? sectionAverages['Role Effectiveness'].toFixed(2) : '—'}
                </div>
                <div className="text-xs uppercase text-slate-600">Role (20%)</div>
              </div>
              <div className="bg-white p-5 rounded-lg text-center border border-slate-200">
                <div className="text-3xl font-bold text-green-600 mb-1">
                  {sectionAverages['Core Values & Work Ethic'] !== null ? sectionAverages['Core Values & Work Ethic'].toFixed(2) : '—'}
                </div>
                <div className="text-xs uppercase text-slate-600">Values (35%)</div>
              </div>
              <div className="bg-white p-5 rounded-lg text-center border border-slate-200">
                <div className="text-3xl font-bold text-green-600 mb-1">
                  {sectionAverages['SquareShift DNA'] !== null ? sectionAverages['SquareShift DNA'].toFixed(2) : '—'}
                </div>
                <div className="text-xs uppercase text-slate-600">DNA (30%)</div>
              </div>
              <div className="bg-white p-5 rounded-lg text-center border border-slate-200">
                <div className="text-3xl font-bold text-green-600 mb-1">
                  {sectionAverages['Growth & Leadership'] !== null ? sectionAverages['Growth & Leadership'].toFixed(2) : '—'}
                </div>
                <div className="text-xs uppercase text-slate-600">Leadership (15%)</div>
              </div>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving || !selectedEmployeeId || !selectedPeriod}
              className="px-4 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                  </svg>
                  Save Evaluation
                </>
              )}
            </button>
            <button
              onClick={handleReset}
              className="px-6 py-1.5 bg-white text-sm text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
              Reset Form
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default EvaluateTab

