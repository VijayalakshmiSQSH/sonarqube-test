import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { useAuth } from '../context/AuthContext.jsx'
import { usePermissions } from '../context/PermissionContext.jsx'
import { getCookie } from '../utils/helpers.js'
import { TOKEN, getApiBaseUrl } from '../utils/constants.js'

const KRAImport = ({ isOpen, onClose, onImportComplete }) => {
  const { hasPermission } = usePermissions()
  const [dragActive, setDragActive] = useState(false)
  const [file, setFile] = useState(null)
  const [errors, setErrors] = useState([])
  const [loading, setLoading] = useState(false)
  const [currentStep, setCurrentStep] = useState('upload') // 'upload', 'analyzing', 'analysis', 'importing', 'complete'
  const [importResult, setImportResult] = useState(null)
  const [analysisResult, setAnalysisResult] = useState(null)
  const [userDecisions, setUserDecisions] = useState({}) // Store user decisions for duplicates
  const [existingKRAs, setExistingKRAs] = useState([]) // Store existing KRAs for duplicate detection
  const [importCounts, setImportCounts] = useState({ totalCount: 0, invalidCount: 0, readyCount: 0, skippedCount: 0 }) // Import counts for display
  const [analysisComplete, setAnalysisComplete] = useState(false) // Track if backend analysis is complete
  
  const { isAuthenticated } = useAuth()

  const resetImport = () => {
    setFile(null)
    setErrors([])
    setCurrentStep('upload')
    setAnalysisResult(null)
    setImportResult(null)
    setUserDecisions({})
    setExistingKRAs([])
    setImportCounts({ totalCount: 0, invalidCount: 0, readyCount: 0, skippedCount: 0 })
    setAnalysisComplete(false)
  }

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      resetImport()
    }
  }, [isOpen])

  // Recalculate counts when user decisions change
  useEffect(() => {
    if (!analysisResult || importCounts.totalCount === 0) return

    // Count skipped items
    let skippedCount = 0
    // Count potential duplicates without decisions (pending decisions - not ready for import)
    let pendingDecisionsCount = 0

    // Count perfect matches that are explicitly skipped
    if (analysisResult.perfect_matches) {
      skippedCount += analysisResult.perfect_matches.filter(match => 
        userDecisions[match.key] === 'skip'
      ).length
    }

    // Count potential duplicates that are explicitly skipped
    if (analysisResult.potential_duplicates) {
      skippedCount += analysisResult.potential_duplicates.filter(dup => 
        userDecisions[dup.key] === 'skip'
      ).length
      
      // Count potential duplicates without decisions (they need decisions before import)
      pendingDecisionsCount = analysisResult.potential_duplicates.filter(dup => 
        !userDecisions[dup.key]
      ).length
    }

    // Recalculate ready count: Total - Invalid - Skipped - Pending Decisions
    setImportCounts(prev => {
      const readyCount = Math.max(0, prev.totalCount - prev.invalidCount - skippedCount - pendingDecisionsCount)
      return {
        ...prev,
        skippedCount,
        readyCount
      }
    })
  }, [userDecisions, analysisResult, importCounts.totalCount, importCounts.invalidCount])

  // Don't render if not open
  if (!isOpen) return null

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

  const handleFileSelection = async (selectedFile) => {
    const fileType = selectedFile.name.split('.').pop().toLowerCase()
    
    if (!['xlsx', 'xls'].includes(fileType)) {
      setErrors(['Please select an Excel file (.xlsx or .xls)'])
      return
    }
    
    setFile(selectedFile)
    setErrors([])
    setCurrentStep('analyzing')
    
    // Parse file immediately and calculate counts
    try {
      const parseResult = await parseAndCountRows(selectedFile)
      setImportCounts(parseResult.counts)
    } catch (error) {
      console.error('Error parsing file for counts:', error)
      // Continue with analysis even if count calculation fails
    }
    
    // Continue with full analysis
    analyzeFile(selectedFile)
  }

  // Fetch existing KRAs for duplicate detection
  const fetchExistingKRAs = async () => {
    try {
      const token = getCookie(TOKEN)
      if (!token) return []

      const response = await fetch(`${getApiBaseUrl()}/api/kras`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        return data.kras || data || []
      }
      return []
    } catch (error) {
      console.error('Error fetching existing KRAs:', error)
      return []
    }
  }

  // Compare KRA data to detect duplicates
  const compareKRAData = (existingKRA, importData) => {
    const differences = []
    
    // Normalize strings for comparison
    const normalize = (str) => (str || '').toString().trim().toLowerCase()
    
    // Compare key fields
    if (normalize(existingKRA.kra_title) !== normalize(importData.kra_title)) {
      differences.push({
        field: 'kra_title',
        field_display: 'KRA Title',
        existing_value: existingKRA.kra_title || 'N/A',
        import_value: importData.kra_title || 'N/A'
      })
    }
    
    if (normalize(existingKRA.department) !== normalize(importData.department_name)) {
      differences.push({
        field: 'department',
        field_display: 'Department',
        existing_value: existingKRA.department || 'N/A',
        import_value: importData.department_name || 'N/A'
      })
    }
    
    if (normalize(existingKRA.role) !== normalize(importData.role)) {
      differences.push({
        field: 'role',
        field_display: 'Role',
        existing_value: existingKRA.role || 'N/A',
        import_value: importData.role || 'N/A'
      })
    }
    
    if (normalize(existingKRA.impact) !== normalize(importData.impact)) {
      differences.push({
        field: 'impact',
        field_display: 'Impact',
        existing_value: existingKRA.impact || 'N/A',
        import_value: importData.impact || 'N/A'
      })
    }
    
    const existingDesc = existingKRA.details?.description || existingKRA.description || ''
    const importDesc = importData.description || ''
    if (normalize(existingDesc) !== normalize(importDesc)) {
      differences.push({
        field: 'description',
        field_display: 'Description',
        existing_value: existingDesc || 'N/A',
        import_value: importDesc || 'N/A'
      })
    }
    
    return differences
  }

  // Calculate match percentage
  const calculateMatchPercentage = (existingKRA, importData) => {
    const totalFields = 5 // kra_title, department, role, impact, description
    const differences = compareKRAData(existingKRA, importData)
    const matchingFields = totalFields - differences.length
    return Math.round((matchingFields / totalFields) * 100)
  }

  // Analyze KRAs for duplicates
  const analyzeKRAsForDuplicates = async (processedData) => {
    const existing = await fetchExistingKRAs()
    setExistingKRAs(existing)
    
    const newKRAs = []
    const potentialDuplicates = []
    const perfectMatches = []
    
    // Create a map of existing KRAs by key (kra_title + department + role)
    const existingKRAMap = {}
    existing.forEach(kra => {
      const key = `${(kra.kra_title || '').toLowerCase().trim()}_${(kra.department || '').toLowerCase().trim()}_${(kra.role || '').toLowerCase().trim()}`
      existingKRAMap[key] = kra
    })
    
    // Process each import row
    processedData.forEach((importData, index) => {
      const key = `${(importData.kra_title || '').toLowerCase().trim()}_${(importData.department_name || '').toLowerCase().trim()}_${(importData.role || '').toLowerCase().trim()}`
      const existingKRA = existingKRAMap[key]
      
      if (existingKRA) {
        // KRA exists - compare fields
        const differences = compareKRAData(existingKRA, importData)
        const matchPercentage = calculateMatchPercentage(existingKRA, importData)
        
        if (differences.length > 0) {
          // Has differences - potential duplicate
          potentialDuplicates.push({
            existing_kra: existingKRA,
            import_data: importData,
            differences: differences,
            match_percentage: matchPercentage,
            key: `row_${index}_${key}`
          })
        } else {
          // Perfect match
          perfectMatches.push({
            kra: existingKRA,
            key: `row_${index}_${key}`
          })
        }
      } else {
        // New KRA
        newKRAs.push({
          kra_data: importData,
          key: `row_${index}_${key}`
        })
      }
    })
    
    return {
      new_kras: newKRAs,
      potential_duplicates: potentialDuplicates,
      perfect_matches: perfectMatches,
      total_processed: processedData.length,
      new_count: newKRAs.length,
      duplicate_count: potentialDuplicates.length,
      perfect_match_count: perfectMatches.length
    }
  }

  // Validate a row of KRA data (client-side validation matching backend logic)
  const validateKRARow = (kraData, rowIndex) => {
    const validationErrors = []
    
    // Required fields validation
    if (!kraData.kra_title || !kraData.kra_title.trim()) {
      validationErrors.push(`Row ${rowIndex + 1}: KRA Title is required`)
    }
    if (!kraData.department_name || !kraData.department_name.trim()) {
      validationErrors.push(`Row ${rowIndex + 1}: Department is required`)
    }
    if (!kraData.role || !kraData.role.trim()) {
      validationErrors.push(`Row ${rowIndex + 1}: Role is required`)
    }
    if (!kraData.description || !kraData.description.trim()) {
      validationErrors.push(`Row ${rowIndex + 1}: Description is required`)
    }
    
    // Impact validation (should be Low, Medium, or High)
    if (kraData.impact && !['Low', 'Medium', 'High'].includes(kraData.impact)) {
      validationErrors.push(`Row ${rowIndex + 1}: Impact must be one of: Low, Medium, High`)
    }
    
    // Year validation (if provided, should be a valid year)
    if (kraData.year && kraData.year.trim()) {
      const yearNum = parseInt(kraData.year)
      if (isNaN(yearNum) || yearNum < 1900 || yearNum > 2100) {
        validationErrors.push(`Row ${rowIndex + 1}: Year must be a valid 4-digit year`)
      }
    }
    
    return validationErrors
  }

  // Parse Excel file and calculate counts immediately
  const parseAndCountRows = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result)
          const workbook = XLSX.read(data, { type: 'array' })
          const firstSheetName = workbook.SheetNames[0]
          const worksheet = workbook.Sheets[firstSheetName]
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
          
          if (jsonData.length < 2) {
            reject(new Error('Excel file must have at least a header row and one data row'))
            return
          }
          
          // Get headers (first row)
          const headers = jsonData[0].map(h => String(h || '').trim())
          
          // Process all data rows (including invalid ones for counting)
          const allRows = []
          const processedData = []
          let totalCount = 0
          let invalidCount = 0
          
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i]
            if (!row || row.every(cell => !cell)) continue // Skip empty rows
            
            totalCount++
            
            const rowData = {}
            headers.forEach((header, index) => {
              rowData[header] = row[index] || ''
            })
            
            // Map to expected format
            const kraData = {
              kra_title: String(rowData['KRA Title'] || '').trim(),
              department_name: String(rowData['Department'] || '').trim(),
              role: String(rowData['Role'] || '').trim(),
              year: rowData['Year'] ? String(rowData['Year']).trim() : '',
              description: String(rowData['Description'] || '').trim(),
              impact: String(rowData['Impact'] || 'Low').trim() || 'Low',
              expectations: rowData['Expectations'] ? String(rowData['Expectations']).split(';').map(e => e.trim()).filter(e => e) : []
            }
            
            // Validate the row
            const validationErrors = validateKRARow(kraData, i - 1)
            
            if (validationErrors.length > 0) {
              invalidCount++
            } else {
              // Only add valid rows to processedData
              processedData.push(kraData)
            }
            
            allRows.push({ kraData, validationErrors, rowIndex: i - 1 })
          }
          
          const readyCount = totalCount - invalidCount
          
          resolve({
            processedData,
            allRows,
            counts: { totalCount, invalidCount, readyCount, skippedCount: 0 }
          })
        } catch (error) {
          reject(error)
        }
      }
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsArrayBuffer(file)
    })
  }

  // Parse Excel file client-side to get data for duplicate detection
  const parseExcelFile = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result)
          const workbook = XLSX.read(data, { type: 'array' })
          const firstSheetName = workbook.SheetNames[0]
          const worksheet = workbook.Sheets[firstSheetName]
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
          
          if (jsonData.length < 2) {
            reject(new Error('Excel file must have at least a header row and one data row'))
            return
          }
          
          // Get headers (first row)
          const headers = jsonData[0].map(h => String(h || '').trim())
          
          // Process data rows
          const processedData = []
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i]
            if (!row || row.every(cell => !cell)) continue // Skip empty rows
            
            const rowData = {}
            headers.forEach((header, index) => {
              rowData[header] = row[index] || ''
            })
            
            // Map to expected format
            const kraData = {
              kra_title: String(rowData['KRA Title'] || '').trim(),
              department_name: String(rowData['Department'] || '').trim(),
              role: String(rowData['Role'] || '').trim(),
              year: rowData['Year'] ? String(rowData['Year']).trim() : '',
              description: String(rowData['Description'] || '').trim(),
              impact: String(rowData['Impact'] || 'Low').trim() || 'Low',
              expectations: rowData['Expectations'] ? String(rowData['Expectations']).split(';').map(e => e.trim()).filter(e => e) : []
            }
            
            // Only add if has required fields
            if (kraData.kra_title && kraData.department_name && kraData.role && kraData.description) {
              processedData.push(kraData)
            }
          }
          
          resolve(processedData)
        } catch (error) {
          reject(error)
        }
      }
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsArrayBuffer(file)
    })
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
      
      // Parse file client-side for duplicate detection
      const processedData = await parseExcelFile(file)
      
      // Call backend analysis for validation
      const formData = new FormData()
      formData.append('file', file)
      
      const response = await fetch(`${getApiBaseUrl()}/api/kras/import?analyze=true`, {
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
        // Perform duplicate detection on processed data
        const duplicateAnalysis = await analyzeKRAsForDuplicates(processedData)
        
        // Count unique rows with backend validation errors
        // Backend errors are like "Row 11: Department 'HR Team' not found"
        // Extract unique row numbers from error messages to avoid double-counting
        let backendInvalidCount = 0
        if (result.errors && result.errors.length > 0) {
          const uniqueRows = new Set()
          result.errors.forEach(error => {
            // Extract row number from error message (format: "Row X: ...")
            const rowMatch = error.match(/Row\s+(\d+):/i)
            if (rowMatch) {
              uniqueRows.add(parseInt(rowMatch[1]))
            } else {
              // If error doesn't have row number, count it as one error
              // (assuming backend provides one error per row in this case)
              uniqueRows.add(`error_${uniqueRows.size}`)
            }
          })
          backendInvalidCount = uniqueRows.size
        }
        
        const backendTotalCount = result.total_processed || importCounts.totalCount || processedData.length
        
        // Update counts - combine client-side invalid count with backend validation errors
        // Ready count should only include rows that will actually be imported
        setImportCounts(prev => {
          // Total invalid = client-side invalid + backend validation errors (unique rows)
          const totalInvalidCount = prev.invalidCount + backendInvalidCount
          // Ready count = Total - All Invalid (client-side + backend) - Skipped
          const readyCount = Math.max(0, backendTotalCount - totalInvalidCount - (prev.skippedCount || 0))
          return {
            totalCount: backendTotalCount,
            invalidCount: totalInvalidCount, // Client-side + backend validation errors
            readyCount: readyCount,
            skippedCount: prev.skippedCount || 0
          }
        })
        
        // Merge backend analysis with duplicate detection
        setAnalysisResult({
          ...result,
          ...duplicateAnalysis,
          valid_count: result.valid_count || duplicateAnalysis.total_processed,
          processed_data: processedData // Store for import
        })
        setAnalysisComplete(true) // Mark analysis as complete to show ready and invalid counts
        setCurrentStep('analysis')
      } else {
        setErrors([result.error || `Server error: ${response.status}`])
        setCurrentStep('upload')
      }
    } catch (error) {
      console.error('Analysis error:', error)
      setErrors([error.message || 'Failed to analyze file'])
      setCurrentStep('upload')
    } finally {
      setLoading(false)
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
                        category === 'new_kras' ? 'new KRAs' : 'perfect matches'
    console.log(`Applied "${action}" to all ${analysisResult[category].length} ${categoryName}`)
  }

  const handleConfirmImport = () => {
    if (file) {
      setCurrentStep('importing')
      handleImport(file, userDecisions)
    }
  }

  const handleImport = async (file, decisions = {}) => {
    if (!file) return
    
    setLoading(true)
    
    try {
      const token = getCookie(TOKEN)
      if (!token) {
        setErrors(['Authentication token not found. Please log in again.'])
        setCurrentStep('analysis')
        setLoading(false)
        return
      }
      
      const formData = new FormData()
      formData.append('file', file)
      formData.append('decisions', JSON.stringify(decisions))
      
      const response = await fetch(`${getApiBaseUrl()}/api/kras/import`, {
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
        setErrors([result.error || 'Import failed'])
        setCurrentStep('analysis')
      }
    } catch (error) {
      console.error('Import error:', error)
      setErrors([error.message || 'Failed to import KRAs'])
      setCurrentStep('analysis')
    } finally {
      setLoading(false)
    }
  }

  const downloadTemplate = () => {
    // Create a sample Excel template
    const templateData = [
      ['KRA Title', 'Department', 'Role', 'Year', 'Impact', 'Description', 'Expectations'],
      ['Improve Sales Performance', 'Sales', 'Manager', '2024', 'High', 'Increase quarterly sales by 20%', 'Achieve 20% growth; Maintain customer satisfaction >90%; Reduce churn rate'],
      ['Enhance Team Skills', 'HR', 'Director', '2024', 'Medium', 'Develop team capabilities through training', 'Conduct monthly training; Implement mentorship program; Track skill development'],
      ['Optimize Operations', 'Operations', 'Analyst', '2024', 'Low', 'Streamline operational processes', 'Reduce processing time by 15%; Implement automation; Improve efficiency metrics']
    ]

    // Convert to CSV format with proper escaping
    const csvContent = templateData.map(row => 
      row.map(cell => {
        // Escape quotes and wrap in quotes if contains comma, quote, or newline
        const escaped = cell.replace(/"/g, '""')
        return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped
      }).join(',')
    ).join('\n')

    // Add BOM for proper UTF-8 encoding
    const BOM = '\uFEFF'
    const csvWithBOM = BOM + csvContent

    // Create and download file
    const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', 'KRA_Import_Template.csv')
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    // Clean up the URL object
    setTimeout(() => URL.revokeObjectURL(url), 100)
  }

  if (!hasPermission('kra-add')) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
          <div className="p-6 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z"/>
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Access Denied</h3>
            <p className="text-slate-600 mb-6">You don't have permission to import KRAs.</p>
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onClose()
              }}
              className="px-4 py-2 bg-slate-200 text-slate-800 rounded-lg hover:bg-slate-300 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          console.log('Backdrop clicked')
          onClose()
        }
      }}
    >
      <div 
        className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex-1">
            <div className="flex items-center gap-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Import KRAs</h3>
                <p className="text-slate-600 mt-1">Upload an Excel file to import KRAs</p>
              </div>
              {/* Import Counts Badges - Show when file is selected */}
              {file && importCounts.totalCount > 0 && (
                <div className="flex items-center gap-2 ml-4">
                  <span className="text-sm font-medium text-slate-600">Total:</span>
                  <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-sm font-semibold">
                    {importCounts.totalCount}
                  </span>
                  {/* Show Ready and Invalid counts only after backend analysis is complete */}
                  {analysisComplete && (
                    <>
                      <span className="text-slate-400 mx-1">•</span>
                      <span className="text-sm font-medium text-slate-600">Ready:</span>
                      <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
                        {importCounts.readyCount}
                      </span>
                      <span className="text-slate-400 mx-1">•</span>
                      <span className="text-sm font-medium text-slate-600">Invalid:</span>
                      <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-sm font-semibold">
                        {importCounts.invalidCount}
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              console.log('Close button clicked')
              onClose()
            }}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1"
            title="Close import modal"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
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
                    <span className="font-medium">KRA Title</span>
                    <span className="text-green-600">(Required)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    <span className="font-medium">Department</span>
                    <span className="text-green-600">(Required)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    <span className="font-medium">Role</span>
                    <span className="text-green-600">(Required)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    <span className="font-medium">Year</span>
                    <span className="text-slate-500">(Optional)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    <span className="font-medium">Impact</span>
                    <span className="text-slate-500">(Optional)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    <span className="font-medium">Description</span>
                    <span className="text-green-600">(Required)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    <span className="font-medium">Expectations</span>
                    <span className="text-slate-500">(Optional)</span>
                  </div>
                </div>
                <div className="mt-3 p-3 bg-green-100 rounded text-sm text-green-800">
                  <strong>Note:</strong> Impact should be one of: Low, Medium, High. Year should be a 4-digit year (e.g., 2024). Expectations can be separated by semicolons (;).
                </div>
              </div>

              {/* File Upload Area */}
              <div
                className={`border-2 border-dashed rounded-xl p-12 text-center transition-all ${
                  dragActive
                    ? 'border-green-400 bg-green-50'
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

              {/* Errors */}
              {errors.length > 0 && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center mb-2">
                    <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <h4 className="font-semibold text-red-800">Error</h4>
                  </div>
                  <ul className="text-red-700 text-sm space-y-1">
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
              <div className="w-16 h-16 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mx-auto mb-4"></div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Analyzing File</h3>
              <p className="text-slate-600">Please wait while we analyze your Excel file...</p>
            </div>
          )}

          {currentStep === 'analysis' && analysisResult && (
            <div className="py-6">
              {/* Analysis Summary */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-slate-900">Import Analysis</h3>
                  <div className="text-sm text-slate-500">
                    {analysisResult.total_processed || analysisResult.valid_count || 0} total rows processed
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
                          <div className="text-sm text-green-700">New KRAs</div>
                        </div>
                      </div>
                      {analysisResult.new_count > 0 && (
                        <button
                          type="button"
                          onClick={() => handleBulkAction('new_kras', 'create')}
                          className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition-colors"
                          title="Accept all new KRAs"
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
                  
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                          </svg>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-green-900">{analysisResult.perfect_match_count || 0}</div>
                          <div className="text-sm text-green-700">Perfect Matches</div>
                        </div>
                      </div>
                      {analysisResult.perfect_match_count > 0 && (
                        <button
                          type="button"
                          onClick={() => handleBulkAction('perfect_matches', 'skip')}
                          className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition-colors"
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
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z"/>
                        </svg>
                        <h4 className="font-medium text-amber-800">
                          {analysisResult.potential_duplicates.length} potential duplicates require decisions
                        </h4>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => handleBulkAction('potential_duplicates', 'update')}
                          className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition-colors"
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
                      <KRADuplicateComparison
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

              {/* Errors Section */}
              {analysisResult.errors && analysisResult.errors.length > 0 && (
                <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center mb-2">
                    <svg className="w-5 h-5 text-yellow-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z"/>
                    </svg>
                    <span className="font-semibold text-yellow-800">Validation Issues</span>
                  </div>
                  <ul className="text-yellow-700 text-sm space-y-1 max-h-32 overflow-y-auto">
                    {analysisResult.errors.map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Decision Summary */}
              {Object.keys(userDecisions).length > 0 && (
                <div className="mb-6 bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <h4 className="font-medium text-slate-900 mb-3">Import Decisions Summary</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-slate-600">New KRAs:</span>
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
                  onClick={() => {
                    setCurrentStep('upload')
                    // Reset counts, file, and analysis state when canceling
                    setFile(null)
                    setImportCounts({ totalCount: 0, invalidCount: 0, readyCount: 0, skippedCount: 0 })
                    setAnalysisComplete(false)
                    setAnalysisResult(null)
                    setUserDecisions({})
                    setErrors([])
                  }}
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

          {currentStep === 'importing' && (
            <div className="text-center py-12">
              <div className="w-16 h-16 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mx-auto mb-4"></div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Importing KRAs</h3>
              <p className="text-slate-600">Please wait while we import your KRAs...</p>
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
                <p><strong>{importResult.imported_count || 0}</strong> KRAs imported</p>
                {importResult.skipped_count > 0 && (
                  <p><strong>{importResult.skipped_count}</strong> KRAs skipped (already exist)</p>
                )}
                <p><strong>{importResult.total_processed || importResult.imported_count || 0}</strong> total rows processed</p>
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
                  onClick={resetImport}
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
        </div>
      </div>
    </div>
  )
}

// KRADuplicateComparison Component
const KRADuplicateComparison = ({ duplicate, index, userDecision, onDecisionChange }) => {
  const { existing_kra, import_data, differences, match_percentage } = duplicate

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
        {/* Existing KRA */}
        <div className="bg-slate-50 rounded-lg p-4">
          <h5 className="font-medium text-slate-900 mb-3 flex items-center">
            <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
            Existing KRA ({existing_kra.kra_title})
          </h5>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-600">KRA Title:</span>
              <span className="font-medium">{existing_kra.kra_title || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Department:</span>
              <span className="font-medium">{existing_kra.department || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Role:</span>
              <span className="font-medium">{existing_kra.role || 'N/A'}</span>
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
              <span className="text-slate-600">KRA Title:</span>
              <span className="font-medium">{import_data.kra_title || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Department:</span>
              <span className="font-medium">{import_data.department_name || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Role:</span>
              <span className="font-medium">{import_data.role || 'N/A'}</span>
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
                ? 'bg-green-600 text-white'
                : 'bg-green-50 text-green-700 hover:bg-green-100'
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

export default KRAImport
