import { useState } from 'react'
import * as XLSX from 'xlsx'
import { useAuth } from '../context/AuthContext.jsx'
import { usePermissions } from '../context/PermissionContext.jsx'
import { getCookie } from '../utils/helpers.js'
import { TOKEN, getApiBaseUrl } from '../utils/constants.js'

const SkillsBulkImport = ({ onClose, onImportComplete }) => {
  const { hasPermission } = usePermissions()
  const [dragActive, setDragActive] = useState(false)
  const [file, setFile] = useState(null)
  const [errors, setErrors] = useState([])
  const [loading, setLoading] = useState(false)
  const [currentStep, setCurrentStep] = useState('upload') // 'upload', 'analyzing', 'analysis', 'importing', 'complete'
  const [importResult, setImportResult] = useState(null)
  const [analysisResult, setAnalysisResult] = useState(null)
  
  const { isAuthenticated } = useAuth()

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
      if (!isAuthenticated()) {
        setErrors(['You must be logged in to analyze files'])
        setCurrentStep('upload')
        setLoading(false)
        return
      }
      
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
      const response = await fetch(`${getApiBaseUrl()}/api/skills/bulk-import?analyze=true`, {
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
        // Handle validation errors - details can be array or single error message
        const errorList = result.details || (result.error ? [result.error] : ['Failed to analyze file'])
        setErrors(Array.isArray(errorList) ? errorList : [errorList])
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
      handleImport(file)
    }
  }

  const handleImport = async (file) => {
    setLoading(true)
    
    try {
      if (!hasPermission('matrix-import')) {
        setErrors(['You do not have permission to import skills'])
        setLoading(false)
        return
      }
      
      if (!isAuthenticated()) {
        setErrors(['You must be logged in to import skills'])
        setCurrentStep('upload')
        setLoading(false)
        return
      }
      
      const token = getCookie(TOKEN)
      if (!token) {
        setErrors(['Authentication token not found. Please log in again.'])
        setCurrentStep('upload')
        setLoading(false)
        return
      }
      
      const formData = new FormData()
      formData.append('file', file)
      
      const response = await fetch(`${getApiBaseUrl()}/api/skills/bulk-import`, {
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
        if (onImportComplete) {
          onImportComplete(result)
        }
      } else {
        // Handle validation errors - details can be array or single error message
        const errorList = result.details || (result.error ? [result.error] : ['Unknown error occurred'])
        setErrors(Array.isArray(errorList) ? errorList : [errorList])
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
    setCurrentStep('upload')
  }

  const downloadTemplate = () => {
    // Create a sample Excel template for Skills Import
    const templateData = [
      ['Employee ID', 'First Name', 'Last Name', 'Skills Name', 'Category', 'Parent Skill', 'Proficiency Level', 'Certified', 'Start Date', 'Expiry Date', 'Last Assessed'],
      ['EMP001', 'John', 'Doe', 'Python Programming', 'HardSkill', 'Programming Languages', 'Expert', 'Yes', new Date('2024-01-15'), new Date('2027-01-15'), new Date('2024-06-15')],
      ['EMP002', 'Jane', 'Smith', 'Project Management', 'SoftSkill', 'Leadership', 'Advance', 'Yes', new Date('2024-03-01'), new Date('2027-03-01'), new Date('2024-08-01')],
      ['EMP003', 'Bob', 'Johnson', 'React.js', 'HardSkill', 'Frontend Development', 'Intermediate', 'No', new Date('2024-02-10'), null, new Date('2024-05-10')]
    ]

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(templateData)

    // Set column widths (wider for date columns to prevent ### display)
    ws['!cols'] = [
      { wch: 12 }, // Employee ID
      { wch: 12 }, // First Name
      { wch: 12 }, // Last Name
      { wch: 20 }, // Skills Name
      { wch: 12 }, // Category
      { wch: 20 }, // Parent Skill
      { wch: 16 }, // Proficiency Level
      { wch: 10 }, // Certified
      { wch: 15 }, // Start Date (wider for date display)
      { wch: 15 }, // Expiry Date (wider for date display)
      { wch: 15 }  // Last Assessed (wider for date display)
    ]

    // Format date columns (columns I, J, K are 0-indexed, so 8, 9, 10)
    const dateColumns = [8, 9, 10] // Start Date, Expiry Date, Last Assessed
    // Excel date format code 14 = mm/dd/yyyy
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
    XLSX.utils.book_append_sheet(wb, ws, 'Skills Template')

    // Write file and trigger download
    XLSX.writeFile(wb, 'Skills_Import_Template.xlsx')
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-2xl font-semibold text-slate-900">Bulk Import Employee Skills</h2>
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
                    <span className="font-medium">Skills Name</span>
                    <span className="text-green-600">(Required)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    <span className="font-medium">Category</span>
                    <span className="text-green-600">(Required)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    <span className="font-medium">Parent Skill</span>
                    <span className="text-green-600">(Required)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    <span className="font-medium">Proficiency Level</span>
                    <span className="text-green-600">(Required)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    <span className="font-medium">Certified</span>
                    <span className="text-slate-500">(Optional)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    <span className="font-medium">Start Date</span>
                    <span className="text-slate-500">(Optional)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    <span className="font-medium">Expiry Date</span>
                    <span className="text-slate-500">(Optional)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    <span className="font-medium">Last Assessed</span>
                    <span className="text-slate-500">(Optional)</span>
                  </div>
                </div>
                <div className="mt-3 p-3 bg-green-100 rounded text-sm text-green-800">
                  <strong>Note:</strong> Category should be HardSkill or SoftSkill. Proficiency Level should be one of: Beginner, Intermediate, Advance, Expert. Certified should be Yes or No. Date format should be YYYY-MM-DD.
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
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-600 mx-auto mb-4"></div>
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
                    {analysisResult.total_rows || 0} total rows processed
                  </div>
                </div>
                
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                        <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-green-900">{analysisResult.new_skills || 0}</div>
                        <div className="text-sm text-green-700">New Skills</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
                        </svg>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-blue-900">{analysisResult.assignments || 0}</div>
                        <div className="text-sm text-blue-700">Skill Assignments</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center mr-3">
                        <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"/>
                        </svg>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-amber-900">{analysisResult.warnings?.length || 0}</div>
                        <div className="text-sm text-amber-700">Warnings</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Preview Data */}
              {analysisResult.preview_data && analysisResult.preview_data.length > 0 && (
                <div className="mb-6">
                  <h4 className="font-medium text-slate-900 mb-3">
                    Preview Data ({analysisResult.preview_data.length} rows)
                  </h4>
                  <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-96 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-slate-700">Employee ID</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-700">Name</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-700">Skill</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-700">Category</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-700">Parent Skill</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-700">Proficiency</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-700">Certified</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-700">Last Assessed</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {analysisResult.preview_data.map((row, index) => (
                          <tr key={index} className="hover:bg-slate-50">
                            <td className="px-3 py-2">{row.employee_id || 'N/A'}</td>
                            <td className="px-3 py-2">{row.first_name} {row.last_name}</td>
                            <td className="px-3 py-2">{row.skill_name || 'N/A'}</td>
                            <td className="px-3 py-2">{row.category || 'N/A'}</td>
                            <td className="px-3 py-2">{row.parent_skill || '-'}</td>
                            <td className="px-3 py-2">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                row.proficiency_level === 'Expert' ? 'bg-green-100 text-green-800' :
                                row.proficiency_level === 'Advanced' || row.proficiency_level === 'Advance' ? 'bg-blue-100 text-blue-800' :
                                row.proficiency_level === 'Intermediate' ? 'bg-green-100 text-green-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {row.proficiency_level || 'N/A'}
                              </span>
                            </td>
                            <td className="px-3 py-2">{row.certified ? 'Yes' : 'No'}</td>
                            <td className="px-3 py-2">{row.last_assessed || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Warnings */}
              {analysisResult.warnings && analysisResult.warnings.length > 0 && (
                <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <h4 className="font-medium text-amber-800 mb-2">Warnings</h4>
                  <ul className="text-sm text-amber-700 space-y-1 max-h-32 overflow-y-auto">
                    {analysisResult.warnings.map((warning, index) => (
                      <li key={index}>• {warning}</li>
                    ))}
                  </ul>
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
                {importResult.skills_created && (
                  <p><strong>{importResult.skills_created}</strong> skills added to management</p>
                )}
                {importResult.assignments_created && (
                  <p><strong>{importResult.assignments_created}</strong> skill assignments created</p>
                )}
                {importResult.total_processed && (
                  <p><strong>{importResult.total_processed}</strong> total rows processed</p>
                )}
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
                    if (onImportComplete) {
                      onImportComplete(importResult)
                    }
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
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Importing Skills...</h3>
              <p className="text-slate-600">Please wait while we process your data</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default SkillsBulkImport

