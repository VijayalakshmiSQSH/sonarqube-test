import { useState } from 'react'
import * as XLSX from 'xlsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useEmployees } from '../context/EmployeeContext.jsx'
import { usePermissions } from '../context/PermissionContext.jsx'
import { getCookie } from '../utils/helpers.js'
import { TOKEN, getApiBaseUrl } from '../utils/constants.js'

const BulkImport = ({ onClose, onImportComplete }) => {
  const { hasPermission } = usePermissions()
  const [dragActive, setDragActive] = useState(false)
  const [file, setFile] = useState(null)
  const [errors, setErrors] = useState([])
  const [loading, setLoading] = useState(false)
  const [currentStep, setCurrentStep] = useState('upload') // 'upload', 'analyzing', 'analysis', 'importing', 'complete'
  const [importResult, setImportResult] = useState(null)
  const [analysisResult, setAnalysisResult] = useState(null)
  const [userDecisions, setUserDecisions] = useState({}) // Store user decisions for duplicates
  
  const { isAuthenticated } = useAuth()
  const { refreshEmployees } = useEmployees()

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0])
    }
  }

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelection(e.target.files[0])
    }
  }

  const handleFileSelection = (selectedFile) => {
    const fileType = selectedFile.name.split('.').pop().toLowerCase()
    
    if (!['xlsx', 'xls'].includes(fileType)) {
      setErrors(['Please select an Excel file (.xlsx or .xls)'])
      return
    }
    
    setFile(selectedFile)
    setErrors([])
    setCurrentStep('analyzing')
    analyzeFile(selectedFile)
  }

  const analyzeFile = async (file) => {
    setLoading(true)
    
    try {
      // Check if user is authenticated
      if (!isAuthenticated()) {
        setErrors(['You must be logged in to analyze files'])
        setCurrentStep('upload')
        setLoading(false)
        return
      }
      
      // Get token from cookie
      const token = getCookie(TOKEN)
      if (!token) {
        setErrors(['Authentication token not found. Please log in again.'])
        setCurrentStep('upload')
        setLoading(false)
        return
      }
      
      const formData = new FormData()
      formData.append('file', file)
      
      // Call analysis endpoint (analyze-only mode)
      const response = await fetch(`${getApiBaseUrl()}/api/employees/bulk-import?analyze=true`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })
      
      let result
      let responseText
      try {
        responseText = await response.text()
        result = JSON.parse(responseText)
      } catch (jsonError) {
        console.error('JSON parsing error:', jsonError)
        console.error('Response text:', responseText || 'No response text available')
        throw new Error(`Server returned invalid response: ${response.status} ${response.statusText}`)
      }
      
      if (response.ok) {
        setAnalysisResult(result)
        setCurrentStep('analysis')
      } else {
        setErrors(result.details || [result.error || 'Failed to analyze file'])
        setCurrentStep('upload')
      }
    } catch (error) {
      console.error('Error analyzing file:', error)
      setErrors([error.message || 'Failed to analyze file'])
      setCurrentStep('upload')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmImport = () => {
    if (file) {
      setCurrentStep('importing')
      handleImport(file, userDecisions)
    }
  }

  const handleBulkAction = (category, action) => {
    if (!analysisResult || !analysisResult[category]) return

    const newDecisions = { ...userDecisions }
    
    // Apply the action to all items in the category
    analysisResult[category].forEach(item => {
      newDecisions[item.key] = action
    })
    
    setUserDecisions(newDecisions)
    
    // Show feedback
    const categoryName = category === 'potential_duplicates' ? 'potential duplicates' : 
                        category === 'new_employees' ? 'new employees' : 'perfect matches'
    console.log(`Applied "${action}" to all ${analysisResult[category].length} ${categoryName}`)
  }

  const handleImport = async (file, decisions = {}) => {
    setLoading(true)
    
    try {
      // Check if user has import permission
      if (!hasPermission('workforce-import')) {
        setErrors(['You do not have permission to import employees'])
        setLoading(false)
        return
      }
      
      // Check if user is authenticated
      if (!isAuthenticated()) {
        setErrors(['You must be logged in to import employees'])
        setCurrentStep('upload')
        setLoading(false)
        return
      }
      
      // Get token from cookie
      const token = getCookie(TOKEN)
      if (!token) {
        setErrors(['Authentication token not found. Please log in again.'])
        setCurrentStep('upload')
        setLoading(false)
        return
      }
      
      const formData = new FormData()
      formData.append('file', file)
      formData.append('decisions', JSON.stringify(decisions))
      
      const response = await fetch(`${getApiBaseUrl()}/api/employees/bulk-import`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })
      
      let result
      let responseText
      try {
        responseText = await response.text()
        result = JSON.parse(responseText)
      } catch (jsonError) {
        console.error('JSON parsing error:', jsonError)
        console.error('Response text:', responseText || 'No response text available')
        throw new Error(`Server returned invalid response: ${response.status} ${response.statusText}`)
      }
      
      if (response.ok) {
        setImportResult(result)
        setCurrentStep('complete')
        // Refresh the employee list
        if (refreshEmployees) {
          refreshEmployees()
        }
      } else {
        setErrors(result.details || [result.error || 'Unknown error occurred'])
        setCurrentStep('upload')
      }
    } catch (error) {
      console.error('Import error:', error)
      setErrors([`Import failed: ${error.message}`])
      setCurrentStep('upload')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFile(null)
    setErrors([])
    setImportResult(null)
    setAnalysisResult(null)
    setUserDecisions({})
    setCurrentStep('upload')
  }

  const downloadTemplate = () => {
    // Create a sample Excel template for Employee Import
    const templateData = [
      ['Employee ID', 'First Name', 'Last Name', 'Email address', 'Mobile Number', 'Date of Birth', 'Parent Department', 'Department', 'Designation', 'City', 'State', 'Country', 'Employee Status', 'Employment Type', 'Date of Joining', 'Total Experience', 'Reporting Manager Name'],
      ['EMP001', 'John', 'Doe', 'john.doe@example.com', '1234567890', new Date('1990-01-15'), 'Engineering', 'Software Development', 'Senior Developer', 'Bangalore', 'Karnataka', 'India', 'Active', 'Full-time', new Date('2020-01-15'), '5.5', 'Jane Smith'],
      ['EMP002', 'Jane', 'Smith', 'jane.smith@example.com', '0987654321', new Date('1988-03-20'), 'Engineering', 'Quality Assurance', 'QA Lead', 'Mumbai', 'Maharashtra', 'India', 'Active', 'Full-time', new Date('2019-06-01'), '7.2', 'Bob Johnson'],
      ['EMP003', 'Bob', 'Johnson', 'bob.johnson@example.com', '1122334455', new Date('1992-07-10'), 'Sales', 'Business Development', 'Sales Executive', 'Delhi', 'Delhi', 'India', 'Active', 'Contract', new Date('2021-03-15'), '3.0', 'Alice Williams']
    ]

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(templateData)

    // Set column widths (wider for date columns to prevent ### display)
    ws['!cols'] = [
      { wch: 12 }, // Employee ID
      { wch: 12 }, // First Name
      { wch: 12 }, // Last Name
      { wch: 25 }, // Email address
      { wch: 15 }, // Mobile Number
      { wch: 15 }, // Date of Birth (wider for date display)
      { wch: 18 }, // Parent Department
      { wch: 20 }, // Department
      { wch: 20 }, // Designation
      { wch: 15 }, // City
      { wch: 15 }, // State
      { wch: 15 }, // Country
      { wch: 15 }, // Employee Status
      { wch: 15 }, // Employment Type
      { wch: 15 }, // Date of Joining (wider for date display)
      { wch: 15 }, // Total Experience
      { wch: 20 }  // Reporting Manager Name
    ]

    // Format date columns (columns F and O are 0-indexed, so 5 and 14)
    const dateColumns = [5, 14] // Date of Birth, Date of Joining
    const dateFormat = 'mm/dd/yyyy'
    
    // Apply date formatting to date cells
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
    for (let col of dateColumns) {
      for (let row = 1; row <= range.e.r; row++) { // Start from row 1 (skip header)
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col })
        if (ws[cellAddress]) {
          if (ws[cellAddress].v instanceof Date) {
            // Set Excel date format
            ws[cellAddress].z = dateFormat
            // Ensure the cell type is set correctly
            ws[cellAddress].t = 'd' // 'd' for date
          } else if (ws[cellAddress].v === null || ws[cellAddress].v === '') {
            // Handle empty date cells
            ws[cellAddress].v = ''
            ws[cellAddress].t = 's' // 's' for string
          }
        }
      }
    }

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Employees Template')

    // Write file and trigger download
    XLSX.writeFile(wb, 'Employee_Import_Template.xlsx')
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-2xl font-semibold text-slate-900">Bulk Import Employees</h2>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onClose()
            }}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {currentStep === 'upload' && (
            <div>
              {/* Required Columns Info */}
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-green-900">Required Columns</h4>
                  <button
                    type="button"
                    onClick={downloadTemplate}
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
                    <span className="font-medium">Employee ID</span>
                    <span className="text-green-600">(Required)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    <span className="font-medium">First Name</span>
                    <span className="text-green-600">(Required)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    <span className="font-medium">Last Name</span>
                    <span className="text-green-600">(Required)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    <span className="font-medium">Email address</span>
                    <span className="text-green-600">(Required)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    <span className="font-medium">Mobile Number</span>
                    <span className="text-slate-500">(Optional)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    <span className="font-medium">Date of Birth</span>
                    <span className="text-slate-500">(Optional)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    <span className="font-medium">Parent Department</span>
                    <span className="text-slate-500">(Optional)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    <span className="font-medium">Department</span>
                    <span className="text-slate-500">(Optional)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    <span className="font-medium">Designation</span>
                    <span className="text-slate-500">(Optional)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    <span className="font-medium">City</span>
                    <span className="text-slate-500">(Optional)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    <span className="font-medium">State</span>
                    <span className="text-slate-500">(Optional)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    <span className="font-medium">Country</span>
                    <span className="text-slate-500">(Optional)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    <span className="font-medium">Employee Status</span>
                    <span className="text-slate-500">(Optional)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    <span className="font-medium">Employment Type</span>
                    <span className="text-slate-500">(Optional)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    <span className="font-medium">Date of Joining</span>
                    <span className="text-slate-500">(Optional)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    <span className="font-medium">Total Experience</span>
                    <span className="text-slate-500">(Optional)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    <span className="font-medium">Reporting Manager Name</span>
                    <span className="text-slate-500">(Optional)</span>
                  </div>
                </div>
                <div className="mt-3 p-3 bg-green-100 rounded text-sm text-green-800">
                  <strong>Note:</strong> Employee Status should be one of: Active, Inactive, Resigned, Terminated. Employment Type should be one of: Full-time, Part-time, Contract, Permanent, Intern. Date format should be YYYY-MM-DD or MM/DD/YYYY. Experience should be in years (e.g., 5.5 for 5 years 6 months).
                </div>
              </div>

              {/* File Upload Area */}
              <div
                className={`border-2 border-dashed rounded-xl p-12 text-center transition-all ${
                  dragActive
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-slate-300 hover:border-slate-400'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <div className="space-y-4">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                    <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                      id="file-upload"
                      className="hidden"
                      accept=".xlsx,.xls"
                      onChange={handleFileInput}
                    />
                    <label
                      htmlFor="file-upload"
                      className="btn-primary inline-block cursor-pointer"
                    >
                      Choose File
                    </label>
                  </div>
                </div>
              </div>

              

              {errors.length > 0 && (
                <div className="mt-6 bg-red-50 border border-red-200 rounded-xl p-4">
                  <h4 className="font-medium text-red-800 mb-2">Upload Errors</h4>
                  <ul className="text-sm text-red-600 space-y-1">
                    {errors.map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {currentStep === 'analyzing' && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Analyzing File</h3>
              <p className="text-slate-600">
                Please wait while we analyze <strong>{file?.name}</strong>...
              </p>
            </div>
          )}

          {currentStep === 'analysis' && analysisResult && (
            <div className="py-6">
              {/* Analysis Summary */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-slate-900">Import Analysis</h3>
                  <div className="text-sm text-slate-500">
                    {analysisResult.total_processed} total rows processed
                  </div>
                </div>
                
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                          </svg>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-green-900">{analysisResult.new_count || 0}</div>
                          <div className="text-sm text-green-700">New Employees</div>
                        </div>
                      </div>
                      {analysisResult.new_count > 0 && (
                        <button
                          type="button"
                          onClick={() => handleBulkAction('new_employees', 'create')}
                          className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition-colors"
                          title="Accept all new employees"
                        >
                          Accept All
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center mr-3">
                        <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-amber-900">{analysisResult.duplicate_count || 0}</div>
                        <div className="text-sm text-amber-700">Potential Duplicates</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                          </svg>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-blue-900">{analysisResult.perfect_match_count || 0}</div>
                          <div className="text-sm text-blue-700">Perfect Matches</div>
                        </div>
                      </div>
                      {analysisResult.perfect_match_count > 0 && (
                        <button
                          type="button"
                          onClick={() => handleBulkAction('perfect_matches', 'skip')}
                          className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
                          title="Skip all perfect matches (no changes needed)"
                        >
                          Skip All
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Potential Duplicates Section */}
              {analysisResult.potential_duplicates && analysisResult.potential_duplicates.length > 0 && (
                <div className="mb-6">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <svg className="w-5 h-5 text-amber-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"/>
                        </svg>
                        <h4 className="font-medium text-amber-800">
                          {analysisResult.potential_duplicates.length} potential duplicates require decisions
                        </h4>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => handleBulkAction('potential_duplicates', 'update')}
                          className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
                          title="Accept all updates"
                        >
                          Accept All Updates
                        </button>
                        <button
                          type="button"
                          onClick={() => handleBulkAction('potential_duplicates', 'skip')}
                          className="px-3 py-1 text-xs bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 transition-colors"
                          title="Skip all duplicates"
                        >
                          Skip All
                        </button>
                        <button
                          type="button"
                          onClick={() => handleBulkAction('potential_duplicates', 'create_separate')}
                          className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition-colors"
                          title="Create all as separate"
                        >
                          Create All Separate
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-amber-700 mt-1">
                      Choose an action for each duplicate below, or use bulk actions above. Perfect matches will keep existing data unchanged.
                    </p>
                  </div>

                  <div className="space-y-6">
                    {analysisResult.potential_duplicates.map((duplicate, index) => (
                      <DuplicateComparison
                        key={duplicate.key}
                        duplicate={duplicate}
                        index={index + 1}
                        userDecision={userDecisions[duplicate.key]}
                        onDecisionChange={(decision) => {
                          setUserDecisions(prev => ({
                            ...prev,
                            [duplicate.key]: decision
                          }))
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Decision Summary */}
              {Object.keys(userDecisions).length > 0 && (
                <div className="mb-6 bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <h4 className="font-medium text-slate-900 mb-3">Import Decisions Summary</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-slate-600">New Employees:</span>
                      <span className="font-medium ml-2">
                        {Object.values(userDecisions).filter(d => d === 'create').length} to create
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-600">Updates:</span>
                      <span className="font-medium ml-2">
                        {Object.values(userDecisions).filter(d => d === 'update').length} to update
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-600">Skipped:</span>
                      <span className="font-medium ml-2">
                        {Object.values(userDecisions).filter(d => d === 'skip').length} to skip
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-6 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setCurrentStep('upload')}
                  className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  className="btn-primary"
                  disabled={analysisResult.potential_duplicates && analysisResult.potential_duplicates.length > 0 && 
                           analysisResult.potential_duplicates.some(d => !userDecisions[d.key])}
                >
                  Proceed with Import
                </button>
              </div>
            </div>
          )}


          {currentStep === 'complete' && importResult && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Import Completed Successfully!</h3>
              <div className="text-slate-600 mb-6 space-y-2">
                <p><strong>{importResult.imported_count}</strong> employees imported</p>
                {importResult.skipped_count > 0 && (
                  <p><strong>{importResult.skipped_count}</strong> employees skipped (already exist)</p>
                )}
                <p><strong>{importResult.total_processed}</strong> total rows processed</p>
              </div>
              
              {importResult.errors && importResult.errors.length > 0 && (
                <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 text-left">
                  <h4 className="font-medium text-amber-800 mb-2">Import Warnings</h4>
                  <ul className="text-sm text-amber-700 space-y-1 max-h-32 overflow-y-auto">
                    {importResult.errors.map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              <div className="flex items-center justify-center space-x-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Import Another File
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onImportComplete(importResult)
                    onClose()
                  }}
                  className="btn-primary"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {currentStep === 'importing' && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Importing Employees...</h3>
              <p className="text-slate-600">Please wait while we process your data</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// DuplicateComparison Component
const DuplicateComparison = ({ duplicate, index, userDecision, onDecisionChange }) => {
  const { existing_employee, import_data, differences, match_percentage } = duplicate

  return (
    <div className="border border-slate-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-lg font-semibold text-slate-900">
          Potential Duplicate #{index}
        </h4>
        <div className={`px-3 py-1 rounded-full text-sm font-medium ${
          match_percentage >= 90 ? 'bg-red-100 text-red-800' :
          match_percentage >= 70 ? 'bg-amber-100 text-amber-800' :
          'bg-yellow-100 text-yellow-800'
        }`}>
          {match_percentage}% Match
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Existing Employee */}
        <div className="bg-slate-50 rounded-lg p-4">
          <h5 className="font-medium text-slate-900 mb-3 flex items-center">
            <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
            Existing Employee ({existing_employee.employee_id})
          </h5>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-600">Name:</span>
              <span className="font-medium">{existing_employee.first_name} {existing_employee.last_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Email:</span>
              <span className="font-medium">{existing_employee.email}</span>
            </div>
            {differences.map((diff, idx) => (
              <div key={idx} className="flex justify-between">
                <span className="text-slate-600">{diff.field_display}:</span>
                <span className="font-medium bg-yellow-100 px-2 py-1 rounded text-yellow-800">
                  {diff.existing_value || 'N/A'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Import Data */}
        <div className="bg-slate-50 rounded-lg p-4">
          <h5 className="font-medium text-slate-900 mb-3 flex items-center">
            <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
            Import Data
          </h5>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-600">Name:</span>
              <span className="font-medium">{import_data.first_name} {import_data.last_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Email:</span>
              <span className="font-medium">{import_data.email}</span>
            </div>
            {differences.map((diff, idx) => (
              <div key={idx} className="flex justify-between">
                <span className="text-slate-600">{diff.field_display}:</span>
                <span className="font-medium bg-yellow-100 px-2 py-1 rounded text-yellow-800">
                  {diff.import_value || 'N/A'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => onDecisionChange('update')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              userDecision === 'update'
                ? 'bg-blue-600 text-white'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
            }`}
          >
            Update Existing
          </button>
          <button
            type="button"
            onClick={() => onDecisionChange('skip')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              userDecision === 'skip'
                ? 'bg-slate-600 text-white'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
          >
            Skip Import
          </button>
          <button
            type="button"
            onClick={() => onDecisionChange('create_separate')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              userDecision === 'create_separate'
                ? 'bg-green-600 text-white'
                : 'bg-green-50 text-green-700 hover:bg-green-100'
            }`}
          >
            Create Separate
          </button>
        </div>
        {userDecision && (
          <div className="flex items-center text-sm text-slate-600">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
            </svg>
            Decision: <span className="font-medium ml-1 capitalize">{userDecision.replace('_', ' ')}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default BulkImport