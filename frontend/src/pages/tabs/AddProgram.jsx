import React, { useState, useEffect, useRef } from 'react'
import { animationStyles, MultiSelect, SearchableSelect, EmployeeMultiSelect } from './LearningManagementComponents.jsx'
import apiClient from '../../utils/auth.js'
import * as XLSX from 'xlsx'
import DateInput from '../../components/DateInput.jsx'
import { parseDateToStorage, formatDateForDisplay, formatDateToMonthFormat } from '../../utils/dateUtils.js'

const AddProgram = ({ employees, onCancel, onSubmit }) => {
  const [expandedSections, setExpandedSections] = useState({
    basicInfo: true,
    modules: false,
    owners: false,
    resources: false,
    participants: false
  })

  const [formData, setFormData] = useState({
    program_name: '',
    program_type: '',
    version: '',
    estimated_duration: '',
    description: '',
    category_tags: '',
    modules_data: '',
    modules: [], // Array of module objects: { name, submodules: [{ name, startDate, endDate, url }] }
    owners: [],
    resources: [],
    participants: []
  })

  const [newResource, setNewResource] = useState({ title: '', url: '' })
  const [editingResourceIndex, setEditingResourceIndex] = useState(null)
  const [certificates, setCertificates] = useState([])
  const [selectedCertificate, setSelectedCertificate] = useState(null)
  const [editingModuleIndex, setEditingModuleIndex] = useState(null)
  const fileInputRef = useRef(null)
  const [showModuleImportModal, setShowModuleImportModal] = useState(false)
  const [moduleImportErrors, setModuleImportErrors] = useState([])
  // Store original values when entering edit mode to restore on cancel
  const originalEditValuesRef = useRef(null)

  // Helper function to generate unique IDs for modules and submodules
  const generateModuleId = () => {
    return `module_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  const generateSubmoduleId = () => {
    return `submodule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // Helper function to ensure all modules and submodules have IDs
  const ensureModuleIds = (modules) => {
    if (!Array.isArray(modules)) return []
    
    return modules.map(module => ({
      ...module,
      module_id: module.module_id || generateModuleId(),
      submodules: (module.submodules || []).map(submodule => ({
        ...submodule,
        submodule_id: submodule.submodule_id || generateSubmoduleId()
      }))
    }))
  }

  // Fetch certificates from API
  useEffect(() => {
    const fetchCertificates = async () => {
      try {
        const response = await apiClient.get('/api/certificates/management')
        if (response.data && response.data.certificates) {
          setCertificates(response.data.certificates || [])
        }
      } catch (error) {
        console.error('Error fetching certificates:', error)
      }
    }
    fetchCertificates()
  }, [])

  // Update program name and category when certificate is selected
  useEffect(() => {
    if (formData.program_type === 'Certification' && selectedCertificate) {
      const cert = certificates.find(c => c.certificate_id === selectedCertificate)
      if (cert) {
        setFormData(prev => ({
          ...prev,
          program_name: cert.certificate_name,
          category_tags: cert.certificate_category || ''
        }))
      }
    } else if (formData.program_type === 'Training') {
      // Clear certificate selection when switching to Training
      setSelectedCertificate(null)
    }
  }, [selectedCertificate, formData.program_type, certificates])

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    // Ensure all modules and submodules have IDs before submitting
    const modulesWithIds = ensureModuleIds(formData.modules)
    
    // Include selectedCertificate in the data passed to parent
    onSubmit({
      ...formData,
      modules: modulesWithIds,
      selectedCertificate: selectedCertificate
    })
  }

  const handleAddResource = () => {
    if (newResource.title && newResource.url) {
      setFormData(prev => ({
        ...prev,
        resources: [...prev.resources, { ...newResource }]
      }))
      setNewResource({ title: '', url: '' })
    }
  }

  const handleEditResource = (index) => {
    setEditingResourceIndex(index)
    setNewResource({ ...formData.resources[index] })
  }

  const handleUpdateResource = () => {
    if (editingResourceIndex !== null && newResource.title && newResource.url) {
      const updatedResources = [...formData.resources]
      updatedResources[editingResourceIndex] = { ...newResource }
      setFormData(prev => ({
        ...prev,
        resources: updatedResources
      }))
      setNewResource({ title: '', url: '' })
      setEditingResourceIndex(null)
    }
  }

  const handleDeleteResource = (index) => {
    setFormData(prev => ({
      ...prev,
      resources: prev.resources.filter((_, i) => i !== index)
    }))
  }

  // Download module import template
  const downloadModuleTemplate = () => {
    // Template data matching the image format: Modules, Submodules, Start date, End date, Url
    const templateData = [
      ['Modules', 'Submodules', 'Start date', 'End date', 'Url'],
      ['Module 1: Introduction to AI/LLMs & Linux Fundamentals', 'Sub module1: Understanding AI & Large Language', '09 July', '09 July', 'https://www.udemy.com/course/advanced-react/'],
      ['', 'Sub module 2: Linux Environment Setup', '14 July', '14 July', 'https://www.udemy.com/course/advanced-react/'],
      ['', 'Sub module3: Command Line Mastery', '15 July', '15 July', 'https://www.udemy.com/course/advanced-react/'],
      ['', 'Sub module 4: Shell Scripting', '16 July', '16 July', 'https://www.udemy.com/course/advanced-react/'],
      ['Module 2: Product Design & Specification', 'Sub module 1: The Product-Centric Mindset', '17 July', '17 July', 'https://www.udemy.com/course/advanced-react/'],
      ['', 'Sub module 2: Agile & Scrum Mastery', '18 July', '18 July', 'https://www.udemy.com/course/advanced-react/'],
      ['', 'Sub module3: From Idea to Blueprint', '29 August', '29 August', 'https://www.udemy.com/course/advanced-react/'],
      ['', 'Sub module 4: AI-Powered Development & Collaboration', '20 July', '20 July', 'https://www.udemy.com/course/advanced-react/']
    ]

    // Create a new workbook
    const wb = XLSX.utils.book_new()
    
    // Convert array of arrays to worksheet
    const ws = XLSX.utils.aoa_to_sheet(templateData)
    
    // Set column widths for better readability
    ws['!cols'] = [
      { wch: 50 }, // Modules
      { wch: 45 }, // Submodules
      { wch: 15 }, // Start date
      { wch: 15 }, // End date
      { wch: 50 }  // Url
    ]
    
    // Merge cells for module names (where submodules exist)
    // Module 1 spans rows 2-5 (0-indexed: 1-4)
    if (!ws['A2']) ws['A2'] = { t: 's', v: 'Module 1: Introduction to AI/LLMs & Linux Fundamentals' }
    ws['!merges'] = [
      { s: { r: 1, c: 0 }, e: { r: 4, c: 0 } }, // Module 1
      { s: { r: 5, c: 0 }, e: { r: 8, c: 0 } }  // Module 2
    ]
    
    // Style header row
    const headerStyle = {
      fill: { fgColor: { rgb: '90EE90' } }, // Light green background
      font: { bold: true }
    }
    
    // Apply header style to first row
    const headerRange = XLSX.utils.decode_range(ws['!ref'])
    for (let col = 0; col <= headerRange.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col })
      if (!ws[cellAddress]) continue
      ws[cellAddress].s = headerStyle
    }
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Modules')
    
    // Write file and trigger download
    XLSX.writeFile(wb, 'Program_Modules_Import_Template.xlsx')
  }

  // Handle Excel file import for modules
  const handleModuleFileImport = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const fileType = file.name.split('.').pop().toLowerCase()
    if (!['xlsx', 'xls'].includes(fileType)) {
      setModuleImportErrors(['Please select an Excel file (.xlsx or .xls)'])
      return
    }

    setModuleImportErrors([])

    try {
      const reader = new FileReader()
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target.result)
          const workbook = XLSX.read(data, { type: 'array' })
          const firstSheetName = workbook.SheetNames[0]
          const worksheet = workbook.Sheets[firstSheetName]
          
          // Use sheet_to_json with raw: true to get actual cell values (including Excel serial dates)
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true, defval: '' })

          if (jsonData.length < 2) {
            alert('Excel file must have at least a header row and one data row')
            return
          }

          // Helper function to convert Excel date serial number or date string to YYYY-MM-DD format
          const formatDate = (dateValue) => {
            if (!dateValue && dateValue !== 0) return ''
            
            // If it's already a string date (like "09 July" or "09 Jul"), parse it
            if (typeof dateValue === 'string' && isNaN(dateValue)) {
              const parsed = parseDateToStorage(dateValue.trim())
              return parsed || ''
            }
            
            // If it's a number (Excel serial date), convert it
            if (typeof dateValue === 'number' && dateValue > 0) {
              // Excel serial date: days since January 1, 1900
              // Excel incorrectly treats 1900 as a leap year, so the epoch is effectively Dec 30, 1899
              // Excel date 1 = Dec 31, 1899, Excel date 2 = Jan 1, 1900
              // So we use Dec 30, 1899 as the epoch and add dateValue days directly
              const excelEpoch = new Date(1899, 11, 30) // Dec 30, 1899 (month 11 = December, day 30)
              const jsDate = new Date(excelEpoch.getTime() + dateValue * 24 * 60 * 60 * 1000)
              
              // Convert to YYYY-MM-DD format
              const year = jsDate.getFullYear()
              const month = String(jsDate.getMonth() + 1).padStart(2, '0')
              const day = String(jsDate.getDate()).padStart(2, '0')
              return `${year}-${month}-${day}`
            }
            
            // If it's a Date object, format it
            if (dateValue instanceof Date) {
              const year = dateValue.getFullYear()
              const month = String(dateValue.getMonth() + 1).padStart(2, '0')
              const day = String(dateValue.getDate()).padStart(2, '0')
              return `${year}-${month}-${day}`
            }
            
            // Try to parse as string
            const parsed = parseDateToStorage(String(dateValue).trim())
            return parsed || ''
          }

          // Get headers (first row)
          const headers = jsonData[0].map(h => String(h || '').trim().toLowerCase())

          // Find column indices - new format: Modules, Submodules, Start date, End date, Url
          const moduleIndex = headers.findIndex(h => h.includes('module') && !h.includes('sub'))
          const submoduleIndex = headers.findIndex(h => h.includes('submodule'))
          const startDateIndex = headers.findIndex(h => h.includes('start') && h.includes('date'))
          const endDateIndex = headers.findIndex(h => h.includes('end') && h.includes('date'))
          const urlIndex = headers.findIndex(h => h.includes('url') || h.includes('link'))

          // Default column indices if not found
          const moduleCol = moduleIndex >= 0 ? moduleIndex : 0
          const submoduleCol = submoduleIndex >= 0 ? submoduleIndex : 1
          const startDateCol = startDateIndex >= 0 ? startDateIndex : 2
          const endDateCol = endDateIndex >= 0 ? endDateIndex : 3
          const urlCol = urlIndex >= 0 ? urlIndex : 4

          // Process rows and group submodules under modules
          const processedModules = []
          let currentModule = null

          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i]
            if (!row || row.every(cell => !cell)) continue // Skip empty rows

            const moduleName = String(row[moduleCol] || '').trim()
            const submoduleName = String(row[submoduleCol] || '').trim()
            const startDate = formatDate(row[startDateCol])
            const endDate = formatDate(row[endDateCol])
            const url = String(row[urlCol] || '').trim()

            // If we have a module name, start a new module
            if (moduleName) {
              // Save previous module if exists
              if (currentModule && currentModule.submodules.length > 0) {
                processedModules.push(currentModule)
              }
              // Start new module with ID
              currentModule = {
                module_id: generateModuleId(),
                name: moduleName,
                submodules: []
              }
            }

            // If we have a submodule name, add it to current module with ID
            if (submoduleName && currentModule) {
              currentModule.submodules.push({
                submodule_id: generateSubmoduleId(),
                name: submoduleName,
                startDate: startDate || '',
                endDate: endDate || '',
                url: url || ''
              })
            }
          }

          // Don't forget the last module
          if (currentModule && currentModule.submodules.length > 0) {
            processedModules.push(currentModule)
          }

          if (processedModules.length > 0) {
            setFormData(prev => ({
              ...prev,
              modules: [...prev.modules, ...processedModules]
            }))
            // Clear file input and close modal
            if (fileInputRef.current) {
              fileInputRef.current.value = ''
            }
            setShowModuleImportModal(false)
            setModuleImportErrors([])
          } else {
            setModuleImportErrors(['No valid modules found in the Excel file'])
          }
        } catch (error) {
          console.error('Error parsing Excel file:', error)
          setModuleImportErrors(['Failed to parse Excel file. Please check the format.'])
        }
      }
      reader.onerror = () => {
        setModuleImportErrors(['Failed to read file'])
      }
      reader.readAsArrayBuffer(file)
    } catch (error) {
      console.error('Error reading file:', error)
      setModuleImportErrors(['Failed to read file'])
    }
  }

  // Handle module edit
  const handleEditModule = (moduleIndex, e) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    
    // If we were editing something else, restore it first
    if (originalEditValuesRef.current && originalEditValuesRef.current.type === 'module' && originalEditValuesRef.current.moduleIndex !== moduleIndex) {
      const { moduleIndex: prevIndex, originalData } = originalEditValuesRef.current
      setFormData(prev => {
        const updatedModules = [...prev.modules]
        updatedModules[prevIndex] = JSON.parse(JSON.stringify(originalData))
        return {
          ...prev,
          modules: updatedModules
        }
      })
    } else if (originalEditValuesRef.current && originalEditValuesRef.current.type === 'submodule') {
      // Restore previous submodule if we were editing one
      const { moduleIndex: prevModIndex, submoduleIndex: prevSubIndex, originalData } = originalEditValuesRef.current
      setFormData(prev => {
        const updatedModules = [...prev.modules]
        updatedModules[prevModIndex] = {
          ...updatedModules[prevModIndex],
          submodules: [...updatedModules[prevModIndex].submodules]
        }
        updatedModules[prevModIndex].submodules[prevSubIndex] = JSON.parse(JSON.stringify(originalData))
        return {
          ...prev,
          modules: updatedModules
        }
      })
    }
    
    // Store original module data before editing
    if (formData.modules[moduleIndex]) {
      originalEditValuesRef.current = {
        type: 'module',
        moduleIndex,
        originalData: JSON.parse(JSON.stringify(formData.modules[moduleIndex]))
      }
    }
    setEditingModuleIndex(moduleIndex)
  }

  // Handle submodule edit
  const handleEditSubmodule = (moduleIndex, submoduleIndex, e) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    
    const editKey = `${moduleIndex}-${submoduleIndex}`
    
    // If we were editing something else, restore it first
    if (originalEditValuesRef.current) {
      if (originalEditValuesRef.current.type === 'module') {
        // Restore previous module if we were editing one
        const { moduleIndex: prevIndex, originalData } = originalEditValuesRef.current
        setFormData(prev => {
          const updatedModules = [...prev.modules]
          updatedModules[prevIndex] = JSON.parse(JSON.stringify(originalData))
          return {
            ...prev,
            modules: updatedModules
          }
        })
      } else if (originalEditValuesRef.current.type === 'submodule') {
        const { moduleIndex: prevModIndex, submoduleIndex: prevSubIndex, originalData } = originalEditValuesRef.current
        const prevEditKey = `${prevModIndex}-${prevSubIndex}`
        // Only restore if it's a different submodule
        if (prevEditKey !== editKey) {
          setFormData(prev => {
            const updatedModules = [...prev.modules]
            updatedModules[prevModIndex] = {
              ...updatedModules[prevModIndex],
              submodules: [...updatedModules[prevModIndex].submodules]
            }
            updatedModules[prevModIndex].submodules[prevSubIndex] = JSON.parse(JSON.stringify(originalData))
            return {
              ...prev,
              modules: updatedModules
            }
          })
        }
      }
    }
    
    // Store original submodule data before editing
    if (formData.modules[moduleIndex]?.submodules[submoduleIndex]) {
      originalEditValuesRef.current = {
        type: 'submodule',
        moduleIndex,
        submoduleIndex,
        originalData: JSON.parse(JSON.stringify(formData.modules[moduleIndex].submodules[submoduleIndex]))
      }
    }
    setEditingModuleIndex(editKey)
  }

  // Handle module update
  const handleUpdateModule = (moduleIndex, updatedModule) => {
    const updatedModules = [...formData.modules]
    // Preserve module_id if it exists, otherwise generate new one
    updatedModules[moduleIndex] = {
      ...updatedModule,
      module_id: updatedModule.module_id || formData.modules[moduleIndex]?.module_id || generateModuleId()
    }
    setFormData(prev => ({
      ...prev,
      modules: updatedModules
    }))
  }

  // Handle submodule update
  const handleUpdateSubmodule = (moduleIndex, submoduleIndex, updatedSubmodule) => {
    const updatedModules = [...formData.modules]
    // Preserve submodule_id if it exists, otherwise generate new one
    updatedModules[moduleIndex].submodules[submoduleIndex] = {
      ...updatedSubmodule,
      submodule_id: updatedSubmodule.submodule_id || formData.modules[moduleIndex]?.submodules[submoduleIndex]?.submodule_id || generateSubmoduleId()
    }
    setFormData(prev => ({
      ...prev,
      modules: updatedModules
    }))
  }

  // Handle saving all changes when clicking save button
  const handleSaveModule = (moduleIndex) => {
    originalEditValuesRef.current = null
    setEditingModuleIndex(null)
  }

  // Handle canceling module edit
  const handleCancelModule = (moduleIndex) => {
    // Restore original module data if it was stored
    if (originalEditValuesRef.current && originalEditValuesRef.current.type === 'module' && originalEditValuesRef.current.moduleIndex === moduleIndex) {
      const { originalData } = originalEditValuesRef.current
      setFormData(prev => {
        const updatedModules = [...prev.modules]
        updatedModules[moduleIndex] = JSON.parse(JSON.stringify(originalData))
        return {
          ...prev,
          modules: updatedModules
        }
      })
      originalEditValuesRef.current = null
    }
    setEditingModuleIndex(null)
  }

  // Handle saving submodule changes
  const handleSaveSubmodule = () => {
    originalEditValuesRef.current = null
    setEditingModuleIndex(null)
  }

  // Handle canceling submodule edit
  const handleCancelSubmodule = () => {
    // Restore original submodule data if it was stored
    if (originalEditValuesRef.current && originalEditValuesRef.current.type === 'submodule') {
      const { moduleIndex, submoduleIndex, originalData } = originalEditValuesRef.current
      setFormData(prev => {
        const updatedModules = [...prev.modules]
        updatedModules[moduleIndex] = {
          ...updatedModules[moduleIndex],
          submodules: [...updatedModules[moduleIndex].submodules]
        }
        updatedModules[moduleIndex].submodules[submoduleIndex] = JSON.parse(JSON.stringify(originalData))
        return {
          ...prev,
          modules: updatedModules
        }
      })
      originalEditValuesRef.current = null
    }
    setEditingModuleIndex(null)
  }

  // Handle module delete
  const handleDeleteModule = (moduleIndex) => {
    if (window.confirm('Are you sure you want to delete this module and all its submodules?')) {
      setFormData(prev => {
        // Create a new array without the module at moduleIndex
        const updatedModules = prev.modules.filter((_, i) => i !== moduleIndex)
        return {
          ...prev,
          modules: updatedModules
        }
      })
      // Clear editing state if we were editing this module
      if (editingModuleIndex === moduleIndex) {
        setEditingModuleIndex(null)
        originalEditValuesRef.current = null
      }
    }
  }

  // Handle submodule delete
  const handleDeleteSubmodule = (moduleIndex, submoduleIndex) => {
    if (window.confirm('Are you sure you want to delete this submodule?')) {
      setFormData(prev => {
        // Create a deep copy of modules array
        const updatedModules = prev.modules.map((module, idx) => {
          if (idx === moduleIndex) {
            // Create a new module object with filtered submodules
            const updatedSubmodules = module.submodules.filter((_, i) => i !== submoduleIndex)
            // If no submodules left, return null to signal module deletion
            if (updatedSubmodules.length === 0) {
              return null
            }
            return {
              ...module,
              submodules: updatedSubmodules
            }
          }
          return module
        })
        
        // Filter out null modules (deleted modules)
        const filteredModules = updatedModules.filter(module => module !== null)
        
        return {
          ...prev,
          modules: filteredModules
        }
      })
      // Clear editing state if we were editing this submodule
      if (editingModuleIndex === `${moduleIndex}-${submoduleIndex}`) {
        setEditingModuleIndex(null)
        originalEditValuesRef.current = null
      }
    }
  }

  return (
    <>
      <style>{animationStyles}</style>
      <div className="animate-fade-in">

        {/* Form Container */}
        <div className="card p-6 mb-6">
          {/* Form Header */}
          <div className="mb-6 pb-4 border-b border-slate-200 flex justify-between items-center">
            <div className="text-lg font-semibold text-slate-900">Add New Program</div>
            <div className="text-xs text-slate-600">* Required fields</div>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit}>
            <div>
              {/* SECTION 1: Basic Information */}
              <div className="border border-slate-200 rounded-xl mb-4">
                <div
                  onClick={() => toggleSection('basicInfo')}
                  className="px-5 py-4 bg-slate-50 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-2 font-semibold text-slate-900">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                    </svg>
                    Basic Information
                  </div>
                  <svg className={`w-5 h-5 transition-transform ${expandedSections.basicInfo ? '' : 'rotate-180'}`} fill="currentColor" viewBox="0 0 24 24">
                    <path d="M7 10l5 5 5-5z"/>
                  </svg>
                </div>
                {expandedSections.basicInfo && (
                  <div className="p-5 rounded-b-xl">
                    <div className="grid grid-cols-3 gap-5 mb-5">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                          Program Type <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={formData.program_type}
                          onChange={(e) => {
                            setFormData({...formData, program_type: e.target.value, program_name: '', category_tags: '', version: ''})
                            setSelectedCertificate(null)
                          }}
                          className="select-field"
                          required
                        >
                          <option value="">Select type...</option>
                          <option value="Training">Training</option>
                          <option value="Certification">Certification</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                          Program Name <span className="text-red-500">*</span>
                        </label>
                        {formData.program_type === 'Certification' ? (
                          <SearchableSelect
                            label=""
                            options={certificates.map(cert => ({
                              value: cert.certificate_id,
                              label: cert.certificate_name
                            }))}
                            value={selectedCertificate}
                            onChange={setSelectedCertificate}
                            placeholder="Select certificate..."
                            searchPlaceholder="Search certificates..."
                            required
                          />
                        ) : (
                          <input
                            type="text"
                            value={formData.program_name}
                            onChange={(e) => setFormData({...formData, program_name: e.target.value})}
                            className="input-field"
                            placeholder="e.g., Advanced React Patterns"
                            required
                          />
                        )}
                      </div>
                      {formData.program_type === 'Certification' && (
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Version <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={formData.version}
                            onChange={(e) => setFormData({...formData, version: e.target.value})}
                            className="input-field"
                            placeholder="e.g., v.1.2"
                            required
                          />
                        </div>
                      )}
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Estimated Duration</label>
                        <input
                          type="text"
                          value={formData.estimated_duration}
                          onChange={(e) => setFormData({...formData, estimated_duration: e.target.value})}
                          className="input-field"
                          placeholder="e.g., 6 weeks"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-5">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Description</label>
                        <input
                          type="text"
                          value={formData.description}
                          onChange={(e) => setFormData({...formData, description: e.target.value})}
                          className="input-field"
                          placeholder="Brief description of the program"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Category / Tags</label>
                        {formData.program_type === 'Certification' && selectedCertificate ? (
                          <input
                            type="text"
                            value={formData.category_tags}
                            className="input-field bg-slate-100"
                            readOnly
                            placeholder="Category will be auto-filled from certificate"
                          />
                        ) : (
                          <input
                            type="text"
                            value={formData.category_tags}
                            onChange={(e) => setFormData({...formData, category_tags: e.target.value})}
                            className="input-field"
                            placeholder="e.g., Frontend, React, JavaScript"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 2: Program Modules */}
              <div className="border border-slate-200 rounded-xl mb-4">
                <div
                  onClick={() => toggleSection('modules')}
                  className="px-5 py-4 bg-slate-50 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-2 font-semibold text-slate-900">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/>
                    </svg>
                    Program Modules <span className="text-sm font-normal text-slate-500">(Optional)</span>
                  </div>
                  <svg className={`w-5 h-5 transition-transform ${expandedSections.modules ? '' : 'rotate-180'}`} fill="currentColor" viewBox="0 0 24 24">
                    <path d="M7 10l5 5 5-5z"/>
                  </svg>
                </div>
                {expandedSections.modules && (
                  <div className="p-5 rounded-b-xl">
                    <div className="flex items-center justify-between mb-4">
                      <label className="block text-sm font-semibold text-slate-700">Program Modules</label>
                      <button
                        type="button"
                        onClick={() => setShowModuleImportModal(true)}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-2 border border-slate-300"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                        </svg>
                        Import Excel
                      </button>
                    </div>

                    {/* Modules Table */}
                    {formData.modules.length > 0 ? (
                      <div className="mb-4 border border-slate-200 rounded-xl overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse">
                            <thead className="bg-green-50 border-b border-slate-200">
                              <tr>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-700 uppercase tracking-wider">Modules</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-700 uppercase tracking-wider">Submodules</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-700 uppercase tracking-wider">Start date</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-700 uppercase tracking-wider">End date</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-700 uppercase tracking-wider">Url</th>
                                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-700 uppercase tracking-wider">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                              {formData.modules.map((module, moduleIndex) => {
                                const isEditingModule = editingModuleIndex === moduleIndex
                                // Use a more stable key combining module name and index
                                const moduleKey = `module-${moduleIndex}-${module.name || 'unnamed'}`
                                return (
                                  <React.Fragment key={moduleKey}>
                                    {/* Module Row */}
                                    <tr className="bg-slate-50 hover:bg-slate-100 transition-colors">
                                      <td 
                                        className="px-4 py-3 text-sm font-semibold text-slate-900 align-top"
                                        rowSpan={module.submodules.length || 1}
                                      >
                                        <div className="flex items-center justify-between gap-2">
                                          <div className="flex-1">
                                            {isEditingModule ? (
                                              <input
                                                type="text"
                                                value={module.name || ''}
                                                onChange={(e) => {
                                                  const updated = { ...module, name: e.target.value }
                                                  handleUpdateModule(moduleIndex, updated)
                                                }}
                                                className="input-field text-sm py-1 w-full"
                                                autoFocus
                                                placeholder="Module Name"
                                              />
                                            ) : (
                                              <span>{module.name}</span>
                                            )}
                                          </div>
                                        </div>
                                        {isEditingModule ? (
                                            <div className="flex items-center gap-2 flex-shrink-0 mt-1 mb-2">
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.preventDefault()
                                                  e.stopPropagation()
                                                  handleSaveModule(moduleIndex)
                                                }}
                                                className="px-3 py-1 text-sm font-medium text-green-600 hover:text-green-800 hover:bg-green-50 rounded transition-colors"
                                                title="Save changes"
                                              >
                                                Save
                                              </button>
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.preventDefault()
                                                  e.stopPropagation()
                                                  handleCancelModule(moduleIndex)
                                                }}
                                                className="px-3 py-1 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-50 rounded transition-colors"
                                                title="Cancel"
                                              >
                                                Cancel
                                              </button>
                                            </div>
                                          ) : (
                                            <div className="flex items-center gap-2 flex-shrink-0 mt-1">
                                              <button
                                                type="button"
                                                onClick={(e) => handleEditModule(moduleIndex, e)}
                                                className="text-green-600 hover:text-green-800 transition-colors"
                                                title="Edit Module"
                                              >
                                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                                  <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                                                </svg>
                                              </button>
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.preventDefault()
                                                  e.stopPropagation()
                                                  handleDeleteModule(moduleIndex)
                                                }}
                                                className="text-red-600 hover:text-red-800 transition-colors"
                                                title="Delete Module"
                                              >
                                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                                                </svg>
                                              </button>
                                            </div>
                                          )}
                                      </td>
                                      {/* First submodule row - includes module actions */}
                                      {module.submodules.length > 0 ? (
                                        <>
                                          <td className="px-4 py-3 text-sm text-slate-700">
                                            {editingModuleIndex === `${moduleIndex}-0` ? (
                                              <input
                                                type="text"
                                                value={module.submodules[0].name || ''}
                                                onChange={(e) => {
                                                  const updated = { ...module.submodules[0], name: e.target.value }
                                                  handleUpdateSubmodule(moduleIndex, 0, updated)
                                                }}
                                                className="input-field text-sm py-1 w-full"
                                                autoFocus
                                                placeholder="Submodule Name"
                                              />
                                            ) : (
                                              module.submodules[0].name
                                            )}
                                          </td>
                                          <td className="px-4 py-3 text-sm text-slate-600">
                                            {editingModuleIndex === `${moduleIndex}-0` ? (
                                              <DateInput
                                                value={module.submodules[0].startDate || ''}
                                                onChange={(dateValue) => {
                                                  const updated = { ...module.submodules[0], startDate: dateValue }
                                                  handleUpdateSubmodule(moduleIndex, 0, updated)
                                                }}
                                                className="input-field text-sm py-1 w-full"
                                                placeholder="dd-mm-yyyy"
                                              />
                                            ) : (
                                              module.submodules[0].startDate ? formatDateForDisplay(module.submodules[0].startDate) : '-'
                                            )}
                                          </td>
                                          <td className="px-4 py-3 text-sm text-slate-600">
                                            {editingModuleIndex === `${moduleIndex}-0` ? (
                                              <DateInput
                                                value={module.submodules[0].endDate || ''}
                                                onChange={(dateValue) => {
                                                  const updated = { ...module.submodules[0], endDate: dateValue }
                                                  handleUpdateSubmodule(moduleIndex, 0, updated)
                                                }}
                                                className="input-field text-sm py-1 w-full"
                                                placeholder="dd-mm-yyyy"
                                              />
                                            ) : (
                                              module.submodules[0].endDate ? formatDateForDisplay(module.submodules[0].endDate) : '-'
                                            )}
                                          </td>
                                          <td className="px-4 py-3 text-sm">
                                            {editingModuleIndex === `${moduleIndex}-0` ? (
                                              <input
                                                type="text"
                                                value={module.submodules[0].url || ''}
                                                onChange={(e) => {
                                                  const updated = { ...module.submodules[0], url: e.target.value }
                                                  handleUpdateSubmodule(moduleIndex, 0, updated)
                                                }}
                                                className="input-field text-sm py-1 w-full"
                                                placeholder="URL"
                                              />
                                            ) : module.submodules[0].url ? (
                                              <a
                                                href={module.submodules[0].url.startsWith('http') ? module.submodules[0].url : `https://${module.submodules[0].url}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs text-blue-600 hover:underline break-all"
                                              >
                                                {module.submodules[0].url}
                                              </a>
                                            ) : (
                                              <span className="text-xs text-slate-400">-</span>
                                            )}
                                          </td>
                                          <td className="px-4 py-3 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                              {editingModuleIndex === `${moduleIndex}-0` ? (
                                                <>
                                                  <button
                                                    type="button"
                                                    onClick={(e) => {
                                                      e.preventDefault()
                                                      e.stopPropagation()
                                                      handleSaveSubmodule()
                                                    }}
                                                    className="px-3 py-1 text-sm font-medium text-green-600 hover:text-green-800 hover:bg-green-50 rounded transition-colors"
                                                    title="Save changes"
                                                  >
                                                    Save
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={(e) => {
                                                      e.preventDefault()
                                                      e.stopPropagation()
                                                      handleCancelSubmodule()
                                                    }}
                                                    className="px-3 py-1 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-50 rounded transition-colors"
                                                    title="Cancel"
                                                  >
                                                    Cancel
                                                  </button>
                                                </>
                                              ) : (
                                                <>
                                                  <button
                                                    type="button"
                                                    onClick={(e) => handleEditSubmodule(moduleIndex, 0, e)}
                                                    className="text-green-600 hover:text-green-800 transition-colors"
                                                    title="Edit"
                                                  >
                                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                                      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                                                    </svg>
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={(e) => {
                                                      e.preventDefault()
                                                      e.stopPropagation()
                                                      handleDeleteSubmodule(moduleIndex, 0)
                                                    }}
                                                    className="text-red-600 hover:text-red-800 transition-colors"
                                                    title="Delete"
                                                  >
                                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                                      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                                                    </svg>
                                                  </button>
                                                </>
                                              )}
                                            </div>
                                          </td>
                                        </>
                                      ) : (
                                        <td colSpan="4" className="px-4 py-3 text-sm text-slate-400 italic">
                                          No submodules
                                        </td>
                                      )}
                                    </tr>
                                    {/* Submodule Rows */}
                                    {module.submodules.slice(1).map((submodule, subIndex) => {
                                      const actualSubIndex = subIndex + 1
                                      const isEditingSub = editingModuleIndex === `${moduleIndex}-${actualSubIndex}`
                                      return (
                                        <tr key={actualSubIndex} className="hover:bg-slate-50 transition-colors">
                                          <td className="px-4 py-3 text-sm text-slate-700">
                                            {isEditingSub ? (
                                              <input
                                                type="text"
                                                value={submodule.name || ''}
                                                onChange={(e) => {
                                                  const updated = { ...submodule, name: e.target.value }
                                                  handleUpdateSubmodule(moduleIndex, actualSubIndex, updated)
                                                }}
                                                className="input-field text-sm py-1 w-full"
                                                autoFocus
                                                placeholder="Submodule Name"
                                              />
                                            ) : (
                                              submodule.name
                                            )}
                                          </td>
                                          <td className="px-4 py-3 text-sm text-slate-600">
                                            {isEditingSub ? (
                                              <DateInput
                                                value={submodule.startDate || ''}
                                                onChange={(dateValue) => {
                                                  const updated = { ...submodule, startDate: dateValue }
                                                  handleUpdateSubmodule(moduleIndex, actualSubIndex, updated)
                                                }}
                                                className="input-field text-sm py-1 w-full"
                                                placeholder="dd-mm-yyyy"
                                              />
                                            ) : (
                                              submodule.startDate ? formatDateForDisplay(submodule.startDate) : '-'
                                            )}
                                          </td>
                                          <td className="px-4 py-3 text-sm text-slate-600">
                                            {isEditingSub ? (
                                              <DateInput
                                                value={submodule.endDate || ''}
                                                onChange={(dateValue) => {
                                                  const updated = { ...submodule, endDate: dateValue }
                                                  handleUpdateSubmodule(moduleIndex, actualSubIndex, updated)
                                                }}
                                                className="input-field text-sm py-1 w-full"
                                                placeholder="dd-mm-yyyy"
                                              />
                                            ) : (
                                              submodule.endDate ? formatDateForDisplay(submodule.endDate) : '-'
                                            )}
                                          </td>
                                          <td className="px-4 py-3 text-sm">
                                            {isEditingSub ? (
                                              <input
                                                type="text"
                                                value={submodule.url || ''}
                                                onChange={(e) => {
                                                  const updated = { ...submodule, url: e.target.value }
                                                  handleUpdateSubmodule(moduleIndex, actualSubIndex, updated)
                                                }}
                                                className="input-field text-sm py-1 w-full"
                                                placeholder="URL"
                                              />
                                            ) : submodule.url ? (
                                              <a
                                                href={submodule.url.startsWith('http') ? submodule.url : `https://${submodule.url}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs text-blue-600 hover:underline break-all"
                                              >
                                                {submodule.url}
                                              </a>
                                            ) : (
                                              <span className="text-xs text-slate-400">-</span>
                                            )}
                                          </td>
                                          <td className="px-4 py-3 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                              {isEditingSub ? (
                                                <>
                                                  <button
                                                    type="button"
                                                    onClick={(e) => {
                                                      e.preventDefault()
                                                      e.stopPropagation()
                                                      handleSaveSubmodule()
                                                    }}
                                                    className="px-3 py-1 text-sm font-medium text-green-600 hover:text-green-800 hover:bg-green-50 rounded transition-colors"
                                                    title="Save changes"
                                                  >
                                                    Save
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={(e) => {
                                                      e.preventDefault()
                                                      e.stopPropagation()
                                                      handleCancelSubmodule()
                                                    }}
                                                    className="px-3 py-1 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-50 rounded transition-colors"
                                                    title="Cancel"
                                                  >
                                                    Cancel
                                                  </button>
                                                </>
                                              ) : (
                                                <>
                                                  <button
                                                    type="button"
                                                    onClick={(e) => handleEditSubmodule(moduleIndex, actualSubIndex, e)}
                                                    className="text-green-600 hover:text-green-800 transition-colors"
                                                    title="Edit"
                                                  >
                                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                                      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                                                    </svg>
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={(e) => {
                                                      e.preventDefault()
                                                      e.stopPropagation()
                                                      handleDeleteSubmodule(moduleIndex, actualSubIndex)
                                                    }}
                                                    className="text-red-600 hover:text-red-800 transition-colors"
                                                    title="Delete"
                                                  >
                                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                                      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                                                    </svg>
                                                  </button>
                                                </>
                                              )}
                                            </div>
                                          </td>
                                        </tr>
                                      )
                                    })}
                                  </React.Fragment>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div className="border border-slate-200 rounded-xl p-8 mb-4 text-center text-slate-500 italic min-h-[120px] flex items-center justify-center bg-slate-50">
                        No modules added yet. Click "Import Excel" to add modules from an Excel file.
                      </div>
                    )}

                    <div className="text-xs text-slate-600 mt-2">
                      <strong>Excel Format:</strong> First row should contain headers (Modules, Submodules, Start date, End date, Url). Enter module name in the first row, then leave Modules column empty for subsequent submodule rows. You can also manually edit or delete modules and submodules after import.
                    </div>
                  </div>
                )}
              </div>

              {/* Module Import Modal */}
              {showModuleImportModal && (
                <div 
                  className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
                  onClick={(e) => {
                    if (e.target === e.currentTarget) {
                      setShowModuleImportModal(false)
                      setModuleImportErrors([])
                    }
                  }}
                >
                  <div 
                    className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-slate-200">
                      <div>
                        <h3 className="text-xl font-bold text-slate-900">Import Program Modules</h3>
                        <p className="text-slate-600 mt-1">Upload an Excel file to import modules</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowModuleImportModal(false)
                          setModuleImportErrors([])
                          if (fileInputRef.current) {
                            fileInputRef.current.value = ''
                          }
                        }}
                        className="text-slate-400 hover:text-slate-600 transition-colors p-1"
                        title="Close import modal"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                      </button>
                    </div>

                    <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
                      {/* Required Columns Info */}
                      <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-green-900">Required Columns</h4>
                          <button
                            type="button"
                            onClick={downloadModuleTemplate}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-green-700 bg-green-100 rounded-lg hover:bg-green-200 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                            </svg>
                            Download Template
                          </button>
                        </div>
                        <p className="text-green-800 text-sm mb-3">Your Excel file must contain the following columns:</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                            <span className="font-medium">Modules</span>
                            <span className="text-green-600">(Required)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                            <span className="font-medium">Submodules</span>
                            <span className="text-green-600">(Required)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                            <span className="font-medium">Start date</span>
                            <span className="text-slate-500">(Optional)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                            <span className="font-medium">End date</span>
                            <span className="text-slate-500">(Optional)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                            <span className="font-medium">Url</span>
                            <span className="text-slate-500">(Optional)</span>
                          </div>
                        </div>
                        <div className="mt-3 p-3 bg-green-100 rounded text-sm text-green-800">
                          <strong>Note:</strong> Module Name is required. Duration and URLs are optional. You can have multiple URL columns (URL1, URL2, URL3, etc.).
                        </div>
                      </div>

                      {/* File Upload Area */}
                      <div className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center hover:border-slate-400 transition-all">
                        <div className="space-y-4">
                          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
                            </svg>
                          </div>
                          <div>
                            <p className="text-lg font-medium text-slate-900 mb-2">
                              Drop your Excel file here
                            </p>
                            <p className="text-slate-500 mb-4">
                              Supported formats: .xlsx, .xls
                            </p>
                            <input
                              type="file"
                              ref={fileInputRef}
                              accept=".xlsx,.xls"
                              onChange={handleModuleFileImport}
                              className="hidden"
                              id="module-file-input"
                            />
                            <label
                              htmlFor="module-file-input"
                              className="btn-primary inline-block cursor-pointer"
                            >
                              Choose File
                            </label>
                          </div>
                        </div>
                      </div>

                      {/* Errors */}
                      {moduleImportErrors.length > 0 && (
                        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                          <div className="flex items-center mb-2">
                            <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                            <h4 className="font-semibold text-red-800">Error</h4>
                          </div>
                          <ul className="text-red-700 text-sm space-y-1">
                            {moduleImportErrors.map((error, index) => (
                              <li key={index}>• {error}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end p-6 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={() => {
                          setShowModuleImportModal(false)
                          setModuleImportErrors([])
                          if (fileInputRef.current) {
                            fileInputRef.current.value = ''
                          }
                        }}
                        className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 3: Program Owners */}
              <div className="border border-slate-200 rounded-xl mb-4">
                <div
                  onClick={() => toggleSection('owners')}
                  className="px-5 py-4 bg-slate-50 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors rounded-t-xl"
                >
                  <div className="flex items-center gap-2 font-semibold text-slate-900">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                    </svg>
                    Program Owners
                  </div>
                  <svg className={`w-5 h-5 transition-transform ${expandedSections.owners ? '' : 'rotate-180'}`} fill="currentColor" viewBox="0 0 24 24">
                    <path d="M7 10l5 5 5-5z"/>
                  </svg>
                </div>
                {expandedSections.owners && (
                  <div className="p-5 rounded-b-xl">
                    <EmployeeMultiSelect
                      label="Select Program Owners"
                      selectedValues={formData.owners}
                      onSelectionChange={(values) => setFormData({...formData, owners: values})}
                      placeholder="Click to select employees who will manage this program..."
                      required
                    />
                    <div className="text-xs text-slate-600 mt-2">
                      Select one or more active employees who will manage this program.
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 4: Resources */}
              <div className="border border-slate-200 rounded-xl mb-4">
                <div
                  onClick={() => toggleSection('resources')}
                  className="px-5 py-4 bg-slate-50 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors rounded-t-xl"
                >
                  <div className="flex items-center gap-2 font-semibold text-slate-900">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/>
                    </svg>
                    Resources & Links <span className="text-sm font-normal text-slate-500">(Optional)</span>
                  </div>
                  <svg className={`w-5 h-5 transition-transform ${expandedSections.resources ? '' : 'rotate-180'}`} fill="currentColor" viewBox="0 0 24 24">
                    <path d="M7 10l5 5 5-5z"/>
                  </svg>
                </div>
                {expandedSections.resources && (
                  <div className="p-5 rounded-b-xl">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Course Materials & Resources</label>
                    {formData.resources.length > 0 ? (
                      <div className="border border-slate-200 rounded-xl p-4 mb-4 min-h-[120px] max-h-[300px] overflow-y-auto scrollbar-thin bg-slate-50">
                        <div className="grid grid-cols-3 gap-3">
                          {formData.resources.map((resource, index) => (
                            <div key={index} className="border border-slate-200 rounded-lg p-3 flex flex-col gap-2 bg-white overflow-hidden">
                              <div className="flex items-start gap-2 font-semibold text-sm text-slate-900 min-w-0">
                                <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/>
                                </svg>
                                <span className="break-words flex-1 min-w-0">{resource.title}</span>
                              </div>
                              <div className="text-xs text-slate-600 break-all">{resource.url}</div>
                              <div className="flex gap-2 justify-end">
                                <button
                                  type="button"
                                  onClick={() => handleEditResource(index)}
                                  className="text-slate-600 hover:text-slate-800 transition-colors"
                                >
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteResource(index)}
                                  className="text-slate-600 hover:text-red-600 transition-colors"
                                >
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                                  </svg>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="border border-slate-200 rounded-xl p-8 mb-4 text-center text-slate-500 italic min-h-[120px] flex items-center justify-center bg-slate-50">
                        No resources added yet. Click below to add.
                      </div>
                    )}
                    <div className="mb-2">
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <input
                          type="text"
                          value={newResource.title}
                          onChange={(e) => setNewResource({...newResource, title: e.target.value})}
                          placeholder="Resource Title"
                          className="input-field"
                        />
                        <input
                          type="url"
                          value={newResource.url}
                          onChange={(e) => setNewResource({...newResource, url: e.target.value})}
                          placeholder="Resource URL"
                          className="input-field"
                        />
                      </div>
                      <div className="flex items-center justify-start">
                      <button
                        type="button"
                        onClick={editingResourceIndex !== null ? handleUpdateResource : handleAddResource}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-2 border border-slate-300"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                        </svg>
                        {editingResourceIndex !== null ? 'Update Resource Link' : 'Add Resource Link'}
                      </button>
                      {editingResourceIndex !== null && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingResourceIndex(null)
                            setNewResource({ title: '', url: '' })
                          }}
                          className="ml-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold transition-all duration-200 border border-slate-300"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                    </div>
      
                  </div>
                )}
              </div>

              {/* SECTION 5: Participants */}
              <div className="border border-slate-200 rounded-xl mb-4">
                <div
                  onClick={() => toggleSection('participants')}
                  className="px-5 py-4 bg-slate-50 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors rounded-t-xl"
                >
                  <div className="flex items-center gap-2 font-semibold text-slate-900">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                    </svg>
                    Program Participants <span className="text-sm font-normal text-slate-500">(Optional)</span>
                  </div>
                  <svg className={`w-5 h-5 transition-transform ${expandedSections.participants ? '' : 'rotate-180'}`} fill="currentColor" viewBox="0 0 24 24">
                    <path d="M7 10l5 5 5-5z"/>
                  </svg>
                </div>
                {expandedSections.participants && (
                  <div className="p-5 rounded-b-xl">
                    <EmployeeMultiSelect
                      label="Enroll Participants"
                      selectedValues={formData.participants}
                      onSelectionChange={(values) => setFormData({...formData, participants: values})}
                      placeholder="Click to select employees to enroll in this program..."
                    />
                    <div className="text-xs text-slate-600 mt-2">
                      Optional: Add participants during program creation or add them later from the program list.
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Form Footer */}
            <div className="mt-1 pt-6 border-t border-slate-200 flex justify-end">
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={onCancel}
                  className="btn-secondary"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                  </svg>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/>
                  </svg>
                  Create Program
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}

export default AddProgram

