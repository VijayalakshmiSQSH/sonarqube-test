import React, { createContext, useContext, useState, useEffect, useRef } from 'react'
import { getCookie } from '../utils/helpers.js'
import { TOKEN, getApiBaseUrl } from '../utils/constants.js'
import { decryptPermissions } from '../utils/crypto.js'
import { useAuth } from './AuthContext.jsx'

const PermissionContext = createContext()

export const usePermissions = () => {
  const context = useContext(PermissionContext)
  if (!context) {
    throw new Error('usePermissions must be used within a PermissionProvider')
  }
  return context
}

export const PermissionProvider = ({ children }) => {
  const [permissions, setPermissions] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [hasFetched, setHasFetched] = useState(false) // Flag to prevent multiple fetches
  const { user } = useAuth() // Watch for user state changes to detect login
  const previousUserRef = useRef(null) // Track previous user to detect changes

  // Fetch user permissions from API (new encrypted method)
  // This function should ONLY be called on page refresh or login
  const fetchUserPermissions = async (forceRefresh = false) => {
    // Prevent multiple fetches unless explicitly forced
    if (hasFetched && !forceRefresh) {
      console.log('PermissionContext: Permissions already fetched, skipping...')
      return permissions
    }

    const token = getCookie(TOKEN)
    if (!token) {
      console.warn('No authentication token found for permission fetch')
      return []
    }

    console.log('PermissionContext: Fetching permissions (page refresh or login)')
    setLoading(true)
    setError(null)

    try {
      // First try the new user_info endpoint with encrypted permissions
      const response = await fetch(`${getApiBaseUrl()}/api/user/user_info`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch user info: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      
      if (data.encrypted_permissions) {
        // Decrypt the permissions using the user's email as the password
        const userEmail = data.email
        const decryptedPermissions = await decryptPermissions(data.encrypted_permissions, userEmail)
        
        console.log('PermissionContext: Fetched and decrypted user permissions:', decryptedPermissions.length, 'permissions')
        
        // Store decrypted permissions in React context (not localStorage)
        setPermissions(decryptedPermissions)
        setHasFetched(true) // Mark as fetched to prevent future automatic fetches
        
        // Clear any existing JWT permissions from localStorage to avoid conflicts
        const userData = JSON.parse(localStorage.getItem('user') || '{}')
        const userDataAlt = JSON.parse(localStorage.getItem('user_data') || '{}')
        
        if (userData.permissions) {
          delete userData.permissions
          localStorage.setItem('user', JSON.stringify(userData))
        }
        
        if (userDataAlt.permissions) {
          delete userDataAlt.permissions
          localStorage.setItem('user_data', JSON.stringify(userDataAlt))
        }
        
        return decryptedPermissions
      } else {
        // No encrypted permissions available
        console.warn('Encrypted permissions not available in API response')
        setError('No encrypted permissions available')
        setPermissions([])
        return []
      }
    } catch (err) {
      console.error('Error fetching user permissions:', err)
      setError(err.message)
      setPermissions([])
      return []
    } finally {
      setLoading(false)
    }
  }

  // Legacy method for backward compatibility
  const fetchUserPermissionsLegacy = async () => {
    const token = getCookie(TOKEN)
    if (!token) {
      return []
    }

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/user/permissions`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch permissions: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      const userPermissions = data.permissions || []
      
      console.log('Fetched user permissions (legacy):', userPermissions)
      
      // Store permissions in React context (not localStorage)
      setPermissions(userPermissions)
      setHasFetched(true) // Mark as fetched to prevent future automatic fetches
      
      // Clear any existing JWT permissions from localStorage to avoid conflicts
      const userData = JSON.parse(localStorage.getItem('user') || '{}')
      const userDataAlt = JSON.parse(localStorage.getItem('user_data') || '{}')
      
      if (userData.permissions) {
        delete userData.permissions
        localStorage.setItem('user', JSON.stringify(userData))
      }
      
      if (userDataAlt.permissions) {
        delete userDataAlt.permissions
        localStorage.setItem('user_data', JSON.stringify(userDataAlt))
      }
      
      return userPermissions
    } catch (err) {
      console.error('Error fetching user permissions (legacy):', err)
      setError(err.message)
      setPermissions([])
      return []
    }
  }

  // Check if user has a specific permission
  const hasPermission = (permission) => {
    if (!permission) return false
    return permissions.includes(permission)
  }

  // Check if user has any of the specified permissions
  const hasAnyPermission = (permissionList) => {
    if (!Array.isArray(permissionList) || permissionList.length === 0) return false
    return permissionList.some(permission => hasPermission(permission))
  }

  // Check if user has all of the specified permissions
  const hasAllPermissions = (permissionList) => {
    if (!Array.isArray(permissionList) || permissionList.length === 0) return false
    return permissionList.every(permission => hasPermission(permission))
  }

  // Clear permissions (useful for logout)
  const clearPermissions = () => {
    setPermissions([])
    setError(null)
    setHasFetched(false) // Reset flag so permissions can be fetched again on next login
  }

  // Refresh permissions (for manual use only - forces refresh)
  const refreshPermissions = async () => {
    console.log('PermissionContext: Manual refresh requested')
    return await fetchUserPermissions(true) // Force refresh
  }

  // Expose refresh function globally for debugging
  useEffect(() => {
    window.refreshPermissions = refreshPermissions
    return () => {
      delete window.refreshPermissions
    }
  }, [])

  // Watch for user state changes to fetch permissions when user logs in
  // This handles both initial mount and login after logout
  useEffect(() => {
    const token = getCookie(TOKEN)
    const previousUser = previousUserRef.current
    
    // Detect if user just logged in (was null, now has value)
    const userJustLoggedIn = previousUser === null && user !== null && previousUser !== user
    
    // Detect if user just logged out (had value, now null)
    const userJustLoggedOut = previousUser !== null && user === null
    
    if (userJustLoggedOut) {
      // User logged out - clear permissions and reset fetch flag
      console.log('PermissionContext: User logged out, clearing permissions')
      setPermissions([])
      setHasFetched(false)
      previousUserRef.current = null
      return
    }
    
    if (token) {
      // Token exists - fetch permissions if:
      // 1. User just logged in (transition from null to user), OR
      // 2. Permissions haven't been fetched yet (initial mount or after logout)
      if (userJustLoggedIn || (!hasFetched && user)) {
        console.log('PermissionContext: User logged in or permissions not fetched, fetching permissions')
        fetchUserPermissions()
      }
    } else {
      // No token - clear permissions and reset fetch flag
      if (permissions.length > 0 || hasFetched) {
        console.log('PermissionContext: No token found, clearing permissions')
        setPermissions([])
        setHasFetched(false)
      }
    }
    
    // Update previous user reference
    previousUserRef.current = user
  }, [user, hasFetched]) // Re-run when user or hasFetched changes

  const value = {
    permissions,
    loading,
    error,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    clearPermissions,
    refreshPermissions,
    fetchUserPermissions
  }

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  )
}

export default PermissionContext
