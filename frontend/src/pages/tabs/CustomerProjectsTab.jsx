import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import LoadingSpinner from '../../components/LoadingSpinner.jsx'
import { getCookie } from '../../utils/helpers.js'
import { TOKEN, getApiBaseUrl } from '../../utils/constants.js'
import { usePermissions } from '../../context/PermissionContext.jsx'

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
`

// Domain list
const DOMAIN_OPTIONS = [
  { value: 'Advertising & Marketing', label: 'Advertising & Marketing' },
  { value: 'Agriculture', label: 'Agriculture' },
  { value: 'Automotive', label: 'Automotive' },
  { value: 'Business & Professional Services', label: 'Business & Professional Services' },
  { value: 'Consumer Packaged Goods', label: 'Consumer Packaged Goods' },
  { value: 'Education', label: 'Education' },
  { value: 'Electrical & Electronics', label: 'Electrical & Electronics' },
  { value: 'Energy & Utilities', label: 'Energy & Utilities' },
  { value: 'Financial Services', label: 'Financial Services' },
  { value: 'Food, Beverage & Restaurants', label: 'Food, Beverage & Restaurants' },
  { value: 'Gaming', label: 'Gaming' },
  { value: 'Healthcare & Life Sciences', label: 'Healthcare & Life Sciences' },
  { value: 'Industrial Goods & Manufacturing', label: 'Industrial Goods & Manufacturing' },
  { value: 'Government', label: 'Government' },
  { value: 'Logistics', label: 'Logistics' },
  { value: 'Manufacturing & Industrial', label: 'Manufacturing & Industrial' },
  { value: 'Media & Entertainment', label: 'Media & Entertainment' },
  { value: 'Non-Profit', label: 'Non-Profit' },
  { value: 'Retail & Wholesale', label: 'Retail & Wholesale' },
  { value: 'Software & Internet', label: 'Software & Internet' },
  { value: 'Telecommunications', label: 'Telecommunications' },
  { value: 'Tourism & Leisure', label: 'Tourism & Leisure' },
  { value: 'Others', label: 'Others' }
]

// Location list
const LOCATION_OPTIONS = [
  { value: 'United States', label: 'United States' },
  { value: 'United Kingdom', label: 'United Kingdom' },
  { value: 'India', label: 'India' },
  { value: 'Canada', label: 'Canada' },
  { value: 'Australia', label: 'Australia' },
  { value: 'Germany', label: 'Germany' },
  { value: 'France', label: 'France' },
  { value: 'Japan', label: 'Japan' },
  { value: 'China', label: 'China' },
  { value: 'Singapore', label: 'Singapore' },
  { value: 'Netherlands', label: 'Netherlands' },
  { value: 'Sweden', label: 'Sweden' },
  { value: 'Norway', label: 'Norway' },
  { value: 'Denmark', label: 'Denmark' },
  { value: 'Switzerland', label: 'Switzerland' },
  { value: 'Belgium', label: 'Belgium' },
  { value: 'Spain', label: 'Spain' },
  { value: 'Italy', label: 'Italy' },
  { value: 'Brazil', label: 'Brazil' },
  { value: 'Mexico', label: 'Mexico' },
  { value: 'South Korea', label: 'South Korea' },
  { value: 'UAE', label: 'UAE' },
  { value: 'Saudi Arabia', label: 'Saudi Arabia' },
  { value: 'South Africa', label: 'South Africa' },
  { value: 'Argentina', label: 'Argentina' },
  { value: 'Chile', label: 'Chile' },
  { value: 'Poland', label: 'Poland' },
  { value: 'Ireland', label: 'Ireland' },
  { value: 'Israel', label: 'Israel' },
  { value: 'New Zealand', label: 'New Zealand' },
  { value: 'Others', label: 'Others' }
]

// Helper function to get manager options from employees
const getManagerOptions = (employees) => {
  if (!employees || !Array.isArray(employees)) {
    return []
  }

  // Filter employees who have manager roles and are active
  const managers = employees.filter(employee => {
    if (!employee) return false
    
    // Filter to show only active employees
    const isActive = (employee.employee_status || 'Active') === 'Active'
    if (!isActive) return false
    
    // Check designation field for manager-related roles
    const designation = employee.designation?.toLowerCase() || ''
    const roleName = employee.role?.role_name?.toLowerCase() || ''
    
    // Check if designation or role contains manager-related keywords
    const managerKeywords = ['manager', 'lead', 'director', 'head', 'supervisor', 'principal']
    
    return managerKeywords.some(keyword => 
      designation.includes(keyword) || roleName.includes(keyword)
    )
  })

  // Convert to options format - use employee ID as value to ensure uniqueness
  // Store the full name in a separate property for reference
  return managers.map(manager => ({
    value: manager.id, // Use unique employee ID
    label: `${manager.first_name} ${manager.last_name}${manager.designation ? ` (${manager.designation})` : ''}`,
    name: `${manager.first_name} ${manager.last_name}` // Store name separately for submission
  }))
}

// SearchableDropdown Component
const SearchableDropdown = ({ 
  options, 
  value, 
  onChange, 
  placeholder = "Search...", 
  className = "",
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filteredOptions, setFilteredOptions] = useState(options)
  const dropdownRef = useRef(null)
  const inputRef = useRef(null)

  // Filter options based on search term
  useEffect(() => {
    if (!Array.isArray(options)) {
      setFilteredOptions([])
      return
    }
    
    if (searchTerm.trim() === '') {
      setFilteredOptions(options)
    } else {
      const filtered = options.filter(option => {
        if (!option || typeof option !== 'object') return false
        const label = option.label || ''
        const value = option.value !== undefined ? String(option.value) : ''
        return label.toLowerCase().includes(searchTerm.toLowerCase()) ||
               value.toLowerCase().includes(searchTerm.toLowerCase())
      })
      setFilteredOptions(filtered)
    }
  }, [searchTerm, options])

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

  // Handle option selection
  const handleOptionSelect = (option) => {
    onChange(option.value)
    setIsOpen(false)
    setSearchTerm('')
  }

  // Handle clear selection
  const handleClearSelection = () => {
    onChange('')
    setSearchTerm('')
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }

  // Handle input focus
  const handleInputFocus = () => {
    setIsOpen(true)
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }

  // Handle input change
  const handleInputChange = (e) => {
    const newSearchTerm = e.target.value
    setSearchTerm(newSearchTerm)
    
    // If user is typing (searching), clear the current selection
    if (newSearchTerm.trim() !== '') {
      onChange('') // Clear the current selection when user starts typing
    }
    
    if (!isOpen) {
      setIsOpen(true)
    }
  }

  // Handle key down events for better UX
  const handleKeyDown = (e) => {
    if (e.key === 'Backspace' || e.key === 'Delete') {
      // If user presses backspace/delete and there's a selected value, clear it
      if (value && searchTerm === '') {
        onChange('')
        setSearchTerm('')
      }
    }
  }

  // Get display value
  const getDisplayValue = () => {
    // If user is actively searching, show the search term
    if (searchTerm !== '') {
      return searchTerm
    }
    
    // If there's a selected value and user is not searching, show the selected option
    if (value !== undefined && value !== null && value !== '' && Array.isArray(options)) {
      // Compare values with type coercion to handle both number and string IDs
      const selectedOption = options.find(option => 
        option && String(option.value) === String(value)
      )
      return selectedOption ? selectedOption.label || '' : ''
    }
    
    return ''
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={getDisplayValue()}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleInputFocus}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
            disabled ? 'bg-slate-100 cursor-not-allowed' : ''
          }`}
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
          {/* Clear button - only show when there's a selected value */}
          {value && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleClearSelection()
              }}
              className="mr-2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
              title="Clear selection"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          )}
          
          {/* Dropdown arrow */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setIsOpen(!isOpen)
              if (!isOpen && inputRef.current) {
                inputRef.current.focus()
              }
            }}
            className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
            title={isOpen ? "Close dropdown" : "Open dropdown"}
            disabled={disabled}
          >
            <svg 
              className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-hidden">
          <div className="max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 hover:scrollbar-thumb-gray-400">
            {/* Clear option - only show when there's a selected value */}
            {value && (
              <button
                onClick={() => handleClearSelection()}
                className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 transition-colors text-slate-500 border-b border-slate-200"
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                  Clear selection
                </span>
              </button>
            )}
            
            {!Array.isArray(filteredOptions) || filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-slate-500">No options found</div>
            ) : (
              filteredOptions.map((option, index) => {
                if (!option || typeof option !== 'object') return null
                // Use employee ID as key (guaranteed unique since IDs are unique)
                // Fallback to index if value is missing (shouldn't happen)
                const uniqueKey = option.value !== undefined && option.value !== null 
                  ? String(option.value) 
                  : `opt-${index}`
                return (
                  <button
                    key={uniqueKey}
                    onClick={() => handleOptionSelect(option)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-100 transition-colors ${
                      String(value) === String(option.value) ? 'bg-green-50 text-green-700' : 'text-slate-900'
                    }`}
                  >
                    {option.label || 'Unknown'}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}


// Custom Popup Component for Project Completion Status
const ProjectCompletionPopup = ({ isOpen, onClose, projectData }) => {
  if (!isOpen || !projectData) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-900">
              Cannot Complete Customer
            </h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <p className="text-sm text-red-800 font-medium">
                  Cannot set customer status to Completed
                </p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Project Status Summary</h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Total Projects:</span>
                  <span className="text-sm font-medium text-slate-900">{projectData.total_projects}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Completed Projects:</span>
                  <span className="text-sm font-medium text-green-600">{projectData.completed_projects}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Incomplete Projects:</span>
                  <span className="text-sm font-medium text-red-600">{projectData.incomplete_projects}</span>
                </div>
              </div>
            </div>

            {projectData.incomplete_project_names && projectData.incomplete_project_names.length > 0 && (
              <div className="bg-slate-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Incomplete Projects</h3>
                <div className="space-y-1">
                  {projectData.incomplete_project_names.map((projectName, index) => (
                    <div key={index} className="flex items-center">
                      <svg className="w-4 h-4 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                      </svg>
                      <span className="text-sm text-slate-700">{projectName}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-green-400 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <div>
                  <p className="text-sm text-green-800 font-medium">Action Required</p>
                  <p className="text-sm text-green-700 mt-1">
                    Please complete all child projects before setting the customer status to Completed.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-green-700 text-white hover:bg-green-800 rounded-lg transition-colors"
            >
              Understood
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Customer Project Creation/Edit Modal
const CustomerProjectModal = ({ isOpen, onClose, onSave, employees, editingCustomer, isCreating, isUpdating, apiError, setApiError, availableDomains = DOMAIN_OPTIONS }) => {
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_location: '',
    domain_account: '',
    custom_domain: '',
    account_manager_name: '',
    account_manager_id: '', // Store manager ID for dropdown
    account_status: 'Planning',
    expiry_date: '',
    description: ''
  })

  const [errors, setErrors] = useState({})

  // Helper function to find manager ID by name
  const findManagerIdByName = (managerName) => {
    if (!managerName || !employees || !Array.isArray(employees)) return ''
    
    const managerOptions = getManagerOptions(employees)
    // Find first matching manager by name (in case of duplicates)
    const matchingOption = managerOptions.find(option => option.name === managerName)
    return matchingOption ? matchingOption.value : ''
  }

  // Helper function to get manager name by ID
  const getManagerNameById = (managerId) => {
    if (!managerId || !employees || !Array.isArray(employees)) return ''
    
    const managerOptions = getManagerOptions(employees)
    const matchingOption = managerOptions.find(option => option.value === managerId)
    return matchingOption ? matchingOption.name : ''
  }

  // Populate form data when editing
  useEffect(() => {
    if (editingCustomer) {
      const domainAccount = editingCustomer.domain_account || ''
      const isCustomDomain = !availableDomains.some(option => option.value === domainAccount)
      
      // Find manager ID from stored name
      const managerId = findManagerIdByName(editingCustomer.account_manager_name || '')
      
      setFormData({
        customer_name: editingCustomer.name || '',
        customer_location: editingCustomer.customer_location || '',
        domain_account: isCustomDomain ? 'Others' : domainAccount,
        custom_domain: isCustomDomain ? domainAccount : '',
        account_manager_name: editingCustomer.account_manager_name || '',
        account_manager_id: managerId, // Set manager ID for dropdown
        account_status: editingCustomer.account_status || 'Planning',
        expiry_date: editingCustomer.expiry_date || '',
        description: editingCustomer.description || ''
      })
    } else {
      setFormData({
        customer_name: '',
        customer_location: '',
        domain_account: '',
        custom_domain: '',
        account_manager_name: '',
        account_manager_id: '',
        account_status: 'Planning',
        expiry_date: '',
        description: ''
      })
    }
    setErrors({})
    setApiError('')
  }, [editingCustomer, availableDomains, employees])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    let processedValue = value
    
    setFormData(prev => ({
      ...prev,
      [name]: processedValue
    }))
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
    
    // Clear API error when user starts typing
    if (apiError && setApiError) {
      setApiError('')
    }
  }

  const validateForm = () => {
    const newErrors = {}
    
    if (!formData.customer_name.trim()) {
      newErrors.customer_name = 'Customer name is required'
    }
    
    
    // Customer location validation
    if (!formData.customer_location.trim()) {
      newErrors.customer_location = 'Customer location is required'
    }
    
    // Domain account validation
    if (!formData.domain_account.trim()) {
      newErrors.domain_account = 'Domain is required'
    }
    
    // Custom domain validation when "Others" is selected
    if (formData.domain_account === 'Others' && !formData.custom_domain.trim()) {
      newErrors.custom_domain = 'Custom domain is required when Others is selected'
    }
    
    // Account manager name validation
    if (!formData.account_manager_name.trim()) {
      newErrors.account_manager_name = 'Account manager name is required'
    }
    
    // Expiry date validation
    if (!formData.expiry_date.trim()) {
      newErrors.expiry_date = 'Expiry date is required'
    } else {
      const selectedDate = new Date(formData.expiry_date)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      if (selectedDate < today) {
        newErrors.expiry_date = 'Expiry date cannot be in the past'
      }
    }
    
    setErrors(newErrors)
    if (setApiError) {
      setApiError('')
    }
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    
    if (validateForm()) {
      // Prepare data for submission
      const submitData = {
        ...formData,
        domain_account: formData.domain_account === 'Others' ? formData.custom_domain : formData.domain_account
      }
      
      onSave(submitData)
      // Reset form
      setFormData({
        customer_name: '',
        customer_location: '',
        domain_account: '',
        custom_domain: '',
        account_manager_name: '',
        account_manager_id: '',
        account_status: 'Planning',
        expiry_date: '',
        description: ''
      })
      setErrors({})
      if (setApiError) {
        setApiError('')
      }
    }
  }

  const handleClose = () => {
    setFormData({
      customer_name: '',
      customer_location: '',
      domain_account: '',
      custom_domain: '',
      account_manager_name: '',
      account_manager_id: '',
      account_status: 'Planning',
      expiry_date: '',
      description: ''
    })
    setErrors({})
    if (setApiError) {
      setApiError('')
    }
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-900">
              {editingCustomer ? 'Edit Customer' : 'Add Customer'}
            </h2>
            <button
              onClick={handleClose}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Customer Information Section */}
            <div className="bg-slate-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Customer Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    name="customer_name"
                    value={formData.customer_name}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                      errors.customer_name ? 'border-red-300' : 'border-slate-300'
                    }`}
                    placeholder="Enter customer name"
                  />
                  {errors.customer_name && (
                    <p className="mt-1 text-sm text-red-600">{errors.customer_name}</p>
                  )}
                </div>


                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Customer Location *
                  </label>
                  <SearchableDropdown
                    options={LOCATION_OPTIONS}
                    value={formData.customer_location}
                    onChange={(value) => setFormData(prev => ({ ...prev, customer_location: value }))}
                    placeholder="Search location..."
                    className={`${errors.customer_location ? 'border-red-300' : ''}`}
                  />
                  {errors.customer_location && (
                    <p className="mt-1 text-sm text-red-600">{errors.customer_location}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Domain *
                  </label>
                  <SearchableDropdown
                    options={availableDomains}
                    value={formData.domain_account}
                    onChange={(value) => setFormData(prev => ({ 
                      ...prev, 
                      domain_account: value,
                      custom_domain: value === 'Others' ? prev.custom_domain : ''
                    }))}
                    placeholder="Search domain..."
                    className={`${errors.domain_account ? 'border-red-300' : ''}`}
                  />
                  {errors.domain_account && (
                    <p className="mt-1 text-sm text-red-600">{errors.domain_account}</p>
                  )}
                  
                  {/* Custom domain input when "Others" is selected */}
                  {formData.domain_account === 'Others' && (
                    <div className="mt-2">
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Custom Domain *
                      </label>
                      <input
                        type="text"
                        name="custom_domain"
                        value={formData.custom_domain}
                        onChange={handleInputChange}
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                          errors.custom_domain ? 'border-red-300' : 'border-slate-300'
                        }`}
                        placeholder="Enter custom domain"
                      />
                      {errors.custom_domain && (
                        <p className="mt-1 text-sm text-red-600">{errors.custom_domain}</p>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Account Manager Name *
                  </label>
                  <SearchableDropdown
                    options={getManagerOptions(employees)}
                    value={formData.account_manager_id}
                    onChange={(selectedId) => {
                      // Convert selected ID to manager name
                      const managerName = getManagerNameById(selectedId)
                      setFormData(prev => ({ 
                        ...prev, 
                        account_manager_id: selectedId,
                        account_manager_name: managerName
                      }))
                    }}
                    placeholder="Search manager..."
                    className={`${errors.account_manager_name ? 'border-red-300' : ''}`}
                  />
                  {errors.account_manager_name && (
                    <p className="mt-1 text-sm text-red-600">{errors.account_manager_name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Account Status *
                  </label>
                  <select
                    name="account_status"
                    value={formData.account_status}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="Planning">Planning</option>
                    <option value="Active">Active</option>
                    <option value="Completed">Completed</option>
                    <option value="Onhold">Onhold</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Expiry Date *
                  </label>
                  <input
                    type="date"
                    name="expiry_date"
                    value={formData.expiry_date}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                      errors.expiry_date ? 'border-red-300' : 'border-slate-300'
                    }`}
                  />
                  {errors.expiry_date && (
                    <p className="mt-1 text-sm text-red-600">{errors.expiry_date}</p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Description
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="Enter customer description"
                  />
                </div>
              </div>
            </div>

            {/* API Error Display */}
            {apiError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <p className="text-sm text-red-800">{apiError}</p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreating || isUpdating}
                className="px-6 py-2 bg-green-700 text-white hover:bg-green-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {(isCreating || isUpdating) && (
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {editingCustomer ? (isUpdating ? 'Updating...' : 'Update Customer') : (isCreating ? 'Creating...' : 'Create Customer')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

const CustomerProjectsTab = ({ 
  customers, 
  employees, 
  projects, 
  loading, 
  error, 
  isAuthenticated,
  fetchProjects,
  filters,
  searchTerm,
  setSearchTerm,
  projectTeamMembers,
  setProjectTeamMembers,
  updateCustomers
}) => {
  const navigate = useNavigate()
  const { hasPermission } = usePermissions()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [expandedCustomers, setExpandedCustomers] = useState(new Set())
  const [showCompletionPopup, setShowCompletionPopup] = useState(false)
  const [completionPopupData, setCompletionPopupData] = useState(null)
  const [apiError, setApiError] = useState('')
  
  // Dynamic domains state - combines static DOMAIN_OPTIONS with custom domains from customers
  // Ensure non-"Others" options are alphabetically sorted and "Others" stays last
  const initialNonOthers = DOMAIN_OPTIONS.filter(opt => opt.value !== 'Others').sort((a, b) => a.label.localeCompare(b.label))
  const initialOthers = DOMAIN_OPTIONS.find(opt => opt.value === 'Others')
  const [availableDomains, setAvailableDomains] = useState([
    ...initialNonOthers,
    ...(initialOthers ? [initialOthers] : [])
  ])

  // Extract unique domains from customers and merge with static options
  useEffect(() => {
    if (!customers || !Array.isArray(customers)) return
    
    // Get unique domains from existing customers
    const customerDomains = new Set()
    customers.forEach(customer => {
      if (customer.domain_account && customer.domain_account.trim() !== '') {
        const domain = customer.domain_account.trim()
        // Only add if it's not in the static DOMAIN_OPTIONS
        const isStaticDomain = DOMAIN_OPTIONS.some(opt => 
          opt.value.toLowerCase() === domain.toLowerCase()
        )
        if (!isStaticDomain) {
          customerDomains.add(domain)
        }
      }
    })
    
    // Build a unified, alphabetically sorted list for all non-"Others" options
    const staticNonOthers = DOMAIN_OPTIONS.filter(opt => opt.value !== 'Others')
    const othersOption = DOMAIN_OPTIONS.find(opt => opt.value === 'Others')
    const staticDomainValues = new Set(staticNonOthers.map(opt => opt.value.toLowerCase()))
    const customDomainOptions = Array.from(customerDomains)
      .filter(domain => !staticDomainValues.has(domain.toLowerCase()))
      .map(domain => ({ value: domain, label: domain }))

    const mergedNonOthers = [...staticNonOthers, ...customDomainOptions]
      .sort((a, b) => a.label.localeCompare(b.label))

    // Update available domains with Others always last
    setAvailableDomains([
      ...mergedNonOthers,
      ...(othersOption ? [othersOption] : [])
    ])
  }, [customers])

  // Note: Using projects prop directly instead of local allProjects state

  // Calculate average utilization for a project (same logic as ProjectsTab)
  const calculateProjectAvgUtilization = (projectId) => {
    if (!employees || !Array.isArray(employees)) {
      return 0
    }

    // Get current week date range
    const today = new Date()
    const currentWeekStart = new Date(today)
    currentWeekStart.setDate(today.getDate() - today.getDay()) // Start of current week (Sunday)
    const currentWeekEnd = new Date(currentWeekStart)
    currentWeekEnd.setDate(currentWeekStart.getDate() + 6)

    // Check if allocation overlaps with current week
    const isAllocationInCurrentWeek = (allocation) => {
      if (!allocation.start_date || !allocation.end_date) return false
      
      const allocationStart = new Date(allocation.start_date)
      const allocationEnd = new Date(allocation.end_date)
      
      return allocationStart <= currentWeekEnd && allocationEnd >= currentWeekStart
    }

    // Get all employees allocated to this project in current week
    const projectAllocations = projectTeamMembers[projectId]?.filter(
      alloc => alloc.status === 'Active' && isAllocationInCurrentWeek(alloc)
    ) || []

    if (projectAllocations.length === 0) {
      return 0
    }

    // Calculate total allocation percentage for this project
    const totalAllocation = projectAllocations.reduce((sum, alloc) => {
      return sum + (alloc.allocation_percentage || 0)
    }, 0)

    // Get unique employees count for this project
    const uniqueEmployees = new Set(projectAllocations.map(alloc => alloc.employee_id))
    
    // Calculate average utilization
    return uniqueEmployees.size > 0 ? (totalAllocation / uniqueEmployees.size) : 0
  }

  // Process team members to show only current week and deduplicate employees (same logic as ProjectsTab)
  const getCurrentWeekTeamMembers = (projectId) => {
    if (!projectTeamMembers[projectId] || !Array.isArray(projectTeamMembers[projectId])) {
      return []
    }

    // Get current week date range
    const today = new Date()
    const currentWeekStart = new Date(today)
    currentWeekStart.setDate(today.getDate() - today.getDay()) // Start of current week (Sunday)
    const currentWeekEnd = new Date(currentWeekStart)
    currentWeekEnd.setDate(currentWeekStart.getDate() + 6)

    // Check if allocation overlaps with current week
    const isAllocationInCurrentWeek = (allocation) => {
      if (!allocation.start_date || !allocation.end_date) return false
      
      const allocationStart = new Date(allocation.start_date)
      const allocationEnd = new Date(allocation.end_date)
      
      return allocationStart <= currentWeekEnd && allocationEnd >= currentWeekStart
    }

    // Filter for current week allocations
    const currentWeekMembers = projectTeamMembers[projectId].filter(member => 
      isAllocationInCurrentWeek(member)
    )

    // Deduplicate employees and aggregate their allocation percentages
    const employeeMap = new Map()
    
    currentWeekMembers.forEach(member => {
      const employeeId = member.employee_id
      if (employeeMap.has(employeeId)) {
        // Employee already exists, aggregate allocation percentage
        const existing = employeeMap.get(employeeId)
        existing.allocation_percentage += member.allocation_percentage || 0
        // Keep the most recent role if there are multiple
        if (member.role) {
          existing.role = member.role
        }
      } else {
        // New employee, add to map
        employeeMap.set(employeeId, {
          ...member,
          allocation_percentage: member.allocation_percentage || 0
        })
      }
    })

    return Array.from(employeeMap.values())
  }

  // Note: fetchProjectTeam is handled by the parent component (Projects.jsx)

  // Note: Team data is now managed by the parent component (Projects.jsx)
  // and passed down through props, so we don't need to fetch it here

  // Handle project name click to navigate to project details
  const handleProjectNameClick = (project) => {
    // Navigate to project details page
    navigate(`/project/${project.id}`)
  }

  // Add custom domain to available domains list if it doesn't exist (prevent duplicates)
  const addCustomDomainIfNotExists = (domain) => {
    if (!domain || domain.trim() === '') return
    
    const trimmedDomain = domain.trim()
    
    // Check if domain already exists (case-insensitive check)
    const domainExists = availableDomains.some(opt => 
      opt.value.toLowerCase() === trimmedDomain.toLowerCase()
    )
    
    // If domain doesn't exist and it's not "Others", add it
    if (!domainExists && trimmedDomain !== 'Others') {
      const newDomainOption = { value: trimmedDomain, label: trimmedDomain }

      // Build a unified non-"Others" list from static + existing custom + new domain
      const othersOption = DOMAIN_OPTIONS.find(opt => opt.value === 'Others')
      const staticNonOthers = DOMAIN_OPTIONS.filter(opt => opt.value !== 'Others')
      const existingCustomNonOthers = availableDomains.filter(opt => 
        opt.value !== 'Others' && !DOMAIN_OPTIONS.some(staticOpt => staticOpt.value.toLowerCase() === opt.value.toLowerCase())
      )

      const mergedNonOthers = [...staticNonOthers, ...existingCustomNonOthers, newDomainOption]
        .reduce((acc, opt) => {
          const exists = acc.some(o => o.value.toLowerCase() === opt.value.toLowerCase())
          if (!exists) acc.push(opt)
          return acc
        }, [])
        .sort((a, b) => a.label.localeCompare(b.label))

      setAvailableDomains([
        ...mergedNonOthers,
        ...(othersOption ? [othersOption] : [])
      ])
    }
  }

  // Create customer project
  const handleCreateProject = async (projectData) => {
    const token = getCookie(TOKEN)
    if (!token) return

    try {
      setIsCreating(true)
      const baseUrl = getApiBaseUrl()
      
      // Determine the actual domain account (use custom domain if "Others" is selected)
      // Note: handleSubmit in modal already converts this, but we handle both cases
      const actualDomainAccount = projectData.domain_account === 'Others' 
        ? projectData.custom_domain 
        : projectData.domain_account
      
      // Add custom domain to available domains if it's a new custom domain
      // Check if custom_domain was provided (user selected "Others" and entered a new domain)
      if (projectData.custom_domain && projectData.custom_domain.trim() !== '') {
        addCustomDomainIfNotExists(projectData.custom_domain)
      }
      // Also check if the domain_account itself is a new domain not in static list
      else if (actualDomainAccount && actualDomainAccount !== 'Others') {
        const isStaticDomain = DOMAIN_OPTIONS.some(opt => opt.value.toLowerCase() === actualDomainAccount.toLowerCase())
        if (!isStaticDomain) {
          addCustomDomainIfNotExists(actualDomainAccount)
        }
      }
      
      // First, create the customer
      const customerResponse = await fetch(`${baseUrl}/api/customers`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: projectData.customer_name,
          customer_location: projectData.customer_location,
          domain_account: actualDomainAccount,
          account_manager_name: projectData.account_manager_name,
          account_status: projectData.account_status,
          expiry_date: projectData.expiry_date,
          description: projectData.description
        })
      })

      if (!customerResponse.ok) {
        const errorData = await customerResponse.json()
        throw new Error(errorData.error || 'Failed to create customer')
      }

      const customerData = await customerResponse.json()
      const customerId = customerData.customer.id

      // Main customer project is just the customer record - no additional project needed
      // Child projects will be created separately in the Project Tab

      // Update state optimistically
      if (customerData.customer && updateCustomers) {
        updateCustomers(prev => [...prev, customerData.customer])
      }

      setShowCreateModal(false)
      
      // Note: Removed fetchProjects() call - using optimistic updates instead
    } catch (err) {
      console.error('Error creating customer project:', err)
      setApiError(err.message)
    } finally {
      setIsCreating(false)
    }
  }

  // Edit customer
  const handleEditCustomer = (customer) => {
    setEditingCustomer(customer)
    setApiError('') // Clear any previous errors
    setShowEditModal(true)
  }

  // Update customer
  const handleUpdateCustomer = async (customerData) => {
    const token = getCookie(TOKEN)
    if (!token) return

    try {
      setIsUpdating(true)
      const baseUrl = getApiBaseUrl()
      
      // Determine the actual domain account (use custom domain if "Others" is selected)
      // Note: handleSubmit in modal already converts this, but we handle both cases
      const actualDomainAccount = customerData.domain_account === 'Others' 
        ? customerData.custom_domain 
        : customerData.domain_account
      
      // Add custom domain to available domains if it's a new custom domain
      // Check if custom_domain was provided (user selected "Others" and entered a new domain)
      if (customerData.custom_domain && customerData.custom_domain.trim() !== '') {
        addCustomDomainIfNotExists(customerData.custom_domain)
      }
      // Also check if the domain_account itself is a new domain not in static list
      else if (actualDomainAccount && actualDomainAccount !== 'Others') {
        const isStaticDomain = DOMAIN_OPTIONS.some(opt => opt.value.toLowerCase() === actualDomainAccount.toLowerCase())
        if (!isStaticDomain) {
          addCustomDomainIfNotExists(actualDomainAccount)
        }
      }
      
      const response = await fetch(`${baseUrl}/api/customers/${editingCustomer.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: customerData.customer_name,
          customer_location: customerData.customer_location,
          domain_account: actualDomainAccount,
          account_manager_name: customerData.account_manager_name,
          account_status: customerData.account_status,
          expiry_date: customerData.expiry_date,
          description: customerData.description
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        
        // Handle incomplete child projects validation error
        if (errorData.code === 'INCOMPLETE_CHILD_PROJECTS') {
          setCompletionPopupData({
            total_projects: errorData.total_projects,
            completed_projects: errorData.completed_projects,
            incomplete_projects: errorData.incomplete_projects,
            incomplete_project_names: errorData.incomplete_project_names
          })
          setShowCompletionPopup(true)
          return
        }
        
        throw new Error(errorData.error || 'Failed to update customer')
      }

      const responseData = await response.json()
      
      // Update state optimistically
      if (responseData.customer && updateCustomers) {
        updateCustomers(prev => prev.map(customer => 
          customer.id === editingCustomer.id ? responseData.customer : customer
        ))
      }
      
      setShowEditModal(false)
      setEditingCustomer(null)
      
      // Note: Removed fetchProjects() call - using optimistic updates instead
    } catch (err) {
      console.error('Error updating customer:', err)
      setApiError(err.message)
    } finally {
      setIsUpdating(false)
    }
  }

  // Delete customer
  const handleDeleteCustomer = async (customerId) => {
    if (!window.confirm('Are you sure you want to delete this customer? This will also delete all their projects.')) {
      return
    }

    const token = getCookie(TOKEN)
    if (!token) return

    try {
      setIsDeleting(true)
      const baseUrl = getApiBaseUrl()
      
      const response = await fetch(`${baseUrl}/api/customers/${customerId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        
        // Handle specific error for live projects
        if (errorData.code === 'HAS_LIVE_PROJECTS') {
          alert(`Cannot delete customer. Customer has ${errorData.live_projects_count} live project(s). Please complete or cancel all projects before deleting the customer.`)
        } else {
          throw new Error(errorData.error || 'Failed to delete customer')
        }
        return
      }

      // Update state optimistically - remove the deleted customer
      if (updateCustomers) {
        updateCustomers(prev => prev.filter(customer => customer.id !== customerId))
      }
      
      // Note: Removed fetchProjects() call - using optimistic updates instead
    } catch (err) {
      console.error('Error deleting customer:', err)
    } finally {
      setIsDeleting(false)
    }
  }

  // Toggle customer expansion
  const toggleCustomerExpansion = (customerId) => {
    const newExpanded = new Set(expandedCustomers)
    if (newExpanded.has(customerId)) {
      newExpanded.delete(customerId)
    } else {
      newExpanded.add(customerId)
    }
    setExpandedCustomers(newExpanded)
  }

  // Get projects for a specific customer
  const getCustomerProjects = (customerId) => {
    return (projects || []).filter(project => {
      // Show both main customer projects and child projects for this customer
      return project.customer_id === customerId
    })
  }

  // Filter customers based on search and filters
  const filteredCustomers = useMemo(() => {
    // Filter customers (all customers are customer projects)
    let filtered = customers || []

    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      filtered = filtered.filter(customer => 
        customer.name?.toLowerCase().includes(searchLower) ||
        customer.customer_location?.toLowerCase().includes(searchLower) ||
        customer.domain_account?.toLowerCase().includes(searchLower) ||
        customer.account_manager_name?.toLowerCase().includes(searchLower) ||
        customer.account_status?.toLowerCase().includes(searchLower) ||
        customer.description?.toLowerCase().includes(searchLower)
      )
    }

    // Customer name filter (multi-select)
    if (filters && filters.selected_customers && filters.selected_customers.length > 0) {
      filtered = filtered.filter(customer => 
        filters.selected_customers.includes(customer.id)
      )
    }

    // Account status filter
    if (filters && filters.account_status) {
      filtered = filtered.filter(customer => 
        customer.account_status === filters.account_status
      )
    }

    return filtered
  }, [customers, searchTerm, filters])

  // Memoize customer statistics
  const customerStats = useMemo(() => {
    const totalCustomers = (customers || []).length
    const totalProjects = (customers || []).reduce((sum, customer) => {
      return sum + (customer.project_count || 0)
    }, 0)

    return { totalCustomers, totalProjects }
  }, [customers])

  // Format currency
  const formatCurrency = useCallback((amount) => {
    if (!amount) return '$0'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner message="Loading customer..." size="medium" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="text-red-800">Error: {error}</div>
        <button 
          onClick={() => fetchProjects && fetchProjects()}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <>
      <style>{animationStyles}</style>
      
      {/* View-specific Header */}
      <div className="px-6 py-4 border-b border-slate-200">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-6">
            <h2 className="text-xl font-semibold text-slate-900">
              Total Customers ({filteredCustomers.length})
            </h2>
          </div>
          
          <div className="flex items-center gap-4">
            {hasPermission('customer-project-add') && (
              <button
                onClick={() => {
                  setApiError('') // Clear any previous errors
                  setShowCreateModal(true)
                }}
                className="bg-green-700 text-white px-4 py-2 rounded-lg hover:bg-green-800 transition-colors font-medium flex items-center gap-2"
              >
                <span>+</span>
                Add Customer
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Customer Projects Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                CUSTOMER NAME
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                LOCATION
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                DOMAIN ACCOUNT
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                ACCOUNT MANAGER
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                ACCOUNT STATUS
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                EXPIRY DATE
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                PROJECT COUNT
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                ACTIONS
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {filteredCustomers.length === 0 ? (
              <tr>
                <td colSpan="8" className="px-6 py-12 text-center text-slate-500">
                  No customers found
                </td>
              </tr>
            ) : (
              filteredCustomers.map((customer) => {
                const customerProjects = getCustomerProjects(customer.id)
                const isExpanded = expandedCustomers.has(customer.id)
                
                return (
                  <React.Fragment key={customer.id}>
                    {/* Customer Row */}
                    <tr 
                      className="hover:bg-slate-50 cursor-pointer"
                      onClick={() => toggleCustomerExpansion(customer.id)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleCustomerExpansion(customer.id)
                            }}
                            className="text-slate-400 hover:text-slate-600 transition-colors"
                            title={isExpanded ? "Collapse" : "Expand"}
                          >
                            <svg 
                              className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} 
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
                            </svg>
                          </button>
                          <div>
                            <div className="text-sm font-medium text-slate-900">{customer.name}</div>
                            <div className="text-sm text-slate-500">{customer.description || 'No description'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                        {customer.customer_location || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                        {customer.domain_account || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                        {customer.account_manager_name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          customer.account_status === 'Active' ? 'bg-green-100 text-green-800' :
                          customer.account_status === 'Planning' ? 'bg-yellow-100 text-yellow-800' :
                          customer.account_status === 'Completed' ? 'bg-green-100 text-green-800' :
                          customer.account_status === 'Onhold' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {customer.account_status || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                        {customer.expiry_date ? new Date(customer.expiry_date).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {customerProjects.length} project{customerProjects.length !== 1 ? 's' : ''}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation()
                              handleEditCustomer(customer)
                            }}
                            disabled={!hasPermission('customer-project-edit')}
                            className={`${hasPermission('customer-project-edit') ? 'text-green-700 hover:text-green-900' : 'text-gray-400 cursor-not-allowed'} disabled:opacity-50 disabled:cursor-not-allowed`}
                            title={hasPermission('customer-project-edit') ? "Edit Customer" : "Edit Customer (No Permission)"}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                            </svg>
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteCustomer(customer.id)
                            }}
                            disabled={isDeleting || !hasPermission('customer-project-delete')}
                            className={`${hasPermission('customer-project-delete') ? 'text-red-600 hover:text-red-900' : 'text-gray-400 cursor-not-allowed'} disabled:opacity-50 disabled:cursor-not-allowed`}
                            title={hasPermission('customer-project-delete') ? "Delete Customer" : "Delete Customer (No Permission)"}
                          >
                            {isDeleting ? (
                              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                              </svg>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                    
                    {/* Expanded Projects Row */}
                    {isExpanded && (
                      <tr className="bg-slate-50">
                        <td colSpan="8" className="px-6 py-4">
                          <div className="ml-6">
                            <h4 className="text-sm font-medium text-slate-700 mb-3">Projects for {customer.name}</h4>
                            {customerProjects.length === 0 ? (
                              <p className="text-sm text-slate-500">No projects found for this customer.</p>
                            ) : (
                              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                                <table className="w-full">
                                  <thead className="bg-slate-50">
                                    <tr>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                        PROJECT
                                      </th>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                        STATUS
                                      </th>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                        PRIORITY
                                      </th>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                        PROJECT MANAGER
                                      </th>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                        TIMELINE
                                      </th>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                        BUDGET
                                      </th>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                        TEAM
                                      </th>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                        UTILIZATION
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="bg-white divide-y divide-slate-200">
                                    {customerProjects.map((project) => {
                                      const projectManager = employees.find(emp => emp.id === project.project_manager_id)
                                      
                                      return (
                                        <tr key={project.id} className="hover:bg-slate-50">
                                          <td className="px-4 py-3">
                                            <div className="max-w-xs">
                                              <div 
                                                className="text-sm font-medium text-green-700 hover:text-green-800 cursor-pointer break-words"
                                                onClick={() => handleProjectNameClick(project)}
                                              >
                                                {project.name}
                                              </div>
                                              <div className="text-sm text-slate-500 break-words leading-relaxed mt-1">
                                                {project.description || 'N/A'}
                                              </div>
                                              <div className="flex flex-wrap gap-2 mt-2">
                                                {project.custom_project_type && (
                                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                                    {project.custom_project_type}
                                                  </span>
                                                )}
                                                {project.customer_id && (
                                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                    Child Project
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          </td>
                                          <td className="px-4 py-3 whitespace-nowrap">
                                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                              project.status === 'Active' ? 'bg-green-100 text-green-800' :
                                              project.status === 'Planning' ? 'bg-yellow-100 text-yellow-800' :
                                              project.status === 'Completed' ? 'bg-green-100 text-green-800' :
                                              'bg-gray-100 text-gray-800'
                                            }`}>
                                              {project.status}
                                            </span>
                                          </td>
                                          <td className="px-4 py-3 whitespace-nowrap">
                                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                              project.priority === 'High' ? 'bg-orange-100 text-orange-800' :
                                              project.priority === 'Urgent' ? 'bg-red-100 text-red-800' :
                                              project.priority === 'Low' ? 'bg-green-100 text-green-800' :
                                              'bg-yellow-100 text-yellow-800'
                                            }`}>
                                              {project.priority}
                                            </span>
                                          </td>
                                          <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-900">
                                            {projectManager ? `${projectManager.first_name} ${projectManager.last_name}` : 'N/A'}
                                          </td>
                                          <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-900">
                                            {project.start_date && project.end_date 
                                              ? `${new Date(project.start_date).toLocaleDateString()} - ${new Date(project.end_date).toLocaleDateString()}`
                                              : 'N/A'
                                            }
                                          </td>
                                          <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-900">
                                            <div>{project.budget ? `$${project.budget.toLocaleString()}` : 'N/A'}</div>
                                            <div className="text-slate-500">Spent: ${(project.spent_budget || 0).toLocaleString()}</div>
                                          </td>
                                          <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-900">
                                            {getCurrentWeekTeamMembers(project.id).length} members
                                          </td>
                                          <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-900">
                                            {(() => {
                                              const avgUtilization = calculateProjectAvgUtilization(project.id)
                                              return (
                                                <>
                                                  <div>Avg: {avgUtilization.toFixed(1)}%</div>
                                                  <div className="w-full bg-slate-200 rounded-full h-1.5 mt-1">
                                                    <div 
                                                      className={`h-1.5 rounded-full transition-all duration-300 ${
                                                        avgUtilization >= 80 ? 'bg-green-500' :
                                                        avgUtilization >= 60 ? 'bg-yellow-500' :
                                                        avgUtilization >= 40 ? 'bg-orange-500' :
                                                        'bg-red-500'
                                                      }`} 
                                                      style={{ width: `${Math.min(avgUtilization, 100)}%` }}
                                                    ></div>
                                                  </div>
                                                </>
                                              )
                                            })()}
                                          </td>
                                        </tr>
                                      )
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Customer Project Creation Modal */}
      <CustomerProjectModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSave={handleCreateProject}
        employees={employees}
        editingCustomer={null}
        isCreating={isCreating}
        isUpdating={isUpdating}
        apiError={apiError}
        setApiError={setApiError}
        availableDomains={availableDomains}
      />

      {/* Customer Edit Modal */}
      <CustomerProjectModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false)
          setEditingCustomer(null)
        }}
        onSave={handleUpdateCustomer}
        employees={employees}
        editingCustomer={editingCustomer}
        isCreating={isCreating}
        isUpdating={isUpdating}
        apiError={apiError}
        setApiError={setApiError}
        availableDomains={availableDomains}
      />

      {/* Project Completion Popup */}
      <ProjectCompletionPopup
        isOpen={showCompletionPopup}
        onClose={() => {
          setShowCompletionPopup(false)
          setCompletionPopupData(null)
        }}
        projectData={completionPopupData}
      />
    </>
  )
}

export default CustomerProjectsTab
