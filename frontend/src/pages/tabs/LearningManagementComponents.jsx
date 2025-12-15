import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useEmployees } from '../../context/EmployeeContext.jsx'

// CSS for animations
export const animationStyles = `
  @keyframes fade-in {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .animate-fade-in {
    animation: fade-in 0.2s ease-out;
  }
  
  .scrollbar-thin {
    scrollbar-width: thin;
  }
  
  .scrollbar-thin::-webkit-scrollbar {
    width: 6px;
  }
  
  .scrollbar-thin::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 3px;
  }
  
  .scrollbar-thin::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 3px;
  }
  
  .scrollbar-thin::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
  }
`

// Searchable Select Component for single selection (e.g., Certificate selection)
export const SearchableSelect = ({ 
  label, 
  options = [], 
  value, 
  onChange, 
  placeholder = "Select option...",
  searchPlaceholder = "Search options...",
  required = false 
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const dropdownRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
        setSearchTerm('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredOptions = options.filter(option =>
    option.label?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleSelect = (optionValue) => {
    onChange(optionValue)
    setIsOpen(false)
    setSearchTerm('')
  }

  const selectedOption = options.find(opt => opt.value === value)

  return (
    <div className="relative" ref={dropdownRef}>
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-2">
          {label}{required && <span className="text-red-500"> *</span>}
        </label>
      )}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2 border border-slate-300 rounded-xl cursor-pointer bg-white flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-green-800 focus:border-transparent transition-all duration-300"
      >
        <span className={selectedOption ? 'text-slate-900' : 'text-slate-500'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 24 24">
          <path d="M7 10l5 5 5-5z"/>
        </svg>
      </div>
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-300 rounded-xl shadow-lg max-h-62 overflow-hidden">
          <div className="p-2 border-b border-slate-200">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800"
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          </div>
          <div className="overflow-y-auto max-h-48 scrollbar-thin">
            {filteredOptions.length > 0 ? (
              filteredOptions.map(option => (
                <div
                  key={option.value}
                  onClick={() => handleSelect(option.value)}
                  className={`px-3 py-2 cursor-pointer hover:bg-slate-100 ${
                    value === option.value ? 'bg-green-50' : ''
                  }`}
                >
                  {option.label}
                </div>
              ))
            ) : (
              <div className="px-3 py-2 text-slate-500 text-sm">No options found</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Multi-Select Component for Owners and Participants
export const MultiSelect = ({ 
  label, 
  options = [], 
  selectedValues = [], 
  onSelectionChange, 
  placeholder = "Click to select...",
  required = false 
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const dropdownRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
        setSearchTerm('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredOptions = options.filter(option =>
    option.label?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleToggle = (value) => {
    const newSelection = selectedValues.includes(value)
      ? selectedValues.filter(v => v !== value)
      : [...selectedValues, value]
    onSelectionChange(newSelection)
  }

  const selectedOptions = options.filter(opt => selectedValues.includes(opt.value))

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-medium text-slate-700 mb-2">
        {label}{required && <span className="text-red-500"> *</span>}
      </label>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 border border-slate-300 rounded-xl cursor-pointer bg-white flex items-center justify-between min-h-[140px] max-h-[300px] overflow-y-auto scrollbar-thin focus:outline-none focus:ring-2 focus:ring-green-800 focus:border-transparent transition-all duration-300"
      >
        {selectedOptions.length > 0 ? (
          <div className="grid grid-cols-3 gap-2 w-full">
            {selectedOptions.map(opt => (
              <div
                key={opt.value}
                className="border border-slate-200 rounded-lg px-2 py-1 text-xs flex items-center justify-between bg-slate-50"
              >
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 12c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                  </svg>
                  {opt.label}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleToggle(opt.value)
                  }}
                  className="ml-2 text-slate-500 hover:text-slate-700"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-slate-500 text-sm">{placeholder}</div>
        )}
        <svg className="w-5 h-5 text-slate-400" fill="currentColor" viewBox="0 0 24 24">
          <path d="M7 10l5 5 5-5z"/>
        </svg>
      </div>
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto scrollbar-thin">
          <div className="p-2 border-b border-slate-200">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800 focus:border-transparent transition-all duration-300"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="p-2">
            {filteredOptions.length > 0 ? (
              filteredOptions.map(option => (
                <div
                  key={option.value}
                  onClick={() => handleToggle(option.value)}
                  className={`px-3 py-2 cursor-pointer hover:bg-slate-100 flex items-center gap-2 ${
                    selectedValues.includes(option.value) ? 'bg-green-50' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedValues.includes(option.value)}
                    onChange={() => {}}
                    className="w-4 h-4"
                  />
                  <span>{option.label}</span>
                </div>
              ))
            ) : (
              <div className="px-3 py-2 text-slate-500 text-sm">No options found</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Employee Multi-Select Component for Program Owners
export const EmployeeMultiSelect = ({ 
  label, 
  selectedValues = [], 
  onSelectionChange, 
  placeholder = "Click to select employees...",
  required = false 
}) => {
  const { getAllEmployees, loading } = useEmployees()
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const dropdownRef = useRef(null)

  // Get all employees and filter active ones
  const allEmployees = getAllEmployees()
  const activeEmployees = useMemo(() => {
    return allEmployees
      .filter(emp => (emp.employee_status || 'Active') === 'Active')
      .map(emp => ({
        id: emp.id || emp.employee_id || emp.employeeId,
        name: `${emp.first_name || emp.firstName || ''} ${emp.last_name || emp.lastName || ''}`.trim(),
        designation: emp.designation || emp.title || '',
        department: emp.department || ''
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [allEmployees])

  // Convert selected employee IDs to employee objects
  const selectedEmployees = useMemo(() => {
    return activeEmployees.filter(emp => selectedValues.includes(emp.id))
  }, [activeEmployees, selectedValues])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
        setSearchTerm('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Filter employees based on search term
  const filteredEmployees = useMemo(() => {
    if (!searchTerm.trim()) return activeEmployees
    
    const searchLower = searchTerm.toLowerCase()
    return activeEmployees.filter(emp =>
      emp.name.toLowerCase().includes(searchLower) ||
      emp.designation.toLowerCase().includes(searchLower) ||
      emp.department.toLowerCase().includes(searchLower)
    )
  }, [activeEmployees, searchTerm])

  const handleToggle = (employeeId) => {
    const newSelection = selectedValues.includes(employeeId)
      ? selectedValues.filter(v => v !== employeeId)
      : [...selectedValues, employeeId]
    onSelectionChange(newSelection)
  }

  const handleSelectAll = () => {
    const filteredIds = filteredEmployees.map(emp => emp.id)
    const allFilteredSelected = filteredIds.every(id => selectedValues.includes(id))
    
    if (allFilteredSelected) {
      // Deselect all filtered employees
      onSelectionChange(selectedValues.filter(v => !filteredIds.includes(v)))
    } else {
      // Select all filtered employees
      const newSelection = [...new Set([...selectedValues, ...filteredIds])]
      onSelectionChange(newSelection)
    }
  }

  const allFilteredSelected = filteredEmployees.length > 0 && 
    filteredEmployees.every(emp => selectedValues.includes(emp.id))

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-medium text-slate-700 mb-2">
        {label}{required && <span className="text-red-500"> *</span>}
      </label>

      {/* Selected Employees Grid - Display above dropdown */}
      {selectedEmployees.length > 0 && (
        <div className="mb-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700">
              Selected Employees ({selectedEmployees.length})
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {selectedEmployees.map(emp => (
              <div
                key={emp.id}
                className="flex items-center justify-between p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-semibold text-green-700">
                      {emp.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">
                      {emp.name}
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      {emp.designation} {emp.department ? `• ${emp.department}` : ''}
                    </div>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleToggle(emp.id)
                  }}
                  className="ml-2 text-slate-400 hover:text-red-600 transition-colors flex-shrink-0"
                  title="Remove employee"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dropdown Trigger */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 border border-slate-300 rounded-xl cursor-pointer bg-white flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-green-800 focus:border-transparent transition-all duration-300"
      >
        <span className={selectedEmployees.length > 0 ? 'text-slate-900' : 'text-slate-500'}>
          {selectedEmployees.length > 0 
            ? `${selectedEmployees.length} employee${selectedEmployees.length !== 1 ? 's' : ''} selected`
            : placeholder
          }
        </span>
        <svg className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 24 24">
          <path d="M7 10l5 5 5-5z"/>
        </svg>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-300 rounded-xl shadow-lg max-h-96 overflow-hidden">
          {/* Search Input */}
          <div className="p-3 border-b border-slate-200">
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, designation, or department..."
                className="w-full px-3 py-2 pl-9 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800 text-sm"
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
              <svg className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              {searchTerm && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setSearchTerm('')
                  }}
                  className="absolute right-2 top-2.5 w-4 h-4 text-slate-400 hover:text-slate-600"
                >
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Select All Option */}
          {filteredEmployees.length > 0 && (
            <div className="p-2 border-b border-slate-200 bg-slate-50">
              <label className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-100 rounded cursor-pointer">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={handleSelectAll}
                  className="rounded border-gray-300 text-green-600 focus:ring-green-800"
                />
                <span className="text-sm font-medium text-slate-900">
                  {allFilteredSelected ? 'Deselect All' : 'Select All'} ({filteredEmployees.length})
                </span>
              </label>
            </div>
          )}

          {/* Employees List */}
          <div className="overflow-y-auto max-h-64 scrollbar-thin">
            {loading ? (
              <div className="px-3 py-4 text-center text-slate-500 text-sm">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600 mx-auto mb-2"></div>
                Loading employees...
              </div>
            ) : filteredEmployees.length === 0 ? (
              <div className="px-3 py-4 text-slate-500 text-sm text-center">
                {searchTerm ? 'No employees found matching your search' : 'No active employees available'}
              </div>
            ) : (
              filteredEmployees.map(emp => (
                <label
                  key={emp.id}
                  className={`flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-b-0 ${
                    selectedValues.includes(emp.id) ? 'bg-green-50' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedValues.includes(emp.id)}
                    onChange={() => handleToggle(emp.id)}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-800 flex-shrink-0"
                  />
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-semibold text-green-700">
                      {emp.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-900">
                      {emp.name}
                    </div>
                    <div className="text-xs text-slate-500">
                      {emp.designation} {emp.department ? `• ${emp.department}` : ''}
                    </div>
                  </div>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
