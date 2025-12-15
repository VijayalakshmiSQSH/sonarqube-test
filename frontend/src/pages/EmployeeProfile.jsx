import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useEmployees } from '../context/EmployeeContext.jsx'
import { usePermissions } from '../context/PermissionContext.jsx'
import { getApiBaseUrl, TOKEN } from '../utils/constants.js'
import { getCookie } from '../utils/helpers.js'
import Header from '../components/Header.jsx'

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
        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-left flex items-center justify-between"
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
                className="w-full px-3 py-2 pl-8 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
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
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
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
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
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

const EmployeeProfile = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { getAllEmployees } = useEmployees()
  const { hasPermission } = usePermissions()
  
  // State management
  const [activeTab, setActiveTab] = useState('employee-info')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Employee data
  const [employee, setEmployee] = useState(null)
  const [projects, setProjects] = useState([])
  const [skills, setSkills] = useState([])
  const [certificates, setCertificates] = useState([])
  const [kraAssignments, setKraAssignments] = useState([])
  
  // KRA expansion state
  const [expandedKras, setExpandedKras] = useState(new Set())
  const [kraGoals, setKraGoals] = useState({}) // Store goals for each KRA
  const [loadingGoals, setLoadingGoals] = useState({})
  const [loadingAllKraGoals, setLoadingAllKraGoals] = useState(false) // Loading state for initial load
  
  // Goal popup state
  const [showGoalModal, setShowGoalModal] = useState(false)
  const [selectedGoal, setSelectedGoal] = useState(null)
  const [goalComments, setGoalComments] = useState([])
  const [loadingComments, setLoadingComments] = useState(false)
  
  // KRA filter state
  const [selectedYears, setSelectedYears] = useState([])
  const [selectedQuarters, setSelectedQuarters] = useState([])
  const [showFilters, setShowFilters] = useState(false)
  const [allGoals, setAllGoals] = useState([]) // Store all goals for year/quarter filtering
  const [selectedSimpleYear, setSelectedSimpleYear] = useState(new Date().getFullYear()) // Simple year filter (defaults to current year)
  
  // Tab switching
  const switchTab = (tabName) => {
    setActiveTab(tabName)
  }

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

  // Helper to get year from date
  const getYearFromDate = (dateString) => {
    if (!dateString) return null
    const date = new Date(dateString)
    return date.getFullYear()
  }

  // Helper to check if goal matches quarter filter (year is now handled at KRA level)
  const goalMatchesQuarterFilter = (goal) => {
    if (!goal.start_date) return false
    
    const goalQuarter = getQuarterFromDate(goal.start_date)
    
    // Check quarter filter
    if (selectedQuarters.length > 0 && !selectedQuarters.includes(goalQuarter)) {
      return false
    }
    
    return true
  }

  // Generate year options from KRA assignments (not goals)
  const getYearOptions = () => {
    const allYears = new Set()
    kraAssignments.forEach(assignment => {
      const year = assignment.kra?.year || assignment.year
      if (year) {
        // Handle both string and number years
        const yearNum = typeof year === 'string' ? parseInt(year) : year
        if (!isNaN(yearNum)) allYears.add(yearNum)
      }
    })
    return Array.from(allYears).sort((a, b) => b - a).map(year => ({
      value: year.toString(),
      label: year.toString()
    }))
  }

  // Get year from KRA assignment
  const getKraYear = (assignment) => {
    const year = assignment.kra?.year || assignment.year
    if (!year) return null
    // Handle both string and number years
    const yearNum = typeof year === 'string' ? parseInt(year) : year
    return isNaN(yearNum) ? null : yearNum
  }

  // Check if KRA matches year filter
  const kraMatchesYearFilter = (assignment) => {
    const kraYear = getKraYear(assignment)
    if (kraYear === null) return false
    
    // Check year filter - prioritize multi-select, then simple year filter
    if (selectedYears.length > 0) {
      // Multi-select year filter is active
      if (!selectedYears.includes(kraYear.toString())) {
        return false
      }
    } else if (selectedSimpleYear !== null) {
      // Simple year filter is active (only when multi-select is not active)
      if (kraYear !== selectedSimpleYear) {
        return false
      }
    }
    
    return true
  }

  // Get filtered KRAs with at least one goal (matching backend logic)
  const getFilteredKRAsWithGoals = () => {
    return kraAssignments.filter(assignment => {
      // First check if KRA matches year filter
      if (!kraMatchesYearFilter(assignment)) {
        return false
      }
      
      // Then check if it has at least one goal (after applying quarter filter)
      const kraId = assignment.kra_id
      const allGoals = kraGoals[kraId] || []
      // Filter goals based on quarter only (year is filtered at KRA level)
      const goals = allGoals.filter(goal => goalMatchesQuarterFilter(goal))
      
      // Only include KRAs that have at least one goal (matching the backend logic)
      return goals.length > 0
    })
  }

  // Navigate to previous year
  const handlePreviousYear = () => {
    setSelectedSimpleYear(prev => prev - 1)
  }

  // Navigate to next year
  const handleNextYear = () => {
    setSelectedSimpleYear(prev => prev + 1)
  }

  // Fetch all goals when KRA tab is active
  const fetchAllGoals = async () => {
    if (!id) return
    
    try {
      const token = getCookie(TOKEN)
      const baseUrl = getApiBaseUrl()
      
      // Fetch all goals for this employee
      const goalsResponse = await fetch(`${baseUrl}/api/goals?employee_id=${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (goalsResponse.ok) {
        const goalsData = await goalsResponse.json()
        // The API returns an array directly, not wrapped in an object
        setAllGoals(Array.isArray(goalsData) ? goalsData : [])
      }
    } catch (err) {
      console.error('Error fetching all goals:', err)
    }
  }

  // Fetch all goals when KRA tab becomes active
  useEffect(() => {
    if (activeTab === 'kra' && allGoals.length === 0 && id) {
      fetchAllGoals()
    }
  }, [activeTab, id])

  // Fetch all KRA goals when KRA tab becomes active
  useEffect(() => {
    if (activeTab === 'kra' && id && kraAssignments.length > 0) {
      fetchAllKraGoals()
    }
  }, [activeTab, id, kraAssignments.length])

  // Quarter options
  const quarterOptions = [
    { value: 'Q1', label: 'Q1 (January - March)' },
    { value: 'Q2', label: 'Q2 (April - June)' },
    { value: 'Q3', label: 'Q3 (July - September)' },
    { value: 'Q4', label: 'Q4 (October - December)' }
  ]

  // Fetch employee data
  const fetchEmployeeData = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const token = getCookie(TOKEN)
      const baseUrl = getApiBaseUrl()
      
      // Fetch employee details
      const employeeResponse = await fetch(`${baseUrl}/api/employees/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (!employeeResponse.ok) {
        throw new Error(`Failed to fetch employee: ${employeeResponse.status}`)
      }
      
      const employeeData = await employeeResponse.json()
      setEmployee(employeeData.employee || employeeData)
      
      // Fetch projects for this employee (using allocations to get project data)
      const allocationsResponse = await fetch(`${baseUrl}/api/allocations?employee_id=${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (allocationsResponse.ok) {
        const allocationsData = await allocationsResponse.json()
        // Extract unique projects from allocations
        const projectMap = new Map()
        if (allocationsData.allocations && Array.isArray(allocationsData.allocations)) {
          allocationsData.allocations.forEach(allocation => {
            if (allocation.project_id && !projectMap.has(allocation.project_id)) {
              projectMap.set(allocation.project_id, {
                id: allocation.project_id,
                name: allocation.project_name || 'Unknown Project',
                allocation_percentage: allocation.allocation_percentage,
                start_date: allocation.start_date,
                end_date: allocation.end_date,
                role: allocation.role,
                status: allocation.status
              })
            }
          })
        }
        setProjects(Array.from(projectMap.values()))
      }
      
      // Fetch employee skills
      const skillsResponse = await fetch(`${baseUrl}/api/employee-skills?employee_id=${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (skillsResponse.ok) {
        const skillsData = await skillsResponse.json()
        setSkills(skillsData.employee_skills || [])
      }
      
      // Fetch employee certificate assignments
      const certificatesResponse = await fetch(`${baseUrl}/api/certificates/employee-certificates`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (certificatesResponse.ok) {
        const certificatesData = await certificatesResponse.json()
        // Filter certificates for this specific employee
        const employeeCertificates = certificatesData.employee_certificates?.filter(
          cert => cert.emp_id == id
        ) || []
        setCertificates(employeeCertificates)
      }
      
      // Fetch KRA assignments
      const kraResponse = await fetch(`${baseUrl}/api/kra-assignments/employee/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (kraResponse.ok) {
        const kraData = await kraResponse.json()
        setKraAssignments(kraData.data?.assignments || [])
      }
      
    } catch (err) {
      console.error('Error fetching employee data:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (id) {
      fetchEmployeeData()
    }
  }, [id])

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
    if (status.toLowerCase() === 'in_progress') {
      return 'In progress'
    }
    return status
  }

  // Get skill level color helper
  const getSkillLevelColor = (level) => {
    switch (level?.toLowerCase()) {
      case 'expert':
        return 'bg-green-600'
      case 'advanced':
        return 'bg-green-700'
      case 'intermediate':
        return 'bg-yellow-600'
      case 'beginner':
        return 'bg-red-600'
      default:
        return 'bg-gray-600'
    }
  }

  // Get star count based on proficiency level
  const getStarCount = (level) => {
    switch (level?.toLowerCase()) {
      case 'beginner':
        return 2
      case 'intermediate':
        return 3
      case 'advanced':
        return 5
      case 'expert':
        return 6
      default:
        return 3
    }
  }

  // Render skill star rating (6 stars)
  const renderSkillStarRating = (stars) => {
    const totalStars = 6
    return (
      <div className="flex items-center gap-1">
        {Array.from({ length: totalStars }, (_, i) => (
          <svg
            key={i}
            className={`w-5 h-5 ${i < stars ? 'text-yellow-400 fill-current' : 'text-gray-300'}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
    )
  }

  // Fetch all goals for all KRAs
  const fetchAllKraGoals = async () => {
    if (loadingAllKraGoals || Object.keys(kraGoals).length > 0) return // Already loaded or loading
    
    setLoadingAllKraGoals(true)
    
    try {
      const token = getCookie(TOKEN)
      const baseUrl = getApiBaseUrl()
      
      // Fetch all goals for this employee
      const goalsResponse = await fetch(`${baseUrl}/api/goals?employee_id=${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (goalsResponse.ok) {
        const allGoalsData = await goalsResponse.json()
        // Group goals by KRA ID
        const goalsByKra = {}
        allGoalsData.forEach(goal => {
          const kraId = goal.kra_id
          if (!goalsByKra[kraId]) {
            goalsByKra[kraId] = []
          }
          goalsByKra[kraId].push(goal)
        })
        setKraGoals(goalsByKra)
      }
    } catch (err) {
      console.error('Error fetching all KRA goals:', err)
    } finally {
      setLoadingAllKraGoals(false)
    }
  }

  // Toggle KRA expansion
  const toggleKraExpansion = (kraId) => {
    const newExpandedKras = new Set(expandedKras)
    
    if (newExpandedKras.has(kraId)) {
      newExpandedKras.delete(kraId)
    } else {
      newExpandedKras.add(kraId)
    }
    
    setExpandedKras(newExpandedKras)
  }

  // Helper to render star rating
  const renderStarRating = (rating) => {
    const stars = []
    for (let i = 0; i < 5; i++) {
      const isFilled = i < rating
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
    return <div className="flex items-center gap-0.5">{stars}</div>
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

  // Get weight text for display, keeping any % if present
  const getGoalWeightDisplay = (goal) => {
    const keys = ['weight', 'weightage', 'weightage_percentage', 'weightage_percent', 'goal_weight']
    for (const key of keys) {
      const v = goal?.[key]
      if (v !== undefined && v !== null && String(v).trim() !== '') {
        const str = String(v).trim()
        // If already contains % or non-numeric chars, return as is
        if (/[^0-9.]/.test(str)) return str
        // Otherwise append % by convention
        return `${str}%`
      }
    }
    const n = getGoalWeight(goal)
    return n !== null ? `${n}%` : '-'
  }

  // Round to nearest 0.5
  const roundToHalf = (value) => Math.round(value * 2) / 2

  // Calculate average KRA rating for all filtered KRAs
  const calculateAverageKraRating = () => {
    // Get filtered KRAs based on year filter and having at least one goal
    const filteredKras = getFilteredKRAsWithGoals()
    
    if (filteredKras.length === 0) return null
    
    const ratings = []
    
    filteredKras.forEach(assignment => {
      const kraId = assignment.kra_id
      const allGoals = kraGoals[kraId] || []
      // Filter goals based on quarter only (year is filtered at KRA level)
      const goals = allGoals.filter(goal => goalMatchesQuarterFilter(goal))
      
      // Calculate weighted rating for this KRA
      const kraRating = calculateKraWeightedRating(kraId, goals)
      if (kraRating !== null) {
        ratings.push(kraRating)
      }
    })
    
    if (ratings.length === 0) return null
    
    // Calculate average
    const sum = ratings.reduce((acc, rating) => acc + rating, 0)
    return sum / ratings.length
  }

  // Calculate weighted average rating for a KRA (completed goals only)
  // Using Boosted Weighted Rating Formula: Σ(Rᵢ × Wᵢ) / 100
  // Where Rᵢ = Rating of each goal (out of 5), Wᵢ = Weight of each goal (in %)
  const calculateKraWeightedRating = (kraId, candidateGoals = null) => {
    const base = candidateGoals || kraGoals[kraId] || []
    const goalsForKra = base.filter(g =>
      (g?.status || '').toLowerCase() === 'completed' &&
      g?.rating !== undefined && g?.rating !== null &&
      !Number.isNaN(Number(g.rating))
    )

    if (goalsForKra.length === 0) return null

    let weightedSum = 0
    goalsForKra.forEach(goal => {
      let weight = getGoalWeight(goal)
      const rating = Number(goal.rating)
      
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

  // Render fractional star rating (supports halves) e.g., 3.5
  const renderFractionalStarRating = (rating) => {
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

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  }

  // Handle goal click
  const handleGoalClick = async (goal) => {
    setSelectedGoal(goal)
    setShowGoalModal(true)
    setLoadingComments(true)
    setGoalComments(goal.comments || [])
    setLoadingComments(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-700 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading employee profile...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">Error</div>
          <p className="text-slate-600 mb-4">{error}</p>
          <button 
            onClick={() => navigate('/workforce')}
            className="btn-primary"
          >
            Back to Workforce
          </button>
        </div>
      </div>
    )
  }

  if (!employee) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-slate-600 text-xl mb-4">Employee not found</div>
          <button 
            onClick={() => navigate('/workforce')}
            className="btn-primary"
          >
            Back to Workforce
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
        
        .scrollbar-thin {
          scrollbar-width: thin;
        }
        
        .scrollbar-thin::-webkit-scrollbar {
          width: 6px;
        }
        
        .scrollbar-thin::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 3px;
        }
        
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 3px;
        }
        
        .scrollbar-thin::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
      <Header />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Page Header */}
        <div className="mb-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-slate-900 mb-1">Employee Profile</h1>
              <p className="text-sm text-slate-600">Comprehensive view of employee information, projects, and performance</p>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => navigate('/workforce')}
                className="px-2.5 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
                </svg>
                Back to Directory
              </button>
              {hasPermission('workforce-employees-edit') && (
                <button 
                  onClick={() => navigate(`/employee/${id}/edit`)}
                  className="px-2.5 py-1.5 text-xs font-medium bg-green-800 text-white rounded-lg hover:bg-green-900 transition-colors flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                  </svg>
                  Edit Profile
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 mb-3">
          <div className="border-b border-slate-200">
            <nav className="flex space-x-6 px-4" aria-label="Tabs">
              <button 
                className={`tab-button ${activeTab === 'employee-info' ? 'active' : ''}`}
                onClick={() => switchTab('employee-info')}
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                </svg>
                Employee Info
              </button>
              <button 
                className={`tab-button ${activeTab === 'project-allocations' ? 'active' : ''}`}
                onClick={() => switchTab('project-allocations')}
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                </svg>
                Project Allocations
              </button>
              <button 
                className={`tab-button ${activeTab === 'skills' ? 'active' : ''}`}
                onClick={() => switchTab('skills')}
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                </svg>
                Skills
              </button>
              <button 
                className={`tab-button ${activeTab === 'certificates' ? 'active' : ''}`}
                onClick={() => switchTab('certificates')}
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/>
                </svg>
                Certificates
              </button>
              <button 
                className={`tab-button ${activeTab === 'kra' ? 'active' : ''}`}
                onClick={() => switchTab('kra')}
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                </svg>
                KRA
              </button>
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="tab-content">
          {/* Employee Info Tab */}
          {activeTab === 'employee-info' && (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 animate-fade-in">
              <div className="flex items-start gap-4">
                {/* Employee Avatar */}
                <div className="w-16 h-16 bg-green-800 rounded-xl flex items-center justify-center text-white text-xl font-bold">
                  {employee.first_name?.[0]}{employee.last_name?.[0]}
                </div>
                
                {/* Employee Details */}
                <div className="flex-1">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Basic Information */}
                    <div className="bg-slate-50 rounded-lg p-3">
                      <h3 className="text-base font-semibold text-slate-900 mb-2 flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                        </svg>
                        Basic Information
                      </h3>
                      <div className="space-y-2">
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Employee ID</label>
                          <p className="text-xs font-mono bg-slate-100 px-2 py-1 rounded-lg mt-0.5">{employee.employee_id || `EMP-${employee.id}`}</p>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Full Name</label>
                          <p className="text-xs font-semibold text-slate-900 mt-0.5">{employee.first_name} {employee.last_name}</p>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</label>
                          <p className="text-xs text-slate-700 mt-0.5">{employee.email}</p>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Phone</label>
                          <p className="text-xs text-slate-700 mt-0.5">{employee.mobile_number || 'N/A'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Job Information */}
                    <div className="bg-slate-50 rounded-lg p-3">
                      <h3 className="text-base font-semibold text-slate-900 mb-2 flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2V6"/>
                        </svg>
                        Job Information
                      </h3>
                      <div className="space-y-2">
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Position</label>
                          <p className="text-xs font-semibold text-slate-900 mt-0.5">{employee.designation || 'N/A'}</p>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Parent Department</label>
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 mt-0.5">
                            {employee.parent_department || 'N/A'}
                          </span>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Department</label>
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 mt-0.5">
                            {employee.department || 'N/A'}
                          </span>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Manager</label>
                          <p className="text-xs text-slate-700 mt-0.5">{employee.reporting_manager_name || 'N/A'}</p>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Location</label>
                          <p className="text-xs text-slate-700 mt-0.5">{employee.work_location_state || employee.city || 'N/A'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Employment Details */}
                    <div className="bg-slate-50 rounded-lg p-3">
                      <h3 className="text-base font-semibold text-slate-900 mb-2 flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                        </svg>
                        Employment Details
                      </h3>
                      <div className="space-y-2">
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Hire Date</label>
                          <p className="text-xs text-slate-700 mt-0.5">{formatDate(employee.date_of_joining)}</p>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Experience</label>
                          <p className="text-xs text-slate-700 mt-0.5">
                            {employee.total_experience ? 
                              `${employee.total_experience} years` : 
                              (employee.date_of_joining ? 
                                Math.floor((new Date() - new Date(employee.date_of_joining)) / (1000 * 60 * 60 * 24 * 365)) + ' years' : 
                                'N/A'
                              )
                            }
                          </p>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Employment Type</label>
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 mt-0.5">
                            {employee.employment_type || 'Full-time'}
                          </span>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</label>
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 mt-0.5">
                            {employee.employee_status || 'Active'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Project Allocations Tab */}
          {activeTab === 'project-allocations' && (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 animate-fade-in">
              <div className="p-3 border-b border-slate-200">
                <h2 className="text-base font-semibold text-slate-900 flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                  </svg>
                  Project Allocations
                </h2>
              </div>
              <div className="p-3">
                {projects.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-2 py-1.5 text-left font-semibold text-slate-700">Project Name</th>
                          <th className="px-2 py-1.5 text-left font-semibold text-slate-700">Client</th>
                          <th className="px-2 py-1.5 text-left font-semibold text-slate-700">Allocation %</th>
                          <th className="px-2 py-1.5 text-left font-semibold text-slate-700">Duration</th>
                          <th className="px-2 py-1.5 text-left font-semibold text-slate-700">Status</th>
                          <th className="px-2 py-1.5 text-left font-semibold text-slate-700">Start Date</th>
                          <th className="px-2 py-1.5 text-left font-semibold text-slate-700">End Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {projects.map((project) => (
                          <tr key={project.id} className="hover:bg-slate-50">
                            <td className="px-2 py-2">
                              <div className="font-semibold text-slate-900 text-xs">{project.name}</div>
                              <div className="text-xs text-slate-500">{project.type || 'Project'}</div>
                            </td>
                            <td className="px-2 py-2 text-xs text-slate-600">{project.customer_name || 'N/A'}</td>
                            <td className="px-2 py-2">
                              <div className="flex items-center gap-1.5">
                                <div className="w-12 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-green-800 transition-all duration-300" 
                                    style={{ width: `${project.allocation_percentage || 0}%` }}
                                  ></div>
                                </div>
                                <span className="text-xs font-medium text-slate-700">{project.allocation_percentage || 0}%</span>
                              </div>
                            </td>
                            <td className="px-2 py-2 text-xs text-slate-600">
                              {project.start_date && project.end_date ? 
                                Math.ceil((new Date(project.end_date) - new Date(project.start_date)) / (1000 * 60 * 60 * 24 * 30)) + ' months' : 
                                'N/A'
                              }
                            </td>
                            <td className="px-2 py-2">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(project.status)}`}>
                                {project.status || 'Active'}
                              </span>
                            </td>
                            <td className="px-2 py-2 text-xs text-slate-600">{formatDate(project.start_date)}</td>
                            <td className="px-2 py-2 text-xs text-slate-600">{formatDate(project.end_date)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <svg className="w-12 h-12 text-slate-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                    </svg>
                    <p className="text-slate-500">No project allocations found</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Skills Tab */}
          {activeTab === 'skills' && (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 animate-fade-in">
              <div className="p-3 border-b border-slate-200">
                <h2 className="text-base font-semibold text-slate-900 flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                  </svg>
                  Technical Skills
                </h2>
              </div>
              <div className="p-3">
                {skills.length > 0 ? (
                  <div className="space-y-3">
                    {/* Skills with star ratings */}
                    <div className="space-y-2">
                      {skills.map((skill, index) => {
                        const proficiencyLevel = skill.proficiency_level || 'Intermediate'
                        const starCount = getStarCount(proficiencyLevel)
                        return (
                          <div key={skill.id || skill.skill_id || `skill-${index}`} className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center justify-between p-1.5 bg-slate-50 rounded-lg hover:bg-slate-100 transition-all duration-200">
                                <span className="text-xs font-medium text-slate-700">{skill.skill?.skill_name || skill.skill_name}</span>
                                <div className="flex items-center" style={{ gap: '8px' }}>
                                <span className="text-xs text-slate-600"> {proficiencyLevel}</span>
                                {renderSkillStarRating(starCount)}
                                <span className="text-xs text-slate-500">({starCount}/6)</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Skill Tags */}
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 mb-2">All Skills</h3>
                      <div className="flex flex-wrap gap-1.5">
                        {skills.map((skill, index) => (
                          <span 
                            key={skill.id || skill.skill_id || `skill-tag-${index}`}
                            className="px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-xs font-semibold"
                          >
                            {skill.skill?.skill_name || skill.skill_name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <svg className="w-12 h-12 text-slate-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                    </svg>
                    <p className="text-slate-500">No skills found</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Certificates Tab */}
          {activeTab === 'certificates' && (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 animate-fade-in">
              <div className="p-3 border-b border-slate-200">
                <h2 className="text-base font-semibold text-slate-900 flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/>
                  </svg>
                  Certifications
                </h2>
              </div>
              <div className="p-3">
                {certificates.length > 0 ? (
                  <div className="space-y-2">
                    {certificates.map((certificate) => (
                      <div key={certificate.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                        <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                          <svg className="w-4 h-4 text-green-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/>
                          </svg>
                        </div>
                        <div className="flex-1">
                          <h4 className="text-xs font-semibold text-slate-900">{certificate.certificate?.certificate_name || 'Certificate'}</h4>
                          <p className="text-xs text-slate-600">{certificate.certificate?.issued_by || 'N/A'}</p>
                          <p className="text-xs text-slate-500">
                            Started: {formatDate(certificate.start_date)} • 
                            {certificate.expiry_date ? ` Expires: ${formatDate(certificate.expiry_date)}` : ' No Expiry'}
                          </p>
                        </div>
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${
                          certificate.status === 'Completed' ? 'bg-green-100 text-green-800' :
                          certificate.status === 'In-Progress' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {certificate.status === 'In-Progress' ? 'In Progress' : (certificate.status || 'Not Started')}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <svg className="w-12 h-12 text-slate-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/>
                    </svg>
                    <p className="text-slate-500">No certificates found</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* KRA Tab */}
          {activeTab === 'kra' && (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 animate-fade-in">
              <div className="p-3 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-slate-900 flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                      </svg>
                      Key Result Areas (KRA)
                    </h2>
                    {(() => {
                      const averageRating = calculateAverageKraRating()
                      if (averageRating === null) return null
                      const accurateRating = averageRating.toFixed(2)
                      return (
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg">
                          <span className="text-xs font-medium text-slate-600">Avg Rating:</span>
                          <div className="flex items-center gap-1">
                            {renderFractionalStarRating(averageRating)}
                          </div>
                          <span className="text-xs font-semibold text-slate-700">({accurateRating}/5)</span>
                        </div>
                      )
                    })()}
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Simple Year Navigation Filter */}
                    <div className={`inline-flex items-center gap-0.5 px-2 py-1 border rounded-lg transition-all duration-200 ${
                      selectedYears.length > 0
                        ? 'bg-slate-100 border-slate-300 text-slate-400 cursor-not-allowed'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}>
                      <button
                        onClick={handlePreviousYear}
                        disabled={selectedYears.length > 0}
                        className={`p-0.5 rounded transition-colors ${
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
                        className={`p-0.5 rounded transition-colors ${
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
                    <button
                      onClick={() => setShowFilters(!showFilters)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg transition-all duration-200 border ${
                        showFilters || selectedYears.length > 0 || selectedQuarters.length > 0
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
                <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 animate-fade-in">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-semibold text-slate-900">Filter Options</h3>
                    <button
                      onClick={() => setShowFilters(false)}
                      className="text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                      </svg>
                    </button>
                  </div>
                  <div className="p-2">
                <div className="flex flex-col md:flex-row gap-2">
                  {/* Year Multi-Select */}
                  <div className="flex-1">
                    <MultiSelect
                      label="Year"
                      options={getYearOptions()}
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
                </div>
                
                {/* Clear Filters Button */}
                <div className="mt-2 flex justify-end">
                  <button
                    onClick={() => {
                      setSelectedYears([])
                      setSelectedQuarters([])
                    }}
                    className="text-xs text-slate-600 hover:text-slate-800 transition-colors"
                  >
                    Clear all filters
                  </button>
                </div>
                </div>
              </div>
              )}
              <div className="p-3">
                {loadingAllKraGoals ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-800 mb-2"></div>
                    <p className="text-xs text-slate-600">Loading KRA goals...</p>
                  </div>
                ) : (() => {
                  const filteredKRAs = getFilteredKRAsWithGoals()
                  return filteredKRAs.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-2 py-1.5 text-left font-semibold text-slate-700">KRA</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {filteredKRAs.map((assignment) => {
                          const isExpanded = expandedKras.has(assignment.kra_id)
                          const kraId = assignment.kra_id
                          const allGoals = kraGoals[kraId] || []
                          // Filter goals based on quarter only (year is filtered at KRA level)
                          const goals = allGoals.filter(goal => goalMatchesQuarterFilter(goal))
                          const kraYear = getKraYear(assignment)
                          
                          return (
                            <React.Fragment key={assignment.id}>
                              <tr 
                                className="hover:bg-slate-50 cursor-pointer"
                                onClick={() => toggleKraExpansion(assignment.kra_id)}
                              >
                                <td className="px-2 py-2">
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        toggleKraExpansion(assignment.kra_id)
                                      }}
                                      className="text-slate-600 hover:text-slate-900 transition-all duration-200 flex items-center gap-1"
                                    >
                                      <svg 
                                        className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} 
                                        fill="none" 
                                        stroke="currentColor" 
                                        viewBox="0 0 24 24"
                                      >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
                                      </svg>
                                    </button>
                                    <div className="flex-1">
                                      <div>
                                        <span className="text-xs font-medium text-slate-900">
                                          {assignment.kra?.kra_name || assignment.kra_name}
                                        </span>
                                      </div>
                                      {assignment.kra?.description || assignment.description ? (
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                          <span className="text-xs text-slate-500">
                                            {assignment.kra?.description || assignment.description}
                                          </span>
                                          {kraYear && (
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
                                              {kraYear}
                                            </span>
                                          )}
                                        </div>
                                      ) : kraYear ? (
                                        <div className="mt-0.5">
                                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
                                            {kraYear}
                                          </span>
                                        </div>
                                      ) : null}
                                      <div className="flex items-center gap-1.5 mt-0.5">
                                        <span className="text-xs font-normal text-slate-500">
                                          ({goals.length} {goals.length === 1 ? 'goal' : 'goals'})
                                        </span>
                                        {(() => {
                                          const kraWeighted = calculateKraWeightedRating(kraId, goals)
                                          if (kraWeighted === null) {
                                            return null
                                          }
                                          // Format to 2 decimal places for accurate display
                                          const accurateRating = kraWeighted.toFixed(2)
                                          return (
                                            <div className="flex items-center gap-1">
                                              {renderFractionalStarRating(kraWeighted)}
                                              <span className="text-[10px] text-slate-600">({accurateRating}/5)</span>
                                            </div>
                                          )
                                        })()}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                              
                              {/* Expanded Goals Row */}
                              {isExpanded && (
                                <tr>
                                  <td colSpan={1} className="px-2 py-2 bg-slate-50">
                                    <div className="mt-1">
                                      <h4 className="text-xs font-semibold text-slate-700 mb-1.5">Goals</h4>
                                      {goals.length > 0 ? (
                                        <div className="overflow-x-auto">
                                          <table className="w-full text-xs">
                                            <thead className="bg-slate-100">
                                              <tr>
                                                <th className="px-2 py-1 text-left font-semibold text-slate-700">Goal Description</th>
                                                <th className="px-2 py-1 text-left font-semibold text-slate-700">Quarter</th>
                                                <th className="px-2 py-1 text-left font-semibold text-slate-700">Start Date</th>
                                                <th className="px-2 py-1 text-left font-semibold text-slate-700">End Date</th>
                                                <th className="px-2 py-1 text-left font-semibold text-slate-700">Status</th>
                                                <th className="px-2 py-1 text-left font-semibold text-slate-700">Weightage</th>
                                                <th className="px-2 py-1 text-left font-semibold text-slate-700">Rating</th>
                                                <th className="px-2 py-1 text-left font-semibold text-slate-700">Rated By</th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200 bg-white">
                                              {goals.map((goal) => {
                                                const quarter = getQuarterFromDate(goal.start_date)
                                                return (
                                                  <tr 
                                                    key={goal.id} 
                                                    className="hover:bg-slate-50 cursor-pointer"
                                                    onClick={() => handleGoalClick(goal)}
                                                  >
                                                    <td className="px-2 py-1.5">
                                                      <div className="flex items-center gap-1.5">
                                                        <svg className="w-3.5 h-3.5 text-green-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"/>
                                                        </svg>
                                                        <span className="text-xs text-slate-900">{goal.description}</span>
                                                      </div>
                                                    </td>
                                                    <td className="px-2 py-1.5">
                                                      {quarter && (
                                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
                                                          {quarter}
                                                        </span>
                                                      )}
                                                    </td>
                                                    <td className="px-2 py-1.5 text-xs text-slate-600">{goal.start_date ? formatDate(goal.start_date) : 'N/A'}</td>
                                                    <td className="px-2 py-1.5 text-xs text-slate-600">{goal.target_date ? formatDate(goal.target_date) : 'N/A'}</td>
                                                    <td className="px-2 py-1.5">
                                                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(goal.status)}`}>
                                                        {formatStatusDisplay(goal.status)}
                                                      </span>
                                                    </td>
                                                    <td className="px-2 py-1.5 text-xs text-slate-600">{getGoalWeightDisplay(goal)}</td>
                                                    <td className="px-2 py-1.5">
                                                      {goal.rating ? (
                                                        <div className="flex items-center gap-0.5">
                                                          {renderStarRating(goal.rating)}
                                                          <span className="text-xs text-slate-600 ml-0.5">({goal.rating}/5)</span>
                                                        </div>
                                                      ) : (
                                                        <span className="text-xs text-slate-400">Not rated</span>
                                                      )}
                                                    </td>
                                                    <td className="px-2 py-1.5 text-xs text-slate-600">
                                                      {goal.rating_given_by ? goal.rating_given_by : '-'}
                                                    </td>
                                                  </tr>
                                                )
                                              })}
                                            </tbody>
                                          </table>
                                        </div>
                                      ) : (
                                        <div className="text-center py-4 text-xs text-slate-500">
                                          <svg className="w-6 h-6 text-slate-400 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2z"/>
                                          </svg>
                                          <p>No goals found for this KRA</p>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  ) : (
                    <div className="text-center py-12">
                      <svg className="w-12 h-12 text-slate-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                      </svg>
                      <p className="text-slate-500">No KRA assignments found with goals</p>
                    </div>
                  )
                })()}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Goal Details Modal */}
      {showGoalModal && selectedGoal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" style={{marginTop: '0px'}}>
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 bg-green-600">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">GOAL DETAILS</h3>
                <button
                  onClick={() => setShowGoalModal(false)}
                  className="text-white hover:text-gray-200 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="px-6 py-4 space-y-6">
              {/* Description */}
              <div className="flex items-start gap-4">
                <label className="text-sm font-medium text-slate-700 w-24 mt-2">DESCRIPTION:</label>
                <textarea
                  value={selectedGoal.description || ''}
                  readOnly
                  rows="3"
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-md text-sm bg-slate-50 resize-none"
                />
              </div>
              
              {/* Rating Section */}
              {selectedGoal.rating && (
                <div className="flex items-start gap-4">
                  <label className="text-sm font-medium text-slate-700 w-24 mt-2">RATING:</label>
                  <div className="flex-1">
                    <div className="flex items-center gap-1 mb-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <svg
                          key={star}
                          className={`w-5 h-5 ${star <= selectedGoal.rating ? 'text-yellow-400' : 'text-gray-300'}`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                      <span className="ml-2 text-sm text-slate-600">
                        {selectedGoal.rating} star{selectedGoal.rating !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {selectedGoal.rating_given_by && (
                      <p className="text-xs text-slate-500 mt-1">
                        Rated by {selectedGoal.rating_given_by}
                      </p>
                    )}
                  </div>
                </div>
              )}
              
              {/* Comments Section */}
              <div className="flex items-start gap-4">
                <label className="text-sm font-medium text-slate-700 w-24 mt-2">COMMENTS:</label>
                <div className="flex-1">
                  {/* Comments Display */}
                  <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-3 bg-slate-50 mb-3">
                    {loadingComments ? (
                      <div className="flex items-center justify-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-700"></div>
                        <span className="ml-2 text-sm text-slate-600">Loading comments...</span>
                      </div>
                    ) : goalComments.length === 0 ? (
                      <p className="text-sm text-slate-500 text-center py-4">No comments yet</p>
                    ) : (
                      <div className="space-y-3">
                        {goalComments.map((comment, index) => (
                          <div key={comment.id || index} className="flex items-start gap-3">
                            <div className={`w-1 h-8 rounded-full ${
                              comment.comment_type === 'system' ? 'bg-green-500' : 'bg-orange-500'
                            }`}></div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-slate-900">
                                    {comment.comment_type === 'system' ? 'System' : comment.author}
                                  </span>
                                  <span className="text-xs text-slate-500">
                                    {formatTimestamp(comment.created_at)}
                                  </span>
                                </div>
                              </div>
                              <p className="text-sm text-slate-700">{comment.comment_text}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default EmployeeProfile
