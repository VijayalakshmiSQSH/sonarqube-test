import React, { useState, useEffect, memo, useMemo } from 'react'
import { getCookie } from '../../utils/helpers.js'
import { TOKEN, getApiBaseUrl } from '../../utils/constants.js'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts'

const AllocationAnalysisTab = memo(({ 
  employees, 
  weeklyAllocations, 
  projects, 
  searchTerm, 
  filters, 
  isAuthenticated 
}) => {
  // Time period state
  const [timePeriod, setTimePeriod] = useState('30_days')
  const [customDateRange, setCustomDateRange] = useState({
    start: '',
    end: ''
  })

  // Time period options
  const timePeriodOptions = [
    { value: '30_days', label: 'Last 30 Days' },
    { value: 'quarter', label: 'Current Quarter' },
    { value: '6_months', label: 'Last 6 Months' },
    { value: 'ytd', label: 'Year to Date' },
    { value: 'custom', label: 'Custom Range' }
  ]

  // Get date range based on selected time period
  const getDateRange = () => {
    const now = new Date()
    const startOfYear = new Date(now.getFullYear(), 0, 1)
    
    switch (timePeriod) {
      case '30_days':
        const thirtyDaysAgo = new Date(now)
        thirtyDaysAgo.setDate(now.getDate() - 30)
        return { start: thirtyDaysAgo, end: now }
      
      case 'quarter':
        const currentQuarter = Math.floor(now.getMonth() / 3)
        const quarterStart = new Date(now.getFullYear(), currentQuarter * 3, 1)
        return { start: quarterStart, end: now }
      
      case '6_months':
        const sixMonthsAgo = new Date(now)
        sixMonthsAgo.setMonth(now.getMonth() - 6)
        return { start: sixMonthsAgo, end: now }
      
      case 'ytd':
        return { start: startOfYear, end: now }
      
      case 'custom':
        return {
          start: customDateRange.start ? new Date(customDateRange.start) : null,
          end: customDateRange.end ? new Date(customDateRange.end) : null
        }
      
      default:
        return { start: thirtyDaysAgo, end: now }
    }
  }

  // Filter allocations based on time period and other filters
  const filteredAllocations = useMemo(() => {
    const { start, end } = getDateRange()
    
    return weeklyAllocations.filter(allocation => {
      // Add safety checks for allocation data
      if (!allocation || !allocation.employee_id || !allocation.project_id) return false
      
      try {
        const employee = employees.find(emp => emp.id === allocation.employee_id)
        const project = projects.find(proj => proj.id === allocation.project_id)
        
        if (!employee || !project) return false
        
        // Time period filter
        if (start && end) {
          const allocationStart = new Date(allocation.start_date)
          const allocationEnd = allocation.end_date ? new Date(allocation.end_date) : new Date()
          
          // Check if allocation overlaps with the selected time period
          if (allocationEnd < start || allocationStart > end) return false
        }
        
        // Search term filter with null checks
        const employeeName = employee ? `${employee.first_name || ''} ${employee.last_name || ''}`.trim() : ''
        const matchesSearch = !searchTerm || 
          (employeeName && employeeName.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (employee.designation && employee.designation.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (project.name && project.name.toLowerCase().includes(searchTerm.toLowerCase()))
        
        // Analytics-specific filters
        const matchesTimePeriod = !filters.time_period || (() => {
          if (!filters.time_period) return true
          
          const now = new Date()
          const allocationStart = new Date(allocation.start_date)
          const allocationEnd = allocation.end_date ? new Date(allocation.end_date) : new Date()
          
          switch (filters.time_period) {
            case 'week':
              const weekStart = new Date(now)
              weekStart.setDate(now.getDate() - now.getDay()) // Start of current week
              return allocationEnd >= weekStart && allocationStart <= now
              
            case 'month':
              const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
              return allocationEnd >= monthStart && allocationStart <= now
              
            case 'quarter':
              const currentQuarter = Math.floor(now.getMonth() / 3)
              const quarterStart = new Date(now.getFullYear(), currentQuarter * 3, 1)
              return allocationEnd >= quarterStart && allocationStart <= now
              
            case 'year':
              const yearStart = new Date(now.getFullYear(), 0, 1)
              return allocationEnd >= yearStart && allocationStart <= now
              
            default:
              return true
          }
        })()
        
        const matchesEfficiency = !filters.efficiency || (() => {
          if (!filters.efficiency) return true
          
          // Calculate employee's total allocation percentage
          const employeeAllocations = weeklyAllocations.filter(alloc => 
            alloc.employee_id === allocation.employee_id && alloc.status === 'Active'
          )
          const totalAllocation = employeeAllocations.reduce((sum, alloc) => 
            sum + (alloc.allocation_percentage || 0), 0
          )
          
          switch (filters.efficiency) {
            case 'low':
              return totalAllocation >= 0 && totalAllocation <= 50
            case 'medium':
              return totalAllocation > 50 && totalAllocation <= 80
            case 'high':
              return totalAllocation > 80 && totalAllocation <= 100
            default:
              return true
          }
        })()
        
        const matchesAnalysisType = !filters.analysis_type || true // Analysis type is more about display, not filtering
        
        const matchesMetric = !filters.metric || true // Metric is more about display, not filtering
        
        return matchesSearch && matchesTimePeriod && matchesEfficiency && matchesAnalysisType && matchesMetric
      } catch (error) {
        console.error('Error filtering allocation:', allocation, error)
        return false
      }
    })
  }, [weeklyAllocations, employees, projects, searchTerm, filters, timePeriod, customDateRange])

  // Calculate key metrics
  const analyticsMetrics = useMemo(() => {
    if (!employees.length) {
      return {
        overallUtilization: 0,
        billableUtilization: 0,
        overAllocatedCount: 0,
        benchCapacityPercentage: 0,
        totalEmployees: employees.length,
        activeAllocations: 0,
        employeesWithAllocations: 0
      }
    }

    // Group allocations by employee
    const employeeAllocations = {}
    filteredAllocations.forEach(allocation => {
      if (!employeeAllocations[allocation.employee_id]) {
        employeeAllocations[allocation.employee_id] = []
      }
      employeeAllocations[allocation.employee_id].push(allocation)
    })

    // Calculate metrics
    let totalAllocationPercentage = 0
    let totalBillableAllocationPercentage = 0
    let overAllocatedCount = 0
    let employeesWithAllocations = 0
    let hasBillableData = false

    // Process each employee
    employees.forEach(employee => {
      const allocations = employeeAllocations[employee.id] || []
      
      if (allocations.length > 0) {
        employeesWithAllocations++
        
        // Calculate total allocation for this employee
        const totalAllocation = allocations.reduce((sum, alloc) => {
          if (alloc.status === 'Active') {
            return sum + (alloc.allocation_percentage || 0)
          }
          return sum
        }, 0)

        totalAllocationPercentage += totalAllocation

        // Calculate billable allocation
        const billableAllocation = allocations.reduce((sum, alloc) => {
          if (alloc.status === 'Active' && alloc.billable) {
            hasBillableData = true
            return sum + (alloc.allocation_percentage || 0)
          }
          return sum
        }, 0)

        totalBillableAllocationPercentage += billableAllocation

        // Check for over-allocation
        if (totalAllocation > 100) {
          overAllocatedCount++
        }
      }
    })

    const totalEmployees = employees.length
    const activeAllocations = filteredAllocations.filter(alloc => alloc.status === 'Active').length
    const employeesWithNoAllocations = totalEmployees - employeesWithAllocations

    return {
      // Overall Utilization = Sum of all employee allocation percentages ÷ Total employees
      overallUtilization: totalEmployees > 0 ? (totalAllocationPercentage / totalEmployees) : 0,
      // Billable Utilization = 0% if no billing data exists, otherwise calculate normally
      billableUtilization: hasBillableData && totalEmployees > 0 ? (totalBillableAllocationPercentage / totalEmployees) : 0,
      overAllocatedCount,
      benchCapacityPercentage: totalEmployees > 0 ? (employeesWithNoAllocations / totalEmployees) * 100 : 0,
      totalEmployees,
      activeAllocations,
      employeesWithAllocations
    }
  }, [filteredAllocations, employees])

  // Calculate department utilization
  const departmentUtilization = useMemo(() => {
    const deptStats = {}
    
    // Initialize department stats with all employees
    employees.forEach(employee => {
      const dept = employee.department || 'Unknown'
      if (!deptStats[dept]) {
        deptStats[dept] = {
          totalEmployees: 0,
          totalAllocation: 0,
          employeesWithAllocations: new Set()
        }
      }
      deptStats[dept].totalEmployees++
    })

    // Group allocations by employee first
    const employeeAllocations = {}
    filteredAllocations.forEach(allocation => {
      if (!employeeAllocations[allocation.employee_id]) {
        employeeAllocations[allocation.employee_id] = []
      }
      employeeAllocations[allocation.employee_id].push(allocation)
    })

    // Calculate department utilization based on employee totals
    employees.forEach(employee => {
      const dept = employee.department || 'Unknown'
      const allocations = employeeAllocations[employee.id] || []
      
      if (allocations.length > 0) {
        // Calculate total allocation for this employee
        const totalAllocation = allocations.reduce((sum, alloc) => {
          if (alloc.status === 'Active') {
            return sum + (alloc.allocation_percentage || 0)
          }
          return sum
        }, 0)

        deptStats[dept].totalAllocation += totalAllocation
        deptStats[dept].employeesWithAllocations.add(employee.id)
      }
    })

    // Return all departments, even those with 0% utilization
    return Object.entries(deptStats).map(([dept, stats]) => ({
      department: dept,
      // Department utilization = Total allocation in department ÷ Total employees in department
      utilization: stats.totalEmployees > 0 ? (stats.totalAllocation / stats.totalEmployees) : 0,
      totalEmployees: stats.totalEmployees,
      employeesWithAllocations: stats.employeesWithAllocations.size
    })).sort((a, b) => b.utilization - a.utilization)
  }, [filteredAllocations, employees])

  // Calculate allocation distribution
  const allocationDistribution = useMemo(() => {
    const buckets = {
      '0-25%': 0,
      '26-50%': 0,
      '51-75%': 0,
      '76-100%': 0,
      'Over 100%': 0
    }

    const employeeAllocations = {}
    filteredAllocations.forEach(allocation => {
      if (!employeeAllocations[allocation.employee_id]) {
        employeeAllocations[allocation.employee_id] = []
      }
      employeeAllocations[allocation.employee_id].push(allocation)
    })

    Object.entries(employeeAllocations).forEach(([employeeId, allocations]) => {
      const totalAllocation = allocations.reduce((sum, alloc) => {
        if (alloc.status === 'Active') {
          return sum + (alloc.allocation_percentage || 0)
        }
        return sum
      }, 0)

      if (totalAllocation <= 25) buckets['0-25%']++
      else if (totalAllocation <= 50) buckets['26-50%']++
      else if (totalAllocation <= 75) buckets['51-75%']++
      else if (totalAllocation <= 100) buckets['76-100%']++
      else buckets['Over 100%']++
    })

    return buckets
  }, [filteredAllocations])


  // Chart data for department utilization (Recharts format)
  const departmentChartData = departmentUtilization.map((dept, index) => ({
    department: dept.department,
    utilization: dept.utilization,
    employees: dept.totalEmployees,
    employeesWithAllocations: dept.employeesWithAllocations,
    fill: [
      '#3B82F6', // Blue
      '#10B981', // Green
      '#F59E0B', // Yellow
      '#EF4444', // Red
      '#8B5CF6', // Purple
      '#EC4899', // Pink
      '#22C55E', // Emerald
      '#FB923C', // Orange
    ][index % 8]
  }))

  // Debug logging
  console.log('Department Utilization Data:', departmentUtilization)
  console.log('Department Chart Data:', departmentChartData)

  // Chart data for allocation distribution (Recharts format)
  const distributionChartData = Object.entries(allocationDistribution).map(([range, count], index) => ({
    range,
    count,
    fill: [
      '#22C55E', // Green
      '#3B82F6', // Blue
      '#F59E0B', // Yellow
      '#EF4444', // Red
      '#8B5CF6', // Purple
    ][index % 5]
  }))

  // Custom tooltip for department chart
  const DepartmentTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-slate-800 text-white p-3 rounded-lg shadow-lg border border-slate-600">
          <p className="font-semibold">{label}</p>
          <p className="text-green-300">Utilization: {data.utilization.toFixed(1)}%</p>
          <p className="text-green-300">Total Employees: {data.employees}</p>
          <p className="text-yellow-300">With Allocations: {data.employeesWithAllocations}</p>
        </div>
      )
    }
    return null
  }

  // Custom tooltip for distribution chart
  const DistributionTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      const total = distributionChartData.reduce((sum, item) => sum + item.count, 0)
      const percentage = ((data.count / total) * 100).toFixed(1)
      return (
        <div className="bg-slate-800 text-white p-3 rounded-lg shadow-lg border border-slate-600">
          <p className="font-semibold">{data.range}</p>
          <p className="text-green-300">Employees: {data.count}</p>
          <p className="text-green-300">Percentage: {percentage}%</p>
        </div>
      )
    }
    return null
  }

  // Export function
  const handleExport = () => {
    const exportData = {
      metrics: analyticsMetrics,
      departmentUtilization,
      allocationDistribution,
      timePeriod,
      generatedAt: new Date().toISOString()
    }
    
    const dataStr = JSON.stringify(exportData, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `allocation-analytics-${new Date().toISOString().split('T')[0]}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      {/* Header with Time Period Selector */}
      <div className="px-6 py-4 border-b border-slate-200">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Allocation Analytics Dashboard</h2>
            <p className="text-sm text-slate-600 mt-1">Comprehensive analysis of resource allocation patterns and efficiency metrics</p>
          </div>
          <div className="flex gap-3 items-center">
            {/* Time Period Selector */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-700">Time Period:</label>
              <select
                value={timePeriod}
                onChange={(e) => setTimePeriod(e.target.value)}
                className="px-3 py-1 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {timePeriodOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Custom Date Range */}
            {timePeriod === 'custom' && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customDateRange.start}
                  onChange={(e) => setCustomDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="px-2 py-1 border border-slate-300 rounded text-sm"
                />
                <span className="text-slate-500">to</span>
                <input
                  type="date"
                  value={customDateRange.end}
                  onChange={(e) => setCustomDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="px-2 py-1 border border-slate-300 rounded text-sm"
                />
              </div>
            )}
            
            <button
              onClick={handleExport}
              className="bg-green-700 text-white border border-slate-300 px-4 py-2 text-sm font-medium rounded-lg hover:bg-green-800"
            >
              Export Analytics
            </button>
          </div>
        </div>
      </div>

      {/* Dashboard Content */}
      <div className="p-6 space-y-6">
        {/* Executive Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl border border-green-200 shadow-sm">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-green-200 rounded-xl flex items-center justify-center shadow-sm">
                  <svg className="w-6 h-6 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-green-700">Overall Utilization</p>
                <p className="text-2xl font-bold text-green-900">{analyticsMetrics.overallUtilization.toFixed(1)}%</p>
              </div>
            </div>
          </div>

          {/* <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl border border-green-200 shadow-sm">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-green-200 rounded-xl flex items-center justify-center shadow-sm">
                  <svg className="w-6 h-6 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-green-700">Billable Utilization</p>
                <p className="text-2xl font-bold text-green-900">{analyticsMetrics.billableUtilization.toFixed(1)}%</p>
              </div>
            </div>
          </div> */}

          <div className="bg-gradient-to-br from-red-50 to-red-100 p-6 rounded-xl border border-red-200 shadow-sm">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-red-200 rounded-xl flex items-center justify-center shadow-sm">
                  <svg className="w-6 h-6 text-red-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-red-700">Over-allocated Resources</p>
                <p className="text-2xl font-bold text-red-900">{analyticsMetrics.overAllocatedCount}</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-6 rounded-xl border border-yellow-200 shadow-sm">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-yellow-200 rounded-xl flex items-center justify-center shadow-sm">
                  <svg className="w-6 h-6 text-yellow-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-yellow-700">Bench Capacity</p>
                <p className="text-2xl font-bold text-yellow-900">{analyticsMetrics.benchCapacityPercentage.toFixed(1)}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Department Utilization Chart */}
          <div className="bg-gradient-to-br from-slate-50 to-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center mb-6">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                <svg className="w-5 h-5 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Utilization by Department</h3>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={departmentChartData} 
                  margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                  barCategoryGap="20%"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="department" 
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={{ stroke: '#e2e8f0' }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    interval={0}
                  />
                  <YAxis 
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    axisLine={{ stroke: '#e2e8f0' }}
                    domain={[0, 100]}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip content={<DepartmentTooltip />} />
                  <Bar 
                    dataKey="utilization" 
                    radius={[4, 4, 0, 0]}
                    stroke="#1e293b"
                    strokeWidth={1}
                  >
                    {departmentChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Allocation Distribution Chart */}
          <div className="bg-gradient-to-br from-slate-50 to-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center mb-6">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Allocation Distribution</h3>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={distributionChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={120}
                    dataKey="count"
                  >
                    {distributionChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<DistributionTooltip />} />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36}
                    iconType="circle"
                    wrapperStyle={{ fontSize: '12px', color: '#64748b' }}
                    formatter={(value, entry) => entry.payload.range}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Additional Metrics */}
        {/* <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg border border-slate-200">
            <h4 className="text-sm font-medium text-slate-600 mb-2">Total Employees</h4>
            <p className="text-3xl font-bold text-slate-900">{analyticsMetrics.totalEmployees}</p>
            <p className="text-sm text-slate-500 mt-1">{analyticsMetrics.employeesWithAllocations} with allocations</p>
          </div>
          
          <div className="bg-white p-6 rounded-lg border border-slate-200">
            <h4 className="text-sm font-medium text-slate-600 mb-2">Active Allocations</h4>
            <p className="text-3xl font-bold text-slate-900">{analyticsMetrics.activeAllocations}</p>
            <p className="text-sm text-slate-500 mt-1">Currently active</p>
          </div>
          
          <div className="bg-white p-6 rounded-lg border border-slate-200">
            <h4 className="text-sm font-medium text-slate-600 mb-2">Time Period</h4>
            <p className="text-lg font-semibold text-slate-900">
              {timePeriodOptions.find(opt => opt.value === timePeriod)?.label}
            </p>
            <p className="text-sm text-slate-500 mt-1">
              {filteredAllocations.length} allocations found
            </p>
          </div>
        </div> */}

        {/* Department Details Table */}
        {departmentUtilization.length > 0 && (
          <div className="bg-white rounded-lg border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Department Breakdown</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Department</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Utilization</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Total Employees</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">With Allocations</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Bench</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {departmentUtilization.map((dept, index) => (
                    <tr key={index} className="hover:bg-slate-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-slate-900">{dept.department}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-20 bg-slate-200 rounded-full h-2 mr-3">
                            <div 
                              className={`h-2 rounded-full ${
                                dept.utilization <= 25 ? 'bg-green-500' :
                                dept.utilization <= 75 ? 'bg-yellow-500' :
                                dept.utilization <= 100 ? 'bg-orange-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${Math.min(dept.utilization, 100)}%` }}
                            ></div>
                          </div>
                          <span className="text-sm text-slate-600">{dept.utilization.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                        {dept.totalEmployees}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                        {dept.employeesWithAllocations}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                        {dept.totalEmployees - dept.employeesWithAllocations}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  )
})

AllocationAnalysisTab.displayName = 'AllocationAnalysisTab'

export default AllocationAnalysisTab
