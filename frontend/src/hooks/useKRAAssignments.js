import { useState, useEffect, useCallback } from 'react'
import { getCookie } from '../utils/helpers.js'
import { TOKEN, getApiBaseUrl } from '../utils/constants.js'

export const useKRAAssignments = () => {
  const [assignments, setAssignments] = useState([])
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

  const fetchAssignments = useCallback(async (filters = {}) => {
    const token = getAuthToken()
    if (!token) return

    setLoading(true)
    setError(null)

    try {
      const queryParams = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value) queryParams.append(key, value)
      })

      const response = await fetch(`${getApiBaseUrl()}/api/kra-assignments?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch KRA assignments')
      }

      const data = await response.json()
      setAssignments(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [getAuthToken])

  const createAssignment = useCallback(async (assignmentData) => {
    const token = getAuthToken()
    if (!token) return { success: false, error: 'No authentication token' }

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/kra-assignments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(assignmentData)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create KRA assignment')
      }

      // Refresh assignments
      await fetchAssignments()
      return { success: true, data }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }, [getAuthToken, fetchAssignments])

  const updateAssignment = useCallback(async (assignmentId, updateData) => {
    const token = getAuthToken()
    if (!token) return { success: false, error: 'No authentication token' }

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/kra-assignments/${assignmentId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update KRA assignment')
      }

      // Refresh assignments
      await fetchAssignments()
      return { success: true, data }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }, [getAuthToken, fetchAssignments])

  const deleteAssignment = useCallback(async (assignmentId) => {
    const token = getAuthToken()
    if (!token) return { success: false, error: 'No authentication token' }

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/kra-assignments/${assignmentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete KRA assignment')
      }

      // Refresh assignments
      await fetchAssignments()
      return { success: true, data }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }, [getAuthToken, fetchAssignments])

  const bulkAssignKRAs = useCallback(async (assignments) => {
    const token = getAuthToken()
    if (!token) return { success: false, error: 'No authentication token' }

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/kra-assignments/bulk`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ assignments })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to bulk assign KRAs')
      }

      // Refresh assignments
      await fetchAssignments()
      return { success: true, data }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }, [getAuthToken, fetchAssignments])

  const getEmployeeAssignments = useCallback(async (employeeId) => {
    const token = getAuthToken()
    if (!token) return { success: false, error: 'No authentication token' }

    try {
      console.log('Fetching employee assignments for:', employeeId)
      const response = await fetch(`${getApiBaseUrl()}/api/kra-assignments/employee/${employeeId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      console.log('Employee assignments response:', response.status, response.statusText)

      if (!response.ok) {
        const errorData = await response.json()
        console.error('Employee assignments error:', errorData)
        throw new Error(errorData.error || 'Failed to fetch employee KRA assignments')
      }

      const data = await response.json()
      console.log('Employee assignments data:', data)
      return { success: true, data }
    } catch (err) {
      console.error('Employee assignments catch error:', err)
      return { success: false, error: err.message }
    }
  }, [getAuthToken])

  const getAvailableKRAs = useCallback(async (employeeId) => {
    const token = getAuthToken()
    if (!token) return { success: false, error: 'No authentication token' }

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/kra-assignments/available/${employeeId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch available KRAs')
      }

      const data = await response.json()
      return { success: true, data }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }, [getAuthToken])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const refresh = useCallback(() => {
    fetchAssignments()
  }, [fetchAssignments])

  return {
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
    clearError,
    refresh
  }
}
