import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useDepartments } from '../hooks/useKRAs.js'
import { useEmployees } from '../context/EmployeeContext.jsx'

const KRAForm = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  editingKRA = null, 
  loading = false,
  existingKRAs = []
}) => {
  const [formData, setFormData] = useState({
    kra_title: '',
    department_id: '',
    role: '',
    impact: 'Low',
    year: new Date().getFullYear().toString(), // Set current year as default
    description: '',
    expectations: ['']
  })

  const [errors, setErrors] = useState({})
  const [departmentSearch, setDepartmentSearch] = useState('')
  const [roleSearch, setRoleSearch] = useState('')
  const [showDepartmentDropdown, setShowDepartmentDropdown] = useState(false)
  const [showRoleDropdown, setShowRoleDropdown] = useState(false)
  const [departmentEditMode, setDepartmentEditMode] = useState(false)
  const [roleEditMode, setRoleEditMode] = useState(false)
  const departmentRef = useRef(null)
  const roleRef = useRef(null)

  // Get employees for dynamic department and role options
  const { getAllEmployees } = useEmployees()
  const allEmployees = getAllEmployees()

  // Use the departments hook
  const { 
    departments, 
    loading: departmentsLoading, 
    error: departmentsError,
    fetchDepartments
  } = useDepartments()

  // Only fetch departments once per session (avoid refetching on every form open/close)
  useEffect(() => {
    // Check if departments have been fetched in this session
    const departmentsFetched = sessionStorage.getItem('kra_departments_fetched') === 'true'
    
    // Only fetch if:
    // 1. Form is open
    // 2. Departments are empty (not already loaded)
    // 3. Not currently loading
    // 4. Haven't been fetched in this session (to prevent refetching on every form open)
    if (isOpen && departments.length === 0 && !departmentsLoading && !departmentsFetched) {
      fetchDepartments().then(() => {
        // Mark as fetched in session storage after successful fetch
        sessionStorage.setItem('kra_departments_fetched', 'true')
      }).catch(() => {
        // Don't mark as fetched if there was an error - allow retry
      })
    }
  }, [isOpen, departments.length, departmentsLoading, fetchDepartments])

  // Get unique departments from employees
  const employeeDepartments = useMemo(() => {
    return [...new Set(allEmployees.map(emp => emp.department).filter(Boolean))].sort()
  }, [allEmployees])

  // Get roles filtered by selected department (cascading)
  const availableRoles = useMemo(() => {
    const selectedDeptName = departmentSearch.trim()
    
    if (!selectedDeptName) {
      // If no department selected, show all roles
      return [...new Set(allEmployees
        .map(emp => emp.designation || emp.title)
        .filter(Boolean)
      )].sort()
    } else {
      // Only show roles that belong to the selected department
      return [...new Set(allEmployees
        .filter(emp => 
          emp.department && 
          emp.department === selectedDeptName &&
          (emp.designation || emp.title)
        )
        .map(emp => emp.designation || emp.title)
        .filter(Boolean)
      )].sort()
    }
  }, [allEmployees, departmentSearch])

  // Initialize form data when editing or when modal opens
  useEffect(() => {
    if (editingKRA) {
      setFormData({
        kra_title: editingKRA.kra_title || editingKRA.kraTitle || '',
        department_id: editingKRA.department_id || '',
        role: editingKRA.role || '',
        impact: editingKRA.impact || 'Low',
        year: editingKRA.year || new Date().getFullYear().toString(), // Default to current year if empty
        description: editingKRA.description || '',
        expectations: editingKRA.expectations && editingKRA.expectations.length > 0 
          ? editingKRA.expectations 
          : ['']
      })
      // Set department search to department name for display
      // Try to get from editingKRA.department first (string), then from departments hook
      const deptName = editingKRA.department || (editingKRA.department_id ? departments.find(dept => dept.department_id === editingKRA.department_id)?.department_name : '')
      setDepartmentSearch(deptName || '')
      setRoleSearch(editingKRA.role || '')
    } else {
      // Reset form for new KRA only when modal first opens (not when departments change)
      setFormData({
        kra_title: '',
        department_id: '',
        role: '',
        impact: 'Low',
        year: new Date().getFullYear().toString(), // Set current year as default
        description: '',
        expectations: ['']
      })
      setDepartmentSearch('')
      setRoleSearch('')
    }
    setErrors({})
    setShowDepartmentDropdown(false)
    setShowRoleDropdown(false)
    setDepartmentEditMode(false)
    setRoleEditMode(false)
  }, [editingKRA, isOpen])

  // Update department search when departments list changes (for editing mode)
  useEffect(() => {
    if (editingKRA && editingKRA.department_id && departments.length > 0) {
      const deptName = editingKRA.department || departments.find(dept => dept.department_id === editingKRA.department_id)?.department_name
      if (deptName) {
        setDepartmentSearch(prev => prev !== deptName ? deptName : prev)
      }
    }
  }, [departments, editingKRA])


  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (departmentRef.current && !departmentRef.current.contains(event.target)) {
        setShowDepartmentDropdown(false)
      }
      if (roleRef.current && !roleRef.current.contains(event.target)) {
        setShowRoleDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const impacts = ['Low', 'Medium', 'High']

  // YearPicker Component
  const YearPicker = ({ value, onChange }) => {
    const [isOpen, setIsOpen] = useState(false)
    const [decadeStart, setDecadeStart] = useState(() => {
      const currentYear = new Date().getFullYear()
      return Math.floor(currentYear / 12) * 12
    })
    const dropdownRef = useRef(null)

    useEffect(() => {
      const handleClickOutside = (event) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
          setIsOpen(false)
        }
      }
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // When opening, navigate to the decade containing the selected year
    useEffect(() => {
      if (isOpen && value) {
        const selectedYear = parseInt(value)
        const yearDecadeStart = Math.floor(selectedYear / 12) * 12
        setDecadeStart(yearDecadeStart)
      }
    }, [isOpen, value])

    // Generate years for current decade (12 years: decade start to decade start + 11)
    const getDecadeYears = () => {
      const years = []
      for (let i = 0; i < 12; i++) {
        years.push(decadeStart + i)
      }
      return years
    }

    const navigateDecade = (direction) => {
      setDecadeStart(prev => prev + (direction === 'next' ? 12 : -12))
    }

    return (
      <div ref={dropdownRef} className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full px-3 py-2 text-left border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white flex items-center justify-between text-sm ${
            errors.year ? 'border-red-300' : 'border-slate-300'
          }`}
          disabled={loading}
        >
          <span className={value ? 'text-slate-900' : 'text-slate-500'}>
            {value || 'Select Year'}
          </span>
          <svg 
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
          </svg>
        </button>

        {isOpen && (
          <div className="absolute z-50 mt-1 bg-white border border-slate-300 rounded-lg shadow-lg p-3 w-[280px]">
            {/* Decade Navigation */}
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={() => navigateDecade('prev')}
                className="p-1 hover:bg-slate-100 rounded transition-colors"
              >
                <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/>
                </svg>
              </button>
              <span className="text-sm font-medium text-slate-700">
                {decadeStart} - {decadeStart + 11}
              </span>
              <button
                type="button"
                onClick={() => navigateDecade('next')}
                className="p-1 hover:bg-slate-100 rounded transition-colors"
              >
                <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
                </svg>
              </button>
            </div>

            {/* Years Grid */}
            <div className="grid grid-cols-3 gap-2">
              {getDecadeYears().map(year => (
                <button
                  key={year}
                  type="button"
                  onClick={() => {
                    onChange(year.toString())
                    setIsOpen(false)
                  }}
                  className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                    value === year.toString()
                      ? 'bg-green-700 text-white font-medium'
                      : 'bg-slate-50 text-slate-700 hover:bg-green-50 hover:text-green-700'
                  }`}
                >
                  {year}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Filtered options based on search - using employee departments
  const filteredDepartments = employeeDepartments.filter(dept => 
    dept.toLowerCase().includes(departmentSearch.toLowerCase())
  )

  // Filtered roles based on search - using available roles (already filtered by department)
  const filteredRoles = availableRoles.filter(role => 
    role.toLowerCase().includes(roleSearch.toLowerCase())
  )

  // Search handlers
  const handleDepartmentSearch = (value) => {
    setDepartmentSearch(value)
    setFormData(prev => ({ ...prev, department_id: '', role: '' })) // Clear department_id and role when searching
    setRoleSearch('') // Clear role search when department changes
    setShowDepartmentDropdown(true)
  }

  const handleRoleSearch = (value) => {
    setRoleSearch(value)
    setFormData(prev => ({ ...prev, role: value }))
    setShowRoleDropdown(true)
  }

  // Handle department input focus - show dropdown with current value
  const handleDepartmentFocus = () => {
    setShowDepartmentDropdown(true)
    setDepartmentEditMode(true)
  }

  // Handle role input focus - show dropdown with current value
  const handleRoleFocus = () => {
    setShowRoleDropdown(true)
    setRoleEditMode(true)
  }

  const selectDepartment = (deptName) => {
    // Find department_id from departments hook if it exists, otherwise use empty string
    const deptObj = departments.find(dept => dept.department_name === deptName)
    const deptId = deptObj ? deptObj.department_id : ''
    
    setFormData(prev => ({ ...prev, department_id: deptId, role: '' })) // Clear role when department changes
    setDepartmentSearch(deptName)
    setRoleSearch('') // Clear role search when department changes
    setShowDepartmentDropdown(false)
    setDepartmentEditMode(false)
  }

  const selectRole = (role) => {
    setFormData(prev => ({ ...prev, role: role }))
    setRoleSearch(role)
    setShowRoleDropdown(false)
    setRoleEditMode(false)
  }


  const validateForm = () => {
    const newErrors = {}

    if (!formData.kra_title.trim()) {
      newErrors.kra_title = 'KRA Title is required'
    }

    if (!departmentSearch.trim()) {
      newErrors.department = 'Department is required'
    }

    if (!formData.role || !formData.role.trim()) {
      newErrors.role = 'Role is required'
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required'
    }

    // Validate expectations
    const validExpectations = formData.expectations.filter(exp => exp.trim() !== '')
    if (validExpectations.length === 0) {
      newErrors.expectations = 'At least one expectation is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    // Filter out empty expectations
    const validExpectations = formData.expectations.filter(exp => exp.trim() !== '')
    
    const kraData = {
      ...formData,
      department: departmentSearch.trim(), // Include department name
      expectations: validExpectations
    }

    const result = await onSubmit(kraData)
    
    if (result.success) {
      onClose()
    }
  }

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }))
    }
  }

  const handleExpectationChange = (index, value) => {
    const newExpectations = [...formData.expectations]
    newExpectations[index] = value
    setFormData(prev => ({
      ...prev,
      expectations: newExpectations
    }))
    
    if (errors.expectations) {
      setErrors(prev => ({
        ...prev,
        expectations: ''
      }))
    }
  }

  const addExpectation = () => {
    setFormData(prev => ({
      ...prev,
      expectations: [...prev.expectations, '']
    }))
  }

  const removeExpectation = (index) => {
    if (formData.expectations.length > 1) {
      const newExpectations = formData.expectations.filter((_, i) => i !== index)
      setFormData(prev => ({
        ...prev,
        expectations: newExpectations
      }))
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h3 className="text-xl font-bold text-slate-900">
            {editingKRA ? 'Edit KRA' : 'Add New KRA'}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            disabled={loading}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* KRA Title */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              KRA Title *
            </label>
            <input
              type="text"
              value={formData.kra_title || ''}
              onChange={(e) => handleInputChange('kra_title', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
                errors.kra_title ? 'border-red-300' : 'border-slate-300'
              }`}
              placeholder="Enter KRA title"
              disabled={loading}
            />
            {errors.kra_title && (
              <p className="mt-1 text-sm text-red-600">{errors.kra_title}</p>
            )}
          </div>

          {/* Department and Role */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Department *
              </label>
              <div className="relative" ref={departmentRef}>
                <input
                  type="text"
                  value={departmentSearch || ''}
                  onChange={(e) => handleDepartmentSearch(e.target.value)}
                  onFocus={handleDepartmentFocus}
                  placeholder="Search or type department..."
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
                    errors.department ? 'border-red-300' : 'border-slate-300'
                  }`}
                  disabled={loading}
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
                  {departmentSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setDepartmentSearch('')
                        setFormData(prev => ({ ...prev, department_id: '', role: '' }))
                        setRoleSearch('') // Clear role when department is cleared
                      }}
                      className="text-slate-400 hover:text-slate-600"
                      disabled={loading}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                      </svg>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowDepartmentDropdown(!showDepartmentDropdown)}
                    className="text-slate-400 hover:text-slate-600"
                    disabled={loading}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
                    </svg>
                  </button>
                </div>
                
                {showDepartmentDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {departmentsLoading ? (
                      <div className="px-3 py-2 text-slate-500 text-sm flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-slate-300 border-t-green-700 rounded-full animate-spin"></div>
                        Loading departments...
                      </div>
                    ) : filteredDepartments.length > 0 ? (
                      filteredDepartments.map(dept => (
                        <button
                          key={dept}
                          type="button"
                          onClick={() => selectDepartment(dept)}
                          className="w-full px-3 py-2 text-left hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                        >
                          {dept}
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-slate-500 text-sm">
                        {employeeDepartments.length === 0 ? 'No departments available.' : 'No departments found'}
                      </div>
                    )}
                  </div>
                )}
              </div>
              {errors.department && (
                <p className="mt-1 text-sm text-red-600">{errors.department}</p>
              )}
              {departmentsError && (
                <p className="mt-1 text-sm text-red-600">{departmentsError}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Role *
              </label>
              <div className="relative" ref={roleRef}>
                <input
                  type="text"
                  value={roleSearch || ''}
                  onChange={(e) => handleRoleSearch(e.target.value)}
                  onFocus={handleRoleFocus}
                  placeholder="Search or type role..."
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
                    errors.role ? 'border-red-300' : 'border-slate-300'
                  }`}
                  disabled={loading}
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
                  {roleSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setRoleSearch('')
                        setFormData(prev => ({ ...prev, role: '' }))
                      }}
                      className="text-slate-400 hover:text-slate-600"
                      disabled={loading}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                      </svg>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowRoleDropdown(!showRoleDropdown)}
                    className="text-slate-400 hover:text-slate-600"
                    disabled={loading}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
                    </svg>
                  </button>
                </div>
                
                {showRoleDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filteredRoles.length > 0 ? (
                      filteredRoles.map(role => (
                        <button
                          key={role}
                          type="button"
                          onClick={() => selectRole(role)}
                          className="w-full px-3 py-2 text-left hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                        >
                          {role}
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-slate-500 text-sm">
                        {availableRoles.length === 0 
                          ? (departmentSearch.trim() 
                              ? 'No roles available for this department.' 
                              : 'No roles available.')
                          : 'No roles found'}
                      </div>
                    )}
                  </div>
                )}
              </div>
              {errors.role && (
                <p className="mt-1 text-sm text-red-600">{errors.role}</p>
              )}
            </div>
          </div>

          {/* Impact and Year */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Impact Level
              </label>
              <div className="flex gap-4">
                {impacts.map(impact => (
                  <label key={impact} className="flex items-center">
                    <input
                      type="radio"
                      name="impact"
                      value={impact}
                      checked={formData.impact === impact}
                      onChange={(e) => handleInputChange('impact', e.target.value)}
                      className="mr-2"
                      disabled={loading}
                    />
                    <span className="text-sm">{impact}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Year
              </label>
              <YearPicker
                value={formData.year || ''}
                onChange={(value) => handleInputChange('year', value ? parseInt(value) : '')}
              />
              {errors.year && (
                <p className="mt-1 text-sm text-red-600">{errors.year}</p>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Description *
            </label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => handleInputChange('description', e.target.value)}
              rows={4}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
                errors.description ? 'border-red-300' : 'border-slate-300'
              }`}
              placeholder="Describe the KRA in detail"
              disabled={loading}
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-600">{errors.description}</p>
            )}
          </div>

          {/* Expectations */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Expectations / Outcomes *
            </label>
            <div className="space-y-3">
              {formData.expectations.map((expectation, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={expectation || ''}
                    onChange={(e) => handleExpectationChange(index, e.target.value)}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800"
                    placeholder={`Expectation ${index + 1}`}
                    disabled={loading}
                  />
                  {formData.expectations.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeExpectation(index)}
                      className="px-3 py-2 text-red-600 hover:text-red-800 transition-colors"
                      disabled={loading}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                      </svg>
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addExpectation}
                className="text-green-700 hover:text-green-800 text-sm font-medium transition-colors"
                disabled={loading}
              >
                + Add Another Expectation
              </button>
            </div>
            {errors.expectations && (
              <p className="mt-1 text-sm text-red-600">{errors.expectations}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-6 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-green-700 text-white font-medium rounded-lg hover:bg-green-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  {editingKRA ? 'Updating...' : 'Creating...'}
                </div>
              ) : (
                editingKRA ? 'Update KRA' : 'Create KRA'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default KRAForm
