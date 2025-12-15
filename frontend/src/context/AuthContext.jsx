import { createContext, useContext, useState, useEffect } from 'react'
import { SSOAuthService } from '../utils/auth.js'
import { getUserFromToken, isUserLoggedIn, formatUserDisplayName, getUserInitials } from '../utils/helpers.js'

const AuthContext = createContext()

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Initialize authentication state
  useEffect(() => {
    const initializeAuth = async () => {
      setLoading(true)
      setError(null)
      
      try {
        // Check if user is already logged in
        if (isUserLoggedIn()) {
          // Get user data from stored data or token
          let userData = SSOAuthService.getCurrentUser()
          
          if (!userData) {
            // Fallback: get user data from token
            userData = getUserFromToken()
          }
          
          if (userData) {
            // Enhance user data with helper functions
            const enhancedUser = {
              ...userData,
              displayName: formatUserDisplayName(userData),
              initials: getUserInitials(userData),
            }
            setUser(enhancedUser)
            
            // Validate token with backend (optional, in background)
            SSOAuthService.validateToken().catch(error => {
              console.warn('Token validation failed:', error)
              // Handle invalid token in background
              if (error.response?.status === 401) {
                handleLogout()
              }
            })
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error)
        setError('Failed to initialize authentication')
        // Clear potentially corrupted auth data
        SSOAuthService.clearAuthData()
      } finally {
        setLoading(false)
      }
    }

    initializeAuth()
  }, [])

  /**
   * Handle SSO login (Google OAuth)
   * @param {object} googleResponse - Google OAuth response
   * @returns {Promise<object>} - Login result
   */
  const handleSSOLogin = async (googleResponse) => {
    setLoading(true)
    setError(null)
    
    try {
      const result = await SSOAuthService.handleGoogleSSOSuccess(googleResponse)
      
      if (result.success) {
        const enhancedUser = {
          ...result.user,
          displayName: formatUserDisplayName(result.user),
          initials: getUserInitials(result.user),
        }
        setUser(enhancedUser)
        
        return { success: true, user: enhancedUser }
      }
      
      throw new Error('SSO login failed')
    } catch (error) {
      console.error('SSO login error:', error)
      const errorMessage = error.message || 'SSO login failed. Please try again.'
      setError(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setLoading(false)
    }
  }

  /**
   * Handle email/password login
   * @param {object} credentials - Email and password
   * @returns {Promise<object>} - Login result
   */
  const handleEmailLogin = async (credentials) => {
    setLoading(true)
    setError(null)
    
    try {
      const result = await SSOAuthService.handleEmailLogin(credentials)
      
      if (result.success) {
        const enhancedUser = {
          ...result.user,
          displayName: formatUserDisplayName(result.user),
          initials: getUserInitials(result.user),
        }
        setUser(enhancedUser)
        return { success: true, user: enhancedUser }
      }
      
      throw new Error('Email login failed')
    } catch (error) {
      console.error('Email login error:', error)
      const errorMessage = error.message || 'Login failed. Please check your credentials.'
      setError(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setLoading(false)
    }
  }

  /**
   * Universal login function that handles both SSO and email login
   * @param {object} loginData - Can be Google OAuth response or email credentials
   * @returns {Promise<object>} - Login result
   */
  const login = async (loginData = null) => {
    // If no loginData provided, this might be a mock/demo login
    if (!loginData) {
      return handleDemoLogin()
    }
    
    // Check if this is a Google OAuth response
    if (loginData.credential) {
      return handleSSOLogin(loginData)
    }
    
    // Otherwise, treat as email/password login
    if (loginData.email && loginData.password) {
      return handleEmailLogin(loginData)
    }
    
    throw new Error('Invalid login data provided')
  }

  /**
   * Demo login for development/testing
   * @returns {Promise<object>} - Login result
   */
  const handleDemoLogin = async () => {
    setLoading(true)
    setError(null)
    
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const mockUser = {
        id: '1',
        name: 'Demo User',
        email: 'demo@squareshift.co',
        given_name: 'Demo',
        family_name: 'User',
        picture: null,
        role: 'Administrator',
        loginMethod: 'demo',
        loginTime: Date.now(),
        displayName: 'Demo User',
        initials: 'DU',
      }
      
      setUser(mockUser)
      
      // Store demo user data
      localStorage.setItem('user_data', JSON.stringify(mockUser))
      localStorage.setItem('login_method', 'demo')
      
      return { success: true, user: mockUser }
    } catch (error) {
      console.error('Demo login error:', error)
      setError('Demo login failed')
      return { success: false, error: 'Demo login failed' }
    } finally {
      setLoading(false)
    }
  }

  /**
   * Logout user
   */
  const handleLogout = async () => {
    setLoading(true)
    setError(null)
    
    try {
      await SSOAuthService.logout()
      setUser(null)
    } catch (error) {
      console.error('Logout error:', error)
      setError('Logout failed')
    } finally {
      setLoading(false)
    }
  }

  /**
   * Refresh user token
   */
  const refreshAuth = async () => {
    try {
      await SSOAuthService.refreshToken()
      // Re-initialize auth state after refresh
      const userData = SSOAuthService.getCurrentUser()
      if (userData) {
        const enhancedUser = {
          ...userData,
          displayName: formatUserDisplayName(userData),
          initials: getUserInitials(userData),
        }
        setUser(enhancedUser)
      }
      return { success: true }
    } catch (error) {
      console.error('Auth refresh error:', error)
      setError('Session refresh failed')
      return { success: false, error: 'Session refresh failed' }
    }
  }

  /**
   * Clear error state
   */
  const clearError = () => {
    setError(null)
  }

  const value = {
    // State
    user,
    loading,
    error,
    
    // Authentication methods
    login,
    logout: handleLogout,
    refreshAuth,
    
    // Specific login methods (for advanced usage)
    handleSSOLogin,
    handleEmailLogin,
    
    // Utility methods
    clearError,
    isAuthenticated: () => !!user && isUserLoggedIn(),
    getUserData: () => user,
    
    // Auth service access (for advanced usage)
    authService: SSOAuthService,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export default AuthContext
