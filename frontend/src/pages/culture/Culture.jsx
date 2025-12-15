import React, { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Header from '../../components/Header.jsx'
import LoadingSpinner from '../../components/LoadingSpinner.jsx'
import { usePermissions } from '../../context/PermissionContext.jsx'
import PerformanceEvaluator from './performance-evaluator/PerformanceEvaluator.jsx'

const Culture = () => {
  const { hasPermission, loading: permissionsLoading } = usePermissions()
  const location = useLocation()
  const navigate = useNavigate()
  
  // Determine active sub-tab based on current route
  const getActiveSubTab = () => {
    if (location.pathname.startsWith('/culture/performance')) return 'performance'
    if (location.pathname.startsWith('/culture/morale')) return 'morale'
    return 'performance' // default
  }
  
  const [activeSubTab, setActiveSubTab] = useState(getActiveSubTab())
  
  // Update active sub-tab when route changes
  useEffect(() => {
    setActiveSubTab(getActiveSubTab())
  }, [location.pathname])
  
  // Show loader while permissions are being fetched
  if (permissionsLoading) {
    return (
      <div className="min-h-screen bg-slate-100">
        <Header />
        <div className="w-[97%] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingSpinner message="Loading Culture..." fullScreen={false} />
        </div>
      </div>
    )
  }
  
  // Check permission
  if (!hasPermission('culture-performance-read')) {
    return (
      <div className="min-h-screen bg-slate-100">
        <Header />
        <div className="w-[97%] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
            <h2 className="text-xl font-bold text-slate-900 mb-2">Access Denied</h2>
            <p className="text-slate-600">You don't have permission to view Culture features.</p>
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
        <div className="mb-2 animate-fade-in">
          <h1 className="page-title text-xl">Culture</h1>
          <p className="page-subtitle">Track employee performance evaluations and morale for your organization</p>
        </div>
        
        {/* Sub-Tab Navigation */}
        <div className="mb-2 animate-fade-in">
          <div className="border-b border-slate-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => navigate('/culture/performance')}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                  activeSubTab === 'performance'
                    ? 'border-green-800 text-green-800'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                  </svg>
                  Performance Evaluation
                </div>
              </button>
              <button
                onClick={() => navigate('/culture/morale')}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                  activeSubTab === 'morale'
                    ? 'border-green-800 text-green-800'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
                disabled
              >
                <div className="flex items-center gap-2 opacity-50">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  Morale Tracker
                  <span className="ml-1 text-xs">(Coming Soon)</span>
                </div>
              </button>
            </nav>
          </div>
        </div>
        
        {/* Tab Content */}
        <div className="mt-4">
          {activeSubTab === 'performance' && <PerformanceEvaluator />}
          {activeSubTab === 'morale' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-16 text-center">
              <svg className="w-16 h-16 text-slate-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Morale Tracker</h3>
              <p className="text-slate-600">This feature is coming soon.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Culture

