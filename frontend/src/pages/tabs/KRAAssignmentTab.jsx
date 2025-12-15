import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { usePermissions } from '../../context/PermissionContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { useKRAAssignments } from '../../hooks/useKRAAssignments.js'
import { useKRAs } from '../../hooks/useKRAs.js'
import { useEmployees } from '../../context/EmployeeContext.jsx'
import { getCookie } from '../../utils/helpers.js'
import { TOKEN, getApiBaseUrl } from '../../utils/constants.js'
import MultiSelect from '../../components/MultiSelect.jsx'

const KRAAssignmentTab = () => {
  const { hasPermission } = usePermissions()
  const { user } = useAuth()
  const { 
    assignments, 
    loading, 
    error, 
    fetchAssignments,
    createAssignment,
    updateAssignment,
    deleteAssignment,
    bulkAssignKRAs,
    getEmployeeAssignments,
    getAvailableKRAs,
    clearError 
  } = useKRAAssignments()
  
  const { kras, loading: krasLoading } = useKRAs()
  const { getAllEmployees, loading: employeesLoading } = useEmployees()
  const employees = getAllEmployees()

  // State management
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [filters, setFilters] = useState({
    department: [],
    role: [],
    status: ['Active']
  })
  const [availableKRAs, setAvailableKRAs] = useState([])
  const [employeeAssignments, setEmployeeAssignments] = useState([])
  const [selectedKRAs, setSelectedKRAs] = useState([])
  const [loadingAssignments, setLoadingAssignments] = useState(false)
  const [showBulkAssign, setShowBulkAssign] = useState(false)
  const [showOnlyUnassigned, setShowOnlyUnassigned] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [pendingAssignments, setPendingAssignments] = useState([])
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [deletingAssignment, setDeletingAssignment] = useState(null)
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState('')
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false)
  const [showAllEmployees, setShowAllEmployees] = useState(false)
  const employeeDropdownRef = useRef(null)
  const [expandedKRAs, setExpandedKRAs] = useState(new Set())
  const [hierarchyEmployeeIds, setHierarchyEmployeeIds] = useState(new Set()) // Employee IDs in current user's hierarchy
  const [projectTeamEmployeeIds, setProjectTeamEmployeeIds] = useState(new Set()) // Employee IDs from projects where user is PM
  const [hierarchyLoading, setHierarchyLoading] = useState(false)
  const [assignmentOrder, setAssignmentOrder] = useState([]) // Order of assignment IDs for display
  const [draggedItem, setDraggedItem] = useState(null) // Currently dragged assignment
  const [draggedOverIndex, setDraggedOverIndex] = useState(null) // Index where item is being dragged over

  // Dynamic filter options
  const departments = [...new Set(employees.map(emp => emp.department).filter(Boolean))].sort()
  const roles = [...new Set(employees.map(emp => emp.designation || emp.zoho_role).filter(Boolean))].sort()

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
        console.log('data from KRA assignment', data)
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

  // Filter employees based on filters and hierarchy permission
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
    
    // Apply department, role, and status filters
    return filtered.filter(emp => {
      const matchesDepartment = filters.department.length === 0 || filters.department.includes(emp.department)
      const matchesRole = filters.role.length === 0 || 
        filters.role.includes(emp.designation) || 
        filters.role.includes(emp.zoho_role)
      const matchesStatus = filters.status.length === 0 || 
        filters.status.includes(emp.employee_status || 'Active')
      return matchesDepartment && matchesRole && matchesStatus
    })
  }, [employees, filters, hasPermission, hierarchyEmployeeIds, projectTeamEmployeeIds])

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

  // Filter available KRAs based on search, assignment status, and other filters
  const filteredAvailableKRAs = useMemo(() => {
    let filtered = availableKRAs

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(kra => 
        kra.kra_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        kra.department?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        kra.role?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Apply department filter
    if (filters.department.length > 0) {
      filtered = filtered.filter(kra => filters.department.includes(kra.department))
    }

    // Apply role filter
    if (filters.role.length > 0) {
      filtered = filtered.filter(kra => filters.role.includes(kra.role))
    }

    // Apply unassigned filter
    if (selectedEmployee && showOnlyUnassigned) {
      const assignedKraIds = employeeAssignments.map(assignment => assignment.kra_id)
      filtered = filtered.filter(kra => !assignedKraIds.includes(kra.id))
    }

    return filtered
  }, [availableKRAs, searchTerm, filters, selectedEmployee, employeeAssignments, showOnlyUnassigned])

  // Load employee assignments when employee is selected
  useEffect(() => {
    if (selectedEmployee) {
      loadEmployeeAssignments(selectedEmployee.id)
    }
  }, [selectedEmployee])

  // Initialize assignment order when assignments change
  useEffect(() => {
    const allAssignments = [...employeeAssignments, ...pendingAssignments]
    const allAssignmentIds = allAssignments.map(a => a.id)
    
    // If we have assignments and no order yet, initialize from display_order
    if (allAssignments.length > 0 && assignmentOrder.length === 0) {
      // Sort by display_order (nulls last), then by created_at
      const sorted = [...allAssignments].sort((a, b) => {
        // Only consider display_order for non-pending assignments
        if (!a.isPending && !b.isPending) {
          const aOrder = a.display_order !== null && a.display_order !== undefined ? a.display_order : 999999
          const bOrder = b.display_order !== null && b.display_order !== undefined ? b.display_order : 999999
          if (aOrder !== bOrder) {
            return aOrder - bOrder
          }
          // If display_order is the same or both null, sort by created_at
          if (a.created_at && b.created_at) {
            return new Date(a.created_at) - new Date(b.created_at)
          }
        }
        // For pending items, maintain current order
        return 0
      })
      setAssignmentOrder(sorted.map(a => a.id))
      return
    }
    
    // Keep existing order for assignments that still exist
    const currentOrder = assignmentOrder.filter(id => allAssignmentIds.includes(id))
    
    // Add new assignments that aren't in the order yet
    const newAssignments = allAssignments.filter(
      assignment => !assignmentOrder.includes(assignment.id)
    )
    
    // Only update if there are new assignments
    if (newAssignments.length > 0) {
      setAssignmentOrder([...currentOrder, ...newAssignments.map(a => a.id)])
    } else if (currentOrder.length !== allAssignmentIds.length) {
      // If some assignments were removed, update the order
      setAssignmentOrder(currentOrder)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeAssignments.length, pendingAssignments.length])

  // Get ordered assignments (combining existing and pending)
  const getOrderedAssignments = () => {
    const allAssignments = [...employeeAssignments, ...pendingAssignments]
    const ordered = assignmentOrder
      .map(id => allAssignments.find(a => a.id === id))
      .filter(Boolean)
    const unordered = allAssignments.filter(
      a => !assignmentOrder.includes(a.id)
    )
    return [...ordered, ...unordered]
  }

  // Load all KRAs on component mount
  useEffect(() => {
    if (kras.length > 0) {
      setAvailableKRAs(kras)
    }
  }, [kras]) // Depend on kras from useKRAs hook

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


  const loadEmployeeAssignments = async (employeeId) => {
    setLoadingAssignments(true)
    try {
      console.log('Loading employee assignments for:', employeeId)
      const result = await getEmployeeAssignments(employeeId)
      console.log('Load employee assignments result:', result)
      if (result.success) {
        console.log('Full result data:', result.data)
        console.log('Assignments from result:', result.data.data?.assignments)
        
        // Debug each assignment to check KRA data
        if (result.data.data?.assignments) {
          result.data.data.assignments.forEach((assignment, index) => {
            console.log(`Assignment ${index}:`, assignment)
            console.log(`Assignment ${index} KRA:`, assignment.kra)
          })
        }
        
        setEmployeeAssignments(result.data.data?.assignments || [])
        console.log('Set employee assignments:', result.data.data?.assignments)
      } else {
        console.error('Failed to load employee assignments:', result.error)
      }
    } catch (err) {
      console.error('Error loading employee assignments:', err)
    } finally {
      setLoadingAssignments(false)
    }
  }

  const handleEmployeeSelect = (employee) => {
    setSelectedEmployee(employee)
    setSelectedKRAs([])
    setEmployeeSearchTerm(`${employee.first_name} ${employee.last_name}`)
    setShowEmployeeDropdown(false)
  }

  const handleEmployeeSearchChange = (value) => {
    setEmployeeSearchTerm(value)
    setShowEmployeeDropdown(true)
    setShowAllEmployees(false) // Reset show all when searching
    if (!value) {
      setSelectedEmployee(null)
      setEmployeeAssignments([]) // Clear assigned KRAs when search is cleared
      setPendingAssignments([]) // Clear pending assignments as well
    }
  }

  const clearEmployeeSelection = () => {
    setSelectedEmployee(null)
    setEmployeeSearchTerm('')
    setShowEmployeeDropdown(false)
    setShowAllEmployees(false)
    setEmployeeAssignments([]) // Clear assigned KRAs when employee is cleared
    setPendingAssignments([]) // Clear pending assignments as well
    setAssignmentOrder([]) // Clear order as well
    // Note: Don't clear hierarchyEmployeeIds or projectTeamEmployeeIds here as they're needed for filtering
  }

  // Drag and drop handlers
  const handleDragStart = (e, assignmentId, index) => {
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
    
    // If clicking on an interactive element (except drag handle), don't start drag
    if (isInteractiveElement && !target.closest('[data-drag-handle]')) {
      e.preventDefault()
      return
    }
    
    setDraggedItem({ id: assignmentId, index })
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/html', e.target.outerHTML)
    
    // Set opacity on the card element
    const card = e.currentTarget
    if (card) {
      card.style.opacity = '0.5'
    }
  }

  const handleDragOver = (e, index) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDraggedOverIndex(index)
  }

  const handleDragLeave = () => {
    setDraggedOverIndex(null)
  }

  const saveAssignmentOrder = async (newOrder) => {
    if (!selectedEmployee) return
    
    try {
      const token = getCookie(TOKEN)
      const orders = newOrder.map((assignmentId, index) => {
        const assignment = [...employeeAssignments, ...pendingAssignments].find(a => a.id === assignmentId)
        // Only save order for non-pending assignments
        if (assignment && !assignment.isPending) {
          return {
            assignment_id: assignmentId,
            display_order: index + 1
          }
        }
        return null
      }).filter(Boolean)
      
      if (orders.length === 0) return
      
      const response = await fetch(`${getApiBaseUrl()}/api/kra-assignments/bulk-order`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          employee_id: selectedEmployee.id,
          orders: orders
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        console.error('Failed to save assignment order:', errorData.error)
      } else {
        const result = await response.json()
        console.log('Assignment order saved successfully:', result)
      }
    } catch (error) {
      console.error('Error saving assignment order:', error)
    }
  }

  const handleDrop = async (e, dropIndex) => {
    e.preventDefault()
    setDraggedOverIndex(null)
    
    if (!draggedItem) return
    
    const orderedAssignments = getOrderedAssignments()
    const draggedIndex = orderedAssignments.findIndex(a => a.id === draggedItem.id)
    
    if (draggedIndex === -1 || draggedIndex === dropIndex) {
      setDraggedItem(null)
      return
    }
    
    // Create new order based on the visual order
    const newOrder = orderedAssignments.map(a => a.id)
    
    // Remove dragged item from its current position
    const draggedId = newOrder.splice(draggedIndex, 1)[0]
    
    // Insert at new position
    newOrder.splice(dropIndex, 0, draggedId)
    
    setAssignmentOrder(newOrder)
    setDraggedItem(null)
    
    // Save the new order to the database
    await saveAssignmentOrder(newOrder)
  }

  const handleDragEnd = (e) => {
    // Restore opacity on the card element
    const card = e.currentTarget
    if (card) {
      card.style.opacity = '1'
    }
    setDraggedItem(null)
    setDraggedOverIndex(null)
  }

  const handleKRAAdd = (kra) => {
    if (!hasPermission('kra-assign')) {
      alert('You do not have permission to assign KRAs.')
      return
    }

    if (!selectedEmployee) {
      alert('Please select an employee first before assigning KRAs.')
      return
    }

    // Add to pending assignments
    const newAssignment = {
      id: `pending-${Date.now()}`, // Temporary ID for pending assignments
      kra: kra,
      isPending: true
    }
    
    setPendingAssignments(prev => [...prev, newAssignment])
  }

  // Check if a KRA is already assigned or pending
  const isKRAAssigned = (kraId) => {
    const assignedKraIds = employeeAssignments.map(assignment => assignment.kra_id)
    const pendingKraIds = pendingAssignments.map(assignment => assignment.kra.id)
    return assignedKraIds.includes(kraId) || pendingKraIds.includes(kraId)
  }

  const handleKRARemove = async (assignment) => {
    if (!hasPermission('kra-assign')) {
      alert('You do not have permission to remove KRA assignments.')
      return
    }

    // Show confirmation dialog
    const isConfirmed = window.confirm(
      `Are you sure you want to remove the KRA "${assignment.kra.kra_title}" from ${selectedEmployee?.first_name} ${selectedEmployee?.last_name}?`
    )
    
    if (!isConfirmed) {
      return // User cancelled the deletion
    }

    setDeletingAssignment(assignment.id) // Set loading state

    try {
      if (assignment.isPending) {
        // Remove from pending assignments
        setPendingAssignments(prev => prev.filter(p => p.id !== assignment.id))
      } else {
        // Remove from database
        const result = await deleteAssignment(assignment.id)
        if (result.success) {
          await loadEmployeeAssignments(selectedEmployee.id)
        }
      }
    } catch (error) {
      console.error('Error removing KRA assignment:', error)
    } finally {
      setDeletingAssignment(null) // Clear loading state
    }
  }

  const handleSaveAssignments = async () => {
    if (!selectedEmployee || pendingAssignments.length === 0) return

    setSaving(true)
    try {
      const assignments = pendingAssignments.map(assignment => ({
        employee_id: selectedEmployee.id,
        kra_id: assignment.kra.id
      }))

      console.log('Saving assignments:', assignments) // Debug log
      const result = await bulkAssignKRAs(assignments)
      console.log('Save result:', result) // Debug log
      
      if (result.success) {
        // Clear pending assignments
        setPendingAssignments([])
        // Refresh employee assignments
        await loadEmployeeAssignments(selectedEmployee.id)
        console.log('Assignments saved successfully!') // Success feedback
        
        // Show success feedback
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 3000) // Hide after 3 seconds
      } else {
        console.error('Failed to save assignments:', result.error)
        // You could add a toast notification here
      }
    } catch (error) {
      console.error('Error saving assignments:', error)
      // You could add a toast notification here
    } finally {
      setSaving(false)
    }
  }

  const handleBulkAssign = async () => {
    if (!selectedEmployee || selectedKRAs.length === 0) return

    const assignments = selectedKRAs.map(kra => ({
      employee_id: selectedEmployee.id,
      kra_id: kra.id,
      status: 'Active'
    }))

    const result = await bulkAssignKRAs(assignments)
    if (result.success) {
      setSelectedKRAs([])
      // Refresh employee assignments
      await loadEmployeeAssignments(selectedEmployee.id)
      // If showing only unassigned, the filtered list will automatically update
    }
  }

  // Removed handleKRAStatusChange as status column is no longer needed

  const toggleKRASelection = (kra) => {
    setSelectedKRAs(prev => {
      const isSelected = prev.some(selected => selected.id === kra.id)
      if (isSelected) {
        return prev.filter(selected => selected.id !== kra.id)
      } else {
        return [...prev, kra]
      }
    })
  }

  const getImpactColor = (impact) => {
    switch (impact) {
      case 'High': return 'bg-red-100 text-red-800'
      case 'Medium': return 'bg-yellow-100 text-yellow-800'
      case 'Low': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const toggleKRAExpansion = (kraId) => {
    setExpandedKRAs(prev => {
      const newSet = new Set(prev)
      if (newSet.has(kraId)) {
        newSet.delete(kraId)
      } else {
        newSet.add(kraId)
      }
      return newSet
    })
  }

  // Removed getStatusColor as status column is no longer needed

  if (!hasPermission('kra-assign-view')) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
        <h2 className="text-xl font-bold text-slate-900 mb-2">Access Denied</h2>
        <p className="text-slate-600">You don't have permission to view KRA Assignments.</p>
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
              onClick={clearError}
              className="text-red-600 hover:text-red-800 transition-colors"
              title="Dismiss error"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Search and Filters Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-2">
        <div className="flex items-center justify-between">
          {/* Search Bar */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
            </div>
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search KRAs..." 
              className="input-field pl-10 text-sm py-2 shadow-sm w-96"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            )}
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 border ${
                showFilters
                  ? 'bg-green-700 text-white border-green-700'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/>
              </svg>
              Filters
              <svg className={`w-4 h-4 transition-transform duration-200 ${showFilters ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 mt-2">
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
                <div className="flex-1">
                  <MultiSelect
                    label="Department"
                    options={departments.map(dept => ({ value: dept, label: dept }))}
                    selectedValues={filters.department}
                    onSelectionChange={(values) => setFilters(prev => ({ ...prev, department: values }))}
                    placeholder="All Departments"
                    searchPlaceholder="Filter departments..."
                  />
                </div>

                <div className="flex-1">
                  <MultiSelect
                    label="Role"
                    options={roles.map(role => ({ value: role, label: role }))}
                    selectedValues={filters.role}
                    onSelectionChange={(values) => setFilters(prev => ({ ...prev, role: values }))}
                    placeholder="All Roles"
                    searchPlaceholder="Filter roles..."
                  />
                </div>

                <div className="flex-1">
                  <MultiSelect
                    label="Status"
                    options={[
                      { value: 'Active', label: 'Active' },
                      { value: 'Inactive', label: 'Inactive' },
                      { value: 'Resigned', label: 'Resigned' },
                      { value: 'Terminated', label: 'Terminated' }
                    ]}
                    selectedValues={filters.status}
                    onSelectionChange={(values) => setFilters(prev => ({ ...prev, status: values }))}
                    placeholder="All Status"
                    searchPlaceholder="Filter status..."
                  />
                </div>
              </div>
              
              {/* Clear Filters Button */}
              <div className="mt-3 flex justify-end">
                <button
                  onClick={() => setFilters({ department: [], role: [], status: ['Active'] })}
                  className="text-sm text-slate-600 hover:text-slate-800 transition-colors"
                  disabled={filters.department.length === 0 && filters.role.length === 0 && (filters.status.length === 0 || (filters.status.length === 1 && filters.status.includes('Active')))}
                >
                  Clear all filters
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Available KRAs */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Available KRAs</h3>
              {selectedEmployee && (
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={showOnlyUnassigned}
                    onChange={(e) => setShowOnlyUnassigned(e.target.checked)}
                    className="rounded border-slate-300 text-green-700 focus:ring-green-500"
                  />
                  Show only unassigned
                </label>
              )}
            </div>
          </div>
          <div className="p-6">
            {krasLoading ? (
              <div className="flex justify-center items-center py-12">
                <div className="w-8 h-8 border-4 border-green-200 border-t-green-700 rounded-full animate-spin"></div>
                <span className="ml-3 text-slate-600">Loading KRAs...</span>
              </div>
            ) : filteredAvailableKRAs.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">
                {showOnlyUnassigned && selectedEmployee 
                  ? 'No unassigned KRAs available for this employee' 
                  : 'No KRAs available'}
              </div>
            ) : (
              <div className="space-y-3">
                        {filteredAvailableKRAs.map(kra => {
                          const isAssigned = isKRAAssigned(kra.id)
                          const isExpanded = expandedKRAs.has(kra.id)
                          return (
                            <div key={kra.id} className={`border rounded-lg transition-colors ${
                              isAssigned 
                                ? 'border-slate-200 bg-slate-50 opacity-60' 
                                : 'border-slate-200 hover:bg-slate-50'
                            }`}>
                              <div className="p-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3 flex-1">
                                    {/* Accordion Toggle Button */}
                                    <button
                                      onClick={() => toggleKRAExpansion(kra.id)}
                                      className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
                                      title={isExpanded ? "Collapse details" : "Expand details"}
                                    >
                                      <svg 
                                        className={`w-4 h-4 text-slate-600 transition-transform duration-200 ${
                                          isExpanded ? 'rotate-180' : ''
                                        }`} 
                                        fill="none" 
                                        stroke="currentColor" 
                                        viewBox="0 0 24 24"
                                      >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
                                      </svg>
                                    </button>
                                    
                                    <div className="flex-1">
                                      <h4 className={`font-medium text-sm mb-1 ${
                                        isAssigned ? 'text-green-700' : 'text-green-700'
                                      }`}>{kra.kra_title}</h4>
                                      <div className="flex items-center gap-1 text-xs text-slate-600">
                                        <span>{kra.department}</span>
                                        <span>•</span>
                                        <span>{kra.role}</span>
                                        {isAssigned && <span className="text-slate-500">(Already assigned)</span>}
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-center gap-2">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getImpactColor(kra.impact)}`}>
                                      {kra.impact}
                                    </span>
                                    {hasPermission('kra-assign') ? (
                                      <button
                                        onClick={() => !isAssigned && handleKRAAdd(kra)}
                                        disabled={isAssigned}
                                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                                          isAssigned
                                            ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                                            : 'bg-green-700 text-white hover:bg-green-800'
                                        }`}
                                        title={isAssigned ? "Already assigned" : "Assign KRA"}
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                                        </svg>
                                      </button>
                                    ) : (
                                      <div className="w-7 h-7 rounded-lg bg-slate-200 flex items-center justify-center" title="No permission to assign KRAs">
                                        <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                                        </svg>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                              
                              {/* Accordion Content */}
                              {isExpanded && (
                                <div className="border-t border-slate-200 bg-slate-50 p-4 space-y-4">
                                  {/* Description Card */}
                                  {kra.description && (
                                    <div className="bg-white rounded-lg border border-slate-200 p-4">
                                      <h5 className="font-semibold text-sm text-slate-900 mb-2 flex items-center gap-2">
                                        <svg className="w-4 h-4 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                                        </svg>
                                        Description
                                      </h5>
                                      <p className="text-sm text-slate-700 leading-relaxed">{kra.description}</p>
                                    </div>
                                  )}
                                  
                                  {/* Expectations/KPI Card */}
                                  {kra.expectations && kra.expectations.length > 0 && (
                                    <div className="bg-white rounded-lg border border-slate-200 p-4">
                                      <h5 className="font-semibold text-sm text-slate-900 mb-3 flex items-center gap-2">
                                        <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
                                        </svg>
                                        Expectations / Outcomes
                                      </h5>
                                      <ul className="space-y-2">
                                        {kra.expectations.map((expectation, index) => (
                                          <li key={index} className="flex items-start gap-2 text-sm text-slate-700">
                                            <span className="flex-shrink-0 w-1.5 h-1.5 bg-green-700 rounded-full mt-2"></span>
                                            <span className="leading-relaxed">{expectation}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                  
                                  {/* Show message if no details available */}
                                  {!kra.description && (!kra.expectations || kra.expectations.length === 0) && (
                                    <div className="bg-white rounded-lg border border-slate-200 p-4 text-center">
                                      <p className="text-sm text-slate-500">No additional details available for this KRA</p>
                                    </div>
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

        {/* Assigned KRAs */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">
                Assigned KRAs for {selectedEmployee ? `${selectedEmployee.first_name} ${selectedEmployee.last_name}` : '--'} 
                
              </h3>
                            {/* Employee Selection */}
                            <div className="w-64 relative" ref={employeeDropdownRef}>
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
                                      {!hasPermission('view-all-kra-list') && hierarchyEmployeeIds.size === 0 && projectTeamEmployeeIds.size === 0 && getCurrentUserEmployeeId
                                        ? 'No employees found in your hierarchy or project teams. You can only view KRA assignments for employees who report to you or are in your project teams.'
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
            </div>
          </div>
          <div className="p-6">
            {loadingAssignments ? (
              <div className="flex justify-center items-center py-12">
                <div className="w-8 h-8 border-4 border-green-200 border-t-green-700 rounded-full animate-spin"></div>
                <span className="ml-3 text-slate-600">Loading assigned KRAs...</span>
              </div>
            ) : (employeeAssignments.length === 0 && pendingAssignments.length === 0) ? (
              <div className="text-center py-8 text-slate-500 text-sm">
                {selectedEmployee ? 'No KRAs assigned to this employee' : 'Select an employee to view assigned KRAs'}
              </div>
            ) : (
              <div className="space-y-3">
                {/* Debug info */}
                {console.log('Rendering employeeAssignments:', employeeAssignments)}
                {/* Existing assignments */}
                {getOrderedAssignments().map((assignment, index) => {
                  // Safety check for KRA data
                  if (!assignment.kra) {
                    console.warn('Assignment missing KRA data:', assignment)
                    return null
                  }
                  
                  const isExpanded = expandedKRAs.has(assignment.kra.id)
                  const isPending = assignment.isPending || false
                  const isDragging = draggedItem?.id === assignment.id
                  const isDragOver = draggedOverIndex === index
                  return (
                    <div 
                      key={assignment.id} 
                      draggable={!isPending}
                      onDragStart={!isPending ? (e) => handleDragStart(e, assignment.id, index) : undefined}
                      onDragEnd={!isPending ? handleDragEnd : undefined}
                      onDragOver={!isPending ? (e) => handleDragOver(e, index) : undefined}
                      onDragLeave={!isPending ? handleDragLeave : undefined}
                      onDrop={!isPending ? (e) => handleDrop(e, index) : undefined}
                      className={`border rounded-lg transition-all ${
                        isPending ? 'cursor-default' : 'cursor-move'
                      } ${
                        isPending 
                          ? 'border-green-200 bg-green-50 hover:bg-green-100' 
                          : 'border-slate-200 hover:bg-slate-50'
                      } ${
                        isDragging ? 'opacity-50' : ''
                      } ${
                        isDragOver ? 'border-green-500 border-2 shadow-md' : ''
                      }`}
                    >
                      <div className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            {/* Serial Number */}
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm font-semibold text-slate-700">
                              {index + 1}
                            </div>
                            
                            {/* Accordion Toggle Button */}
                            <button
                              onClick={() => toggleKRAExpansion(assignment.kra.id)}
                              onMouseDown={(e) => e.stopPropagation()}
                              onDragStart={(e) => e.stopPropagation()}
                              className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
                              title={isExpanded ? "Collapse details" : "Expand details"}
                            >
                              <svg 
                                className={`w-4 h-4 text-slate-600 transition-transform duration-200 ${
                                  isExpanded ? 'rotate-180' : ''
                                }`} 
                                fill="none" 
                                stroke="currentColor" 
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
                              </svg>
                            </button>
                            
                            <div className="flex-1">
                              <h4 className="font-medium text-green-700 text-sm mb-1">{assignment.kra.kra_title}</h4>
                              <div className="flex items-center gap-4 text-xs text-slate-600">
                                <span>{assignment.kra.department}</span>
                                <span>•</span>
                                <span>{assignment.kra.role}</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getImpactColor(assignment.kra.impact)}`}>
                              {assignment.kra.impact}
                            </span>
                            {hasPermission('kra-assign') ? (
                              <button
                                onClick={() => handleKRARemove(assignment)}
                                disabled={deletingAssignment === assignment.id}
                                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                                  deletingAssignment === assignment.id
                                    ? 'bg-red-400 cursor-not-allowed'
                                    : 'bg-red-600 hover:bg-red-700'
                                }`}
                                title={deletingAssignment === assignment.id ? "Removing..." : "Remove KRA"}
                              >
                                {deletingAssignment === assignment.id ? (
                                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                                  </svg>
                                )}
                              </button>
                            ) : (
                              <div className="w-7 h-7 rounded-lg bg-slate-200 flex items-center justify-center" title="No permission to remove KRAs">
                                <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                                </svg>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Accordion Content */}
                      {isExpanded && (
                        <div className={`border-t p-4 space-y-4 ${
                          isPending 
                            ? 'border-green-200 bg-green-100' 
                            : 'border-slate-200 bg-slate-50'
                        }`}>
                          {/* Description Card */}
                          {assignment.kra.description && (
                            <div className="bg-white rounded-lg border border-slate-200 p-4">
                              <h5 className="font-semibold text-sm text-slate-900 mb-2 flex items-center gap-2">
                                <svg className="w-4 h-4 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                                </svg>
                                Description
                              </h5>
                              <p className="text-sm text-slate-700 leading-relaxed">{assignment.kra.description}</p>
                            </div>
                          )}
                          
                          {/* Expectations/KPI Card */}
                          {assignment.kra.expectations && assignment.kra.expectations.length > 0 && (
                            <div className="bg-white rounded-lg border border-slate-200 p-4">
                              <h5 className="font-semibold text-sm text-slate-900 mb-3 flex items-center gap-2">
                                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
                                </svg>
                                Expectations / Outcomes
                              </h5>
                              <ul className="space-y-2">
                                {assignment.kra.expectations.map((expectation, index) => (
                                  <li key={index} className="flex items-start gap-2 text-sm text-slate-700">
                                    <span className="flex-shrink-0 w-1.5 h-1.5 bg-green-800 rounded-full mt-2"></span>
                                    <span className="leading-relaxed">{expectation}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          {/* Show message if no details available */}
                          {!assignment.kra.description && (!assignment.kra.expectations || assignment.kra.expectations.length === 0) && (
                            <div className="bg-white rounded-lg border border-slate-200 p-4 text-center">
                              <p className="text-sm text-slate-500">No additional details available for this KRA</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
                            </div>
            )}
          </div>
          
          {/* Save Button */}
          {pendingAssignments.length > 0 && hasPermission('kra-assign') && (
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">
                  {pendingAssignments.length} KRA{pendingAssignments.length !== 1 ? 's' : ''} assignment
                </span>
                <button
                  onClick={handleSaveAssignments}
                  disabled={saving}
                  className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                    saving
                      ? 'bg-green-400 cursor-not-allowed'
                      : saveSuccess
                      ? 'bg-green-600 text-white'
                      : 'bg-green-700 text-white hover:bg-green-800'
                  }`}
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-white">Saving...</span>
                    </>
                  ) : saveSuccess ? (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                      </svg>
                      Saved!
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                      </svg>
                      Save Assignments
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default KRAAssignmentTab
