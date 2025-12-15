import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { isUserLoggedIn, getUserFromToken } from '../utils/helpers.js'
import { useEffect } from 'react'

const ProtectedRoute = ({ children }) => {
  const { user, loading, refreshAuth } = useAuth()
  const location = useLocation()

  // Check for token-based authentication if user context is not available
  useEffect(() => {
    if (!user && !loading && isUserLoggedIn()) {
      // If we have a valid token but no user context, try to refresh
      const tokenUser = getUserFromToken()
      if (tokenUser) {
        refreshAuth().catch(error => {
          console.warn('Failed to refresh auth from token:', error)
        })
      }
    }
  }, [user, loading, refreshAuth])

  // Show enhanced loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center font-sans">
        <div className="bg-white rounded-2xl p-8 shadow-xl border border-slate-200 max-w-sm w-full mx-4">
          <div className="text-center">
            {/* Company branding in loader */}
            <div className="mb-6 flex justify-center">
              <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
                <span className="text-xl font-bold text-white">ES</span>
              </div>
            </div>
            
            {/* Loading animation */}
            <div className="flex items-center justify-center gap-4 mb-4">
              <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
              <span className="text-slate-700 font-medium font-sans">Authenticating...</span>
            </div>
            
            <p className="text-sm text-slate-500">Verifying your credentials</p>
          </div>
        </div>
      </div>
    )
  }

  // Check authentication using both context and token
  const isAuthenticated = user || isUserLoggedIn()

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // If authenticated via token but no user context, show minimal loading
  if (!user && isUserLoggedIn()) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="bg-white rounded-lg p-6 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            <span className="text-slate-700 font-medium">Loading your session...</span>
          </div>
        </div>
      </div>
    )
  }

  // Render the protected component
  return children
}

export default ProtectedRoute