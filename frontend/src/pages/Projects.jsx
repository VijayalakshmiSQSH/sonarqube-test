import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import Header from '../components/Header.jsx'
import ResourceAllocationMatrix from '../components/ResourceAllocationMatrix.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import SavedFiltersManager from '../components/SavedFiltersManager.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { usePermissions } from '../context/PermissionContext.jsx'
import { getCookie } from '../utils/helpers.js'
import { TOKEN, getApiBaseUrl } from '../utils/constants.js'

// Import tab components directly to prevent flickering
import ProjectsTab from './tabs/ProjectsTab.jsx'
import SixWeekForecastTab from './tabs/SixWeekForecastTab.jsx'
import AllocationAnalysisTab from './tabs/AllocationAnalysisTab.jsx'
import OverallUtilizationTab from './tabs/OverallUtilizationTab.jsx'
import CustomerProjectsTab from './tabs/CustomerProjectsTab.jsx'
import AIFilterChatbot from '../components/AIFilterChatbot.jsx'
// import GanttChartTab from './tabs/GanttChartTab.jsx'


const TABLE_VIEW_MAPPING = {
  'customer-projects' : 'customers',
  'projects' : 'projects',
  'utilization' : 'project_allocations'
}

const AI_FILER_ENABLED_VIEW  = Object.keys(TABLE_VIEW_MAPPING); 

const ADDITIONAL_FIELDS_MAPPING = {
  'utilization' : [
        "employee_employee_id",
        "employee_name",
        "project_name"
    ]
}

// CSS for animations
const animationStyles = `
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
  
  .tab-content {
    transition: opacity 0.15s ease-in-out;
  }
  
  .tab-content.loading {
    opacity: 0.7;
  }
  
  .tab-content.loaded {
    opacity: 1;
  }
  
  /* Custom scrollbar styles for MultiSelect dropdowns */
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
  
  .scrollbar-thumb-gray-300::-webkit-scrollbar-thumb {
    background: #d1d5db;
  }
  
  .scrollbar-track-gray-100::-webkit-scrollbar-track {
    background: #f3f4f6;
  }
  
  .hover\\:scrollbar-thumb-gray-400:hover::-webkit-scrollbar-thumb {
    background: #9ca3af;
  }
  
  /* Select dropdown option styling - green theme */
  select option {
    background-color: white;
    color: #1e293b;
  }
  
  select option:checked {
    background-color: #166534 !important; /* green-800 */
    color: white !important;
  }
  
  select option:hover {
    background-color: #dcfce7 !important; /* green-100 */
    color: #166534 !important; /* green-800 */
  }
  
  /* For selected option in dropdown (when dropdown is open) */
  select:focus option:checked {
    background-color: #166534 !important; /* green-800 */
    color: white !important;
  }
`

// Multi-Select Component
const MultiSelect = ({
  label,
  options,
  selectedValues,
  onSelectionChange,
  placeholder = "Select options...",
  searchPlaceholder = "Filter options...",
  getEmployeeCount = null, // Function to get employee count for each option
  getUtilizationCount = null // Function to get utilization count for each option
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
      
      // If we have both employee count and utilization count functions, show both
      if (getEmployeeCount && getUtilizationCount) {
        const empCount = getEmployeeCount(option.value)
        const utilCount = getUtilizationCount(option.value)
        return `${option.label} (emp count: ${empCount}) (utilization: ${utilCount})`
      }
      // If we only have employee count function, show count
      else if (getEmployeeCount) {
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
      <label className="block text-sm font-medium text-slate-700 mb-2">{label}</label>
      
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800 focus:border-green-800 bg-white text-left flex items-center justify-between"
      >
        <span className="text-black">
          {getDisplayText()}
        </span>
        <svg 
          className={`w-4 h-4 text-black transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
        </svg>
      </button>

      {/* Selected Tags */}
      {currentValues.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {currentValues.map((value, index) => {
            const option = options.find(opt => opt.value === value)
            if (!option) return null
            
            // Get employee count and utilization count if functions are provided
            const employeeCount = getEmployeeCount ? getEmployeeCount(value) : null
            const utilizationCount = getUtilizationCount ? getUtilizationCount(value) : null
            
            let displayText = option.label
            if (employeeCount !== null && utilizationCount !== null) {
              displayText = `${option.label} (emp count: ${employeeCount}) (utilization: ${utilizationCount})`
            } else if (employeeCount !== null) {
              displayText = `${option.label} (${employeeCount})`
            }
            
            return (
              <span
                key={typeof value === 'object' && value !== null 
                  ? `${option.label}-${index}` 
                  : value}
                className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-md"
              >
                {displayText}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleOptionToggle(value)
                  }}
                  className="text-green-700 hover:text-green-800"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-66 overflow-hidden">
          {/* Search Input */}
          <div className="p-3 border-b border-slate-200">
            <div className="relative">
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 pl-8 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-800 focus:border-green-800 text-sm"
                onClick={(e) => e.stopPropagation()}
              />
              <svg className="absolute left-2 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-2.5 w-4 h-4 text-gray-400 hover:text-gray-600"
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
            <div className="p-2 border-b border-slate-200">
              <label className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 rounded cursor-pointer">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={handleSelectAll}
                  className="rounded border-gray-300 text-green-700 focus:ring-green-800"
                />
                <span className="text-sm font-medium text-black">
                  {allFilteredSelected ? 'Deselect All' : 'Select All'}
                </span>
              </label>
            </div>
          )}

          {/* Options List */}
          <div className="max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 hover:scrollbar-thumb-gray-400">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">No options found</div>
            ) : (
              filteredOptions.map((option, index) => (
                <label
                  key={typeof option.value === 'object' && option.value !== null 
                    ? `${option.label}-${index}` 
                    : option.value}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={currentValues.includes(option.value)}
                    onChange={() => handleOptionToggle(option.value)}
                    className="rounded border-gray-300 text-green-700 focus:ring-green-800"
                  />
                  <span className="text-sm text-black">
                    {(() => {
                      // Get employee count and utilization count if functions are provided
                      const employeeCount = getEmployeeCount ? getEmployeeCount(option.value) : null
                      const utilizationCount = getUtilizationCount ? getUtilizationCount(option.value) : null
                      
                      if (employeeCount !== null && utilizationCount !== null) {
                        return `${option.label} (emp count: ${employeeCount}) (utilization: ${utilizationCount})`
                      } else if (employeeCount !== null) {
                        return `${option.label} (${employeeCount})`
                      }
                      return option.label
                    })()}
                  </span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Utilization Percentage MultiSelect with Custom Range
const UtilizationPercentageFilter = ({
  selectedRanges,
  customRange,
  onRangesChange,
  onCustomRangeChange
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [tempMinValue, setTempMinValue] = useState(customRange?.min || 0)
  const [tempMaxValue, setTempMaxValue] = useState(customRange?.max || 100)
  const dropdownRef = useRef(null)

  const predefinedRanges = [
    { value: '0-25', label: '0–25%', min: 0, max: 25 },
    { value: '26-50', label: '26–50%', min: 26, max: 50 },
    { value: '51-75', label: '51–75%', min: 51, max: 75 },
    { value: '76-100', label: '76–100%', min: 76, max: 100 },
    { value: '100+', label: '100+%', min: 100, max: Infinity }
  ]

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleRangeToggle = (value) => {
    const newSelection = selectedRanges.includes(value)
      ? selectedRanges.filter(v => v !== value)
      : [...selectedRanges, value]
    onRangesChange([...new Set(newSelection)])
  }

  const handleCustomApply = () => {
    const min = Number(tempMinValue)
    const max = Number(tempMaxValue)
    
    if (min >= 0 && max >= min && max <= 100) {
      onCustomRangeChange({ min, max })
      setShowCustomInput(false)
    }
  }

  const handleCustomClear = () => {
    setTempMinValue(0)
    setTempMaxValue(100)
    onCustomRangeChange(null)
    setShowCustomInput(false)
  }

  const getDisplayText = () => {
    const totalSelected = selectedRanges.length + (customRange ? 1 : 0)
    if (totalSelected === 0) return 'All Ranges'
    if (totalSelected === 1) {
      if (customRange) return `Custom: ${customRange.min}–${customRange.max}%`
      const range = predefinedRanges.find(r => r.value === selectedRanges[0])
      return range ? range.label : 'All Ranges'
    }
    return `${totalSelected} ranges selected`
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-medium text-slate-700 mb-2">Utilization Percentage</label>
      
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800 focus:border-green-800 bg-white text-left flex items-center justify-between"
      >
        <span className="text-black">{getDisplayText()}</span>
        <svg 
          className={`w-4 h-4 text-black transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
        </svg>
      </button>

      {/* Selected Tags */}
      {(selectedRanges.length > 0 || customRange) && (
        <div className="flex flex-wrap gap-1 mt-2">
          {selectedRanges.map(value => {
            const range = predefinedRanges.find(r => r.value === value)
            if (!range) return null
            return (
              <span
                key={value}
                className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium"
              >
                {range.label}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRangeToggle(value)
                  }}
                  className="hover:text-green-900"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </span>
            )
          })}
          {customRange && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
              Custom: {customRange.min}–{customRange.max}%
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleCustomClear()
                }}
                className="hover:text-purple-900"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </span>
          )}
        </div>
      )}

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          <div className="p-2">
            {/* Predefined Ranges */}
            {predefinedRanges.map((range) => (
              <label
                key={range.value}
                className="flex items-center px-3 py-2 hover:bg-slate-50 rounded cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedRanges.includes(range.value)}
                  onChange={() => handleRangeToggle(range.value)}
                  className="w-4 h-4 text-green-700 border-slate-300 rounded focus:ring-green-800"
                />
                <span className="ml-2 text-sm text-slate-700">{range.label}</span>
              </label>
            ))}

            {/* Custom Range Option */}
            <div className="border-t border-slate-200 mt-2 pt-2">
              <button
                onClick={() => setShowCustomInput(!showCustomInput)}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-50 rounded text-left"
              >
                <span className="text-sm font-medium text-green-700">Custom Range</span>
                <svg 
                  className={`w-4 h-4 text-green-700 transition-transform ${showCustomInput ? 'rotate-180' : ''}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
                </svg>
              </button>

              {showCustomInput && (
                <div className="px-3 pb-3 space-y-3">
                  {/* Range Display */}
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-medium text-slate-700">{tempMinValue || 0}%</span>
                    <span className="text-slate-500">to</span>
                    <span className="font-medium text-slate-700">{tempMaxValue || 100}%</span>
                  </div>
                  
                  {/* Dual Range Slider */}
                  <div className="relative h-6 flex items-center">
                    {/* Track */}
                    <div className="absolute w-full h-1.5 bg-slate-200 rounded-full pointer-events-none"></div>
                    
                    {/* Active Track */}
                    <div 
                      className="absolute h-1.5 bg-green-700 rounded-full pointer-events-none" 
                      style={{ 
                        left: `${tempMinValue || 0}%`, 
                        width: `${(tempMaxValue || 100) - (tempMinValue || 0)}%`
                      }}
                    ></div>
                    
                    {/* Min Slider */}
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={tempMinValue || 0}
                      onChange={(e) => {
                        const val = Number(e.target.value)
                        if (val <= (tempMaxValue || 100)) {
                          setTempMinValue(val)
                        }
                      }}
                      className="slider-min absolute w-full h-1.5 appearance-none bg-transparent cursor-pointer pointer-events-none"
                      style={{
                        zIndex: tempMinValue > tempMaxValue - 10 ? 5 : 3
                      }}
                    />
                    
                    {/* Max Slider */}
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={tempMaxValue || 100}
                      onChange={(e) => {
                        const val = Number(e.target.value)
                        if (val >= (tempMinValue || 0)) {
                          setTempMaxValue(val)
                        }
                      }}
                      className="slider-max absolute w-full h-1.5 appearance-none bg-transparent cursor-pointer pointer-events-none"
                      style={{
                        zIndex: tempMinValue > tempMaxValue - 10 ? 3 : 5
                      }}
                    />
                  </div>
                  
                  <style>{`
                    .slider-min::-webkit-slider-thumb,
                    .slider-max::-webkit-slider-thumb {
                      -webkit-appearance: none;
                      appearance: none;
                      width: 16px;
                      height: 16px;
                      border-radius: 50%;
                      background: #2563eb;
                      cursor: pointer;
                      border: 2px solid white;
                      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                      pointer-events: auto;
                    }
                    
                    .slider-min::-moz-range-thumb,
                    .slider-max::-moz-range-thumb {
                      width: 16px;
                      height: 16px;
                      border-radius: 50%;
                      background: #2563eb;
                      cursor: pointer;
                      border: 2px solid white;
                      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                      pointer-events: auto;
                    }
                    
                    .slider-min::-webkit-slider-thumb:hover,
                    .slider-max::-webkit-slider-thumb:hover {
                      background: #1d4ed8;
                    }
                    
                    .slider-min::-moz-range-thumb:hover,
                    .slider-max::-moz-range-thumb:hover {
                      background: #1d4ed8;
                    }
                    
                    .slider-min::-webkit-slider-runnable-track,
                    .slider-max::-webkit-slider-runnable-track {
                      background: transparent;
                    }
                    
                    .slider-min::-moz-range-track,
                    .slider-max::-moz-range-track {
                      background: transparent;
                    }
                  `}</style>
                  
                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={handleCustomApply}
                      className="flex-1 px-3 py-1.5 text-sm bg-green-700 text-white rounded hover:bg-green-800"
                    >
                      Apply
                    </button>
                    <button
                      onClick={() => {
                        setShowCustomInput(false)
                        setTempMinValue(customRange?.min || 0)
                        setTempMaxValue(customRange?.max || 100)
                      }}
                      className="flex-1 px-3 py-1.5 text-sm bg-slate-200 text-slate-700 rounded hover:bg-slate-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Week Filter Component (Multi-Select)
const WeekFilter = ({ selectedWeeks, onWeekChange, currentDate, viewType = 'month' }) => {
  // Generate week options based on view type and current date
  const generateWeekOptions = () => {
    const options = []
    
    const today = new Date(currentDate)
    let month1Start, month1End, month2Start, month2End
    
    if (viewType === 'quarter') {
      // For quarter view, show 3 months
      month1Start = new Date(today.getFullYear(), today.getMonth(), 1)
      month1End = new Date(today.getFullYear(), today.getMonth() + 1, 0)
      month2Start = new Date(today.getFullYear(), today.getMonth() + 1, 1)
      month2End = new Date(today.getFullYear(), today.getMonth() + 3, 0) // Extended to 3 months
    } else {
      // For month view, show 2 months (same as before)
      month1Start = new Date(today.getFullYear(), today.getMonth(), 1)
      month1End = new Date(today.getFullYear(), today.getMonth() + 1, 0)
      month2Start = new Date(today.getFullYear(), today.getMonth() + 1, 1)
      month2End = new Date(today.getFullYear(), today.getMonth() + 2, 0)
    }
    
    // Generate all weeks for the period
    const allWeeks = []
    const firstWeekStart = new Date(month1Start)
    firstWeekStart.setDate(1)
    // Adjust to start of week (Sunday)
    firstWeekStart.setDate(firstWeekStart.getDate() - firstWeekStart.getDay())
    
    let weekStart = new Date(firstWeekStart)
    
    while (weekStart <= month2End) {
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekStart.getDate() + 6)
      
      // Only include weeks that overlap with either month
      if (weekStart <= month2End && weekEnd >= month1Start) {
        const weekNumber = getWeekNumber(weekStart)
        
        allWeeks.push({
          start: new Date(weekStart),
          end: new Date(weekEnd),
          label: `Week ${weekNumber} (${weekStart.getDate()}-${weekEnd.getDate()})`,
          value: { start: new Date(weekStart), end: new Date(weekEnd), label: `Week ${weekNumber}` }
        })
      }
      
      weekStart.setDate(weekStart.getDate() + 7)
    }
    
    // Add week options to the list
    allWeeks.forEach(week => {
      options.push({
        value: week.value,
        label: week.label
      })
    })
    
    return options
  }

  // Helper function to get week number of the year (ISO week calculation)
  const getWeekNumber = (date) => {
    const d = new Date(date)
    const dayOfWeek = d.getDay() || 7
    d.setDate(d.getDate() + 4 - dayOfWeek)
    const yearStart = new Date(d.getFullYear(), 0, 1)
    const weekNumber = Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
    return weekNumber
  }

  const weekOptions = generateWeekOptions()
  
  // Check if any selected weeks are no longer in the current week options
  // If so, remove them automatically
  useEffect(() => {
    if (selectedWeeks && selectedWeeks.length > 0) {
      const validWeeks = selectedWeeks.filter(selectedWeek => {
        return weekOptions.some(option => {
          if (!option.value || !option.value.start || !option.value.end || !selectedWeek.start || !selectedWeek.end) {
            return false
          }
          
          const weekStart = selectedWeek.start instanceof Date ? selectedWeek.start : new Date(selectedWeek.start)
          const weekEnd = selectedWeek.end instanceof Date ? selectedWeek.end : new Date(selectedWeek.end)
          
          // Normalize dates to start of day for comparison
          const optionStart = new Date(option.value.start)
          optionStart.setHours(0, 0, 0, 0)
          const optionEnd = new Date(option.value.end)
          optionEnd.setHours(23, 59, 59, 999)
          
          const weekStartNormalized = new Date(weekStart)
          weekStartNormalized.setHours(0, 0, 0, 0)
          const weekEndNormalized = new Date(weekEnd)
          weekEndNormalized.setHours(23, 59, 59, 999)
          
          return optionStart.getTime() === weekStartNormalized.getTime() && 
                 optionEnd.getTime() === weekEndNormalized.getTime()
        })
      })
      
      if (validWeeks.length !== selectedWeeks.length) {
        // Update to only include valid weeks
        onWeekChange(validWeeks)
      }
    }
  }, [currentDate, viewType]) // Only run when view changes, not when selectedWeeks changes
  
  // Convert selected weeks to values for MultiSelect
  const selectedValues = selectedWeeks ? selectedWeeks.map(week => {
    // Find the matching option value for this week
    const matchingOption = weekOptions.find(option => {
      if (!option.value || !option.value.start || !option.value.end || !week.start || !week.end) {
        return false
      }
      
      const weekStart = week.start instanceof Date ? week.start : new Date(week.start)
      const weekEnd = week.end instanceof Date ? week.end : new Date(week.end)
      
      // Normalize dates to start of day for comparison
      const optionStart = new Date(option.value.start)
      optionStart.setHours(0, 0, 0, 0)
      const optionEnd = new Date(option.value.end)
      optionEnd.setHours(23, 59, 59, 999)
      
      const weekStartNormalized = new Date(weekStart)
      weekStartNormalized.setHours(0, 0, 0, 0)
      const weekEndNormalized = new Date(weekEnd)
      weekEndNormalized.setHours(23, 59, 59, 999)
      
      return optionStart.getTime() === weekStartNormalized.getTime() && 
             optionEnd.getTime() === weekEndNormalized.getTime()
    })
    return matchingOption ? matchingOption.value : week
  }) : []

  // Handle selection change - convert values back to week objects
  const handleWeekSelectionChange = (selectedValues) => {
    const selectedWeeks = selectedValues.map(value => {
      // If value is already a week object, return it
      if (value && value.start && value.end) {
        return value
      }
      // Otherwise, find the matching option and return its value
      const matchingOption = weekOptions.find(option => option.value === value)
      return matchingOption ? matchingOption.value : value
    })
    onWeekChange(selectedWeeks)
  }

  return (
    <MultiSelect
      label="Week Filter"
      options={weekOptions}
      selectedValues={selectedValues}
      onSelectionChange={handleWeekSelectionChange}
      placeholder="All weeks"
      searchPlaceholder="Filter weeks..."
    />
  )
}

const Projects = () => {
  const location = useLocation()
  const { isAuthenticated } = useAuth()
  const { hasPermission, loading: permissionsLoading } = usePermissions()
  const [currentView, setCurrentView] = useState('projects') // 'projects', 'utilization', 'matrix', 'forecast', 'analytics', 'customer-projects'
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [showFilters, setShowFilters] = useState(false)
  const [showAIFilter, setShowAIFilter] = useState(false)
  const [isAIDataFetched, setAIDataFetched] = useState(false);
  const [savedFiltersRefreshTrigger, setSavedFiltersRefreshTrigger] = useState(0)
  
  // State for utilization timeline view
  const [utilizationViewState, setUtilizationViewState] = useState({
    viewType: 'month',
    currentDate: new Date()
  })
  const [filters, setFilters] = useState({
    // Projects filters
    status: '',
    department: '',
    project_manager: '',
    project_type: '',
    priority: '',
    // Forecast filters
    role: '',
    allocation_status: '',
    project: '',
    // Matrix filters
    resource_type: '',
    utilization: '',
    availability: '',
    skill_level: '',
    // Analytics filters
    time_period: '',
    efficiency: '',
    analysis_type: '',
    metric: '',
    // Utilization filters
    utilization_percentage: '', // Keep for backward compatibility
    city: '',
    // Multi-select filters for utilization
    selected_parent_departments: [],
    selected_departments: [],
    selected_projects: [],
    selected_roles: [],
    selected_project_types: [],
    selected_locations: [],
    selected_utilization_ranges: [], // New: array of selected predefined ranges
    custom_utilization_range: null, // New: { min, max } or null
    // Multi-select filters for projects view
    selected_projects_projects: [],
    selected_project_types_projects: [],
    selected_practices_projects: [],
    // Multi-select filters for matrix view
    selected_projects_matrix: [],
    selected_project_types_matrix: [],
    selected_practices_matrix: [],
    // Multi-select filters for forecast view
    selected_parent_departments_forecast: [],
    selected_departments_forecast: [],
    selected_roles_forecast: [],
    selected_projects_forecast: [],
    selected_project_types_forecast: [],
    selected_practices_forecast: [],
    // Multi-select filters for utilization view
    selected_practices_utilization: [],
    // Customer filter for utilization view
    selected_customers: [],
    // Customer projects filters
    account_status: '',
    // Week-based filter for utilization view (multi-select)
    selected_weeks: (() => {
      // Default to current week instead of all weeks
      const today = new Date()
      const currentWeekStart = new Date(today)
      currentWeekStart.setDate(today.getDate() - today.getDay()) // Start of current week (Sunday)
      const currentWeekEnd = new Date(currentWeekStart)
      currentWeekEnd.setDate(currentWeekStart.getDate() + 6)
      
      // Get week number using the same logic as WeekFilter
      const getWeekNumber = (date) => {
        const d = new Date(date)
        const dayOfWeek = d.getDay() || 7
        d.setDate(d.getDate() + 4 - dayOfWeek)
        const yearStart = new Date(d.getFullYear(), 0, 1)
        const weekNumber = Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
        return weekNumber
      }
      
      const weekNumber = getWeekNumber(currentWeekStart)
      
      return [{
        start: new Date(currentWeekStart),
        end: new Date(currentWeekEnd),
        label: `Week ${weekNumber} (${currentWeekStart.getDate()}-${currentWeekEnd.getDate()})`
      }]
    })() // Default to current week, otherwise contains array of { start, end, label }
  })

  // Shared state for all tabs
  const [projects, setProjects] = useState([])
  const [employees, setEmployees] = useState([])
  const [customers, setCustomers] = useState([])
  const [weeklyAllocations, setWeeklyAllocations] = useState([])
  const [aiData, setAiData] = useState([]);

  // Callback function to update allocations optimistically (without refetching)
  const updateAllocations = useCallback((updater) => {
    setWeeklyAllocations(updater)
  }, [])

  // Callback function to update projects optimistically (without refetching)
  const updateProjects = useCallback((updater) => {
    setProjects(updater)
  }, [])

  // Callback function to update customers optimistically (without refetching)
  const updateCustomers = useCallback((updater) => {
    setCustomers(updater)
  }, [])

  // Helper function to check if allocation overlaps with selected weeks
  const isAllocationInSelectedWeeks = (allocation, selectedWeeks) => {
    if (!selectedWeeks || selectedWeeks.length === 0) {
      return true // No weeks selected means "ALL weeks" (fallback case)
    }
    
    if (!allocation.start_date || !allocation.end_date) return false
    
    const allocationStart = new Date(allocation.start_date)
    const allocationEnd = new Date(allocation.end_date)
    
    // Check if allocation overlaps with any of the selected weeks
    return selectedWeeks.some(selectedWeek => {
      if (!selectedWeek.start || !selectedWeek.end) return false
      
      const weekStart = new Date(selectedWeek.start)
      const weekEnd = new Date(selectedWeek.end)
      
      return allocationStart <= weekEnd && allocationEnd >= weekStart
    })
  }

  // Helper function to calculate employee count for each project
  const getProjectEmployeeCount = (projectId) => {
    if (!employees.length || !weeklyAllocations.length) return 0
    
    // Get selected weeks from filters
    const selectedWeeks = filters.selected_weeks || []
    
    // Get unique employee IDs who have allocations for this project and selected weeks
    const employeeIds = new Set()
    weeklyAllocations.forEach(allocation => {
      if (allocation && allocation.project_id === projectId && allocation.employee_id) {
        // Only include allocations that overlap with selected weeks
        if (isAllocationInSelectedWeeks(allocation, selectedWeeks)) {
          employeeIds.add(allocation.employee_id)
        }
      }
    })
    
    return employeeIds.size
  }

  // Helper function to calculate utilization count for each project
  const getProjectUtilizationCount = (projectId) => {
    if (!employees.length || !weeklyAllocations.length) return 0
    
    // Get selected weeks from filters
    const selectedWeeks = filters.selected_weeks || []
    
    // Filter allocations for this project and selected weeks
    const projectAllocations = weeklyAllocations.filter(allocation => {
      if (!allocation || allocation.project_id !== projectId || !allocation.employee_id) {
        return false
      }
      
      // Only include allocations that overlap with selected weeks
      return isAllocationInSelectedWeeks(allocation, selectedWeeks)
    })
    
    if (projectAllocations.length === 0) return 0
    
    // Group allocations by employee to handle multiple weeks
    const employeeAllocations = {}
    projectAllocations.forEach(allocation => {
      const empId = allocation.employee_id
      if (!employeeAllocations[empId]) {
        employeeAllocations[empId] = []
      }
      employeeAllocations[empId].push(allocation.allocation_percentage || 0)
    })
    
    // Calculate average allocation percentage for each employee
    const employeeAvgAllocations = Object.keys(employeeAllocations).map(empId => {
      const percentages = employeeAllocations[empId]
      const average = percentages.reduce((sum, pct) => sum + pct, 0) / percentages.length
      return average
    })
    
    // Sum all average allocations to get total utilization percentage
    const totalUtilizationPercentage = employeeAvgAllocations.reduce((sum, avg) => sum + avg, 0)
    
    // Convert to utilization count (total percentage / 100)
    const utilizationCount = Math.round((totalUtilizationPercentage / 100) * 100) / 100 // Round to 2 decimal places
    
    return utilizationCount
  }

  // Helper function to get projects filtered by selected customers
  const getFilteredProjectsByCustomer = () => {
    // If no customers are selected, show all projects
    if (!filters.selected_customers || filters.selected_customers.length === 0) {
      return projects
    }
    
    // Filter projects to only show those belonging to selected customers
    return projects.filter(project => 
      filters.selected_customers.includes(project.customer_id)
    )
  }
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [forecastLoading, setForecastLoading] = useState(false)
  const [forecastError, setForecastError] = useState(null)
  const [expandedDepartments, setExpandedDepartments] = useState(new Set())
  const [expandedProjects, setExpandedProjects] = useState(new Set())
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingProject, setEditingProject] = useState(null)
  const [selectedProject, setSelectedProject] = useState(null)
  const [editingAllocation, setEditingAllocation] = useState(null)
  const [projectTeamMembers, setProjectTeamMembers] = useState({})
  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    status: 'Planning',
    start_date: '',
    end_date: '',
    progress_percentage: 0,
    budget: '',
    spent_budget: 0,
    project_manager_id: null,
    project_type: '',
    custom_project_type: '',
    customer_id: null,
    practice: '',
    practice_other: '',
    priority: ''
  })

  // Fetch individual API with detailed error handling
  const fetchWithErrorHandling = async (url, dataType, token) => {
    try {
      
      const response = await fetch(url, {
        headers: { 
          'Authorization': `Bearer ${token}`, 
          'Content-Type': 'application/json' 
        }
      })
      
      
      if (!response.ok) {
        // Log detailed error information for debugging
        const errorText = await response.text().catch(() => 'Unable to read error response')
        console.error(`❌ ${dataType} API Error:`, {
          status: response.status,
          statusText: response.statusText,
          url: url,
          errorBody: errorText
        })
        
        throw new Error(`${dataType} API returned ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      return { success: true, data }
      
    } catch (err) {
      console.error(`💥 ${dataType} fetch failed:`, err)
      return { 
        success: false, 
        error: err.message,
        dataType 
      }
    }
  }

  // Fetch all data with graceful error handling - allows partial success
  const fetchAllData = useCallback(async () => {
    if (!isAuthenticated()) {
      setError('Please log in to view projects')
      setLoading(false)
      return
    }

    const token = getCookie(TOKEN)
    if (!token) {
      setError('Authentication token not found')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      setForecastError(null)
      setAiData([]);
      
      const baseUrl = getApiBaseUrl()
      
      // Fetch all APIs independently to allow partial success
      const [projectsResult, employeesResult, customersResult, allocationsResult] = await Promise.all([
        fetchWithErrorHandling(`${baseUrl}/api/projects`, 'Projects', token),
        fetchWithErrorHandling(`${baseUrl}/api/employees`, 'Employees', token),
        fetchWithErrorHandling(`${baseUrl}/api/customers`, 'Customers', token),
        fetchWithErrorHandling(`${baseUrl}/api/allocations`, 'Allocations', token)
      ])
      
      // Track which APIs succeeded/failed
      const errors = []
      const warnings = []
      
      // Handle Projects data
      if (projectsResult.success) {
        setProjects(projectsResult.data.projects || [])
      } else {
        errors.push(`Projects: ${projectsResult.error}`)
        setProjects([]) // Set empty array as fallback
      }
      
      // Handle Employees data
      if (employeesResult.success) {
        setEmployees(employeesResult.data.employees || [])
      } else {
        warnings.push(`Employees: ${employeesResult.error}`)
        setEmployees([]) // Set empty array as fallback
      }
      
      // Handle Customers data
      if (customersResult.success) {
        setCustomers(customersResult.data.customers || [])
      } else {
        warnings.push(`Customers: ${customersResult.error}`)
        setCustomers([]) // Set empty array as fallback
      }
      
      // Handle Allocations data (most likely to fail based on error)
      if (allocationsResult.success) {
        setWeeklyAllocations(allocationsResult.data.allocations || [])
      } else {
        warnings.push(`Allocations: ${allocationsResult.error}`)
        setWeeklyAllocations([]) // Set empty array as fallback
        setForecastError(`Unable to load allocation data: ${allocationsResult.error}`)
      }
      
      // Set appropriate error messages
      if (errors.length > 0) {
        // Critical errors (like projects failing)
        setError(`Critical data loading failed: ${errors.join(', ')}`)
      } else if (warnings.length > 0) {
        // Non-critical warnings (employees/allocations failing)
        // Don't set main error, but log warnings
      }
      
      
    } catch (err) {
      console.error('💥 Unexpected error during data fetching:', err)
      setError(`Unexpected error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  // Fetch projects from API (for retry functionality)
  const fetchProjects = useCallback(async () => {
    if (!isAuthenticated()) {
      setError('Please log in to view projects')
      setLoading(false)
      return
    }

    const token = getCookie(TOKEN)
    if (!token) {
      setError('Authentication token not found')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const response = await fetch(`${getApiBaseUrl()}/api/projects`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch projects')
      }
      
      const data = await response.json()
      setProjects(data.projects || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  // Only fetch data once on mount
  useEffect(() => {
    if (isAuthenticated()) {
      fetchAllData()
    } else {
      setLoading(false)
      setError('Please log in to view projects')
    }
  }, [isAuthenticated, fetchAllData])

  // Set default tab based on location state (from navigation) or permissions
  useEffect(() => {
    // First, check if there's a specific tab requested via location state
    if (location.state && location.state.activeTab) {
      setCurrentView(location.state.activeTab)
      return
    }
    
    // Otherwise, set default tab based on permissions
    if (hasPermission) {
      if (hasPermission('view-account-dashboard')) {
        setCurrentView('customer-projects')
      } else if (hasPermission('view-project-dashboard')) {
        setCurrentView('projects')
      } else if (hasPermission('view-allocations-dashboard')) {
        setCurrentView('utilization')
      } else if (hasPermission('view-this-week-dashboard')) {
        setCurrentView('matrix')
      } else if (hasPermission('view-six-weeks-dashboard')) {
        setCurrentView('forecast')
      } else if (hasPermission('view-allocation-analysis-dashboard')) {
        setCurrentView('analytics')
      }
    }
  }, [hasPermission, location.state])

  // Memoize budget calculations to prevent unnecessary recalculations
  const budgetStats = useMemo(() => {
    const totalBudget = projects.reduce((sum, project) => {
      return sum + (project.budget || 0)
    }, 0)

    const totalSpent = projects.reduce((sum, project) => {
      // Use actual spent_budget from database, default to 0 if not set
      return sum + (project.spent_budget || 0)
    }, 0)

    return { totalBudget, totalSpent }
  }, [projects])

  // Memoize format currency function
  const formatCurrency = useCallback((amount) => {
    if (!amount) return '$0'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }, [])

  // Smooth tab switching function
  const handleTabSwitch = useCallback((newView) => {
    if (newView === currentView) return
    setCurrentView(newView)
    setShowFilters(false)
    setShowAIFilter(false)
    setAIDataFetched(false)
    setAiData([])
  }, [currentView])

  // Handler to refresh saved filters across all instances
  const handleSavedFiltersChanged = useCallback(() => {
    setSavedFiltersRefreshTrigger(prev => prev + 1)
  }, [])

  // Helper function to get default current week
  const getDefaultCurrentWeek = useCallback(() => {
    const today = new Date()
    const currentWeekStart = new Date(today)
    currentWeekStart.setDate(today.getDate() - today.getDay()) // Start of current week (Sunday)
    const currentWeekEnd = new Date(currentWeekStart)
    currentWeekEnd.setDate(currentWeekStart.getDate() + 6)
    
    // Get week number using the same logic as WeekFilter
    const getWeekNumber = (date) => {
      const d = new Date(date)
      const dayOfWeek = d.getDay() || 7
      d.setDate(d.getDate() + 4 - dayOfWeek)
      const yearStart = new Date(d.getFullYear(), 0, 1)
      const weekNumber = Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
      return weekNumber
    }
    
    const weekNumber = getWeekNumber(currentWeekStart)
    
    return [{
      start: new Date(currentWeekStart),
      end: new Date(currentWeekEnd),
      label: `Week ${weekNumber} (${currentWeekStart.getDate()}-${currentWeekEnd.getDate()})`
    }]
  }, [])

    const handleAIFilterApply = async (aiFilters) => {
      console.log('Applying AI filters:', aiFilters)
  
      // If no filters, clear AI filtered results
      if (!aiFilters || aiFilters.length === 0) {
        setAiData([])
        setAIDataFetched(false)
        return
      }
  
      try {
        // Fetch filtered employees from backend
        const token = getCookie(TOKEN)
        if (!token) {
          console.error('No authentication token found')
          setAiFilterLoading(false)
          return
        }
  
        const response = await fetch(`${getApiBaseUrl()}/api/ai/filter-apply`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            filters: aiFilters, 
            tableName: TABLE_VIEW_MAPPING[currentView] ,
            additionalFields: ADDITIONAL_FIELDS_MAPPING[currentView] || []
          })
        })
  
        if (response.ok) {
          const data = await response.json()
          setAiData(data.data)
          console.log('Filtered data received:', data)
        } else {
          console.error('Error applying filters:', response.statusText)
          throw new Error('Failed to apply filters')
        }
      } catch (error) {
        console.error('Error fetching filtered employees:', error)
        throw error // Re-throw to let AIFilterChatbot handle the error message
      } finally {
        setAIDataFetched(true)
      }
    }

  const onChatbotClose = () => {
    setShowAIFilter(false);
    setAIDataFetched(false);
  }

  const showAIData = useMemo(() => {
    return showAIFilter && isAIDataFetched
  }, [isAIDataFetched, showAIFilter])

  // Memoize common props to prevent unnecessary re-renders
  const commonProps = useMemo(() => ({
    // Data (read-only for child components)
    projects : showAIData  ? aiData : projects,
    employees,
    customers: showAIData  ? aiData : customers,
    weeklyAllocations: showAIData ? aiData : weeklyAllocations,
    
    // UI State
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    expandedProjects,
    setExpandedProjects,
    showFilters,
    setShowFilters,
    filters,
    setFilters,
    showCreateModal,
    setShowCreateModal,
    editingProject,
    setEditingProject,
    selectedProject,
    setSelectedProject,
    newProject,
    setNewProject,
    projectTeamMembers,
    setProjectTeamMembers,
    
    // Loading states
    loading,
    error,
    forecastLoading,
    setForecastLoading,
    forecastError,
    setForecastError,
    expandedDepartments,
    setExpandedDepartments,
    editingAllocation,
    setEditingAllocation,
    
    // Functions
    isAuthenticated,
    fetchProjects: fetchAllData, // Use the main data fetcher
    updateAllocations, // Callback to update allocations optimistically
    updateProjects, // Callback to update projects optimistically
    updateCustomers, // Callback to update customers optimistically
  }), [showAIData, aiData, projects, employees, customers, weeklyAllocations, searchTerm, statusFilter, expandedProjects, showFilters, filters, showCreateModal, editingProject, selectedProject, newProject, projectTeamMembers, loading, error, forecastLoading, forecastError, expandedDepartments, editingAllocation, isAuthenticated, fetchAllData, updateAllocations, updateProjects, updateCustomers])


  const filteredEmployees = useMemo(() => {
    if(showAIData) {
      const currentEmployeeIds = aiData.map(allocation => allocation.employee_id);
      return employees.filter(emp => currentEmployeeIds.includes(emp.id));
    }
    return employees;
  }, [employees, showAIData, aiData])


    const filteredProjects = useMemo(() => {
    if(showAIData) {
    const currentProjectIds = aiData.map(allocation => allocation.project_id);
      return projects.filter(project => currentProjectIds.includes(project.id));
    }
    return projects;
  }, [projects, showAIData, aiData])

  // Render all tabs but only show the active one to prevent flickering
  const renderTabContent = () => {
    return (
      <>
        {currentView === 'projects' && hasPermission('view-project-dashboard') && (
          <div>
            <ProjectsTab {...commonProps} />
          </div>
        )}
        {currentView === 'utilization' && hasPermission('view-allocations-dashboard') && (
          <div>
            <OverallUtilizationTab 
              {...commonProps}
              employees={filteredEmployees}
              projects={filteredProjects}
              onViewChange={setUtilizationViewState}
            />
          </div>
        )}
        {currentView === 'matrix' && hasPermission('view-this-week-dashboard') && (
          <div className="p-6">
            <ResourceAllocationMatrix 
              employees={employees}
              projects={projects}
              allocations={weeklyAllocations}
              searchTerm={searchTerm}
              filters={filters}
            />
          </div>
        )}
        {currentView === 'forecast' && hasPermission('view-six-weeks-dashboard') && (
          <div>
            <SixWeekForecastTab {...commonProps} />
          </div>
        )}
        {currentView === 'analytics' && hasPermission('view-allocation-analysis-dashboard') && (
          <div>
            <AllocationAnalysisTab {...commonProps} />
          </div>
        )}
        {currentView === 'customer-projects' && hasPermission('view-account-dashboard') && (
          <div>
            <CustomerProjectsTab {...commonProps} filters={filters} />
          </div>
        )}
        {/* Gantt chart moved to Project Details > Timeline */}
      </>
    )
  }

  // Show loader while permissions are being fetched
  if (permissionsLoading) {
    return (
      <div className="min-h-screen bg-slate-100">
        <Header />
        <div className="w-[97%] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-700 mx-auto mb-4"></div>
              <p className="text-slate-600">Loading Projects...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Check permissions - only after loading is complete
  const hasAnyPermission = hasPermission('view-account-dashboard') || 
                          hasPermission('view-project-dashboard') || 
                          hasPermission('view-allocations-dashboard') || 
                          hasPermission('view-this-week-dashboard') || 
                          hasPermission('view-six-weeks-dashboard') || 
                          hasPermission('view-allocation-analysis-dashboard')

  if (!hasAnyPermission) {
    return (
      <div className="min-h-screen bg-slate-100">
        <Header />
        <div className="w-[97%] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
            <div className="mx-auto w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Access Denied</h2>
            <p className="text-slate-600">You don't have permission to view Projects & Allocations.</p>
            <p className="text-sm text-slate-400 mt-2">Please contact your administrator for access.</p>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100">
        <Header />
        <div className="w-[97%] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingSpinner message="Loading projects..." fullScreen={false} />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-100">
        <Header />
        <div className="w-[97%] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="text-red-800">Error: {error}</div>
            <button 
              onClick={fetchProjects}
              className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Component for showing partial loading warnings
  const PartialLoadingWarning = () => {
    if (!forecastError) return null
    
    return (
      <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800">
              Some features may be limited
            </h3>
            <div className="mt-2 text-sm text-yellow-700">
              <p>{forecastError}</p>
              <p className="mt-1">The Projects tab will work normally, but allocation features may be unavailable.</p>
            </div>
            <div className="mt-3">
              <button
                onClick={() => {
                  setForecastError(null)
                  fetchAllData()
                }}
                className="text-sm bg-yellow-100 text-yellow-800 px-3 py-1 rounded-md hover:bg-yellow-200 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <style>{animationStyles}</style>
      <Header />
      
      <div className="w-[97%] mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Partial Loading Warning */}
        <PartialLoadingWarning />
        {/* Header Section */}
        <div className="mb-4">    
          <h1 className="text-xl font-bold text-slate-900 mb-2">Projects & Allocations</h1>
          <p className="text-slate-600 text-md">Manage and track all company projects with enhanced visibility and control</p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1 mb-2 bg-slate-100 p-1 rounded-lg">
          {/* Customer Projects Tab */}
          {hasPermission('view-account-dashboard') && (
            <button
              onClick={() => handleTabSwitch('customer-projects')}
              className={`flex items-center gap-2 px-4 text-sm font-medium transition-all duration-200 ${
                currentView === 'customer-projects'
                  ? 'border-b-2 border-green-700 text-green-700'
                  : 'text-slate-600 hover:text-slate-900 hover:border-b-2 hover:border-slate-300'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
              </svg>
              Accounts
            </button>
          )}
          {/* Projects Tab */}
          {hasPermission('view-project-dashboard') && (
            <button
              onClick={() => handleTabSwitch('projects')}
              className={`flex items-center gap-2 px-4 text-sm font-medium transition-all duration-200 ${
                currentView === 'projects'
                  ? 'border-b-2 border-green-700 text-green-700'
                  : 'text-slate-600 hover:text-slate-900 hover:border-b-2 hover:border-slate-300'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
              </svg>
              Projects
            </button>
          )}

          {/* Utilization Forecast Tab */}
          {hasPermission('view-allocations-dashboard') && (
            <button
              onClick={() => handleTabSwitch('utilization')}
              className={`flex items-center gap-2 px-4 text-sm font-medium transition-all duration-200 ${
                currentView === 'utilization'
                  ? 'border-b-2 border-green-700 text-green-700'
                  : 'text-slate-600 hover:text-slate-900 hover:border-b-2 hover:border-slate-300'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
              </svg>
              Allocations
            </button>
          )}

          {/* Current Allocations Tab */}
          {hasPermission('view-this-week-dashboard') && (
            <button
              onClick={() => handleTabSwitch('matrix')}
              className={`flex items-center gap-2 px-4 text-sm font-medium transition-all duration-200 ${
                currentView === 'matrix'
                  ? 'border-b-2 border-green-700 text-green-700'
                  : 'text-slate-600 hover:text-slate-900 hover:border-b-2 hover:border-slate-300'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/>
              </svg>
              This Week
            </button>
          )}

          {/* 6-week View Tab */}
          {hasPermission('view-six-weeks-dashboard') && (
            <button
              onClick={() => handleTabSwitch('forecast')}
              className={`flex items-center gap-2 px-4 text-sm font-medium transition-all duration-200 ${
                currentView === 'forecast'
                  ? 'border-b-2 border-green-700 text-green-700'
                  : 'text-slate-600 hover:text-slate-900 hover:border-b-2 hover:border-slate-300'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
              6-weeks
            </button>
          )}

          {/* Allocation Analysis(TBD) Tab */}
          {hasPermission('view-allocation-analysis-dashboard') && (
            <button
              onClick={() => handleTabSwitch('analytics')}
              className={`flex items-center gap-2 px-4 text-sm font-medium transition-all duration-200 ${
                currentView === 'analytics'
                  ? 'border-b-2 border-green-700 text-green-700'
                  : 'text-slate-600 hover:text-slate-900 hover:border-b-2 hover:border-slate-300'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
              Allocation Analysis(TBD)
            </button>
          )}
        </div>


        {/* Dynamic Content Section */}
        {hasPermission('view-filter-container') && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Dynamic Header Panel */}
          <div className="px-6 py-4 border-b border-slate-200">
            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
              {/* Search Bar and Filter - Flex Start */}
              <div className="flex items-center gap-3">
                <div className="relative flex items-center bg-white border border-slate-300 rounded-lg px-3 py-2 min-w-[300px]">
                  <svg className="w-4 h-4 text-slate-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                  </svg>
                  <input
                    type="text"
                    placeholder={
                      currentView === 'projects' ? "Search projects..." :
                      currentView === 'forecast' ? "Search employees..." :
                      currentView === 'matrix' ? "Search resources..." :
                      currentView === 'utilization' ? "Search employees..." :
                      currentView === 'customer-projects' ? "Search customers..." :
                      "Search allocations..."
                    }
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1 outline-none text-sm pr-6"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2 text-slate-400 hover:text-slate-600 transition-colors"
                      title="Clear search"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                      </svg>
                    </button>
                  )}
                </div>
                                  {
                  (AI_FILER_ENABLED_VIEW.includes(currentView) && !showFilters) ? <button
                      onClick={() => {
                        setShowAIFilter(!showAIFilter)
                        if (showAIFilter) {
                          setShowFilters(false) // Hide regular filters when AI filter is shown
                        }
                      }}
                      className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 border ${showAIFilter
                        ? 'bg-green-700 text-white border-green-700'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                        }`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      AI Filter
                    </button> : null
                  }
                
                {/* Filter Button */}
                {
                  !showAIFilter &&
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 border ${
                      showFilters || Object.values(filters).some(filter => 
                        Array.isArray(filter) ? filter.length > 0 : filter !== ''
                      )
                            ? 'bg-green-700 text-white border-green-700'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/>
                    </svg>
                    Filters
                    {/* {Object.values(filters).filter(filter => 
                      Array.isArray(filter) ? filter.length > 0 : filter !== ''
                    ).length > 0 && (
                      <span className="bg-white text-green-700 px-2 py-0.5 rounded-full text-xs font-bold">
                        {Object.values(filters).filter(filter => 
                          Array.isArray(filter) ? filter.length > 0 : filter !== ''
                        ).length}
                      </span>
                    )} */}
                    <svg className={`w-4 h-4 transition-transform duration-200 ${showFilters ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
                    </svg>
                  </button>
                }

                {/* Custom Filters Pills - Only show for utilization view */}
                {currentView === 'utilization' && (
                  <SavedFiltersManager
                    currentFilters={{
                      selected_parent_departments: filters.selected_parent_departments,
                      selected_departments: filters.selected_departments,
                      selected_roles: filters.selected_roles,
                      allocation_status: filters.allocation_status,
                      selected_projects: filters.selected_projects,
                      utilization_percentage: filters.utilization_percentage,
                      selected_utilization_ranges: filters.selected_utilization_ranges,
                      custom_utilization_range: filters.custom_utilization_range,
                      selected_project_types: filters.selected_project_types,
                      selected_practices_utilization: filters.selected_practices_utilization,
                      selected_locations: filters.selected_locations,
                      selected_weeks: filters.selected_weeks
                    }}
                    onApplyFilter={(savedFilters) => {
                      // Create a new filters object that replaces the saved filter keys
                      const newFilters = { ...filters }
                      
                      // Apply each saved filter key-value pair
                      Object.keys(savedFilters).forEach(key => {
                        newFilters[key] = savedFilters[key]
                      })
                      
                      setFilters(newFilters)
                    }}
                    pageContext="overall_utilization"
                    mode="apply"
                    onFiltersChanged={handleSavedFiltersChanged}
                    refreshTrigger={savedFiltersRefreshTrigger}
                  />
                )}
              </div>
              
              {/* Section Summary Cards - Flex End */}
              <div className="flex gap-4">
                {currentView === 'projects' && (
                  <>
                    <div className="bg-green-50 rounded-lg px-4 py-2 border border-green-200">
                      <div className="text-sm font-medium text-green-700">Total Budget</div>
                      <div className="text-lg font-bold text-green-900">{formatCurrency(budgetStats.totalBudget)}</div>
                    </div>
                    <div className="bg-green-50 rounded-lg px-4 py-2 border border-green-200">
                      <div className="text-sm font-medium text-green-600">Total Spent</div>
                      <div className="text-lg font-bold text-green-900">{formatCurrency(budgetStats.totalSpent)}</div>
                    </div>
                  </>
                )}
                {currentView === 'forecast' && (
                  <>
                    <div className="bg-green-50 rounded-lg px-4 py-2 border border-green-200">
                      <div className="text-sm font-medium text-green-600">Total Employees</div>
                      <div className="text-lg font-bold text-green-900">{employees.length}</div>
                    </div>
                    <div className="bg-green-50 rounded-lg px-4 py-2 border border-green-200">
                      <div className="text-sm font-medium text-green-700">Active Allocations</div>
                      <div className="text-lg font-bold text-green-900">
                        {(() => {
                          // Count employees with at least one active allocation
                          const employeesWithAllocations = new Set()
                          weeklyAllocations.forEach(allocation => {
                            if (allocation.status === 'Active') {
                              employeesWithAllocations.add(allocation.employee_id)
                            }
                          })
                          return employeesWithAllocations.size
                        })()}
                      </div>
                    </div>
                  </>
                )}
                {currentView === 'matrix' && (
                  <>
                    <div className="bg-red-50 rounded-lg px-4 py-2 border border-red-200">
                      <div className="text-sm font-medium text-red-600">Over Allocated Count</div>
                      <div className="text-lg font-bold text-red-900">
                        {(() => {
                          // Use ResourceAllocationMatrix current week filtering logic for consistency
                          const getCurrentWeekRange = () => {
                            const today = new Date()
                            const currentWeekStart = new Date(today)
                            currentWeekStart.setDate(today.getDate() - today.getDay()) // Start of current week (Sunday)
                            const currentWeekEnd = new Date(currentWeekStart)
                            currentWeekEnd.setDate(currentWeekStart.getDate() + 6)
                            
                            return {
                              start: currentWeekStart,
                              end: currentWeekEnd
                            }
                          }

                          const isAllocationInCurrentWeek = (allocation) => {
                            if (!allocation.start_date || !allocation.end_date) return false
                            
                            const weekRange = getCurrentWeekRange()
                            const allocationStart = new Date(allocation.start_date)
                            const allocationEnd = new Date(allocation.end_date)
                            
                            return allocationStart <= weekRange.end && allocationEnd >= weekRange.start
                          }

                          // Filter to current week allocations only (matching ResourceAllocationMatrix)
                          const currentWeekAllocations = weeklyAllocations.filter(allocation => 
                            allocation.status === 'Active' && isAllocationInCurrentWeek(allocation)
                          )

                          // Group allocations by employee
                          const employeeAllocations = {}
                          currentWeekAllocations.forEach(allocation => {
                            if (!employeeAllocations[allocation.employee_id]) {
                              employeeAllocations[allocation.employee_id] = []
                            }
                            employeeAllocations[allocation.employee_id].push(allocation)
                          })

                          let overAllocatedCount = 0
                          employees.forEach(employee => {
                            const allocations = employeeAllocations[employee.id] || []
                            
                            if (allocations.length > 0) {
                              // Consolidate allocations by project - keep only the latest one for each project
                              const consolidatedAllocations = allocations.reduce((acc, allocation) => {
                                const existingAllocation = acc.find(accAlloc => accAlloc.project_id === allocation.project_id)
                                
                                if (!existingAllocation) {
                                  // First allocation for this project
                                  acc.push(allocation)
                                } else {
                                  // Compare start dates to keep the latest allocation
                                  const existingDate = new Date(existingAllocation.start_date)
                                  const currentDate = new Date(allocation.start_date)
                                  
                                  if (currentDate > existingDate) {
                                    // Replace with newer allocation
                                    const index = acc.findIndex(accAlloc => accAlloc.project_id === allocation.project_id)
                                    acc[index] = allocation
                                  }
                                }
                                
                                return acc
                              }, [])
                              
                              // Calculate total allocation for this employee using consolidated allocations
                              const totalAllocation = consolidatedAllocations.reduce((sum, alloc) => {
                                return sum + (alloc.allocation_percentage || 0)
                              }, 0)

                              // Check for over-allocation
                              if (totalAllocation > 100) {
                                overAllocatedCount++
                              }
                            }
                          })
                          
                          return overAllocatedCount
                        })()}
                      </div>
                    </div>
                  </>
                )}
                {currentView === 'analytics' && (
                  <>
                    <div className="bg-green-50 rounded-lg px-4 py-2 border border-green-200">
                      <div className="text-sm font-medium text-purple-600">Allocation Efficiency</div>
                      <div className="text-lg font-bold text-purple-900">92%</div>
                    </div>
                    <div className="bg-green-50 rounded-lg px-4 py-2 border border-green-200">
                      <div className="text-sm font-medium text-indigo-600">Over-allocated</div>
                      <div className="text-lg font-bold text-indigo-900">3</div>
                    </div>
                  </>
                )}
                {currentView === 'customer-projects' && (
                  <>
                    <div className="bg-green-50 rounded-lg px-4 py-2 border border-green-200">
                      <div className="text-sm font-medium text-green-700">Total Customers</div>
                      <div className="text-lg font-bold text-green-900">{customers.length}</div>
                    </div>
                    <div className="bg-green-50 rounded-lg px-4 py-2 border border-green-200">
                      <div className="text-sm font-medium text-green-600">Total Projects</div>
                      <div className="text-lg font-bold text-green-900">
                        {(() => {
                          return customers.reduce((sum, customer) => {
                            return sum + (customer.project_count || 0)
                          }, 0)
                        })()}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Expandable Filters Panel */}
          {showFilters && hasPermission('view-filter-container') && (
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-900">Filter Options</h3>
                <button
                  onClick={() => setShowFilters(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Dynamic Filters Based on Current View */}
                {currentView === 'projects' && (
                  <>
                    {/* Status Filter */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
                      <select 
                        value={filters.status}
                        onChange={(e) => setFilters({...filters, status: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800 focus:border-green-800"
                      >
                        <option value="">All Status</option>
                        <option value="Planning">Planning</option>
                        <option value="Active">Active</option>
                        <option value="Completed">Completed</option>
                        <option value="On Hold">On Hold</option>
                      </select>
                    </div>


                    {/* Project Manager Filter */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Project Manager</label>
                      <select 
                        value={filters.project_manager}
                        onChange={(e) => setFilters({...filters, project_manager: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800 focus:border-green-800"
                      >
                        <option value="">All Managers</option>
                        {employees
                          .filter(emp => projects.some(project => project.project_manager_id === emp.id))
                          .map(employee => (
                            <option key={employee.id} value={employee.id}>
                              {employee.first_name} {employee.last_name}
                            </option>
                          ))}
                      </select>
                    </div>

                    {/* Project Multi-Select Filter */}
                    <MultiSelect
                      label="Project"
                      options={projects.map(project => ({ value: project.id, label: project.name }))}
                      selectedValues={filters.selected_projects_projects || []}
                      onSelectionChange={(values) => setFilters({...filters, selected_projects_projects: values})}
                      placeholder="All Projects"
                      searchPlaceholder="Filter projects..."
                    />

                    {/* Project Type Multi-Select Filter */}
                    <MultiSelect
                      label="Project Type"
                      options={Array.from(new Set(projects.map(project => project.project_type).filter(Boolean)))
                        .sort()
                        .map(type => ({ value: type, label: type }))}
                      selectedValues={filters.selected_project_types_projects}
                      onSelectionChange={(values) => setFilters({...filters, selected_project_types_projects: values})}
                      placeholder="All Types"
                      searchPlaceholder="Filter project types..."
                    />

                    {/* Practice Multi-Select Filter */}
                    <MultiSelect
                      label="Practice"
                      options={Array.from(new Set(projects.map(project => project.practice).filter(Boolean)))
                        .sort()
                        .map(practice => ({ value: practice, label: practice }))}
                      selectedValues={filters.selected_practices_projects}
                      onSelectionChange={(values) => setFilters({...filters, selected_practices_projects: values})}
                      placeholder="All Practices"
                      searchPlaceholder="Filter practices..."
                    />

                    {/* Priority Filter */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Priority</label>
                      <select 
                        value={filters.priority}
                        onChange={(e) => setFilters({...filters, priority: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800 focus:border-green-800"
                      >
                        <option value="">All Priorities</option>
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                        <option value="Urgent">Urgent</option>
                      </select>
                    </div>
                  </>
                )}

                {currentView === 'forecast' && (
                  <>
                    {/* Parent Department Multi-Select Filter */}
                    <MultiSelect
                      label="Parent Department"
                      options={Array.from(new Set(employees.map(emp => emp.parent_department).filter(Boolean)))
                        .sort()
                        .map(dept => ({ value: dept, label: dept }))}
                      selectedValues={filters.selected_parent_departments_forecast}
                      onSelectionChange={(values) => {
                        // When parent department changes, filter departments and clear invalid selections
                        const newFilters = { ...filters, selected_parent_departments_forecast: values }
                        
                        // If parent department is cleared, keep all departments but remove invalid selections
                        if (values.length === 0) {
                          // No parent department selected, allow all departments
                          setFilters(newFilters)
                        } else {
                          // Parent department selected, filter departments
                          // Remove department selections that don't belong to selected parent departments
                          const validDepartments = filters.selected_departments_forecast.filter(dept => {
                            return employees.some(emp => 
                              emp.department === dept &&
                              emp.parent_department &&
                              values.includes(emp.parent_department)
                            )
                          })
                          newFilters.selected_departments_forecast = validDepartments
                          
                          // Also update role filter based on new department filter
                          if (validDepartments.length > 0) {
                            const validRoles = filters.selected_roles_forecast.filter(role => {
                              return employees.some(emp => 
                                emp.designation === role &&
                                validDepartments.includes(emp.department)
                              )
                            })
                            newFilters.selected_roles_forecast = validRoles
                          } else {
                            newFilters.selected_roles_forecast = []
                          }
                        }
                        setFilters(newFilters)
                      }}
                      placeholder="All Parent Departments"
                      searchPlaceholder="Filter parent departments..."
                    />

                    {/* Department Multi-Select Filter */}
                    <MultiSelect
                      label="Department"
                      options={Array.from(new Set(employees
                        .filter(emp => {
                          // If parent departments are selected, only include departments from those parent departments
                          if (filters.selected_parent_departments_forecast && filters.selected_parent_departments_forecast.length > 0) {
                            return emp.parent_department && 
                                   filters.selected_parent_departments_forecast.includes(emp.parent_department)
                          }
                          return true
                        })
                        .map(emp => emp.department)
                        .filter(Boolean)))
                        .sort()
                        .map(dept => ({ value: dept, label: dept }))}
                      selectedValues={filters.selected_departments_forecast}
                      onSelectionChange={(values) => {
                        // When department changes, clear role filter if selected roles are no longer valid
                        const newFilters = { ...filters, selected_departments_forecast: values }
                        if (values.length === 0 || 
                            filters.selected_roles_forecast.length === 0 || 
                            filters.selected_roles_forecast.some(role => {
                              // Check if this role still exists in the new department filter
                              const roleExists = employees.some(emp => 
                                emp.designation === role &&
                                (values.length === 0 || values.includes(emp.department))
                              )
                              return !roleExists
                            })) {
                          // Keep valid roles, remove invalid ones
                          if (values.length > 0) {
                            const validRoles = filters.selected_roles_forecast.filter(role => {
                              return employees.some(emp => 
                                emp.designation === role &&
                                values.includes(emp.department)
                              )
                            })
                            newFilters.selected_roles_forecast = validRoles
                          } else {
                            // If no departments selected, keep all roles
                          }
                        }
                        setFilters(newFilters)
                      }}
                      placeholder={filters.selected_parent_departments_forecast.length > 0 ? "All Departments" : "All Departments"}
                      searchPlaceholder="Filter departments..."
                    />

                    {/* Role Multi-Select Filter */}
                    <MultiSelect
                      label="Role"
                      options={Array.from(new Set(employees
                        .filter(emp => {
                          // Only active employees
                          const isActive = (emp.employee_status || 'Active') === 'Active'
                          // If departments are selected, only include employees from those departments
                          const matchesDepartment = !filters.selected_departments_forecast || 
                            filters.selected_departments_forecast.length === 0 || 
                            filters.selected_departments_forecast.includes(emp.department)
                          return isActive && matchesDepartment
                        })
                        .map(emp => emp.designation)
                        .filter(Boolean)))
                        .sort()
                        .map(role => ({ value: role, label: role }))}
                      selectedValues={filters.selected_roles_forecast}
                      onSelectionChange={(values) => setFilters({...filters, selected_roles_forecast: values})}
                      placeholder={filters.selected_departments_forecast.length > 0 ? "All Roles" : "All Roles"}
                      searchPlaceholder="Filter roles..."
                    />

                    {/* Allocation Status Filter */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Allocation Status</label>
                      <select 
                        value={filters.allocation_status}
                        onChange={(e) => setFilters({...filters, allocation_status: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800 focus:border-green-800"
                      >
                        <option value="">All Status</option>
                        <option value="Available">Available</option>
                        <option value="Allocated">Allocated</option>
                      </select>
                    </div>

                    {/* Project Type Multi-Select Filter */}
                    <MultiSelect
                      label="Project Type"
                      options={Array.from(new Set(projects.map(project => project.project_type).filter(Boolean)))
                        .sort()
                        .map(type => ({ value: type, label: type }))}
                      selectedValues={filters.selected_project_types_forecast}
                      onSelectionChange={(values) => setFilters({...filters, selected_project_types_forecast: values})}
                      placeholder="All Types"
                      searchPlaceholder="Filter project types..."
                    />

                    {/* Practice Multi-Select Filter */}
                    <MultiSelect
                      label="Practice"
                      options={Array.from(new Set(projects.map(project => project.practice).filter(Boolean)))
                        .sort()
                        .map(practice => ({ value: practice, label: practice }))}
                      selectedValues={filters.selected_practices_forecast}
                      onSelectionChange={(values) => setFilters({...filters, selected_practices_forecast: values})}
                      placeholder="All Practices"
                      searchPlaceholder="Filter practices..."
                    />
                  </>
                )}

                {currentView === 'matrix' && (
                  <>
                    {/* Utilization Filter */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Utilization</label>
                      <select 
                        value={filters.utilization}
                        onChange={(e) => setFilters({...filters, utilization: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800 focus:border-green-800"
                      >
                        <option value="">All Levels</option>
                        <option value="available">Available (0%)</option>
                        <option value="low">Low (1-50%)</option>
                        <option value="medium">Medium (51-100%)</option>
                        <option value="high">High (100%+)</option>
                      </select>
                    </div>
                    
                    {/* Allocation Status Filter */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Allocation Status</label>
                      <select 
                        value={filters.allocation_status}
                        onChange={(e) => setFilters({...filters, allocation_status: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800 focus:border-green-800"
                      >
                        <option value="">All Status</option>
                        <option value="available">Available</option>
                        <option value="allocated">Allocated</option>
                      </select>
                    </div>

                    {/* Project Multi-Select Filter */}
                    <MultiSelect
                      label="Project"
                      options={projects.map(project => ({ value: project.id, label: project.name }))}
                      selectedValues={filters.selected_projects_matrix}
                      onSelectionChange={(values) => setFilters({...filters, selected_projects_matrix: values})}
                      placeholder="All Projects"
                      searchPlaceholder="Filter projects..."
                    />

                    {/* Project Type Multi-Select Filter */}
                    <MultiSelect
                      label="Project Type"
                      options={Array.from(new Set(projects.map(project => project.project_type).filter(Boolean)))
                        .sort()
                        .map(type => ({ value: type, label: type }))}
                      selectedValues={filters.selected_project_types_matrix}
                      onSelectionChange={(values) => setFilters({...filters, selected_project_types_matrix: values})}
                      placeholder="All Types"
                      searchPlaceholder="Filter project types..."
                    />

                    {/* Practice Multi-Select Filter */}
                    <MultiSelect
                      label="Practice"
                      options={Array.from(new Set(projects.map(project => project.practice).filter(Boolean)))
                        .sort()
                        .map(practice => ({ value: practice, label: practice }))}
                      selectedValues={filters.selected_practices_matrix}
                      onSelectionChange={(values) => setFilters({...filters, selected_practices_matrix: values})}
                      placeholder="All Practices"
                      searchPlaceholder="Filter practices..."
                    />
                  </>
                )}

                {currentView === 'utilization' && (
                  <>
                    {/* Week Filter */}
                    <WeekFilter
                      selectedWeeks={filters.selected_weeks}
                      onWeekChange={(weeks) => setFilters({...filters, selected_weeks: weeks})}
                      currentDate={utilizationViewState.currentDate}
                      viewType={utilizationViewState.viewType}
                    />

                    {/* Parent Department Multi-Select Filter */}
                    <MultiSelect
                      label="Parent Department"
                      options={Array.from(new Set(employees.map(emp => emp.parent_department).filter(Boolean)))
                        .sort()
                        .map(dept => ({ value: dept, label: dept }))}
                      selectedValues={filters.selected_parent_departments}
                      onSelectionChange={(values) => {
                        // When parent department changes, filter departments and clear invalid selections
                        const newFilters = { ...filters, selected_parent_departments: values }
                        
                        // If parent department is cleared, keep all departments but remove invalid selections
                        if (values.length === 0) {
                          // No parent department selected, allow all departments
                          setFilters(newFilters)
                        } else {
                          // Parent department selected, filter departments
                          // Remove department selections that don't belong to selected parent departments
                          const validDepartments = filters.selected_departments.filter(dept => {
                            return employees.some(emp => 
                              emp.department === dept &&
                              emp.parent_department &&
                              values.includes(emp.parent_department)
                            )
                          })
                          newFilters.selected_departments = validDepartments
                          
                          // Also update role filter based on new department filter
                          if (validDepartments.length > 0) {
                            const validRoles = filters.selected_roles.filter(role => {
                              return employees.some(emp => 
                                emp.designation === role &&
                                validDepartments.includes(emp.department)
                              )
                            })
                            newFilters.selected_roles = validRoles
                          } else {
                            newFilters.selected_roles = []
                          }
                        }
                        setFilters(newFilters)
                      }}
                      placeholder="All Parent Departments"
                      searchPlaceholder="Filter parent departments..."
                    />

                    {/* Department Multi-Select Filter */}
                    <MultiSelect
                      label="Department"
                      options={Array.from(new Set(employees
                        .filter(emp => {
                          // If parent departments are selected, only include departments from those parent departments
                          if (filters.selected_parent_departments && filters.selected_parent_departments.length > 0) {
                            return emp.parent_department && 
                                   filters.selected_parent_departments.includes(emp.parent_department)
                          }
                          return true
                        })
                        .map(emp => emp.department)
                        .filter(Boolean)))
                        .sort()
                        .map(dept => ({ value: dept, label: dept }))}
                      selectedValues={filters.selected_departments}
                      onSelectionChange={(values) => {
                        // When department changes, clear role filter if selected roles are no longer valid
                        const newFilters = { ...filters, selected_departments: values }
                        if (values.length === 0 || 
                            filters.selected_roles.length === 0 || 
                            filters.selected_roles.some(role => {
                              // Check if this role still exists in the new department filter
                              const roleExists = employees.some(emp => 
                                emp.designation === role &&
                                (values.length === 0 || values.includes(emp.department))
                              )
                              return !roleExists
                            })) {
                          // Keep valid roles, remove invalid ones
                          if (values.length > 0) {
                            const validRoles = filters.selected_roles.filter(role => {
                              return employees.some(emp => 
                                emp.designation === role &&
                                values.includes(emp.department)
                              )
                            })
                            newFilters.selected_roles = validRoles
                          } else {
                            // If no departments selected, keep all roles
                          }
                        }
                        setFilters(newFilters)
                      }}
                      placeholder={filters.selected_parent_departments.length > 0 ? "All Departments" : "All Departments"}
                      searchPlaceholder="Filter departments..."
                    />

                    {/* Role Multi-Select Filter */}
                    <MultiSelect
                      label="Role"
                      options={Array.from(new Set(employees
                        .filter(emp => {
                          // Only active employees
                          const isActive = (emp.employee_status || 'Active') === 'Active'
                          // If departments are selected, only include employees from those departments
                          const matchesDepartment = !filters.selected_departments || 
                            filters.selected_departments.length === 0 || 
                            filters.selected_departments.includes(emp.department)
                          return isActive && matchesDepartment
                        })
                        .map(emp => emp.designation)
                        .filter(Boolean)))
                        .sort()
                        .map(role => ({ value: role, label: role }))}
                      selectedValues={filters.selected_roles}
                      onSelectionChange={(values) => setFilters({...filters, selected_roles: values})}
                      placeholder={filters.selected_departments.length > 0 ? "All Roles" : "All Roles"}
                      searchPlaceholder="Filter roles..."
                    />

                    {/* Allocation Status Filter */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Allocation Status</label>
                      <select 
                        value={filters.allocation_status}
                        onChange={(e) => setFilters({...filters, allocation_status: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800 focus:border-green-800"
                      >
                        <option value="">All Status</option>
                        <option value="Available">Available</option>
                        <option value="Allocated">Allocated</option>
                      </select>
                    </div>


                    {/* Utilization Percentage Filter - Multi-select with Custom Range */}
                    <UtilizationPercentageFilter
                      selectedRanges={filters.selected_utilization_ranges}
                      customRange={filters.custom_utilization_range}
                      onRangesChange={(ranges) => setFilters({...filters, selected_utilization_ranges: ranges})}
                      onCustomRangeChange={(customRange) => setFilters({...filters, custom_utilization_range: customRange})}
                    />

                    {/* Project Type Multi-Select Filter */}
                    <MultiSelect
                      label="Project Type"
                      options={Array.from(new Set(projects.map(project => project.project_type).filter(Boolean)))
                        .sort()
                        .map(type => ({ value: type, label: type }))}
                      selectedValues={filters.selected_project_types}
                      onSelectionChange={(values) => setFilters({...filters, selected_project_types: values})}
                      placeholder="All Types"
                      searchPlaceholder="Filter project types..."
                    />

                    {/* Practice Multi-Select Filter */}
                    <MultiSelect
                      label="Practice"
                      options={Array.from(new Set(projects.map(project => project.practice).filter(Boolean)))
                        .sort()
                        .map(practice => ({ value: practice, label: practice }))}
                      selectedValues={filters.selected_practices_utilization}
                      onSelectionChange={(values) => setFilters({...filters, selected_practices_utilization: values})}
                      placeholder="All Practices"
                      searchPlaceholder="Filter practices..."
                    />

                    {/* Location Multi-Select Filter */}
                    <MultiSelect
                      label="Location"
                      options={Array.from(new Set(employees.map(emp => emp.city || emp.work_location_state).filter(Boolean)))
                        .sort()
                        .map(location => ({ value: location, label: location }))}
                      selectedValues={filters.selected_locations}
                      onSelectionChange={(values) => setFilters({...filters, selected_locations: values})}
                      placeholder="All Locations"
                      searchPlaceholder="Filter locations..."
                    />

                    {/* Customer Multi-Select Filter */}
                    <MultiSelect
                      label="Customer"
                      options={customers.map(customer => ({ value: customer.id, label: customer.name }))}
                      selectedValues={filters.selected_customers}
                      onSelectionChange={(values) => {
                        // Clear project selections when customer selection changes
                        setFilters({
                          ...filters, 
                          selected_customers: values,
                          selected_projects: [] // Clear project selections
                        })
                      }}
                      placeholder="All Customers"
                      searchPlaceholder="Filter customers..."
                    />
                    {/* Project Multi-Select Filter */}
                    <MultiSelect
                        label="Project"
                        options={getFilteredProjectsByCustomer().map(project => ({ value: project.id, label: project.name }))}
                        selectedValues={filters.selected_projects}
                        onSelectionChange={(values) => setFilters({...filters, selected_projects: values})}
                        placeholder="All Projects"
                        searchPlaceholder="Filter projects..."
                        getEmployeeCount={getProjectEmployeeCount}
                        getUtilizationCount={getProjectUtilizationCount}
                      />
                  </>
                )}

                {/* Analytics and forecast filters still go here... */}

                {currentView === 'analytics' && (
                  <>
                    {/* Time Period Filter */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Time Period</label>
                      <select 
                        value={filters.time_period}
                        onChange={(e) => setFilters({...filters, time_period: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800 focus:border-green-800"
                      >
                        <option value="">All Periods</option>
                        <option value="week">This Week</option>
                        <option value="month">This Month</option>
                        <option value="quarter">This Quarter</option>
                        <option value="year">This Year</option>
                      </select>
                    </div>

                    {/* Efficiency Range Filter */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Efficiency Range</label>
                      <select 
                        value={filters.efficiency}
                        onChange={(e) => setFilters({...filters, efficiency: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800 focus:border-green-800"
                      >
                        <option value="">All Ranges</option>
                        <option value="low">Low (0-50%)</option>
                        <option value="medium">Medium (51-80%)</option>
                        <option value="high">High (81-100%)</option>
                      </select>
                    </div>

                    {/* Analysis Type Filter */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Analysis Type</label>
                      <select 
                        value={filters.analysis_type}
                        onChange={(e) => setFilters({...filters, analysis_type: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800 focus:border-green-800"
                      >
                        <option value="">All Types</option>
                        <option value="utilization">Utilization</option>
                        <option value="efficiency">Efficiency</option>
                        <option value="capacity">Capacity</option>
                        <option value="bottlenecks">Bottlenecks</option>
                      </select>
                    </div>

                    {/* Metric Filter */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Metric</label>
                      <select 
                        value={filters.metric}
                        onChange={(e) => setFilters({...filters, metric: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800 focus:border-green-800"
                      >
                        <option value="">All Metrics</option>
                        <option value="allocation">Allocation %</option>
                        <option value="productivity">Productivity</option>
                        <option value="cost">Cost</option>
                        <option value="quality">Quality</option>
                      </select>
                    </div>

                    {/* Project Type Filter */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Project Type</label>
                      <select 
                        value={filters.project_type}
                        onChange={(e) => setFilters({...filters, project_type: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800 focus:border-green-800"
                      >
                        <option value="">All Types</option>
                        {Array.from(new Set(projects.map(project => project.project_type).filter(Boolean)))
                          .sort()
                          .map(type => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                      </select>
                    </div>
                  </>
                )}

                {currentView === 'customer-projects' && (
                  <>
                    {/* Customer Name Multi-Select Filter */}
                    <MultiSelect
                      label="Customer Name"
                      options={customers.map(customer => ({ value: customer.id, label: customer.name }))}
                      selectedValues={filters.selected_customers}
                      onSelectionChange={(values) => setFilters({...filters, selected_customers: values})}
                      placeholder="All Customers"
                      searchPlaceholder="Filter customers..."
                    />

                    {/* Account Status Filter */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
                      <select 
                        value={filters.account_status}
                        onChange={(e) => setFilters({...filters, account_status: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800 focus:border-green-800"
                      >
                        <option value="">All Status</option>
                        <option value="Planning">Planning</option>
                        <option value="Active">Active</option>
                        <option value="Completed">Completed</option>
                        <option value="Onhold">Onhold</option>
                      </select>
                    </div>
                  </>
                )}
              </div>

              {/* Create Filter Button - Only show for utilization view */}
              {currentView === 'utilization' && (
                <div className="mt-6 pt-4 border-t border-slate-300">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-slate-900">Save Current Filter Configuration</h3>
                  </div>
                  <SavedFiltersManager
                    currentFilters={{
                      selected_departments: filters.selected_departments,
                      selected_roles: filters.selected_roles,
                      allocation_status: filters.allocation_status,
                      selected_projects: filters.selected_projects,
                      utilization_percentage: filters.utilization_percentage,
                      selected_utilization_ranges: filters.selected_utilization_ranges,
                      custom_utilization_range: filters.custom_utilization_range,
                      selected_project_types: filters.selected_project_types,
                      selected_practices_utilization: filters.selected_practices_utilization,
                      selected_locations: filters.selected_locations,
                      selected_weeks: filters.selected_weeks
                    }}
                    onApplyFilter={(savedFilters) => {
                      // Create a new filters object that replaces the saved filter keys
                      const newFilters = { ...filters }
                      
                      // Apply each saved filter key-value pair
                      Object.keys(savedFilters).forEach(key => {
                        newFilters[key] = savedFilters[key]
                      })
                      
                      setFilters(newFilters)
                    }}
                    pageContext="overall_utilization"
                    mode="create"
                    onFiltersChanged={handleSavedFiltersChanged}
                    refreshTrigger={savedFiltersRefreshTrigger}
                  />
                </div>
              )}

              {/* Clear Filters Button */}
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setFilters({
                    status: '', department: '', project_manager: '', project_type: '', priority: '',
                    role: '', allocation_status: '', project: '',
                    resource_type: '', utilization: '', availability: '', skill_level: '',
                    time_period: '', efficiency: '', analysis_type: '', metric: '',
                    utilization_percentage: '', city: '',
                    selected_departments: [], selected_projects: [],
                    selected_roles: [], selected_project_types: [], selected_locations: [],
                    selected_parent_departments: [],
                    selected_utilization_ranges: [], custom_utilization_range: null,
                    selected_project_types_projects: [], selected_practices_projects: [],
                    selected_projects_projects: [],
                    selected_projects_matrix: [], selected_project_types_matrix: [], selected_practices_matrix: [],
                    selected_parent_departments_forecast: [],
                    selected_departments_forecast: [], selected_roles_forecast: [],
                    selected_projects_forecast: [], selected_project_types_forecast: [], selected_practices_forecast: [],
                    selected_practices_utilization: [], selected_weeks: getDefaultCurrentWeek()
                  })}
                  className="text-sm text-slate-600 hover:text-slate-800 transition-colors"
                >
                  Clear all filters
                </button>
              </div>
            </div>
          )}

          {/* Tab Content */}
          <div className="tab-content">
            {renderTabContent()}
            {showAIFilter ? (
        <AIFilterChatbot
          onClose={onChatbotClose}
          onApplyFilters={handleAIFilterApply}
          tableName={TABLE_VIEW_MAPPING[currentView]}
          defaultMessage={`Hello! How can I help you filter the data today?`}
        />
      ) : null}
          </div>
                </div>
                )}
                {/* permission denied message */}
            </div>
    </div>
  )
}

export default Projects