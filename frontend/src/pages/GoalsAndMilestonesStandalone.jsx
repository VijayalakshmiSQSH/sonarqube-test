import React from 'react'
import { useSearchParams } from 'react-router-dom'
import { usePermissions } from '../context/PermissionContext.jsx'
import KRAGoalsAndMilestones from './tabs/KRAGoalsAndMilestones.jsx'

const GoalsAndMilestonesStandalone = () => {
  const { hasPermission, loading: permissionsLoading } = usePermissions()
  const [searchParams] = useSearchParams()
  const employeeId = searchParams.get('employee_id')

  // Show loader while permissions are being fetched
  if (permissionsLoading) {
    return (
      <div className="min-h-screen bg-slate-100">
        <div className="w-[97%] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-800 mx-auto mb-4"></div>
              <p className="text-slate-600">Loading Goals & Milestones...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Check permission
  if (!hasPermission('kra-goals-view')) {
    return (
      <div className="min-h-screen bg-slate-100">
        <div className="w-[97%] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
            <h2 className="text-xl font-bold text-slate-900 mb-2">Access Denied</h2>
            <p className="text-slate-600">You don't have permission to view Goals & Milestones.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="w-[97%] mx-auto px-4 sm:px-6 lg:px-4 py-4">
        {/* Page Header */}
        <div className="mb-2 animate-fade-in flex justify-center
        ">
          <h1 className="text-xl font-bold text-slate-900">Goals & Milestones</h1>
        </div>

        {/* Goals and Milestones Component */}
        <KRAGoalsAndMilestones initialEmployeeId={employeeId} />
      </div>
    </div>
  )
}

export default GoalsAndMilestonesStandalone

