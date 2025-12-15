import React, { useState, useEffect, useRef } from 'react'

const MultiSelect = ({
  label,
  options,
  selectedValues,
  onSelectionChange,
  placeholder = "Select options...",
  searchPlaceholder = "Filter options...",
  getEmployeeCount = null // New prop to get employee count for each option
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const dropdownRef = useRef(null)

  // Close dropdown when clicking outside
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

  // Filter options based on search term
  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Handle option selection
  const handleOptionToggle = (value) => {
    const currentValues = selectedValues || []
    const newSelection = currentValues.includes(value)
      ? currentValues.filter(v => v !== value)
      : [...currentValues, value]
    
    // Ensure no duplicates
    const uniqueSelection = [...new Set(newSelection)]
    onSelectionChange(uniqueSelection)
  }

  // Handle select all
  const handleSelectAll = () => {
    const currentValues = selectedValues || []
    const filteredValues = filteredOptions.map(opt => opt.value)
    const allFilteredSelected = filteredValues.every(value => currentValues.includes(value))
    
    if (allFilteredSelected) {
      // Deselect all filtered options
      onSelectionChange(currentValues.filter(v => !filteredValues.includes(v)))
    } else {
      // Select all filtered options
      const newSelection = [...new Set([...currentValues, ...filteredValues])]
      onSelectionChange(newSelection)
    }
  }

  // Get display text for selected values
  const getDisplayText = () => {
    const currentValues = selectedValues || []
    if (currentValues.length === 0) return placeholder
    if (currentValues.length === 1) {
      const option = options.find(opt => opt.value === currentValues[0])
      if (!option) return placeholder
      
      // If we have employee count function, show count
      if (getEmployeeCount) {
        const count = getEmployeeCount(option.value)
        return `${option.label} (${count})`
      }
      return option.label
    }
    return `${currentValues.length} selected`
  }

  // Check if all filtered options are selected
  const currentValues = selectedValues || []
  const allFilteredSelected = filteredOptions.length > 0 && 
    filteredOptions.every(opt => currentValues.includes(opt.value))

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-left flex items-center justify-between"
      >
        <span className="text-black">
          {getDisplayText()}
        </span>
        <svg 
          className={`w-3 h-3 text-black transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
        </svg>
      </button>

      {/* Selected Tags */}
      {currentValues.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {currentValues.map((value, index) => {
            const option = options.find(opt => opt.value === value)
            if (!option) return null
            
            // Get employee count if function is provided
            const employeeCount = getEmployeeCount ? getEmployeeCount(value) : null
            const displayText = employeeCount !== null ? `${option.label} (${employeeCount})` : option.label
            
            return (
              <span
                key={typeof value === 'object' && value !== null 
                  ? `${option.label}-${index}` 
                  : value}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 text-blue-800 text-xs rounded"
              >
                {displayText}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleOptionToggle(value)
                    }}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
              </span>
            )
          })}
        </div>
      )}

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-300 rounded-md shadow-lg max-h-64 overflow-hidden">
          {/* Search Input */}
          <div className="p-2 border-b border-slate-200">
            <div className="relative">
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-2 py-1.5 pl-6 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                onClick={(e) => e.stopPropagation()}
              />
              <svg className="absolute left-1.5 top-1.5 w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-1.5 top-1.5 w-3 h-3 text-gray-400 hover:text-gray-600"
                >
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Select All Option */}
          {filteredOptions.length > 0 && (
            <div className="p-1 border-b border-slate-200">
              <label className="flex items-center gap-1.5 px-2 py-1 hover:bg-gray-50 rounded cursor-pointer">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={handleSelectAll}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3 h-3"
                />
                <span className="text-sm font-medium text-black">
                  {allFilteredSelected ? 'Deselect All' : 'Select All'}
                </span>
              </label>
            </div>
          )}

          {/* Options List */}
          <div className="max-h-32 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 hover:scrollbar-thumb-gray-400">
            {filteredOptions.length === 0 ? (
              <div className="px-2 py-1 text-sm text-gray-500">No options found</div>
            ) : (
              filteredOptions.map((option, index) => (
                <label
                  key={typeof option.value === 'object' && option.value !== null 
                    ? `${option.label}-${index}` 
                    : option.value}
                  className="flex items-center gap-2 px-3 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={currentValues.includes(option.value)}
                    onChange={() => handleOptionToggle(option.value)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3 h-3"
                  />
                  <span className="text-sm text-black py-1.5">{option.label}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default MultiSelect
