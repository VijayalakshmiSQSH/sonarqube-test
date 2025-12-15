import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { usePermissions } from '../context/PermissionContext.jsx'
import { useEmployees } from '../context/EmployeeContext.jsx'
import TitleIcon from '../assets/title.png';


const Header = () => {
  const { user, logout } = useAuth()
  const { hasPermission, loading: permissionsLoading } = usePermissions()
  const { getAllEmployees } = useEmployees()
  const location = useLocation()
  const navigate = useNavigate()
  const [showActivityDropdown, setShowActivityDropdown] = useState(false)
  const [showProfileTooltip, setShowProfileTooltip] = useState(false)
  
  // Find employee ID from user email
  const getEmployeeId = () => {
    if (!user?.email) return null
    const employees = getAllEmployees()
    const employee = employees.find(emp => emp.email === user.email)
    return employee?.id || null
  }
  
  const employeeId = getEmployeeId()
  
  const handleProfileClick = () => {
    if (employeeId) {
      navigate(`/employee-profile/${employeeId}`)
    }
  }

  const isActive = (path) => {
    if (path === '/kra') {
      // For KRA, match both /kra and /kra/assignment
      return location.pathname === '/kra' || location.pathname.startsWith('/kra/')
    }
    if (path === '/culture') {
      return location.pathname === '/culture' || location.pathname.startsWith('/culture/')
    }
    if (path === '/employee-tree') {
      return location.pathname === '/employee-tree'
    }
    return location.pathname === path
  }

  const recentActivities = [
    {
      id: 1,
      type: 'create',
      message: 'New employee added: Alice Thompson',
      time: '2 hours ago',
      icon: '✓',
      bgColor: 'bg-emerald-100',
      textColor: 'text-emerald-600'
    },
    {
      id: 2,
      type: 'update',
      message: 'Employee updated: John Smith',
      time: '5 hours ago',
      icon: '✏',
      bgColor: 'bg-blue-100',
      textColor: 'text-blue-600'
    },
    {
      id: 3,
      type: 'import',
      message: 'Bulk import: 15 employees',
      time: 'Yesterday',
      icon: '☁',
      bgColor: 'bg-amber-100',
      textColor: 'text-amber-600'
    }
  ]

  return (
    <header className="bg-white backdrop-blur-sm border-b border-slate-200 sticky top-0 z-50">
      <div className="w-[97%] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and Brand */}
          <div className="flex items-center space-x-4">
            <Link 
              to="/workforce" 
              className="text-xl font-bold text-slate-800 cursor-pointer hover:opacity-80 transition-opacity duration-200"
            >
              <img src={TitleIcon} alt="SquareShift" className="h-10" />
            </Link>
          </div>
          
          {/* Navigation */}
          <nav className="flex gap-8">
            {(permissionsLoading || hasPermission('view-workforce')) && (
            <Link 
              to="/workforce" 
              className={`font-medium transition-colors ${
                isActive('/workforce') 
                  ? 'text-slate-900 border-b-2 border-green-800 pb-1' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Workforce
            </Link>)}
            {(permissionsLoading || hasPermission('projects&allocations-view')) && (
            <Link 
              to="/projects" 
              className={`font-medium transition-colors ${
                isActive('/projects') 
                  ? 'text-slate-900 border-b-2 border-green-800 pb-1' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Projects & Allocations
            </Link>)}
            {(permissionsLoading || hasPermission('skills-view')) && (
            <Link 
              to="/skills" 
              className={`font-medium transition-colors ${
                isActive('/skills') 
                  ? 'text-slate-900 border-b-2 border-green-800 pb-1' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Skills
            </Link>)}
            {(permissionsLoading || hasPermission('kra-view')) && (
              <Link 
                to="/kra" 
                className={`font-medium transition-colors ${
                  isActive('/kra') 
                    ? 'text-slate-900 border-b-2 border-green-800 pb-1' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                KRA
              </Link>
            )}
            {(permissionsLoading || hasPermission('culture-performance-read')) && (
              <Link 
                to="/culture" 
                className={`font-medium transition-colors ${
                  isActive('/culture') 
                    ? 'text-slate-900 border-b-2 border-green-800 pb-1' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Culture
              </Link>
            )}
            {(permissionsLoading || hasPermission('view-employee-tree')) && (
              <Link 
                to="/employee-tree" 
                className={`font-medium transition-colors ${
                  isActive('/employee-tree') 
                    ? 'text-slate-900 border-b-2 border-green-800 pb-1' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Employee Tree
              </Link>
            )}
            {(permissionsLoading || hasPermission('audit-log-view')) && (
            <Link 
              to="/audit-log" 
              className={`font-medium transition-colors ${
                isActive('/audit-log') 
                  ? 'text-slate-900 border-b-2 border-green-800 pb-1' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Audit Log
            </Link>)}
          </nav>
          
          {/* Right side - Activity Bell and User Menu */}
          <div className="flex items-center gap-6">
            {/* Activity Bell */}
            <div className="relative">
              {/* <button 
                onClick={() => setShowActivityDropdown(!showActivityDropdown)}
                className="text-slate-500 hover:text-slate-700 relative p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
                </svg>
                <span className="absolute -top-1 -right-1 h-2 w-2 bg-blue-500 rounded-full"></span>
              </button> */}
              
              {/* Activity Dropdown */}
              {showActivityDropdown && (
                <div className="absolute right-0 mt-2 w-80 bg-white backdrop-blur-sm border border-slate-200 rounded-xl shadow-xl z-50 animate-fade-in">
                  <div className="p-4">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">Recent Activity</h3>
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {recentActivities.map((activity) => (
                        <div key={activity.id} className="flex items-start gap-3 pb-3 border-b border-slate-100 last:border-b-0">
                          <div className={`w-6 h-6 ${activity.bgColor} rounded-full flex items-center justify-center flex-shrink-0`}>
                            <span className={`text-xs ${activity.textColor} font-semibold`}>
                              {activity.icon}
                            </span>
                          </div>
                          <div className="flex-1">
                            <p className="text-sm text-slate-900 font-medium">{activity.message}</p>
                            <p className="text-xs text-slate-500">{activity.time}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* User Menu */}
            <div className="flex items-center gap-3">
              {/* Profile Account - Clickable */}
              <div 
                className="relative flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all duration-200 hover:bg-grey-700 hover:shadow-md"
                onClick={handleProfileClick}
                onMouseEnter={() => setShowProfileTooltip(true)}
                onMouseLeave={() => setShowProfileTooltip(false)}
                style={{ pointerEvents: employeeId ? 'auto' : 'none', opacity: employeeId ? 1 : 0.6 }}
              >
                <div className={`avatar avatar-sm bg-[#426653] text-white-600`}>
                  <span>{user?.avatar || (user?.name ? user.name.charAt(0).toUpperCase() : 'A')}</span>
                </div>
                <span className="text-sm font-semibold">{user?.name || 'Admin User'}</span>
                
                {/* Tooltip */}
                {showProfileTooltip && employeeId && (
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-lg shadow-lg whitespace-nowrap z-50 animate-fade-in">
                    View Profile
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 -mb-1">
                      <div className="w-2 h-2 bg-slate-900 rotate-45"></div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Logout Button */}
              <button
                onClick={logout}
                className="text-slate-500 hover:text-slate-700 p-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                title="Logout"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Click outside to close dropdown */}
      {showActivityDropdown && (
        <div 
          className="fixed inset-0 z-30" 
          onClick={() => setShowActivityDropdown(false)}
        ></div>
      )}
    </header>
  )
}

export default Header
