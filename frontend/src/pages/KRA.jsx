import React, { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Header from '../components/Header.jsx'
import { usePermissions } from '../context/PermissionContext.jsx'
import { useKRAs, useDepartments } from '../hooks/useKRAs.js'
import KRAManagementTab from './tabs/KRAManagementTab.jsx'
import KRAAssignmentTab from './tabs/KRAAssignmentTab.jsx'
import KRAGoalsAndMilestones from './tabs/KRAGoalsAndMilestones.jsx'
import OverallKRAAllocationsTab from './tabs/OverallKRAAllocationsTab.jsx'

const KRA = () => {
  const { hasPermission, loading: permissionsLoading } = usePermissions()
  const { 
    kras, 
    loading, 
    error, 
    createKRA, 
    updateKRA, 
    deleteKRA, 
    refresh,
    clearError 
  } = useKRAs()
  
  // Fetch departments once when KRA page loads
  const { fetchDepartments } = useDepartments()
  
  useEffect(() => {
    // Fetch departments once when component mounts
    fetchDepartments()
  }, [fetchDepartments])
  
  const location = useLocation()
  const navigate = useNavigate()
  
  // Determine active tab based on current route
  const getActiveTab = () => {
    if (location.pathname === '/kra/assignment') return 'assignment'
    if (location.pathname === '/kra/goals') return 'goals'
    if (location.pathname === '/kra/overall') return 'overall'
    return 'management'
  }
  
  const [activeTab, setActiveTab] = useState(getActiveTab())
  
  // Update active tab when route changes
  useEffect(() => {
    setActiveTab(getActiveTab())
  }, [location.pathname])

  // Show loader while permissions are being fetched
  if (permissionsLoading) {
    return (
      <div className="min-h-screen bg-slate-100">
        <Header />
        <div className="w-[97%] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-800 mx-auto mb-4"></div>
              <p className="text-slate-600">Loading KRA...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Check permission - only after loading is complete
  if (!hasPermission('kra-view')) {
    return (
      <div className="min-h-screen bg-slate-100">
        <Header />
        <div className="w-[97%] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
            <h2 className="text-xl font-bold text-slate-900 mb-2">Access Denied</h2>
            <p className="text-slate-600">You don't have permission to view KRA Management.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <Header />
      <div className="w-[97%] mx-auto px-4 sm:px-6 lg:px-4 py-4">
        {/* Page Header */}
        <div className="mb-2 animate-fade-in mb-2">
          <h1 className="page-title text-xl">Key Result Areas (KRA)</h1>
          <p className="page-subtitle">Manage and track key result areas for your organization</p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <p className="text-red-800">Error: {error}</p>
              </div>
              <button
                onClick={clearError}
                className="text-red-600 hover:text-red-800 transition-colors"
                title="Dismiss error"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="mb-2 animate-fade-in">
          <div className="border-b border-slate-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => navigate('/kra')}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                  activeTab === 'management'
                    ? 'border-green-800 text-green-800'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2 text-medium">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                  KRA Management
                </div>
              </button>
              {hasPermission('kra-assign-view') && (
                <button
                  onClick={() => navigate('/kra/assignment')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                    activeTab === 'assignment'
                      ? 'border-green-800 text-green-800'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 text-medium">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
                    </svg>
                    KRA Assignment
                  </div>
                </button>
              )}
              {hasPermission('kra-goals-view') && (
                <button
                  onClick={() => navigate('/kra/goals')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                    activeTab === 'goals'
                      ? 'border-green-800 text-green-800'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 text-medium">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"/>
                    </svg>
                    Goals & Tasks
                  </div>
                </button>
              )}
              {hasPermission('kra-view') && (
                <button
                  onClick={() => navigate('/kra/overall')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                    activeTab === 'overall'
                      ? 'border-green-800 text-green-800'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 text-medium">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                    </svg>
                    Overall KRA Ratings
                  </div>
                </button>
              )}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'management' && (
          <KRAManagementTab 
            kras={kras}
            loading={loading}
            onAdd={createKRA}
            onUpdate={updateKRA}
            onDelete={deleteKRA}
            onRefresh={refresh} 
          />
        )}
        
        {activeTab === 'assignment' && hasPermission('kra-assign-view') && (
          <KRAAssignmentTab />
        )}
        
        {activeTab === 'goals' && hasPermission('kra-goals-view') && (
          <KRAGoalsAndMilestones />
        )}
        
        {activeTab === 'overall' && hasPermission('kra-view') && (
          <OverallKRAAllocationsTab />
        )}
      </div>
    </div>
  )
}

export default KRA