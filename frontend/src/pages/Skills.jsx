import { useState, useEffect, useRef, useMemo } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { usePermissions } from '../context/PermissionContext.jsx'
import Header from '../components/Header.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import ImportSelectionModal from '../components/ImportSelectionModal.jsx'
import CertificateBulkImport from '../components/CertificateBulkImport.jsx'
import SkillsBulkImport from '../components/SkillsBulkImport.jsx'
import apiClient, { uploadFile } from '../utils/auth.js'
import * as XLSX from 'xlsx'
import { getApiBaseUrl, TOKEN } from '../utils/constants.js'
import AIFilterChatbot from '../components/AIFilterChatbot.jsx'
import { getCookie } from '../utils/helpers.js'
import LearningManagement from './tabs/LearningManagement.jsx'
import LearningAndTraining from './tabs/LearningAndTraining.jsx'

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
  
  /* Line clamp utility for multi-line text wrapping (max 4 lines) */
  .line-clamp-4 {
    display: -webkit-box;
    -webkit-line-clamp: 4;
    -webkit-box-orient: vertical;
    overflow: hidden;
    word-break: break-word;
  }
`

// Searchable Select Component for single selection
const SearchableSelect = ({
  label,
  options,
  value,
  onChange,
  placeholder = "Select option...",
  searchPlaceholder = "Search options...",
  required = false,
  className = "",
  onOpenChange = null // Callback to notify parent when dropdown opens/closes
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const dropdownRef = useRef(null)
  const buttonRef = useRef(null)
  const dropdownPanelRef = useRef(null)
  const [dropdownPosition, setDropdownPosition] = useState({ top: true, maxHeight: 400 })

  // Calculate dropdown position based on available viewport space
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      // Use requestAnimationFrame to ensure DOM is updated
      const calculatePosition = () => {
        if (!buttonRef.current) return
        
        const buttonRect = buttonRef.current.getBoundingClientRect()
        const viewportHeight = window.innerHeight
        const spaceBelow = viewportHeight - buttonRect.bottom
        const spaceAbove = buttonRect.top
        const dropdownMaxHeight = 500 // Maximum dropdown height
        const taskbarMargin = 60 // Extra margin for taskbar (typically 40-50px)
        
        // Calculate available space (leave margin for taskbar and padding)
        const availableSpaceBelow = spaceBelow - taskbarMargin
        const availableSpaceAbove = spaceAbove - 20
        
        // Determine if dropdown should open above or below
        const shouldOpenAbove = availableSpaceBelow < 300 && availableSpaceAbove > availableSpaceBelow
        
        // Calculate max height based on available space
        let maxHeight = dropdownMaxHeight
        if (shouldOpenAbove) {
          maxHeight = Math.min(dropdownMaxHeight, availableSpaceAbove)
        } else {
          maxHeight = Math.min(dropdownMaxHeight, availableSpaceBelow)
        }
        
        // Ensure minimum height
        maxHeight = Math.max(maxHeight, 200)
        
        setDropdownPosition({
          top: !shouldOpenAbove,
          maxHeight: maxHeight
        })
      }
      
      // Calculate immediately and also after a small delay to account for DOM updates
      calculatePosition()
      const timeoutId = setTimeout(calculatePosition, 10)
      
      // Also recalculate on window resize or scroll
      window.addEventListener('resize', calculatePosition)
      window.addEventListener('scroll', calculatePosition, true)
      
      return () => {
        clearTimeout(timeoutId)
        window.removeEventListener('resize', calculatePosition)
        window.removeEventListener('scroll', calculatePosition, true)
      }
    }
  }, [isOpen])

  // Notify parent when dropdown opens/closes
  useEffect(() => {
    if (onOpenChange) {
      onOpenChange(isOpen)
    }
  }, [isOpen, onOpenChange])

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
  const handleOptionSelect = (optionValue) => {
    onChange(optionValue)
    setIsOpen(false)
    setSearchTerm('')
  }

  // Get display text for selected value
  const getDisplayText = () => {
    if (!value) return placeholder
    const selectedOption = options.find(option => option.value === value)
    return selectedOption ? selectedOption.label : placeholder
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <label className="block text-sm font-medium text-slate-700 mb-2">
        {label}{required && <span className="text-red-500"> *</span>}
      </label>
      
      <button
        type="button"
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-3 py-2 text-left border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800 bg-white flex items-center justify-between ${
          !value ? 'text-slate-500' : 'text-slate-900'
        }`}
      >
        <span className="block truncate">{getDisplayText()}</span>
        <span className="flex-shrink-0 ml-2 pointer-events-none">
          <svg 
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
          </svg>
        </span>
      </button>

      {isOpen && (
        <div 
          ref={dropdownPanelRef}
          className={`absolute z-[100] left-0 w-[400px] max-w-[calc(100vw-2rem)] bg-white border border-slate-300 rounded-lg shadow-2xl overflow-hidden ${
            dropdownPosition.top ? 'mt-1 top-full' : 'mb-1 bottom-full'
          }`}
          style={{ maxHeight: `${dropdownPosition.maxHeight}px` }}
        >
          {/* Search Input */}
          <div className="p-3 border-b border-slate-200">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 hover:text-gray-600"
                >
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              )}
            </div>
          </div>
          
          {/* Options List */}
          <div 
            className="overflow-y-auto scrollbar-thin"
            style={{ maxHeight: `${dropdownPosition.maxHeight - 80}px` }}
          >
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleOptionSelect(option.value)}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-green-50 transition-colors ${
                    value === option.value ? 'bg-green-100 text-green-900' : 'text-slate-900'
                  }`}
                >
                  {option.label}
                </button>
              ))
            ) : (
              <div className="px-3 py-2 text-sm text-slate-500">
                No options found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Multi-Select Component
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
            
            // Get employee count if function is provided
            const employeeCount = getEmployeeCount ? getEmployeeCount(value) : null
            const displayText = employeeCount !== null ? `${option.label} (${employeeCount})` : option.label
            
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
                  className="rounded border-gray-300 text-blue-600 focus:ring-green-800"
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
                    className="rounded border-gray-300 text-blue-600 focus:ring-green-800"
                  />
                  <span className="text-sm text-black">{option.label}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const Skills = () => {
  const { user } = useAuth()
  const { hasPermission, loading: permissionsLoading } = usePermissions()
  const [employees, setEmployees] = useState([])
  const [skills, setSkills] = useState([])
  const [employeeSkills, setEmployeeSkills] = useState([])
  const [aiData, setAiData] = useState([]);
  const [isAIDataFetched, setAIDataFetched] = useState(false);
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [errors, setErrors] = useState({
    employees: null,
    skills: null,
    employeeSkills: null,
    certificates: null,
    employeeCertificates: null
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState([])
  const [skillLevelFilter, setSkillLevelFilter] = useState([])
  const [categoryFilter, setCategoryFilter] = useState([])
  const [certificateFilter, setCertificateFilter] = useState([])
  const [skillsFilter, setSkillsFilter] = useState([])
  const [certificatesFilter, setCertificatesFilter] = useState([])
  const [certificateStatusFilter, setCertificateStatusFilter] = useState([])
  const [columnFilter, setColumnFilter] = useState([])
  const [skillsParentCategoryFilter, setSkillsParentCategoryFilter] = useState([])
  const [certificateParentCategoryFilter, setCertificateParentCategoryFilter] = useState([])
  
  // Tab state
  const [activeTab, setActiveTab] = useState('skills-management')
  
  // Filter visibility state
  const [showFilters, setShowFilters] = useState(false)
  const [showAIFilter, setShowAIFilter] = useState(false)
  
  // Skills Matrix tab filter states
  const [showSkillsMatrixFilters, setShowSkillsMatrixFilters] = useState(false)
  const [skillsMatrixSearchTerm, setSkillsMatrixSearchTerm] = useState('')
  const [skillsMatrixSkillsSearchTerm, setSkillsMatrixSkillsSearchTerm] = useState('')
  const [skillsMatrixDepartmentFilter, setSkillsMatrixDepartmentFilter] = useState([])
  const [skillsMatrixLocationFilter, setSkillsMatrixLocationFilter] = useState([])
  const [skillsMatrixSkillsParentCategoryFilter, setSkillsMatrixSkillsParentCategoryFilter] = useState([])
  const [skillsMatrixSkillsFilter, setSkillsMatrixSkillsFilter] = useState([])
  const [skillsMatrixSkillLevelFilter, setSkillsMatrixSkillLevelFilter] = useState([])
  const [skillsMatrixCertifiedFilter, setSkillsMatrixCertifiedFilter] = useState('All')
  const [skillsMatrixStatusFilter, setSkillsMatrixStatusFilter] = useState(['Active'])
  const [skillsMatrixAssignStatusFilter, setSkillsMatrixAssignStatusFilter] = useState('All')
  
  // Certificate Matrix tab filter states
  const [showCertificateMatrixFilters, setShowCertificateMatrixFilters] = useState(false)
  const [certificateMatrixSearchTerm, setCertificateMatrixSearchTerm] = useState('')
  const [certificateMatrixCertificatesSearchTerm, setCertificateMatrixCertificatesSearchTerm] = useState('')
  const [certificateMatrixDepartmentFilter, setCertificateMatrixDepartmentFilter] = useState([])
  const [certificateMatrixLocationFilter, setCertificateMatrixLocationFilter] = useState([])
  const [certificateMatrixCertificateParentCategoryFilter, setCertificateMatrixCertificateParentCategoryFilter] = useState([])
  const [certificateMatrixCertificatesFilter, setCertificateMatrixCertificatesFilter] = useState([])
  const [certificateMatrixCertificateStatusFilter, setCertificateMatrixCertificateStatusFilter] = useState([])
  const [certificateMatrixStatusFilter, setCertificateMatrixStatusFilter] = useState(['Active'])
  const [certificateMatrixAssignStatusFilter, setCertificateMatrixAssignStatusFilter] = useState('All')
  
  // Skills Management tab states
  const [skillSearchTerm, setSkillSearchTerm] = useState('')
  const [parentSkillFilter, setParentSkillFilter] = useState('All Categories')
  const [viewMode, setViewMode] = useState('grid') // 'grid' or 'list'
  const [showSkillsManagementFilters, setShowSkillsManagementFilters] = useState(false)
  const [skillsManagementParentCategoryFilter, setSkillsManagementParentCategoryFilter] = useState([])
  const [skillsManagementSkillCategoryFilter, setSkillsManagementSkillCategoryFilter] = useState([])
  
  const [certificateSearchTerm, setCertificateSearchTerm] = useState('')
  const [certificateCategoryFilter, setCertificateCategoryFilter] = useState('All Categories')
  const [certificateDifficultyFilter, setCertificateDifficultyFilter] = useState('All Difficulties')
  const [certificateViewMode, setCertificateViewMode] = useState('grid') // 'grid' or 'list'
  const [showCertificateManagementFilters, setShowCertificateManagementFilters] = useState(false)
  const [certificateManagementParentCategoryFilter, setCertificateManagementParentCategoryFilter] = useState([])
  const [certificateManagementDifficultyFilter, setCertificateManagementDifficultyFilter] = useState([])
  
  // Accordion states for skill categories
  const [accordionState, setAccordionState] = useState({
    hardSkills: true,
    softSkills: true,
    certificatesList: true
  })
  
  // Modal states
  const [showSkillModal, setShowSkillModal] = useState(false)
  const [showEmployeeSkillModal, setShowEmployeeSkillModal] = useState(false)
  const [showMultiAllocSkillModal, setShowMultiAllocSkillModal] = useState(false)
  const [showMultiAllocCertificateModal, setShowMultiAllocCertificateModal] = useState(false)
  const [showCertificateManagementModal, setShowCertificateManagementModal] = useState(false)
  
  // Track SearchableSelect dropdown states for modals
  const [showSkillParentCategoryDropdown, setShowSkillParentCategoryDropdown] = useState(false)
  const [showCertificateCategoryDropdown, setShowCertificateCategoryDropdown] = useState(false)
  const [editingSkill, setEditingSkill] = useState(null)
  const [editingEmployeeSkill, setEditingEmployeeSkill] = useState(null)
  const [editingCertificate, setEditingCertificate] = useState(null)
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [selectedSkill, setSelectedSkill] = useState(null)
  const [isMatrixCellClick, setIsMatrixCellClick] = useState(false)
  
  // Loading states
  const [isCreatingSkill, setIsCreatingSkill] = useState(false)
  const [isUpdatingSkill, setIsUpdatingSkill] = useState(false)
  const [isCreatingEmployeeSkill, setIsCreatingEmployeeSkill] = useState(false)
  const [isUpdatingEmployeeSkill, setIsUpdatingEmployeeSkill] = useState(false)
  const [isDeletingEmployeeSkill, setIsDeletingEmployeeSkill] = useState(false)
  const [isCreatingMultiAllocSkill, setIsCreatingMultiAllocSkill] = useState(false)
  const [isCreatingMultiAllocCertificate, setIsCreatingMultiAllocCertificate] = useState(false)
  const [isCreatingCertificate, setIsCreatingCertificate] = useState(false)
  const [isUpdatingCertificate, setIsUpdatingCertificate] = useState(false)
  const [isUpdatingCertificateSelection, setIsUpdatingCertificateSelection] = useState({})
  
  // Custom popup state
  const [showCustomAlert, setShowCustomAlert] = useState(false)
  const [alertMessage, setAlertMessage] = useState('')
  const [alertTitle, setAlertTitle] = useState('')
  
  // Form states
  const [skillForm, setSkillForm] = useState({
    skill_name: '',
    skill_category: 'Technical Skill',
    parent_skill: 'Web Development',
    custom_parent_skill: ''
  })
  const [employeeSkillForm, setEmployeeSkillForm] = useState({
    emp_id: '',
    skill_id: '',
    proficiency_level: 'Beginner',
    certified: false,
    certification_name: '',
    last_assessed: '',
    selected_certification: '',
    custom_certification_name: '',
    start_date: '',
    expiry_date: '',
    description_note: ''
  })
  
  // Multi-allocation form state
  const [multiAllocSkillForm, setMultiAllocSkillForm] = useState({
    emp_ids: [],
    skill_id: '',
    proficiency_level: 'Beginner',
    certified: false,
    certification_name: '',
    last_assessed: '',
    selected_certification: '',
    custom_certification_name: '',
    start_date: '',
    expiry_date: '',
    description_note: ''
  })
  
  // Multi-allocation skill form validation errors
  const [multiAllocSkillErrors, setMultiAllocSkillErrors] = useState({
    emp_ids: '',
    skill_id: '',
    proficiency_level: ''
  })
  
  // Multi-allocation certificate form state
  const [multiAllocCertificateForm, setMultiAllocCertificateForm] = useState({
    emp_ids: [],
    certificate_id: '',
    status: 'In-Progress',
    start_date: '',
    expiry_date: ''
  })
  
  // Multi-allocation certificate form validation errors
  const [multiAllocCertificateErrors, setMultiAllocCertificateErrors] = useState({
    emp_ids: '',
    certificate_id: '',
    status: ''
  })
  
  // Duplicate assignment alerts for multi-allocation
  const [multiAllocSkillAlert, setMultiAllocSkillAlert] = useState({
    show: false,
    message: '',
    type: 'info' // 'info', 'warning', 'error'
  })
  
  const [multiAllocCertificateAlert, setMultiAllocCertificateAlert] = useState({
    show: false,
    message: '',
    type: 'info' // 'info', 'warning', 'error'
  })
  
  // Multi-select employee dropdown state
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false)
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState('')
  
  // Skill dropdown state
  const [showSkillDropdown, setShowSkillDropdown] = useState(false)
  const [multiAllocSkillSearchTerm, setMultiAllocSkillSearchTerm] = useState('')
  
  // Multi-allocate certificate dropdown states
  const [showMultiAllocEmployeeDropdown, setShowMultiAllocEmployeeDropdown] = useState(false)
  const [multiAllocEmployeeSearchTerm, setMultiAllocEmployeeSearchTerm] = useState('')
  const [showMultiAllocCertificateDropdown, setShowMultiAllocCertificateDropdown] = useState(false)
  const [multiAllocCertificateSearchTerm, setMultiAllocCertificateSearchTerm] = useState('')

  const TABLE_VIEW_MAPPING = {
    'skills-management' : 'skills',
    'certificate-management' : 'certificate_management',
    'learning-management' : 'learning_management',
    'learning-and-training' : 'learning_and_training',
  }

  const AI_FILER_ENABLED_VIEW  = Object.keys(TABLE_VIEW_MAPPING); 
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showEmployeeDropdown && !event.target.closest('.employee-dropdown-container')) {
        setShowEmployeeDropdown(false)
      }
      if (showSkillDropdown && !event.target.closest('.skill-dropdown-container')) {
        setShowSkillDropdown(false)
      }
      if (showMultiAllocEmployeeDropdown && !event.target.closest('.multi-alloc-employee-dropdown-container')) {
        setShowMultiAllocEmployeeDropdown(false)
      }
      if (showMultiAllocCertificateDropdown && !event.target.closest('.multi-alloc-certificate-dropdown-container')) {
        setShowMultiAllocCertificateDropdown(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showEmployeeDropdown, showSkillDropdown, showMultiAllocEmployeeDropdown, showMultiAllocCertificateDropdown])
  
  
  // Certificate management form state
  const [certificateManagementForm, setCertificateManagementForm] = useState({
    certificate_name: '',
    certificate_category: 'Web Development',
    difficulty_level: '',
    issued_by: '',
    custom_parent_category: ''
  })
  
  // Certificates state - loaded from API
  const [certificates, setCertificates] = useState([])
  
  // Dynamic parent categories state
  const [parentSkillCategories, setParentSkillCategories] = useState([])
  const [parentCertificateCategories, setParentCertificateCategories] = useState([])
  
  // Employee certificates state for matrix
  const [employeeCertificates, setEmployeeCertificates] = useState({})
  const [employeeCertificateAssignments, setEmployeeCertificateAssignments] = useState([])
  
  // Certificate status management states
  const [showCertificateStatusModal, setShowCertificateStatusModal] = useState(false)
  const [editingCertificateStatus, setEditingCertificateStatus] = useState(null)
  const [selectedCertificate, setSelectedCertificate] = useState(null)
  const [isUpdatingCertificateStatus, setIsUpdatingCertificateStatus] = useState(false)
  const [isCreatingCertificateStatus, setIsCreatingCertificateStatus] = useState(false)
  const [isDeletingCertificateStatus, setIsDeletingCertificateStatus] = useState(false)
  
  // Certificate status form state
  const [certificateStatusForm, setCertificateStatusForm] = useState({
    emp_id: '',
    certificate_id: '',
    status: 'In-Progress',
    start_date: '',
    expiry_date: ''
  })
  
  // Import modal states
  const [showImportSelectionModal, setShowImportSelectionModal] = useState(false)
  const [showCertificateBulkImport, setShowCertificateBulkImport] = useState(false)
  const [showSkillsBulkImport, setShowSkillsBulkImport] = useState(false)
  

  // Fetch parent categories dynamically
  const fetchParentCategories = async () => {
    try {
      // Fetch skill parent categories
      const skillCategoriesResponse = await apiClient.get('/api/skills/parent-categories')
      setParentSkillCategories(skillCategoriesResponse.data.parent_categories || [])
      
      // Fetch certificate parent categories
      const certificateCategoriesResponse = await apiClient.get('/api/certificates/parent-categories')
      setParentCertificateCategories(certificateCategoriesResponse.data.parent_categories || [])
    } catch (err) {
      console.error('Error fetching parent categories:', err)
    }
  }

  // Refresh parent categories after deletion to handle auto-cleanup
  const refreshParentCategories = async () => {
    await fetchParentCategories()
  }

  useEffect(() => {
    if (user) {
      fetchData()
      fetchParentCategories()
    }
  }, [user])

  // Set default tab based on permissions
  useEffect(() => {
    if (hasPermission) {
      if (hasPermission('view-skills-management')) {
        setActiveTab('skills-management')
      } else if (hasPermission('view-certificate-management')) {
        setActiveTab('certificate-management')
      } else if (hasPermission('view-skills-matrix')) {
        setActiveTab('skills-matrix')
      } else if (hasPermission('view-certificate-matrix')) {
        setActiveTab('certificate-matrix')
      }
    }
  }, [hasPermission])



  // Helper function to retry API calls with exponential backoff
  const retryApiCall = async (apiCall, maxRetries = 2, retryCount = 0) => {
    try {
      return await apiCall()
    } catch (err) {
      const isTimeout = err.code === 'ECONNABORTED' || err.message?.includes('timeout')
      if (isTimeout && retryCount < maxRetries) {
        const delay = Math.pow(2, retryCount) * 1000 // Exponential backoff: 1s, 2s, 4s
        console.log(`Retrying API call in ${delay}ms... (attempt ${retryCount + 1}/${maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, delay))
        return retryApiCall(apiCall, maxRetries, retryCount + 1)
      }
      throw err
    }
  }

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    setErrors({
      employees: null,
      skills: null,
      employeeSkills: null,
      certificates: null,
      employeeCertificates: null
    })
    
    try {
      console.log('Starting data fetch...')
      
      // Fetch all data in parallel with individual error handling and retry logic
      const [employeesResponse, skillsResponse, employeeSkillsResponse, certificatesResponse, employeeCertificatesResponse] = await Promise.allSettled([
        retryApiCall(() => apiClient.get('/api/employees')),
        retryApiCall(() => apiClient.get('/api/skills')),
        retryApiCall(() => apiClient.get('/api/employee-skills')),
        retryApiCall(() => apiClient.get('/api/certificates/management')),
        retryApiCall(() => apiClient.get('/api/certificates/employee-certificates'))
      ])
      
      // Handle employees response
      if (employeesResponse.status === 'fulfilled') {
        console.log('Fetched employees:', employeesResponse.value.data.employees?.length || 0, 'employees')
        setEmployees(employeesResponse.value.data.employees || [])
        setErrors(prev => ({ ...prev, employees: null }))
      } else {
        const errorMsg = employeesResponse.reason?.code === 'ECONNABORTED' 
          ? 'Request timed out. Please try again.' 
          : 'Failed to load employees data'
        console.error('Failed to fetch employees:', employeesResponse.reason)
        setErrors(prev => ({ ...prev, employees: errorMsg }))
      }
      
      // Handle skills response
      if (skillsResponse.status === 'fulfilled') {
        console.log('Fetched skills:', skillsResponse.value.data.skills?.length || 0, 'skills')
        setSkills(skillsResponse.value.data.skills || [])
        setErrors(prev => ({ ...prev, skills: null }))
      } else {
        const errorMsg = skillsResponse.reason?.code === 'ECONNABORTED' 
          ? 'Request timed out. Please try again.' 
          : 'Failed to load skills data'
        console.error('Failed to fetch skills:', skillsResponse.reason)
        setErrors(prev => ({ ...prev, skills: errorMsg }))
      }
      
      // Handle employee skills response
      if (employeeSkillsResponse.status === 'fulfilled') {
        console.log('Fetched employee skills:', employeeSkillsResponse.value.data.employee_skills?.length || 0, 'employee skills')
        setEmployeeSkills(employeeSkillsResponse.value.data.employee_skills || [])
        setErrors(prev => ({ ...prev, employeeSkills: null }))
      } else {
        const errorMsg = employeeSkillsResponse.reason?.code === 'ECONNABORTED' 
          ? 'Request timed out. Please try again.' 
          : 'Failed to load employee skills data'
        console.error('Failed to fetch employee skills:', employeeSkillsResponse.reason)
        setErrors(prev => ({ ...prev, employeeSkills: errorMsg }))
      }
      
      // Handle certificates response
      if (certificatesResponse.status === 'fulfilled') {
        console.log('Fetched certificates:', certificatesResponse.value.data.certificates?.length || 0, 'certificates')
        setCertificates(certificatesResponse.value.data.certificates || [])
        setErrors(prev => ({ ...prev, certificates: null }))
      } else {
        const errorMsg = certificatesResponse.reason?.code === 'ECONNABORTED' 
          ? 'Request timed out. Please try again.' 
          : 'Failed to load certificates data'
        console.error('Failed to fetch certificates:', certificatesResponse.reason)
        setErrors(prev => ({ ...prev, certificates: errorMsg }))
      }
      
      // Handle employee certificates response
      if (employeeCertificatesResponse.status === 'fulfilled') {
        console.log('Fetched employee certificates:', employeeCertificatesResponse.value.data.employee_certificates?.length || 0, 'assignments')
        const assignments = employeeCertificatesResponse.value.data.employee_certificates || []
        console.log('Employee certificate assignments data:', assignments)
        setEmployeeCertificateAssignments(assignments)
        
        // Convert assignments to the format expected by the matrix (for backward compatibility)
        const certificateMap = {}
        assignments.forEach(assignment => {
          if (!certificateMap[assignment.emp_id]) {
            certificateMap[assignment.emp_id] = {}
          }
          certificateMap[assignment.emp_id][assignment.certificate_id] = true
        })
        setEmployeeCertificates(certificateMap)
        setErrors(prev => ({ ...prev, employeeCertificates: null }))
      } else {
        const errorMsg = employeeCertificatesResponse.reason?.code === 'ECONNABORTED' 
          ? 'Request timed out. Please try again.' 
          : 'Failed to load employee certificates data'
        console.error('Failed to fetch employee certificates:', employeeCertificatesResponse.reason)
        setErrors(prev => ({ ...prev, employeeCertificates: errorMsg }))
      }
      
      console.log('Data fetch completed')
      
    } catch (err) {
      console.error('Error fetching data:', err)
      setError('Failed to load data: ' + (err.message || 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  // Custom alert functions
  const showCustomAlertPopup = (title, message) => {
    setAlertTitle(title)
    setAlertMessage(message)
    setShowCustomAlert(true)
  }

  const closeCustomAlert = () => {
    setShowCustomAlert(false)
    setAlertMessage('')
    setAlertTitle('')
  }
  
  // Clear multi-allocation alerts
  const clearMultiAllocSkillAlert = () => {
    setMultiAllocSkillAlert({
      show: false,
      message: '',
      type: 'info'
    })
  }
  
  const clearMultiAllocCertificateAlert = () => {
    setMultiAllocCertificateAlert({
      show: false,
      message: '',
      type: 'info'
    })
  }

  // Skill management functions
  const handleCreateSkill = async (e) => {
    e.preventDefault()
    if (isCreatingSkill) return // Prevent multiple submissions
    
    try {
      setIsCreatingSkill(true)
      
      // Check for duplicate skill name
      const existingSkill = skills.find(skill => 
        skill.skill_name.toLowerCase() === skillForm.skill_name.toLowerCase()
      )
      
      if (existingSkill) {
        showCustomAlertPopup('Duplicate Skill', `Skill "${skillForm.skill_name}" already exists!`)
        return
      }
      
      // Determine parent skill - use custom if provided, otherwise use selected or default to "Others"
      const parentSkill = skillForm.parent_skill === 'Others' && skillForm.custom_parent_skill.trim() 
        ? skillForm.custom_parent_skill.trim() 
        : skillForm.parent_skill || 'Others'
      
      const skillData = {
        ...skillForm,
        parent_skill: parentSkill
      }
      
      const response = await apiClient.post('/api/skills', skillData)
      setSkills([...skills, response.data.skill])
      setSkillForm({ skill_name: '', skill_category: 'Technical Skill', parent_skill: 'Web Development', custom_parent_skill: '' })
      setShowSkillModal(false)
      // Refresh parent categories to show new parent category if created
      await refreshParentCategories()
    } catch (err) {
      console.error('Error creating skill:', err)
      const errorMessage = err.response?.data?.error || err.message || 'Failed to create skill'
      setError(errorMessage)
    } finally {
      setIsCreatingSkill(false)
    }
  }

  const handleUpdateSkill = async (e) => {
    e.preventDefault()
    if (isUpdatingSkill) return // Prevent multiple submissions
    
    try {
      setIsUpdatingSkill(true)
      
      // Check for duplicate skill name (excluding current skill)
      const existingSkill = skills.find(skill => 
        skill.skill_name.toLowerCase() === skillForm.skill_name.toLowerCase() &&
        skill.skill_id !== editingSkill.skill_id
      )
      
      if (existingSkill) {
        showCustomAlertPopup('Duplicate Skill', `Skill "${skillForm.skill_name}" already exists!`)
        return
      }
      
      // Determine parent skill - use custom if provided, otherwise use selected or default to "Others"
      const parentSkill = skillForm.parent_skill === 'Others' && skillForm.custom_parent_skill.trim() 
        ? skillForm.custom_parent_skill.trim() 
        : skillForm.parent_skill || 'Others'
      
      const skillData = {
        ...skillForm,
        parent_skill: parentSkill
      }
      
      const response = await apiClient.put(`/api/skills/${editingSkill.skill_id}`, skillData)
      console.log('Skill updated successfully:', response.data)
      setSkills(skills.map(skill => 
        skill.skill_id === editingSkill.skill_id ? response.data.skill : skill
      ))
      setEditingSkill(null)
      setSkillForm({ skill_name: '', skill_category: 'Technical Skill', parent_skill: 'Web Development', custom_parent_skill: '' })
      setShowSkillModal(false)
      // Refresh parent categories to show new parent category if created
      await refreshParentCategories()
    } catch (err) {
      console.error('Error updating skill:', err)
      const errorMessage = err.response?.data?.error || err.message || 'Failed to update skill'
      setError(errorMessage)
    } finally {
      setIsUpdatingSkill(false)
    }
  }

  const handleDeleteSkill = async (skillId) => {
    if (window.confirm('Are you sure you want to delete this skill?')) {
      try {
        await apiClient.delete(`/api/skills/${skillId}`)
        setSkills(skills.filter(skill => skill.skill_id !== skillId))
        setEmployeeSkills(employeeSkills.filter(es => es.skill_id !== skillId))
        // Refresh parent categories to handle auto-cleanup
        await refreshParentCategories()
      } catch (err) {
        console.error('Error deleting skill:', err)
        
        // Check if it's a skill allocation error
        if (err.response?.data?.code === 'SKILL_ALLOCATED_TO_EMPLOYEES') {
          const errorMessage = err.response.data.error
          const allocatedCount = err.response.data.allocated_count
          const skillName = err.response.data.skill_name
          
          // Show a user-friendly popup message
          showCustomAlertPopup(
            'Cannot Delete Skill', 
            `Cannot delete skill "${skillName}" because it is allocated to ${allocatedCount} employee(s).\n\nPlease remove this skill from all employees first before deleting it.`
          )
        } else {
          // Generic error for other cases
          setError('Failed to delete skill')
        }
      }
    }
  }

  // Certificate management functions
  const handleCreateCertificate = async (e) => {
    e.preventDefault()
    if (isCreatingCertificate) return // Prevent multiple submissions
    
    console.log('Form submitted with data:', certificateManagementForm)
    
    try {
      setIsCreatingCertificate(true)
      
      // Check for duplicate certificate name
      const existingCertificate = certificates.find(cert => 
        cert.certificate_name.toLowerCase() === certificateManagementForm.certificate_name.toLowerCase()
      )
      
      if (existingCertificate) {
        showCustomAlertPopup('Duplicate Certificate', `Certificate "${certificateManagementForm.certificate_name}" already exists!`)
        return
      }
      
      // Determine certificate category - use custom if provided, otherwise use selected
      const certificateCategory = certificateManagementForm.certificate_category === 'Others' && certificateManagementForm.custom_parent_category.trim() 
        ? certificateManagementForm.custom_parent_category.trim() 
        : certificateManagementForm.certificate_category
      
      const certificateData = {
        ...certificateManagementForm,
        certificate_category: certificateCategory
      }
      
      // Remove empty date fields to avoid database errors
      if (!certificateData.issue_date || certificateData.issue_date.trim() === '') {
        delete certificateData.issue_date
      }
      if (!certificateData.expiry_date || certificateData.expiry_date.trim() === '') {
        delete certificateData.expiry_date
      }
      
      console.log('Sending certificate data:', certificateData)
      const response = await apiClient.post('/api/certificates/management', certificateData)
      setCertificates([...certificates, response.data.certificate])
      setCertificateManagementForm({
        certificate_name: '',
        certificate_category: 'Web Development',
        difficulty_level: '',
        issued_by: '',
        custom_parent_category: ''
      })
      setShowCertificateManagementModal(false)
      // Refresh parent categories to show new parent category if created
      await refreshParentCategories()
    } catch (err) {
      console.error('Error creating certificate:', err)
      const errorMessage = err.response?.data?.error || err.message || 'Failed to create certificate'
      setError(errorMessage)
    } finally {
      setIsCreatingCertificate(false)
    }
  }

  const handleUpdateCertificate = async (e) => {
    e.preventDefault()
    if (isUpdatingCertificate) return // Prevent multiple submissions
    
    try {
      setIsUpdatingCertificate(true)
      
      // Check for duplicate certificate name (excluding current certificate)
      const existingCertificate = certificates.find(cert => 
        cert.certificate_name.toLowerCase() === certificateManagementForm.certificate_name.toLowerCase() &&
        cert.certificate_id !== editingCertificate.certificate_id
      )
      
      if (existingCertificate) {
        showCustomAlertPopup('Duplicate Certificate', `Certificate "${certificateManagementForm.certificate_name}" already exists!`)
        return
      }
      
      // Determine certificate category - use custom if provided, otherwise use selected
      const certificateCategory = certificateManagementForm.certificate_category === 'Others' && certificateManagementForm.custom_parent_category.trim() 
        ? certificateManagementForm.custom_parent_category.trim() 
        : certificateManagementForm.certificate_category
      
      const certificateData = {
        ...certificateManagementForm,
        certificate_category: certificateCategory
      }
      
      // Remove empty date fields to avoid database errors
      if (!certificateData.issue_date || certificateData.issue_date.trim() === '') {
        delete certificateData.issue_date
      }
      if (!certificateData.expiry_date || certificateData.expiry_date.trim() === '') {
        delete certificateData.expiry_date
      }
      
      const response = await apiClient.put(`/api/certificates/management/${editingCertificate.certificate_id}`, certificateData)
      setCertificates(certificates.map(cert => 
        cert.certificate_id === editingCertificate.certificate_id ? response.data.certificate : cert
      ))
      setEditingCertificate(null)
      setCertificateManagementForm({
        certificate_name: '',
        certificate_category: 'Web Development',
        difficulty_level: '',
        issued_by: '',
        custom_parent_category: ''
      })
      setShowCertificateManagementModal(false)
      // Refresh parent categories to show new parent category if created
      await refreshParentCategories()
    } catch (err) {
      console.error('Error updating certificate:', err)
      const errorMessage = err.response?.data?.error || err.message || 'Failed to update certificate'
      setError(errorMessage)
    } finally {
      setIsUpdatingCertificate(false)
    }
  }

  const handleDeleteCertificateManagement = async (certificateId) => {
    if (window.confirm('Are you sure you want to delete this certificate?')) {
      try {
        await apiClient.delete(`/api/certificates/management/${certificateId}`)
        setCertificates(certificates.filter(cert => cert.certificate_id !== certificateId))
        // Refresh parent categories to handle auto-cleanup
        await refreshParentCategories()
      } catch (err) {
        console.error('Error deleting certificate:', err)
        
        // Check if it's a certificate assignment error
        if (err.response?.data?.code === 'CERTIFICATE_ASSIGNED_TO_EMPLOYEES') {
          const errorMessage = err.response.data.error
          const assignedCount = err.response.data.assigned_count
          const certificateName = err.response.data.certificate_name
          
          // Show a user-friendly popup message
          showCustomAlertPopup(
            'Cannot Delete Certificate', 
            `Cannot delete certificate "${certificateName}" because it is assigned to ${assignedCount} employee(s).\n\nPlease remove this certificate from all employees first before deleting it.`
          )
        } else {
          // Generic error for other cases
          setError('Failed to delete certificate')
        }
      }
    }
  }

  // Get current user's employee ID
  const getCurrentUserEmployeeId = () => {
    if (!user?.email) return null
    const currentUserEmployee = employees.find(emp => emp.email === user.email)
    return currentUserEmployee?.id || null
  }

  // Check if user can edit a specific employee's skills/certificates
  const canEditEmployee = (employeeId) => {
    // If user has matrix-table-cells permission, they can edit anyone
    if (hasPermission('matrix-table-cells')) {
      return true
    }
    
    // If user has myprofile-edit permission, they can only edit their own profile
    if (hasPermission('myprofile-edit')) {
      const currentUserEmployeeId = getCurrentUserEmployeeId()
      return currentUserEmployeeId !== null && currentUserEmployeeId === employeeId
    }
    
    // Otherwise, cannot edit
    return false
  }

  // Handle certificate cell click in matrix
  const handleCertificateCellClick = (employee, certificate) => {
    // Check permission before allowing click
    if (!canEditEmployee(employee.id)) {
      return
    }
    
    setSelectedEmployee(employee)
    setSelectedCertificate(certificate)
    setError(null) // Clear any previous errors
    
    // Find existing certificate status
    const existingStatus = employeeCertificateAssignments.find(assignment => 
      assignment.emp_id === employee.id && assignment.certificate_id === certificate.certificate_id
    )
    
    if (existingStatus) {
      setEditingCertificateStatus(existingStatus)
      setCertificateStatusForm({
        emp_id: existingStatus.emp_id,
        certificate_id: existingStatus.certificate_id,
        status: existingStatus.status || 'In-Progress',
        start_date: existingStatus.start_date || '',
        expiry_date: existingStatus.expiry_date || ''
      })
    } else {
      setEditingCertificateStatus(null)
      setCertificateStatusForm({
        emp_id: employee.id,
        certificate_id: certificate.certificate_id,
        status: 'In-Progress',
        start_date: '',
        expiry_date: ''
      })
    }
    
    setError(null) // Clear any previous errors
    setIsCreatingCertificateStatus(false)
    setIsUpdatingCertificateStatus(false)
    setIsDeletingCertificateStatus(false)
    setShowCertificateStatusModal(true)
  }

  // Handle certificate status creation/update
  const handleCertificateStatusSubmit = async (e) => {
    e.preventDefault()
    if (isCreatingCertificateStatus || isUpdatingCertificateStatus) return
    
    try {
      // Check permission before creating or updating
      const employeeId = editingCertificateStatus ? editingCertificateStatus.emp_id : certificateStatusForm.emp_id
      if (!canEditEmployee(parseInt(employeeId))) {
        setError('You do not have permission to edit this employee\'s certificates')
        return
      }
      
      if (editingCertificateStatus) {
        setIsUpdatingCertificateStatus(true)
        
        const response = await apiClient.put(`/api/certificates/employee-certificates/${editingCertificateStatus.id}`, certificateStatusForm)
        
        // Update local state
        setEmployeeCertificateAssignments(prev => 
          prev.map(assignment => 
            assignment.id === editingCertificateStatus.id ? response.data.certificate_status : assignment
          )
        )
        
        setEditingCertificateStatus(null)
      } else {
        setIsCreatingCertificateStatus(true)
        
        const response = await apiClient.post('/api/certificates/employee-certificates', certificateStatusForm)
        
        // Add to local state
        setEmployeeCertificateAssignments(prev => [...prev, response.data.certificate_status])
      }
      
      setCertificateStatusForm({
        emp_id: '',
        certificate_id: '',
        status: 'In-Progress',
        start_date: '',
        expiry_date: ''
      })
      setShowCertificateStatusModal(false)
    } catch (err) {
      console.error('Error updating certificate status:', err)
      const errorMessage = err.response?.data?.error || err.message || 'Failed to update certificate status'
      setError(errorMessage)
    } finally {
      setIsCreatingCertificateStatus(false)
      setIsUpdatingCertificateStatus(false)
    }
  }

  // Handle certificate status deletion
  const handleDeleteCertificateStatus = async () => {
    if (!editingCertificateStatus) return
    
    // Check permission before deleting
    if (!canEditEmployee(parseInt(editingCertificateStatus.emp_id))) {
      setError('You do not have permission to delete this employee\'s certificates')
      return
    }
    
    if (window.confirm('Are you sure you want to delete this certificate status?')) {
      try {
        setIsDeletingCertificateStatus(true)
        setError(null) // Clear any previous errors
        
        await apiClient.delete(`/api/certificates/employee-certificates/${editingCertificateStatus.id}`)
        
        // Remove from local state
        setEmployeeCertificateAssignments(prev => 
          prev.filter(assignment => assignment.id !== editingCertificateStatus.id)
        )
        
        setShowCertificateStatusModal(false)
        setEditingCertificateStatus(null)
      } catch (err) {
        console.error('Error deleting certificate status:', err)
        const errorMessage = err.response?.data?.error || err.message || 'Failed to delete certificate status'
        setError(errorMessage)
      } finally {
        setIsDeletingCertificateStatus(false)
      }
    }
  }

  // Get certificate status for display
  const getCertificateStatus = (employeeId, certificateId) => {
    return employeeCertificateAssignments.find(assignment => 
      assignment.emp_id === employeeId && assignment.certificate_id === certificateId
    )
  }

  // Employee skill management functions
  const handleCreateEmployeeSkill = async (e) => {
    e.preventDefault()
    if (isCreatingEmployeeSkill) return // Prevent multiple submissions
    
    try {
      setIsCreatingEmployeeSkill(true)
      setError(null) // Clear any previous errors
      
      // Validate required fields
      if (!employeeSkillForm.emp_id || !employeeSkillForm.skill_id) {
        setError('Please select both employee and skill')
        setIsCreatingEmployeeSkill(false)
        return
      }
      
      // Check permission before creating
      if (!canEditEmployee(parseInt(employeeSkillForm.emp_id))) {
        setError('You do not have permission to edit this employee\'s skills')
        setIsCreatingEmployeeSkill(false)
        return
      }
      
      // Use certification_name directly from the form (which may have been edited by the user)
      // This ensures that any manual edits to the certification name field are saved
      const certificationName = employeeSkillForm.certification_name || 
        (employeeSkillForm.selected_certification === 'Others' 
          ? employeeSkillForm.custom_certification_name 
          : employeeSkillForm.selected_certification)
      
      // Prepare data for API
      const skillData = {
        emp_id: parseInt(employeeSkillForm.emp_id),
        skill_id: parseInt(employeeSkillForm.skill_id),
        proficiency_level: employeeSkillForm.proficiency_level,
        certified: Boolean(employeeSkillForm.certified),
        certification_name: certificationName || null,
        last_assessed: employeeSkillForm.last_assessed || null,
        start_date: employeeSkillForm.start_date || null,
        expiry_date: employeeSkillForm.expiry_date || null,
        description_note: employeeSkillForm.description_note || null
      }
      
      console.log('Sending employee skill data:', skillData)
      console.log('Available employees:', employees.map(e => ({id: e.id, name: `${e.first_name} ${e.last_name}`})))
      console.log('Available skills:', skills.map(s => ({id: s.skill_id, name: s.skill_name})))
      const response = await apiClient.post('/api/employee-skills', skillData)
      console.log('Employee skill created successfully:', response.data)
      
      // Add the new employee skill to the state
      setEmployeeSkills([...employeeSkills, response.data.employee_skill])
      
      setEmployeeSkillForm({
        emp_id: '',
        skill_id: '',
        proficiency_level: 'Beginner',
        certified: false,
        certification_name: '',
        last_assessed: '',
        selected_certification: '',
        custom_certification_name: '',
        start_date: '',
        expiry_date: '',
        description_note: ''
      })
      setShowEmployeeSkillModal(false)
    } catch (err) {
      console.error('Error creating employee skill:', err)
      console.error('Error response:', err.response?.data)
      const errorMessage = err.response?.data?.error || err.message || 'Failed to create employee skill'
      setError(errorMessage)
      
      // If it's a validation error, show available options
      if (err.response?.data?.available_employees) {
        console.log('Available employees:', err.response.data.available_employees)
      }
      if (err.response?.data?.available_skills) {
        console.log('Available skills:', err.response.data.available_skills)
      }
    } finally {
      setIsCreatingEmployeeSkill(false)
    }
  }

  const handleUpdateEmployeeSkill = async (e) => {
    e.preventDefault()
    if (isUpdatingEmployeeSkill) return // Prevent multiple submissions
    
    try {
      setIsUpdatingEmployeeSkill(true)
      setError(null) // Clear any previous errors
      
      // Validate required fields
      if (!employeeSkillForm.emp_id || !employeeSkillForm.skill_id) {
        setError('Please select both employee and skill')
        setIsUpdatingEmployeeSkill(false)
        return
      }
      
      // Check permission before updating
      if (!canEditEmployee(parseInt(employeeSkillForm.emp_id))) {
        setError('You do not have permission to edit this employee\'s skills')
        setIsUpdatingEmployeeSkill(false)
        return
      }
      
      // Use certification_name directly from the form (which may have been edited by the user)
      // This ensures that any manual edits to the certification name field are saved
      const certificationName = employeeSkillForm.certification_name || 
        (employeeSkillForm.selected_certification === 'Others' 
          ? employeeSkillForm.custom_certification_name 
          : employeeSkillForm.selected_certification)
      
      // Prepare data for API
      const skillData = {
        emp_id: parseInt(employeeSkillForm.emp_id),
        skill_id: parseInt(employeeSkillForm.skill_id),
        proficiency_level: employeeSkillForm.proficiency_level,
        certified: Boolean(employeeSkillForm.certified),
        certification_name: certificationName || null,
        last_assessed: employeeSkillForm.last_assessed || null,
        start_date: employeeSkillForm.start_date || null,
        expiry_date: employeeSkillForm.expiry_date || null,
        description_note: employeeSkillForm.description_note || null
      }
      
      const response = await apiClient.put(`/api/employee-skills/${editingEmployeeSkill.employee_skill_id}`, skillData)
      setEmployeeSkills(employeeSkills.map(es => 
        es.employee_skill_id === editingEmployeeSkill.employee_skill_id ? response.data.employee_skill : es
      ))
      
      setEditingEmployeeSkill(null)
      setEmployeeSkillForm({
        emp_id: '',
        skill_id: '',
        proficiency_level: 'Beginner',
        certified: false,
        certification_name: '',
        last_assessed: '',
        selected_certification: '',
        custom_certification_name: '',
        start_date: '',
        expiry_date: '',
        description_note: ''
      })
      setShowEmployeeSkillModal(false)
    } catch (err) {
      console.error('Error updating employee skill:', err)
      const errorMessage = err.response?.data?.error || err.message || 'Failed to update employee skill'
      setError(errorMessage)
    } finally {
      setIsUpdatingEmployeeSkill(false)
    }
  }

  const handleDeleteEmployeeSkill = async (employeeSkillId) => {
    if (!editingEmployeeSkill) return
    
    // Check permission before deleting
    if (!canEditEmployee(parseInt(editingEmployeeSkill.emp_id))) {
      setError('You do not have permission to delete this employee\'s skills')
      return
    }
    
    if (window.confirm('Are you sure you want to delete this employee skill?')) {
      try {
        setIsDeletingEmployeeSkill(true)
        setError(null) // Clear any previous errors
        
        await apiClient.delete(`/api/employee-skills/${employeeSkillId}`)
        setEmployeeSkills(employeeSkills.filter(es => es.employee_skill_id !== employeeSkillId))
        
        // Close the modal after successful deletion
        setShowEmployeeSkillModal(false)
        setEditingEmployeeSkill(null)
      } catch (err) {
        console.error('Error deleting employee skill:', err)
        const errorMessage = err.response?.data?.error || err.message || 'Failed to delete employee skill'
        setError(errorMessage)
      } finally {
        setIsDeletingEmployeeSkill(false)
      }
    }
  }

  // Multi-allocation skill handler
  const handleCreateMultiAllocSkill = async (e) => {
    e.preventDefault()
    if (isCreatingMultiAllocSkill) return // Prevent multiple submissions
    
    try {
      setIsCreatingMultiAllocSkill(true)
      setError(null) // Clear any previous errors
      
      // Clear previous validation errors
      setMultiAllocSkillErrors({
        emp_ids: '',
        skill_id: '',
        proficiency_level: ''
      })
      
      // Validate required fields with specific error messages
      let hasErrors = false
      const newErrors = {
        emp_ids: '',
        skill_id: '',
        proficiency_level: ''
      }
      
      if (!multiAllocSkillForm.emp_ids.length) {
        newErrors.emp_ids = 'Please select at least one employee'
        hasErrors = true
      }
      
      if (!multiAllocSkillForm.skill_id) {
        newErrors.skill_id = 'Please select a skill'
        hasErrors = true
      }
      
      if (!multiAllocSkillForm.proficiency_level) {
        newErrors.proficiency_level = 'Please select a proficiency level'
        hasErrors = true
      }
      
      if (hasErrors) {
        setMultiAllocSkillErrors(newErrors)
        setIsCreatingMultiAllocSkill(false)
        return
      }
      
      // Determine certification name based on selection
      const certificationName = multiAllocSkillForm.selected_certification === 'Others' 
        ? multiAllocSkillForm.custom_certification_name 
        : multiAllocSkillForm.selected_certification
      
      // Create employee skills for all selected employees
      const promises = multiAllocSkillForm.emp_ids.map(empId => {
        const skillData = {
          emp_id: parseInt(empId),
          skill_id: parseInt(multiAllocSkillForm.skill_id),
          proficiency_level: multiAllocSkillForm.proficiency_level,
          certified: Boolean(multiAllocSkillForm.certified),
          certification_name: certificationName || null,
          last_assessed: multiAllocSkillForm.last_assessed || null,
          start_date: multiAllocSkillForm.start_date || null,
          expiry_date: multiAllocSkillForm.expiry_date || null,
          description_note: multiAllocSkillForm.description_note || null
        }
        
        return apiClient.post('/api/employee-skills', skillData)
      })
      
      console.log('Creating multi-allocation skills for employees:', multiAllocSkillForm.emp_ids)
      const responses = await Promise.all(promises)
      console.log('Multi-allocation skills created successfully:', responses.length, 'skills')
      
      // Add all new employee skills to the state
      const newEmployeeSkills = responses.map(response => response.data.employee_skill)
      setEmployeeSkills([...employeeSkills, ...newEmployeeSkills])
      
      // Reset form and close modal
      setMultiAllocSkillForm({
        emp_ids: [],
        skill_id: '',
        proficiency_level: 'Beginner',
        certified: false,
        certification_name: '',
        last_assessed: '',
        selected_certification: '',
        custom_certification_name: '',
        start_date: '',
        expiry_date: '',
        description_note: ''
      })
      setShowMultiAllocSkillModal(false)
      // Clear any alerts when closing modal
      clearMultiAllocSkillAlert()
    } catch (err) {
      console.error('Error creating multi-allocation skills:', err)
      console.error('Error response:', err.response?.data)
      
      // Check for duplicate assignment errors
      if (err.response?.data?.code === 'DUPLICATE_EMPLOYEE_SKILL') {
        const duplicateMessage = err.response?.data?.error || 'Some employees already have this skill assigned'
        setMultiAllocSkillAlert({
          show: true,
          message: duplicateMessage,
          type: 'warning'
        })
        // Don't set the general error, just show the alert
      } else {
        const errorMessage = err.response?.data?.error || err.message || 'Failed to create multi-allocation skills'
        setError(errorMessage)
      }
    } finally {
      setIsCreatingMultiAllocSkill(false)
    }
  }

  // Get employee skill for a specific employee and skill
  const getEmployeeSkill = (employeeId, skillId) => {
    return employeeSkills.find(es => es.emp_id === employeeId && es.skill_id === skillId)
  }

  // Multi-select employee helper functions
  const filteredEmployeesForMultiSelect = employees.filter(emp => {
    // Filter to show only active employees
    const isActive = (emp.employee_status || 'Active') === 'Active'
    if (!isActive) return false
    
    const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase()
    const designation = emp.designation.toLowerCase()
    const searchTerm = employeeSearchTerm.toLowerCase()
    return fullName.includes(searchTerm) || designation.includes(searchTerm)
  })

  const handleEmployeeToggle = (empId) => {
    setMultiAllocSkillForm(prev => ({
      ...prev,
      emp_ids: prev.emp_ids.includes(empId)
        ? prev.emp_ids.filter(id => id !== empId)
        : [...prev.emp_ids, empId]
    }))
    
    // Clear validation error when user selects employees
    if (multiAllocSkillErrors.emp_ids) {
      setMultiAllocSkillErrors(prev => ({
        ...prev,
        emp_ids: ''
      }))
    }
  }

  const handleSelectAllEmployees = () => {
    const allFilteredIds = filteredEmployeesForMultiSelect.map(emp => emp.id)
    setMultiAllocSkillForm(prev => ({
      ...prev,
      emp_ids: allFilteredIds
    }))
    
    // Clear validation error when user selects all employees
    if (multiAllocSkillErrors.emp_ids) {
      setMultiAllocSkillErrors(prev => ({
        ...prev,
        emp_ids: ''
      }))
    }
  }

  const handleDeselectAllEmployees = () => {
    setMultiAllocSkillForm(prev => ({
      ...prev,
      emp_ids: []
    }))
  }

  const removeSelectedEmployee = (empId) => {
    setMultiAllocSkillForm(prev => ({
      ...prev,
      emp_ids: prev.emp_ids.filter(id => id !== empId)
    }))
  }

  const getSelectedEmployeeNames = () => {
    return multiAllocSkillForm.emp_ids.map(empId => {
      const emp = employees.find(e => e.id === empId)
      return emp ? `${emp.first_name} ${emp.last_name}` : ''
    }).filter(name => name)
  }

  // Skill dropdown helper functions
  const filteredSkillsForMultiSelect = skills.filter(skill => {
    const skillName = skill.skill_name.toLowerCase()
    const searchTerm = multiAllocSkillSearchTerm.toLowerCase()
    return skillName.includes(searchTerm)
  })

  const handleSkillSelect = (skillId) => {
    const selectedSkill = skills.find(s => s.skill_id === skillId)
    setMultiAllocSkillForm(prev => ({
      ...prev,
      skill_id: skillId,
      // Auto-populate certification name with selected skill when certified
      certification_name: prev.certified ? selectedSkill.skill_name : prev.certification_name,
      selected_certification: prev.certified ? selectedSkill.skill_name : prev.selected_certification
    }))
    setShowSkillDropdown(false)
    setMultiAllocSkillSearchTerm('')
    
    // Clear validation error when user selects a skill
    if (multiAllocSkillErrors.skill_id) {
      setMultiAllocSkillErrors(prev => ({
        ...prev,
        skill_id: ''
      }))
    }
  }

  const getSelectedSkillName = () => {
    const skill = skills.find(s => s.skill_id === multiAllocSkillForm.skill_id)
    return skill ? `${skill.skill_name} (${skill.skill_category})` : ''
  }

  // Multi-allocate certificate helper functions
  const filteredEmployeesForMultiAllocCert = employees.filter(emp => {
    // Filter to show only active employees
    const isActive = (emp.employee_status || 'Active') === 'Active'
    if (!isActive) return false
    
    const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase()
    const designation = emp.designation.toLowerCase()
    const searchTerm = multiAllocEmployeeSearchTerm.toLowerCase()
    return fullName.includes(searchTerm) || designation.includes(searchTerm)
  })

  const filteredCertificatesForMultiAlloc = certificates.filter(cert => {
    const certName = cert.certificate_name.toLowerCase()
    const searchTerm = multiAllocCertificateSearchTerm.toLowerCase()
    return certName.includes(searchTerm)
  })

  const handleMultiAllocEmployeeToggle = (empId) => {
    setMultiAllocCertificateForm(prev => ({
      ...prev,
      emp_ids: prev.emp_ids.includes(empId)
        ? prev.emp_ids.filter(id => id !== empId)
        : [...prev.emp_ids, empId]
    }))
    
    // Clear validation error when user selects employees
    if (multiAllocCertificateErrors.emp_ids) {
      setMultiAllocCertificateErrors(prev => ({
        ...prev,
        emp_ids: ''
      }))
    }
  }

  const handleMultiAllocCertificateSelect = (certificateId) => {
    setMultiAllocCertificateForm(prev => ({
      ...prev,
      certificate_id: certificateId
    }))
    setShowMultiAllocCertificateDropdown(false)
    setMultiAllocCertificateSearchTerm('')
    
    // Clear validation error when user selects a certificate
    if (multiAllocCertificateErrors.certificate_id) {
      setMultiAllocCertificateErrors(prev => ({
        ...prev,
        certificate_id: ''
      }))
    }
  }

  const getSelectedMultiAllocEmployeeNames = () => {
    return multiAllocCertificateForm.emp_ids.map(empId => {
      const emp = employees.find(e => e.id === empId)
      return emp ? `${emp.first_name} ${emp.last_name}` : ''
    }).filter(name => name)
  }

  const getSelectedMultiAllocCertificateName = () => {
    const certificate = certificates.find(c => c.certificate_id === multiAllocCertificateForm.certificate_id)
    return certificate ? certificate.certificate_name : ''
  }

  const removeSelectedMultiAllocEmployee = (empId) => {
    setMultiAllocCertificateForm(prev => ({
      ...prev,
      emp_ids: prev.emp_ids.filter(id => id !== empId)
    }))
  }

  // Multi-allocation certificate handler
  const handleCreateMultiAllocCertificate = async (e) => {
    e.preventDefault()
    if (isCreatingMultiAllocCertificate) return // Prevent multiple submissions
    
    try {
      setIsCreatingMultiAllocCertificate(true)
      setError(null) // Clear any previous errors
      
      // Clear previous validation errors
      setMultiAllocCertificateErrors({
        emp_ids: '',
        certificate_id: '',
        status: ''
      })
      
      // Validate required fields with specific error messages
      let hasErrors = false
      const newErrors = {
        emp_ids: '',
        certificate_id: '',
        status: ''
      }
      
      if (!multiAllocCertificateForm.emp_ids.length) {
        newErrors.emp_ids = 'Please select at least one employee'
        hasErrors = true
      }
      
      if (!multiAllocCertificateForm.certificate_id) {
        newErrors.certificate_id = 'Please select a certificate'
        hasErrors = true
      }
      
      if (!multiAllocCertificateForm.status) {
        newErrors.status = 'Please select a status'
        hasErrors = true
      }
      
      if (hasErrors) {
        setMultiAllocCertificateErrors(newErrors)
        setIsCreatingMultiAllocCertificate(false)
        return
      }
      
      // Create certificate statuses for all selected employees
      const promises = multiAllocCertificateForm.emp_ids.map(empId => {
        const certificateData = {
          emp_id: parseInt(empId),
          certificate_id: parseInt(multiAllocCertificateForm.certificate_id),
          status: multiAllocCertificateForm.status,
          start_date: multiAllocCertificateForm.start_date || null,
          expiry_date: multiAllocCertificateForm.expiry_date || null
        }
        
        return apiClient.post('/api/certificates/employee-certificates', certificateData)
      })
      
      console.log('Creating multi-allocation certificates for employees:', multiAllocCertificateForm.emp_ids)
      const responses = await Promise.all(promises)
      console.log('Multi-allocation certificates created successfully:', responses.length, 'certificates')
      
      // Add all new certificate statuses to the state
      const newCertificateStatuses = responses.map(response => response.data.certificate_status)
      setEmployeeCertificateAssignments([...employeeCertificateAssignments, ...newCertificateStatuses])
      
      // Reset form and close modal
      setMultiAllocCertificateForm({
        emp_ids: [],
        certificate_id: '',
        status: 'In-Progress',
        start_date: '',
        expiry_date: ''
      })
      setShowMultiAllocCertificateModal(false)
      // Clear any alerts when closing modal
      clearMultiAllocCertificateAlert()
    } catch (err) {
      console.error('Error creating multi-allocation certificates:', err)
      console.error('Error response:', err.response?.data)
      
      // Check for duplicate assignment errors
      if (err.response?.data?.code === 'DUPLICATE_ASSIGNMENT') {
        const duplicateMessage = err.response?.data?.error || 'Some employees already have this certificate assigned'
        setMultiAllocCertificateAlert({
          show: true,
          message: duplicateMessage,
          type: 'warning'
        })
        // Don't set the general error, just show the alert
      } else {
        const errorMessage = err.response?.data?.error || err.message || 'Failed to create multi-allocation certificates'
        setError(errorMessage)
      }
    } finally {
      setIsCreatingMultiAllocCertificate(false)
    }
  }

  // Handle accordion toggle for skill categories
  const toggleAccordion = (category) => {
    setAccordionState(prev => ({
      ...prev,
      [category]: !prev[category]
    }))
  }







  // Helper function to convert date (YYYY-MM-DD) to month format (YYYY-MM)
  const convertDateToMonth = (dateString) => {
    if (!dateString) return ''
    // If already in YYYY-MM format, return as is
    if (dateString.match(/^\d{4}-\d{2}$/)) {
      return dateString
    }
    // If in YYYY-MM-DD format, extract YYYY-MM
    if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return dateString.substring(0, 7) // Extract YYYY-MM
    }
    // If contains 'T' (ISO format), extract date part first
    if (dateString.includes('T')) {
      const datePart = dateString.split('T')[0]
      if (datePart.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return datePart.substring(0, 7)
      }
    }
    return ''
  }

  // Helper function to split YYYY-MM into month and year
  const splitMonthYear = (monthYearString) => {
    if (!monthYearString || !monthYearString.match(/^\d{4}-\d{2}$/)) {
      return { month: '', year: '' }
    }
    const [year, month] = monthYearString.split('-')
    return { month, year }
  }

  // Helper function to combine month and year into YYYY-MM
  const combineMonthYear = (month, year) => {
    if (!month || !year) return ''
    return `${year}-${month.padStart(2, '0')}`
  }

  // Generate years list (wider range: 30 years back to 10 years forward)
  const getYearsList = () => {
    const currentYear = new Date().getFullYear()
    const years = []
    // 30 years back to 10 years forward
    for (let i = 30; i >= -10; i--) {
      years.push(currentYear - i)
    }
    return years
  }

  // Months list with short names for grid
  const monthsList = [
    { value: '01', label: 'Jan', fullLabel: 'January' },
    { value: '02', label: 'Feb', fullLabel: 'February' },
    { value: '03', label: 'Mar', fullLabel: 'March' },
    { value: '04', label: 'Apr', fullLabel: 'April' },
    { value: '05', label: 'May', fullLabel: 'May' },
    { value: '06', label: 'Jun', fullLabel: 'June' },
    { value: '07', label: 'Jul', fullLabel: 'July' },
    { value: '08', label: 'Aug', fullLabel: 'August' },
    { value: '09', label: 'Sep', fullLabel: 'September' },
    { value: '10', label: 'Oct', fullLabel: 'October' },
    { value: '11', label: 'Nov', fullLabel: 'November' },
    { value: '12', label: 'Dec', fullLabel: 'December' }
  ]

  // Month Picker Component
  const MonthPicker = ({ value, onChange }) => {
    const [isOpen, setIsOpen] = useState(false)
    const dropdownRef = useRef(null)
    const selectedMonth = monthsList.find(m => m.value === value)

    useEffect(() => {
      const handleClickOutside = (event) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
          setIsOpen(false)
        }
      }
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    return (
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-3 py-2 text-left border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800 bg-white flex items-center justify-between text-sm"
        >
          <span className={selectedMonth ? 'text-slate-900' : 'text-slate-500'}>
            {selectedMonth ? selectedMonth.fullLabel : 'Select Month'}
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
            <div className="grid grid-cols-3 gap-2">
              {monthsList.map(month => (
                <button
                  key={month.value}
                  type="button"
                  onClick={() => {
                    onChange(month.value)
                    setIsOpen(false)
                  }}
                  className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                    value === month.value
                      ? 'bg-green-700 text-white font-medium'
                      : 'bg-slate-50 text-slate-700 hover:bg-green-50 hover:text-green-700'
                  }`}
                >
                  {month.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Year Picker Component with decade navigation
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
      <div ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-3 py-2 text-left border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800 bg-white flex items-center justify-between text-sm"
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

  // Handle cell click in the matrix
  const handleCellClick = (employee, skill) => {
    // Check permission before allowing click
    if (!canEditEmployee(employee.id)) {
      return
    }
    
    setSelectedEmployee(employee)
    setSelectedSkill(skill)
    setError(null) // Clear any previous errors
    setIsMatrixCellClick(true) // Mark that this modal was opened from matrix cell click
    
    const existingEmployeeSkill = getEmployeeSkill(employee.id, skill.skill_id)
    
    if (existingEmployeeSkill) {
      setEditingEmployeeSkill(existingEmployeeSkill)
      setEmployeeSkillForm({
        emp_id: existingEmployeeSkill.emp_id,
        skill_id: existingEmployeeSkill.skill_id,
        proficiency_level: existingEmployeeSkill.proficiency_level,
        certified: existingEmployeeSkill.certified,
        certification_name: existingEmployeeSkill.certification_name || '',
        last_assessed: convertDateToMonth(existingEmployeeSkill.last_assessed || ''),
        selected_certification: existingEmployeeSkill.certification_name || '',
        custom_certification_name: '',
        start_date: existingEmployeeSkill.start_date || '',
        expiry_date: existingEmployeeSkill.expiry_date || '',
        description_note: existingEmployeeSkill.description_note || ''
      })
    } else {
      setEditingEmployeeSkill(null)
      setEmployeeSkillForm({
        emp_id: employee.id,
        skill_id: skill.skill_id,
        proficiency_level: 'Beginner',
        certified: false,
        certification_name: '',
        last_assessed: '',
        selected_certification: '',
        custom_certification_name: '',
        start_date: '',
        expiry_date: '',
        description_note: ''
      })
    }
    setError(null) // Clear any previous errors
    setIsCreatingEmployeeSkill(false)
    setIsUpdatingEmployeeSkill(false)
    setIsDeletingEmployeeSkill(false)
    setShowEmployeeSkillModal(true)
  }



  const clearAllFilters = () => {
    setDepartmentFilter([])
    setCategoryFilter([])
    setSkillLevelFilter([])
    setCertificateFilter([])
    setSkillsFilter([])
    setCertificatesFilter([])
    setCertificateStatusFilter([])
    setColumnFilter([])
    setSkillsParentCategoryFilter([])
    setCertificateParentCategoryFilter([])
    setSearchTerm('')
    setShowFilters(false)
  }

  // Export filtered employee certificates to Excel
  const handleExportCertificates = () => {
    try {
      // Get filtered employees and certificates based on Certificate Matrix tab filters
      const filteredEmployeesForExport = filteredEmployeesForCertificateMatrix
      const filteredCertificatesForExport = filteredCertificatesForMatrix

      // Build export data array
      const exportData = []

      // Iterate through filtered employees
      filteredEmployeesForExport.forEach(employee => {
        // Get all certificate assignments for this employee
        const employeeCertificatesForEmployee = employeeCertificateAssignments.filter(
          assignment => assignment.emp_id === employee.id
        )

        // Filter certificate assignments by filtered certificates
        const relevantCertificateAssignments = employeeCertificatesForEmployee.filter(assignment => {
          const certificate = certificates.find(c => c.certificate_id === assignment.certificate_id)
          return certificate && filteredCertificatesForExport.some(fc => fc.certificate_id === certificate.certificate_id)
        })

        // If employee has no relevant certificates, skip
        if (relevantCertificateAssignments.length === 0) {
          return
        }

        // Create a row for each employee-certificate combination
        relevantCertificateAssignments.forEach(assignment => {
          const certificate = certificates.find(c => c.certificate_id === assignment.certificate_id)
          if (!certificate) return

          // Format dates
          const formatDate = (dateString) => {
            if (!dateString) return ''
            try {
              const date = new Date(dateString)
              if (isNaN(date.getTime())) return ''
              // Format as YYYY-MM-DD
              return date.toISOString().split('T')[0]
            } catch (e) {
              return ''
            }
          }

          exportData.push({
            'Employee ID': employee.employee_id || employee.id || '',
            'First Name': employee.first_name || '',
            'Last Name': employee.last_name || '',
            'Certificate Name': certificate.certificate_name || '',
            'Category': certificate.certificate_category || '',
            'Status': assignment.status || '',
            'Difficulty Level': certificate.difficulty_level || '',
            'Issued By': certificate.issued_by || '',
            'Start Date': formatDate(assignment.start_date),
            'End Date': formatDate(assignment.expiry_date)
          })
        })
      })

      if (exportData.length === 0) {
        alert('No data to export. Please adjust your filters.')
        return
      }

      // Create worksheet
      const worksheet = XLSX.utils.json_to_sheet(exportData)

      // Set column widths
      const columnWidths = [
        { wch: 12 }, // Employee ID
        { wch: 15 }, // First Name
        { wch: 15 }, // Last Name
        { wch: 25 }, // Certificate Name
        { wch: 20 }, // Category
        { wch: 15 }, // Status
        { wch: 18 }, // Difficulty Level
        { wch: 20 }, // Issued By
        { wch: 12 }, // Start Date
        { wch: 12 }  // End Date
      ]
      worksheet['!cols'] = columnWidths

      // Create workbook
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Employee Certificates')

      // Generate filename with current date
      const dateStr = new Date().toISOString().split('T')[0]
      const filename = `employee_certificates_export_${dateStr}.xlsx`

      // Write file
      XLSX.writeFile(workbook, filename)

      console.log(`Exported ${exportData.length} certificate records to ${filename}`)
    } catch (error) {
      console.error('Error exporting certificates:', error)
      alert('Error exporting certificates. Please try again.')
    }
  }

  // Export filtered employee skills to Excel
  const handleExportSkills = () => {
    try {
      // Get filtered employees and skills based on Skills Matrix tab filters
      const filteredEmployeesForExport = filteredEmployeesForSkillsMatrix
      const filteredSkillsForExport = filteredSkillsForMatrix

      // Build export data array
      const exportData = []

      // Iterate through filtered employees
      filteredEmployeesForExport.forEach(employee => {
        // Get all employee skills for this employee
        const employeeSkillsForEmployee = employeeSkills.filter(es => es.emp_id === employee.id)

        // Filter employee skills by filtered skills
        const relevantEmployeeSkills = employeeSkillsForEmployee.filter(es => {
          const skill = skills.find(s => s.skill_id === es.skill_id)
          return skill && filteredSkillsForExport.some(fs => fs.skill_id === skill.skill_id)
        })

        // If employee has no relevant skills, still add a row (optional - you can remove this if you only want employees with skills)
        if (relevantEmployeeSkills.length === 0) {
          // Skip employees with no skills in the filtered set
          return
        }

        // Create a row for each employee-skill combination
        relevantEmployeeSkills.forEach(es => {
          const skill = skills.find(s => s.skill_id === es.skill_id)
          if (!skill) return

          // Map category: Technical Skill -> HardSkill, Non-Technical Skill -> SoftSkill
          const categoryMap = {
            'Technical Skill': 'HardSkill',
            'Non-Technical Skill': 'SoftSkill'
          }
          const mappedCategory = categoryMap[skill.skill_category] || skill.skill_category

          // Format dates
          const formatDate = (dateString) => {
            if (!dateString) return ''
            try {
              const date = new Date(dateString)
              if (isNaN(date.getTime())) return ''
              // Format as YYYY-MM-DD
              return date.toISOString().split('T')[0]
            } catch (e) {
              return ''
            }
          }

          // Format last assessed (month-year format)
          const formatLastAssessed = (dateString) => {
            if (!dateString) return ''
            try {
              const date = new Date(dateString)
              if (isNaN(date.getTime())) return ''
              // Format as MM-YYYY
              const month = String(date.getMonth() + 1).padStart(2, '0')
              const year = date.getFullYear()
              return `${month}-${year}`
            } catch (e) {
              return dateString // Return as-is if not a valid date
            }
          }

          exportData.push({
            'Employee ID': employee.employee_id || employee.id || '',
            'First Name': employee.first_name || '',
            'Last Name': employee.last_name || '',
            'Skills': skill.skill_name || '',
            'Skills Name': skill.skill_name || '', // Alternative column name for compatibility
            'Category': mappedCategory,
            'Parent Skill': skill.parent_skill || '',
            'Parent Name': skill.parent_skill || '', // Alternative column name for compatibility
            'Proficiency Level': es.proficiency_level || '',
            'Certified': es.certified ? 'Yes' : 'No',
            'Start Date': formatDate(es.start_date),
            'Expiry Date': formatDate(es.expiry_date),
            'Last Assessed': formatLastAssessed(es.last_assessed)
          })
        })
      })

      if (exportData.length === 0) {
        alert('No data to export. Please adjust your filters.')
        return
      }

      // Create worksheet
      const worksheet = XLSX.utils.json_to_sheet(exportData)

      // Set column widths
      const columnWidths = [
        { wch: 12 }, // Employee ID
        { wch: 15 }, // First Name
        { wch: 15 }, // Last Name
        { wch: 20 }, // Skills
        { wch: 20 }, // Skills Name
        { wch: 15 }, // Category
        { wch: 20 }, // Parent Skill
        { wch: 20 }, // Parent Name
        { wch: 18 }, // Proficiency Level
        { wch: 10 }, // Certified
        { wch: 12 }, // Start Date
        { wch: 12 }, // Expiry Date
        { wch: 15 }  // Last Assessed
      ]
      worksheet['!cols'] = columnWidths

      // Create workbook
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Employee Skills')

      // Generate filename with current date
      const dateStr = new Date().toISOString().split('T')[0]
      const filename = `employee_skills_export_${dateStr}.xlsx`

      // Write file
      XLSX.writeFile(workbook, filename)

      console.log(`Exported ${exportData.length} skill records to ${filename}`)
    } catch (error) {
      console.error('Error exporting skills:', error)
      alert('Error exporting skills. Please try again.')
    }
  }

  // Filter employees based on search, department, certificate, and skill level
  const filteredEmployees = employees.filter(employee => {
    const fullName = `${employee.first_name} ${employee.last_name}`.toLowerCase()
    const matchesSearch = fullName.includes(searchTerm.toLowerCase()) ||
                         employee.designation.toLowerCase().includes(searchTerm.toLowerCase())
    
    // Filter by department (multi-select)
    const matchesDepartment = departmentFilter.length === 0 || 
                             departmentFilter.includes(employee.department)
    
    // Filter by selected skills (multi-select)
    let matchesSelectedSkill = true
    if (skillsFilter.length > 0) {
      const employeeHasAnySelectedSkill = skillsFilter.some(skillName => {
        const skill = skills.find(s => s.skill_name === skillName)
        return skill && employeeSkills.some(es => 
        es.emp_id === employee.id && es.skill_id === skill.skill_id
      )
      })
      matchesSelectedSkill = employeeHasAnySelectedSkill
    }
    
    // Filter by selected certificates (multi-select)
    let matchesSelectedCertificate = true
    if (certificatesFilter.length > 0) {
      const employeeHasAnySelectedCertificate = certificatesFilter.some(certName => {
        const selectedCertificate = certificates.find(cert => cert.certificate_name === certName)
        if (!selectedCertificate) return false
        
        const certificateStatus = employeeCertificateAssignments.find(assignment => 
          assignment.emp_id === employee.id && assignment.certificate_id === selectedCertificate.certificate_id
        )
        return !!certificateStatus
      })
      matchesSelectedCertificate = employeeHasAnySelectedCertificate
    }
    
    // Filter by certificate status (multi-select)
    let matchesCertificateStatus = true
    if (certificateStatusFilter.length > 0) {
      const hasCertificateWithAnySelectedStatus = employeeCertificateAssignments.some(assignment => 
        assignment.emp_id === employee.id && certificateStatusFilter.includes(assignment.status)
      )
      matchesCertificateStatus = hasCertificateWithAnySelectedStatus
    }
    
    // Filter by skill level (multi-select)
    let matchesSkillLevel = true
    if (skillLevelFilter.length > 0) {
      const employeeHasAnySelectedSkillLevel = employeeSkills.some(es => 
        es.emp_id === employee.id && skillLevelFilter.includes(es.proficiency_level)
      )
      matchesSkillLevel = employeeHasAnySelectedSkillLevel
    }
    
    // Filter by skills parent category (multi-select)
    let matchesSkillsParentCategory = true
    if (skillsParentCategoryFilter.length > 0) {
      const employeeHasSkillInAnySelectedParentCategory = employeeSkills.some(es => {
        const skill = skills.find(s => s.skill_id === es.skill_id)
        if (!skill) return false
        
        // Handle "Others" category - skills without parent_skill or with empty parent_skill
        if (skillsParentCategoryFilter.includes('Others')) {
          return es.emp_id === employee.id && (!skill.parent_skill || skill.parent_skill.trim() === '')
        }
        
        return es.emp_id === employee.id && skillsParentCategoryFilter.includes(skill.parent_skill)
      })
      matchesSkillsParentCategory = employeeHasSkillInAnySelectedParentCategory
    }
    
    // Filter by certificate parent category (multi-select)
    let matchesCertificateParentCategory = true
    if (certificateParentCategoryFilter.length > 0) {
      const employeeHasCertificateInAnySelectedParentCategory = employeeCertificateAssignments.some(assignment => {
        const certificate = certificates.find(cert => cert.certificate_id === assignment.certificate_id)
        if (!certificate) return false
        
        // Handle "Others" category - certificates without certificate_category or with empty certificate_category
        if (certificateParentCategoryFilter.includes('Others')) {
          return assignment.emp_id === employee.id && (!certificate.certificate_category || certificate.certificate_category.trim() === '')
        }
        
        return assignment.emp_id === employee.id && certificateParentCategoryFilter.includes(certificate.certificate_category)
      })
      matchesCertificateParentCategory = employeeHasCertificateInAnySelectedParentCategory
    }
    
    return matchesSearch && matchesDepartment && matchesSkillLevel && matchesSelectedSkill && matchesSelectedCertificate && matchesCertificateStatus && matchesSkillsParentCategory && matchesCertificateParentCategory
  })

  // Get filtered skills based on selected parent categories (cascading filter)
  const getFilteredSkillsForMatrix = useMemo(() => {
    if (skillsMatrixSkillsParentCategoryFilter.length === 0) {
      // If no parent category selected, show all skills
      return skills
    } else {
      // Filter skills based on selected parent categories
      return skills.filter(skill => {
        // Handle "Others" category - skills without parent_skill or with empty parent_skill
        if (skillsMatrixSkillsParentCategoryFilter.includes('Others')) {
          return !skill.parent_skill || skill.parent_skill.trim() === ''
        }
        // Show skills that belong to selected parent categories
        return skill.parent_skill && skillsMatrixSkillsParentCategoryFilter.includes(skill.parent_skill)
      })
    }
  }, [skills, skillsMatrixSkillsParentCategoryFilter])

  // Get filtered certificates based on selected parent categories (cascading filter)
  const getFilteredCertificatesForMatrix = useMemo(() => {
    if (certificateMatrixCertificateParentCategoryFilter.length === 0) {
      // If no parent category selected, show all certificates
      return certificates
    } else {
      // Filter certificates based on selected parent categories
      return certificates.filter(certificate => {
        // Handle "Others" category - certificates without certificate_category or with empty certificate_category
        if (certificateMatrixCertificateParentCategoryFilter.includes('Others')) {
          return !certificate.certificate_category || certificate.certificate_category.trim() === ''
        }
        // Show certificates that belong to selected parent categories
        return certificate.certificate_category && certificateMatrixCertificateParentCategoryFilter.includes(certificate.certificate_category)
      })
    }
  }, [certificates, certificateMatrixCertificateParentCategoryFilter])

  // Filter employees for Skills Matrix tab
  const filteredEmployeesForSkillsMatrix = employees.filter(employee => {
    const fullName = `${employee.first_name} ${employee.last_name}`.toLowerCase()
    const matchesSearch = fullName.includes(skillsMatrixSearchTerm.toLowerCase()) ||
                         employee.designation.toLowerCase().includes(skillsMatrixSearchTerm.toLowerCase())
    
    // Filter by department (multi-select)
    const matchesDepartment = skillsMatrixDepartmentFilter.length === 0 || 
                             skillsMatrixDepartmentFilter.includes(employee.department)
    
    // Filter by location (multi-select)
    const matchesLocation = skillsMatrixLocationFilter.length === 0 || 
                           skillsMatrixLocationFilter.includes(employee.city || employee.location)
    
    // Filter by selected skills (multi-select)
    let matchesSelectedSkill = true
    if (skillsMatrixSkillsFilter.length > 0) {
      const employeeHasAnySelectedSkill = skillsMatrixSkillsFilter.some(skillName => {
        const skill = skills.find(s => s.skill_name === skillName)
        return skill && employeeSkills.some(es => 
        es.emp_id === employee.id && es.skill_id === skill.skill_id
      )
      })
      matchesSelectedSkill = employeeHasAnySelectedSkill
    }
    
    // Filter by skill level (multi-select)
    let matchesSkillLevel = true
    if (skillsMatrixSkillLevelFilter.length > 0) {
      const employeeHasAnySelectedSkillLevel = employeeSkills.some(es => 
        es.emp_id === employee.id && skillsMatrixSkillLevelFilter.includes(es.proficiency_level)
      )
      matchesSkillLevel = employeeHasAnySelectedSkillLevel
    }
    
    // Filter by skills parent category (multi-select)
    let matchesSkillsParentCategory = true
    if (skillsMatrixSkillsParentCategoryFilter.length > 0) {
      const employeeHasSkillInAnySelectedParentCategory = employeeSkills.some(es => {
        const skill = skills.find(s => s.skill_id === es.skill_id)
        if (!skill) return false
        
        // Handle "Others" category - skills without parent_skill or with empty parent_skill
        if (skillsMatrixSkillsParentCategoryFilter.includes('Others')) {
          return es.emp_id === employee.id && (!skill.parent_skill || skill.parent_skill.trim() === '')
        }
        
        return es.emp_id === employee.id && skillsMatrixSkillsParentCategoryFilter.includes(skill.parent_skill)
      })
      matchesSkillsParentCategory = employeeHasSkillInAnySelectedParentCategory
    }
    
    // Filter by certified status
    let matchesCertified = true
    if (skillsMatrixCertifiedFilter !== 'All') {
      const employeeHasCertifiedSkills = employeeSkills.some(es => 
        es.emp_id === employee.id && es.certified === true
      )
      if (skillsMatrixCertifiedFilter === 'Certified') {
        matchesCertified = employeeHasCertifiedSkills
      } else if (skillsMatrixCertifiedFilter === 'Not Certified') {
        // Show employees who have skills but none are certified
        const employeeHasAnySkills = employeeSkills.some(es => es.emp_id === employee.id)
        matchesCertified = employeeHasAnySkills && !employeeHasCertifiedSkills
      }
    }
    
    // Filter by employee status (multi-select)
    const matchesStatus = skillsMatrixStatusFilter.length === 0 || 
                          skillsMatrixStatusFilter.includes(employee.employee_status || 'Active')
    
    // Filter by assign status (All, Assigned, Not Assigned)
    let matchesAssignStatus = true
    if (skillsMatrixAssignStatusFilter !== 'All') {
      const employeeHasAnySkills = employeeSkills.some(es => es.emp_id === employee.id)
      if (skillsMatrixAssignStatusFilter === 'Assigned') {
        matchesAssignStatus = employeeHasAnySkills
      } else if (skillsMatrixAssignStatusFilter === 'Not Assigned') {
        matchesAssignStatus = !employeeHasAnySkills
      }
    }
    
    return matchesSearch && matchesDepartment && matchesLocation && matchesSkillLevel && matchesSelectedSkill && matchesSkillsParentCategory && matchesCertified && matchesStatus && matchesAssignStatus
  })

  // Filter employees for Certificate Matrix tab
  const filteredEmployeesForCertificateMatrix = employees.filter(employee => {
    const fullName = `${employee.first_name} ${employee.last_name}`.toLowerCase()
    const matchesSearch = fullName.includes(certificateMatrixSearchTerm.toLowerCase()) ||
                         employee.designation.toLowerCase().includes(certificateMatrixSearchTerm.toLowerCase())
    
    // Filter by department (multi-select)
    const matchesDepartment = certificateMatrixDepartmentFilter.length === 0 || 
                             certificateMatrixDepartmentFilter.includes(employee.department)
    
    // Filter by location (multi-select)
    const matchesLocation = certificateMatrixLocationFilter.length === 0 || 
                           certificateMatrixLocationFilter.includes(employee.city || employee.location)
    
    // Filter by selected certificates (multi-select)
    let matchesSelectedCertificate = true
    if (certificateMatrixCertificatesFilter.length > 0) {
      const employeeHasAnySelectedCertificate = certificateMatrixCertificatesFilter.some(certName => {
        const selectedCertificate = certificates.find(cert => cert.certificate_name === certName)
        if (!selectedCertificate) return false
        
        const certificateStatus = employeeCertificateAssignments.find(assignment => 
          assignment.emp_id === employee.id && assignment.certificate_id === selectedCertificate.certificate_id
        )
        return !!certificateStatus
      })
      matchesSelectedCertificate = employeeHasAnySelectedCertificate
    }
    
    // Filter by certificate status (multi-select)
    let matchesCertificateStatus = true
    if (certificateMatrixCertificateStatusFilter.length > 0) {
      const hasCertificateWithAnySelectedStatus = employeeCertificateAssignments.some(assignment => 
        assignment.emp_id === employee.id && certificateMatrixCertificateStatusFilter.includes(assignment.status)
      )
      matchesCertificateStatus = hasCertificateWithAnySelectedStatus
    }
    
    // Filter by certificate parent category (multi-select)
    let matchesCertificateParentCategory = true
    if (certificateMatrixCertificateParentCategoryFilter.length > 0) {
      const employeeHasCertificateInAnySelectedParentCategory = employeeCertificateAssignments.some(assignment => {
        const certificate = certificates.find(cert => cert.certificate_id === assignment.certificate_id)
        if (!certificate) return false
        
        // Handle "Others" category - certificates without certificate_category or with empty certificate_category
        if (certificateMatrixCertificateParentCategoryFilter.includes('Others')) {
          return assignment.emp_id === employee.id && (!certificate.certificate_category || certificate.certificate_category.trim() === '')
        }
        
        return assignment.emp_id === employee.id && certificateMatrixCertificateParentCategoryFilter.includes(certificate.certificate_category)
      })
      matchesCertificateParentCategory = employeeHasCertificateInAnySelectedParentCategory
    }
    
    // Filter by employee status (multi-select)
    const matchesStatus = certificateMatrixStatusFilter.length === 0 || 
                          certificateMatrixStatusFilter.includes(employee.employee_status || 'Active')
    
    // Filter by assign status (All, Assigned, Not Assigned)
    let matchesAssignStatus = true
    if (certificateMatrixAssignStatusFilter !== 'All') {
      const employeeHasAnyCertificates = employeeCertificateAssignments.some(assignment => assignment.emp_id === employee.id)
      if (certificateMatrixAssignStatusFilter === 'Assigned') {
        matchesAssignStatus = employeeHasAnyCertificates
      } else if (certificateMatrixAssignStatusFilter === 'Not Assigned') {
        matchesAssignStatus = !employeeHasAnyCertificates
      }
    }
    
    return matchesSearch && matchesDepartment && matchesLocation && matchesSelectedCertificate && matchesCertificateStatus && matchesCertificateParentCategory && matchesStatus && matchesAssignStatus
  })

  // Filter skills based on category and skill level
  const filteredSkills = skills.filter(skill => {
    const matchesCategory = categoryFilter.length === 0 || categoryFilter.includes(skill.skill_category)
    
    // If skill level filter is active, only show skills that have employees at that level
    let matchesSkillLevel = true
    if (skillLevelFilter.length > 0) {
      const skillHasAnySelectedLevel = employeeSkills.some(es => 
        es.skill_id === skill.skill_id && skillLevelFilter.includes(es.proficiency_level)
      )
      matchesSkillLevel = skillHasAnySelectedLevel
    }
    
    return matchesCategory && matchesSkillLevel
  })

  // Filter skills for Skills Matrix tab (includes search term filtering)
  const filteredSkillsForMatrix = filteredSkills.filter(skill => {
    // Apply skills search term filter
    if (skillsMatrixSkillsSearchTerm.trim()) {
      return skill.skill_name.toLowerCase().includes(skillsMatrixSkillsSearchTerm.toLowerCase())
    }
    return true
  })

  // Filter certificates for Certificate Matrix tab (includes search term filtering)
  const filteredCertificatesForMatrix = certificates.filter(certificate => {
    // Apply certificates search term filter
    if (certificateMatrixCertificatesSearchTerm.trim()) {
      return certificate.certificate_name.toLowerCase().includes(certificateMatrixCertificatesSearchTerm.toLowerCase())
    }
    return true
  })

      const handleAIFilterApply = async (aiFilters) => {
        if (!aiFilters || aiFilters.length === 0) {
          setAiData([])
          return
        }
        try {
          const token = getCookie(TOKEN)
          if (!token) {
            console.error('No authentication token found')
            return
          }
    
          const response = await fetch(`${getApiBaseUrl()}/api/ai/filter-apply`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ filters: aiFilters, tableName: TABLE_VIEW_MAPPING[activeTab] })
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
          console.error('Error fetching filtered data:', error)
          throw error // Re-throw to let AIFilterChatbot handle the error message
        } finally {
          setAIDataFetched(true);
        }
      }


  
  // Filter skills for Skills Management tab
  const getFilteredSkillsForManagement = () => {
    let filtered = (showAIFilter && isAIDataFetched) ?  aiData : skills; 
    
    // Filter by search term
    if (skillSearchTerm.trim()) {
      filtered = filtered.filter(skill =>
        skill.skill_name.toLowerCase().includes(skillSearchTerm.toLowerCase())
      )
    }
    
    // Filter by parent category (multi-select)
    if (skillsManagementParentCategoryFilter.length > 0) {
      filtered = filtered.filter(skill => {
        if (skillsManagementParentCategoryFilter.includes('Others')) {
          return !skill.parent_skill || skill.parent_skill.trim() === '' || 
                 skillsManagementParentCategoryFilter.includes(skill.parent_skill)
        }
        return skillsManagementParentCategoryFilter.includes(skill.parent_skill)
      })
    }
    
    // Filter by skill category (multi-select)
    if (skillsManagementSkillCategoryFilter.length > 0) {
      filtered = filtered.filter(skill => 
        skillsManagementSkillCategoryFilter.includes(skill.skill_category)
      )
    }
    
    return filtered
  }
  
  const filteredSkillsForManagement = getFilteredSkillsForManagement()
  
  // Filter certificates for Certificate Management tab
  const getFilteredCertificatesForManagement = () => {
    let filtered = (showAIFilter && isAIDataFetched) ?  aiData : certificates; 
    
    // Filter by search term
    if (certificateSearchTerm.trim()) {
      filtered = filtered.filter(cert =>
        cert.certificate_name.toLowerCase().includes(certificateSearchTerm.toLowerCase()) ||
        (cert.issued_by && cert.issued_by.toLowerCase().includes(certificateSearchTerm.toLowerCase())) ||
        (cert.description && cert.description.toLowerCase().includes(certificateSearchTerm.toLowerCase()))
      )
    }
    
    // Filter by parent category (multi-select)
    if (certificateManagementParentCategoryFilter.length > 0) {
      filtered = filtered.filter(cert => {
        if (certificateManagementParentCategoryFilter.includes('Others')) {
          return !parentCertificateCategories.includes(cert.certificate_category) || 
                 certificateManagementParentCategoryFilter.includes(cert.certificate_category)
        }
        return certificateManagementParentCategoryFilter.includes(cert.certificate_category)
      })
    }
    
    // Filter by difficulty (multi-select)
    if (certificateManagementDifficultyFilter.length > 0) {
      filtered = filtered.filter(cert => 
        certificateManagementDifficultyFilter.includes(cert.difficulty_level)
      )
    }
    
    return filtered
  }

  const AIFilterButton = () => {
    return (
      <>
      {
                  (AI_FILER_ENABLED_VIEW.includes(activeTab) && !showFilters) ? <button
                      onClick={() => {
                        setShowAIFilter(!showAIFilter)
                        if (showAIFilter) {
                          setShowFilters(false) // Hide regular filters when AI filter is shown
                        }
                      }}
                      className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 border ${showAIFilter
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                        }`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      AI Filter
                    </button> : null
                  }
      </>
    )
  }
  
  const filteredCertificatesForManagement = getFilteredCertificatesForManagement()

  // Get unique departments for filter dropdown
  const departments = ['All Departments', ...new Set(employees.map(emp => emp.department))]
  
  // Get unique locations for filter dropdown
  const uniqueLocations = [...new Set(employees.map(emp => emp.city || emp.location).filter(Boolean))]

  // Calculate summary statistics
  const totalEmployees = employees.length
  const totalSkills = skills.length
  const hardSkillsCount = skills.filter(s => s.skill_category === 'Technical Skill').length
  const softSkillsCount = skills.filter(s => s.skill_category === 'Non-Technical Skill').length
  
  // Calculate skill coverage statistics
  const totalPossibleSkills = totalEmployees * totalSkills
  const assignedSkills = employeeSkills.length
  const skillsCoverage = totalPossibleSkills > 0 ? Math.round((assignedSkills / totalPossibleSkills) * 100) : 0
  
  // Count experts by skill
  const javaExperts = employeeSkills.filter(es => {
    const skill = skills.find(s => s.skill_id === es.skill_id)
    return skill && skill.skill_name === 'Java' && es.proficiency_level === 'Expert'
  }).length
  
  const teamLeads = employeeSkills.filter(es => {
    const skill = skills.find(s => s.skill_id === es.skill_id)
    return skill && skill.skill_name === 'Team Lead' && es.proficiency_level === 'Expert'
  }).length
  
  // Count valid certifications
  const validCerts = employeeSkills.filter(es => 
    es.certified && (!es.expiry_date || new Date(es.expiry_date) > new Date())
  ).length
  
  // Count skills gaps (employees with no skills in a category)
  const skillsGaps = 0 // This would need more complex logic to calculate actual gaps

  // Show loader while permissions are being fetched
  if (permissionsLoading) {
    return (
      <div className="min-h-screen bg-slate-100">
        <Header />
        <div className="w-[97%] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-700 mx-auto mb-4"></div>
              <p className="text-slate-600">Loading Skills...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Check permissions - only after loading is complete
  const hasAnyPermission = hasPermission('view-skills-management') || 
                          hasPermission('view-certificate-management') || 
                          hasPermission('view-skills-matrix') || 
                          hasPermission('view-certificate-matrix')

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
            <p className="text-slate-600">You don't have permission to view Skills & Certifications.</p>
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
        <div className="w-[97%] mx-auto px-6 py-8">
          <LoadingSpinner message="Loading skills data..." fullScreen={false} />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <div className="w-[97%] mx-auto px-6 py-8">
          <div className="card p-6 bg-red-50 border-red-200">
            <p className="text-red-800 font-medium">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <style>{animationStyles}</style>
    <div className="min-h-screen bg-slate-50">
      <Header />
      
      <div className="w-[97%] mx-auto px-6 py-4">
        {/* Page Header */}
        <div className="mb-2 animate-fade-in mb-2">
          <h1 className="page-title text-xl">Skills & Certifications Matrix</h1>
          <p className="page-subtitle">Manage and track employee skills across the organization</p>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6 animate-fade-in">
          <div className="border-b border-slate-200">
            <nav className="-mb-px flex space-x-8">
              {hasPermission('view-skills-management') && (
                <button
                  onClick={() => {
                    setActiveTab('skills-management')
                    setShowAIFilter(false)
                  }}
                  className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                    activeTab === 'skills-management'
                      ? 'border-green-800 text-green-800'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 text-medium">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    Skills Management
                  </div>
                </button>
              )}
              {hasPermission('view-certificate-management') && (
                <button
                  onClick={() => {
                    setActiveTab('certificate-management')
                    setShowAIFilter(false)
                  }}
                  className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                    activeTab === 'certificate-management'
                      ? 'border-green-800 text-green-800'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 text-medium">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    Certificates Management
                  </div>
                </button>
              )}
              {hasPermission('view-skills-matrix') && (
                <button
                  onClick={() => setActiveTab('skills-matrix')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                    activeTab === 'skills-matrix'
                      ? 'border-green-800 text-green-800'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                    </svg>
                    Skills
                  </div>
                </button>
              )}
              {hasPermission('view-certificate-matrix') && (
                <button
                  onClick={() => setActiveTab('certificate-matrix')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                    activeTab === 'certificate-matrix'
                      ? 'border-green-800 text-green-800'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    Certificates
                  </div>
                </button>
              )}
              <button
                onClick={() => {
                  setActiveTab('learning-management')
                  setShowAIFilter(false)
                  setError(null) // Clear errors when switching tabs
                }}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                  activeTab === 'learning-management'
                    ? 'border-green-800 text-green-800'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                  </svg>
                  Learning Management
                </div>
              </button>
              {hasPermission('view-learning-and-training') && (
                <button
                  onClick={() => {
                    setActiveTab('learning-and-training')
                    setShowAIFilter(false)
                    setError(null) // Clear errors when switching tabs
                  }}
                  className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                    activeTab === 'learning-and-training'
                      ? 'border-green-800 text-green-800'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                    </svg>
                    Learning & Training
                  </div>
                </button>
              )}
            </nav>
          </div>
        </div>


        {/* Tab Content */}
        {activeTab === 'skills-management' && hasPermission('view-skills-management') && (
          <div className="animate-fade-in">
            {/* Skills Management Section */}
            <div className="card p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-medium font-semibold text-slate-900">Skills Management ({filteredSkillsForManagement.length})</h3>
                {hasPermission('skill-add') && (
                  <button
                    onClick={() => {
                      setEditingSkill(null)
                      setSkillForm({ skill_name: '', skill_category: 'Technical Skill', parent_skill: 'Web Development', custom_parent_skill: '' })
                      setIsCreatingSkill(false)
                      setIsUpdatingSkill(false)
                      setShowSkillModal(true)
                    }}
                    className="px-3 py-2 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 transition-all duration-200 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                    </svg>
                    Add Skill
                  </button>
                )}
              </div>
              
              {/* Search and Filter Controls */}
              <div className="mb-6 space-y-4">
                <div className="flex flex-row gap-4">
                  {/* Search Box */}
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      placeholder="Search skills..."
                      value={skillSearchTerm}
                      onChange={(e) => setSkillSearchTerm(e.target.value)}
                      className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-800 focus:border-transparent transition-all duration-200"
                    />
                    {skillSearchTerm && (
                      <button
                        onClick={() => setSkillSearchTerm('')}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 transition-colors"
                        type="button"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                      </button>
                    )}
                  </div>
                  <AIFilterButton />
                  
                  {/* Filter Button */}
                  <button
                    onClick={() => setShowSkillsManagementFilters(!showSkillsManagementFilters)}
                    className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 border ${
                      showSkillsManagementFilters || 
                      skillsManagementParentCategoryFilter.length > 0 || 
                      skillsManagementSkillCategoryFilter.length > 0 ||
                      skillSearchTerm.trim()
                        ? 'bg-green-700 text-white border-green-700'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.207A1 1 0 013 6.5V4z"/>
                    </svg>
                    Filters
                    <svg 
                      className={`w-4 h-4 transition-transform duration-200 ${showSkillsManagementFilters ? 'rotate-180' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
                    </svg>
                  </button>
                  
                  {/* View Toggle Buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`p-2 rounded-lg transition-all duration-200 ${
                        viewMode === 'grid'
                          ? 'bg-green-700 text-white shadow-md'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                      title="Grid View"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={`p-2 rounded-lg transition-all duration-200 ${
                        viewMode === 'list'
                          ? 'bg-green-700 text-white shadow-md'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                      title="List View"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                {/* Filter Options Panel - Collapsible */}
                {showSkillsManagementFilters && (
                  <div className="px-6 py-4 border border-slate-200 bg-slate-50 animate-fade-in rounded-md">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-slate-900">Filter Options</h3>
                      <button
                        onClick={() => setShowSkillsManagementFilters(false)}
                        className="text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                      </button>
                    </div>
                    
                    {/* Filter Controls */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 relative" style={{ zIndex: 40 }}>
                      <MultiSelect
                        label="Parent Category"
                        options={[
                          ...parentSkillCategories.map(category => ({ value: category, label: category })),
                          { value: 'Others', label: 'Others' }
                        ]}
                        selectedValues={skillsManagementParentCategoryFilter}
                        onSelectionChange={setSkillsManagementParentCategoryFilter}
                        placeholder="All Categories"
                        searchPlaceholder="Filter categories..."
                      />
                      
                      <MultiSelect
                        label="Skill Category"
                        options={[
                          { value: 'Technical Skill', label: 'Technical Skill' },
                          { value: 'Non-Technical Skill', label: 'Non-Technical Skill' }
                        ]}
                        selectedValues={skillsManagementSkillCategoryFilter}
                        onSelectionChange={setSkillsManagementSkillCategoryFilter}
                        placeholder="All Skill Types"
                        searchPlaceholder="Filter skill types..."
                      />
                    </div>
                    
                    {/* Clear All Filters Button */}
                    {(skillsManagementParentCategoryFilter.length > 0 || 
                      skillsManagementSkillCategoryFilter.length > 0 ||
                      skillSearchTerm.trim()) && (
                      <div className="flex justify-end mt-4">
                        <button
                          onClick={() => {
                            setSkillsManagementParentCategoryFilter([])
                            setSkillsManagementSkillCategoryFilter([])
                            setSkillSearchTerm('')
                          }}
                          className="text-sm text-green-700 hover:text-green-800 font-medium transition-colors duration-200"
                        >
                          Clear all filters
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {filteredSkillsForManagement.length > 0 ? (
                viewMode === 'grid' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredSkillsForManagement.map(skill => (
                      <div key={skill.skill_id} className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-semibold text-slate-900">{skill.skill_name}</h4>
                          <div className="flex gap-1">
                            {hasPermission('skill-edit') && (
                              <button
                              onClick={() => {
                                setEditingSkill(skill)
                            setSkillForm({
                              skill_name: skill.skill_name,
                              skill_category: skill.skill_category,
                              parent_skill: skill.parent_skill || '',
                              custom_parent_skill: ''
                            })
                                setIsCreatingSkill(false)
                                setIsUpdatingSkill(false)
                                setShowSkillModal(true)
                              }}
                                className="text-green-700 hover:text-green-800 text-sm"
                              >
                                Edit
                              </button>
                            )}
                            {hasPermission('skill-delete') && (
                              <button
                                onClick={() => handleDeleteSkill(skill.skill_id)}
                                className="text-red-600 hover:text-red-800 text-sm ml-2"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            skill.skill_category === 'Technical Skill' ? 'bg-green-100 text-green-800' :
                            skill.skill_category === 'Non-Technical Skill' ? 'bg-green-100 text-green-800' :
                            'bg-purple-100 text-purple-800'
                          }`}>
                            {skill.skill_category}
                          </span>
                          <span className="text-sm text-slate-500">
                            {employeeSkills.filter(es => es.skill_id === skill.skill_id).length} employees
                          </span>
                        </div>
                        {skill.parent_skill && (
                          <div className="mt-2">
                            <span className="text-xs text-slate-500">Parent: {skill.parent_skill}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredSkillsForManagement.map(skill => (
                      <div key={skill.skill_id} className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-center">
                          <div className="flex-1">
                            <div className="flex items-center gap-4">
                              <h4 className="font-semibold text-slate-900 text-lg">{skill.skill_name}</h4>
                              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                skill.skill_category === 'Technical Skill' ? 'bg-green-100 text-green-800' :
                                skill.skill_category === 'Non-Technical Skill' ? 'bg-green-100 text-green-800' :
                                'bg-purple-100 text-purple-800'
                              }`}>
                                {skill.skill_category}
                              </span>
                              <span className="text-sm text-slate-500">
                                {employeeSkills.filter(es => es.skill_id === skill.skill_id).length} employees
                              </span>
                              {skill.parent_skill && (
                                <span className="text-sm text-slate-600 bg-slate-100 px-2 py-1 rounded">
                                  {skill.parent_skill}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {hasPermission('skill-edit') && (
                              <button
                                onClick={() => {
                                  setEditingSkill(skill)
                                  setSkillForm({
                                    skill_name: skill.skill_name,
                                    skill_category: skill.skill_category,
                                    parent_skill: skill.parent_skill || '',
                                    custom_parent_skill: ''
                                  })
                                  setIsCreatingSkill(false)
                                  setIsUpdatingSkill(false)
                                  setShowSkillModal(true)
                                }}
                                className="px-3 py-1 text-green-700 hover:text-green-800 text-sm border border-green-200 rounded hover:bg-green-50"
                              >
                                Edit
                              </button>
                            )}
                            {hasPermission('skill-delete') && (
                              <button
                                onClick={() => handleDeleteSkill(skill.skill_id)}
                                className="px-3 py-1 text-red-600 hover:text-red-800 text-sm border border-red-200 rounded hover:bg-red-50"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <svg className="w-12 h-12 mx-auto mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <p className="text-lg font-medium mb-2">No skills found</p>
                  <p className="text-sm">
                    {skillSearchTerm.trim() || skillsManagementParentCategoryFilter.length > 0 || skillsManagementSkillCategoryFilter.length > 0
                      ? 'Try adjusting your search or filter criteria.' 
                      : 'No skills have been created yet.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'certificate-management' && hasPermission('view-certificate-management') && (
          <div className="animate-fade-in">
            {/* Certificate Management Section */}
            <div className="card p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-medium font-semibold text-slate-900">Certificates Management ({filteredCertificatesForManagement.length})</h3>
                {hasPermission('certificate-add') && (
                  <button 
                    onClick={() => {
                      setEditingCertificate(null)
                      setCertificateManagementForm({
                        certificate_name: '',
                        certificate_category: 'Web Development',
                        difficulty_level: '',
                        issued_by: '',
                        certificate_number: '',
                        custom_parent_category: ''
                      })
                      setIsCreatingCertificate(false)
                      setIsUpdatingCertificate(false)
                      setShowCertificateManagementModal(true)
                    }}
                    className="px-3 py-2 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 transition-all duration-200 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                    </svg>
                    Add Certificate
                  </button>
                )}
              </div>
              
              {/* Search and Filter Controls */}
              <div className="mb-6 space-y-4">
                <div className="flex flex-row gap-4">
                  {/* Search Box */}
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      placeholder="Search certificates..."
                      value={certificateSearchTerm}
                      onChange={(e) => setCertificateSearchTerm(e.target.value)}
                      className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-800 focus:border-transparent transition-all duration-200"
                    />
                    {certificateSearchTerm && (
                      <button
                        onClick={() => setCertificateSearchTerm('')}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 transition-colors"
                        type="button"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                      </button>
                    )}
                  </div>
                  <AIFilterButton />
                  {/* Filter Button */}
                  <button
                    onClick={() => setShowCertificateManagementFilters(!showCertificateManagementFilters)}
                    className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 border ${
                      showCertificateManagementFilters || 
                      certificateManagementParentCategoryFilter.length > 0 || 
                      certificateManagementDifficultyFilter.length > 0 ||
                      certificateSearchTerm.trim()
                        ? 'bg-green-700 text-white border-green-700'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.207A1 1 0 013 6.5V4z"/>
                    </svg>
                    Filters
                    <svg 
                      className={`w-4 h-4 transition-transform duration-200 ${showCertificateManagementFilters ? 'rotate-180' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
                    </svg>
                  </button>
                  
                  {/* View Toggle Buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCertificateViewMode('grid')}
                      className={`p-2 rounded-lg transition-all duration-200 ${
                        certificateViewMode === 'grid'
                          ? 'bg-green-700 text-white shadow-md'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                      title="Grid View"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setCertificateViewMode('list')}
                      className={`p-2 rounded-lg transition-all duration-200 ${
                        certificateViewMode === 'list'
                          ? 'bg-green-700 text-white shadow-md'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                      title="List View"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                {/* Filter Options Panel - Collapsible */}
                {showCertificateManagementFilters && (
                  <div className="px-6 py-4 border border-slate-200 bg-slate-50 animate-fade-in rounded-md">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-slate-900">Filter Options</h3>
                      <button
                        onClick={() => setShowCertificateManagementFilters(false)}
                        className="text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                      </button>
                    </div>
                    
                    {/* Filter Controls */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 relative" style={{ zIndex: 40 }}>
                      <MultiSelect
                        label="Certificate Category"
                        options={[
                          ...parentCertificateCategories.map(category => ({ value: category, label: category })),
                          { value: 'Others', label: 'Others' }
                        ]}
                        selectedValues={certificateManagementParentCategoryFilter}
                        onSelectionChange={setCertificateManagementParentCategoryFilter}
                        placeholder="All Categories"
                        searchPlaceholder="Filter categories..."
                      />
                      
                      <MultiSelect
                        label="Difficulty Level"
                        options={[
                          { value: 'Easy', label: 'Easy' },
                          { value: 'Medium', label: 'Medium' },
                          { value: 'Tough', label: 'Tough' }
                        ]}
                        selectedValues={certificateManagementDifficultyFilter}
                        onSelectionChange={setCertificateManagementDifficultyFilter}
                        placeholder="All Difficulties"
                        searchPlaceholder="Filter difficulties..."
                      />
                    </div>
                    
                    {/* Clear All Filters Button */}
                    {(certificateManagementParentCategoryFilter.length > 0 || 
                      certificateManagementDifficultyFilter.length > 0 ||
                      certificateSearchTerm.trim()) && (
                      <div className="flex justify-end mt-4">
                        <button
                          onClick={() => {
                            setCertificateManagementParentCategoryFilter([])
                            setCertificateManagementDifficultyFilter([])
                            setCertificateSearchTerm('')
                          }}
                          className="text-sm text-green-700 hover:text-green-800 font-medium transition-colors duration-200"
                        >
                          Clear all filters
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {filteredCertificatesForManagement.length > 0 ? (
                certificateViewMode === 'grid' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredCertificatesForManagement.map(certificate => (
                      <div key={certificate.certificate_id} className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-semibold text-slate-900">{certificate.certificate_name}</h4>
                          <div className="flex gap-1">
                            {hasPermission('certificate-edit') && (
                              <button
                                onClick={() => {
                                  setEditingCertificate(certificate)
                                  setCertificateManagementForm({
                                    certificate_name: certificate.certificate_name,
                                    certificate_category: certificate.certificate_category || 'Web Development',
                                    difficulty_level: certificate.difficulty_level || '',
                                    issued_by: certificate.issued_by || '',
                                    certificate_number: certificate.certificate_number || '',
                                    custom_parent_category: ''
                                  })
                                  setIsCreatingCertificate(false)
                                  setIsUpdatingCertificate(false)
                                  setShowCertificateManagementModal(true)
                                }}
                                className="text-green-700 hover:text-green-800 text-sm"
                              >
                                Edit
                              </button>
                            )}
                            {hasPermission('certificate-delete') && (
                              <button
                                onClick={() => handleDeleteCertificateManagement(certificate.certificate_id)}
                                className="text-red-600 hover:text-red-800 text-sm ml-2"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            certificate.certificate_category === 'Web Development' ? 'bg-green-100 text-green-800' :
                            certificate.certificate_category === 'Mobile Development' ? 'bg-green-100 text-green-800' :
                            certificate.certificate_category === 'Database Management' ? 'bg-purple-100 text-purple-800' :
                            certificate.certificate_category === 'Elastic' ? 'bg-yellow-100 text-yellow-800' :
                            certificate.certificate_category === 'Networking' ? 'bg-red-100 text-red-800' :
                            certificate.certificate_category === 'Security' ? 'bg-cyan-100 text-cyan-800' :
                            certificate.certificate_category === 'Cloud Technologies' ? 'bg-orange-100 text-orange-800' :
                            certificate.certificate_category === 'AI/ML' ? 'bg-pink-100 text-pink-800' :
                            certificate.certificate_category === 'Data Science' ? 'bg-indigo-100 text-indigo-800' :
                            certificate.certificate_category === 'Blockchain' ? 'bg-teal-100 text-teal-800' :
                            certificate.certificate_category === 'Cybersecurity' ? 'bg-rose-100 text-rose-800' :
                            certificate.certificate_category === 'Game Development' ? 'bg-violet-100 text-violet-800' :
                            certificate.certificate_category === 'Data Engineering' ? 'bg-emerald-100 text-emerald-800' :
                            certificate.certificate_category === 'Data Visualization' ? 'bg-amber-100 text-amber-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {certificate.certificate_category}
                          </span>
                          {certificate.difficulty_level && certificate.difficulty_level.trim() && (
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              certificate.difficulty_level === 'Easy' ? 'bg-green-100 text-green-800' :
                              certificate.difficulty_level === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                              certificate.difficulty_level === 'Tough' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {certificate.difficulty_level}
                            </span>
                          )}
                          <span className="text-sm text-slate-500">
                            {employeeCertificateAssignments.filter(assignment => assignment.certificate_id === certificate.certificate_id).length} employees
                          </span>
                        </div>
                        {certificate.description && (
                          <div className="mt-2">
                            <span className="text-xs text-slate-500">{certificate.description}</span>
                          </div>
                        )}
                        {certificate.expiry_date && (
                          <div className="mt-2">
                            <span className="text-xs text-slate-500">
                              Expires: {new Date(certificate.expiry_date).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredCertificatesForManagement.map(certificate => (
                      <div key={certificate.certificate_id} className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-center">
                          <div className="flex-1">
                            <div className="flex items-center gap-4">
                              <h6 className="font-semibold text-slate-900 text-lg">{certificate.certificate_name}</h6>
                              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                certificate.certificate_category === 'Web Development' ? 'bg-green-100 text-green-800' :
                                certificate.certificate_category === 'Mobile Development' ? 'bg-green-100 text-green-800' :
                                certificate.certificate_category === 'Database Management' ? 'bg-purple-100 text-purple-800' :
                                certificate.certificate_category === 'Elastic' ? 'bg-yellow-100 text-yellow-800' :
                                certificate.certificate_category === 'Networking' ? 'bg-red-100 text-red-800' :
                                certificate.certificate_category === 'Security' ? 'bg-cyan-100 text-cyan-800' :
                                certificate.certificate_category === 'Cloud Technologies' ? 'bg-orange-100 text-orange-800' :
                                certificate.certificate_category === 'AI/ML' ? 'bg-pink-100 text-pink-800' :
                                certificate.certificate_category === 'Data Science' ? 'bg-indigo-100 text-indigo-800' :
                                certificate.certificate_category === 'Blockchain' ? 'bg-teal-100 text-teal-800' :
                                certificate.certificate_category === 'Cybersecurity' ? 'bg-rose-100 text-rose-800' :
                                certificate.certificate_category === 'Game Development' ? 'bg-violet-100 text-violet-800' :
                                certificate.certificate_category === 'Data Engineering' ? 'bg-emerald-100 text-emerald-800' :
                                certificate.certificate_category === 'Data Visualization' ? 'bg-amber-100 text-amber-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {certificate.certificate_category}
                              </span>
                              {certificate.difficulty_level && certificate.difficulty_level.trim() && (
                                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                  certificate.difficulty_level === 'Easy' ? 'bg-green-100 text-green-800' :
                                  certificate.difficulty_level === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                                  certificate.difficulty_level === 'Tough' ? 'bg-red-100 text-red-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {certificate.difficulty_level}
                                </span>
                              )}
                              <span className="text-sm text-slate-500">
                                {employeeCertificateAssignments.filter(assignment => assignment.certificate_id === certificate.certificate_id).length} employees
                              </span>
                              {certificate.certificate_number && (
                                <span className="text-sm text-slate-600 bg-slate-100 px-2 py-1 rounded">
                                  #{certificate.certificate_number}
                                </span>
                              )}
                              {certificate.expiry_date && (
                                <span className="text-sm text-slate-600 bg-slate-100 px-2 py-1 rounded">
                                  Expires: {new Date(certificate.expiry_date).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                            {certificate.description && (
                              <div className="mt-2">
                                <span className="text-sm text-slate-600">{certificate.description}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            {hasPermission('certificate-edit') && (
                              <button
                                onClick={() => {
                                  setEditingCertificate(certificate)
                                  setCertificateManagementForm({
                                    certificate_name: certificate.certificate_name,
                                    certificate_category: certificate.certificate_category || 'Web Development',
                                    difficulty_level: certificate.difficulty_level || '',
                                    issued_by: certificate.issued_by || '',
                                    certificate_number: certificate.certificate_number || '',
                                    custom_parent_category: ''
                                  })
                                  setIsCreatingCertificate(false)
                                  setIsUpdatingCertificate(false)
                                  setShowCertificateManagementModal(true)
                                }}
                                className="px-3 py-1 text-green-700 hover:text-green-800 text-sm border border-green-200 rounded hover:bg-green-50"
                              >
                                Edit
                              </button>
                            )}
                            {hasPermission('certificate-delete') && (
                              <button
                                onClick={() => handleDeleteCertificateManagement(certificate.certificate_id)}
                                className="px-3 py-1 text-red-600 hover:text-red-800 text-sm border border-red-200 rounded hover:bg-red-50"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <svg className="w-12 h-12 mx-auto mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <p className="text-lg font-medium mb-2">No certificates found</p>
                  <p className="text-sm">
                    {certificateSearchTerm.trim() || certificateManagementParentCategoryFilter.length > 0 || certificateManagementDifficultyFilter.length > 0
                      ? 'Try adjusting your search or filter criteria.' 
                      : 'No certificates have been created yet.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'skills-matrix' && hasPermission('view-skills-matrix') && (
          <div className="animate-fade-in">
        {/* Search and Filter Container */}
        <div className="px-6 py-4 border-b border-slate-200 bg-white rounded-md shadow-md">
          {/* Search Bar and Filter Button */}
          <div className="flex items-center gap-4 mb-4">
              {/* Employee Search Box */}
              <div className="flex-1">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search employees..."
                  value={skillsMatrixSearchTerm}
                  onChange={(e) => setSkillsMatrixSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-10 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-800 focus:border-transparent transition-all duration-200"
                />
                {skillsMatrixSearchTerm && (
                  <button
                    onClick={() => setSkillsMatrixSearchTerm('')}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 transition-colors"
                    type="button"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                )}
              </div>
              </div>

              {/* Skills Search Box */}
              <div className="flex-1">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search skills..."
                  value={skillsMatrixSkillsSearchTerm}
                  onChange={(e) => setSkillsMatrixSkillsSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-10 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-800 focus:border-transparent transition-all duration-200"
                />
                {skillsMatrixSkillsSearchTerm && (
                  <button
                    onClick={() => setSkillsMatrixSkillsSearchTerm('')}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 transition-colors"
                    type="button"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                )}
              </div>
              </div>

              {/* Filter Button */}
              <button
                onClick={() => setShowSkillsMatrixFilters(!showSkillsMatrixFilters)}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 border ${
                showSkillsMatrixFilters || 
                skillsMatrixDepartmentFilter.length > 0 || 
                skillsMatrixLocationFilter.length > 0 ||
                skillsMatrixSkillsParentCategoryFilter.length > 0 || 
                skillsMatrixSkillsFilter.length > 0 ||
                skillsMatrixSkillLevelFilter.length > 0 ||
                skillsMatrixCertifiedFilter !== 'All' ||
                (skillsMatrixStatusFilter.length > 0 && !(skillsMatrixStatusFilter.length === 1 && skillsMatrixStatusFilter.includes('Active'))) ||
                skillsMatrixAssignStatusFilter !== 'All' ||
                skillsMatrixSearchTerm.trim() ||
                skillsMatrixSkillsSearchTerm.trim()
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.207A1 1 0 013 6.5V4z"/>
                </svg>
                Filters
                <svg 
                  className={`w-4 h-4 transition-transform duration-200 ${showSkillsMatrixFilters ? 'rotate-180' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
                </svg>
              </button>
            
            {/* Action Buttons */}
            <div className="flex gap-2">
              {hasPermission('skill-add') && (
                <button
                  onClick={() => {
                    setMultiAllocSkillForm({
                      emp_ids: [],
                      skill_id: '',
                      proficiency_level: 'Beginner',
                      certified: false,
                      certification_name: '',
                      last_assessed: '',
                      selected_certification: '',
                      custom_certification_name: '',
                      start_date: '',
                      expiry_date: '',
                      description_note: ''
                    })
                    setEmployeeSearchTerm('')
                    setShowEmployeeDropdown(false)
                    setMultiAllocSkillSearchTerm('')
                    setShowSkillDropdown(false)
                    setIsCreatingMultiAllocSkill(false)
                    clearMultiAllocSkillAlert() // Clear any previous alerts
                    setShowMultiAllocSkillModal(true)
                  }}
                  className="px-3 py-2 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 transition-all duration-200 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                  </svg>
                  Multi Alloc Skill
                </button>
              )}
              
              {hasPermission('matrix-import') && (
                <button 
                  onClick={() => {
                    setShowImportSelectionModal(false)
                    setShowSkillsBulkImport(true)
                  }}
                  className="px-3 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-all duration-200 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"/>
                  </svg>
                  Skills Bulk Import
                </button>
              )}
              
              {hasPermission('matrix-export') && (
                <button 
                  onClick={handleExportSkills}
                  className="px-3 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-all duration-200 flex items-center gap-2"
                  title="Export filtered skills to Excel"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                  Export
                </button>
              )}
              </div>
            </div>
            
            {/* Filter Options Panel - Collapsible */}
            {showSkillsMatrixFilters && (
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 animate-fade-in rounded-md">
              <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-slate-900">Filter Options</h3>
                  <button
                    onClick={() => setShowSkillsMatrixFilters(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                  >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
                
                {/* Filter Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 relative" style={{ zIndex: 40 }}>
                
                <MultiSelect
                    label="Skills Parent"
                    options={[
                      ...parentSkillCategories.map(category => ({ value: category, label: category })),
                      { value: 'Others', label: 'Others' }
                    ]}
                    selectedValues={skillsMatrixSkillsParentCategoryFilter}
                    onSelectionChange={(values) => {
                      setSkillsMatrixSkillsParentCategoryFilter(values)
                      // Filter skills filter to only include skills from selected parent categories
                      if (values.length > 0) {
                        // Compute filtered skills based on new parent category selection
                        const filteredSkills = skills.filter(skill => {
                          if (values.includes('Others')) {
                            return !skill.parent_skill || skill.parent_skill.trim() === ''
                          }
                          return skill.parent_skill && values.includes(skill.parent_skill)
                        }).map(skill => skill.skill_name)
                        
                        // Remove invalid skill selections
                        setSkillsMatrixSkillsFilter(prev => 
                          prev.filter(skillName => filteredSkills.includes(skillName))
                        )
                      }
                    }}
                    placeholder="All Categories"
                    searchPlaceholder="Filter categories..."
                  />

                <MultiSelect
                    label="Skills"
                    options={getFilteredSkillsForMatrix.map(skill => ({ value: skill.skill_name, label: skill.skill_name }))}
                    selectedValues={skillsMatrixSkillsFilter}
                    onSelectionChange={setSkillsMatrixSkillsFilter}
                    placeholder="All Skills"
                    searchPlaceholder="Filter skills..."
                  />
                  
                  <MultiSelect
                    label="Skill Level"
                    options={[
                      { value: 'Beginner', label: 'Beginner' },
                      { value: 'Intermediate', label: 'Intermediate' },
                      { value: 'Advanced', label: 'Advanced' },
                      { value: 'Expert', label: 'Expert' }
                    ]}
                    selectedValues={skillsMatrixSkillLevelFilter}
                    onSelectionChange={setSkillsMatrixSkillLevelFilter}
                    placeholder="All Levels"
                    searchPlaceholder="Filter skill levels..."
                  />

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Certified
                    </label>
                    <select
                      value={skillsMatrixCertifiedFilter}
                      onChange={(e) => setSkillsMatrixCertifiedFilter(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800 text-sm"
                    >
                      <option value="All">All</option>
                      <option value="Certified">Certified</option>
                      <option value="Not Certified">Not Certified</option>
                    </select>
                  </div>

                  <MultiSelect
                    label="Department"
                    options={departments.map(dept => ({ value: dept, label: dept }))}
                    selectedValues={skillsMatrixDepartmentFilter}
                    onSelectionChange={setSkillsMatrixDepartmentFilter}
                    placeholder="All Departments"
                    searchPlaceholder="Filter departments..."
                  />

                  <MultiSelect
                    label="Location"
                    options={uniqueLocations.map(location => ({ value: location, label: location }))}
                    selectedValues={skillsMatrixLocationFilter}
                    onSelectionChange={setSkillsMatrixLocationFilter}
                    placeholder="All Locations"
                    searchPlaceholder="Filter locations..."
                  />

                  <MultiSelect
                    label="Status"
                    options={[
                      { value: 'Active', label: 'Active' },
                      { value: 'Inactive', label: 'Inactive' },
                      { value: 'Resigned', label: 'Resigned' },
                      { value: 'Terminated', label: 'Terminated' }
                    ]}
                    selectedValues={skillsMatrixStatusFilter}
                    onSelectionChange={setSkillsMatrixStatusFilter}
                    placeholder="All Status"
                    searchPlaceholder="Filter status..."
                  />

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Assign Status
                    </label>
                    <select
                      value={skillsMatrixAssignStatusFilter}
                      onChange={(e) => setSkillsMatrixAssignStatusFilter(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800 text-sm"
                    >
                      <option value="All">All</option>
                      <option value="Assigned">Assigned</option>
                      <option value="Not Assigned">Not Assigned</option>
                    </select>
                  </div>

                </div>
                
                {/* Clear All Filters Button */}
              {(skillsMatrixDepartmentFilter.length > 0 || 
                skillsMatrixLocationFilter.length > 0 ||
                skillsMatrixSkillsParentCategoryFilter.length > 0 || 
                skillsMatrixSkillsFilter.length > 0 ||
                skillsMatrixSkillLevelFilter.length > 0 ||
                skillsMatrixCertifiedFilter !== 'All' ||
                (skillsMatrixStatusFilter.length > 0 && !(skillsMatrixStatusFilter.length === 1 && skillsMatrixStatusFilter.includes('Active'))) ||
                skillsMatrixAssignStatusFilter !== 'All' ||
                skillsMatrixSearchTerm.trim() ||
                skillsMatrixSkillsSearchTerm.trim()) && (
                  <div className="flex justify-end mt-4">
                    <button
                      onClick={() => {
                        setSkillsMatrixDepartmentFilter([])
                        setSkillsMatrixLocationFilter([])
                        setSkillsMatrixSkillsParentCategoryFilter([])
                        setSkillsMatrixSkillsFilter([])
                        setSkillsMatrixSkillLevelFilter([])
                        setSkillsMatrixCertifiedFilter('All')
                        setSkillsMatrixStatusFilter(['Active'])
                        setSkillsMatrixAssignStatusFilter('All')
                        setSkillsMatrixSearchTerm('')
                        setSkillsMatrixSkillsSearchTerm('')
                      }}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors duration-200"
                    >
                      Clear all filters
                    </button>
                  </div>
                )}
              </div>
            )}
        </div>

        {/* Skills Matrix Container */}
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-6">
              <h2 className="text-medium font-semibold text-slate-900">
                Skills ({filteredEmployeesForSkillsMatrix.length} {filteredEmployeesForSkillsMatrix.length === 1 ? 'employee' : 'employees'})
              </h2>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto shadow-md rounded-md bg-white">
          {/* Matrix Header */}
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                </svg>
                <span className="text-sm font-semibold text-slate-900">Matrix Legend & Instructions</span>
              </div>
              
              {/* Instructions and Legend - Responsive */}
              <div className="flex flex-col lg:flex-row gap-4 text-xs text-slate-500 font-medium w-full lg:w-auto">
                <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                  <span className="hidden sm:inline">Click any cell to edit • Popup editor </span>
                  <span className="sm:hidden">Tap any cell to edit</span>
                  
                  {/* Legend - Responsive */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="hidden sm:inline">Legend:</span>
                    <div className="flex flex-wrap items-center gap-1">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-green-100 text-green-800 rounded-full text-xs flex items-center justify-center font-semibold">E</div>
                        <span className="hidden sm:inline">Expert</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-green-100 text-green-800 rounded-full text-xs flex items-center justify-center font-semibold">A</div>
                        <span className="hidden sm:inline">Advanced</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-yellow-100 text-yellow-800 rounded-full text-xs flex items-center justify-center font-semibold">I</div>
                        <span className="hidden sm:inline">Intermediate</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-gray-100 text-gray-800 rounded-full text-xs flex items-center justify-center font-semibold">B</div>
                        <span className="hidden sm:inline">Beginner</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="text-green-600">✓</div>
                        <span className="hidden sm:inline">Certified</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Filter summaries */}
                {skillsMatrixSkillLevelFilter.length > 0 && (
                  <div className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium self-start lg:self-center">
                    {filteredEmployeesForSkillsMatrix.length} employees, {skills.filter(s => {
                      const skillLevels = employeeSkills.filter(es => 
                        es.skill_id === s.skill_id && skillsMatrixSkillLevelFilter.includes(es.proficiency_level)
                      )
                      return skillLevels.length > 0
                    }).length} skills at {skillsMatrixSkillLevelFilter.join(', ')} level
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Skills Matrix Table */}
          <div className="overflow-x-auto max-h-[calc(100vh-300px)] overflow-y-auto">
            <table className="w-full border-collapse text-sm min-w-[800px]">
                <thead className="sticky top-0 z-20">
                  <tr>
                    <th className="bg-slate-50 border border-slate-200 p-2 sm:p-4 text-left font-semibold text-slate-900 min-w-48 sm:min-w-56 sticky left-0 z-30">
                      <div className="flex items-center gap-2">
                        <span className="hidden sm:inline">Employee</span>
                        <span className="sm:hidden">Emp</span>
                      </div>
                    </th>
                  
                  {/* Hard Skills Category Header */}
                  {filteredSkillsForMatrix.filter(s => s.skill_category === 'Technical Skill').length > 0 && 
                   // Only show header if there are skills to display (considering skill filter and parent category filter)
                   (() => {
                     let skillsToShow = filteredSkillsForMatrix.filter(s => s.skill_category === 'Technical Skill')
                     // Apply parent category filter
                     if (skillsMatrixSkillsParentCategoryFilter.length > 0) {
                       skillsToShow = skillsToShow.filter(skill => {
                         if (skillsMatrixSkillsParentCategoryFilter.includes('Others')) {
                           return !skill.parent_skill || skill.parent_skill.trim() === ''
                         } else {
                           return skill.parent_skill && skillsMatrixSkillsParentCategoryFilter.includes(skill.parent_skill)
                         }
                       })
                     }
                     // Apply skill name filter
                     if (skillsMatrixSkillsFilter.length > 0) {
                       skillsToShow = skillsToShow.filter(skill => skillsMatrixSkillsFilter.includes(skill.skill_name))
                     }
                     return skillsToShow.length > 0
                   })() && (
                    <>
                      <th 
                        className="bg-slate-200 border border-slate-200 p-1 sm:p-2 text-center font-bold text-slate-700 text-xs uppercase tracking-wider min-w-12 sm:min-w-16 cursor-pointer hover:bg-slate-300 transition-colors duration-200 sticky top-0 z-20"
                        onClick={() => toggleAccordion('hardSkills')}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span className="hidden sm:inline">TECHNICAL SKILLS</span>
                          <span className="sm:hidden">TECHNICAL</span>
                          <svg 
                            className="w-3 h-3 sm:w-4 sm:h-4" 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            {accordionState.hardSkills ? (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4"/>
                            ) : (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                            )}
                          </svg>
                        </div>
                      </th>
                      
                      {/* Hard Skills Headers */}
                      {accordionState.hardSkills && filteredSkillsForMatrix.filter(s => s.skill_category === 'Technical Skill').map(skill => {
                        // If a specific skill is selected, only show that skill column
                        if (skillsMatrixSkillsFilter.length > 0 && !skillsMatrixSkillsFilter.includes(skill.skill_name)) {
                          return null
                        }
                        // Filter by parent category - only show skills that belong to selected parent categories
                        if (skillsMatrixSkillsParentCategoryFilter.length > 0) {
                          // Handle "Others" category - skills without parent_skill or with empty parent_skill
                          if (skillsMatrixSkillsParentCategoryFilter.includes('Others')) {
                            // Show if skill has no parent or empty parent
                            if (skill.parent_skill && skill.parent_skill.trim() !== '') {
                              return null
                            }
                          } else {
                            // Show only if skill's parent is in the selected parent categories
                            if (!skill.parent_skill || !skillsMatrixSkillsParentCategoryFilter.includes(skill.parent_skill)) {
                              return null
                            }
                          }
                        }
                        return (
                          <th key={skill.skill_id} className="bg-slate-50 border border-slate-200 p-2 sm:p-3 text-center font-semibold text-slate-900 min-w-28 sm:min-w-40 max-w-56 sm:max-w-80 sticky top-0 z-20">
                            <div className="text-[10px] sm:text-xs break-words line-clamp-4 px-1">
                              {skill.skill_name}
                            </div>
                          </th>
                        )
                      })}
                    </>
                  )}
                  
                  {/* Soft Skills Category Header */}
                  {filteredSkillsForMatrix.filter(s => s.skill_category === 'Non-Technical Skill').length > 0 && 
                   // Only show header if there are skills to display (considering skill filter and parent category filter)
                   (() => {
                     let skillsToShow = filteredSkillsForMatrix.filter(s => s.skill_category === 'Non-Technical Skill')
                     // Apply parent category filter
                     if (skillsMatrixSkillsParentCategoryFilter.length > 0) {
                       skillsToShow = skillsToShow.filter(skill => {
                         if (skillsMatrixSkillsParentCategoryFilter.includes('Others')) {
                           return !skill.parent_skill || skill.parent_skill.trim() === ''
                         } else {
                           return skill.parent_skill && skillsMatrixSkillsParentCategoryFilter.includes(skill.parent_skill)
                         }
                       })
                     }
                     // Apply skill name filter
                     if (skillsMatrixSkillsFilter.length > 0) {
                       skillsToShow = skillsToShow.filter(skill => skillsMatrixSkillsFilter.includes(skill.skill_name))
                     }
                     return skillsToShow.length > 0
                   })() && (
                    <>
                      <th 
                        className="bg-slate-200 border border-slate-200 p-1 sm:p-2 text-center font-bold text-slate-700 text-xs uppercase tracking-wider min-w-12 sm:min-w-16 cursor-pointer hover:bg-slate-300 transition-colors duration-200 sticky top-0 z-20"
                        onClick={() => toggleAccordion('softSkills')}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span className="hidden sm:inline">NON-TECHNICAL SKILLS</span>
                          <span className="sm:hidden">NON-TECHNICAL</span>
                          <svg 
                            className="w-3 h-3 sm:w-4 sm:h-4" 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            {accordionState.softSkills ? (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4"/>
                            ) : (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                            )}
                          </svg>
                        </div>
                      </th>
                      
                      {/* Soft Skills Headers */}
                      {accordionState.softSkills && filteredSkillsForMatrix.filter(s => s.skill_category === 'Non-Technical Skill').map(skill => {
                        // If a specific skill is selected, only show that skill column
                        if (skillsMatrixSkillsFilter.length > 0 && !skillsMatrixSkillsFilter.includes(skill.skill_name)) {
                          return null
                        }
                        // Filter by parent category - only show skills that belong to selected parent categories
                        if (skillsMatrixSkillsParentCategoryFilter.length > 0) {
                          // Handle "Others" category - skills without parent_skill or with empty parent_skill
                          if (skillsMatrixSkillsParentCategoryFilter.includes('Others')) {
                            // Show if skill has no parent or empty parent
                            if (skill.parent_skill && skill.parent_skill.trim() !== '') {
                              return null
                            }
                          } else {
                            // Show only if skill's parent is in the selected parent categories
                            if (!skill.parent_skill || !skillsMatrixSkillsParentCategoryFilter.includes(skill.parent_skill)) {
                              return null
                            }
                          }
                        }
                        return (
                          <th key={skill.skill_id} className="bg-slate-50 border border-slate-200 p-2 sm:p-3 text-center font-semibold text-slate-900 min-w-28 sm:min-w-40 max-w-56 sm:max-w-80 sticky top-0 z-20">
                            <div className="text-[10px] sm:text-xs break-words line-clamp-4 px-1">
                              {skill.skill_name}
                            </div>
                          </th>
                        )
                      })}
                    </>
                  )}
                  
                  
                  
                </tr>
              </thead>
              <tbody>
                {filteredEmployeesForSkillsMatrix.map(employee => (
                  <tr key={employee.id} className="hover:bg-slate-50 transition-colors border-b border-slate-200">
                    {/* Employee Cell */}
                    <td className="border border-slate-200 p-2 sm:p-4 bg-slate-50 border-r-2 border-r-slate-400 sticky left-0 z-10">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="avatar avatar-sm bg-green-700 flex-shrink-0">
                          <span className="text-xs font-semibold">
                            {employee.first_name?.[0]}{employee.last_name?.[0]}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-slate-900 text-xs sm:text-sm truncate">
                            {employee.first_name} {employee.last_name}
                          </div>
                          <div className="text-xs text-slate-500 font-medium truncate">
                            {employee.designation}
                          </div>
                        </div>
                      </div>
                    </td>
                    
                    {/* Hard Skills Category Spacer */}
                    {(() => {
                      let skillsToShow = filteredSkillsForMatrix.filter(s => s.skill_category === 'Technical Skill')
                      // Apply parent category filter
                      if (skillsMatrixSkillsParentCategoryFilter.length > 0) {
                        skillsToShow = skillsToShow.filter(skill => {
                          if (skillsMatrixSkillsParentCategoryFilter.includes('Others')) {
                            return !skill.parent_skill || skill.parent_skill.trim() === ''
                          } else {
                            return skill.parent_skill && skillsMatrixSkillsParentCategoryFilter.includes(skill.parent_skill)
                          }
                        })
                      }
                      // Apply skill name filter
                      if (skillsMatrixSkillsFilter.length > 0) {
                        skillsToShow = skillsToShow.filter(skill => skillsMatrixSkillsFilter.includes(skill.skill_name))
                      }
                      return skillsToShow.length > 0
                    })() && (
                      <td className="bg-slate-200 border border-slate-200"></td>
                    )}
                    
                    {/* Hard Skills Cells */}
                    {accordionState.hardSkills && 
                     filteredSkillsForMatrix.filter(s => s.skill_category === 'Technical Skill').map(skill => {
                      // If a specific skill is selected, only show that skill column
                      if (skillsMatrixSkillsFilter.length > 0 && !skillsMatrixSkillsFilter.includes(skill.skill_name)) {
                        return null
                      }
                      // Filter by parent category - only show skills that belong to selected parent categories
                      if (skillsMatrixSkillsParentCategoryFilter.length > 0) {
                        // Handle "Others" category - skills without parent_skill or with empty parent_skill
                        if (skillsMatrixSkillsParentCategoryFilter.includes('Others')) {
                          // Show if skill has no parent or empty parent
                          if (skill.parent_skill && skill.parent_skill.trim() !== '') {
                            return null
                          }
                        } else {
                          // Show only if skill's parent is in the selected parent categories
                          if (!skill.parent_skill || !skillsMatrixSkillsParentCategoryFilter.includes(skill.parent_skill)) {
                            return null
                          }
                        }
                      }
                      const employeeSkill = getEmployeeSkill(employee.id, skill.skill_id)
                      const canEdit = canEditEmployee(employee.id)
                      return (
                        <td 
                          key={skill.skill_id} 
                          onClick={canEdit ? () => handleCellClick(employee, skill) : undefined}
                          className={`border border-slate-200 p-2 sm:p-3 text-center transition-all duration-200 group min-w-28 sm:min-w-40 max-w-56 sm:max-w-80 ${
                            employeeSkill?.certified 
                              ? 'bg-green-100 hover:bg-green-200 border-green-300' 
                              : canEdit 
                              ? 'cursor-pointer hover:bg-green-50 hover:border-green-300' 
                              : 'cursor-default'
                          } ${canEdit && !employeeSkill?.certified ? 'cursor-pointer' : ''}`}
                        >
                          {employeeSkill ? (
                            <div className="flex flex-col items-center gap-1">
                              <div className={`px-1 sm:px-2 py-1 rounded-full text-xs font-medium ${
                                employeeSkill.proficiency_level === 'Expert' ? 'bg-green-100 text-green-800' :
                                employeeSkill.proficiency_level === 'Advanced' ? 'bg-green-100 text-green-800' :
                                employeeSkill.proficiency_level === 'Intermediate' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {employeeSkill.proficiency_level.charAt(0)}
                              </div>
                              {employeeSkill.certified && (
                                <div className="text-xs text-green-700 font-semibold" title="Certified">
                                  ✓
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-slate-400 group-hover:text-slate-600 font-medium text-xs">-</div>
                          )}
                        </td>
                      )
                    })}
                    
                    {/* Soft Skills Category Spacer */}
                    {(() => {
                      let skillsToShow = filteredSkillsForMatrix.filter(s => s.skill_category === 'Non-Technical Skill')
                      // Apply parent category filter
                      if (skillsMatrixSkillsParentCategoryFilter.length > 0) {
                        skillsToShow = skillsToShow.filter(skill => {
                          if (skillsMatrixSkillsParentCategoryFilter.includes('Others')) {
                            return !skill.parent_skill || skill.parent_skill.trim() === ''
                          } else {
                            return skill.parent_skill && skillsMatrixSkillsParentCategoryFilter.includes(skill.parent_skill)
                          }
                        })
                      }
                      // Apply skill name filter
                      if (skillsMatrixSkillsFilter.length > 0) {
                        skillsToShow = skillsToShow.filter(skill => skillsMatrixSkillsFilter.includes(skill.skill_name))
                      }
                      return skillsToShow.length > 0
                    })() && (
                      <td className="bg-slate-200 border border-slate-200"></td>
                    )}
                    
                    {/* Soft Skills Cells */}
                    {accordionState.softSkills && 
                     filteredSkillsForMatrix.filter(s => s.skill_category === 'Non-Technical Skill').map(skill => {
                      // If a specific skill is selected, only show that skill column
                      if (skillsMatrixSkillsFilter.length > 0 && !skillsMatrixSkillsFilter.includes(skill.skill_name)) {
                        return null
                      }
                      // Filter by parent category - only show skills that belong to selected parent categories
                      if (skillsMatrixSkillsParentCategoryFilter.length > 0) {
                        // Handle "Others" category - skills without parent_skill or with empty parent_skill
                        if (skillsMatrixSkillsParentCategoryFilter.includes('Others')) {
                          // Show if skill has no parent or empty parent
                          if (skill.parent_skill && skill.parent_skill.trim() !== '') {
                            return null
                          }
                        } else {
                          // Show only if skill's parent is in the selected parent categories
                          if (!skill.parent_skill || !skillsMatrixSkillsParentCategoryFilter.includes(skill.parent_skill)) {
                            return null
                          }
                        }
                      }
                      const employeeSkill = getEmployeeSkill(employee.id, skill.skill_id)
                      const canEdit = canEditEmployee(employee.id)
                      return (
                        <td 
                          key={skill.skill_id} 
                          onClick={canEdit ? () => handleCellClick(employee, skill) : undefined}
                          className={`border border-slate-200 p-2 sm:p-3 text-center transition-all duration-200 group min-w-28 sm:min-w-40 max-w-56 sm:max-w-80 ${
                            employeeSkill?.certified 
                              ? 'bg-green-100 hover:bg-green-200 border-green-300' 
                              : canEdit 
                              ? 'cursor-pointer hover:bg-green-50 hover:border-green-300' 
                              : 'cursor-default'
                          } ${canEdit && !employeeSkill?.certified ? 'cursor-pointer' : ''}`}
                        >
                          {employeeSkill ? (
                            <div className="flex flex-col items-center gap-1">
                              <div className={`px-1 sm:px-2 py-1 rounded-full text-xs font-medium ${
                                employeeSkill.proficiency_level === 'Expert' ? 'bg-green-100 text-green-800' :
                                employeeSkill.proficiency_level === 'Advanced' ? 'bg-green-100 text-green-800' :
                                employeeSkill.proficiency_level === 'Intermediate' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {employeeSkill.proficiency_level.charAt(0)}
                              </div>
                              {employeeSkill.certified && (
                                <div className="text-xs text-green-700 font-semibold" title="Certified">
                                  ✓
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-slate-400 group-hover:text-slate-600 font-medium text-xs">-</div>
                          )}
                        </td>
                      )
                    })}
                    
                    
                    
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary Stats */}
          <div className="bg-slate-100 border-t-2 border-slate-300 p-4 sm:p-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-6 text-center">
              <div className="hover-lift">
                <div className="text-lg sm:text-2xl font-bold text-green-700 mb-1">{filteredEmployeesForSkillsMatrix.length}</div>
                <div className="text-xs sm:text-sm text-slate-600 font-semibold">Total Employees</div>
              </div>
              <div className="hover-lift">
                <div className="text-lg sm:text-2xl font-bold text-green-700 mb-1">{hardSkillsCount}</div>
                <div className="text-xs sm:text-sm text-slate-600 font-semibold">Technical Skills</div>
              </div>
              <div className="hover-lift">
                <div className="text-lg sm:text-2xl font-bold text-green-700 mb-1">{softSkillsCount}</div>
                <div className="text-xs sm:text-sm text-slate-600 font-semibold">Non-Technical Skills</div>
              </div>
            </div>
          </div>
        </div>
          </div>
        )}

        {activeTab === 'certificate-matrix' && hasPermission('view-certificate-matrix') && (
          <div className="animate-fade-in">
        {/* Search and Filter Container */}
        <div className="px-6 py-4 border-b border-slate-200 bg-white rounded-md shadow-md">
          {/* Search Bar and Filter Button */}
          <div className="flex items-center gap-4 mb-4">
              {/* Employee Search Box */}
              <div className="flex-1">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search employees..."
                  value={certificateMatrixSearchTerm}
                  onChange={(e) => setCertificateMatrixSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-10 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-800 focus:border-transparent transition-all duration-200"
                />
                {certificateMatrixSearchTerm && (
                  <button
                    onClick={() => setCertificateMatrixSearchTerm('')}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 transition-colors"
                    type="button"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                )}
              </div>
              </div>

              {/* Certificates Search Box */}
              <div className="flex-1">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search certificates..."
                  value={certificateMatrixCertificatesSearchTerm}
                  onChange={(e) => setCertificateMatrixCertificatesSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-10 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-800 focus:border-transparent transition-all duration-200"
                />
                {certificateMatrixCertificatesSearchTerm && (
                  <button
                    onClick={() => setCertificateMatrixCertificatesSearchTerm('')}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 transition-colors"
                    type="button"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                )}
              </div>
              </div>

              {/* Filter Button */}
              <button
                onClick={() => setShowCertificateMatrixFilters(!showCertificateMatrixFilters)}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 border ${
                showCertificateMatrixFilters || 
                certificateMatrixDepartmentFilter.length > 0 || 
                certificateMatrixLocationFilter.length > 0 ||
                certificateMatrixCertificateParentCategoryFilter.length > 0 || 
                certificateMatrixCertificatesFilter.length > 0 ||
                certificateMatrixCertificateStatusFilter.length > 0 ||
                (certificateMatrixStatusFilter.length > 0 && !(certificateMatrixStatusFilter.length === 1 && certificateMatrixStatusFilter.includes('Active'))) ||
                certificateMatrixAssignStatusFilter !== 'All' ||
                certificateMatrixSearchTerm.trim() ||
                certificateMatrixCertificatesSearchTerm.trim()
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.207A1 1 0 013 6.5V4z"/>
                </svg>
                Filters
                <svg 
                  className={`w-4 h-4 transition-transform duration-200 ${showCertificateMatrixFilters ? 'rotate-180' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
                </svg>
              </button>
            
            {/* Action Buttons */}
            <div className="flex gap-2">
              {hasPermission('certificate-add') && (
                <button
                  onClick={() => {
                    setMultiAllocCertificateForm({
                      emp_ids: [],
                      certificate_id: '',
                      status: 'In-Progress',
                      start_date: '',
                      expiry_date: ''
                    })
                    setMultiAllocEmployeeSearchTerm('')
                    setShowMultiAllocEmployeeDropdown(false)
                    setMultiAllocCertificateSearchTerm('')
                    setShowMultiAllocCertificateDropdown(false)
                    setIsCreatingMultiAllocCertificate(false)
                    clearMultiAllocCertificateAlert() // Clear any previous alerts
                    setShowMultiAllocCertificateModal(true)
                  }}
                  className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-all duration-200 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  Multi Alloc Certificate
                </button>
              )}
              
              {hasPermission('matrix-import') && (
                <button 
                  onClick={() => {
                    setShowImportSelectionModal(false)
                    setShowCertificateBulkImport(true)
                  }}
                  className="px-3 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-all duration-200 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"/>
                  </svg>
                  Certificate Bulk Import
                </button>
              )}
              
              {hasPermission('matrix-export') && (
                <button 
                  onClick={handleExportCertificates}
                  className="px-3 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-all duration-200 flex items-center gap-2"
                  title="Export filtered certificates to Excel"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                  Export
                </button>
              )}
              </div>
            </div>
            
            {/* Filter Options Panel - Collapsible */}
            {showCertificateMatrixFilters && (
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 animate-fade-in rounded-md">
              <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-slate-900">Filter Options</h3>
                  <button
                    onClick={() => setShowCertificateMatrixFilters(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                  >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
                
                {/* Filter Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 relative" style={{ zIndex: 40 }}>
                  
                  <MultiSelect
                    label="Certificate Parent"
                    options={[
                      ...parentCertificateCategories.map(category => ({ value: category, label: category })),
                      { value: 'Others', label: 'Others' }
                    ]}
                    selectedValues={certificateMatrixCertificateParentCategoryFilter}
                    onSelectionChange={(values) => {
                      setCertificateMatrixCertificateParentCategoryFilter(values)
                      // Filter certificates filter to only include certificates from selected parent categories
                      if (values.length > 0) {
                        // Compute filtered certificates based on new parent category selection
                        const filteredCertificates = certificates.filter(certificate => {
                          if (values.includes('Others')) {
                            return !certificate.certificate_category || certificate.certificate_category.trim() === ''
                          }
                          return certificate.certificate_category && values.includes(certificate.certificate_category)
                        }).map(certificate => certificate.certificate_name)
                        
                        // Remove invalid certificate selections
                        setCertificateMatrixCertificatesFilter(prev => 
                          prev.filter(certName => filteredCertificates.includes(certName))
                        )
                      }
                    }}
                    placeholder="All Categories"
                    searchPlaceholder="Filter categories..."
                  />

                  <MultiSelect
                    label="Certificates"
                    options={getFilteredCertificatesForMatrix.map(certificate => ({ 
                      value: certificate.certificate_name, 
                      label: certificate.certificate_name 
                    }))}
                    selectedValues={certificateMatrixCertificatesFilter}
                    onSelectionChange={setCertificateMatrixCertificatesFilter}
                    placeholder="All Certificates"
                    searchPlaceholder="Filter certificates..."
                  />
                  
                  <MultiSelect
                    label="Certificate Status"
                    options={[
                      { value: 'In-Progress', label: 'In Progress' },
                      { value: 'Completed', label: 'Completed' }
                    ]}
                    selectedValues={certificateMatrixCertificateStatusFilter}
                    onSelectionChange={setCertificateMatrixCertificateStatusFilter}
                    placeholder="All Statuses"
                    searchPlaceholder="Filter statuses..."
                  />

                <MultiSelect
                    label="Department"
                    options={departments.map(dept => ({ value: dept, label: dept }))}
                    selectedValues={certificateMatrixDepartmentFilter}
                    onSelectionChange={setCertificateMatrixDepartmentFilter}
                    placeholder="All Departments"
                    searchPlaceholder="Filter departments..."
                  />

                  <MultiSelect
                    label="Location"
                    options={uniqueLocations.map(location => ({ value: location, label: location }))}
                    selectedValues={certificateMatrixLocationFilter}
                    onSelectionChange={setCertificateMatrixLocationFilter}
                    placeholder="All Locations"
                    searchPlaceholder="Filter locations..."
                  />

                  <MultiSelect
                    label="Status"
                    options={[
                      { value: 'Active', label: 'Active' },
                      { value: 'Inactive', label: 'Inactive' },
                      { value: 'Resigned', label: 'Resigned' },
                      { value: 'Terminated', label: 'Terminated' }
                    ]}
                    selectedValues={certificateMatrixStatusFilter}
                    onSelectionChange={setCertificateMatrixStatusFilter}
                    placeholder="All Status"
                    searchPlaceholder="Filter status..."
                  />

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Assign Status
                    </label>
                    <select
                      value={certificateMatrixAssignStatusFilter}
                      onChange={(e) => setCertificateMatrixAssignStatusFilter(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800 text-sm"
                    >
                      <option value="All">All</option>
                      <option value="Assigned">Assigned</option>
                      <option value="Not Assigned">Not Assigned</option>
                    </select>
                  </div>

                </div>
                
                {/* Clear All Filters Button */}
              {(certificateMatrixDepartmentFilter.length > 0 || 
                certificateMatrixLocationFilter.length > 0 ||
                certificateMatrixCertificateParentCategoryFilter.length > 0 || 
                certificateMatrixCertificatesFilter.length > 0 ||
                certificateMatrixCertificateStatusFilter.length > 0 ||
                (certificateMatrixStatusFilter.length > 0 && !(certificateMatrixStatusFilter.length === 1 && certificateMatrixStatusFilter.includes('Active'))) ||
                certificateMatrixAssignStatusFilter !== 'All' ||
                certificateMatrixSearchTerm.trim() ||
                certificateMatrixCertificatesSearchTerm.trim()) && (
                  <div className="flex justify-end mt-4">
                    <button
                      onClick={() => {
                        setCertificateMatrixDepartmentFilter([])
                        setCertificateMatrixLocationFilter([])
                        setCertificateMatrixCertificateParentCategoryFilter([])
                        setCertificateMatrixCertificatesFilter([])
                        setCertificateMatrixCertificateStatusFilter([])
                        setCertificateMatrixStatusFilter(['Active'])
                        setCertificateMatrixAssignStatusFilter('All')
                        setCertificateMatrixSearchTerm('')
                        setCertificateMatrixCertificatesSearchTerm('')
                      }}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors duration-200"
                    >
                      Clear all filters
                    </button>
                  </div>
                )}
              </div>
            )}
        </div>

        {/* Certificate Matrix Container */}
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-6">
              <h2 className="text-medium font-semibold text-slate-900">
                Certificates ({filteredEmployeesForCertificateMatrix.length} {filteredEmployeesForCertificateMatrix.length === 1 ? 'employee' : 'employees'})
              </h2>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto shadow-md rounded-md bg-white">
          {/* Matrix Header */}
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <span className="text-sm font-semibold text-slate-900">Matrix Legend & Instructions</span>
              </div>
              
              {/* Instructions and Legend - Responsive */}
              <div className="flex flex-col lg:flex-row gap-4 text-xs text-slate-500 font-medium w-full lg:w-auto">
                <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                  <span className="hidden sm:inline">Click any cell to edit • Popup editor </span>
                  <span className="sm:hidden">Tap any cell to edit</span>
                </div>
              </div>
            </div>
          </div>

          {/* Certificate Matrix Table */}
          <div className="overflow-x-auto max-h-[calc(100vh-300px)] overflow-y-auto">
            <table className="w-full border-collapse text-sm min-w-[800px]">
                <thead className="sticky top-0 z-20">
                  <tr>
                    <th className="bg-slate-50 border border-slate-200 p-2 sm:p-4 text-left font-semibold text-slate-900 min-w-48 sm:min-w-56 sticky left-0 z-30">
                      <div className="flex items-center gap-2">
                        <span className="hidden sm:inline">Employee</span>
                        <span className="sm:hidden">Emp</span>
                      </div>
                    </th>
                  
                  {/* Certificates List Category Header */}
                  {filteredCertificatesForMatrix.length > 0 && 
                   // Only show header if there are certificates to display (considering certificate filter and parent category filter)
                   (() => {
                     let certificatesToShow = filteredCertificatesForMatrix
                     // Apply parent category filter
                     if (certificateMatrixCertificateParentCategoryFilter.length > 0) {
                       certificatesToShow = certificatesToShow.filter(cert => {
                         if (certificateMatrixCertificateParentCategoryFilter.includes('Others')) {
                           return !cert.certificate_category || cert.certificate_category.trim() === ''
                         } else {
                           return cert.certificate_category && certificateMatrixCertificateParentCategoryFilter.includes(cert.certificate_category)
                         }
                       })
                     }
                     // Apply certificate name filter
                     if (certificateMatrixCertificatesFilter.length > 0) {
                       certificatesToShow = certificatesToShow.filter(cert => certificateMatrixCertificatesFilter.includes(cert.certificate_name))
                     }
                     return certificatesToShow.length > 0
                   })() && (
                    <>
                      <th 
                        className="bg-slate-200 border border-slate-200 p-1 sm:p-2 text-center font-bold text-slate-700 text-xs uppercase tracking-wider min-w-12 sm:min-w-16 cursor-pointer hover:bg-slate-300 transition-colors duration-200 sticky top-0 z-20"
                        onClick={() => toggleAccordion('certificatesList')}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span className="hidden sm:inline">CERTIFICATES LIST</span>
                          <span className="sm:hidden">CERTS</span>
                          <svg 
                            className="w-3 h-3 sm:w-4 sm:h-4" 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            {accordionState.certificatesList ? (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4"/>
                            ) : (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                            )}
                          </svg>
                        </div>
                      </th>
                      
                      {/* Certificates List Headers */}
                      {accordionState.certificatesList && filteredCertificatesForMatrix.map(certificate => {
                        // If a specific certificate is selected, only show that certificate column
                        if (certificateMatrixCertificatesFilter.length > 0 && !certificateMatrixCertificatesFilter.includes(certificate.certificate_name)) {
                          return null
                        }
                        // Filter by parent category - only show certificates that belong to selected parent categories
                        if (certificateMatrixCertificateParentCategoryFilter.length > 0) {
                          // Handle "Others" category - certificates without certificate_category or with empty certificate_category
                          if (certificateMatrixCertificateParentCategoryFilter.includes('Others')) {
                            // Show if certificate has no category or empty category
                            if (certificate.certificate_category && certificate.certificate_category.trim() !== '') {
                              return null
                            }
                          } else {
                            // Show only if certificate's category is in the selected parent categories
                            if (!certificate.certificate_category || !certificateMatrixCertificateParentCategoryFilter.includes(certificate.certificate_category)) {
                              return null
                            }
                          }
                        }
                        return (
                          <th key={certificate.certificate_id} className="bg-slate-50 border border-slate-200 p-2 sm:p-3 text-center font-semibold text-slate-900 min-w-28 sm:min-w-40 max-w-56 sm:max-w-80 sticky top-0 z-20">
                            <div className="text-[10px] sm:text-xs break-words line-clamp-4 px-1">
                              {certificate.certificate_name}
                            </div>
                          </th>
                        )
                      })}
                    </>
                  )}
                  
                  
                </tr>
              </thead>
              <tbody>
                {filteredEmployeesForCertificateMatrix.map(employee => (
                  <tr key={employee.id} className="hover:bg-slate-50 transition-colors border-b border-slate-200">
                    {/* Employee Cell */}
                    <td className="border border-slate-200 p-2 sm:p-4 bg-slate-50 border-r-2 border-r-slate-400 sticky left-0 z-10">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="avatar avatar-sm bg-green-700 flex-shrink-0">
                          <span className="text-xs font-semibold">
                            {employee.first_name?.[0]}{employee.last_name?.[0]}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-slate-900 text-xs sm:text-sm truncate">
                            {employee.first_name} {employee.last_name}
                          </div>
                          <div className="text-xs text-slate-500 font-medium truncate">
                            {employee.designation}
                          </div>
                        </div>
                      </div>
                    </td>
                    
                    {/* Certificates List Category Spacer */}
                    {(() => {
                      let certificatesToShow = filteredCertificatesForMatrix
                      // Apply parent category filter
                      if (certificateMatrixCertificateParentCategoryFilter.length > 0) {
                        certificatesToShow = certificatesToShow.filter(cert => {
                          if (certificateMatrixCertificateParentCategoryFilter.includes('Others')) {
                            return !cert.certificate_category || cert.certificate_category.trim() === ''
                          } else {
                            return cert.certificate_category && certificateMatrixCertificateParentCategoryFilter.includes(cert.certificate_category)
                          }
                        })
                      }
                      // Apply certificate name filter
                      if (certificateMatrixCertificatesFilter.length > 0) {
                        certificatesToShow = certificatesToShow.filter(cert => certificateMatrixCertificatesFilter.includes(cert.certificate_name))
                      }
                      return certificatesToShow.length > 0
                    })() && (
                      <td className="bg-slate-200 border border-slate-200"></td>
                    )}
                    
                    {/* Certificates List Cells */}
                    {accordionState.certificatesList && 
                     filteredCertificatesForMatrix.map(certificate => {
                      // If a specific certificate is selected, only show that certificate column
                      if (certificateMatrixCertificatesFilter.length > 0 && !certificateMatrixCertificatesFilter.includes(certificate.certificate_name)) {
                        return null
                      }
                      // Filter by parent category - only show certificates that belong to selected parent categories
                      if (certificateMatrixCertificateParentCategoryFilter.length > 0) {
                        // Handle "Others" category - certificates without certificate_category or with empty certificate_category
                        if (certificateMatrixCertificateParentCategoryFilter.includes('Others')) {
                          // Show if certificate has no category or empty category
                          if (certificate.certificate_category && certificate.certificate_category.trim() !== '') {
                            return null
                          }
                        } else {
                          // Show only if certificate's category is in the selected parent categories
                          if (!certificate.certificate_category || !certificateMatrixCertificateParentCategoryFilter.includes(certificate.certificate_category)) {
                            return null
                          }
                        }
                      }
                      const certificateStatus = getCertificateStatus(employee.id, certificate.certificate_id)
                      const canEdit = canEditEmployee(employee.id)
                      
                      return (
                        <td 
                          key={certificate.certificate_id} 
                          onClick={canEdit ? () => handleCertificateCellClick(employee, certificate) : undefined}
                          className={`border border-slate-200 p-2 sm:p-3 text-center transition-all duration-200 group min-w-28 sm:min-w-40 max-w-56 sm:max-w-80 ${
                            canEdit 
                              ? 'cursor-pointer hover:bg-green-50 hover:border-green-300' 
                              : 'cursor-default'
                          }`}
                        >
                          {certificateStatus ? (
                            <div className="flex flex-col items-center gap-1">
                              <div className={`px-1 sm:px-2 py-1 rounded-full text-xs font-medium ${
                                certificateStatus.status === 'Completed' ? 'bg-green-100 text-green-800' :
                                certificateStatus.status === 'In-Progress' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {certificateStatus.status === 'Completed' ? 'Completed' :
                                 certificateStatus.status === 'In-Progress' ? 'In Progress' : '-'}
                              </div>
                              {certificateStatus.status === 'In-Progress' && certificateStatus.start_date && certificateStatus.expiry_date && (
                                <div 
                                  className="text-xs text-slate-600 bg-yellow-50 rounded px-1 py-1 text-center cursor-help whitespace-nowrap"
                                  title={`${new Date(certificateStatus.start_date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })} to ${new Date(certificateStatus.expiry_date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}`}
                                >
                                  <span className="font-medium">{new Date(certificateStatus.start_date).toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}</span>
                                  <span className="text-slate-400 mx-1">to</span>
                                  <span className="font-medium">{new Date(certificateStatus.expiry_date).toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}</span>
                                </div>
                              )}
                              {certificateStatus.status === 'Completed' && certificateStatus.expiry_date && (
                                <div className="text-xs text-slate-500 bg-red-500 text-white rounded-full px-2 py-1" title={`Expires: ${new Date(certificateStatus.expiry_date).toLocaleDateString()}`}>
                                  {new Date(certificateStatus.expiry_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-slate-400 group-hover:text-slate-600 font-medium text-xs">-</div>
                          )}
                        </td>
                      )
                    })}
                    
                    
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary Stats */}
          <div className="bg-slate-100 border-t-2 border-slate-300 p-4 sm:p-6">
            <div className="grid grid-cols-2 sm:grid-cols-2 gap-3 sm:gap-6 text-center">
              <div className="hover-lift">
                <div className="text-lg sm:text-2xl font-bold text-green-700 mb-1">{filteredEmployeesForCertificateMatrix.length}</div>
                <div className="text-xs sm:text-sm text-slate-600 font-semibold">Total Employees</div>
              </div>
              <div className="hover-lift">
                <div className="text-lg sm:text-2xl font-bold text-green-700 mb-1">{certificates.length}</div>
                <div className="text-xs sm:text-sm text-slate-600 font-semibold">Certificates</div>
              </div>
            </div>
          </div>
        </div>
          </div>
        )}

        {/* Learning Management Tab */}
        {activeTab === 'learning-management' && hasPermission('learning-management-view') && (
          <div className="animate-fade-in">
            {/* Only show errors relevant to this tab */}
            {(error && (error.includes('certificates') || error.includes('employees'))) && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-yellow-800 text-sm">
                  {error.includes('certificates') ? 'Note: Certificate data failed to load, but this tab does not require it.' : error}
                </p>
              </div>
            )}
            <LearningManagement />
          </div>
        )}
        {activeTab === 'learning-management' && !hasPermission('learning-management-view') && (
          <div className="card p-8 text-center">
            <div className="text-slate-600 mb-2">
              <svg className="w-16 h-16 mx-auto mb-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
              </svg>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Access Denied</h3>
              <p className="text-sm">You don't have permission to view Learning Management.</p>
              <p className="text-xs text-slate-500 mt-2">Please contact your administrator to request access.</p>
            </div>
          </div>
        )}

        {/* Learning & Training Tab */}
        {activeTab === 'learning-and-training' && hasPermission('view-learning-and-training') && (
          <div className="animate-fade-in">
            {/* Only show errors relevant to this tab */}
            {(error && (error.includes('certificates') || error.includes('employees'))) && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-yellow-800 text-sm">
                  {error.includes('certificates') ? 'Note: Certificate data failed to load, but this tab does not require it.' : error}
                </p>
              </div>
            )}
            <LearningAndTraining />
          </div>
        )}

        {/* Skill Management Modal */}
        {showSkillModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className={`bg-white rounded-lg p-4 sm:p-6 w-full max-w-md mx-4 max-h-[90vh] ${showSkillParentCategoryDropdown ? 'overflow-visible' : 'overflow-y-auto'}`}>
              <h3 className="text-lg font-semibold mb-4">
                {editingSkill ? 'Edit Skill' : 'Add New Skill'}
              </h3>
              <form onSubmit={editingSkill ? handleUpdateSkill : handleCreateSkill}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Skill Name<span className="text-red-500"> *</span>
                  </label>
                  <input
                    type="text"
                    value={skillForm.skill_name}
                    onChange={(e) => setSkillForm({...skillForm, skill_name: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800"
                    required
                  />
                </div>
                <div className="mb-6">
                  <SearchableSelect
                    label="Parent Skill Category"
                    options={[
                      ...parentSkillCategories.map(category => ({ value: category, label: category })),
                      { value: 'Others', label: 'Others' }
                    ]}
                    value={skillForm.parent_skill}
                    onChange={(value) => setSkillForm({...skillForm, parent_skill: value, custom_parent_skill: ''})}
                    placeholder="Select Parent Category"
                    searchPlaceholder="Search categories..."
                    required={true}
                    onOpenChange={setShowSkillParentCategoryDropdown}
                  />
                  
                  {skillForm.parent_skill === 'Others' && (
                    <div className="mt-3">
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Custom Parent Category<span className="text-red-500"> *</span>
                      </label>
                      <input
                        type="text"
                        value={skillForm.custom_parent_skill}
                        onChange={(e) => setSkillForm({...skillForm, custom_parent_skill: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800"
                        placeholder="Enter custom parent category name"
                        required
                      />
                    </div>
                  )}
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Category<span className="text-red-500"> *</span>
                  </label>
                  <select
                    value={skillForm.skill_category}
                    onChange={(e) => setSkillForm({...skillForm, skill_category: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800"
                    required
                  >
                    <option value="Technical Skill">Technical Skill</option>
                    <option value="Non-Technical Skill">Non-Technical Skill</option>
                  </select>
                </div>
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowSkillModal(false)
                      setIsCreatingSkill(false)
                      setIsUpdatingSkill(false)
                    }}
                    className="px-4 py-2 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingSkill || isUpdatingSkill}
                    className={`px-4 py-2 text-white rounded-lg flex items-center gap-2 ${
                      isCreatingSkill || isUpdatingSkill
                        ? 'bg-blue-400 cursor-not-allowed'
                        : 'bg-green-700 hover:bg-green-800'
                    }`}
                  >
                    {(isCreatingSkill || isUpdatingSkill) && (
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    )}
                    {isCreatingSkill ? 'Creating...' : isUpdatingSkill ? 'Updating...' : (editingSkill ? 'Update' : 'Create')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Employee Skill Modal */}
        {showEmployeeSkillModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold mb-4">
                {editingEmployeeSkill ? 'Edit Employee Skill' : 'Add Employee Skill'}
              </h3>
              
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-800 text-sm">{error}</p>
                </div>
              )}
              
              <form onSubmit={editingEmployeeSkill ? handleUpdateEmployeeSkill : handleCreateEmployeeSkill}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Employee<span className="text-red-500"> *</span>
                    </label>
                    {isMatrixCellClick ? (
                      <input
                        type="text"
                        value={selectedEmployee ? `${selectedEmployee.first_name} ${selectedEmployee.last_name}` : ''}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-600"
                        disabled
                      />
                    ) : (
                      <select
                        value={employeeSkillForm.emp_id}
                        onChange={(e) => setEmployeeSkillForm({...employeeSkillForm, emp_id: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800"
                        required
                        disabled={editingEmployeeSkill ? true : false}
                      >
                        <option value="">Select Employee</option>
                        {employees.map(emp => (
                          <option key={emp.id} value={emp.id}>
                            {emp.first_name} {emp.last_name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Skill<span className="text-red-500"> *</span>
                    </label>
                    {isMatrixCellClick ? (
                      <input
                        type="text"
                        value={selectedSkill ? `${selectedSkill.skill_name} (${selectedSkill.skill_category})` : ''}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-600"
                        disabled
                      />
                    ) : (
                      <select
                        value={employeeSkillForm.skill_id}
                        onChange={(e) => {
                          const selectedSkill = skills.find(s => s.skill_id === e.target.value)
                          const oldSkill = skills.find(s => s.skill_id === employeeSkillForm.skill_id)
                          setEmployeeSkillForm(prev => ({
                            ...prev,
                            skill_id: e.target.value,
                            // Auto-populate certification name with selected skill when certified
                            // Only auto-fill if empty or if it matches the old skill name (preserve user edits)
                            certification_name: prev.certified && selectedSkill 
                              ? (prev.certification_name === '' || (oldSkill && prev.certification_name === oldSkill.skill_name)
                                  ? selectedSkill.skill_name 
                                  : prev.certification_name)
                              : prev.certification_name,
                            selected_certification: prev.certified && selectedSkill ? selectedSkill.skill_name : prev.selected_certification
                          }))
                        }}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800"
                        required
                        disabled={editingEmployeeSkill ? true : false}
                      >
                        <option value="">Select Skill</option>
                        {skills.map(skill => (
                          <option key={skill.skill_id} value={skill.skill_id}>
                            {skill.skill_name} ({skill.skill_category})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Proficiency Level<span className="text-red-500"> *</span>
                    </label>
                    <select
                      value={employeeSkillForm.proficiency_level}
                      onChange={(e) => setEmployeeSkillForm({...employeeSkillForm, proficiency_level: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800"
                      required
                    >
                      <option value="Beginner">Beginner</option>
                      <option value="Intermediate">Intermediate</option>
                      <option value="Advanced">Advanced</option>
                      <option value="Expert">Expert</option>
                    </select>
                  </div>
                  <div className="flex items-center">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={employeeSkillForm.certified}
                        onChange={(e) => {
                          const isCertified = e.target.checked
                          const selectedSkill = skills.find(s => s.skill_id === employeeSkillForm.skill_id)
                          setEmployeeSkillForm(prev => {
                            // If checking the checkbox, auto-fill only if certification_name is empty/null/undefined or matches the skill name
                            // This preserves any manually edited saved values (including empty strings that user intentionally cleared)
                            // Only auto-fill when first checking the box, not when re-checking after user has cleared it
                            const shouldAutoFill = isCertified && selectedSkill && 
                              (prev.certification_name === null || 
                               prev.certification_name === undefined || 
                               (prev.certification_name === '' && !prev.certified) || // Only auto-fill empty string if checkbox was previously unchecked
                               prev.certification_name === selectedSkill.skill_name)
                            
                            return {
                              ...prev,
                              certified: isCertified,
                              // Auto-populate certification name with selected skill when certified (only if should auto-fill)
                              // Preserve user edits when re-checking (including empty strings)
                              certification_name: isCertified && selectedSkill 
                                ? (shouldAutoFill ? selectedSkill.skill_name : prev.certification_name)
                                : prev.certification_name, // Preserve value when unchecking
                              selected_certification: isCertified && selectedSkill ? selectedSkill.skill_name : prev.selected_certification
                            }
                          })
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm font-medium text-slate-700">Certified</span>
                    </label>
                  </div>
                </div>

                {employeeSkillForm.certified && (
                  <>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Certification Name
                      </label>
                      {employeeSkillForm.skill_id ? (() => {
                        const selectedSkill = skills.find(s => s.skill_id === employeeSkillForm.skill_id)
                        const skillName = selectedSkill ? selectedSkill.skill_name : ''
                        // Check if the current value matches the auto-filled skill name (only show hint if it matches)
                        const isAutoFilled = employeeSkillForm.certification_name && employeeSkillForm.certification_name === skillName
                        // Use certification_name from state directly - don't auto-fill here to prevent loop
                        // Auto-fill only happens when checkbox is checked or skill is changed
                        const displayValue = employeeSkillForm.certification_name || ''
                        
                        return (
                          <div className="relative">
                            <input
                              type="text"
                              value={displayValue}
                              onChange={(e) => setEmployeeSkillForm({...employeeSkillForm, certification_name: e.target.value})}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800"
                              placeholder="Enter certification name"
                            />
                            {isAutoFilled && (
                              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-slate-500 pointer-events-none">
                                (Auto-filled from selected skill)
                              </span>
                            )}
                          </div>
                        )
                      })() : (
                        <div className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-400">
                          Please select a skill first
                        </div>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Start Date
                        </label>
                        <input
                          type="date"
                          value={employeeSkillForm.start_date}
                          onChange={(e) => setEmployeeSkillForm({...employeeSkillForm, start_date: e.target.value})}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Expiry Date
                        </label>
                        <input
                          type="date"
                          value={employeeSkillForm.expiry_date}
                          onChange={(e) => setEmployeeSkillForm({...employeeSkillForm, expiry_date: e.target.value})}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800"
                        />
                      </div>
                    </div>
                  </>
                )}

                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Last Workdone
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <MonthPicker
                        value={splitMonthYear(employeeSkillForm.last_assessed).month}
                        onChange={(month) => {
                          const { year } = splitMonthYear(employeeSkillForm.last_assessed)
                          setEmployeeSkillForm({
                            ...employeeSkillForm,
                            last_assessed: combineMonthYear(month, year || new Date().getFullYear().toString())
                          })
                        }}
                      />
                    </div>
                    <div>
                      <YearPicker
                        value={splitMonthYear(employeeSkillForm.last_assessed).year}
                        onChange={(year) => {
                          const { month } = splitMonthYear(employeeSkillForm.last_assessed)
                          setEmployeeSkillForm({
                            ...employeeSkillForm,
                            last_assessed: combineMonthYear(month || '01', year)
                          })
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Description Note
                  </label>
                  <textarea
                    value={employeeSkillForm.description_note}
                    onChange={(e) => setEmployeeSkillForm({...employeeSkillForm, description_note: e.target.value})}
                    placeholder="Enter comments or notes about this skill..."
                    rows={4}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800 resize-vertical"
                  />
                </div>

                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEmployeeSkillModal(false)
                      setError(null)
                      setIsCreatingEmployeeSkill(false)
                      setIsUpdatingEmployeeSkill(false)
                      setIsDeletingEmployeeSkill(false)
                    }}
                    className="px-4 py-2 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  {editingEmployeeSkill && (
                    <button
                      type="button"
                      onClick={() => handleDeleteEmployeeSkill(editingEmployeeSkill.employee_skill_id)}
                      disabled={isDeletingEmployeeSkill}
                      className={`px-4 py-2 text-white rounded-lg flex items-center gap-2 ${
                        isDeletingEmployeeSkill
                          ? 'bg-red-400 cursor-not-allowed'
                          : 'bg-red-600 hover:bg-red-700'
                      }`}
                    >
                      {isDeletingEmployeeSkill && (
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      )}
                      {isDeletingEmployeeSkill ? 'Deleting...' : 'Delete'}
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isCreatingEmployeeSkill || isUpdatingEmployeeSkill}
                    className={`px-4 py-2 text-white rounded-lg flex items-center gap-2 ${
                      isCreatingEmployeeSkill || isUpdatingEmployeeSkill
                        ? 'bg-blue-400 cursor-not-allowed'
                        : 'bg-green-700 hover:bg-green-800'
                    }`}
                  >
                    {(isCreatingEmployeeSkill || isUpdatingEmployeeSkill) && (
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    )}
                    {isCreatingEmployeeSkill ? 'Creating...' : isUpdatingEmployeeSkill ? 'Updating...' : (editingEmployeeSkill ? 'Update' : 'Create')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}


        {/* Certificate Management Modal */}
        {showCertificateManagementModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className={`bg-white rounded-lg p-4 sm:p-6 w-full max-w-md mx-4 max-h-[90vh] ${showCertificateCategoryDropdown ? 'overflow-visible' : 'overflow-y-auto'}`}>
              <h3 className="text-lg font-semibold mb-4">
                {editingCertificate ? 'Edit Certificate' : 'Add New Certificate'}
              </h3>
              <form onSubmit={editingCertificate ? handleUpdateCertificate : handleCreateCertificate}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Certificate Name<span className="text-red-500"> *</span>
                  </label>
                  <input
                    type="text"
                    value={certificateManagementForm.certificate_name}
                    onChange={(e) => setCertificateManagementForm({...certificateManagementForm, certificate_name: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800"
                    required
                  />
                </div>
                <div className="mb-4">
                  <SearchableSelect
                    label="Category"
                    options={[
                      ...parentCertificateCategories.map(category => ({ value: category, label: category })),
                      { value: 'Others', label: 'Others' }
                    ]}
                    value={certificateManagementForm.certificate_category}
                    onChange={(value) => setCertificateManagementForm({...certificateManagementForm, certificate_category: value, custom_parent_category: ''})}
                    placeholder="Select Category"
                    searchPlaceholder="Search categories..."
                    required={true}
                    onOpenChange={setShowCertificateCategoryDropdown}
                  />
                  
                  {certificateManagementForm.certificate_category === 'Others' && (
                    <div className="mt-3">
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Custom Parent Category<span className="text-red-500"> *</span>
                      </label>
                      <input
                        type="text"
                        value={certificateManagementForm.custom_parent_category}
                        onChange={(e) => setCertificateManagementForm({...certificateManagementForm, custom_parent_category: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800"
                        placeholder="Enter custom parent category name"
                        required
                      />
                    </div>
                  )}
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Difficulty Level
                  </label>
                  <select
                    value={certificateManagementForm.difficulty_level}
                    onChange={(e) => setCertificateManagementForm({...certificateManagementForm, difficulty_level: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800"
                  >
                    <option value="">Select Difficulty (Optional)</option>
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Tough">Tough</option>
                  </select>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Issued By
                  </label>
                  <input
                    type="text"
                    value={certificateManagementForm.issued_by}
                    onChange={(e) => setCertificateManagementForm({...certificateManagementForm, issued_by: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800"
                    placeholder="e.g., Microsoft, AWS, Google"
                  />
                </div>
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCertificateManagementModal(false)
                      setIsCreatingCertificate(false)
                      setIsUpdatingCertificate(false)
                    }}
                    className="px-4 py-2 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingCertificate || isUpdatingCertificate}
                    className={`px-4 py-2 text-white rounded-lg flex items-center gap-2 ${
                      isCreatingCertificate || isUpdatingCertificate
                        ? 'bg-blue-400 cursor-not-allowed'
                        : 'bg-green-700 hover:bg-green-800'
                    }`}
                  >
                    {(isCreatingCertificate || isUpdatingCertificate) && (
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    )}
                    {isCreatingCertificate ? 'Creating...' : isUpdatingCertificate ? 'Updating...' : (editingCertificate ? 'Update' : 'Create')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Certificate Status Modal */}
        {showCertificateStatusModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold mb-4">
                {editingCertificateStatus ? 'Edit Certificate Status' : 'Add Certificate Status'}
              </h3>
              
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-800 text-sm">{error}</p>
                </div>
              )}
              
              <form onSubmit={handleCertificateStatusSubmit}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Employee<span className="text-red-500"> *</span>
                  </label>
                  <input
                    type="text"
                    value={selectedEmployee ? `${selectedEmployee.first_name} ${selectedEmployee.last_name}` : ''}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-600"
                    disabled
                  />
                </div>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Certificate<span className="text-red-500"> *</span>
                  </label>
                  <input
                    type="text"
                    value={selectedCertificate ? selectedCertificate.certificate_name : ''}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-600"
                    disabled
                  />
                </div>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Status<span className="text-red-500"> *</span>
                  </label>
                  <select
                    value={certificateStatusForm.status}
                    onChange={(e) => setCertificateStatusForm({...certificateStatusForm, status: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800"
                    required
                  >
                    <option value="In-Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
                
                {/* Start Date and Expiry Date fields */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={certificateStatusForm.start_date}
                    onChange={(e) => setCertificateStatusForm({...certificateStatusForm, start_date: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800"
                  />
                </div>
                
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    {certificateStatusForm.status === 'In-Progress' ? 'End Date' : 'Expiry Date'}
                  </label>
                  <input
                    type="date"
                    value={certificateStatusForm.expiry_date}
                    onChange={(e) => setCertificateStatusForm({...certificateStatusForm, expiry_date: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800"
                  />
                </div>

                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCertificateStatusModal(false)
                      setError(null)
                      setIsCreatingCertificateStatus(false)
                      setIsUpdatingCertificateStatus(false)
                      setIsDeletingCertificateStatus(false)
                    }}
                    className="px-4 py-2 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  {editingCertificateStatus && (
                    <button
                      type="button"
                      onClick={handleDeleteCertificateStatus}
                      disabled={isDeletingCertificateStatus}
                      className={`px-4 py-2 text-white rounded-lg flex items-center gap-2 ${
                        isDeletingCertificateStatus
                          ? 'bg-red-400 cursor-not-allowed'
                          : 'bg-red-600 hover:bg-red-700'
                      }`}
                    >
                      {isDeletingCertificateStatus && (
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      )}
                      {isDeletingCertificateStatus ? 'Deleting...' : 'Delete'}
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isCreatingCertificateStatus || isUpdatingCertificateStatus}
                    className={`px-4 py-2 text-white rounded-lg flex items-center gap-2 ${
                      isCreatingCertificateStatus || isUpdatingCertificateStatus
                        ? 'bg-blue-400 cursor-not-allowed'
                        : 'bg-green-700 hover:bg-green-800'
                    }`}
                  >
                    {(isCreatingCertificateStatus || isUpdatingCertificateStatus) && (
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    )}
                    {isCreatingCertificateStatus ? 'Creating...' : isUpdatingCertificateStatus ? 'Updating...' : (editingCertificateStatus ? 'Update' : 'Create')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Multi Alloc Skill Modal */}
        {showMultiAllocSkillModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className={`bg-white rounded-lg p-4 sm:p-6 w-full max-w-lg mx-4 max-h-[90vh] ${showEmployeeDropdown || showSkillDropdown ? 'overflow-visible' : 'overflow-y-auto'}`}>
              <h3 className="text-lg font-semibold mb-4">
                Multi Allocate Skill
              </h3>
              
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-800 text-sm">{error}</p>
                </div>
              )}
              
              {/* Duplicate Assignment Alert for Skills */}
              {multiAllocSkillAlert.show && (
                <div className={`mb-4 p-3 border rounded-lg ${
                  multiAllocSkillAlert.type === 'warning' 
                    ? 'bg-yellow-50 border-yellow-200' 
                    : multiAllocSkillAlert.type === 'error'
                    ? 'bg-red-50 border-red-200'
                    : 'bg-green-50 border-green-200'
                }`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start">
                      <svg className={`w-5 h-5 mt-0.5 mr-2 ${
                        multiAllocSkillAlert.type === 'warning' 
                          ? 'text-yellow-600' 
                          : multiAllocSkillAlert.type === 'error'
                          ? 'text-red-600'
                          : 'text-blue-600'
                      }`} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <p className={`text-sm ${
                        multiAllocSkillAlert.type === 'warning' 
                          ? 'text-yellow-800' 
                          : multiAllocSkillAlert.type === 'error'
                          ? 'text-red-800'
                          : 'text-blue-800'
                      }`}>
                        {multiAllocSkillAlert.message}
                      </p>
                    </div>
                    <button
                      onClick={clearMultiAllocSkillAlert}
                      className={`ml-2 text-lg leading-none ${
                        multiAllocSkillAlert.type === 'warning' 
                          ? 'text-yellow-600 hover:text-yellow-800' 
                          : multiAllocSkillAlert.type === 'error'
                          ? 'text-red-600 hover:text-red-800'
                          : 'text-blue-600 hover:text-blue-800'
                      }`}
                    >
                      ×
                    </button>
                  </div>
                </div>
              )}
              
              <form onSubmit={handleCreateMultiAllocSkill}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Select Employees (Multiple)<span className="text-red-500"> *</span>
                  </label>
                  
                  {/* Custom Multi-Select Dropdown */}
                  <div className="relative employee-dropdown-container">
                    {/* Input Field with Selected Tags */}
                    <div 
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 min-h-[40px] cursor-pointer flex flex-wrap items-center gap-1 ${
                        multiAllocSkillErrors.emp_ids 
                          ? 'border-red-500 focus:ring-red-500' 
                          : 'border-slate-300 focus:ring-green-800'
                      }`}
                      onClick={() => setShowEmployeeDropdown(!showEmployeeDropdown)}
                    >
                      {multiAllocSkillForm.emp_ids.length > 0 ? (
                        <>
                          {getSelectedEmployeeNames().map((name, index) => {
                            const empId = multiAllocSkillForm.emp_ids[index]
                            return (
                              <span
                                key={empId}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full"
                              >
                                {name}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    removeSelectedEmployee(empId)
                                  }}
                                  className="text-purple-600 hover:text-purple-800"
                                >
                                  ×
                                </button>
                              </span>
                            )
                          })}
                        </>
                      ) : (
                        <span className="text-slate-400">Select employees...</span>
                      )}
                      <svg 
                        className={`w-4 h-4 ml-auto transition-transform duration-200 ${showEmployeeDropdown ? 'rotate-180' : ''}`} 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
                      </svg>
                    </div>

                    {/* Dropdown Panel */}
                    {showEmployeeDropdown && (
                      <div className="absolute z-[100] left-0 w-[460px] max-w-[calc(100vw-2rem)] mt-1 bg-white border border-slate-300 rounded-lg shadow-2xl max-h-[500px] overflow-hidden">
                        {/* Search Bar */}
                        <div className="p-3 border-b border-slate-200">
                          <div className="relative">
                            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                            </svg>
                            <input
                              type="text"
                              placeholder="Filter employees..."
                              value={employeeSearchTerm}
                              onChange={(e) => setEmployeeSearchTerm(e.target.value)}
                              className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-800"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        </div>

                        {/* Select All/None Options */}
                        <div className="p-2 border-b border-slate-200">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleSelectAllEmployees()
                              }}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                            >
                              Select All
                            </button>
                            <span className="text-slate-300">|</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeselectAllEmployees()
                              }}
                              className="text-xs text-red-600 hover:text-red-800 font-medium"
                            >
                              Select None
                            </button>
                          </div>
                        </div>

                        {/* Employee List */}
                        <div className="max-h-[400px] overflow-y-auto">
                          {filteredEmployeesForMultiSelect.length > 0 ? (
                            filteredEmployeesForMultiSelect.map(emp => (
                              <div
                                key={emp.id}
                                className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleEmployeeToggle(emp.id)
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={multiAllocSkillForm.emp_ids.includes(emp.id)}
                                  onChange={() => {}} // Handled by parent onClick
                                  className="w-4 h-4 text-purple-600 border-slate-300 rounded focus:ring-purple-500"
                                />
                                <div className="flex-1">
                                  <div className="text-sm font-medium text-slate-900">
                                    {emp.first_name} {emp.last_name}
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    {emp.designation}
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="p-3 text-sm text-slate-500 text-center">
                              No employees found
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {multiAllocSkillForm.emp_ids.length > 0 && (
                    <p className="text-xs text-slate-500 mt-1">
                      {multiAllocSkillForm.emp_ids.length} employee(s) selected
                    </p>
                  )}
                  {multiAllocSkillErrors.emp_ids && (
                    <p className="text-red-500 text-sm mt-1">{multiAllocSkillErrors.emp_ids}</p>
                  )}
                </div>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Skill <span className="text-red-500"> *</span>
                  </label>
                  
                  {/* Custom Searchable Skill Dropdown */}
                  <div className="relative skill-dropdown-container">
                    {/* Input Field */}
                    <div 
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 min-h-[40px] cursor-pointer flex items-center ${
                        multiAllocSkillErrors.skill_id 
                          ? 'border-red-500 focus:ring-red-500' 
                          : 'border-slate-300 focus:ring-green-800'
                      }`}
                      onClick={() => setShowSkillDropdown(!showSkillDropdown)}
                    >
                      <span className={multiAllocSkillForm.skill_id ? "text-slate-900" : "text-slate-400"}>
                        {multiAllocSkillForm.skill_id ? getSelectedSkillName() : "Select Skill"}
                      </span>
                      <svg 
                        className={`w-4 h-4 ml-auto transition-transform duration-200 ${showSkillDropdown ? 'rotate-180' : ''}`} 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
                      </svg>
                    </div>

                    {/* Dropdown Panel */}
                    {showSkillDropdown && (
                      <div className="absolute z-[100] left-0 w-[460px] max-w-[calc(100vw-2rem)] mt-1 bg-white border border-slate-300 rounded-lg shadow-2xl max-h-[500px] overflow-hidden">
                        {/* Search Bar */}
                        <div className="p-3 border-b border-slate-200">
                          <div className="relative">
                            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                            </svg>
                            <input
                              type="text"
                              placeholder="Filter skills..."
                              value={multiAllocSkillSearchTerm}
                              onChange={(e) => setMultiAllocSkillSearchTerm(e.target.value)}
                              className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-800"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        </div>

                        {/* Skill List */}
                        <div className="max-h-[400px] overflow-y-auto">
                          {filteredSkillsForMultiSelect.length > 0 ? (
                            filteredSkillsForMultiSelect.map(skill => (
                              <div
                                key={skill.skill_id}
                                className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleSkillSelect(skill.skill_id)
                                }}
                              >
                                <div className="flex-1">
                                  <div className="text-sm font-medium text-slate-900">
                                    {skill.skill_name}
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    {skill.skill_category}
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="p-3 text-sm text-slate-500 text-center">
                              No skills found
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  {multiAllocSkillErrors.skill_id && (
                    <p className="text-red-500 text-sm mt-1">{multiAllocSkillErrors.skill_id}</p>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Proficiency Level<span className="text-red-500"> *</span>
                    </label>
                    <select
                      value={multiAllocSkillForm.proficiency_level}
                      onChange={(e) => {
                        setMultiAllocSkillForm({...multiAllocSkillForm, proficiency_level: e.target.value})
                        // Clear validation error when user selects proficiency level
                        if (multiAllocSkillErrors.proficiency_level) {
                          setMultiAllocSkillErrors(prev => ({
                            ...prev,
                            proficiency_level: ''
                          }))
                        }
                      }}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                        multiAllocSkillErrors.proficiency_level 
                          ? 'border-red-500 focus:ring-red-500' 
                          : 'border-slate-300 focus:ring-green-800'
                      }`}
                      required
                    >
                      <option value="Beginner">Beginner</option>
                      <option value="Intermediate">Intermediate</option>
                      <option value="Advanced">Advanced</option>
                      <option value="Expert">Expert</option>
                    </select>
                    {multiAllocSkillErrors.proficiency_level && (
                      <p className="text-red-500 text-sm mt-1">{multiAllocSkillErrors.proficiency_level}</p>
                    )}
                  </div>
                  <div className="flex items-center">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={multiAllocSkillForm.certified}
                        onChange={(e) => {
                          const isCertified = e.target.checked
                          const selectedSkill = skills.find(s => s.skill_id === multiAllocSkillForm.skill_id)
                          setMultiAllocSkillForm(prev => ({
                            ...prev,
                            certified: isCertified,
                            // Auto-populate certification name with selected skill when certified
                            certification_name: isCertified && selectedSkill ? selectedSkill.skill_name : '',
                            selected_certification: isCertified && selectedSkill ? selectedSkill.skill_name : ''
                          }))
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm font-medium text-slate-700">Certified</span>
                    </label>
                  </div>
                </div>

                {multiAllocSkillForm.certified && (
                  <>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Certification Name
                      </label>
                      {multiAllocSkillForm.skill_id ? (
                        <div className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-600">
                          {multiAllocSkillForm.certification_name || getSelectedSkillName().split(' (')[0]}
                          <span className="text-xs text-slate-500 ml-2">(Auto-filled from selected skill)</span>
                        </div>
                      ) : (
                        <div className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-400">
                          Please select a skill first
                        </div>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Start Date
                        </label>
                        <input
                          type="date"
                          value={multiAllocSkillForm.start_date}
                          onChange={(e) => setMultiAllocSkillForm({...multiAllocSkillForm, start_date: e.target.value})}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Expiry Date
                        </label>
                        <input
                          type="date"
                          value={multiAllocSkillForm.expiry_date}
                          onChange={(e) => setMultiAllocSkillForm({...multiAllocSkillForm, expiry_date: e.target.value})}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800"
                        />
                      </div>
                    </div>
                  </>
                )}

                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Last Workdone
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <MonthPicker
                        value={splitMonthYear(multiAllocSkillForm.last_assessed).month}
                        onChange={(month) => {
                          const { year } = splitMonthYear(multiAllocSkillForm.last_assessed)
                          setMultiAllocSkillForm({
                            ...multiAllocSkillForm,
                            last_assessed: combineMonthYear(month, year || new Date().getFullYear().toString())
                          })
                        }}
                      />
                    </div>
                    <div>
                      <YearPicker
                        value={splitMonthYear(multiAllocSkillForm.last_assessed).year}
                        onChange={(year) => {
                          const { month } = splitMonthYear(multiAllocSkillForm.last_assessed)
                          setMultiAllocSkillForm({
                            ...multiAllocSkillForm,
                            last_assessed: combineMonthYear(month || '01', year)
                          })
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Description Note
                  </label>
                  <textarea
                    value={multiAllocSkillForm.description_note}
                    onChange={(e) => setMultiAllocSkillForm({...multiAllocSkillForm, description_note: e.target.value})}
                    placeholder="Enter comments or notes about this skill..."
                    rows={4}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800 resize-vertical"
                  />
                </div>

                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowMultiAllocSkillModal(false)
                      setError(null)
                      setIsCreatingMultiAllocSkill(false)
                      setEmployeeSearchTerm('')
                      setShowEmployeeDropdown(false)
                      setMultiAllocSkillSearchTerm('')
                      setShowSkillDropdown(false)
                    }}
                    className="px-4 py-2 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingMultiAllocSkill}
                    className={`px-4 py-2 text-white rounded-lg flex items-center gap-2 ${
                      isCreatingMultiAllocSkill
                        ? 'bg-green-700 cursor-not-allowed'
                        : 'bg-green-700 hover:bg-green-800'
                    }`}
                  >
                    {isCreatingMultiAllocSkill && (
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    )}
                    {isCreatingMultiAllocSkill ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Multi Allocate Certificate Modal */}
        {showMultiAllocCertificateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className={`bg-white rounded-lg p-4 sm:p-6 w-full max-w-lg mx-4 max-h-[90vh] ${showMultiAllocEmployeeDropdown || showMultiAllocCertificateDropdown ? 'overflow-visible' : 'overflow-y-auto'}`}>
              <h3 className="text-lg font-semibold mb-4">
                Multi Allocate Certificate
              </h3>
              
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-800 text-sm">{error}</p>
                </div>
              )}
              
              {/* Duplicate Assignment Alert for Certificates */}
              {multiAllocCertificateAlert.show && (
                <div className={`mb-4 p-3 border rounded-lg ${
                  multiAllocCertificateAlert.type === 'warning' 
                    ? 'bg-yellow-50 border-yellow-200' 
                    : multiAllocCertificateAlert.type === 'error'
                    ? 'bg-red-50 border-red-200'
                    : 'bg-green-50 border-green-200'
                }`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start">
                      <svg className={`w-5 h-5 mt-0.5 mr-2 ${
                        multiAllocCertificateAlert.type === 'warning' 
                          ? 'text-yellow-600' 
                          : multiAllocCertificateAlert.type === 'error'
                          ? 'text-red-600'
                          : 'text-blue-600'
                      }`} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <p className={`text-sm ${
                        multiAllocCertificateAlert.type === 'warning' 
                          ? 'text-yellow-800' 
                          : multiAllocCertificateAlert.type === 'error'
                          ? 'text-red-800'
                          : 'text-blue-800'
                      }`}>
                        {multiAllocCertificateAlert.message}
                      </p>
                    </div>
                    <button
                      onClick={clearMultiAllocCertificateAlert}
                      className={`ml-2 text-lg leading-none ${
                        multiAllocCertificateAlert.type === 'warning' 
                          ? 'text-yellow-600 hover:text-yellow-800' 
                          : multiAllocCertificateAlert.type === 'error'
                          ? 'text-red-600 hover:text-red-800'
                          : 'text-blue-600 hover:text-blue-800'
                      }`}
                    >
                      ×
                    </button>
                  </div>
                </div>
              )}
              
              <form onSubmit={handleCreateMultiAllocCertificate}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Select Employees (Multiple)<span className="text-red-500"> *</span>
                  </label>
                  
                  {/* Custom Multi-Select Employee Dropdown */}
                  <div className="relative multi-alloc-employee-dropdown-container">
                    {/* Input Field with Selected Tags */}
                    <div 
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 min-h-[40px] cursor-pointer flex flex-wrap items-center gap-1 ${
                        multiAllocCertificateErrors.emp_ids 
                          ? 'border-red-500 focus:ring-red-500' 
                          : 'border-slate-300 focus:ring-green-800'
                      }`}
                      onClick={() => setShowMultiAllocEmployeeDropdown(!showMultiAllocEmployeeDropdown)}
                    >
                      {multiAllocCertificateForm.emp_ids.length > 0 ? (
                        <>
                          {getSelectedMultiAllocEmployeeNames().map((name, index) => {
                            const empId = multiAllocCertificateForm.emp_ids[index]
                            return (
                              <span
                                key={empId}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full"
                              >
                                {name}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    removeSelectedMultiAllocEmployee(empId)
                                  }}
                                  className="text-green-600 hover:text-green-800"
                                >
                                  ×
                                </button>
                              </span>
                            )
                          })}
                        </>
                      ) : (
                        <span className="text-slate-400">Select employees...</span>
                      )}
                      <svg 
                        className={`w-4 h-4 ml-auto transition-transform duration-200 ${showMultiAllocEmployeeDropdown ? 'rotate-180' : ''}`} 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
                      </svg>
                    </div>

                    {/* Dropdown Panel */}
                    {showMultiAllocEmployeeDropdown && (
                      <div className="absolute z-[100] left-0 w-[460px] max-w-[calc(100vw-2rem)] mt-1 bg-white border border-slate-300 rounded-lg shadow-2xl max-h-[500px] overflow-hidden">
                        {/* Search Bar */}
                        <div className="p-3 border-b border-slate-200">
                          <div className="relative">
                            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                            </svg>
                            <input
                              type="text"
                              placeholder="Filter employees..."
                              value={multiAllocEmployeeSearchTerm}
                              onChange={(e) => setMultiAllocEmployeeSearchTerm(e.target.value)}
                              className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-800"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        </div>

                        {/* Employee List */}
                        <div className="max-h-[400px] overflow-y-auto">
                          {filteredEmployeesForMultiAllocCert.length > 0 ? (
                            filteredEmployeesForMultiAllocCert.map(emp => (
                              <div
                                key={emp.id}
                                className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleMultiAllocEmployeeToggle(emp.id)
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={multiAllocCertificateForm.emp_ids.includes(emp.id)}
                                  onChange={() => {}} // Handled by parent onClick
                                  className="w-4 h-4 text-green-600 border-slate-300 rounded focus:ring-green-500"
                                />
                                <div className="flex-1">
                                  <div className="text-sm font-medium text-slate-900">
                                    {emp.first_name} {emp.last_name}
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    {emp.designation}
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="p-3 text-sm text-slate-500 text-center">
                              No employees found
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {multiAllocCertificateForm.emp_ids.length > 0 && (
                    <p className="text-xs text-slate-500 mt-1">
                      {multiAllocCertificateForm.emp_ids.length} employee(s) selected
                    </p>
                  )}
                  {multiAllocCertificateErrors.emp_ids && (
                    <p className="text-red-500 text-sm mt-1">{multiAllocCertificateErrors.emp_ids}</p>
                  )}
                </div>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Certificate<span className="text-red-500"> *</span>
                  </label>
                  
                  {/* Custom Searchable Certificate Dropdown */}
                  <div className="relative multi-alloc-certificate-dropdown-container">
                    {/* Input Field */}
                    <div 
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 min-h-[40px] cursor-pointer flex items-center ${
                        multiAllocCertificateErrors.certificate_id 
                          ? 'border-red-500 focus:ring-red-500' 
                          : 'border-slate-300 focus:ring-green-800'
                      }`}
                      onClick={() => setShowMultiAllocCertificateDropdown(!showMultiAllocCertificateDropdown)}
                    >
                      <span className={multiAllocCertificateForm.certificate_id ? "text-slate-900" : "text-slate-400"}>
                        {multiAllocCertificateForm.certificate_id ? getSelectedMultiAllocCertificateName() : "Select Certificate"}
                      </span>
                      <svg 
                        className={`w-4 h-4 ml-auto transition-transform duration-200 ${showMultiAllocCertificateDropdown ? 'rotate-180' : ''}`} 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
                      </svg>
                    </div>

                    {/* Dropdown Panel */}
                    {showMultiAllocCertificateDropdown && (
                      <div className="absolute z-[100] left-0 w-[460px] max-w-[calc(100vw-2rem)] mt-1 bg-white border border-slate-300 rounded-lg shadow-2xl max-h-[350px] overflow-hidden">
                        {/* Search Bar */}
                        <div className="p-3 border-b border-slate-200">
                          <div className="relative">
                            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                            </svg>
                            <input
                              type="text"
                              placeholder="Filter certificates..."
                              value={multiAllocCertificateSearchTerm}
                              onChange={(e) => setMultiAllocCertificateSearchTerm(e.target.value)}
                              className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-800"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        </div>

                        {/* Certificate List */}
                        <div className="max-h-[280px] overflow-y-auto scrollbar-thin">
                          {filteredCertificatesForMultiAlloc.length > 0 ? (
                            filteredCertificatesForMultiAlloc.map(certificate => (
                              <div
                                key={certificate.certificate_id}
                                className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleMultiAllocCertificateSelect(certificate.certificate_id)
                                }}
                              >
                                <div className="flex-1">
                                  <div className="text-sm font-medium text-slate-900">
                                    {certificate.certificate_name}
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    {certificate.certificate_category}
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="p-3 text-sm text-slate-500 text-center">
                              No certificates found
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  {multiAllocCertificateErrors.certificate_id && (
                    <p className="text-red-500 text-sm mt-1">{multiAllocCertificateErrors.certificate_id}</p>
                  )}
                </div>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Status<span className="text-red-500"> *</span>
                  </label>
                  <select
                    value={multiAllocCertificateForm.status}
                    onChange={(e) => {
                      setMultiAllocCertificateForm({...multiAllocCertificateForm, status: e.target.value})
                      // Clear validation error when user selects status
                      if (multiAllocCertificateErrors.status) {
                        setMultiAllocCertificateErrors(prev => ({
                          ...prev,
                          status: ''
                        }))
                      }
                    }}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                      multiAllocCertificateErrors.status 
                        ? 'border-red-500 focus:ring-red-500' 
                        : 'border-slate-300 focus:ring-green-800'
                    }`}
                    required
                  >
                    <option value="In-Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                  </select>
                  {multiAllocCertificateErrors.status && (
                    <p className="text-red-500 text-sm mt-1">{multiAllocCertificateErrors.status}</p>
                  )}
                </div>
                
                {/* Start Date and Expiry Date fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={multiAllocCertificateForm.start_date}
                      onChange={(e) => setMultiAllocCertificateForm({...multiAllocCertificateForm, start_date: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {multiAllocCertificateForm.status === 'In-Progress' ? 'End Date' : 'Expiry Date'}
                    </label>
                    <input
                      type="date"
                      value={multiAllocCertificateForm.expiry_date}
                      onChange={(e) => setMultiAllocCertificateForm({...multiAllocCertificateForm, expiry_date: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800"
                    />
                  </div>
                </div>

                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowMultiAllocCertificateModal(false)
                      setError(null)
                      setIsCreatingMultiAllocCertificate(false)
                      setMultiAllocEmployeeSearchTerm('')
                      setShowMultiAllocEmployeeDropdown(false)
                      setMultiAllocCertificateSearchTerm('')
                      setShowMultiAllocCertificateDropdown(false)
                    }}
                    className="px-4 py-2 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingMultiAllocCertificate}
                    className={`px-4 py-2 text-white rounded-lg flex items-center gap-2 ${
                      isCreatingMultiAllocCertificate
                        ? 'bg-green-400 cursor-not-allowed'
                        : 'bg-green-600 hover:bg-green-700'
                    }`}
                  >
                    {isCreatingMultiAllocCertificate && (
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    )}
                    {isCreatingMultiAllocCertificate ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>

    {/* Custom Alert Popup */}
    {showCustomAlert && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 animate-fade-in">
          <div className="p-6">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-gray-900">
                  {alertTitle}
                </h3>
              </div>
            </div>
            <div className="mb-6">
              <p className="text-sm text-gray-500 whitespace-pre-line">
                {alertMessage}
              </p>
            </div>
            <div className="flex justify-end">
              <button
                onClick={closeCustomAlert}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-green-800 focus:ring-offset-2 transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Import Selection Modal */}
    {showImportSelectionModal && (
      <ImportSelectionModal
        onClose={() => setShowImportSelectionModal(false)}
        onSelectImportType={(type) => {
          setShowImportSelectionModal(false)
          if (type === 'certificates') {
            setShowCertificateBulkImport(true)
          } else if (type === 'skills') {
            setShowSkillsBulkImport(true)
          }
        }}
      />
    )}

    {/* Certificate Bulk Import Modal */}
    {showCertificateBulkImport && (
      <CertificateBulkImport
        onClose={() => {
          setShowCertificateBulkImport(false)
        }}
        onImportComplete={(result) => {
          // Refresh data after successful import
          fetchData()
          fetchParentCategories()
        }}
      />
    )}

    {/* Skills Bulk Import Modal */}
    {showSkillsBulkImport && (
      <SkillsBulkImport
        onClose={() => {
          setShowSkillsBulkImport(false)
        }}
        onImportComplete={(result) => {
          // Refresh data after successful import
          fetchData()
          fetchParentCategories()
        }}
      />
    )}
    {showAIFilter ? (
        <AIFilterChatbot
          onClose={() => {setShowAIFilter(false);setAIDataFetched(false); }}
          onApplyFilters={handleAIFilterApply}
          tableName={TABLE_VIEW_MAPPING[activeTab]}
          defaultMessage={`Hello! How can I help you filter the list today?`}
        />
      ) : null}
    </>
  )
}

export default Skills