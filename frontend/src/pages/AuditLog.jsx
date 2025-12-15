import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { usePermissions } from '../context/PermissionContext.jsx'
import Header from '../components/Header.jsx'
import { getCookie } from '../utils/helpers.js'
import { TOKEN } from '../utils/constants.js'
import { getApiBaseUrl } from '../utils/constants.js'

const AuditLog = () => {
  const { user } = useAuth()
  const { hasPermission, loading: permissionsLoading } = usePermissions()
  const [allAuditLogs, setAllAuditLogs] = useState([]) // Store all data
  const [filteredAuditLogs, setFilteredAuditLogs] = useState([]) // Filtered data for display
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({
    action_type: '',
    page_name: '',
    start_date: '',
    end_date: ''
  })
  const [pagination, setPagination] = useState({
    current_page: 1,
    per_page: 40,
    total_count: 0,
    total_pages: 0,
    has_next: false,
    has_prev: false
  })
  const [stats, setStats] = useState(null)
  const [showFilters, setShowFilters] = useState(false)
  const [availablePages, setAvailablePages] = useState([])

  // Fetch ALL audit logs (no pagination, no filters)
  const fetchAllAuditLogs = async () => {
    try {
      setLoading(true)
      const token = getCookie(TOKEN)
      
      console.log('Fetching ALL audit logs with token:', token ? 'Token exists' : 'No token')
      
      if (!token) {
        setError('Please log in to view audit logs.')
        setLoading(false)
        return
      }
      
      // Fetch ALL data without pagination or filters
      const apiBaseUrl = getApiBaseUrl()
      const apiUrl = `${apiBaseUrl}/api/audit-logs?per_page=100` // Max allowed by backend
      console.log('API URL:', apiUrl)
      
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      console.log('Response status:', response.status)
      
      if (!response.ok) {
        let errorData
        try {
          errorData = await response.json()
        } catch (parseError) {
          console.error('Failed to parse error response:', parseError)
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        
        console.log('Error response:', errorData)
        
        if (errorData.code === 'TABLE_NOT_FOUND') {
          setError('Audit log table not found. Please run database migration to enable audit logging.')
          return
        }
        if (errorData.code === 'NO_TOKEN' || errorData.code === 'INVALID_TOKEN') {
          setError('Please log in to view audit logs.')
          return
        }
        throw new Error(errorData.error || 'Failed to fetch audit logs')
      }
      
      const data = await response.json()
      console.log('All audit logs data:', data)
      console.log('All audit logs array:', data.audit_logs)
      console.log('Total count from API:', data.pagination?.total_count)
      console.log('Number of records returned:', data.audit_logs?.length)
      
      // Check if we need to fetch more pages
      const totalCount = data.pagination?.total_count || 0
      const currentRecords = data.audit_logs || []
      const totalPages = data.pagination?.total_pages || 1
      
      console.log(`Total records in DB: ${totalCount}, Current page records: ${currentRecords.length}, Total pages: ${totalPages}`)
      
      let allRecords = [...currentRecords]
      
      // If there are more pages, fetch them
      if (totalPages > 1) {
        console.log(`Fetching additional pages (2 to ${totalPages})...`)
        for (let page = 2; page <= totalPages; page++) {
          try {
            const pageUrl = `${apiBaseUrl}/api/audit-logs?per_page=100&page=${page}`
            console.log(`Fetching page ${page}:`, pageUrl)
            
            const pageResponse = await fetch(pageUrl, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            })
            
            if (pageResponse.ok) {
              const pageData = await pageResponse.json()
              console.log(`Page ${page} records:`, pageData.audit_logs?.length)
              allRecords = [...allRecords, ...(pageData.audit_logs || [])]
            } else {
              console.error(`Failed to fetch page ${page}:`, pageResponse.status)
            }
          } catch (pageErr) {
            console.error(`Error fetching page ${page}:`, pageErr)
          }
        }
      }
      
      console.log(`Total records fetched: ${allRecords.length}`)
      
      // Store all data
      setAllAuditLogs(allRecords)
      
      // Apply current filters to the new data
      applyFilters(allRecords)
      
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Fetch available pages
  const fetchAvailablePages = async () => {
    try {
      const token = getCookie(TOKEN)
      if (!token) {
        console.log('No token available for fetching pages')
        return
      }
      
      const apiBaseUrl = getApiBaseUrl()
      const pagesUrl = `${apiBaseUrl}/api/audit-logs/pages`
      console.log('Fetching available pages from:', pagesUrl)
      
      const response = await fetch(pagesUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      console.log('Pages response status:', response.status)
      
      if (response.ok) {
        const data = await response.json()
        console.log('Available pages data:', data)
        setAvailablePages(data.pages || [])
        console.log('Set available pages:', data.pages || [])
      } else {
        console.error('Failed to fetch available pages:', response.status)
        const errorData = await response.json()
        console.error('Pages error response:', errorData)
      }
    } catch (err) {
      console.error('Error fetching available pages:', err)
      // Don't fallback to current data - we want ALL pages, not filtered ones
    }
  }

  // Fetch audit statistics
  const fetchStats = async () => {
    try {
      const token = getCookie(TOKEN)
      console.log('Fetching stats with token:', token ? 'Token exists' : 'No token')
      
      if (!token) {
        console.log('No token available for stats')
        return
      }
      
      const apiBaseUrl = getApiBaseUrl()
      const statsUrl = `${apiBaseUrl}/api/audit-logs/stats`
      console.log('Stats API URL:', statsUrl)
      
      const response = await fetch(statsUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      console.log('Stats response status:', response.status)
      
      if (response.ok) {
        const data = await response.json()
        // Process stats to group action types
        const processedStats = {
          ...data,
          actions_by_type: {
            CREATE: (data.actions_by_type?.CREATE || 0) + (data.actions_by_type?.BULK_IMPORT || 0),
            EDIT: (data.actions_by_type?.EDIT || 0) + (data.actions_by_type?.ASSIGN_HIERARCHY || 0) + (data.actions_by_type?.UNASSIGN_HIERARCHY || 0),
            DELETE: data.actions_by_type?.DELETE || 0
          }
        }
        setStats(processedStats)
      } else {
        const errorData = await response.json()
        if (errorData.code === 'TABLE_NOT_FOUND') {
          setError('Audit log table not found. Please run database migration to enable audit logging.')
        }
      }
    } catch (err) {
      console.error('Error fetching stats:', err)
      setError('Failed to connect to audit log service. Please check if the backend is running.')
    }
  }

  // Client-side filtering function
  const applyFilters = (dataToFilter = allAuditLogs) => {
    console.log('Applying filters to data:', dataToFilter.length, 'records')
    console.log('Current filters:', filters)
    
    let filtered = [...dataToFilter]
    
    // Filter by action type
    if (filters.action_type) {
      filtered = filtered.filter(log => log.action_performed === filters.action_type)
    }
    
    // Filter by page name
    if (filters.page_name) {
      filtered = filtered.filter(log => log.action_page === filters.page_name)
    }
    
    // Filter by start date
    if (filters.start_date) {
      const startDate = new Date(filters.start_date)
      filtered = filtered.filter(log => new Date(log.timestamp) >= startDate)
    }
    
    // Filter by end date
    if (filters.end_date) {
      const endDate = new Date(filters.end_date)
      filtered = filtered.filter(log => new Date(log.timestamp) <= endDate)
    }
    
    console.log('Filtered results:', filtered.length, 'records')
    
    // Sort by timestamp (newest first)
    filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    
    // Update filtered data
    setFilteredAuditLogs(filtered)
    
    // Update pagination for display
    const totalPages = Math.ceil(filtered.length / pagination.per_page)
    setPagination(prev => ({
      ...prev,
      current_page: 1,
      total_count: filtered.length,
      total_pages: totalPages,
      has_next: totalPages > 1,
      has_prev: false
    }))
  }

  // Handle filter changes - apply immediately
  const handleFilterChange = (key, value) => {
    const newFilters = {
      ...filters,
      [key]: value
    }
    setFilters(newFilters)
    
    // Apply filters immediately with new filter values
    applyFiltersWithFilters(newFilters)
  }

  // Apply filters with specific filter values
  const applyFiltersWithFilters = (filterValues = filters) => {
    console.log('Applying filters immediately to data:', allAuditLogs.length, 'records')
    console.log('Filter values:', filterValues)
    
    let filtered = [...allAuditLogs]
    
    // Filter by action type
    if (filterValues.action_type) {
      filtered = filtered.filter(log => log.action_performed === filterValues.action_type)
    }
    
    // Filter by page name
    if (filterValues.page_name) {
      filtered = filtered.filter(log => log.action_page === filterValues.page_name)
    }
    
    // Filter by start date
    if (filterValues.start_date) {
      const startDate = new Date(filterValues.start_date)
      filtered = filtered.filter(log => new Date(log.timestamp) >= startDate)
    }
    
    // Filter by end date
    if (filterValues.end_date) {
      const endDate = new Date(filterValues.end_date)
      filtered = filtered.filter(log => new Date(log.timestamp) <= endDate)
    }
    
    console.log('Filtered results:', filtered.length, 'records')
    
    // Sort by timestamp (newest first)
    filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    
    // Update filtered data
    setFilteredAuditLogs(filtered)
    
    // Update pagination for display
    const totalPages = Math.ceil(filtered.length / pagination.per_page)
    setPagination(prev => ({
      ...prev,
      current_page: 1,
      total_count: filtered.length,
      total_pages: totalPages,
      has_next: totalPages > 1,
      has_prev: false
    }))
  }

  // Clear filters
  const clearFilters = () => {
    const clearedFilters = {
      action_type: '',
      page_name: '',
      start_date: '',
      end_date: ''
    }
    setFilters(clearedFilters)
    // Apply filters with cleared values immediately
    applyFiltersWithFilters(clearedFilters)
  }

  // Handle pagination (client-side)
  const handlePageChange = (newPage) => {
    setPagination(prev => ({ 
      ...prev, 
      current_page: newPage,
      has_prev: newPage > 1,
      has_next: newPage < prev.total_pages
    }))
  }

  // Get paginated data for display
  const getPaginatedData = () => {
    const startIndex = (pagination.current_page - 1) * pagination.per_page
    const endIndex = startIndex + pagination.per_page
    return filteredAuditLogs.slice(startIndex, endIndex)
  }


  // Format timestamp
  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString()
  }

  // Format action type for display
  const formatActionType = (action) => {
    switch (action) {
      case 'CREATE':
        return 'Create'
      case 'EDIT':
        return 'Edit'
      case 'DELETE':
        return 'Delete'
      case 'BULK_IMPORT':
        return 'BULK IMPORT'
      case 'ASSIGN_HIERARCHY':
        return 'ASSIGN HIERARCHY'
      case 'UNASSIGN_HIERARCHY':
        return 'UNASSIGN HIERARCHY'
      default:
        return action
    }
  }

  // Get action color
  const getActionColor = (action) => {
    switch (action) {
      case 'CREATE':
        return 'text-green-600 bg-green-100'
      case 'EDIT':
        return 'text-green-700 bg-green-100'
      case 'DELETE':
        return 'text-red-600 bg-red-100'
      case 'BULK_IMPORT':
        return 'text-purple-600 bg-purple-100'
      case 'ASSIGN_HIERARCHY':
        return 'text-blue-600 bg-blue-100'
      case 'UNASSIGN_HIERARCHY':
        return 'text-orange-600 bg-orange-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  useEffect(() => {
    console.log('AuditLog component mounted')
    console.log('User from context:', user)
    console.log('Is user logged in:', !!user)
    
    // Only fetch data if user has permission and permissions are loaded
    if (!permissionsLoading && hasPermission('audit-log-view')) {
      fetchAllAuditLogs()
      fetchStats()
      fetchAvailablePages()
    }
  }, [permissionsLoading]) // Only depend on permissionsLoading, check permission inside

  // Apply filters when allAuditLogs changes
  useEffect(() => {
    if (allAuditLogs.length > 0) {
      applyFilters()
    }
  }, [allAuditLogs])

  // Show loader while permissions are being fetched
  if (permissionsLoading) {
    return (
      <div className="min-h-screen bg-slate-100">
        <Header />
        <div className="w-[97%] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-700 mx-auto mb-4"></div>
              <p className="text-slate-600">Loading Audit Log...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Check permissions - only after loading is complete
  if (!hasPermission('audit-log-view')) {
    return (
      <div className="min-h-screen bg-slate-100">
        <Header />
        <div className="w-[97%] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
            <div className="mx-auto w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Access Denied</h2>
            <p className="text-slate-600">You don't have permission to view Audit Log.</p>
            <p className="text-sm text-slate-400 mt-2">Please contact your administrator for access.</p>
          </div>
        </div>
      </div>
    )
  }

  if (loading && allAuditLogs.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-700 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading audit logs...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
        {/* Header */}
        <div className="mb-2">
          <h1 className="text-xl font-bold text-gray-900">Audit Log</h1>
          <p className="mt-2 text-gray-600">
            Track all your actions across the system
          </p>
        </div>

        {/* Statistics Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-2">
            <div className="bg-white rounded-lg shadow p-2">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total Actions</p>
                  <p className="text-medium font-semibold text-gray-900">{stats.total_actions}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-2">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Created</p>
                  <p className="text-medium font-semibold text-gray-900">{stats.actions_by_type.CREATE || 0}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-2">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Edited</p>
                  <p className="text-medium font-semibold text-gray-900">{stats.actions_by_type.EDIT || 0}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-2">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Deleted</p>
                  <p className="text-medium font-semibold text-gray-900">{stats.actions_by_type.DELETE || 0}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters and Actions */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Audit Logs</h2>
              <div className="flex space-x-3 mt-4 sm:mt-0">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.414A1 1 0 013 6.707V4z" />
                  </svg>
                  Filters
                </button>
                <button
                  onClick={() => {
                    fetchAllAuditLogs()
                    fetchStats()
                    fetchAvailablePages()
                  }}
                  disabled={loading}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {loading ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>
            </div>

            {/* Filters Panel */}
            {showFilters && (
              <div className="border-t pt-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Action Type</label>
                    <select
                      value={filters.action_type}
                      onChange={(e) => handleFilterChange('action_type', e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    >
                      <option value="">All Actions</option>
                      <option value="CREATE">Create</option>
                      <option value="EDIT">Edit</option>
                      <option value="DELETE">Delete</option>
                      <option value="BULK_IMPORT">Bulk Import</option>
                      <option value="ASSIGN_HIERARCHY">Assign Hierarchy</option>
                      <option value="UNASSIGN_HIERARCHY">Unassign Hierarchy</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Page</label>
                    <select
                      value={filters.page_name}
                      onChange={(e) => handleFilterChange('page_name', e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    >
                      <option value="">All Pages</option>
                      {availablePages.map((page) => (
                        <option key={page} value={page}>
                          {page}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                    <input
                      type="datetime-local"
                      value={filters.start_date}
                      onChange={(e) => handleFilterChange('start_date', e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                    <input
                      type="datetime-local"
                      value={filters.end_date}
                      onChange={(e) => handleFilterChange('end_date', e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-3 mt-4">
                  <button
                    onClick={clearFilters}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                  >
                    Clear All Filters
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-2 text-sm text-red-700">{error}</div>
              </div>
            </div>
          </div>
        )}

        {/* Audit Logs Table */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action Page
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action Performed
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Timestamp
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {getPaginatedData().map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {log.user_name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {log.user_email || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {log.action_page || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getActionColor(log.action_performed)}`}>
                        {formatActionType(log.action_performed)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatTimestamp(log.timestamp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Empty State */}
          {filteredAuditLogs.length === 0 && !loading && (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No audit logs found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {Object.values(filters).some(f => f) 
                  ? 'Try adjusting your filters to see more results.'
                  : 'Your activity will appear here as you use the system.'
                }
              </p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {filteredAuditLogs.length > 0 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 mt-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => handlePageChange(pagination.current_page - 1)}
                disabled={!pagination.has_prev}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => handlePageChange(pagination.current_page + 1)}
                disabled={!pagination.has_next}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing{' '}
                  <span className="font-medium">
                    {((pagination.current_page - 1) * pagination.per_page) + 1}
                  </span>{' '}
                  to{' '}
                  <span className="font-medium">
                    {Math.min(pagination.current_page * pagination.per_page, pagination.total_count)}
                  </span>{' '}
                  of{' '}
                  <span className="font-medium">{pagination.total_count}</span>{' '}
                  results
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  {/* First page button */}
                  <button
                    onClick={() => handlePageChange(1)}
                    disabled={pagination.current_page === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="First page"
                  >
                    <span className="sr-only">First</span>
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M15.707 15.707a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 010 1.414zm-6 0a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 011.414 1.414L5.414 10l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                  
                  {/* Previous page button */}
                  <button
                    onClick={() => handlePageChange(pagination.current_page - 1)}
                    disabled={!pagination.has_prev}
                    className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Previous page"
                  >
                    <span className="sr-only">Previous</span>
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                  
                  {/* Page numbers */}
                  {(() => {
                    const pages = []
                    const totalPages = pagination.total_pages
                    const currentPage = pagination.current_page
                    
                    // Show up to 5 page numbers
                    let startPage = Math.max(1, currentPage - 2)
                    let endPage = Math.min(totalPages, currentPage + 2)
                    
                    // Adjust if we're near the beginning or end
                    if (endPage - startPage < 4) {
                      if (startPage === 1) {
                        endPage = Math.min(totalPages, startPage + 4)
                      } else {
                        startPage = Math.max(1, endPage - 4)
                      }
                    }
                    
                    for (let i = startPage; i <= endPage; i++) {
                      pages.push(
                        <button
                          key={i}
                          onClick={() => handlePageChange(i)}
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                            i === currentPage
                              ? 'z-10 bg-green-700 border-green-700 text-white'
                              : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          {i}
                        </button>
                      )
                    }
                    
                    return pages
                  })()}
                  
                  {/* Next page button */}
                  <button
                    onClick={() => handlePageChange(pagination.current_page + 1)}
                    disabled={!pagination.has_next}
                    className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Next page"
                  >
                    <span className="sr-only">Next</span>
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                  
                  {/* Last page button */}
                  <button
                    onClick={() => handlePageChange(pagination.total_pages)}
                    disabled={pagination.current_page === pagination.total_pages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Last page"
                  >
                    <span className="sr-only">Last</span>
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414zm6 0a1 1 0 011.414 0l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414-1.414L14.586 10l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </nav>
                
                {/* Page input and total items */}
                <div className="flex items-center space-x-2 ml-4">
                  <input
                    type="number"
                    min="1"
                    max={pagination.total_pages}
                    value={pagination.current_page}
                    onChange={(e) => {
                      const page = parseInt(e.target.value)
                      if (page >= 1 && page <= pagination.total_pages) {
                        handlePageChange(page)
                      }
                    }}
                    className="w-16 px-2 py-1 text-sm border border-gray-300 rounded text-center"
                    placeholder="Page"
                  />
                  <span className="text-sm text-gray-500">
                    of {pagination.total_count} items
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AuditLog
