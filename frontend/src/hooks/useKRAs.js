import { useState, useEffect, useCallback } from 'react'
import { getCookie } from '../utils/helpers.js'
import { TOKEN, getApiBaseUrl } from '../utils/constants.js'

/**
 * Custom hook for managing Department operations
 * Provides CRUD operations and state management for Departments
 */
export const useDepartments = () => {
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Get authentication token
  const getAuthToken = useCallback(() => {
    const token = getCookie(TOKEN)
    if (!token) {
      throw new Error('No authentication token found')
    }
    return token
  }, [])

  // Make authenticated API request
  const makeRequest = useCallback(async (url, options = {}) => {
    const token = getAuthToken()
    
    const defaultOptions = {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    }

    const response = await fetch(`${getApiBaseUrl()}${url}`, {
      ...defaultOptions,
      ...options
    })

    if (!response.ok) {
      // Try to get the error message from the response
      let errorMessage = `API Error: ${response.status} ${response.statusText}`
      try {
        const errorData = await response.json()
        if (errorData.error) {
          errorMessage = errorData.error
        }
        console.error('API Error Response:', errorData)
      } catch (e) {
        console.error('Could not parse error response:', e)
      }
      throw new Error(errorMessage)
    }

    return response.json()
  }, [getAuthToken])

  // Fetch all departments
  const fetchDepartments = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      const data = await makeRequest('/api/departments')
      setDepartments(data.departments || [])
      return data.departments || []
    } catch (err) {
      console.error('Error fetching departments:', err)
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [makeRequest])

  // Create a new department
  const createDepartment = useCallback(async (departmentData) => {
    try {
      setLoading(true)
      setError(null)
      
      const newDepartment = await makeRequest('/api/departments', {
        method: 'POST',
        body: JSON.stringify(departmentData)
      })
      
      setDepartments(prev => [...prev, newDepartment.department])
      return { success: true, data: newDepartment.department }
    } catch (err) {
      console.error('Error creating department:', err)
      setError(err.message)
      return { success: false, error: err.message }
    } finally {
      setLoading(false)
    }
  }, [makeRequest])

  // Clear error
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    // State
    departments,
    loading,
    error,
    
    // Actions
    fetchDepartments,
    createDepartment,
    clearError,
    
    // Computed
    hasDepartments: departments.length > 0,
    departmentsCount: departments.length
  }
}

/**
 * Custom hook for managing KRA operations
 * Provides CRUD operations and state management for KRAs
 */
export const useKRAs = () => {
  const [kras, setKRAs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Get authentication token
  const getAuthToken = useCallback(() => {
    const token = getCookie(TOKEN)
    if (!token) {
      throw new Error('No authentication token found')
    }
    return token
  }, [])

  // Make authenticated API request
  const makeRequest = useCallback(async (url, options = {}) => {
    const token = getAuthToken()
    
    const defaultOptions = {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    }

    const response = await fetch(`${getApiBaseUrl()}${url}`, {
      ...defaultOptions,
      ...options
    })

    if (!response.ok) {
      // Try to get the error message from the response
      let errorMessage = `API Error: ${response.status} ${response.statusText}`
      try {
        const errorData = await response.json()
        if (errorData.error) {
          errorMessage = errorData.error
        }
        console.error('API Error Response:', errorData)
      } catch (e) {
        console.error('Could not parse error response:', e)
      }
      throw new Error(errorMessage)
    }

    return response.json()
  }, [getAuthToken])

  // Fetch all KRAs
  const fetchKRAs = useCallback(async () => {
    try {
      console.log('useKRAs: fetchKRAs() called, fetching KRAs from API...')
      setLoading(true)
      setError(null)
      
      const data = await makeRequest('/api/kras')
      console.log('useKRAs: Received KRAs data:', data)
      setKRAs(data)
      return data
    } catch (err) {
      console.error('Error fetching KRAs:', err)
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [makeRequest])

  // Create a new KRA
  const createKRA = useCallback(async (kraData) => {
    try {
      setLoading(true)
      setError(null)
      
      console.log('Creating KRA with data:', kraData)
      
      const newKRA = await makeRequest('/api/kras', {
        method: 'POST',
        body: JSON.stringify(kraData)
      })
      
      setKRAs(prev => [...prev, newKRA])
      return { success: true, data: newKRA }
    } catch (err) {
      console.error('Error creating KRA:', err)
      setError(err.message)
      return { success: false, error: err.message }
    } finally {
      setLoading(false)
    }
  }, [makeRequest])

  // Update an existing KRA
  const updateKRA = useCallback(async (kraId, kraData) => {
    try {
      setLoading(true)
      setError(null)
      
      const updatedKRA = await makeRequest(`/api/kras/${kraId}`, {
        method: 'PUT',
        body: JSON.stringify(kraData)
      })
      
      setKRAs(prev => prev.map(kra => kra.id === kraId ? updatedKRA : kra))
      return { success: true, data: updatedKRA }
    } catch (err) {
      console.error('Error updating KRA:', err)
      setError(err.message)
      return { success: false, error: err.message }
    } finally {
      setLoading(false)
    }
  }, [makeRequest])

  // Delete a KRA
  const deleteKRA = useCallback(async (kraId) => {
    try {
      setLoading(true)
      setError(null)
      
      await makeRequest(`/api/kras/${kraId}`, {
        method: 'DELETE'
      })
      
      setKRAs(prev => prev.filter(kra => kra.id !== kraId))
      return { success: true }
    } catch (err) {
      console.error('Error deleting KRA:', err)
      setError(err.message)
      return { success: false, error: err.message }
    } finally {
      setLoading(false)
    }
  }, [makeRequest])

  // Import KRAs from Excel
  const importKRAs = useCallback(async (file) => {
    try {
      setLoading(true)
      setError(null)
      
      const formData = new FormData()
      formData.append('file', file)
      
      const token = getAuthToken()
      const response = await fetch(`${getApiBaseUrl()}/api/kras/import`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`)
      }

      const result = await response.json()
      
      // Refresh KRAs after import
      await fetchKRAs()
      
      return { success: true, data: result }
    } catch (err) {
      console.error('Error importing KRAs:', err)
      setError(err.message)
      return { success: false, error: err.message }
    } finally {
      setLoading(false)
    }
  }, [getAuthToken, fetchKRAs])

  // Clear error
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // Refresh KRAs
  const refresh = useCallback(() => {
    console.log('useKRAs: refresh() called, fetching KRAs...')
    return fetchKRAs()
  }, [fetchKRAs])

  // Auto-fetch KRAs on mount
  useEffect(() => {
    fetchKRAs()
  }, [fetchKRAs])

  return {
    // State
    kras,
    loading,
    error,
    
    // Actions
    fetchKRAs,
    createKRA,
    updateKRA,
    deleteKRA,
    importKRAs,
    refresh,
    clearError,
    
    // Computed
    hasKRAs: kras.length > 0,
    krasCount: kras.length
  }
}

export default useKRAs
