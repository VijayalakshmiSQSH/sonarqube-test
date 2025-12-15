import React, { useState, useEffect, useMemo, useRef } from 'react'
import apiClient from '../../../../utils/auth.js'

const AnalyticsTab = ({ onNavigateToView }) => {
  const [allAnalyticsData, setAllAnalyticsData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [filters, setFilters] = useState({
    name: '',
    department: '',
    talent_segment: ''
  })
  const [departments, setDepartments] = useState([])
  const [selectedPeriod, setSelectedPeriod] = useState('')
  const [periodSearchTerm, setPeriodSearchTerm] = useState('')
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false)
  const [calendarView, setCalendarView] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() })
  const periodDropdownRef = useRef(null)
  
  // Load analytics data when period or filters change
  useEffect(() => {
    const loadAnalytics = async () => {
      if (!selectedPeriod) return // Wait for default period to be set
      
      setLoading(true)
      setError(null)
      
      try {
        const [year, month] = selectedPeriod.split('-')
        const params = {
          period_month: parseInt(month),
          period_year: parseInt(year)
        }
        
        const response = await apiClient.get('/api/culture/performance-evaluations/analytics', { params })
        setAllAnalyticsData(response.data)
      } catch (err) {
        console.error('Error loading analytics:', err)
        setError(err.response?.data?.error || 'Failed to load analytics')
      } finally {
        setLoading(false)
      }
    }
    loadAnalytics()
  }, [selectedPeriod])
  
  // Update departments list when analytics data changes
  useEffect(() => {
    if (allAnalyticsData?.evaluations) {
      const depts = [...new Set(allAnalyticsData.evaluations.map(e => e.employee_department).filter(Boolean))].sort()
      setDepartments(depts)
    }
  }, [allAnalyticsData])

  // Generate list of periods (last 24 months)
  const availablePeriods = useMemo(() => {
    const periods = []
    const now = new Date()
    for (let i = 0; i < 24; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const year = date.getFullYear()
      const month = date.getMonth() + 1
      const monthStr = String(month).padStart(2, '0')
      const value = `${year}-${monthStr}`
      const monthName = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      periods.push({ value, label: monthName, year, month })
    }
    return periods
  }, [])

  // Generate calendar months for the current view year
  const calendarMonths = useMemo(() => {
    const months = []
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    for (let i = 0; i < 12; i++) {
      const month = i + 1
      const monthStr = String(month).padStart(2, '0')
      const value = `${calendarView.year}-${monthStr}`
      const isSelected = selectedPeriod === value
      const isCurrentMonth = calendarView.year === new Date().getFullYear() && month === new Date().getMonth() + 1
      months.push({ 
        value, 
        label: monthNames[i], 
        month, 
        year: calendarView.year,
        isSelected,
        isCurrentMonth
      })
    }
    return months
  }, [calendarView.year, selectedPeriod])

  // Navigate calendar year
  const navigateCalendarYear = (direction) => {
    setCalendarView(prev => ({
      ...prev,
      year: prev.year + direction
    }))
  }

  // Set default period to current month
  useEffect(() => {
    if (!selectedPeriod) {
      const now = new Date()
      const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      setSelectedPeriod(defaultPeriod)
      const period = availablePeriods.find(p => p.value === defaultPeriod)
      if (period) {
        setPeriodSearchTerm(period.label)
      }
    } else {
      // Update search term when period changes externally
      const period = availablePeriods.find(p => p.value === selectedPeriod)
      if (period) {
        setPeriodSearchTerm(period.label)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update period search term when selectedPeriod changes
  useEffect(() => {
    const period = availablePeriods.find(p => p.value === selectedPeriod)
    if (period) {
      setPeriodSearchTerm(period.label)
    }
  }, [selectedPeriod, availablePeriods])

  // Update calendar view when selected period changes
  useEffect(() => {
    if (selectedPeriod) {
      const [year, month] = selectedPeriod.split('-')
      setCalendarView({ year: parseInt(year), month: parseInt(month) - 1 })
    }
  }, [selectedPeriod])

  const handlePeriodSelect = (period) => {
    setSelectedPeriod(period.value)
    setPeriodSearchTerm(period.label)
    setShowPeriodDropdown(false)
    // Update calendar view to show the selected period's year
    if (period.year) {
      setCalendarView({ year: period.year, month: period.month - 1 })
    }
  }

  const handlePeriodInputClick = () => {
    // Open calendar when clicking input
    setShowPeriodDropdown(true)
  }

  const clearPeriodSelection = () => {
    const now = new Date()
    const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    setSelectedPeriod(defaultPeriod)
    const period = availablePeriods.find(p => p.value === defaultPeriod)
    if (period) {
      setPeriodSearchTerm(period.label)
    }
    setCalendarView({ year: now.getFullYear(), month: now.getMonth() })
    setShowPeriodDropdown(false)
  }

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (periodDropdownRef.current && !periodDropdownRef.current.contains(event.target)) {
        setShowPeriodDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])
  
  // Filter analytics data client-side
  const analyticsData = useMemo(() => {
    if (!allAnalyticsData) return null
    
    // Preserve the original total_employees count (all accessible employees)
    const originalTotalEmployees = allAnalyticsData.statistics?.total_employees || 0
    
    let filteredEvaluations = [...allAnalyticsData.evaluations]
    
    // Apply name filter
    if (filters.name) {
      const searchLower = filters.name.toLowerCase()
      filteredEvaluations = filteredEvaluations.filter(e => 
        e.employee_name?.toLowerCase().includes(searchLower) ||
        e.employee_role?.toLowerCase().includes(searchLower)
      )
    }
    
    // Apply department filter
    if (filters.department) {
      filteredEvaluations = filteredEvaluations.filter(e => 
        e.employee_department === filters.department
      )
    }
    
    // Apply talent segment filter
    if (filters.talent_segment) {
      filteredEvaluations = filteredEvaluations.filter(e => 
        e.talent_segment === filters.talent_segment
      )
    }
    
    // Recalculate statistics based on filtered data
    // Keep original total_employees (all accessible employees), not just filtered evaluations
    const evaluated = filteredEvaluations.filter(e => e.overall_score !== null).length
    const stars = filteredEvaluations.filter(e => e.talent_segment === 'Star').length
    const highPotential = filteredEvaluations.filter(e => e.talent_segment === 'High Potential').length
    const completionPercentage = originalTotalEmployees > 0 ? Math.round((evaluated / originalTotalEmployees) * 100) : 0
    
    return {
      ...allAnalyticsData,
      evaluations: filteredEvaluations,
      statistics: {
        total_employees: originalTotalEmployees, // Keep original count of all accessible employees
        evaluated,
        stars,
        high_potential: highPotential,
        completion_percentage: completionPercentage
      }
    }
  }, [allAnalyticsData, filters])
  
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }
  
  const clearFilters = () => {
    setFilters({
      name: '',
      department: '',
      talent_segment: ''
    })
  }
  
  const exportToCSV = async () => {
    setExporting(true)
    setError(null)
    
    try {
      // Use filters for export API call
      const params = {}
      if (filters.name) params.name = filters.name
      if (filters.department) params.department = filters.department
      if (filters.talent_segment) params.talent_segment = filters.talent_segment
      
      // Add period filter
      if (selectedPeriod) {
        const [year, month] = selectedPeriod.split('-')
        params.period_month = parseInt(month)
        params.period_year = parseInt(year)
      }
      
      const response = await apiClient.get('/api/culture/performance-evaluations/export', {
        params,
        responseType: 'blob'
      })
      
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `performance_evaluations_export_${new Date().toISOString().split('T')[0]}.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (err) {
      console.error('Error exporting:', err)
      setError('Failed to export data')
    } finally {
      setExporting(false)
    }
  }
  
  const getTalentBadgeClass = (segment) => {
    switch (segment) {
      case 'Star': return 'bg-yellow-100 text-yellow-800'
      case 'High Potential': return 'bg-blue-100 text-blue-800'
      case 'Core': return 'bg-green-100 text-green-800'
      case 'Development Zone': return 'bg-red-100 text-red-800'
      default: return 'bg-slate-100 text-slate-800'
    }
  }
  
  const getScoreColor = (score) => {
    if (score === null || score === undefined) return 'text-slate-400'
    if (score >= 4.5) return 'text-yellow-600 font-semibold'
    if (score >= 3.8) return 'text-blue-600 font-semibold'
    if (score >= 3.0) return 'text-green-600 font-semibold'
    return 'text-red-600 font-semibold'
  }
  
  const formatMonthYear = (month, year) => {
    if (!month || !year) return '—'
    const date = new Date(year, month - 1, 1)
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  }
  
  const hasActiveFilters = Object.values(filters).some(v => v !== '')
  
  return (
    <div>
      {/* Statistics Cards */}
      {analyticsData?.statistics && (
        <div className="grid grid-cols-5 gap-4 mb-6">
          <div className="bg-white border border-slate-200 rounded-lg p-5 text-center">
            <div className="text-3xl font-bold text-slate-900 mb-1">
              {analyticsData.statistics.total_employees}
            </div>
            <div className="text-xs uppercase text-slate-600">Total Employees</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-5 text-center">
            <div className="text-3xl font-bold text-slate-900 mb-1">
              {analyticsData.statistics.evaluated}
            </div>
            <div className="text-xs uppercase text-slate-600">Evaluated</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-5 text-center">
            <div className="text-3xl font-bold text-yellow-600 mb-1">
              {analyticsData.statistics.stars}
            </div>
            <div className="text-xs uppercase text-slate-600">Stars (≥4.5)</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-5 text-center">
            <div className="text-3xl font-bold text-blue-600 mb-1">
              {analyticsData.statistics.high_potential}
            </div>
            <div className="text-xs uppercase text-slate-600">High Potential</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-5 text-center">
            <div className="text-3xl font-bold text-green-600 mb-1">
              {analyticsData.statistics.completion_percentage}%
            </div>
            <div className="text-xs uppercase text-slate-600">Completion</div>
          </div>
        </div>
      )}
      
      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 mb-6">
        <div className="flex gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">
              Search by Name
            </label>
            <input
              type="text"
              value={filters.name}
              onChange={(e) => handleFilterChange('name', e.target.value)}
              placeholder="Search by name or role..."
              className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>
          <div className="min-w-[150px]">
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">
              Department
            </label>
            <select
              value={filters.department}
              onChange={(e) => handleFilterChange('department', e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-300 text-sm rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="">All Departments</option>
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
          <div className="min-w-[150px]">
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">
              Talent Segment
            </label>
            <select
              value={filters.talent_segment}
              onChange={(e) => handleFilterChange('talent_segment', e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="">All Segments</option>
              <option value="Star">Star</option>
              <option value="High Potential">High Potential</option>
              <option value="Core">Core</option>
              <option value="Development Zone">Development Zone</option>
            </select>
          </div>
          <div className="min-w-[200px]">
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">
              Evaluation Period
            </label>
            <div className="relative" ref={periodDropdownRef}>
              <div className="relative">
                <input
                  type="text"
                  value={periodSearchTerm}
                  readOnly
                  onClick={handlePeriodInputClick}
                  onFocus={() => setShowPeriodDropdown(true)}
                  placeholder="Select period..."
                  className="block w-full px-3 py-1.5 pr-8 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 cursor-pointer bg-white"
                />
                {periodSearchTerm && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      clearPeriodSelection()
                    }}
                    className="absolute inset-y-0 right-6 flex items-center text-slate-400 hover:text-slate-600"
                    type="button"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowPeriodDropdown(!showPeriodDropdown)
                  }}
                  className="absolute inset-y-0 right-0 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                  style={{ paddingRight: '6px' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                  </svg>
                </button>
              </div>
              
              {/* Calendar Dropdown */}
              {showPeriodDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded-md shadow-lg">
                  <div className="p-3">
                    {/* Year Navigation */}
                    <div className="flex items-center justify-between mb-3">
                      <button
                        onClick={() => navigateCalendarYear(-1)}
                        className="p-1 hover:bg-slate-100 rounded transition-colors"
                        type="button"
                      >
                        <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/>
                        </svg>
                      </button>
                      <div className="font-semibold text-sm text-slate-900">{calendarView.year}</div>
                      <button
                        onClick={() => navigateCalendarYear(1)}
                        className="p-1 hover:bg-slate-100 rounded transition-colors"
                        type="button"
                      >
                        <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
                        </svg>
                      </button>
                    </div>
                    
                    {/* Month Grid */}
                    <div className="grid grid-cols-3 gap-2">
                      {calendarMonths.map(month => (
                        <button
                          key={month.value}
                          onClick={() => handlePeriodSelect(month)}
                          className={`px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                            month.isSelected
                              ? 'bg-green-600 text-white'
                              : month.isCurrentMonth
                              ? 'bg-green-50 text-green-700 border border-green-200'
                              : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {month.label.substring(0, 3)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="px-4 py-1 bg-slate-100 text-slate-700 text-sm rounded-lg hover:bg-slate-200 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
                Clear Filters
              </button>
            )}
            <button
              onClick={exportToCSV}
              disabled={exporting}
              className="px-4 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {exporting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Exporting...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                  Export CSV
                </>
              )}
            </button>
          </div>
        </div>
      </div>
      
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          {error}
        </div>
      )}
      
      {loading && (
        <div className="text-center py-12">
          <div className="flex items-center justify-center gap-3">
            <div className="w-4 h-4 border-2 border-green-200 border-t-green-700 rounded-full animate-spin"></div>
            <p className="text-slate-600 text-sm">Loading analytics...</p>
          </div>
        </div>
      )}
      
      {!loading && analyticsData && (
        <>
          {analyticsData.evaluations.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-lg p-16 text-center">
              <svg className="w-16 h-16 text-slate-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No Evaluations Found</h3>
              <p className="text-slate-600">
                {hasActiveFilters 
                  ? 'No evaluations match your current filters. Try adjusting your search criteria.'
                  : 'No evaluations have been created yet.'}
              </p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-green-600 text-white">
                  <tr>
                    <th className="text-left p-3 text-xs font-semibold uppercase">Employee</th>
                    <th className="text-left p-3 text-xs font-semibold uppercase">Department</th>
                    <th className="text-center p-3 text-xs font-semibold uppercase">Overall</th>
                    <th className="text-center p-3 text-xs font-semibold uppercase">Segment</th>
                    <th className="text-center p-3 text-xs font-semibold uppercase">Role</th>
                    <th className="text-center p-3 text-xs font-semibold uppercase">Values</th>
                    <th className="text-center p-3 text-xs font-semibold uppercase">DNA</th>
                    <th className="text-center p-3 text-xs font-semibold uppercase">Leadership</th>
                    <th className="text-center p-3 text-xs font-semibold uppercase">Last Eval</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {analyticsData.evaluations.map((evaluation) => (
                    <tr
                      key={evaluation.evaluation_id}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="p-3">
                        <div className="font-semibold text-slate-900">{evaluation.employee_name}</div>
                        <div className="text-xs text-slate-500">{evaluation.employee_role}</div>
                      </td>
                      <td className="p-3 text-slate-700">{evaluation.employee_department}</td>
                      <td className="p-3 text-center">
                        <span className={getScoreColor(evaluation.overall_score)}>
                          {evaluation.overall_score !== null ? evaluation.overall_score.toFixed(2) : '—'}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {evaluation.talent_segment && (
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${getTalentBadgeClass(evaluation.talent_segment)}`}>
                            {evaluation.talent_segment}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center text-slate-700">
                        {evaluation.role_effectiveness_score !== null ? evaluation.role_effectiveness_score.toFixed(2) : '—'}
                      </td>
                      <td className="p-3 text-center text-slate-700">
                        {evaluation.values_score !== null ? evaluation.values_score.toFixed(2) : '—'}
                      </td>
                      <td className="p-3 text-center text-slate-700">
                        {evaluation.dna_score !== null ? evaluation.dna_score.toFixed(2) : '—'}
                      </td>
                      <td className="p-3 text-center text-slate-700">
                        {evaluation.leadership_score !== null ? evaluation.leadership_score.toFixed(2) : '—'}
                      </td>
                      <td className="p-3 text-center text-slate-600 text-sm">
                        {formatMonthYear(evaluation.period_month, evaluation.period_year)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default AnalyticsTab

