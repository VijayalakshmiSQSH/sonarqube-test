import React, { useState, useEffect, memo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import LoadingSpinner from '../../components/LoadingSpinner.jsx'
import { getCookie } from '../../utils/helpers.js'
import { TOKEN, getApiBaseUrl } from '../../utils/constants.js'
import { usePermissions } from '../../context/PermissionContext.jsx'

// CSS for animations
const animationStyles = `
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
  
  /* Custom scrollbar styles for dropdowns */
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
  
  .scrollbar-thumb-gray-300::-webkit-scrollbar-thumb {
    background: #d1d5db;
  }
  
  .scrollbar-track-gray-100::-webkit-scrollbar-track {
    background: #f3f4f6;
  }
  
  .hover\\:scrollbar-thumb-gray-400:hover::-webkit-scrollbar-thumb {
    background: #9ca3af;
  }
`

// SearchableDropdown Component
const SearchableDropdown = ({ 
  options, 
  value, 
  onChange, 
  placeholder = "Search...", 
  className = "",
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filteredOptions, setFilteredOptions] = useState(options)
  const dropdownRef = useRef(null)
  const inputRef = useRef(null)

  // Filter options based on search term
  useEffect(() => {
    if (!Array.isArray(options)) {
      setFilteredOptions([])
      return
    }
    
    if (searchTerm.trim() === '') {
      setFilteredOptions(options)
    } else {
      const filtered = options.filter(option => {
        if (!option || typeof option !== 'object') return false
        const label = option.label || ''
        const value = option.value !== undefined ? String(option.value) : ''
        return label.toLowerCase().includes(searchTerm.toLowerCase()) ||
               value.toLowerCase().includes(searchTerm.toLowerCase())
      })
      setFilteredOptions(filtered)
    }
  }, [searchTerm, options])

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

  // Handle option selection
  const handleOptionSelect = (option) => {
    onChange(option.value)
    setIsOpen(false)
    setSearchTerm('')
  }

  // Handle clear selection
  const handleClearSelection = () => {
    onChange('')
    setSearchTerm('')
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }

  // Handle input focus
  const handleInputFocus = () => {
    setIsOpen(true)
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }

  // Handle input change
  const handleInputChange = (e) => {
    const newSearchTerm = e.target.value
    setSearchTerm(newSearchTerm)
    
    // If user is typing (searching), clear the current selection
    if (newSearchTerm.trim() !== '') {
      onChange('') // Clear the current selection when user starts typing
    }
    
    if (!isOpen) {
      setIsOpen(true)
    }
  }

  // Handle key down events for better UX
  const handleKeyDown = (e) => {
    if (e.key === 'Backspace' || e.key === 'Delete') {
      // If user presses backspace/delete and there's a selected value, clear it
      if (value && searchTerm === '') {
        onChange('')
        setSearchTerm('')
      }
    }
  }

  // Get display value
  const getDisplayValue = () => {
    // If user is actively searching, show the search term
    if (searchTerm !== '') {
      return searchTerm
    }
    
    // If there's a selected value and user is not searching, show the selected option
    if (value && Array.isArray(options)) {
      const selectedOption = options.find(option => option && option.value === value)
      return selectedOption ? selectedOption.label || '' : ''
    }
    
    return ''
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={getDisplayValue()}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleInputFocus}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
            disabled ? 'bg-slate-100 cursor-not-allowed' : ''
          }`}
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
          {/* Clear button - only show when there's a selected value */}
          {value && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleClearSelection()
              }}
              className="mr-2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
              title="Clear selection"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          )}
          
          {/* Dropdown arrow */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setIsOpen(!isOpen)
              if (!isOpen && inputRef.current) {
                inputRef.current.focus()
              }
            }}
            className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
            title={isOpen ? "Close dropdown" : "Open dropdown"}
            disabled={disabled}
          >
            <svg 
              className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-hidden">
          <div className="max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 hover:scrollbar-thumb-gray-400">
            {/* Clear option - only show when there's a selected value */}
            {value && (
              <button
                onClick={() => handleClearSelection()}
                className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 transition-colors text-slate-500 border-b border-slate-200"
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                  Clear selection
                </span>
              </button>
            )}
            
            {!Array.isArray(filteredOptions) || filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-slate-500">No options found</div>
            ) : (
              filteredOptions.map((option, index) => {
                if (!option || typeof option !== 'object') return null
                return (
                  <button
                    key={option.value || index}
                    onClick={() => handleOptionSelect(option)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-100 transition-colors ${
                      value === option.value ? 'bg-green-50 text-green-700' : 'text-slate-900'
                    }`}
                  >
                    {option.label || 'Unknown'}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const ProjectsTab = memo(({ 
  projects, 
  employees,
  customers,
  weeklyAllocations,
  loading, 
  error, 
  searchTerm, 
  statusFilter, 
  expandedProjects, 
  setExpandedProjects, 
  showFilters, 
  filters, 
  showCreateModal, 
  setShowCreateModal, 
  editingProject, 
  setEditingProject, 
  selectedProject, 
  setSelectedProject, 
  newProject, 
  setNewProject, 
  projectTeamMembers, 
  setProjectTeamMembers, 
  isAuthenticated,
  fetchProjects,
  updateProjects
}) => {
  const navigate = useNavigate()
  const { hasPermission } = usePermissions()
  // Local loading states for project operations
  const [creatingProject, setCreatingProject] = useState(false)
  const [updatingProject, setUpdatingProject] = useState(false)
  const [deletingProject, setDeletingProject] = useState(false)
  const [movingProject, setMovingProject] = useState(false)
  
  // State for managing active/archived tabs
  const [activeTab, setActiveTab] = useState('active') // 'active' or 'archive'
  
  // State for confirmation modal
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [confirmAction, setConfirmAction] = useState(null) // { type: 'archive'|'restore', project: projectObject }
  
  // State for completion confirmation modal
  const [showCompletionModal, setShowCompletionModal] = useState(false)
  const [completionProjectData, setCompletionProjectData] = useState(null)
  
  // State for context menu
  const [showContextMenu, setShowContextMenu] = useState(false)
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 })
  const [contextMenuProject, setContextMenuProject] = useState(null)
  
  // State for project manager search
  const [projectManagerSearchTerm, setProjectManagerSearchTerm] = useState(null)
  const [showProjectManagerDropdown, setShowProjectManagerDropdown] = useState(false)
  
  // State for file management in create modal
  const [createModalSelectedFile, setCreateModalSelectedFile] = useState(null)
  const createModalFileInputRef = useRef(null)
  
  // State for available practices
  const [availablePractices, setAvailablePractices] = useState([
    'Digital', 'Elastic', 'Data Engineering', 'ML', 'Agents', 
    'Looker', 'Infra', 'GenAI', 'Cloud'
  ])

  // Fetch available practices from backend
  const fetchAvailablePractices = async () => {
    const token = getCookie(TOKEN)
    if (!token) return

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/practices`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        const practiceNames = data.practices.map(practice => practice.name)
        setAvailablePractices(practiceNames)
      }
    } catch (error) {
      console.error('Error fetching practices:', error)
    }
  }

  // Add custom practice to backend
  const addCustomPractice = async (practiceName) => {
    const token = getCookie(TOKEN)
    if (!token) return false

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/practices`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: practiceName })
      })
      
      if (response.ok) {
        // Add to local state
        setAvailablePractices(prev => [...prev, practiceName])
        return true
      } else {
        const errorData = await response.json()
        console.error('Error adding practice:', errorData)
        return false
      }
    } catch (error) {
      console.error('Error adding practice:', error)
      return false
    }
  }
  // State for customer search
  const [customerSearchTerm, setCustomerSearchTerm] = useState('')
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)

  // Calculate average utilization for a project
  const calculateProjectAvgUtilization = (projectId) => {
    if (!employees || !weeklyAllocations || !Array.isArray(employees) || !Array.isArray(weeklyAllocations)) {
      return 0
    }

    // Get current week date range
    const today = new Date()
    const currentWeekStart = new Date(today)
    currentWeekStart.setDate(today.getDate() - today.getDay()) // Start of current week (Sunday)
    const currentWeekEnd = new Date(currentWeekStart)
    currentWeekEnd.setDate(currentWeekStart.getDate() + 6)

    // Check if allocation overlaps with current week
    const isAllocationInCurrentWeek = (allocation) => {
      if (!allocation.start_date || !allocation.end_date) return false
      
      const allocationStart = new Date(allocation.start_date)
      const allocationEnd = new Date(allocation.end_date)
      
      return allocationStart <= currentWeekEnd && allocationEnd >= currentWeekStart
    }

    // Get all employees allocated to this project in current week
    const projectAllocations = weeklyAllocations.filter(
      alloc => alloc.project_id === projectId && 
                alloc.status === 'Active' &&
                isAllocationInCurrentWeek(alloc)
    )

    if (projectAllocations.length === 0) {
      return 0
    }

    // Calculate total allocation percentage for this project
    const totalAllocation = projectAllocations.reduce((sum, alloc) => {
      return sum + (alloc.allocation_percentage || 0)
    }, 0)

    // Get unique employees count for this project
    const uniqueEmployees = new Set(projectAllocations.map(alloc => alloc.employee_id))
    
    // Calculate average utilization
    return uniqueEmployees.size > 0 ? (totalAllocation / uniqueEmployees.size) : 0
  }

  // Process team members to show only current week and deduplicate employees
  const getCurrentWeekTeamMembers = (projectId) => {
    if (!projectTeamMembers[projectId] || !Array.isArray(projectTeamMembers[projectId])) {
      return []
    }

    // Get current week date range
    const today = new Date()
    const currentWeekStart = new Date(today)
    currentWeekStart.setDate(today.getDate() - today.getDay()) // Start of current week (Sunday)
    const currentWeekEnd = new Date(currentWeekStart)
    currentWeekEnd.setDate(currentWeekStart.getDate() + 6)

    // Check if allocation overlaps with current week
    const isAllocationInCurrentWeek = (allocation) => {
      if (!allocation.start_date || !allocation.end_date) return false
      
      const allocationStart = new Date(allocation.start_date)
      const allocationEnd = new Date(allocation.end_date)
      
      return allocationStart <= currentWeekEnd && allocationEnd >= currentWeekStart
    }

    // Filter for current week allocations
    const currentWeekMembers = projectTeamMembers[projectId].filter(member => 
      isAllocationInCurrentWeek(member)
    )

    // Deduplicate employees and aggregate their allocation percentages
    const employeeMap = new Map()
    
    currentWeekMembers.forEach(member => {
      const employeeId = member.employee_id
      if (employeeMap.has(employeeId)) {
        // Employee already exists, aggregate allocation percentage
        const existing = employeeMap.get(employeeId)
        existing.allocation_percentage += member.allocation_percentage || 0
        // Keep the most recent role if there are multiple
        if (member.role) {
          existing.role = member.role
        }
      } else {
        // New employee, add to map
        employeeMap.set(employeeId, {
          ...member,
          allocation_percentage: member.allocation_percentage || 0
        })
      }
    })

    return Array.from(employeeMap.values())
  }

  // Note: employees data is now received as a prop from the parent component

  // Fetch project team members with comprehensive validation and error handling
  const fetchProjectTeam = async (projectId) => {
    // Validate project ID
    if (!projectId || typeof projectId !== 'number') {
      console.warn(`⚠️ Invalid project ID provided: ${projectId}`)
      return []
    }

    const token = getCookie(TOKEN)
    if (!token) {
      console.warn('⚠️ No authentication token available for team fetch')
      return []
    }

    try {
      
      const response = await fetch(`${getApiBaseUrl()}/api/projects/${projectId}/team`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      
      if (!response.ok) {
        // Handle different error types more specifically
        if (response.status === 404) {
          console.warn(`⚠️ Project ${projectId} not found - skipping team fetch`)
          return []
        }
        if (response.status === 500) {
          console.warn(`⚠️ Server error for project ${projectId} team - returning empty team`)
          return []
        }
        if (response.status === 403) {
          console.warn(`⚠️ Access denied for project ${projectId} team`)
          return []
        }
        
        // Try to get error details from response
        try {
          const errorData = await response.json()
          console.error(`❌ Team fetch failed for project ${projectId}:`, {
            status: response.status,
            statusText: response.statusText,
            error: errorData.error,
            message: errorData.message,
            code: errorData.code
          })
        } catch (jsonError) {
          console.error(`❌ Team fetch failed for project ${projectId}: ${response.status} ${response.statusText}`)
        }
        
        return []
      }
      
      const data = await response.json()
      const teamMembers = data.team_members || []
      return teamMembers
      
    } catch (err) {
      console.error(`💥 Network error fetching team for project ${projectId}:`, err.message)
      return []
    }
  }

  // Validate if a project actually exists by checking its basic properties
  const isValidExistingProject = (project) => {
    // Basic validation
    if (!project || !project.id || typeof project.id !== 'number') {
      return false
    }
    
    // Check if project has essential properties that indicate it's real
    // Real projects should have at least a name and status
    if (!project.name || !project.status) {
      console.warn(`⚠️ Project ${project.id} missing essential properties (name: "${project.name}", status: "${project.status}") - likely phantom project`)
      return false
    }
    
    // Additional validation - real projects typically have creation dates, descriptions, etc.
    // This helps filter out phantom/corrupted project entries
    const hasRealProjectData = project.name.trim().length > 0 && 
                              ['Planning', 'Active', 'Completed', 'On Hold'].includes(project.status)
    
    if (!hasRealProjectData) {
      console.warn(`⚠️ Project ${project.id} has invalid data - skipping team fetch`)
      return false
    }
    
    return true
  }

  // Pre-validate project existence before attempting team fetch
  const validateProjectExists = async (projectId) => {
    const token = getCookie(TOKEN)
    if (!token) return false

    try {
      
      const response = await fetch(`${getApiBaseUrl()}/api/projects/${projectId}`, {
        method: 'HEAD', // Use HEAD request to check existence without downloading data
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      const exists = response.ok
      
      if (!exists && response.status === 404) {
        console.warn(`⚠️ Skipping project ${projectId} - does not exist on backend`)
      }
      
      return exists
    } catch (error) {
      console.warn(`⚠️ Could not validate project ${projectId} existence:`, error.message)
      return false // Assume doesn't exist if we can't validate
    }
  }

  // Fetch available practices on component mount
  useEffect(() => {
    if (isAuthenticated()) {
      fetchAvailablePractices()
    }
  }, [isAuthenticated])

  // Fetch team members for all projects when projects are loaded
  useEffect(() => {
    if (projects.length > 0 && isAuthenticated()) {
      const fetchAllProjectTeams = async () => {
        
        // Step 1: Filter out obviously invalid projects
        const basicValidProjects = projects.filter(project => {
          const isValid = isValidExistingProject(project)
          if (!isValid) {
            console.warn(`⚠️ Filtering out invalid project:`, { id: project?.id, name: project?.name, status: project?.status })
          }
          return isValid
        })
        
        
        // Step 2: Validate existence on backend for remaining projects
        const existenceChecks = await Promise.all(
          basicValidProjects.map(async (project) => {
            const exists = await validateProjectExists(project.id)
            return { project, exists }
          })
        )
        
        // Step 3: Filter to only projects that actually exist
        const existingProjects = existenceChecks
          .filter(({ exists }) => exists)
          .map(({ project }) => project)
        
        const skippedProjects = existenceChecks
          .filter(({ exists }) => !exists)
          .map(({ project }) => project)
        
        if (skippedProjects.length > 0) {
          console.warn(`⚠️ Skipping ${skippedProjects.length} non-existent projects:`, 
            skippedProjects.map(p => ({ id: p.id, name: p.name })))
        }
        
        
        // Initialize with empty teams to prevent flickering
        const teamData = {}
        existingProjects.forEach(project => {
          teamData[project.id] = []
        })
        setProjectTeamMembers(teamData)
        
        // Only fetch team data for projects that actually exist
        if (existingProjects.length === 0) {
          return
        }
        
        // Fetch team data for existing projects only
        const teamFetchPromises = existingProjects.map(async (project) => {
          try {
            const teamMembers = await fetchProjectTeam(project.id)
            return { projectId: project.id, teamMembers, success: true }
          } catch (error) {
            console.warn(`Failed to fetch team for project ${project.id}:`, error)
            return { projectId: project.id, teamMembers: [], success: false, error: error.message }
          }
        })
        
        // Wait for all team fetches to complete
        const results = await Promise.allSettled(teamFetchPromises)
        
        // Process results and update state
        const finalTeamData = { ...teamData }
        let successCount = 0
        let errorCount = 0
        
        results.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            const { projectId, teamMembers, success } = result.value
            finalTeamData[projectId] = teamMembers
            if (success) {
              successCount++
            } else {
              errorCount++
            }
          } else {
            console.error(`Team fetch promise rejected for project ${existingProjects[index]?.id}:`, result.reason)
            errorCount++
          }
        })
        
        // Update state with all team data at once to prevent multiple re-renders
        setProjectTeamMembers(finalTeamData)
        
        
        if (skippedProjects.length > 0) {
          console.log(`🚫 Skipped ${skippedProjects.length} non-existent projects: ${skippedProjects.map(p => p.id).join(', ')}`)
        }
      }
      
      fetchAllProjectTeams()
    } else if (projects.length === 0) {
      // Clear team data if no projects
      setProjectTeamMembers({})
    }
  }, [projects, isAuthenticated])

  const getStatusColor = (status) => {
    switch (status) {
      case 'Active':
        return 'bg-green-100 text-green-800'
      case 'Planning':
        return 'bg-yellow-100 text-yellow-800'
      case 'Completed':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'Low':
        return 'bg-gray-100 text-gray-800'
      case 'Medium':
        return 'bg-yellow-100 text-yellow-800'
      case 'High':
        return 'bg-orange-100 text-orange-800'
      case 'Urgent':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-500'
    }
  }

  // Helper function to format dates in "DD MMM" format
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return 'Invalid Date'
    
    const day = date.getDate()
    const month = date.toLocaleDateString('en-US', { month: 'short' })
    return `${day} ${month}`
  }

  // Helper function to format date range
  const formatDateRange = (startDate, endDate) => {
    const start = formatDate(startDate)
    const end = formatDate(endDate)
    return `${start} - ${end}`
  }

  // Helper function to get minimum start date (two weeks ago from today)
  const getMinimumStartDate = () => {
    const today = new Date()
    const twoWeeksAgo = new Date(today)
    twoWeeksAgo.setDate(today.getDate() - 14)
    return twoWeeksAgo.toISOString().split('T')[0]
  }

  const handleCreateProject = async () => {
    // Validate that project name is provided
    if (!newProject.name || newProject.name.trim() === '') {
      alert('Project name is required')
      return
    }

    // Validate that start date is provided
    if (!newProject.start_date) {
      alert('Start date is required')
      return
    }

    // Validate that end date is provided
    if (!newProject.end_date) {
      alert('End date is required')
      return
    }

    // Validate that start date is not earlier than two weeks ago
    const minimumStartDate = getMinimumStartDate()
    if (newProject.start_date < minimumStartDate) {
      alert(`Start date cannot be earlier than ${new Date(minimumStartDate).toLocaleDateString()}. Please select a date within the last two weeks or in the future.`)
      return
    }

    // Validate that end date is not earlier than start date
    if (newProject.end_date < newProject.start_date) {
      alert('End date cannot be earlier than start date')
      return
    }

    // Validate that practice is provided
    if (!newProject.practice || newProject.practice.trim() === '') {
      alert('Practice is required')
      return
    }

    // Validate that if "Others" is selected, practice_other must be provided
    if (newProject.practice === 'Others' && (!newProject.practice_other || newProject.practice_other.trim() === '')) {
      alert('Please specify the custom practice name')
      return
    }

    // Validate that if project type is "Customer Projects", customer_id must be provided
    if (newProject.project_type === 'Customer Projects' && (!newProject.customer_id || newProject.customer_id === null)) {
      alert('Customer name is required for Customer Projects')
      return
    }

    const token = getCookie(TOKEN)
    if (!token) {
      console.error('Authentication token not found')
      return
    }

    setCreatingProject(true)
    try {
      // Handle custom practice - add to backend if it's a new custom practice
      let finalPractice = newProject.practice
      if (newProject.practice === 'Others' && newProject.practice_other) {
        const customPractice = newProject.practice_other.trim()
        // Check if this custom practice already exists in our available practices
        if (!availablePractices.includes(customPractice)) {
          // Add the custom practice to backend
          const success = await addCustomPractice(customPractice)
          if (!success) {
            alert('Failed to add custom practice. Please try again.')
            setCreatingProject(false)
            return
          }
        }
        finalPractice = customPractice
      }

      // Prepare project data with default values for empty fields
      const projectData = {
        name: newProject.name.trim(),
        description: newProject.description?.trim() || 'N/A',
        status: newProject.status || 'Planning',
        start_date: newProject.start_date || 'N/A',
        end_date: newProject.end_date || 'N/A',
        progress_percentage: newProject.progress_percentage || 0,
        budget: newProject.budget || null,
        spent_budget: newProject.spent_budget || 0,
        project_manager_id: newProject.project_manager_id || null,
        project_type: newProject.project_type || null,
        custom_project_type: newProject.custom_project_type || null,
        customer_id: newProject.customer_id || null,
        practice: finalPractice,
        priority: newProject.priority || 'Medium', // Default to Medium if no priority selected
        project_tab: 'active' // New projects are always created as active
      }

      console.log('Sending project data:', projectData)
      console.log('Customer ID type and value:', typeof projectData.customer_id, projectData.customer_id)

      let response;
      // Check if there's a file to upload
      if (newProject.project_file) {
        // Use FormData for file upload
        const formData = new FormData()

        // Append all project data
        Object.keys(projectData).forEach(key => {
          if (projectData[key] !== null && projectData[key] !== undefined) {
            formData.append(key, projectData[key])
          }
        })

        // Append the file
        formData.append('project_file', newProject.project_file)

        response = await fetch(`${getApiBaseUrl()}/api/projects`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
            // Don't set Content-Type for FormData - browser will set it with boundary
          },
          body: formData
        })
      } else {
        // Use JSON for projects without files
        response = await fetch(`${getApiBaseUrl()}/api/projects`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(projectData)
        })
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('Project creation failed:', {
          status: response.status,
          statusText: response.statusText,
          errorData: errorData,
          projectData: projectData
        })
        const errorMessage = errorData.error || errorData.message || `Failed to create project (${response.status})`
        alert(`Error creating project: ${errorMessage}`)
        throw new Error(errorMessage)
      }
      
      const responseData = await response.json()
      console.log('Project created successfully:', responseData)
      
      // Update state optimistically
      if (responseData.project && updateProjects) {
        updateProjects(prev => [...prev, responseData.project])
      }
      
      alert('Project created successfully!')
      
      // Reset form
      setNewProject({
        name: '',
        description: '',
        status: 'Planning',
        start_date: '',
        end_date: '',
        progress_percentage: 0,
        budget: '',
        spent_budget: 0,
        project_manager_id: null,
        project_type: '',
        custom_project_type: '',
        customer_id: null,
        practice: '',
        practice_other: '',
        priority: '',
        project_file: null
      })
      setProjectManagerSearchTerm(null)
      setShowProjectManagerDropdown(false)
      setCustomerSearchTerm('')
      setShowCustomerDropdown(false)
      setCreateModalSelectedFile(null)
      if (createModalFileInputRef.current) {
        createModalFileInputRef.current.value = ''
      }
      setShowCreateModal(false)
      
      // Note: Removed fetchProjects() call - using optimistic updates instead
    } catch (err) {
      console.error('Error creating project:', err)
      // You could add a toast notification here
    } finally {
      setCreatingProject(false)
    }
  }

  const handleEditProject = (project) => {
    setEditingProject(project.id)
  }

  const handleUpdateProject = async (id, updatedData) => {
    const token = getCookie(TOKEN)
    if (!token) {
      console.error('Authentication token not found')
      return
    }

    // Check if status is being changed to "Completed"
    const originalProject = projects.find(p => p.id === id)
    if (updatedData.status === 'Completed' && originalProject && originalProject.status !== 'Completed') {
      // Show completion confirmation modal
      setCompletionProjectData({ id, updatedData })
      setShowCompletionModal(true)
      return
    }

    // Proceed with normal update
    await performProjectUpdate(id, updatedData, false)
  }

  const performProjectUpdate = async (id, updatedData, shouldArchive = false) => {
    const token = getCookie(TOKEN)
    if (!token) {
      console.error('Authentication token not found')
      return
    }

    setUpdatingProject(true)
    try {
      // Handle custom practice - add to backend if it's a new custom practice
      let finalPractice = updatedData.practice
      if (updatedData.practice === 'Others' && updatedData.practice_other) {
        const customPractice = updatedData.practice_other.trim()
        // Check if this custom practice already exists in our available practices
        if (!availablePractices.includes(customPractice)) {
          // Add the custom practice to backend
          const success = await addCustomPractice(customPractice)
          if (!success) {
            alert('Failed to add custom practice. Please try again.')
            setUpdatingProject(false)
            return
          }
        }
        finalPractice = customPractice
      }

      // Handle practice field - use custom value if "Others" is selected
      const processedData = {
        ...updatedData,
        practice: finalPractice
      }
      
      // Remove practice_other field as it's not needed in the backend
      delete processedData.practice_other
      
      // Handle file upload or deletion
      let response
      if (processedData.project_file || processedData.delete_project_file) {
        // Use FormData for file uploads
        const formData = new FormData()
        Object.entries(processedData).forEach(([key, value]) => {
          if (key === 'project_file' && value instanceof File) {
            formData.append(key, value)
          } else if (key === 'delete_project_file' && value === true) {
            formData.append(key, 'true')
          } else if (value !== undefined && value !== null && key !== 'project_file' && key !== 'delete_project_file') {
            // Convert to string for FormData
            formData.append(key, typeof value === 'object' ? JSON.stringify(value) : value)
          }
        })
        
        response = await fetch(`${getApiBaseUrl()}/api/projects/${id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`
            // Don't set Content-Type - browser will set it with boundary
          },
          body: formData
        })
      } else {
        // Use JSON for regular updates without files
        console.log('Sending project update data:', processedData)
        
        response = await fetch(`${getApiBaseUrl()}/api/projects/${id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(processedData)
        })
      }
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('Project update failed:', errorData)
        throw new Error(errorData.error || 'Failed to update project')
      }
      
      const responseData = await response.json()
      console.log('Project updated successfully:', responseData)
      
      // Update state optimistically
      if (responseData.project && updateProjects) {
        updateProjects(prev => prev.map(project => 
          project.id === id ? responseData.project : project
        ))
      }
      
      // If should archive, move project to archive
      if (shouldArchive) {
        // Update project_tab optimistically
        if (updateProjects) {
          updateProjects(prev => prev.map(project => 
            project.id === id ? { ...project, project_tab: 'archive' } : project
          ))
        }
        alert('Project updated and moved to archive successfully!')
      } else {
        alert('Project updated successfully!')
      }
      
      setEditingProject(null)
      
      // Note: Removed fetchProjects() call - using optimistic updates instead
    } catch (err) {
      console.error('Error updating project:', err)
      alert(`Error updating project: ${err.message}`)
    } finally {
      setUpdatingProject(false)
    }
  }

  const handleDeleteProject = async (id) => {
    if (window.confirm('Are you sure you want to delete this project?')) {
      const token = getCookie(TOKEN)
      if (!token) {
        console.error('Authentication token not found')
        return
      }

      setDeletingProject(true)
      try {
        const response = await fetch(`${getApiBaseUrl()}/api/projects/${id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })
        
        if (!response.ok) {
          throw new Error('Failed to delete project')
        }
        
        const responseData = await response.json()
        console.log('Project deleted successfully:', responseData)
        
        // Update state optimistically - remove the deleted project
        if (updateProjects) {
          updateProjects(prev => prev.filter(project => project.id !== id))
        }
        
        alert('Project deleted successfully!')
        
        // Note: Removed fetchProjects() call - using optimistic updates instead
      } catch (err) {
        console.error('Error deleting project:', err)
        // You could add a toast notification here
      } finally {
        setDeletingProject(false)
      }
    }
  }

  const handleMoveProject = async (projectId, newTab) => {
    const token = getCookie(TOKEN)
    if (!token) {
      console.error('Authentication token not found')
      return
    }

    setMovingProject(true)
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/projects/${projectId}/move`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ project_tab: newTab })
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('Move project failed:', errorData)
        throw new Error(errorData.error || 'Failed to move project')
      }
      
      const responseData = await response.json()
      console.log('Project moved successfully:', responseData)
      
      // Update state optimistically
      if (responseData.project && updateProjects) {
        updateProjects(prev => prev.map(project => 
          project.id === projectId ? responseData.project : project
        ))
      }
      
      alert(`Project ${newTab === 'archive' ? 'archived' : 'restored'} successfully!`)
      
      // Note: Removed fetchProjects() call - using optimistic updates instead
    } catch (err) {
      console.error('Error moving project:', err)
      alert(`Error moving project: ${err.message}`)
    } finally {
      setMovingProject(false)
    }
  }

  const handleConfirmMove = (project, actionType) => {
    setConfirmAction({ type: actionType, project })
    setShowConfirmModal(true)
  }

  const executeMoveAction = async () => {
    if (!confirmAction) return
    
    const newTab = confirmAction.type === 'archive' ? 'archive' : 'active'
    await handleMoveProject(confirmAction.project.id, newTab)
    
    // Close modal
    setShowConfirmModal(false)
    setConfirmAction(null)
  }

  const cancelMoveAction = () => {
    setShowConfirmModal(false)
    setConfirmAction(null)
  }

  // Handle completion confirmation
  const handleCompletionConfirm = async (shouldArchive) => {
    if (completionProjectData) {
      await performProjectUpdate(completionProjectData.id, completionProjectData.updatedData, shouldArchive)
    }
    setShowCompletionModal(false)
    setCompletionProjectData(null)
  }

  const cancelCompletionAction = () => {
    setShowCompletionModal(false)
    setCompletionProjectData(null)
  }

  const handleProjectClick = async (project) => {
    // Validate project before processing
    if (!project || !project.id) {
      console.warn('⚠️ Invalid project clicked:', project)
      return
    }
    
    // Additional validation for project existence
    if (!isValidExistingProject(project)) {
      console.warn('⚠️ Clicked project appears to be invalid:', project)
      return
    }
    
    setSelectedProject(project)
    
    // Check if we already have team data for this project
    if (projectTeamMembers[project.id] !== undefined) {
      return
    }
    
    // Validate project exists on backend before fetching team
    const exists = await validateProjectExists(project.id)
    if (!exists) {
      console.warn(`⚠️ Clicked project ${project.id} does not exist on backend - skipping team fetch`)
      setProjectTeamMembers(prev => ({
        ...prev,
        [project.id]: []
      }))
      return
    }
    
    // Fetch team members for this specific project
    try {
      const teamMembers = await fetchProjectTeam(project.id)
      setProjectTeamMembers(prev => ({
        ...prev,
        [project.id]: teamMembers
      }))
    } catch (error) {
      console.error(`Failed to fetch team for clicked project ${project.id}:`, error)
      // Set empty array as fallback
      setProjectTeamMembers(prev => ({
        ...prev,
        [project.id]: []
      }))
    }
  }

  const handleProjectNameClick = () => {
    if (contextMenuProject) {
      // Navigate to project details page
      navigate(`/project/${contextMenuProject.id}`)
    }
    setShowContextMenu(false)
    setContextMenuProject(null)
  }

  // Context menu handlers
  const handleRightClick = (e, project) => {
    e.preventDefault()
    e.stopPropagation()
    
    setContextMenuPosition({ x: e.clientX, y: e.clientY })
    setContextMenuProject(project)
    setShowContextMenu(true)
  }

  const handleOpenInNewTab = () => {
    if (contextMenuProject) {
      const projectUrl = `/project/${contextMenuProject.id}`
      window.open(projectUrl, '_blank')
    }
    setShowContextMenu(false)
    setContextMenuProject(null)
  }

  const handleClickOutside = (e) => {
    if (showContextMenu && !e.target.closest('.context-menu')) {
      setShowContextMenu(false)
      setContextMenuProject(null)
    }
  }

  // Add click outside listener
  useEffect(() => {
    if (showContextMenu) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [showContextMenu])

  // Helper function to get employee name
  const getEmployeeName = (employeeId) => {
    const employee = employees.find(emp => emp.id === employeeId)
    return employee ? `${employee.first_name} ${employee.last_name}` : 'Unknown Employee'
  }

  // Helper function to get customer name
  const getCustomerName = (customerId) => {
    const customer = customers.find(customer => customer.id === customerId)
    return customer ? customer.name : 'Unknown Customer'
  }

  // Filter employees based on search term and active status
  const getFilteredEmployees = () => {
    // First filter to show only active employees
    const activeEmployees = employees.filter(employee => {
      // Filter to show only active employees
      return (employee.employee_status || 'Active') === 'Active'
    })
    
    if (!projectManagerSearchTerm || !projectManagerSearchTerm.trim()) {
      return activeEmployees
    }
    const searchLower = projectManagerSearchTerm.toLowerCase()
    return activeEmployees.filter(employee => {
      const fullName = `${employee.first_name || ''} ${employee.last_name || ''}`.trim().toLowerCase()
      const designation = (employee.designation || '').toLowerCase()
      return fullName.includes(searchLower) || designation.includes(searchLower)
    })
  }

  // Filter customers based on search term
  const getFilteredCustomers = () => {
    if (!customerSearchTerm.trim()) {
      return customers
    }
    const searchLower = customerSearchTerm.toLowerCase()
    return customers.filter(customer => 
      (customer.name && customer.name.toLowerCase().includes(searchLower)) ||
      (customer.email && customer.email.toLowerCase().includes(searchLower))
    )
  }

  // Handle project manager selection
  const handleProjectManagerSelect = (employeeId) => {
    setNewProject({...newProject, project_manager_id: employeeId})
    setProjectManagerSearchTerm(null) // Set to null so the selected name shows in the input
    setShowProjectManagerDropdown(false)
  }

  // Handle project manager search input change
  const handleProjectManagerSearchChange = (value) => {
    setProjectManagerSearchTerm(value)
    setShowProjectManagerDropdown(true)
    // Always clear project manager selection when user types (including when clearing)
    // This allows the user to clear the selection by deleting the text
    if (newProject.project_manager_id) {
      const selectedEmployee = employees.find(emp => emp.id === newProject.project_manager_id)
      const selectedName = selectedEmployee ? `${selectedEmployee.first_name || ''} ${selectedEmployee.last_name || ''}`.trim().toLowerCase() : ''
      const searchLower = value.toLowerCase()
      // Only keep selection if the search exactly matches the selected employee's name
      if (!selectedEmployee || selectedName !== searchLower) {
        setNewProject({...newProject, project_manager_id: null})
      }
    }
  }

  // Handle customer selection
  const handleCustomerSelect = (customerId) => {
    setNewProject({...newProject, customer_id: parseInt(customerId)})
    setCustomerSearchTerm('')
    setShowCustomerDropdown(false)
  }

  // Handle customer search input change
  const handleCustomerSearchChange = (value) => {
    setCustomerSearchTerm(value)
    setShowCustomerDropdown(true)
    
    // If user is actively typing (searching), clear the current selection
    if (value.trim() !== '') {
      setNewProject({...newProject, customer_id: null})
    }
  }

  // Handle customer input key down events
  const handleCustomerKeyDown = (e) => {
    if (e.key === 'Backspace' || e.key === 'Delete') {
      // If user presses backspace/delete and there's a selected value, clear it
      if (newProject.customer_id && customerSearchTerm === '') {
        setNewProject({...newProject, customer_id: null})
        setCustomerSearchTerm('')
      }
    }
  }

  // Handle file selection in create modal
  const handleCreateModalFileSelect = (e) => {
    const file = e.target.files && e.target.files[0]
    if (file) {
      setCreateModalSelectedFile(file)
      setNewProject({...newProject, project_file: file})
    }
  }

  // Handle file deletion in create modal
  const handleCreateModalFileDelete = () => {
    setCreateModalSelectedFile(null)
    setNewProject({...newProject, project_file: null})
    if (createModalFileInputRef.current) {
      createModalFileInputRef.current.value = ''
    }
  }

  // Handle click outside for project manager dropdown
  const handleProjectManagerClickOutside = (e) => {
    if (showProjectManagerDropdown && !e.target.closest('.project-manager-dropdown-container')) {
      setShowProjectManagerDropdown(false)
    }
  }

  // Handle click outside for customer dropdown
  const handleCustomerClickOutside = (e) => {
    if (showCustomerDropdown && !e.target.closest('.customer-dropdown-container')) {
      setShowCustomerDropdown(false)
    }
  }

  // Add click outside listener for project manager dropdown
  useEffect(() => {
    if (showProjectManagerDropdown) {
      document.addEventListener('click', handleProjectManagerClickOutside)
      return () => document.removeEventListener('click', handleProjectManagerClickOutside)
    }
  }, [showProjectManagerDropdown])

  // Add click outside listener for customer dropdown
  useEffect(() => {
    if (showCustomerDropdown) {
      document.addEventListener('click', handleCustomerClickOutside)
      return () => document.removeEventListener('click', handleCustomerClickOutside)
    }
  }, [showCustomerDropdown])



  // Filter projects based on search term, status, additional filters, and project tab
  const filteredProjects = projects.filter(project => {
    const matchesSearch = project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (project.description && project.description.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesStatus = statusFilter === 'All' || project.status === statusFilter
    
    // Handle project_tab filtering - if project_tab is not set, treat as 'active' for backward compatibility
    const projectTab = project.project_tab || 'active'
    const matchesProjectTab = projectTab === activeTab
    
    // Exclude main customer projects from Project Tab - they should only appear in Customer Project Tab
    const isMainCustomerProject = project.project_category === 'main_customer_project'
    const matchesProjectCategory = !isMainCustomerProject
    
    // Additional filters - fix the filter logic
    const matchesDepartment = !filters.department || project.department === filters.department
    const matchesProjectManager = !filters.project_manager || 
      (project.project_manager_id && project.project_manager_id === parseInt(filters.project_manager))
    
    // Status filter from filters object (different from statusFilter)
    const matchesFilterStatus = !filters.status || project.status === filters.status
    
    // Project type filter - support both old single-value and new multi-select
    const matchesProjectType = (!filters.selected_project_types_projects || filters.selected_project_types_projects.length === 0) && 
      (!filters.project_type || project.project_type === filters.project_type) ||
      (filters.selected_project_types_projects && filters.selected_project_types_projects.includes(project.project_type))
    
    // Practice filter - multi-select
    const matchesPractice = !filters.selected_practices_projects || 
      filters.selected_practices_projects.length === 0 ||
      (filters.selected_practices_projects && project.practice && filters.selected_practices_projects.includes(project.practice))
    
    // Project filter - multi-select
    const matchesProject = !filters.selected_projects_projects || 
      filters.selected_projects_projects.length === 0 ||
      (filters.selected_projects_projects && filters.selected_projects_projects.includes(project.id))
    
    // Priority filter
    const matchesPriority = !filters.priority || project.priority === filters.priority
    
    // Date range filters
    const matchesDateRange = true // Will implement date range filtering if needed
    
    return matchesSearch && matchesStatus && matchesProjectTab && matchesProjectCategory && matchesDepartment && matchesProjectManager && matchesFilterStatus && matchesProjectType && matchesPractice && matchesProject && matchesPriority && matchesDateRange
  })

  // Get project statistics
  const totalProjects = projects.length
  const activeProjects = projects.filter(p => p.status === 'Active').length
  const planningProjects = projects.filter(p => p.status === 'Planning').length
  const completedProjects = projects.filter(p => p.status === 'Completed').length
  
  // Get tab-based statistics - handle backward compatibility for projects without project_tab
  const activeTabProjects = projects.filter(p => (p.project_tab || 'active') === 'active').length
  const archivedTabProjects = projects.filter(p => p.project_tab === 'archive').length

  // Calculate budget statistics from actual database values
  const totalBudget = projects.reduce((sum, project) => {
    return sum + (project.budget || 0)
  }, 0)

  const totalSpent = projects.reduce((sum, project) => {
    // Use actual spent_budget from database, default to 0 if not set
    return sum + (project.spent_budget || 0)
  }, 0)

  // Toggle project accordion
  const toggleProjectAccordion = (projectId) => {
    const newExpanded = new Set(expandedProjects)
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId)
    } else {
      newExpanded.add(projectId)
    }
    setExpandedProjects(newExpanded)
  }

  // Format currency
  const formatCurrency = (amount) => {
    if (!amount) return '$0'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  // Format description to display with fixed width
  const formatDescription = (description) => {
    if (!description) return 'N/A'
    return description
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner message="Loading projects..." size="medium" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="text-red-800">Error: {error}</div>
        <button 
          onClick={() => fetchProjects && fetchProjects()}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <>
      <style>{animationStyles}</style>
      
      {/* View-specific Header */}
      <div className="px-6 py-4 border-b border-slate-200">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-6">
            <h2 className="text-xl font-semibold text-slate-900">
              {activeTab === 'active' ? 'All' : 'Archived'} Projects ({filteredProjects.length} {filteredProjects.length === 1 ? 'project' : 'projects'})
            </h2>
            
            {/* Tab Navigation */}
            <div className="flex bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => setActiveTab('active')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'active'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({activeTabProjects})
              </button>
              <button
                onClick={() => setActiveTab('archive')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'archive'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Archived ({archivedTabProjects})
              </button>
            </div>
          </div>
          
          {hasPermission('project-add') && (
            <button
              onClick={() => {
                setShowCreateModal(true)
                setProjectManagerSearchTerm(null)
                setShowProjectManagerDropdown(false)
                setCustomerSearchTerm('')
                setShowCustomerDropdown(false)
                setCreateModalSelectedFile(null)
                if (createModalFileInputRef.current) {
                  createModalFileInputRef.current.value = ''
                }
              }}
              disabled={creatingProject || updatingProject || deletingProject || movingProject}
              className="bg-green-700 text-white px-4 py-2 rounded-lg hover:bg-green-800 transition-colors font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creatingProject ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Creating...
                </>
              ) : (
                <>
                  <span>+</span>
                  Add Project
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Projects Content */}
      <div className="overflow-x-auto">
        {filteredProjects.length > 0 ? (
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Project
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Priority
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Project Manager
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Timeline
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Budget
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Team
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Utilization
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredProjects.map((project) => (
                <React.Fragment key={project.id}>
                  <tr 
                    className="hover:bg-slate-50 cursor-pointer"
                    onClick={() => toggleProjectAccordion(project.id)}
                    onContextMenu={(e) => handleRightClick(e, project)}
                  >
                    <td className="pl-6 pr-1 py-4">
                      <div className="flex items-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleProjectAccordion(project.id)
                          }}
                          className="mr-3 text-slate-400 hover:text-slate-600 flex-shrink-0"
                        >
                          <svg 
                            className={`w-4 h-4 transform transition-transform ${expandedProjects.has(project.id) ? 'rotate-90' : ''}`} 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
                          </svg>
                        </button>
                        <div className="w-[250px] min-w-[250px]">
                          <div 
                            className="text-sm font-medium text-green-700 hover:text-green-800 cursor-pointer truncate"
                            onClick={(e) => {
                              e.stopPropagation()
                              navigate(`/project/${project.id}`)
                            }}
                          >
                            {project.name}
                          </div>
                          <div className="text-sm text-slate-500 break-words">
                            {formatDescription(project.description)}
                          </div>
                          <div className="mt-1 flex gap-2">
                            {project.project_type === 'Customer Projects' && project.custom_project_type && (
                              <span className="inline-flex px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                                {project.custom_project_type}
                              </span>
                            )}
                            {project.customer_id && (
                              <span className="inline-flex px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                                Child Project
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(project.status)}`}>
                        {project.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(project.priority || 'Medium')}`}>
                        {project.priority || 'Medium'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-900">
                        {project.project_manager_id ? 
                          (() => {
                            const manager = employees.find(emp => emp.id === project.project_manager_id)
                            return manager ? `${manager.first_name} ${manager.last_name}` : 'Unknown'
                          })() 
                          : 'N/A'
                        }
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm text-slate-900">
                          {formatDateRange(project.start_date, project.end_date)}
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2 mt-1">
                          <div 
                            className="bg-green-500 h-2 rounded-full" 
                            style={{ width: `${project.progress_percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm text-slate-900">
                          {project.budget ? formatCurrency(project.budget) : 'N/A'}
                        </div>
                        <div className="text-sm text-slate-500">
                          {formatCurrency(project.spent_budget || 0)} spent
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="text-sm text-slate-900">
                          {getCurrentWeekTeamMembers(project.id).length} members
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        {(() => {
                          const avgUtilization = calculateProjectAvgUtilization(project.id)
                          return (
                            <>
                              <div className="text-sm text-slate-900">Avg: {avgUtilization.toFixed(1)}%</div>
                              <div className="w-full bg-slate-200 rounded-full h-2 mt-1">
                                <div 
                                  className={`h-2 rounded-full transition-all duration-300 ${
                                    avgUtilization >= 80 ? 'bg-green-500' :
                                    avgUtilization >= 60 ? 'bg-yellow-500' :
                                    avgUtilization >= 40 ? 'bg-orange-500' :
                                    'bg-red-500'
                                  }`} 
                                  style={{ width: `${Math.min(avgUtilization, 100)}%` }}
                                ></div>
                              </div>
                            </>
                          )
                        })()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleEditProject(project)
                          }}
                          disabled={updatingProject || deletingProject || movingProject || !hasPermission('project-edit')}
                          className={`${hasPermission('project-edit') ? 'text-green-700 hover:text-green-900' : 'text-gray-400 cursor-not-allowed'} disabled:opacity-50 disabled:cursor-not-allowed`}
                          title={hasPermission('project-edit') ? "Edit Project" : "Edit Project (No Permission)"}
                        >
                          {updatingProject ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-700"></div>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                            </svg>
                          )}
                        </button>
                        
                        {/* Move to Archive/Restore Button */}
                        {activeTab === 'active' ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleConfirmMove(project, 'archive')
                            }}
                            disabled={updatingProject || deletingProject || movingProject || !hasPermission('project-archive')}
                            className={`${hasPermission('project-archive') ? 'text-orange-600 hover:text-orange-900' : 'text-gray-400 cursor-not-allowed'} disabled:opacity-50 disabled:cursor-not-allowed`}
                            title={hasPermission('project-archive') ? "Archive Project" : "Archive Project (No Permission)"}
                          >
                            {movingProject ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600"></div>
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8l6 6m0 0l6-6m-6 6V4"/>
                              </svg>
                            )}
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleConfirmMove(project, 'restore')
                            }}
                            disabled={updatingProject || deletingProject || movingProject || !hasPermission('project-restore')}
                            className={`${hasPermission('project-restore') ? 'text-green-600 hover:text-green-900' : 'text-gray-400 cursor-not-allowed'} disabled:opacity-50 disabled:cursor-not-allowed`}
                            title={hasPermission('project-restore') ? "Restore Project" : "Restore Project (No Permission)"}
                          >
                            {movingProject ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
                              </svg>
                            )}
                          </button>
                        )}
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteProject(project.id)
                          }}
                          disabled={updatingProject || deletingProject || movingProject || !hasPermission('project-delete')}
                          className={`${hasPermission('project-delete') ? 'text-red-600 hover:text-red-900' : 'text-gray-400 cursor-not-allowed'} disabled:opacity-50 disabled:cursor-not-allowed`}
                          title={hasPermission('project-delete') ? "Delete Project" : "Delete Project (No Permission)"}
                        >
                          {deletingProject ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                            </svg>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {/* Team Composition Accordion */}
                  {expandedProjects.has(project.id) && (
                    <tr>
                      <td colSpan="7" className="px-6 py-4 bg-slate-50">
                        <div className="bg-white rounded-lg p-4 border border-slate-200">
                          <h4 className="text-lg font-medium text-slate-900 mb-4">Team Composition (Current Week)</h4>
                          {(() => {
                            const currentWeekMembers = getCurrentWeekTeamMembers(project.id)
                            return currentWeekMembers.length > 0 ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {currentWeekMembers.map((member, index) => (
                                  <div key={`${member.employee_id}-${index}`} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                                    <div className="text-sm font-medium text-slate-900">{member.employee_name}</div>
                                    <div className="text-sm text-slate-600">{member.role}</div>
                                    <div className={`text-sm font-medium ${
                                      member.allocation_percentage > 100 ? 'text-red-600' : 'text-slate-900'
                                    }`}>
                                      {member.allocation_percentage}%
                                    </div>
                                  </div>
                                ))}
                                {currentWeekMembers.length > 8 && (
                                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 flex items-center justify-center">
                                    <span className="text-sm text-green-700 hover:text-green-800 cursor-pointer">
                                      + {currentWeekMembers.length - 8} more team members
                                    </span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-center py-4">
                                <p className="text-slate-500">No team members assigned to this project for the current week.</p>
                              </div>
                            )
                          })()}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-slate-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
            </svg>
            <h3 className="text-lg font-medium text-slate-900 mb-2">
              {activeTab === 'active' ? 'No active projects found' : 'No archived projects found'}
            </h3>
            <p className="text-slate-500 mb-4">
              {searchTerm || statusFilter !== 'All' 
                ? 'Try adjusting your search or filter criteria.' 
                : activeTab === 'active' 
                  ? 'Get started by creating your first project.'
                  : 'No projects have been archived yet.'}
            </p>
            {!searchTerm && statusFilter === 'All' && activeTab === 'active' && (
              <button
                onClick={() => {
                  setShowCreateModal(true)
                  setProjectManagerSearchTerm(null)
                  setShowProjectManagerDropdown(false)
                  setCustomerSearchTerm('')
                  setShowCustomerDropdown(false)
                  setCreateModalSelectedFile(null)
                  if (createModalFileInputRef.current) {
                    createModalFileInputRef.current.value = ''
                  }
                }}
                className="bg-green-700 text-white px-4 py-2 rounded-lg hover:bg-green-800 transition-colors"
              >
                Create Project
              </button>
            )}
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-lg max-h-[70vh] flex flex-col">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold">Create New Project</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Project Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newProject.name}
                    onChange={(e) => setNewProject({...newProject, name: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Enter project name"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Description <span className="text-slate-400 text-sm">(Optional)</span>
                  </label>
                  <textarea
                    value={newProject.description}
                    onChange={(e) => setNewProject({...newProject, description: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    rows="3"
                    placeholder="Enter project description (optional)"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Project File</label>
                  <input
                    ref={createModalFileInputRef}
                    type="file"
                    accept=".zip,.pdf,.doc,.docx,.txt,.md,.json,.yml,.yaml,.csv,.xls,.xlsx,.ppt,.pptx"
                    onChange={handleCreateModalFileSelect}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
                  />
                  <p className="text-xs text-slate-500 mb-3">
                    Supported formats: PDF, DOC, DOCX, TXT, XLSX, XLS, PPT, PPTX
                  </p>
                  
                  {/* File List - Shows newly selected file */}
                  <div className="space-y-2">
                    {/* Newly selected file */}
                    {createModalSelectedFile && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <svg className="w-5 h-5 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                            </svg>
                            <span className="text-sm text-blue-700 truncate" title={createModalSelectedFile.name}>
                              {createModalSelectedFile.name}
                            </span>
                            <span className="text-xs text-blue-500">(New)</span>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              type="button"
                              onClick={handleCreateModalFileDelete}
                              className="text-red-600 hover:text-red-800 transition-colors"
                              title="Remove selected file"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Status <span className="text-slate-400 text-sm">(Optional)</span>
                  </label>
                  <select
                    value={newProject.status}
                    onChange={(e) => setNewProject({...newProject, status: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="Planning">Planning</option>
                    <option value="Active">Active</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Project Manager <span className="text-slate-400 text-sm">(Optional)</span>
                  </label>
                  <div className="relative project-manager-dropdown-container">
                    <input
                      type="text"
                      value={projectManagerSearchTerm !== null && projectManagerSearchTerm !== undefined 
                        ? projectManagerSearchTerm 
                        : (newProject.project_manager_id ? getEmployeeName(newProject.project_manager_id) : '')}
                      onChange={(e) => handleProjectManagerSearchChange(e.target.value)}
                      onFocus={() => setShowProjectManagerDropdown(true)}
                      onKeyDown={(e) => {
                        // Allow clearing with backspace/delete when showing selected name
                        if ((e.key === 'Backspace' || e.key === 'Delete') && 
                            (projectManagerSearchTerm === null || projectManagerSearchTerm === '') && 
                            newProject.project_manager_id) {
                          setNewProject({...newProject, project_manager_id: null})
                          setProjectManagerSearchTerm('')
                        }
                      }}
                      placeholder="Search project managers..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    {showProjectManagerDropdown && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 hover:scrollbar-thumb-gray-400">
                        {getFilteredEmployees().length > 0 ? (
                          getFilteredEmployees().map(employee => (
                            <button
                              key={employee.id}
                              type="button"
                              onClick={() => handleProjectManagerSelect(employee.id)}
                              className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors text-slate-900"
                            >
                              <div className="flex items-center justify-between">
                                <span>{employee.first_name} {employee.last_name}</span>
                                <span className="text-sm text-slate-500">{employee.designation}</span>
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-slate-500 text-sm">
                            No employees found matching "{projectManagerSearchTerm}"
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Project Type <span className="text-slate-400 text-sm">(Optional)</span>
                  </label>
                  <select
                    value={newProject.project_type || ''}
                    onChange={(e) => setNewProject({...newProject, project_type: e.target.value, custom_project_type: '', customer_id: null})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">Select Project Type (Optional)</option>
                    <option value="Customer Projects">Customer Projects</option>
                    <option value="POC">POC</option>
                    <option value="Demo">Demo</option>
                    <option value="Capability">Capability</option>
                    <option value="Internal">Internal</option>
                  </select>
                </div>
                {newProject.project_type === 'Customer Projects' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Customer Name <span className="text-red-500">*</span>
                      </label>
                      <div className="relative customer-dropdown-container">
                        <input
                          type="text"
                          value={customerSearchTerm !== '' ? customerSearchTerm : (newProject.customer_id ? getCustomerName(newProject.customer_id) : '')}
                          onChange={(e) => handleCustomerSearchChange(e.target.value)}
                          onKeyDown={handleCustomerKeyDown}
                          onFocus={() => setShowCustomerDropdown(true)}
                          placeholder="Search customers..."
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                          required
                        />
                        {showCustomerDropdown && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 hover:scrollbar-thumb-gray-400">
                            {getFilteredCustomers().length > 0 ? (
                              getFilteredCustomers().map(customer => (
                                <button
                                  key={customer.id}
                                  type="button"
                                  onClick={() => handleCustomerSelect(customer.id)}
                                  className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors text-slate-900"
                                >
                                  <div className="flex items-center justify-between">
                                    <span>{customer.name}</span>
                                    <span className="text-sm text-slate-500">{customer.email}</span>
                                  </div>
                                </button>
                              ))
                            ) : (
                              <div className="px-3 py-2 text-slate-500 text-sm">
                                No customers found matching "{customerSearchTerm}"
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Custom Project Type <span className="text-slate-400 text-sm">(Optional)</span>
                      </label>
                      <select
                        value={newProject.custom_project_type || ''}
                        onChange={(e) => setNewProject({...newProject, custom_project_type: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      >
                        <option value="">Select Custom Project Type (Optional)</option>
                        <option value="Staff Augmented">Staff Augmented</option>
                        <option value="SOW">SOW</option>
                      </select>
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Practice <span className="text-red-500">*</span>
                  </label>
                  <SearchableDropdown
                    options={[
                      { value: '', label: 'Select Practice' },
                      ...availablePractices.map(practice => ({
                        value: practice,
                        label: practice
                      })),
                      { value: 'Others', label: 'Others' }
                    ]}
                    value={newProject.practice || ''}
                    onChange={(value) => setNewProject({...newProject, practice: value})}
                    placeholder="Select Practice"
                    className="w-full"
                  />
                  {newProject.practice === 'Others' && (
                    <input
                      type="text"
                      value={newProject.practice_other || ''}
                      onChange={(e) => setNewProject({...newProject, practice_other: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800 mt-2"
                      placeholder="Enter custom practice name"
                      required
                    />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Priority <span className="text-slate-400 text-sm">(Optional)</span>
                  </label>
                  <select
                    value={newProject.priority || 'Medium'}
                    onChange={(e) => setNewProject({...newProject, priority: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Start Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={newProject.start_date}
                      onChange={(e) => {
                        const newStartDate = e.target.value
                        // If the new start date is later than the current end date, clear the end date
                        const updatedProject = { ...newProject, start_date: newStartDate }
                        if (newProject.end_date && newStartDate > newProject.end_date) {
                          updatedProject.end_date = ''
                        }
                        setNewProject(updatedProject)
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      min={getMinimumStartDate()}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      End Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={newProject.end_date}
                      onChange={(e) => setNewProject({...newProject, end_date: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      min={newProject.start_date || getMinimumStartDate()}
                      required
                    />
                  </div>
                </div>
                {/* <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Progress (%) <span className="text-slate-400 text-sm">(Optional)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={newProject.progress_percentage}
                    onChange={(e) => setNewProject({...newProject, progress_percentage: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="0"
                  />
                </div> */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Total Budget ($) <span className="text-slate-400 text-sm">(Optional)</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newProject.budget}
                      onChange={(e) => setNewProject({...newProject, budget: parseFloat(e.target.value) || ''})}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="Enter total budget (optional)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Spent Budget ($) <span className="text-slate-400 text-sm">(Optional)</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newProject.spent_budget || ''}
                      onChange={(e) => setNewProject({...newProject, spent_budget: parseFloat(e.target.value) || 0})}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="Enter spent amount (optional)"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-slate-200">
              <div className="flex justify-end space-x-3">
                <button
                onClick={() => {
                  setShowCreateModal(false)
                  setProjectManagerSearchTerm(null)
                  setShowProjectManagerDropdown(false)
                  setCustomerSearchTerm('')
                  setShowCustomerDropdown(false)
                  setCreateModalSelectedFile(null)
                  if (createModalFileInputRef.current) {
                    createModalFileInputRef.current.value = ''
                  }
                }}
                  disabled={creatingProject}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateProject}
                  disabled={creatingProject || !newProject.name?.trim() || !newProject.start_date || !newProject.end_date || !newProject.practice || (newProject.practice === 'Others' && !newProject.practice_other?.trim()) || (newProject.project_type === 'Customer Projects' && (!newProject.customer_id || newProject.customer_id === null))}
                  className="px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {creatingProject ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Creating...
                    </>
                  ) : (
                    'Create Project'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Project Modal */}
      {editingProject && (
        <EditProjectModal
          project={projects.find(p => p.id === editingProject)}
          onUpdate={handleUpdateProject}
          onCancel={() => setEditingProject(null)}
          projectTeamMembers={projectTeamMembers}
          employees={employees}
          customers={customers}
          updatingProject={updatingProject}
          availablePractices={availablePractices}
          getCurrentWeekTeamMembers={getCurrentWeekTeamMembers}
        />
      )}

      {/* Project Employees Modal */}
      {selectedProject && (
        <ProjectEmployeesModal
          project={selectedProject}
          employees={projectTeamMembers[selectedProject.id] || []}
          onClose={() => setSelectedProject(null)}
        />
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && confirmAction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center mb-4">
              <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                confirmAction.type === 'archive' 
                  ? 'bg-orange-100' 
                  : 'bg-green-100'
              }`}>
                {confirmAction.type === 'archive' ? (
                  <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8l6 6m0 0l6-6m-6 6V4"/>
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
                  </svg>
                )}
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-slate-900">
                  {confirmAction.type === 'archive' ? 'Archive Project' : 'Restore Project'}
                </h3>
                <p className="text-sm text-slate-500">
                  {confirmAction.type === 'archive' 
                    ? 'This project will be moved to the archive section.' 
                    : 'This project will be moved back to the active section.'}
                </p>
              </div>
            </div>
            
            <div className="bg-slate-50 rounded-lg p-4 mb-6">
              <h4 className="font-medium text-slate-900 mb-1">{confirmAction.project.name}</h4>
              <p className="text-sm text-slate-600">
                {confirmAction.project.description || 'No description available'}
              </p>
              <div className="mt-2 flex items-center gap-4 text-sm text-slate-500">
                <span>Status: {confirmAction.project.status}</span>
                <span>Progress: {confirmAction.project.progress_percentage}%</span>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={cancelMoveAction}
                disabled={movingProject}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={executeMoveAction}
                disabled={movingProject}
                className={`px-4 py-2 rounded-lg text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${
                  confirmAction.type === 'archive'
                    ? 'bg-orange-600 hover:bg-orange-700'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {movingProject ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    {confirmAction.type === 'archive' ? 'Archiving...' : 'Restoring...'}
                  </>
                ) : (
                  <>
                    {confirmAction.type === 'archive' ? 'Archive Project' : 'Restore Project'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {showContextMenu && contextMenuProject && (
        <div 
          className="context-menu fixed bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-50 min-w-[160px]"
          style={{
            left: contextMenuPosition.x,
            top: contextMenuPosition.y,
          }}
        >
          <button
            onClick={handleProjectNameClick}
            className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
            </svg>
            View Project Details
          </button>
          <button
            onClick={handleOpenInNewTab}
            className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
            </svg>
            Open in New Tab
          </button>
        </div>
      )}

      {/* Completion Confirmation Modal */}
      {showCompletionModal && completionProjectData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-green-100">
                <svg className="w-6 h-6 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-slate-900">
                  Project Completed
                </h3>
                <p className="text-sm text-slate-500">
                  This project is being marked as completed. Would you like to move it to the archived section?
                </p>
              </div>
            </div>
            
            <div className="bg-slate-50 rounded-lg p-4 mb-6">
              <h4 className="font-medium text-slate-900 mb-1">
                {(() => {
                  const project = projects.find(p => p.id === completionProjectData.id)
                  return project ? project.name : 'Unknown Project'
                })()}
              </h4>
              <p className="text-sm text-slate-600">
                Status: <span className="font-medium text-green-700">Completed</span>
              </p>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={cancelCompletionAction}
                disabled={updatingProject}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleCompletionConfirm(false)}
                disabled={updatingProject}
                className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {updatingProject ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Updating...
                  </>
                ) : (
                  'No, Keep Active'
                )}
              </button>
              <button
                onClick={() => handleCompletionConfirm(true)}
                disabled={updatingProject}
                className="px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {updatingProject ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Archiving...
                  </>
                ) : (
                  'Yes, Move to Archive'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
})

// Edit Project Modal Component
const EditProjectModal = ({ project, onUpdate, onCancel, projectTeamMembers, employees, customers, updatingProject, availablePractices = [], getCurrentWeekTeamMembers }) => {
  // Check if the current practice is in the available practices list
  const isCustomPractice = project.practice && !availablePractices.includes(project.practice)
  
  const [editData, setEditData] = useState({ 
    ...project,
    spent_budget: project.spent_budget || 0,
    practice: isCustomPractice ? 'Others' : project.practice || '',
    practice_other: isCustomPractice ? project.practice : '',
    priority: project.priority || 'Medium' // Default to Medium if no priority is set
  })

  // State for customer search in edit modal
  const [customerSearchTerm, setCustomerSearchTerm] = useState('')
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  
  // Track files to delete temporarily (only delete when Save is clicked)
  const [filesToDelete, setFilesToDelete] = useState(false)
  // Track newly selected file
  const [selectedFile, setSelectedFile] = useState(null)
  // File input ref to clear it
  const fileInputRef = useRef(null)

  const handleSave = () => {
    // Include file deletion and new file in editData when saving
    const dataToSave = {
      ...editData,
      delete_project_file: filesToDelete,
      project_file: selectedFile
    }
    onUpdate(project.id, dataToSave)
  }
  
  const handleFileSelect = (e) => {
    const file = e.target.files && e.target.files[0]
    if (file) {
      setSelectedFile(file)
      setFilesToDelete(false) // If new file selected, don't delete existing
    }
  }
  
  const handleDeleteExistingFile = () => {
    // Mark existing file for deletion, but keep any newly selected file intact
    // Users may want to delete old file and upload a new one in the same action
    setFilesToDelete(true)
  }
  
  const handleDeleteSelectedFile = () => {
    setSelectedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Helper function to get customer name
  const getCustomerName = (customerId) => {
    const customer = customers.find(customer => customer.id === customerId)
    return customer ? customer.name : 'Unknown Customer'
  }

  // Filter customers based on search term
  const getFilteredCustomers = () => {
    if (!customerSearchTerm.trim()) {
      return customers
    }
    const searchLower = customerSearchTerm.toLowerCase()
    return customers.filter(customer => 
      (customer.name && customer.name.toLowerCase().includes(searchLower)) ||
      (customer.email && customer.email.toLowerCase().includes(searchLower))
    )
  }

  // Handle customer selection
  const handleCustomerSelect = (customerId) => {
    setEditData({...editData, customer_id: parseInt(customerId)})
    setCustomerSearchTerm('')
    setShowCustomerDropdown(false)
  }

  // Handle customer search input change
  const handleCustomerSearchChange = (value) => {
    setCustomerSearchTerm(value)
    setShowCustomerDropdown(true)
    
    // If user is actively typing (searching), clear the current selection
    if (value.trim() !== '') {
      setEditData({...editData, customer_id: null})
    }
  }

  // Handle customer input key down events
  const handleCustomerKeyDown = (e) => {
    if (e.key === 'Backspace' || e.key === 'Delete') {
      // If user presses backspace/delete and there's a selected value, clear it
      if (editData.customer_id && customerSearchTerm === '') {
        setEditData({...editData, customer_id: null})
        setCustomerSearchTerm('')
      }
    }
  }

  // Handle click outside for customer dropdown
  const handleCustomerClickOutside = (e) => {
    if (showCustomerDropdown && !e.target.closest('.customer-dropdown-container')) {
      setShowCustomerDropdown(false)
    }
  }

  // Add click outside listener for customer dropdown
  useEffect(() => {
    if (showCustomerDropdown) {
      document.addEventListener('click', handleCustomerClickOutside)
      return () => document.removeEventListener('click', handleCustomerClickOutside)
    }
  }, [showCustomerDropdown])

  // Calculate actual team size from allocated employees (current week, deduplicated)
  const actualTeamSize = getCurrentWeekTeamMembers ? getCurrentWeekTeamMembers(project.id).length : (projectTeamMembers[project.id]?.length || 0)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-lg max-h-[70vh] flex flex-col">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-lg font-semibold">Edit Project</h3>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Project Name</label>
            <input
              type="text"
              value={editData.name}
              onChange={(e) => setEditData({...editData, name: e.target.value})}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              value={editData.description}
              onChange={(e) => setEditData({...editData, description: e.target.value})}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800"
              rows="3"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
            <select
              value={editData.status}
              onChange={(e) => setEditData({...editData, status: e.target.value})}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800"
            >
              <option value="Planning">Planning</option>
              <option value="Active">Active</option>
              <option value="Completed">Completed</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Project Manager</label>
            <SearchableDropdown
              options={[
                { value: '', label: 'Select Project Manager' },
                ...(Array.isArray(employees) ? employees
                  .filter(employee => {
                    // Filter to show only active employees
                    return (employee.employee_status || 'Active') === 'Active'
                  })
                  .map(employee => ({
                    value: employee.id,
                    label: `${employee.first_name || ''} ${employee.last_name || ''} - ${employee.designation || 'N/A'}`
                  })) : [])
              ]}
              value={editData.project_manager_id || ''}
              onChange={(value) => setEditData({...editData, project_manager_id: value ? parseInt(value) : null})}
              placeholder="Search for project manager..."
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Project Type</label>
            <select
              value={editData.project_type || ''}
              onChange={(e) => setEditData({...editData, project_type: e.target.value, custom_project_type: '', customer_id: null})}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800"
            >
              <option value="">Select Project Type</option>
              <option value="Customer Projects">Customer Projects</option>
              <option value="POC">POC</option>
              <option value="Demo">Demo</option>
              <option value="Capability">Capability</option>
              <option value="Internal">Internal</option>
            </select>
          </div>
          {editData.project_type === 'Customer Projects' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Customer Name <span className="text-red-500">*</span>
                </label>
                <div className="relative customer-dropdown-container">
                  <input
                    type="text"
                    value={customerSearchTerm !== '' ? customerSearchTerm : (editData.customer_id ? getCustomerName(editData.customer_id) : '')}
                    onChange={(e) => handleCustomerSearchChange(e.target.value)}
                    onKeyDown={handleCustomerKeyDown}
                    onFocus={() => setShowCustomerDropdown(true)}
                    placeholder="Search customers..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  />
                  {showCustomerDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 hover:scrollbar-thumb-gray-400">
                      {getFilteredCustomers().length > 0 ? (
                        getFilteredCustomers().map(customer => (
                          <button
                            key={customer.id}
                            type="button"
                            onClick={() => handleCustomerSelect(customer.id)}
                            className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors text-slate-900"
                          >
                            <div className="flex items-center justify-between">
                              <span>{customer.name}</span>
                              <span className="text-sm text-slate-500">{customer.email}</span>
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-slate-500 text-sm">
                          No customers found matching "{customerSearchTerm}"
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Custom Project Type</label>
                <select
                  value={editData.custom_project_type || ''}
                  onChange={(e) => setEditData({...editData, custom_project_type: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800"
                >
                  <option value="">Select Custom Project Type (Optional)</option>
                  <option value="Staff Augmented">Staff Augmented</option>
                  <option value="SOW">SOW</option>
                </select>
              </div>
            </>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Practice</label>
            <SearchableDropdown
              options={[
                { value: '', label: 'Select Practice' },
                ...availablePractices.map(practice => ({
                  value: practice,
                  label: practice
                })),
                { value: 'Others', label: 'Others' }
              ]}
              value={editData.practice || ''}
              onChange={(value) => setEditData({...editData, practice: value})}
              placeholder="Select Practice"
              className="w-full"
            />
            {editData.practice === 'Others' && (
              <input
                type="text"
                value={editData.practice_other || ''}
                onChange={(e) => setEditData({...editData, practice_other: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mt-2"
                placeholder="Enter custom practice name"
              />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
            <select
              value={editData.priority || 'Medium'}
              onChange={(e) => setEditData({...editData, priority: e.target.value})}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800"
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Urgent">Urgent</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
              <input
                type="date"
                value={editData.start_date}
                onChange={(e) => setEditData({...editData, start_date: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
              <input
                type="date"
                value={editData.end_date}
                onChange={(e) => setEditData({...editData, end_date: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Team Size (Auto-calculated)</label>
              <input
                type="number"
                value={getCurrentWeekTeamMembers(project.id).length}
                disabled
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-100 text-slate-600"
              />
              <p className="text-xs text-slate-500 mt-1">Based on allocated employees</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Progress (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={editData.progress_percentage}
                onChange={(e) => setEditData({...editData, progress_percentage: parseInt(e.target.value)})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Total Budget ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={editData.budget || ''}
                onChange={(e) => setEditData({...editData, budget: parseFloat(e.target.value) || ''})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800"
                placeholder="Enter total budget"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Spent Budget ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={editData.spent_budget || ''}
                onChange={(e) => setEditData({...editData, spent_budget: parseFloat(e.target.value) || 0})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800"
                placeholder="Enter spent amount"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Project File</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip,.pdf,.doc,.docx,.txt,.md,.json,.yml,.yaml,.csv,.xls,.xlsx,.ppt,.pptx"
              onChange={handleFileSelect}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
            />
            <p className="text-xs text-slate-500 mb-3">
              Supported formats: PDF, DOC, DOCX, TXT, XLSX, XLS, PPT, PPTX
            </p>
            
            {/* File List - Shows existing file (if not deleted) and newly selected file */}
            <div className="space-y-2">
              {/* Existing file from DB (if exists and not marked for deletion) */}
              {project.project_files && !filesToDelete && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <svg className="w-5 h-5 text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                      </svg>
                      <span className="text-sm text-slate-700 truncate" title={project.project_files}>
                        {project.project_files.split('/').pop() || project.project_files}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={handleDeleteExistingFile}
                        className="text-red-600 hover:text-red-800 transition-colors"
                        title="Delete file (will be saved when you click Save Changes)"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Newly selected file */}
              {selectedFile && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <svg className="w-5 h-5 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                      </svg>
                      <span className="text-sm text-blue-700 truncate" title={selectedFile.name}>
                        {selectedFile.name}
                      </span>
                      <span className="text-xs text-blue-500">(New)</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={handleDeleteSelectedFile}
                        className="text-red-600 hover:text-red-800 transition-colors"
                        title="Remove selected file"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Show message if file will be deleted */}
              {filesToDelete && !selectedFile && (
                <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                  File will be deleted when you save changes
                </div>
              )}
            </div>
          </div>
          </div>
        </div>
        <div className="p-6 border-t border-slate-200">
          <div className="flex justify-end space-x-3">
            <button
              onClick={onCancel}
              disabled={updatingProject}
              className="px-4 py-2 text-slate-600 hover:text-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={updatingProject}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {updatingProject ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Project Employees Modal Component
const ProjectEmployeesModal = ({ project, employees, onClose }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'Active':
        return 'bg-green-100 text-green-800'
      case 'Planning':
        return 'bg-yellow-100 text-yellow-800'
      case 'Completed':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">{project.name}</h3>
            <div className="text-slate-600 mt-1">
              {formatDescription(project.description)}
            </div>
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

        <div className="mb-4">
          <h4 className="text-lg font-medium text-slate-900 mb-2">Team Members ({employees.length})</h4>
        </div>

        {employees.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Employee
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Allocation
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {employees.map((employee) => (
                  <tr key={employee.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-slate-900">
                          {employee.employee_name}
                        </div>
                        <div className="text-sm text-slate-500">
                          {employee.employee_employee_id}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {employee.role}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-16 bg-slate-200 rounded-full h-2 mr-2">
                          <div 
                            className="bg-green-700 h-2 rounded-full" 
                            style={{ width: `${employee.allocation_percentage}%` }}
                          ></div>
                        </div>
                        <span className="text-sm text-slate-600">{employee.allocation_percentage}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(employee.status)}`}>
                        {employee.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
            </svg>
            <h3 className="mt-2 text-sm font-medium text-slate-900">No team members</h3>
            <p className="mt-1 text-sm text-slate-500">This project doesn't have any assigned team members yet.</p>
          </div>
        )}

        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

ProjectsTab.displayName = 'ProjectsTab'

export default ProjectsTab
