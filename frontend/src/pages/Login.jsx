import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { GoogleLogin } from '@react-oauth/google'
import { useAuth } from '../context/AuthContext.jsx'
import { COMPANY_CAPTION, IMAGE_URL, ERROR_MESSAGES } from '../utils/constants.js'

const Login = () => {
  const { login, handleSSOLogin, loading, user, error, clearError } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  const from = location.state?.from?.pathname || '/workforce'

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate(from, { replace: true })
    }
  }, [user, navigate, from])

  // Additional check for authentication state
  useEffect(() => {
    const checkAuth = () => {
      if (user && !loading) {
        navigate(from, { replace: true })
      }
    }
    
    // Check immediately and after a delay
    checkAuth()
    const timer = setTimeout(checkAuth, 200)
    
    return () => clearTimeout(timer)
  }, [user, loading, navigate, from])



  const handleGoogleSSOSuccess = async (googleResponse) => {
    setIsLoggingIn(true)
    clearError()
    
    try {
      const result = await handleSSOLogin(googleResponse)
      
      if (result.success) {
        // Force navigation after a small delay to ensure state is updated
        setTimeout(() => {
          navigate(from, { replace: true })
        }, 100)
      }
    } catch (error) {
      console.error('SSO login error:', error)
    } finally {
      setIsLoggingIn(false)
    }
  }

  const handleGoogleSSOError = (error) => {
    console.error('Google SSO failed:', error)
    setIsLoggingIn(false)
  }

  return (
    <div className="bg-slate-100 min-h-screen flex flex-col">
      <div className="flex-grow flex items-center justify-center px-4 py-8">
        <div className="max-w-md w-full">
          {/* Professional Login Card */}
          <div className="card p-8 animate-fade-in">
            <div className="text-center mb-8">
              {/* Company Branding */}
              <div className="mb-6 flex justify-center">
                <div className="w-16 h-16">
                  <img 
                    src={IMAGE_URL} 
                    alt="SquareShift Logo" 
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      // Fallback to initials if image fails to load
                      e.target.style.display = 'none'
                      e.target.nextElementSibling.style.display = 'flex'
                    }}
                  />
                  <div 
                    className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center" 
                    style={{ display: 'none' }}
                  >
                    <span className="text-2xl font-bold text-white">SS</span>
                  </div>
                </div>
              </div>
              
              {/* Professional Header Design */}
              <div className="space-y-3">
                <h1 className="text-2xl font-semibold text-slate-800">Employee Management System</h1>
                <p className="text-slate-600 font-medium">{COMPANY_CAPTION}</p>
              </div>
            </div>
            

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-600 text-sm font-medium">{error}</p>
              </div>
            )}

            {/* Google SSO Login Section */}
            <div className="space-y-4 mb-6">
              <div className="text-center mb-4">
                <p className="text-sm text-slate-600 font-medium">Sign in with your organization account</p>
              </div>
              
              {/* Google Workspace SSO Button */}
              <div className="flex justify-center">
                <GoogleLogin
                  hosted_domain={import.meta.env.VITE_ALLOWED_DOMAIN || "squareshift.co"}
                  onSuccess={handleGoogleSSOSuccess}
                  onError={handleGoogleSSOError}
                  width={320}
                  theme="outline"
                  size="large"
                  text="signin_with"
                  shape="rectangular"
                  logo_alignment="left"
                  useOneTap={false}
                  auto_select={false}
                  cancel_on_tap_outside={true}
                />
              </div>
            </div>

            
            
            {/* Professional Footer Elements */}
            <div className="mt-6 text-center">
              <div className="flex items-center justify-center space-x-2 text-xs text-slate-500 font-medium">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 004.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 003.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/>
                </svg>
                <span>Enterprise Security</span>
                <span>•</span>
                <span>SOC2 Compliant</span>
                <span>•</span>
                <span>24/7 Support</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Refined Footer */}
      <footer className="py-6 text-center">
        <div className="flex items-center justify-center space-x-6 text-sm text-slate-500 font-medium">
          <a href="#" className="hover:text-slate-700 hover:underline transition-colors">Terms of Service</a>
          <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
          <a href="#" className="hover:text-slate-700 hover:underline transition-colors">Privacy Policy</a>
          <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
          <a href="#" className="hover:text-slate-700 hover:underline transition-colors">Support</a>
        </div>
        <p className="text-xs text-slate-400 mt-2 font-medium">Secure Employee Management Platform</p>
      </footer>
    </div>
  )
}

export default Login
