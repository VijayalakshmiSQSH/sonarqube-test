import React, { useState, useEffect, useRef } from 'react'
import { getCookie } from '../utils/helpers.js'
import { TOKEN, getApiBaseUrl } from '../utils/constants.js'
import { usePermissions } from '../context/PermissionContext.jsx'

/**
 * SavedFiltersManager Component
 * Allows users to save, load, and delete custom filter combinations
 * @param {string} mode - 'create' (shows only Create Filter button) or 'apply' (shows only saved filters pills) or 'full' (shows both)
 * @param {function} onFiltersChanged - Callback function when filters are created/deleted to notify parent
 * @param {number} refreshTrigger - External trigger to force refresh (increment this value to refresh)
 */
const SavedFiltersManager = ({ 
  currentFilters, 
  onApplyFilter, 
  pageContext = 'overall_utilization',
  className = '',
  mode = 'full', // 'create', 'apply', or 'full'
  onFiltersChanged = null, // Callback when filters are created/deleted
  refreshTrigger = 0 // External trigger to force refresh
}) => {
  const { hasPermission } = usePermissions()
  const [savedFilters, setSavedFilters] = useState([])
  const [loading, setLoading] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [filterName, setFilterName] = useState('')
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [activeFilterId, setActiveFilterId] = useState(null)
  
  const modalRef = useRef(null)

  // Close modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        setShowCreateModal(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fetch saved filters on component mount and when refreshTrigger changes
  useEffect(() => {
    fetchSavedFilters()
  }, [pageContext, refreshTrigger])

  // Fetch saved filters from API
  const fetchSavedFilters = async () => {
    const token = getCookie(TOKEN)
    if (!token) return

    try {
      const response = await fetch(
        `${getApiBaseUrl()}/api/saved-filters?page_context=${pageContext}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (response.ok) {
        const data = await response.json()
        setSavedFilters(data.filters || [])
      }
    } catch (err) {
      console.error('Error fetching saved filters:', err)
    }
  }

  // Show notification
  const showNotification = (message, isError = false) => {
    if (isError) {
      setError(message)
      setTimeout(() => setError(''), 5000)
    } else {
      setSuccessMessage(message)
      setTimeout(() => setSuccessMessage(''), 3000)
    }
  }

  // Create a new saved filter
  const handleCreateFilter = async () => {
    if (!filterName.trim()) {
      showNotification('Please enter a filter name', true)
      return
    }

    const token = getCookie(TOKEN)
    console.log('JWT Token:', token ? 'Present' : 'Missing')
    if (!token) {
      showNotification('Authentication required', true)
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/saved-filters`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filter_name: filterName,
          page_context: pageContext,
          filters: currentFilters
        })
      })

      console.log('Response status:', response.status)
      console.log('Response headers:', response.headers)
      
      if (response.ok) {
        showNotification('Filter saved successfully!')
        setFilterName('')
        setShowCreateModal(false)
        fetchSavedFilters()
        // Notify parent component that filters have changed
        if (onFiltersChanged) {
          onFiltersChanged()
        }
      } else {
        const data = await response.json()
        console.log('Error response:', data)
        showNotification(data.error || 'Failed to save filter', true)
      }
    } catch (err) {
      showNotification('Error saving filter', true)
    } finally {
      setLoading(false)
    }
  }

  // Apply or clear a saved filter (toggle)
  const handleApplyFilter = (filter) => {
    if (!filter.filter_values) return

    if (activeFilterId === filter.id) {
      // Filter is already active, clear it
      const emptyFilters = {}
      filter.filter_values.forEach(fv => {
        // Set each filter key to empty/default value
        if (Array.isArray(fv.filter_value)) {
          emptyFilters[fv.filter_key] = []
        } else if (typeof fv.filter_value === 'object' && fv.filter_value !== null) {
          emptyFilters[fv.filter_key] = {}
        } else {
          emptyFilters[fv.filter_key] = null
        }
      })
      onApplyFilter(emptyFilters)
      setActiveFilterId(null)
      showNotification(`Cleared filter: ${filter.filter_name}`)
    } else {
      // Apply the filter
      const filtersObject = {}
      filter.filter_values.forEach(fv => {
        filtersObject[fv.filter_key] = fv.filter_value
      })
      onApplyFilter(filtersObject)
      setActiveFilterId(filter.id)
      showNotification(`Applied filter: ${filter.filter_name}`)
    }
  }

  // Delete a saved filter
  const handleDeleteFilter = async (filterId, filterName) => {
    if (!window.confirm(`Are you sure you want to delete "${filterName}"?`)) {
      return
    }

    const token = getCookie(TOKEN)
    console.log('Delete filter - JWT Token:', token ? 'Present' : 'Missing')
    console.log('Delete filter - Filter ID:', filterId)
    
    if (!token) {
      showNotification('Authentication required', true)
      return
    }

    try {
      console.log(`Deleting filter ${filterId}...`)
      const response = await fetch(`${getApiBaseUrl()}/api/saved-filters/${filterId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      console.log('Delete response status:', response.status)
      
      if (response.ok) {
        const data = await response.json()
        console.log('Delete successful:', data)
        showNotification('Filter deleted successfully!')
        fetchSavedFilters()
        // Notify parent component that filters have changed
        if (onFiltersChanged) {
          onFiltersChanged()
        }
      } else {
        const errorData = await response.json()
        console.error('Delete failed:', errorData)
        showNotification(errorData.error || 'Failed to delete filter', true)
      }
    } catch (err) {
      console.error('Delete error:', err)
      showNotification('Error deleting filter', true)
    }
  }

  // Check if current filters are applied
  const hasActiveFilters = () => {
    if (!currentFilters) return false
    return Object.values(currentFilters).some(value => {
      if (Array.isArray(value)) return value.length > 0
      return value !== '' && value !== null && value !== undefined
    })
  }

  // Get title for create filter button
  const getTitle = () => {
    if (!hasPermission('utilization-filters-create')) {
      return 'Insufficient permissions to create filters'
    }
    if (hasActiveFilters()) {
      return 'Save current filter combination'
    }
    return 'Apply some filters first'
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Notifications */}
      {successMessage && (
        <div className="fixed top-4 right-4 z-50 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg shadow-lg animate-fade-in">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">{successMessage}</span>
          </div>
        </div>
      )}

      {error && (
        <div className="fixed top-4 right-4 z-50 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg shadow-lg animate-fade-in">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">{error}</span>
          </div>
        </div>
      )}

      {/* Create Filter Button - Only show in 'create' or 'full' mode */}
      {(mode === 'create' || mode === 'full') && (
        <button
          onClick={() => setShowCreateModal(true)}
          disabled={!hasActiveFilters() || !hasPermission('utilization-filters-create')}
          className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 border ${
            hasActiveFilters() && hasPermission('utilization-filters-create')
              ? 'bg-green-700 text-white border-green-700 hover:bg-green-800'
              : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
          }`}
          title={getTitle()}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/>
          </svg>
          Create Filter
        </button>
      )}

      {/* Custom Filters Label and Pills - Only show in 'apply' or 'full' mode */}
      {(mode === 'apply' || mode === 'full') && (
        <>
          {/* Custom Filters Label */}
          {savedFilters.length > 0 && (
            <div className="flex items-center gap-1 text-sm font-medium text-slate-600 px-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/>
              </svg>
              <span>Custom Filters:</span>
            </div>
          )}

          {/* Saved Filters as Horizontal Pills */}
          {savedFilters.map((filter) => {
            const isActive = activeFilterId === filter.id
            return (
              <div
                key={filter.id}
                className={`group inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 border cursor-pointer ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 border-blue-500'
                    : 'bg-white text-slate-700 border-slate-300 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700'
                }`}
              >
                <button
                  onClick={() => handleApplyFilter(filter)}
                  className="flex items-center"
                  title={isActive ? 'Click to clear filter' : `Click to apply (${filter.filter_values?.length || 0} filters)`}
                >
                  {filter.filter_name}
                </button>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteFilter(filter.id, filter.filter_name)
                  }}
                  className="p-0.5 text-slate-400 hover:text-red-600 rounded transition-colors"
                  title="Delete filter"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            )
          })}
        </>
      )}

      {/* Create Filter Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div
            ref={modalRef}
            className="bg-white rounded-lg shadow-xl max-w-md w-full animate-fade-in"
          >
            <div className="p-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">Create Custom Filter</h2>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Filter Name
                </label>
                <input
                  type="text"
                  value={filterName}
                  onChange={(e) => setFilterName(e.target.value)}
                  placeholder="e.g., DevOps Filter"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateFilter()
                    if (e.key === 'Escape') {
                      setShowCreateModal(false)
                      setFilterName('')
                    }
                  }}
                />
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4">
                <p className="text-xs text-slate-600 font-medium mb-2">Current Filters:</p>
                <div className="space-y-1">
                  {Object.entries(currentFilters).map(([key, value]) => {
                    if (!value || (Array.isArray(value) && value.length === 0)) return null
                    return (
                      <div key={key} className="text-xs text-slate-700">
                        <span className="font-medium">{key.replace(/_/g, ' ')}:</span>{' '}
                        <span>{Array.isArray(value) ? value.join(', ') : value}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowCreateModal(false)
                    setFilterName('')
                  }}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateFilter}
                  disabled={loading || !filterName.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
                >
                  {loading ? 'Saving...' : 'Save Filter'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SavedFiltersManager

