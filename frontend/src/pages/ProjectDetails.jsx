import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Header from '../components/Header.jsx'
import ProjectGantt from '../components/ProjectGantt.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import { getCookie } from '../utils/helpers.js'
import { TOKEN, getApiBaseUrl } from '../utils/constants.js'
import { usePermissions } from '../context/PermissionContext.jsx'

const ProjectDetails = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { hasPermission } = usePermissions()
  const [project, setProject] = useState(null)
  const [teamMembers, setTeamMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('summary')
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingProject, setEditingProject] = useState(null)
  const [updatingProject, setUpdatingProject] = useState(false)
  const [employees, setEmployees] = useState([])
  const [customers, setCustomers] = useState([])
  const [availablePractices, setAvailablePractices] = useState([
    'Digital', 'Elastic', 'Data Engineering', 'ML', 'Agents', 
    'Looker', 'Infra', 'GenAI', 'Cloud'
  ])

  // Fetch project details
  const fetchProject = async () => {
    const token = getCookie(TOKEN)
    if (!token) {
      setError('Authentication required')
      return
    }

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/projects/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch project')
      }

      const data = await response.json()
      setProject(data.project)
    } catch (err) {
      console.error('Error fetching project:', err)
      setError('Failed to load project details')
    }
  }

  // Fetch project team members
  const fetchTeamMembers = async () => {
    const token = getCookie(TOKEN)
    if (!token) return

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/projects/${id}/team`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        setTeamMembers(data.team_members || [])
      }
    } catch (err) {
      console.error('Error fetching team members:', err)
    }
  }

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

  // Process team members to show only current week and deduplicate employees
  const getCurrentWeekTeamMembers = () => {
    if (!teamMembers || teamMembers.length === 0) {
      return []
    }

    const weekRange = getCurrentWeekRange()
    
    // Check if allocation overlaps with current week
    const isAllocationInCurrentWeek = (allocation) => {
      if (!allocation.start_date || !allocation.end_date) return false
      
      const allocationStart = new Date(allocation.start_date)
      const allocationEnd = new Date(allocation.end_date)
      
      return allocationStart <= weekRange.end && allocationEnd >= weekRange.start
    }

    // Filter for current week allocations
    const currentWeekMembers = teamMembers.filter(member => 
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

  // Process all team members (overall allocation)
  const getAllTeamMembers = () => {
    if (!teamMembers || teamMembers.length === 0) {
      return []
    }

    // Deduplicate employees and aggregate their allocation percentages
    const employeeMap = new Map()
    
    teamMembers.forEach(member => {
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

  // Fetch employees for project manager dropdown
  const fetchEmployees = async () => {
    const token = getCookie(TOKEN)
    if (!token) return

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/employees`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setEmployees(data.employees || [])
      }
    } catch (error) {
      console.error('Error fetching employees:', error)
    }
  }

  // Fetch customers for customer dropdown
  const fetchCustomers = async () => {
    const token = getCookie(TOKEN)
    if (!token) return

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/customers`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setCustomers(data.customers || [])
      }
    } catch (error) {
      console.error('Error fetching customers:', error)
    }
  }

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

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await Promise.all([fetchProject(), fetchTeamMembers(), fetchEmployees(), fetchCustomers(), fetchAvailablePractices()])
      setLoading(false)
    }

    if (id) {
      loadData()
    }
  }, [id])

  const getStatusColor = (status) => {
    switch (status) {
      case 'Active':
        return 'bg-green-100 text-green-800'
      case 'Planning':
        return 'bg-yellow-100 text-yellow-800'
      case 'Completed':
        return 'bg-blue-100 text-blue-800'
      case 'On Hold':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatCurrency = (amount) => {
    if (!amount) return '$0'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
  }

  const calculateDaysRemaining = (endDate) => {
    if (!endDate) return null
    const today = new Date()
    const end = new Date(endDate)
    const diffTime = end - today
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const handleEditProject = () => {
    setEditingProject({ ...project })
    setShowEditModal(true)
  }

  const handleUpdateProject = async (updatedData) => {
    const token = getCookie(TOKEN)
    if (!token) {
      setError('Authentication required')
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
      
      // Handle file upload or deletion
      let response
      if (updatedData.project_file || updatedData.delete_project_file) {
        // Use FormData for file uploads/deletions
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
        throw new Error('Failed to update project')
      }

      const data = await response.json()
      
      // Update state optimistically - no refetch needed
      if (data.project) {
        setProject(data.project)
      }
      
      setShowEditModal(false)
      setEditingProject(null)
      
      // Note: Using optimistic updates - no fetchProject() call needed
    } catch (err) {
      console.error('Error updating project:', err)
      setError('Failed to update project')
    } finally {
      setUpdatingProject(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100">
        <Header />
        <div className="w-[97%] mx-auto px-6 py-8">
          <LoadingSpinner message="Loading project details..." size="medium" />
        </div>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 m-6">
        <div className="text-red-800">Error: {error || 'Project not found'}</div>
        <button 
          onClick={() => navigate('/projects', { state: { activeTab: 'projects' } })}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Back to Projects
        </button>
      </div>
    )
  }

  const daysRemaining = calculateDaysRemaining(project.end_date)
  const budgetUtilization = project.budget && project.spent_budget 
    ? ((project.spent_budget / project.budget) * 100).toFixed(1)
    : 0

  return (
    <div className="min-h-screen bg-slate-100">
      <Header />
      
      <div className="w-[97%] mx-auto px-6 py-2">
        {/* Back Button */}
        <div className="mb-2">
          <button
            onClick={() => navigate('/projects', { state: { activeTab: 'projects' } })}
            className="text-slate-600 hover:text-slate-800 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/>
            </svg>
            Back to Projects
          </button>
        </div>

        {/* Project Header */}
        <div className="bg-white border border-slate-200 rounded-lg p-3 mb-2">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-semibold text-slate-900">{project.name}</h1>
              <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getStatusColor(project.status)}`}>
                {project.status}
              </span>
            </div>
            
            <div>
              <button 
                onClick={handleEditProject}
                disabled={!hasPermission('project-edit')}
                className={`${hasPermission('project-edit') ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'} px-3 py-1.5 text-xs text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed`}
                title={hasPermission('project-edit') ? "Edit Project" : "Edit Project (No Permission)"}
              >
                Edit Project
              </button>
            </div>
          </div>
        </div>

        {/* Detail Tabs */}
        <div className="bg-white border border-slate-200 rounded-lg mb-2">
          <div className="flex border-b border-slate-200">
            {['Summary', 'Team', 'Timeline', 'Budget', 'Risks', 'Documents'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab.toLowerCase())}
                className={`px-6 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.toLowerCase()
                    ? 'border-blue-600 text-blue-600 bg-blue-50'
                    : 'border-transparent text-slate-600 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'summary' && (
          <div className="space-y-6">
            {/* Project Overview */}
            <div className="bg-white border border-slate-200 rounded-lg">
              <div className="bg-slate-50 border-b border-slate-200 px-6 py-4">
                <h2 className="text-lg font-semibold text-slate-900">Project Overview</h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex">
                      <div className="w-32 text-sm font-medium text-slate-600">Client</div>
                      <div className="text-sm text-slate-900">{project.client || 'N/A'}</div>
                    </div>
                    <div className="flex">
                      <div className="w-32 text-sm font-medium text-slate-600">Timeline</div>
                      <div className="text-sm text-slate-900">
                        {formatDate(project.start_date)} - {formatDate(project.end_date)}
                        {daysRemaining !== null && (
                          <span className={`ml-2 text-xs px-2 py-1 rounded-full ${
                            daysRemaining < 0 ? 'bg-red-100 text-red-800' :
                            daysRemaining < 30 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {daysRemaining < 0 ? `${Math.abs(daysRemaining)} days overdue` :
                             daysRemaining === 0 ? 'Due today' :
                             `${daysRemaining} days remaining`}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex">
                      <div className="w-32 text-sm font-medium text-slate-600">Budget</div>
                      <div className="text-sm text-slate-900">
                        {formatCurrency(project.budget)} 
                        {project.spent_budget && (
                          <span className="text-slate-600 ml-2">
                            ({formatCurrency(project.spent_budget)} spent - {budgetUtilization}%)
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex">
                      <div className="w-32 text-sm font-medium text-slate-600">Priority</div>
                      <div className="text-sm text-slate-900">{project.priority || 'Medium'}</div>
                    </div>
                    <div className="flex">
                      <div className="w-32 text-sm font-medium text-slate-600">Type</div>
                      <div className="text-sm text-slate-900">{project.project_type || 'N/A'}</div>
                    </div>
                    {project.project_type === 'Customer Projects' && project.custom_project_type && (
                      <div className="flex">
                        <div className="w-32 text-sm font-medium text-slate-600">Customer Type</div>
                        <div className="text-sm text-slate-900">{project.custom_project_type}</div>
                      </div>
                    )}
                    <div className="flex">
                      <div className="w-32 text-sm font-medium text-slate-600">Practice</div>
                      <div className="text-sm text-slate-900">{project.practice || 'N/A'}</div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex">
                      <div className="w-32 text-sm font-medium text-slate-600">Progress</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-200 rounded-full h-2">
                            <div 
                              className="bg-green-500 h-2 rounded-full transition-all duration-300" 
                              style={{ width: `${project.progress_percentage}%` }}
                            ></div>
                          </div>
                          <span className="text-sm text-slate-600">{project.progress_percentage}%</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex">
                      <div className="w-32 text-sm font-medium text-slate-600">Team Size</div>
                      <div className="text-sm text-slate-900">
                        {getAllTeamMembers().length} members
                      </div>
                    </div>
                    <div className="flex">
                      <div className="w-32 text-sm font-medium text-slate-600">Created</div>
                      <div className="text-sm text-slate-900">{formatDate(project.created_at)}</div>
                    </div>
                    <div className="flex">
                      <div className="w-32 text-sm font-medium text-slate-600">Last Updated</div>
                      <div className="text-sm text-slate-900">{formatDate(project.updated_at)}</div>
                    </div>
                  </div>
                </div>
                {project.description && (
                  <div className="mt-6 pt-6 border-t border-slate-200">
                    <div className="text-sm font-medium text-slate-600 mb-2">Description</div>
                    <div className="text-sm text-slate-900 leading-relaxed">{project.description}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Team Allocation */}
            <div className="bg-white border border-slate-200 rounded-lg">
              <div className="bg-slate-50 border-b border-slate-200 px-6 py-4">
                <h2 className="text-lg font-semibold text-slate-900">Team Allocation (Current Week)</h2>
              </div>
              <div className="p-6">
                {(() => {
                  const currentWeekMembers = getCurrentWeekTeamMembers()
                  return currentWeekMembers.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {currentWeekMembers.map((member, index) => (
                        <div key={`${member.employee_id}-${index}`} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                          <div className="text-sm font-medium text-slate-900">{member.employee_name}</div>
                          <div className="text-sm text-slate-600 mb-2">{member.role}</div>
                          <div className="flex items-center justify-between">
                            <span className={`text-sm font-medium ${
                              member.allocation_percentage > 100 ? 'text-red-600' : 'text-slate-900'
                            }`}>
                              {member.allocation_percentage}%
                            </span>
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              member.status === 'Active' ? 'bg-green-100 text-green-800' :
                              member.status === 'Planning' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {member.status}
                            </span>
                          </div>
                          {member.start_date && (
                            <div className="text-xs text-slate-500 mt-2">
                              {formatDate(member.start_date)} - {member.end_date ? formatDate(member.end_date) : 'Ongoing'}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <svg className="mx-auto h-12 w-12 text-slate-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
                      </svg>
                      <h3 className="text-sm font-medium text-slate-900 mb-1">No team members assigned for current week</h3>
                      <p className="text-sm text-slate-500">This project doesn't have any team members allocated for the current week.</p>
                    </div>
                  )
                })()}
              </div>
            </div>

            {/* Timeline and Milestones */}
            {/* <div className="bg-white border border-slate-200 rounded-lg">
              <div className="bg-slate-50 border-b border-slate-200 px-6 py-4">
                <h2 className="text-lg font-semibold text-slate-900">Timeline & Milestones</h2>
              </div>
              <div className="p-6">
                <div className="bg-slate-50 border border-dashed border-slate-300 rounded-lg p-8 text-center">
                  <div className="text-lg font-semibold text-slate-700 mb-3">Project Timeline</div>
                  <div className="text-sm text-slate-600 leading-relaxed">
                    This section will display a visual timeline of project milestones:
                    <ul className="text-left mt-3 space-y-1">
                      <li>• Milestone name, deadline, and current status</li>
                      <li>• Owner and dependencies</li>
                      <li>• Completion percentage and indicators</li>
                      <li>• Critical path visualization</li>
                    </ul>
                    The timeline will provide a visual representation of project progress and upcoming deadlines.
                  </div>
                </div>
              </div>
            </div> */}
          </div>
        )}

        {activeTab === 'team' && (
          <div className="space-y-6">
            {/* Current Week Team Allocation */}
            <div className="bg-white border border-slate-200 rounded-lg">
              <div className="bg-slate-50 border-b border-slate-200 px-6 py-4">
                <h2 className="text-lg font-semibold text-slate-900">Current Week Team Allocation</h2>
              </div>
              <div className="p-6">
                {(() => {
                  const currentWeekMembers = getCurrentWeekTeamMembers()
                  return currentWeekMembers.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {currentWeekMembers.map((member, index) => (
                        <div key={`current-${member.employee_id}-${index}`} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="text-sm font-medium text-slate-900">{member.employee_name}</div>
                              <div className="text-sm text-slate-600">{member.role}</div>
                            </div>
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              member.status === 'Active' ? 'bg-green-100 text-green-800' :
                              member.status === 'Planning' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {member.status}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className={`text-sm font-medium ${
                              member.allocation_percentage > 100 ? 'text-red-600' : 'text-slate-900'
                            }`}>
                              {member.allocation_percentage}% allocation
                            </span>
                            {member.allocation_percentage > 100 && (
                              <span className="text-xs text-red-600 font-medium">Over-allocated</span>
                            )}
                          </div>
                          {member.start_date && (
                            <div className="text-xs text-slate-500 mt-2">
                              {formatDate(member.start_date)} - {member.end_date ? formatDate(member.end_date) : 'Ongoing'}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <svg className="mx-auto h-12 w-12 text-slate-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
                      </svg>
                      <h3 className="text-sm font-medium text-slate-900 mb-1">No team members assigned for current week</h3>
                      <p className="text-sm text-slate-500">This project doesn't have any team members allocated for the current week.</p>
                    </div>
                  )
                })()}
              </div>
            </div>

            {/* Overall Team Allocation */}
            <div className="bg-white border border-slate-200 rounded-lg">
              <div className="bg-slate-50 border-b border-slate-200 px-6 py-4">
                <h2 className="text-lg font-semibold text-slate-900">Overall Team Allocation</h2>
              </div>
              <div className="p-6">
                {(() => {
                  const allTeamMembers = getAllTeamMembers()
                  return allTeamMembers.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {allTeamMembers.map((member, index) => (
                        <div key={`overall-${member.employee_id}-${index}`} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="text-sm font-medium text-slate-900">{member.employee_name}</div>
                              <div className="text-sm text-slate-600">{member.role}</div>
                            </div>
                            <span className={`px-2 y-1 text-xs rounded-full ${
                              member.status === 'Active' ? 'bg-green-100 text-green-800' :
                              member.status === 'Planning' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {member.status}
                            </span>
                          </div>
                          {/* <div className="flex items-center justify-between">
                            <span className={`text-sm font-medium ${
                              member.allocation_percentage > 100 ? 'text-red-600' : 'text-slate-900'
                            }`}>
                              {member.allocation_percentage}% allocation
                            </span>
                            {member.allocation_percentage > 100 && (
                              <span className="text-xs text-red-600 font-medium">Over-allocated</span>
                            )}
                          </div> */}
                          {/* {member.start_date && (
                            <div className="text-xs text-slate-500 mt-2">
                              {formatDate(member.start_date)} - {member.end_date ? formatDate(member.end_date) : 'Ongoing'}
                            </div>
                          )} */}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <svg className="mx-auto h-12 w-12 text-slate-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
                      </svg>
                      <h3 className="text-sm font-medium text-slate-900 mb-1">No team members assigned</h3>
                      <p className="text-sm text-slate-500">This project doesn't have any team members allocated.</p>
                    </div>
                  )
                })()}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="bg-white border border-slate-200 rounded-lg p-6">
            <ProjectGantt projectId={id} project={project} />
          </div>
        )}

        {activeTab === 'budget' && (
          <div className="bg-white border border-slate-200 rounded-lg p-6">
            <div className="text-center py-8">
              <div className="text-lg font-semibold text-slate-700 mb-3">Budget Management</div>
              <div className="text-sm text-slate-600">
                This section will provide detailed budget breakdown, expense tracking, and financial reporting.
              </div>
            </div>
          </div>
        )}

        {activeTab === 'risks' && (
          <div className="bg-white border border-slate-200 rounded-lg p-6">
            <div className="text-center py-8">
              <div className="text-lg font-semibold text-slate-700 mb-3">Risk Management</div>
              <div className="text-sm text-slate-600">
                This section will track project risks, mitigation strategies, and risk assessment reports.
              </div>
            </div>
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="bg-white border border-slate-200 rounded-lg p-6">
            <div className="text-center py-8">
              <div className="text-lg font-semibold text-slate-700 mb-3">Project Documents</div>
              <div className="text-sm text-slate-600">
                This section will manage project documents, files, and documentation with version control.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Edit Project Modal */}
      {showEditModal && editingProject && (
        <EditProjectModal
          project={editingProject}
          onUpdate={handleUpdateProject}
          onCancel={() => {
            setShowEditModal(false)
            setEditingProject(null)
          }}
          updatingProject={updatingProject}
          employees={employees}
          customers={customers}
          availablePractices={availablePractices}
        />
      )}
    </div>
  )
}

// Edit Project Modal Component
const EditProjectModal = ({ project, onUpdate, onCancel, updatingProject, employees, customers = [], availablePractices = [] }) => {
  // Check if the current practice is in the available practices list
  const isCustomPractice = project.practice && !availablePractices.includes(project.practice)
  
  const [editData, setEditData] = useState({ 
    ...project,
    spent_budget: project.spent_budget || 0,
    practice: isCustomPractice ? 'Others' : project.practice || '',
    practice_other: isCustomPractice ? project.practice : '',
    priority: project.priority || 'Medium' // Default to Medium if no priority is set
  })
  
  // Track files to delete temporarily (only delete when Save is clicked)
  const [filesToDelete, setFilesToDelete] = useState(false)
  // Track newly selected file
  const [selectedFile, setSelectedFile] = useState(null)
  // File input ref to clear it
  const fileInputRef = useRef(null)

  // State for customer search in edit modal
  const [customerSearchTerm, setCustomerSearchTerm] = useState('')
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)

  const handleSave = () => {
    // Include file deletion and new file in editData when saving
    const dataToSave = {
      ...editData,
      delete_project_file: filesToDelete,
      project_file: selectedFile
    }
    onUpdate(dataToSave)
  }
  
  const handleFileSelect = (e) => {
    const file = e.target.files && e.target.files[0]
    if (file) {
      setSelectedFile(file)
      setFilesToDelete(false) // If new file selected, don't delete existing
    }
  }
  
  const handleDeleteExistingFile = () => {
    // Mark existing file for deletion, but DO NOT clear newly selected file
    // so that users can delete old + keep new in the same edit session
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

  const formatCurrency = (amount) => {
    if (!amount) return '$0'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold mb-4">Edit Project</h3>
        <div className="space-y-4">
          {/* Project Files */}
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
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Project Name</label>
            <input
              type="text"
              value={editData.name}
              onChange={(e) => setEditData({...editData, name: e.target.value})}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              value={editData.description || ''}
              onChange={(e) => setEditData({...editData, description: e.target.value})}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows="3"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select
                value={editData.status}
                onChange={(e) => setEditData({...editData, status: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Planning">Planning</option>
                <option value="Active">Active</option>
                <option value="Completed">Completed</option>
                <option value="On Hold">On Hold</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
              <select
                value={editData.priority || 'Medium'}
                onChange={(e) => setEditData({...editData, priority: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
              <input
                type="date"
                value={editData.start_date}
                onChange={(e) => setEditData({...editData, start_date: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
              <input
                type="date"
                value={editData.end_date || ''}
                onChange={(e) => setEditData({...editData, end_date: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Progress (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              value={editData.progress_percentage}
              onChange={(e) => setEditData({...editData, progress_percentage: parseInt(e.target.value)})}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
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
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter spent amount"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Project Type</label>
            <select
              value={editData.project_type || ''}
              onChange={(e) => setEditData({...editData, project_type: e.target.value, custom_project_type: '', customer_id: null})}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <select
              value={editData.practice || ''}
              onChange={(e) => setEditData({...editData, practice: e.target.value})}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Practice</option>
              {availablePractices.map(practice => (
                <option key={practice} value={practice}>{practice}</option>
              ))}
              <option value="Others">Others</option>
            </select>
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Project Manager</label>
              <select
                value={editData.project_manager_id || ''}
                onChange={(e) => setEditData({...editData, project_manager_id: e.target.value ? parseInt(e.target.value) : null})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Project Manager</option>
                {employees
                  .filter(employee => {
                    // Filter to show only active employees
                    return (employee.employee_status || 'Active') === 'Active'
                  })
                  .map(employee => (
                    <option key={employee.id} value={employee.id}>
                      {employee.first_name} {employee.last_name} - {employee.designation}
                    </option>
                  ))}
              </select>
            </div>
            
          </div>
        </div>
        <div className="flex justify-end space-x-3 mt-6">
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
  )
}

export default ProjectDetails
