import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { usePermissions } from '../../context/PermissionContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { useEmployees } from '../../context/EmployeeContext.jsx'
import { useKRAAssignments } from '../../hooks/useKRAAssignments.js'
import { getApiBaseUrl, TOKEN } from '../../utils/constants.js'
import { getCookie } from '../../utils/helpers.js'

const KRAGoalsAndMilestones = ({ initialEmployeeId = null }) => {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const isStandalone = location.pathname === '/goals-milestones'
  const { hasPermission, permissions, refreshPermissions } = usePermissions()
  const { user } = useAuth()
  const { getAllEmployees, loading: employeesLoading } = useEmployees()
  const { getEmployeeAssignments } = useKRAAssignments()
  
  // Function to get username from user ID
  const getUsername = (userId) => {
    if (!userId) return 'Unknown User'
    
    // Check if it's a system comment
    if (userId === 'System') return 'System'
    
    // Check if it's the current user (from JWT payload)
    if (user && (user.sub === userId || user.id === userId || user.email === userId)) {
      return user.name || user.displayName || user.email?.split('@')[0] || 'Current User'
    }
    
    // Try to find user in employees list
    const employee = employees.find(emp => emp.id === parseInt(userId) || emp.email === userId)
    if (employee) {
      return `${employee.first_name} ${employee.last_name}`
    }
    
    // If not found, return the user ID as fallback
    return userId
  }
  
  const employees = getAllEmployees()

  // State management
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState('')
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false)
  const [showAllEmployees, setShowAllEmployees] = useState(false)
  const [employeeAssignments, setEmployeeAssignments] = useState([])
  const [goals, setGoals] = useState([])
  const [milestones, setMilestones] = useState([])
  const [archivedItems, setArchivedItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [currentView, setCurrentView] = useState('live') // 'live' or 'archived'
  
  // Loading states for individual operations
  const [savingGoal, setSavingGoal] = useState(false)
  const [savingMilestone, setSavingMilestone] = useState(false)
  const [deletingGoal, setDeletingGoal] = useState(null) // goal ID being deleted
  const [deletingMilestone, setDeletingMilestone] = useState(null) // milestone ID being deleted
  const [deletingComment, setDeletingComment] = useState(null) // comment ID being deleted
  const [updatingGoalStatus, setUpdatingGoalStatus] = useState(null) // goal ID being updated
  const [archivingItem, setArchivingItem] = useState(null) // item ID being archived
  const [restoringItem, setRestoringItem] = useState(null) // item ID being restored
  const [savingCardDetails, setSavingCardDetails] = useState(false) // saving card details modal
  
  // Modal states
  const [showGoalModal, setShowGoalModal] = useState(false)
  const [showMilestoneModal, setShowMilestoneModal] = useState(false)
  const [showCardDetailModal, setShowCardDetailModal] = useState(false)
  const [selectedCard, setSelectedCard] = useState(null)
  
  // Form states
  const [goalForm, setGoalForm] = useState({
    kra_id: '',
    description: '',
    priority: 'medium',
    weightage: 0,
    start_date: '',
    target_date: ''
  })
  const [milestoneForm, setMilestoneForm] = useState({
    goal_id: '',
    description: '',
    priority: 'medium',
    start_date: '',
    target_date: ''
  })
  const [cardDetail, setCardDetail] = useState({
    description: '',
    status: 'active',
    priority: 'medium',
    start_date: '',
    target_date: '',
    actual_end_date: '',
    rating: 0,
    comments: []
  })
  const [newComment, setNewComment] = useState('')
  const [isAddingComment, setIsAddingComment] = useState(false)
  
  // New state for drag and drop functionality
  const [expandedGoals, setExpandedGoals] = useState(new Set())
  const [milestoneStatuses, setMilestoneStatuses] = useState({})
  const [draggedMilestone, setDraggedMilestone] = useState(null)
  
  const employeeDropdownRef = useRef(null)
  const hasAutoSelectedRef = useRef(false) // Track if we've already auto-selected from URL
  const isDraggingRef = useRef(false) // Track if a drag operation is in progress
  const [hierarchyEmployeeIds, setHierarchyEmployeeIds] = useState(new Set()) // Employee IDs in current user's hierarchy
  const [projectTeamEmployeeIds, setProjectTeamEmployeeIds] = useState(new Set()) // Employee IDs from projects where user is PM
  const [hierarchyLoading, setHierarchyLoading] = useState(false)

  // Get current user's employee ID from email
  const getCurrentUserEmployeeId = useMemo(() => {
    if (!user?.email) return null
    const employee = employees.find(emp => emp.email === user.email)
    return employee?.id || null
  }, [user?.email, employees])

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

  // Filter employees based on hierarchy permission
  const filteredEmployees = useMemo(() => {
    let filtered = employees
    
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
        filtered = filtered.filter(emp => {
          return allowedEmployeeIds.has(emp.id)
        })
      } else {
        // If neither hierarchy nor project teams are loaded yet and user doesn't have view-all permission,
        // show empty list (will show loading state)
        filtered = []
      }
    }
    
    // Filter to show only active employees
    filtered = filtered.filter(emp => {
      return (emp.employee_status || 'Active') === 'Active'
    })
    
    return filtered
  }, [employees, hasPermission, hierarchyEmployeeIds, projectTeamEmployeeIds])

  // Filter employees for search dropdown
  const searchableEmployees = useMemo(() => {
    const hasViewAllPermission = hasPermission('view-all-kra-list')
    
    if (!employeeSearchTerm.trim()) {
      // Show all employees if user has permission, otherwise show first 20 or all if showAllEmployees is true
      if (hasViewAllPermission) {
        return filteredEmployees
      }
      return showAllEmployees ? filteredEmployees : filteredEmployees.slice(0, 20)
    }
    
    // When searching, filter through all employees
    const filtered = filteredEmployees.filter(emp => {
      const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase()
      const email = emp.email?.toLowerCase() || ''
      const department = emp.department?.toLowerCase() || ''
      const designation = emp.designation?.toLowerCase() || ''
      const searchLower = employeeSearchTerm.toLowerCase()
      
      return fullName.includes(searchLower) || 
             email.includes(searchLower) || 
             department.includes(searchLower) || 
             designation.includes(searchLower)
    })
    
    // Show all results if user has permission, otherwise limit to 20
    return hasViewAllPermission ? filtered : filtered.slice(0, 20)
  }, [filteredEmployees, employeeSearchTerm, showAllEmployees, hasPermission])

  // Auto-select employee if initialEmployeeId is provided (only once on mount)
  useEffect(() => {
    if (initialEmployeeId && employees.length > 0 && !hasAutoSelectedRef.current && !selectedEmployee) {
      const employee = employees.find(emp => emp.id === parseInt(initialEmployeeId))
      if (employee) {
        setSelectedEmployee(employee)
        setEmployeeSearchTerm(`${employee.first_name} ${employee.last_name}`)
        setShowEmployeeDropdown(false)
        hasAutoSelectedRef.current = true // Mark as auto-selected
      }
    }
  }, [initialEmployeeId, employees, selectedEmployee])

  // Sync employee selection with URL parameter changes (for browser back/forward navigation)
  // This runs after initial auto-selection to handle URL changes
  useEffect(() => {
    if (isStandalone && employees.length > 0 && hasAutoSelectedRef.current) {
      const urlEmployeeId = searchParams.get('employee_id')
      const currentEmployeeId = selectedEmployee?.id?.toString()
      
      // Only update if URL parameter differs from current selection (avoid loops)
      if (urlEmployeeId && urlEmployeeId !== currentEmployeeId) {
        const employee = employees.find(emp => emp.id === parseInt(urlEmployeeId))
        if (employee && employee.id !== selectedEmployee?.id) {
          setSelectedEmployee(employee)
          setEmployeeSearchTerm(`${employee.first_name} ${employee.last_name}`)
          setShowEmployeeDropdown(false)
        }
      } else if (!urlEmployeeId && selectedEmployee) {
        // URL parameter was removed, clear selection
        setSelectedEmployee(null)
        setEmployeeSearchTerm('')
        setEmployeeAssignments([])
        setGoals([])
        setMilestones([])
        setArchivedItems([])
      }
    }
  }, [searchParams, isStandalone, employees, selectedEmployee])

  // Load employee assignments when employee is selected
  useEffect(() => {
    if (selectedEmployee) {
      loadEmployeeData(selectedEmployee.id)
    }
  }, [selectedEmployee])

  // Fetch user hierarchy and project team when component mounts or when employee ID changes
  useEffect(() => {
    const employeeId = getCurrentUserEmployeeId
    const canViewAll = hasPermission('view-all-kra-list')
    
    // Fetch hierarchy and project team if employee ID is available and user doesn't have view-all permission
    if (employeeId && !canViewAll) {
      fetchUserHierarchy(employeeId)
    } else {
      // If user has view-all permission, clear filters (show all)
      setHierarchyEmployeeIds(new Set())
      setProjectTeamEmployeeIds(new Set())
    }
  }, [getCurrentUserEmployeeId, fetchUserHierarchy, hasPermission, user?.email])

  // Handle click outside to close employee dropdown
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

  const loadEmployeeData = async (employeeId) => {
    setLoading(true)
    
    // Check permissions first
    console.log('User permissions:', permissions)
    console.log('Has kra-goals-view permission:', hasPermission('kra-goals-view'))
    
    try {
      // Load employee assignments
      const assignmentsResult = await getEmployeeAssignments(employeeId)
      if (assignmentsResult.success) {
        setEmployeeAssignments(assignmentsResult.data.data?.assignments || [])
      }
      
      // Load goals for the employee
      const token = getCookie(TOKEN)
      const goalsUrl = `${getApiBaseUrl()}/api/goals?employee_id=${employeeId}`
      console.log('Fetching goals from:', goalsUrl)
      console.log('Token exists:', !!token)
      
      // Check if user has permission to view goals
      if (!hasPermission('kra-goals-view')) {
        console.warn('User does not have kra-goals-view permission')
        console.log('Available permissions:', permissions)
        
        // Try to refresh permissions in case they weren't loaded properly
        if (permissions.length === 0) {
          console.log('No permissions loaded, attempting to refresh...')
          try {
            await refreshPermissions()
            if (hasPermission('kra-goals-view')) {
              console.log('Permissions refreshed, retrying...')
              // Continue with the API call
            } else {
              setError('You do not have permission to view goals. Please contact your administrator.')
              setLoading(false)
              return
            }
          } catch (refreshError) {
            console.error('Failed to refresh permissions:', refreshError)
            setError('Failed to load permissions. Please refresh the page and try again.')
            setLoading(false)
            return
          }
        } else {
          setError('You do not have permission to view goals. Please contact your administrator.')
          setLoading(false)
          return
        }
      }
      
      const goalsResponse = await fetch(goalsUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      console.log('Goals response status:', goalsResponse.status)
      
      if (goalsResponse.ok) {
        const goalsData = await goalsResponse.json()
        console.log('Goals loaded successfully:', goalsData)
        setGoals(goalsData)
        
        // Load milestones for each goal
        const allMilestones = []
        for (const goal of goalsData) {
          const milestonesResponse = await fetch(`${getApiBaseUrl()}/api/milestones?goal_id=${goal.id}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          })
          
          if (milestonesResponse.ok) {
            const milestonesData = await milestonesResponse.json()
            allMilestones.push(...milestonesData)
          } else {
            console.error('Failed to load milestones for goal', goal.id, ':', milestonesResponse.status, milestonesResponse.statusText)
          }
        }
        
        setMilestones(allMilestones)
        setArchivedItems([])
        
        // Initialize milestone statuses
        const initialStatuses = {}
        allMilestones.forEach(milestone => {
          initialStatuses[milestone.id] = milestone.status || 'milestones'
        })
        setMilestoneStatuses(initialStatuses)
      } else {
        const errorText = await goalsResponse.text()
        console.error('Failed to load goals:', {
          status: goalsResponse.status,
          statusText: goalsResponse.statusText,
          response: errorText
        })
        setError(`Failed to load goals: ${goalsResponse.status} ${goalsResponse.statusText}`)
      }
    } catch (err) {
      console.error('Error loading employee data:', err)
      setError('Failed to load employee data')
    } finally {
      setLoading(false)
    }
  }

  const handleEmployeeSelect = (employee) => {
    setSelectedEmployee(employee)
    setEmployeeSearchTerm(`${employee.first_name} ${employee.last_name}`)
    setShowEmployeeDropdown(false)
    
    // Update URL parameter in standalone mode
    if (isStandalone) {
      const newSearchParams = new URLSearchParams(searchParams)
      newSearchParams.set('employee_id', employee.id.toString())
      setSearchParams(newSearchParams, { replace: true })
    }
  }

  const handleEmployeeSearchChange = (value) => {
    setEmployeeSearchTerm(value)
    setShowEmployeeDropdown(true)
    setShowAllEmployees(false)
    if (!value) {
      setSelectedEmployee(null)
      setEmployeeAssignments([])
      setGoals([])
      setMilestones([])
      setArchivedItems([])
      
      // Remove employee_id from URL in standalone mode
      if (isStandalone) {
        const newSearchParams = new URLSearchParams(searchParams)
        newSearchParams.delete('employee_id')
        setSearchParams(newSearchParams, { replace: true })
      }
    }
  }

  const clearEmployeeSelection = () => {
    setSelectedEmployee(null)
    setEmployeeSearchTerm('')
    setShowEmployeeDropdown(false)
    setShowAllEmployees(false)
    setEmployeeAssignments([])
    setGoals([])
    setMilestones([])
    setArchivedItems([])
    
    // Remove employee_id from URL in standalone mode
    if (isStandalone) {
      const newSearchParams = new URLSearchParams(searchParams)
      newSearchParams.delete('employee_id')
      setSearchParams(newSearchParams, { replace: true })
    }
  }

  const handleAddGoal = () => {
    if (!selectedEmployee) {
      alert('Please select an employee first.')
      return
    }
    setShowGoalModal(true)
  }

  const handleAddMilestone = () => {
    if (!selectedEmployee) {
      alert('Please select an employee first.')
      return
    }
    if (goals.length === 0) {
      alert('Please add a goal first before adding milestones.')
      return
    }
    setShowMilestoneModal(true)
  }

  const handleSaveGoal = async () => {
    if (savingGoal) return // Prevent multiple clicks
    
    // Validate required fields
    if (!goalForm.kra_id) {
      setError('Please select a KRA')
      return
    }
    if (!goalForm.description.trim()) {
      setError('Please enter a goal description')
      return
    }
    if (!goalForm.start_date) {
      setError('Please select a start date')
      return
    }
    if (!goalForm.target_date) {
      setError('Please select a target date')
      return
    }
    if (!goalForm.weightage || goalForm.weightage === 0) {
      setError('Please select a weightage')
      return
    }
    
    setSavingGoal(true)
    try {
      const token = getCookie(TOKEN)
      const response = await fetch(`${getApiBaseUrl()}/api/goals`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          employee_id: selectedEmployee.id,
          kra_id: goalForm.kra_id,
          description: goalForm.description,
          priority: goalForm.priority,
          weightage: goalForm.weightage,
          start_date: goalForm.start_date,
          target_date: goalForm.target_date,
          status: 'backlog'
        })
      })
      
      if (response.ok) {
        const newGoal = await response.json()
        setGoals(prev => [...prev, newGoal])
        setShowGoalModal(false)
        setError(null)
        setGoalForm({
          kra_id: '',
          description: '',
          priority: 'medium',
          weightage: 0,
          start_date: '',
          target_date: ''
        })
        
        // Initialize milestone statuses for the new goal
        setMilestoneStatuses(prev => ({
          ...prev,
          [newGoal.id]: 'milestones'
        }))
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to save goal')
      }
    } catch (error) {
      console.error('Error saving goal:', error)
      setError('Failed to save goal')
    } finally {
      setSavingGoal(false)
    }
  }

  const handleSaveMilestone = async () => {
    if (savingMilestone) return // Prevent multiple clicks
    
    // Validate required fields
    if (!milestoneForm.goal_id) {
      setError('Please select a goal')
      return
    }
    if (!milestoneForm.description.trim()) {
      setError('Please enter a milestone description')
      return
    }
    if (!milestoneForm.start_date) {
      setError('Please select a start date')
      return
    }
    if (!milestoneForm.target_date) {
      setError('Please select a target date')
      return
    }
    
    setSavingMilestone(true)
    try {
      const token = getCookie(TOKEN)
      const response = await fetch(`${getApiBaseUrl()}/api/milestones`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          goal_id: parseInt(milestoneForm.goal_id),
          description: milestoneForm.description,
          priority: milestoneForm.priority,
          start_date: milestoneForm.start_date,
          target_date: milestoneForm.target_date,
          status: 'this_weeks_plan'
        })
      })
      
      if (response.ok) {
        const newMilestone = await response.json()
        setMilestones(prev => [...prev, newMilestone])
        
        setShowMilestoneModal(false)
        setError(null)
        setMilestoneForm({
          goal_id: '',
          description: '',
          priority: 'medium',
          start_date: '',
          target_date: ''
        })
        
        // Initialize milestone status
        setMilestoneStatuses(prev => ({
          ...prev,
          [newMilestone.id]: 'milestones'
        }))
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to save milestone')
      }
    } catch (error) {
      console.error('Error saving milestone:', error)
      setError('Failed to save milestone')
    } finally {
      setSavingMilestone(false)
    }
  }

  const handleCardClick = (card) => {
    console.log('Card clicked:', card)
    setSelectedCard(card)
    setCardDetail({
      description: card.description || '',
      status: card.status || 'active',
      priority: card.priority || 'medium',
      start_date: card.start_date || '',
      target_date: card.target_date || '',
      actual_end_date: card.actual_end_date || '',
      rating: card.rating || 0,
      comments: card.comments || [],
      error: null
    })
    setNewComment('')
    setShowCardDetailModal(true)
    console.log('Modal should open now')
  }

  const handleAddComment = async () => {
    if (!newComment.trim()) return
    
    setIsAddingComment(true)
    try {
      const token = getCookie(TOKEN)
      const response = await fetch(`${getApiBaseUrl()}/api/comments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          goal_id: selectedCard.type === 'goal' ? selectedCard.id : null,
          milestone_id: selectedCard.type === 'milestone' ? selectedCard.id : null,
          comment_text: newComment.trim()
        })
      })
      
      if (response.ok) {
        const comment = await response.json()
        
        // Add comment to the appropriate data structure
        if (selectedCard.type === 'goal') {
          setGoals(prev => prev.map(goal => 
            goal.id === selectedCard.id 
              ? { ...goal, comments: [...(goal.comments || []), comment] }
              : goal
          ))
        } else if (selectedCard.type === 'milestone') {
          setMilestones(prev => prev.map(milestone => 
            milestone.id === selectedCard.id 
              ? { ...milestone, comments: [...(milestone.comments || []), comment] }
              : milestone
          ))
        }
        
        // Update card detail and clear any errors
        setCardDetail(prev => ({
          ...prev,
          comments: [...prev.comments, comment],
          error: null
        }))
        
        // Update selected card
        setSelectedCard(prev => ({
          ...prev,
          comments: [...(prev.comments || []), comment]
        }))
        
        setNewComment('')
      } else {
        const errorData = await response.json()
        setCardDetail(prev => ({
          ...prev,
          error: errorData.error || 'Failed to add comment'
        }))
      }
    } catch (error) {
      console.error('Error adding comment:', error)
      setCardDetail(prev => ({
        ...prev,
        error: 'Failed to add comment'
      }))
    } finally {
      setIsAddingComment(false)
    }
  }

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

  const handleDeleteGoal = async (goalId) => {
    if (!hasPermission('kra-goals-delete')) {
      alert('You do not have permission to delete goals.')
      return
    }
    
    if (deletingGoal === goalId) return // Prevent multiple clicks
    
    if (window.confirm('Are you sure you want to delete this goal? This will also delete all associated milestones.')) {
      setDeletingGoal(goalId)
      try {
        const token = getCookie(TOKEN)
        const response = await fetch(`${getApiBaseUrl()}/api/goals/${goalId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })
        
        if (response.ok) {
          setGoals(prev => prev.filter(g => g.id !== goalId))
          setMilestones(prev => prev.filter(m => m.goal_id !== goalId))
          console.log('Goal deleted:', goalId)
        } else {
          const errorData = await response.json()
          setError(errorData.error || 'Failed to delete goal')
        }
      } catch (error) {
        console.error('Error deleting goal:', error)
        setError('Failed to delete goal')
      } finally {
        setDeletingGoal(null)
      }
    }
  }

  const handleGoalStatusChange = async (goalId, newStatus) => {
    if (!hasPermission('kra-goals-edit')) {
      alert('You do not have permission to edit goals.')
      return
    }

    setUpdatingGoalStatus(goalId)
    try {
      const token = getCookie(TOKEN)
      const response = await fetch(`${getApiBaseUrl()}/api/goals/${goalId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: newStatus
        })
      })
      
      if (response.ok) {
        setGoals(prev => prev.map(goal => 
          goal.id === goalId ? { ...goal, status: newStatus } : goal
        ))
        console.log('Goal status updated:', goalId, newStatus)
        
        // Auto-open the goal popup when status is changed to completed
        if (newStatus === 'completed') {
          const updatedGoal = goals.find(g => g.id === goalId)
          if (updatedGoal) {
            setSelectedCard({...updatedGoal, type: 'goal', status: newStatus})
            setCardDetail({
              ...updatedGoal,
              status: newStatus,
              rating: updatedGoal.rating || 0
            })
            setShowCardDetailModal(true)
          }
        }
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to update goal status')
      }
    } catch (error) {
      console.error('Error updating goal status:', error)
      setError('Failed to update goal status')
    } finally {
      setUpdatingGoalStatus(null)
    }
  }

  const handleGoalRatingChange = async (goalId, rating) => {
    if (!hasPermission('kra-goals-edit')) {
      alert('You do not have permission to edit goals.')
      return
    }

    try {
      const token = getCookie(TOKEN)
      const response = await fetch(`${getApiBaseUrl()}/api/goals/${goalId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          rating: rating
        })
      })
      
      if (response.ok) {
        const updatedGoal = await response.json()
        setGoals(prev => prev.map(goal => 
          goal.id === goalId ? { ...goal, rating: updatedGoal.rating, rating_given_by: updatedGoal.rating_given_by } : goal
        ))
        console.log('Goal rating updated:', goalId, rating, 'by', updatedGoal.rating_given_by)
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to update goal rating')
      }
    } catch (error) {
      console.error('Error updating goal rating:', error)
      setError('Failed to update goal rating')
    }
  }

  const handleDeleteMilestone = async (milestoneId) => {
    if (!hasPermission('kra-milestones-delete')) {
      alert('You do not have permission to delete milestones.')
      return
    }
    
    if (deletingMilestone === milestoneId) return // Prevent multiple clicks
    
    if (window.confirm('Are you sure you want to delete this milestone?')) {
      setDeletingMilestone(milestoneId)
      try {
        const token = getCookie(TOKEN)
        const response = await fetch(`${getApiBaseUrl()}/api/milestones/${milestoneId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })
        
        if (response.ok) {
          setMilestones(prev => prev.filter(m => m.id !== milestoneId))
          console.log('Milestone deleted:', milestoneId)
        } else {
          const errorData = await response.json()
          setError(errorData.error || 'Failed to delete milestone')
        }
      } catch (error) {
        console.error('Error deleting milestone:', error)
        setError('Failed to delete milestone')
      } finally {
        setDeletingMilestone(null)
      }
    }
  }

  const handleDeleteComment = async (commentId) => {
    if (!hasPermission('kra-comments-delete')) {
      alert('You do not have permission to delete comments.')
      return
    }
    
    if (deletingComment === commentId) return // Prevent multiple clicks
    
    if (window.confirm('Are you sure you want to delete this comment?')) {
      setDeletingComment(commentId)
      try {
        const token = getCookie(TOKEN)
        const response = await fetch(`${getApiBaseUrl()}/api/comments/${commentId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })
        
        if (response.ok) {
          // Update the selected card's comments
          if (selectedCard) {
            const currentComments = selectedCard.comments || []
            const updatedComments = currentComments.filter(c => c.id !== commentId)
            setSelectedCard(prev => ({ ...prev, comments: updatedComments }))
            
            // Update card detail
            setCardDetail(prev => ({
              ...prev,
              comments: updatedComments
            }))
            
            // Update the main data arrays
            if (selectedCard.type === 'goal') {
              setGoals(prev => prev.map(goal => 
                goal.id === selectedCard.id 
                  ? { ...goal, comments: updatedComments }
                  : goal
              ))
            } else if (selectedCard.type === 'milestone') {
              setMilestones(prev => prev.map(milestone => 
                milestone.id === selectedCard.id 
                  ? { ...milestone, comments: updatedComments }
                  : milestone
              ))
            }
          }
          console.log('Comment deleted:', commentId)
        } else {
          const errorData = await response.json()
          setCardDetail(prev => ({
            ...prev,
            error: errorData.error || 'Failed to delete comment'
          }))
        }
      } catch (error) {
        console.error('Error deleting comment:', error)
        setCardDetail(prev => ({
          ...prev,
          error: 'Failed to delete comment'
        }))
      } finally {
        setDeletingComment(null)
      }
    }
  }

  const handleArchiveCard = async (card) => {
    setArchivingItem(card.id)
    try {
      const token = getCookie(TOKEN)
      let response
      
      if (card.type === 'goal') {
        response = await fetch(`${getApiBaseUrl()}/api/goals/${card.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            live_or_archived: 'archived'
          })
        })
      } else if (card.type === 'milestone') {
        response = await fetch(`${getApiBaseUrl()}/api/milestones/${card.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            live_or_archived: 'archived'
          })
        })
      }

      if (response && response.ok) {
        console.log('Item archived successfully:', card.id)
        
        // Reload data to ensure consistency
        if (selectedEmployee) {
          await loadEmployeeData(selectedEmployee.id)
        }
        
        setShowCardDetailModal(false)
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to archive item')
      }
    } catch (error) {
      console.error('Error archiving card:', error)
      setError('Failed to archive item')
    } finally {
      setArchivingItem(null)
    }
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200'
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low': return 'bg-green-100 text-green-800 border-green-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-200'
      case 'in_progress': return 'bg-green-100 text-green-800 border-green-200'
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200'
      case 'backlog': return 'bg-gray-100 text-gray-800 border-gray-200'
      case 'on_hold': return 'bg-orange-100 text-orange-800 border-orange-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const goalStatusOptions = [
    { value: 'backlog', label: 'Backlog' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'on_hold', label: 'On Hold' },
    { value: 'cancelled', label: 'Cancelled' }
  ]

  // Star Rating Component
  const StarRating = ({ rating, onRatingChange, disabled = false }) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => !disabled && onRatingChange(star)}
            disabled={disabled}
            className={`text-3xl transition-colors ${
              star <= rating
                ? 'text-yellow-400 hover:text-yellow-500'
                : 'text-gray-300 hover:text-yellow-400'
            } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
          >
            ★
          </button>
        ))}
        {rating > 0 && (
          <span className="ml-2 text-sm text-slate-600">
            {rating} star{rating !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    )
  }

  // Drag and drop functionality
  const toggleGoalExpansion = (goalId) => {
    setExpandedGoals(prev => {
      const newSet = new Set(prev)
      if (newSet.has(goalId)) {
        newSet.delete(goalId)
      } else {
        newSet.add(goalId)
      }
      return newSet
    })
  }

  const handleDragStart = (e, milestone) => {
    // Check if the drag is starting from an interactive element (button, input, etc.)
    const target = e.target
    
    // If the event was already stopped (by a button's onDragStart), don't proceed
    if (e.defaultPrevented) {
      return
    }
    
    // Check if clicking directly on or inside an interactive element
    const isInteractiveElement = target.tagName === 'BUTTON' || 
                                 target.tagName === 'INPUT' || 
                                 target.tagName === 'SELECT' || 
                                 target.tagName === 'A' ||
                                 target.closest('button') || 
                                 target.closest('input') || 
                                 target.closest('select') || 
                                 target.closest('a') ||
                                 target.closest('[role="button"]')
    
    // If clicking on an interactive element, don't start drag
    if (isInteractiveElement) {
      e.preventDefault()
      return
    }
    
    isDraggingRef.current = true
    setDraggedMilestone(milestone)
    e.dataTransfer.effectAllowed = 'move'
    
    // Set opacity on the card element
    const card = e.currentTarget
    if (card) {
      card.style.opacity = '0.5'
    }
  }
  
  const handleDragEnd = (e) => {
    // Restore opacity on the card element
    const card = e.currentTarget
    if (card) {
      card.style.opacity = '1'
    }
    // Reset drag flag after a short delay to allow click handler to check it
    setTimeout(() => {
      isDraggingRef.current = false
    }, 100)
    setDraggedMilestone(null)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = async (e, newStatus) => {
    e.preventDefault()
    if (draggedMilestone) {
      // Update frontend state immediately for better UX
      setMilestoneStatuses(prev => ({
        ...prev,
        [draggedMilestone.id]: newStatus
      }))
      
      // Update milestone status in the milestones array
      setMilestones(prev => prev.map(milestone => 
        milestone.id === draggedMilestone.id 
          ? { ...milestone, status: newStatus }
          : milestone
      ))

      // Save to database
      try {
        const token = getCookie(TOKEN)
        const response = await fetch(`${getApiBaseUrl()}/api/milestones/${draggedMilestone.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            status: newStatus
          })
        })

        if (!response.ok) {
          const errorData = await response.json()
          console.error('Failed to update milestone status:', errorData.error)
          setError(`Failed to update milestone status: ${errorData.error}`)
          
          // Revert frontend state on error
          setMilestoneStatuses(prev => ({
            ...prev,
            [draggedMilestone.id]: draggedMilestone.status || 'milestones'
          }))
          
          setMilestones(prev => prev.map(milestone => 
            milestone.id === draggedMilestone.id 
              ? { ...milestone, status: draggedMilestone.status || 'milestones' }
              : milestone
          ))
        } else {
          console.log('Milestone status updated successfully:', draggedMilestone.id, newStatus)
        }
      } catch (error) {
        console.error('Error updating milestone status:', error)
        setError('Failed to update milestone status')
        
        // Revert frontend state on error
        setMilestoneStatuses(prev => ({
          ...prev,
          [draggedMilestone.id]: draggedMilestone.status || 'milestones'
        }))
        
        setMilestones(prev => prev.map(milestone => 
          milestone.id === draggedMilestone.id 
            ? { ...milestone, status: draggedMilestone.status || 'milestones' }
            : milestone
        ))
      }
    }
    setDraggedMilestone(null)
  }

  const handleMilestoneStatusChange = async (milestoneId, newStatus) => {
    if (!hasPermission('kra-milestones-edit')) {
      alert('You do not have permission to edit milestones.')
      return
    }

    const milestone = milestones.find(m => m.id === milestoneId)
    if (!milestone) return

    // Update frontend state immediately for better UX
    setMilestoneStatuses(prev => ({
      ...prev,
      [milestoneId]: newStatus
    }))
    
    // Update milestone status in the milestones array
    setMilestones(prev => prev.map(m => 
      m.id === milestoneId ? { ...m, status: newStatus } : m
    ))

    // Update selectedCard and cardDetail if they match
    if (selectedCard && selectedCard.id === milestoneId) {
      setSelectedCard(prev => ({ ...prev, status: newStatus }))
      setCardDetail(prev => ({ ...prev, status: newStatus }))
    }

    // Save to database
    try {
      const token = getCookie(TOKEN)
      const response = await fetch(`${getApiBaseUrl()}/api/milestones/${milestoneId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: newStatus
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('Failed to update milestone status:', errorData.error)
        setError(`Failed to update milestone status: ${errorData.error}`)
        
        // Revert frontend state on error
        setMilestoneStatuses(prev => ({
          ...prev,
          [milestoneId]: milestone.status || 'milestones'
        }))
        
        setMilestones(prev => prev.map(m => 
          m.id === milestoneId 
            ? { ...m, status: milestone.status || 'milestones' }
            : m
        ))
      } else {
        console.log('Milestone status updated successfully:', milestoneId, newStatus)
      }
    } catch (error) {
      console.error('Error updating milestone status:', error)
      setError('Failed to update milestone status')
      
      // Revert frontend state on error
      setMilestoneStatuses(prev => ({
        ...prev,
        [milestoneId]: milestone.status || 'milestones'
      }))
      
      setMilestones(prev => prev.map(m => 
        m.id === milestoneId 
          ? { ...m, status: milestone.status || 'milestones' }
          : m
      ))
    }
  }

  const getMilestonesForGoal = (goalId) => {
    return getFilteredMilestones().filter(milestone => milestone.goal_id == goalId) // Use == instead of === to handle type coercion
  }

  // Filter goals and milestones based on current view (live/archived)
  const getFilteredGoals = () => {
    if (currentView === 'archived') {
      return goals.filter(goal => goal.live_or_archived === 'archived')
    }
    return goals.filter(goal => goal.live_or_archived === 'live')
  }

  const getFilteredMilestones = () => {
    if (currentView === 'archived') {
      return milestones.filter(milestone => milestone.live_or_archived === 'archived')
    }
    return milestones.filter(milestone => milestone.live_or_archived === 'live')
  }


  // Restore archived item back to live status
  const handleRestoreItem = async (item) => {
    // Prevent multiple clicks
    if (restoringItem === item.id) {
      console.log('Already restoring item:', item.id)
      return
    }
    
    console.log('Starting restore for item:', item.id, item.type)
    setRestoringItem(item.id)
    try {
      const token = getCookie(TOKEN)
      let response
      
      if (item.type === 'goal') {
        response = await fetch(`${getApiBaseUrl()}/api/goals/${item.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            live_or_archived: 'live' // Restore to live status
          })
        })
      } else if (item.type === 'milestone') {
        response = await fetch(`${getApiBaseUrl()}/api/milestones/${item.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            live_or_archived: 'live' // Restore to live status
          })
        })
      }

      if (response && response.ok) {
        console.log('Item restored to live status:', item.id)
        
        // Reload data to ensure consistency
        if (selectedEmployee) {
          await loadEmployeeData(selectedEmployee.id)
        }
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to restore item')
      }
    } catch (error) {
      console.error('Error restoring item:', error)
      setError('Failed to restore item')
    } finally {
      console.log('Restore operation completed for item:', item.id)
      setRestoringItem(null)
    }
  }

  const handleSaveCardDetails = async () => {
    if (!selectedCard || savingCardDetails) return
    
    setSavingCardDetails(true)
    try {
      const token = getCookie(TOKEN)
      let response
      
      if (selectedCard.type === 'goal') {
        response = await fetch(`${getApiBaseUrl()}/api/goals/${selectedCard.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            description: cardDetail.description,
            priority: cardDetail.priority,
            start_date: cardDetail.start_date,
            target_date: cardDetail.target_date,
            actual_end_date: cardDetail.actual_end_date || null
          })
        })
      } else if (selectedCard.type === 'milestone') {
        response = await fetch(`${getApiBaseUrl()}/api/milestones/${selectedCard.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            description: cardDetail.description,
            priority: cardDetail.priority,
            start_date: cardDetail.start_date,
            target_date: cardDetail.target_date,
            actual_end_date: cardDetail.actual_end_date || null
          })
        })
      }

      if (response && response.ok) {
        const updatedItem = await response.json()
        
        // Update the main data arrays
        if (selectedCard.type === 'goal') {
          setGoals(prev => prev.map(goal => 
            goal.id === selectedCard.id 
              ? { ...goal, ...updatedItem }
              : goal
          ))
        } else if (selectedCard.type === 'milestone') {
          setMilestones(prev => prev.map(milestone => 
            milestone.id === selectedCard.id 
              ? { ...milestone, ...updatedItem }
              : milestone
          ))
        }
        
        // Update selected card
        setSelectedCard(prev => ({ ...prev, ...updatedItem }))
        
        // Update card detail
        setCardDetail(prev => ({ ...prev, ...updatedItem, error: null }))
        
        console.log('Card details saved successfully:', selectedCard.id)
        
        // Close the modal
        setShowCardDetailModal(false)
      } else {
        const errorData = await response.json()
        setCardDetail(prev => ({
          ...prev,
          error: errorData.error || 'Failed to save changes'
        }))
      }
    } catch (error) {
      console.error('Error saving card details:', error)
      setCardDetail(prev => ({
        ...prev,
        error: 'Failed to save changes'
      }))
    } finally {
      setSavingCardDetails(false)
    }
  }

  const getMilestonesByStatus = (goalId, status) => {
    const goalMilestones = getMilestonesForGoal(goalId)
    const filteredMilestones = goalMilestones.filter(milestone => {
      // Check if milestone has a custom status in milestoneStatuses, otherwise use 'milestones' as default
      const currentStatus = milestoneStatuses[milestone.id] || 'milestones'
      return currentStatus === status
    })
    
    
    return filteredMilestones
  }

  const getStatusColumns = () => [
    { key: 'milestones', label: 'MILESTONES', color: 'bg-slate-100' },
    { key: 'this_weeks_plan', label: "THIS WEEK'S PLAN", color: 'bg-green-100' },
    { key: 'wip', label: 'WIP', color: 'bg-yellow-100' },
    { key: 'blocked', label: 'BLOCKED', color: 'bg-red-100' },
    { key: 'done', label: 'DONE', color: 'bg-green-100' }
  ]

  if (!hasPermission('kra-goals-view')) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
        <h2 className="text-xl font-bold text-slate-900 mb-2">Access Denied</h2>
        <p className="text-slate-600">You don't have permission to view KRA Goals and Milestones.</p>
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
            <div className="flex items-center gap-2">
              {error.includes('permission') && (
                <button
                  onClick={async () => {
                    try {
                      await refreshPermissions()
                      setError(null)
                      if (selectedEmployee) {
                        loadEmployeeData(selectedEmployee.id)
                      }
                    } catch (err) {
                      console.error('Failed to refresh permissions:', err)
                    }
                  }}
                  className="px-3 py-1 text-sm bg-green-800 text-white rounded hover:bg-green-900"
                >
                  Refresh Permissions
                </button>
              )}
              <button
                onClick={() => setError(null)}
                className="text-red-600 hover:text-red-800 transition-colors"
                title="Dismiss error"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Action Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Employee Selection */}
            <div className="w-64 relative" ref={employeeDropdownRef}>
              <div className="relative">
                <input
                  type="text"
                  value={employeeSearchTerm}
                  onChange={(e) => handleEmployeeSearchChange(e.target.value)}
                  onFocus={() => setShowEmployeeDropdown(true)}
                  placeholder="Search employees..."
                  className="block w-full px-3 py-2 pr-8 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-green-800 focus:border-green-800"
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
                  style={{ paddingRight: '4px' }}
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
                      {!hasPermission('view-all-kra-list') && hierarchyEmployeeIds.size === 0 && projectTeamEmployeeIds.size === 0 && getCurrentUserEmployeeId
                        ? 'No employees found in your hierarchy or project teams. You can only view goals & milestones for employees who report to you or are in your project teams.'
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
                            {emp.department} • {emp.designation || emp.zoho_role}
                          </div>
                        </button>
                      ))}
                      
                      {/* Show more button when not searching and there are more employees (only if user doesn't have view-all permission) */}
                      {!employeeSearchTerm.trim() && !showAllEmployees && filteredEmployees.length > 20 && !hasPermission('view-all-kra-list') && (
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

            {/* Open in New Tab Button - Only show when NOT in standalone mode */}
            {!isStandalone && (
              <button
                onClick={() => {
                  const url = `${window.location.origin}/goals-milestones${selectedEmployee ? `?employee_id=${selectedEmployee.id}` : ''}`
                  window.open(url, '_blank', 'noopener,noreferrer')
                }}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all duration-200"
                title="Open Goals & Milestones in new tab"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                </svg>
              </button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            {hasPermission('kra-goals-add') && (
              <button
                onClick={handleAddGoal}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-transparent bg-green-800 text-white hover:bg-green-900 transition-all duration-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"/>
                </svg>
                Add Goal
              </button>
            )}
            
            {/* List Toggle Buttons */}
            <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => setCurrentView('live')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                  currentView === 'live'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Live List
              </button>
              <button
                onClick={() => setCurrentView('archived')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                  currentView === 'archived'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Archived List
              </button>
            </div>
            
            {hasPermission('kra-milestones-add') && (
              <button
                onClick={handleAddMilestone}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all duration-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
                </svg>
                Add Milestone
              </button>
            )}
          </div>
        </div>
      </div>

      {/* KRA Grid - Only show when Live List is selected */}
      {currentView === 'live' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="px-6 py-2 border-b border-slate-200">
          <h3 className="text-base font-semibold text-slate-900">
            Goals & Milestones for {selectedEmployee ? `${selectedEmployee.first_name} ${selectedEmployee.last_name}` : '--'}
          </h3>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="w-8 h-8 border-4 border-green-200 border-t-green-800 rounded-full animate-spin"></div>
              <span className="ml-3 text-slate-600">Loading goals and milestones...</span>
            </div>
          ) : (goals.length === 0 && milestones.length === 0) ? (
            <div className="text-center py-8 text-slate-500 text-sm">
              {selectedEmployee ? 'No goals or milestones found for this employee' : 'Select an employee to view goals and milestones'}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Goals with expandable drag-and-drop table */}
              {getFilteredGoals().map(goal => {
                const kra = employeeAssignments.find(a => a.kra_id === goal.kra_id)?.kra
                const isExpanded = expandedGoals.has(goal.id)
                const goalMilestones = getMilestonesForGoal(goal.id)
                
                return (
                  <div key={goal.id} className="border border-slate-200 rounded-lg overflow-hidden">
                    {/* Goal Header */}
                    <div className="p-2 hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => handleCardClick({...goal, type: 'goal'})}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleGoalExpansion(goal.id)
                            }}
                            className="text-slate-400 hover:text-slate-600 transition-colors p-1"
                            title={isExpanded ? "Collapse milestones" : "Expand milestones"}
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
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"/>
                            </svg>
                            <h4 className="font-medium text-slate-900">Goal</h4>
                          </div>
                          <div className="flex items-center gap-2 ml-2">
                            <p className="text-sm text-slate-700">{goal.description}</p>
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                              KRA: {kra?.kra_title || 'N/A'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Display rating if the goal has been rated */}
                          {goal.rating && (
                            <div className="flex items-center gap-1">
                              <div className="flex items-center gap-0.5">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <span 
                                    key={star}
                                    className={`text-xs ${star <= goal.rating ? 'text-yellow-400' : 'text-gray-300'}`}
                                  >
                                    ★
                                  </span>
                                ))}
                              </div>
                              {goal.rating_given_by && (
                                <span className="text-xs text-slate-500 ml-1">
                                  rated by {goal.rating_given_by}
                                </span>
                              )}
                            </div>
                          )}
                          <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(goal.priority)}`}>
                            {goal.priority}
                          </span>
                          {hasPermission('kra-goals-edit') ? (
                            <div className="relative">
                              <select
                                value={goal.status}
                                onChange={(e) => handleGoalStatusChange(goal.id, e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                disabled={updatingGoalStatus === goal.id}
                                className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(goal.status)} focus:outline-none focus:ring-2 focus:ring-green-800 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
                              >
                                {goalStatusOptions.map(option => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                              {updatingGoalStatus === goal.id && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <svg className="animate-spin h-3 w-3 text-green-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(goal.status)}`}>
                              {goal.status}
                            </span>
                          )}
                          {currentView === 'archived' ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleRestoreItem({...goal, type: 'goal'})
                              }}
                              className="p-1 rounded transition-colors flex items-center text-green-500 hover:text-green-700 hover:bg-green-50"
                              title="Restore to live status"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                              </svg>
                            </button>
                          ) : hasPermission('kra-goals-delete') && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteGoal(goal.id)
                              }}
                              disabled={deletingGoal === goal.id}
                              className={`p-1 rounded transition-colors flex items-center ${
                                deletingGoal === goal.id
                                  ? 'text-red-300 cursor-not-allowed'
                                  : 'text-red-500 hover:text-red-700 hover:bg-red-50'
                              }`}
                              title={deletingGoal === goal.id ? 'Deleting...' : 'Delete goal'}
                            >
                              {deletingGoal === goal.id ? (
                                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                              ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                </svg>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-600 ml-8 mt-1">
                        <span>Weightage: {goal.weightage}%</span>
                        <span>•</span>
                        <span>Start: {goal.start_date}</span>
                        <span>•</span>
                        <span>Target: {goal.target_date}</span>
                        <span>•</span>
                        <span>{goalMilestones.length} milestone{goalMilestones.length !== 1 ? 's' : ''}</span>
                      </div>
                    </div>

                    {/* Expandable Drag-and-Drop Table */}
                    {isExpanded && (
                      <div className="border-t border-slate-200 bg-slate-50">
                        <div className="p-4">
                          <h5 className="text-sm font-semibold text-slate-900 mb-3">Milestone Management</h5>
                          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                            <table className="w-full">
                              <thead className="bg-slate-100">
                                <tr>
                                  {getStatusColumns().map(column => (
                                    <th key={column.key} className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                                      {column.label}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-slate-200">
                                <tr>
                                  {getStatusColumns().map(column => (
                                    <td 
                                      key={column.key}
                                      className="px-4 py-3 min-h-[100px] align-top"
                                      onDragOver={handleDragOver}
                                      onDrop={(e) => handleDrop(e, column.key)}
                                    >
                                      <div className={`min-h-[80px] p-2 rounded-lg ${column.color} border-2 border-dashed border-slate-300`}>
                                        {getMilestonesByStatus(goal.id, column.key).map(milestone => (
                                          <div
                                            key={milestone.id}
                                            draggable
                                            onMouseDown={() => {
                                              // Reset drag flag on mouse down
                                              isDraggingRef.current = false
                                            }}
                                            onDragStart={(e) => handleDragStart(e, milestone)}
                                            onDragEnd={handleDragEnd}
                                            className="bg-white border border-slate-200 rounded-lg p-2 mb-2 hover:shadow-sm transition-all cursor-move"
                                          >
                                            <div className="flex items-center justify-between">
                                              <div 
                                                className="flex-1 cursor-pointer"
                                                onClick={(e) => {
                                                  // Only open modal if it wasn't a drag operation
                                                  if (!isDraggingRef.current) {
                                                    e.stopPropagation()
                                                    handleCardClick({...milestone, type: 'milestone'})
                                                  }
                                                }}
                                              >
                                                <p className="text-sm font-medium text-slate-900">{milestone.description}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                  <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(milestone.priority)}`}>
                                                    {milestone.priority}
                                                  </span>
                                                  <span className="text-xs text-slate-500">
                                                    {milestone.start_date} - {milestone.target_date}
                                                  </span>
                                                </div>
                                              </div>
                                              <div className="flex items-center gap-1">
                                                {currentView === 'archived' ? (
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation()
                                                      handleRestoreItem({...milestone, type: 'milestone'})
                                                    }}
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                    onDragStart={(e) => e.stopPropagation()}
                                                    className="p-1 rounded transition-colors flex items-center text-green-500 hover:text-green-700 hover:bg-green-50"
                                                    title="Restore to live status"
                                                  >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                                                    </svg>
                                                  </button>
                                                ) : hasPermission('kra-milestones-delete') && (
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation()
                                                      handleDeleteMilestone(milestone.id)
                                                    }}
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                    onDragStart={(e) => e.stopPropagation()}
                                                    disabled={deletingMilestone === milestone.id}
                                                    className={`p-1 rounded transition-colors flex items-center ${
                                                      deletingMilestone === milestone.id
                                                        ? 'text-red-300 cursor-not-allowed'
                                                        : 'text-red-500 hover:text-red-700 hover:bg-red-50'
                                                    }`}
                                                    title={deletingMilestone === milestone.id ? 'Deleting...' : 'Delete milestone'}
                                                  >
                                                    {deletingMilestone === milestone.id ? (
                                                      <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                      </svg>
                                                    ) : (
                                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                                      </svg>
                                                    )}
                                                  </button>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                        {getMilestonesByStatus(goal.id, column.key).length === 0 && (
                                          <div className="text-center text-slate-400 text-sm py-4">
                                            {column.key === 'milestones' ? 'goals that don\'t fit into specific KRAs' : 'Drop milestones here'}
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                  ))}
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}

            </div>
          )}
        </div>
      </div>
      )}

      {/* Archived Items Section - Only show when Archived List is selected */}
      {currentView === 'archived' && (getFilteredGoals().length > 0 || getFilteredMilestones().length > 0) && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="px-6 py-2 border-b border-slate-200">
            <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8l4 4-4 4m5-4h6"/>
              </svg>
              Archived Items
            </h3>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              {/* Archived Goals */}
              {getFilteredGoals().map(goal => {
                const kra = employeeAssignments.find(a => a.kra_id === goal.kra_id)?.kra
                return (
                  <div key={goal.id} className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-slate-600 uppercase">GOAL</span>
                          <span className="text-xs text-slate-500">Archived</span>
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                            KRA: {kra?.kra_title || 'N/A'}
                          </span>
                        </div>
                        <p className="text-sm text-slate-700">{goal.description}</p>
                      </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(goal.priority)}`}>
                        {goal.priority}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRestoreItem({...goal, type: 'goal'})
                        }}
                        disabled={restoringItem === goal.id}
                        className="p-1 rounded transition-colors flex items-center text-green-500 hover:text-green-700 hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={restoringItem === goal.id ? "Restoring..." : "Restore to live status"}
                      >
                        {restoringItem === goal.id ? (
                          <div className="flex items-center gap-1">
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-green-500 border-t-transparent"></div>
                            <span className="text-xs text-green-600">Restoring...</span>
                          </div>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
                )
              })}
              
              {/* Archived Milestones */}
              {getFilteredMilestones().map(milestone => {
                const goal = goals.find(g => g.id === milestone.goal_id)
                const kra = goal ? employeeAssignments.find(a => a.kra_id === goal.kra_id)?.kra : null
                return (
                  <div key={milestone.id} className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-slate-600 uppercase">MILESTONE</span>
                          <span className="text-xs text-slate-500">Archived</span>
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                            KRA: {kra?.kra_title || 'N/A'}
                          </span>
                        </div>
                        <p className="text-sm text-slate-700">{milestone.description}</p>
                      </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(milestone.priority)}`}>
                        {milestone.priority}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRestoreItem({...milestone, type: 'milestone'})
                        }}
                        disabled={restoringItem === milestone.id}
                        className="p-1 rounded transition-colors flex items-center text-green-500 hover:text-green-700 hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={restoringItem === milestone.id ? "Restoring..." : "Restore to live status"}
                      >
                        {restoringItem === milestone.id ? (
                          <div className="flex items-center gap-1">
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-green-500 border-t-transparent"></div>
                            <span className="text-xs text-green-600">Restoring...</span>
                          </div>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Add Goal Modal */}
      {showGoalModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" style={{marginTop: '0px'}}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-2 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">Add New Goal</h3>
                <button
                  onClick={() => {
                    setShowGoalModal(false)
                    setError(null)
                  }}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            </div>
            {error && (
              <div className="px-6 py-3 bg-red-50 border-l-4 border-red-400">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <p className="text-red-800 text-sm">{error}</p>
                </div>
              </div>
            )}
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Select KRA <span className="text-red-500">*</span></label>
                <select
                  value={goalForm.kra_id}
                  onChange={(e) => setGoalForm({...goalForm, kra_id: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500"
                  required
                >
                  <option value="">Select KRA</option>
                  {employeeAssignments.map(assignment => (
                    <option key={assignment.kra_id} value={assignment.kra_id}>
                      {assignment.kra?.kra_title}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Goal Description <span className="text-red-500">*</span></label>
                <textarea
                  value={goalForm.description}
                  onChange={(e) => setGoalForm({...goalForm, description: e.target.value})}
                  rows="3"
                  placeholder="Enter goal description..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500"
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
                  <select
                    value={goalForm.priority}
                    onChange={(e) => setGoalForm({...goalForm, priority: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500"
                    required
                  >
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Weightage (%) <span className="text-red-500">*</span></label>
                  <select
                    value={goalForm.weightage}
                    onChange={(e) => setGoalForm({...goalForm, weightage: parseInt(e.target.value) || 0})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500"
                    required
                  >
                    <option value="0">Select Weightage</option>
                    {[10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(value => (
                      <option key={value} value={value}>{value}%</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Start Date <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    value={goalForm.start_date}
                    onChange={(e) => setGoalForm({...goalForm, start_date: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Target End Date <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    value={goalForm.target_date}
                    onChange={(e) => setGoalForm({...goalForm, target_date: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500"
                    required
                  />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowGoalModal(false)
                  setError(null)
                }}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveGoal}
                disabled={savingGoal}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors flex items-center gap-2 ${
                  savingGoal 
                    ? 'bg-green-400 cursor-not-allowed' 
                    : 'bg-green-700 hover:bg-green-800'
                }`}
              >
                {savingGoal && (
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {savingGoal ? 'Saving...' : 'Save Goal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Milestone Modal */}
      {showMilestoneModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" style={{marginTop: '0px'}}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-2 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">Add New Milestone/Task</h3>
                <button
                  onClick={() => {
                    setShowMilestoneModal(false)
                    setError(null)
                  }}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            </div>
            {error && (
              <div className="px-6 py-3 bg-red-50 border-l-4 border-red-400">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <p className="text-red-800 text-sm">{error}</p>
                </div>
              </div>
            )}
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Select Goal <span className="text-red-500">*</span></label>
                <select
                  value={milestoneForm.goal_id}
                  onChange={(e) => setMilestoneForm({...milestoneForm, goal_id: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500"
                  required
                >
                  <option value="">Select Goal</option>
                  {goals.filter(goal => goal.live_or_archived === 'live').map(goal => (
                    <option key={goal.id} value={goal.id}>
                      {goal.description}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Milestone Description <span className="text-red-500">*</span></label>
                <textarea
                  value={milestoneForm.description}
                  onChange={(e) => setMilestoneForm({...milestoneForm, description: e.target.value})}
                  rows="3"
                  placeholder="Enter milestone description..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Priority <span className="text-red-500">*</span></label>
                <select
                  value={milestoneForm.priority}
                  onChange={(e) => setMilestoneForm({...milestoneForm, priority: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500"
                  required
                >
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Start Date <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    value={milestoneForm.start_date}
                    onChange={(e) => setMilestoneForm({...milestoneForm, start_date: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Target End Date <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    value={milestoneForm.target_date}
                    onChange={(e) => setMilestoneForm({...milestoneForm, target_date: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500"
                    required
                  />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowMilestoneModal(false)
                  setError(null)
                }}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveMilestone}
                disabled={savingMilestone}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors flex items-center gap-2 ${
                  savingMilestone 
                    ? 'bg-green-400 cursor-not-allowed' 
                    : 'bg-green-700 hover:bg-green-800'
                }`}
              >
                {savingMilestone && (
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {savingMilestone ? 'Saving...' : 'Save Milestone'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Card Detail Modal */}
      {showCardDetailModal && selectedCard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" style={{marginTop: '0px'}}>
          {console.log('Rendering modal for card:', selectedCard)}
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="px-6 py-2 border-b border-slate-200 bg-green-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">
                  {selectedCard?.type === 'goal' ? 'GOAL DETAILS' : 'MILESTONE DETAILS'}
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleArchiveCard(selectedCard)}
                    disabled={archivingItem === selectedCard?.id}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-orange-800 bg-yellow-400 border border-yellow-500 rounded-lg hover:bg-yellow-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {archivingItem === selectedCard?.id ? (
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-orange-800"></div>
                    ) : (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8l4 4-4 4m5-4h6"/>
                      </svg>
                    )}
                    {archivingItem === selectedCard?.id ? 'ARCHIVING...' : 'ARCHIVE'}
                  </button>
                  <button
                    onClick={handleSaveCardDetails}
                    disabled={savingCardDetails}
                    className={`px-3 py-1.5 text-xs font-medium text-white rounded-lg transition-colors flex items-center gap-2 ${
                      savingCardDetails 
                        ? 'bg-green-500 cursor-not-allowed' 
                        : 'bg-green-700 hover:bg-green-800'
                    }`}
                  >
                    {savingCardDetails && (
                      <svg className="animate-spin h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    )}
                    {savingCardDetails ? 'SAVING...' : 'SAVE'}
                  </button>
                  <button
                    onClick={() => setShowCardDetailModal(false)}
                    className="text-white hover:text-gray-200 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
            
            <div className="px-6 py-4 space-y-6">
              {/* Error Display */}
              {cardDetail.error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <span className="text-sm text-red-700">{cardDetail.error}</span>
                    <button
                      onClick={() => setCardDetail(prev => ({ ...prev, error: null }))}
                      className="ml-auto text-red-500 hover:text-red-700"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              {/* Description */}
              <div className="flex items-start gap-4">
                <label className="text-sm font-medium text-slate-700 w-24 mt-2">DESCRIPTION:</label>
                <textarea
                  value={cardDetail.description}
                  onChange={(e) => setCardDetail({...cardDetail, description: e.target.value})}
                  rows="3"
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 resize-none"
                />
              </div>
              
              {/* Status & Priority - Hide when status is completed */}
              {cardDetail.status !== 'completed' && (
                <div className="flex items-center gap-8">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-slate-700">STATUS:</label>
                    <select
                      value={cardDetail.status}
                      onChange={(e) => {
                        const newStatus = e.target.value
                        setCardDetail({...cardDetail, status: newStatus})
                        // Update the status immediately
                        if (selectedCard?.type === 'goal') {
                          handleGoalStatusChange(selectedCard.id, newStatus)
                        } else if (selectedCard?.type === 'milestone') {
                          handleMilestoneStatusChange(selectedCard.id, newStatus)
                        }
                      }}
                      className="px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500"
                    >
                      {selectedCard?.type === 'goal' ? (
                        goalStatusOptions.map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="milestones">Milestones</option>
                          <option value="this_weeks_plan">This Week's Plan</option>
                          <option value="wip">WIP</option>
                          <option value="blocked">Blocked</option>
                          <option value="done">Done</option>
                        </>
                      )}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-slate-700">PRIORITY:</label>
                    <select
                      value={cardDetail.priority}
                      onChange={(e) => setCardDetail({...cardDetail, priority: e.target.value})}
                      className="px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500"
                    >
                      <option value="critical">Critical</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                </div>
              )}
              
              {/* Dates - Hide when status is completed */}
              {cardDetail.status !== 'completed' && (
                <div className="flex items-start gap-4">
                  <label className="text-sm font-medium text-slate-700 w-24 mt-2">DATES:</label>
                  <div className="flex gap-4">
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">START</label>
                      <input
                        type="date"
                        value={cardDetail.start_date}
                        onChange={(e) => setCardDetail({...cardDetail, start_date: e.target.value})}
                        className="px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">TARGET</label>
                      <input
                        type="date"
                        value={cardDetail.target_date}
                        onChange={(e) => setCardDetail({...cardDetail, target_date: e.target.value})}
                        className="px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">ACTUAL</label>
                      <input
                        type="date"
                        value={cardDetail.actual_end_date}
                        onChange={(e) => setCardDetail({...cardDetail, actual_end_date: e.target.value})}
                        className="px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                  </div>
                </div>
              )}
              
              {/* Rating Section - Only show for completed goals */}
              {selectedCard?.type === 'goal' && cardDetail.status === 'completed' && (
                <div className="flex items-start gap-4">
                  <label className="text-sm font-medium text-slate-700 w-24 mt-2">RATING:</label>
                  <div className="flex-1">
                    <StarRating 
                      rating={cardDetail.rating || 0} 
                      onRatingChange={(rating) => {
                        setCardDetail({...cardDetail, rating})
                        handleGoalRatingChange(selectedCard.id, rating)
                      }}
                    />
                    <p className="text-xs text-slate-500 mt-1">Rate the completion quality of this goal (1-5 stars)</p>
                  </div>
                </div>
              )}
              
              {/* Comments Section */}
              <div className="flex items-start gap-4">
                <label className="text-sm font-medium text-slate-700 w-24 mt-2">COMMENTS:</label>
                <div className="flex-1">
                  {/* Comments Display */}
                  <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-3 bg-slate-50 mb-3">
                    {cardDetail.comments.length === 0 ? (
                      <p className="text-sm text-slate-500 text-center py-4">No comments yet</p>
                    ) : (
                      <div className="space-y-3">
                        {cardDetail.comments.map((comment, index) => (
                          <div key={comment.id || index} className="flex items-start gap-3">
                            <div className={`w-1 h-8 rounded-full ${
                              comment.comment_type === 'system' ? 'bg-green-500' : 'bg-orange-500'
                            }`}></div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-slate-900">
                                    {comment.comment_type === 'system' ? 'System' : getUsername(comment.author)}
                                  </span>
                                  <span className="text-xs text-slate-500">
                                    {formatTimestamp(comment.created_at)}
                                  </span>
                                </div>
                                {hasPermission('kra-comments-delete') && comment.comment_type !== 'system' && (
                                  <button
                                    onClick={() => handleDeleteComment(comment.id)}
                                    disabled={deletingComment === comment.id}
                                    className={`p-1 rounded transition-colors flex items-center ${
                                      deletingComment === comment.id
                                        ? 'text-red-300 cursor-not-allowed'
                                        : 'text-red-500 hover:text-red-700 hover:bg-red-50'
                                    }`}
                                    title={deletingComment === comment.id ? 'Deleting...' : 'Delete comment'}
                                  >
                                    {deletingComment === comment.id ? (
                                      <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                      </svg>
                                    ) : (
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                      </svg>
                                    )}
                                  </button>
                                )}
                              </div>
                              <p className="text-sm text-slate-700">{comment.comment_text}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Add Comment Input */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Add a comment..."
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-800 focus:border-green-800"
                      onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
                    />
                    <button
                      onClick={handleAddComment}
                      disabled={!newComment.trim() || isAddingComment}
                      className="px-4 py-2 text-sm font-medium text-white bg-green-700 rounded-md hover:bg-green-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isAddingComment ? 'Adding...' : 'ADD'}
                    </button>
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

export default KRAGoalsAndMilestones
