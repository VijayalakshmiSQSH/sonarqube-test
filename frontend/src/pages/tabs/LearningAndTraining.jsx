import React, { useState, useEffect } from 'react'
import { usePermissions } from '../../context/PermissionContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { useEmployees } from '../../context/EmployeeContext.jsx'
import LoadingSpinner from '../../components/LoadingSpinner.jsx'
import { getApiBaseUrl, TOKEN } from '../../utils/constants.js'
import { getCookie } from '../../utils/helpers.js'
import { animationStyles, SearchableSelect } from './LearningManagementComponents.jsx'
import DateInput from '../../components/DateInput.jsx'
import DateHistoryTracker from '../../components/DateHistoryTracker.jsx'
import { parseDateToStorage, formatDateForDisplay, formatDateToMonthFormat } from '../../utils/dateUtils.js'

const LearningAndTraining = () => {
  const { hasPermission } = usePermissions()
  const { user } = useAuth()
  const { getAllEmployees } = useEmployees()
  const [loading, setLoading] = useState(false)
  const [programs, setPrograms] = useState([])
  const [selectedProgram, setSelectedProgram] = useState(null)
  const [participants, setParticipants] = useState([])
  const [employees, setEmployees] = useState([]) // For mapping employee IDs to names
  const [statusFilter, setStatusFilter] = useState('all') // 'all', 'completed', 'in-progress', 'not-started'
  // Only submodules can be edited - removed editingParticipant and editingModule
  const [editingSubmodule, setEditingSubmodule] = useState(null) // Format: "participantId-moduleIndex-submoduleIndex"
  const [expandedParticipants, setExpandedParticipants] = useState(new Set())
  const [expandedModules, setExpandedModules] = useState(new Set()) // Track expanded modules (format: "participantId-moduleIndex")
  const [moduleChanges, setModuleChanges] = useState({}) // Track module calculated values (format: "participantId-moduleIndex")
  const [submoduleChanges, setSubmoduleChanges] = useState({}) // Track changes count per submodule (format: "participantId-moduleIndex-submoduleIndex")
  const [dateChangeHistory, setDateChangeHistory] = useState({}) // Track date change history (format: "participantId": [{moduleName, submoduleName, field, oldValue, newValue, timestamp}, ...])
  const [savingSubmodule, setSavingSubmodule] = useState(null) // Track which submodule is currently being saved (format: "participantId-moduleIndex-submoduleIndex")
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [selectedParticipantForHistory, setSelectedParticipantForHistory] = useState(null)
  const [fetchedHistory, setFetchedHistory] = useState([]) // History fetched from API
  const [loadingHistory, setLoadingHistory] = useState(false) // Loading state for history

  // Fetch programs from API
  useEffect(() => {
    const fetchPrograms = async () => {
      try {
        setLoading(true)
        const token = getCookie(TOKEN)
        const response = await fetch(`${getApiBaseUrl()}/api/programs`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        
        if (response.ok) {
          const data = await response.json()
          const programsList = data.programs || []
          setPrograms(programsList)
          
          // Set first program as selected by default
          if (programsList.length > 0 && !selectedProgram) {
            setSelectedProgram(programsList[0])
          }
        } else {
          console.error('Failed to fetch programs:', response.statusText)
          setPrograms([])
        }
      } catch (error) {
        console.error('Error fetching programs:', error)
        setPrograms([])
      } finally {
        setLoading(false)
      }
    }
    
    fetchPrograms()
  }, [])

  // Fetch employees for mapping IDs to names
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const token = getCookie(TOKEN)
        const response = await fetch(`${getApiBaseUrl()}/api/employees`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        if (response.ok) {
          const data = await response.json()
          const employeesList = Array.isArray(data) ? data : (data.employees || [])
          setEmployees(employeesList)
        }
      } catch (error) {
        console.error('Error fetching employees:', error)
        setEmployees([])
      }
    }
    fetchEmployees()
  }, [])

  // Get current user's employee ID
  const getCurrentUserEmployeeId = () => {
    if (!user?.email) return null
    const employeesList = getAllEmployees()
    const currentUserEmployee = employeesList.find(emp => emp.email === user.email)
    return currentUserEmployee?.id || null
  }

  // Check if user can edit a specific participant's submodules
  const canEditParticipant = (participantEmployeeId) => {
    // If user has learning-and-training-edit permission, they can edit anyone
    if (hasPermission('learning-and-training-edit')) {
      return true
    }
    
    // If user has myprofile-edit permission, they can only edit their own profile
    if (hasPermission('myprofile-edit')) {
      const currentUserEmployeeId = getCurrentUserEmployeeId()
      return currentUserEmployeeId !== null && currentUserEmployeeId === participantEmployeeId
    }
    
    // Otherwise, cannot edit
    return false
  }

  // Helper function to get program date range from modules
  const getProgramDateRange = (program) => {
    if (!program || !program.modules || !Array.isArray(program.modules)) {
      return { startDate: null, endDate: null }
    }
    
    let earliestStart = null
    let latestEnd = null
    
    program.modules.forEach(module => {
      if (module.submodules && Array.isArray(module.submodules)) {
        module.submodules.forEach(submodule => {
          if (submodule.startDate) {
            // Parse date using dateUtils - it returns YYYY-MM-DD format
            const parsedStartDate = parseDateToStorage(submodule.startDate)
            if (parsedStartDate) {
              const startDate = new Date(parsedStartDate)
              if (!earliestStart || (startDate && startDate < earliestStart)) {
                earliestStart = startDate
              }
            }
          }
          if (submodule.endDate) {
            // Parse date using dateUtils - it returns YYYY-MM-DD format
            const parsedEndDate = parseDateToStorage(submodule.endDate)
            if (parsedEndDate) {
              const endDate = new Date(parsedEndDate)
              if (!latestEnd || (endDate && endDate > latestEnd)) {
                latestEnd = endDate
              }
            }
          }
        })
      }
    })
    
    // Return dates in YYYY-MM-DD format (storage format)
    return {
      startDate: earliestStart ? (earliestStart instanceof Date ? 
        `${earliestStart.getFullYear()}-${String(earliestStart.getMonth() + 1).padStart(2, '0')}-${String(earliestStart.getDate()).padStart(2, '0')}` 
        : earliestStart) : null,
      endDate: latestEnd ? (latestEnd instanceof Date ? 
        `${latestEnd.getFullYear()}-${String(latestEnd.getMonth() + 1).padStart(2, '0')}-${String(latestEnd.getDate()).padStart(2, '0')}` 
        : latestEnd) : null
    }
  }

  // Fetch participants when program is selected
  useEffect(() => {
    if (!selectedProgram) {
      setParticipants([])
      return
    }

    const fetchParticipants = async () => {
      try {
        setLoading(true)
        const programId = selectedProgram.program_id || selectedProgram.id
        const token = getCookie(TOKEN)
        const response = await fetch(`${getApiBaseUrl()}/api/programs/${programId}/participants`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        
        if (response.ok) {
          const data = await response.json()
          const participantsList = data.participants || []
          
          if (participantsList.length > 0) {
            // Transform API response to match frontend structure
            const mappedParticipants = participantsList.map(participant => {
              const participantKey = participant.id || `${programId}-${participant.employee_id}`
              
              // ONLY use module_data from employee_program_participation table - NO fallback to program data
              let modules = []
              if (participant.module_data && participant.module_data.length > 0) {
                // Use module_data from database (this contains employee-specific dates)
                modules = participant.module_data.map(module => ({
                  ...module,
                  name: module.module_name,
                  startDate: module.start_date, // Map from database format
                  endDate: module.end_date, // Map from database format
                  change_count: module.change_count || 0, // Preserve change_count from database
                  submodules: (module.submodules || []).map(sub => ({
                    ...sub,
                    name: sub.submodule_name,
                    startDate: sub.start_date, // Map from database format
                    endDate: sub.end_date, // Map from database format
                    progress: sub.progress || 0,
                    change_count: sub.change_count || 0 // Preserve change_count from database
                  }))
                }))
                console.log(`Participant ${participantKey} - Using module_data from employee_program_participation, modules:`, modules)
              } else {
                // If module_data is empty, show empty modules (don't fall back to program data)
                console.log(`Participant ${participantKey} - No module_data found in employee_program_participation, showing empty modules`)
                modules = []
              }
              
              // Use dates from module_data if available, otherwise from participant record
              let employeeStartDate = participant.start_date || ''
              let employeeEndDate = participant.end_date || ''
              
              // If module_data exists, calculate dates from modules
              if (modules && modules.length > 0) {
                const moduleStartDates = modules.map(m => m.startDate).filter(d => d)
                const moduleEndDates = modules.map(m => m.endDate).filter(d => d)
                if (moduleStartDates.length > 0) {
                  employeeStartDate = moduleStartDates.reduce((min, d) => d < min ? d : min, moduleStartDates[0])
                }
                if (moduleEndDates.length > 0) {
                  employeeEndDate = moduleEndDates.reduce((max, d) => d > max ? d : max, moduleEndDates[0])
                }
              }
              
              return {
                id: participantKey,
                employee_id: participant.employee_id,
                employee_name: participant.employee_name,
                employee_title: participant.employee_title,
                start_date: employeeStartDate,
                end_date: employeeEndDate,
                progress: participant.progress || 0,
                status: participant.status || 'Not Started',
                change_count: participant.total_change_count || 0,
                has_modules: modules && modules.length > 0,
                modules: modules
              }
            })
            
            setParticipants(mappedParticipants)
          } else {
            // API returned empty array - no participation records exist yet
            // Don't fall back to program data - only show data from employee_program_participation
            console.log('No participation records found in employee_program_participation table')
            setParticipants([])
          }
        } else {
          // API call failed - don't fall back to program data
          console.error('Failed to fetch participants from employee_program_participation table')
          setParticipants([])
        }
      } catch (error) {
        console.error('Error fetching participants:', error)
        setParticipants([])
      } finally {
        setLoading(false)
      }
    }
    
    fetchParticipants()
  }, [selectedProgram, employees.length])

  const toggleModules = (participantId) => {
    setExpandedParticipants(prev => {
      const newSet = new Set(prev)
      if (newSet.has(participantId)) {
        newSet.delete(participantId)
      } else {
        newSet.add(participantId)
      }
      return newSet
    })
  }

  const toggleModuleSubmodules = (participantId, moduleIndex) => {
    const moduleKey = `${participantId}-${moduleIndex}`
    setExpandedModules(prev => {
      const newSet = new Set(prev)
      if (newSet.has(moduleKey)) {
        newSet.delete(moduleKey)
      } else {
        newSet.add(moduleKey)
      }
      return newSet
    })
  }

  const handleEditSubmodule = (participantId, moduleIndex, submoduleIndex) => {
    setEditingSubmodule(`${participantId}-${moduleIndex}-${submoduleIndex}`)
  }

  const handleSaveSubmodule = async (participantId, moduleIndex, submoduleIndex) => {
    if (!selectedProgram) return
    
    const submoduleKey = `${participantId}-${moduleIndex}-${submoduleIndex}`
    const participant = participants.find(p => p.id === participantId)
    if (!participant || !participant.modules || !participant.modules[moduleIndex] || !participant.modules[moduleIndex].submodules) {
      setEditingSubmodule(null)
      return
    }
    
    const submodule = participant.modules[moduleIndex].submodules[submoduleIndex]
    const submoduleChangesData = submoduleChanges[submoduleKey]
    const module = participant.modules[moduleIndex]
    
    // Only increment change count if dates were actually changed from original values
    if (submoduleChangesData) {
      const originalStartDate = submoduleChangesData.original_startDate || submodule.startDate || ''
      const originalEndDate = submoduleChangesData.original_endDate || submodule.endDate || ''
      const finalStartDate = submoduleChangesData.startDate !== undefined 
        ? submoduleChangesData.startDate 
        : (submodule.startDate || '')
      const finalEndDate = submoduleChangesData.endDate !== undefined
        ? submoduleChangesData.endDate
        : (submodule.endDate || '')
      
      // Normalize dates for comparison
      const normalizedOriginalStart = originalStartDate && originalStartDate.match(/^\d{4}-\d{2}-\d{2}$/) 
        ? originalStartDate 
        : (originalStartDate ? parseDateToStorage(originalStartDate) : '')
      const normalizedFinalStart = finalStartDate && finalStartDate.match(/^\d{4}-\d{2}-\d{2}$/) 
        ? finalStartDate 
        : (finalStartDate ? parseDateToStorage(finalStartDate) : '')
      const normalizedOriginalEnd = originalEndDate && originalEndDate.match(/^\d{4}-\d{2}-\d{2}$/) 
        ? originalEndDate 
        : (originalEndDate ? parseDateToStorage(originalEndDate) : '')
      const normalizedFinalEnd = finalEndDate && finalEndDate.match(/^\d{4}-\d{2}-\d{2}$/) 
        ? finalEndDate 
        : (finalEndDate ? parseDateToStorage(finalEndDate) : '')
      
      // Get current change count (from database or existing changes)
      const currentChangeCount = submoduleChangesData.change_count !== undefined
        ? submoduleChangesData.change_count
        : (submodule.change_count || 0)
      
      let newChangeCount = currentChangeCount
      
      // Check if start date changed from original
      if (normalizedFinalStart && normalizedFinalStart.trim() !== '' && normalizedFinalStart !== normalizedOriginalStart) {
        newChangeCount = newChangeCount + 1
        
        // Record date change history only on save
        const historyEntry = {
          moduleName: module.name || `Module ${moduleIndex + 1}`,
          submoduleName: submodule.name || `Submodule ${submoduleIndex + 1}`,
          field: 'Start Date',
          oldValue: normalizedOriginalStart || originalStartDate || '',
          newValue: normalizedFinalStart,
          timestamp: new Date().toISOString()
        }
        
        setDateChangeHistory(prev => {
          const historyKey = participant.id || participantId
          const participantHistory = prev[historyKey] || []
          return {
            ...prev,
            [historyKey]: [...participantHistory, historyEntry]
          }
        })
      }
      
      // Check if end date changed from original
      if (normalizedFinalEnd && normalizedFinalEnd.trim() !== '' && normalizedFinalEnd !== normalizedOriginalEnd) {
        newChangeCount = newChangeCount + 1
        
        // Record date change history only on save
        const historyEntry = {
          moduleName: module.name || `Module ${moduleIndex + 1}`,
          submoduleName: submodule.name || `Submodule ${submoduleIndex + 1}`,
          field: 'End Date',
          oldValue: normalizedOriginalEnd || originalEndDate || '',
          newValue: normalizedFinalEnd,
          timestamp: new Date().toISOString()
        }
        
        setDateChangeHistory(prev => {
          const historyKey = participant.id || participantId
          const participantHistory = prev[historyKey] || []
          return {
            ...prev,
            [historyKey]: [...participantHistory, historyEntry]
          }
        })
      }
      
      // Update change count in submoduleChanges
      if (newChangeCount !== currentChangeCount) {
        setSubmoduleChanges(prevChanges => {
          const updatedChanges = { ...prevChanges }
          if (updatedChanges[submoduleKey]) {
            updatedChanges[submoduleKey] = {
              ...updatedChanges[submoduleKey],
              change_count: newChangeCount
            }
          }
          return updatedChanges
        })
      }
    }
    
    // Now save to backend immediately
    try {
      setSavingSubmodule(submoduleKey) // Set loading state for this specific submodule
      const programId = selectedProgram.program_id || selectedProgram.id
      const token = getCookie(TOKEN)
      
      // Collect changed submodules for this participant (only the one being saved)
      const changedSubmodules = []
      const recalculatedModules = []
      
      if (participant.modules) {
        participant.modules.forEach((mod, modIdx) => {
          const modKey = `${participant.id}-${modIdx}`
          const modChangesData = moduleChanges[modKey] || {}
          const modDates = getModuleDates(mod, participant.id, modIdx, submoduleChanges)
          const modProgress = getModuleProgress(mod, participant.id, modIdx, submoduleChanges)
          const modChangeCount = getModuleChangeCount(mod, participant.id, modIdx, submoduleChanges)
          
          // Add module to recalculated modules
          recalculatedModules.push({
            id: modKey,
            startDate: modChangesData.startDate !== undefined ? modChangesData.startDate : modDates.startDate,
            endDate: modChangesData.endDate !== undefined ? modChangesData.endDate : modDates.endDate,
            progress: modProgress,
            changesCount: modChangeCount
          })
          
          // Collect changed submodules for this module (only include the one being saved)
          if (mod.submodules) {
            const safeSubmoduleChanges = submoduleChanges || {}
            mod.submodules.forEach((sub, subIdx) => {
              const subKey = `${participant.id}-${modIdx}-${subIdx}`
              const subChangesData = safeSubmoduleChanges[subKey] || {}
              
              // Only include if this is the submodule being saved or if there are actual changes
              if (subKey === submoduleKey || 
                  subChangesData.change_count > 0 || 
                  subChangesData.startDate !== undefined || 
                  subChangesData.endDate !== undefined ||
                  subChangesData.progress !== undefined) {
                // Derive status from progress (source of truth)
                const progressValue = subChangesData.progress !== undefined 
                  ? subChangesData.progress 
                  : (sub.progress || 0)
                const derivedStatus = getStatusFromProgress(progressValue)
                
                // Send the updated values (use changed values if available, otherwise use current values)
                changedSubmodules.push({
                  id: subKey,
                  startDate: subChangesData.startDate !== undefined 
                    ? subChangesData.startDate 
                    : (sub.startDate || null),
                  endDate: subChangesData.endDate !== undefined
                    ? subChangesData.endDate
                    : (sub.endDate || null),
                  progress: subChangesData.progress !== undefined
                    ? subChangesData.progress
                    : (sub.progress || 0),
                  status: derivedStatus
                })
              }
            })
          }
        })
      }
      
      // Calculate employee-level values
      const employeeDates = getEmployeeDates(participant, moduleChanges, submoduleChanges)
      const employeeProgress = getEmployeeProgress(participant, moduleChanges, submoduleChanges)
      
      const recalculatedEmployee = {
        id: participant.id,
        startDate: employeeDates.startDate,
        endDate: employeeDates.endDate,
        progress: employeeProgress
      }
      
      // Save to backend
      const payload = {
        changedSubmodules,
        recalculatedModules,
        recalculatedEmployee,
        updatedAt: new Date().toISOString()
      }
      
      const response = await fetch(`${getApiBaseUrl()}/api/programs/${programId}/participants/${participant.employee_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save changes')
      }
      
      // Update local state directly instead of refreshing all participants
      const responseData = await response.json()
      const savedParticipation = responseData.participation
      
      // Update the specific participant's data in local state
      setParticipants(prevParticipants => {
        return prevParticipants.map(p => {
          if (p.id === participantId || p.employee_id === participant.employee_id) {
            // Update this participant's data from the saved response
            let modules = []
            if (savedParticipation.module_data && savedParticipation.module_data.length > 0) {
              modules = savedParticipation.module_data.map(m => ({
                ...m,
                name: m.module_name,
                startDate: m.start_date,
                endDate: m.end_date,
                change_count: m.change_count || 0,
                submodules: (m.submodules || []).map(s => ({
                  ...s,
                  name: s.submodule_name,
                  startDate: s.start_date,
                  endDate: s.end_date,
                  progress: s.progress || 0,
                  change_count: s.change_count || 0
                }))
              }))
            }
            
            // Calculate employee dates from modules
            let employeeStartDate = savedParticipation.start_date || ''
            let employeeEndDate = savedParticipation.end_date || ''
            if (modules && modules.length > 0) {
              const moduleStartDates = modules.map(m => m.startDate).filter(d => d)
              const moduleEndDates = modules.map(m => m.endDate).filter(d => d)
              if (moduleStartDates.length > 0) {
                employeeStartDate = moduleStartDates.reduce((min, d) => d < min ? d : min, moduleStartDates[0])
              }
              if (moduleEndDates.length > 0) {
                employeeEndDate = moduleEndDates.reduce((max, d) => d > max ? d : max, moduleEndDates[0])
              }
            }
            
            return {
              ...p,
              start_date: employeeStartDate,
              end_date: employeeEndDate,
              progress: savedParticipation.progress || 0,
              status: savedParticipation.status || 'Not Started',
              change_count: savedParticipation.total_change_count || 0,
              modules: modules,
              has_modules: modules && modules.length > 0
            }
          }
          return p
        })
      })
      
      // Clear the saved submodule from local changes (keep others)
      setSubmoduleChanges(prevChanges => {
        const updatedChanges = { ...prevChanges }
        delete updatedChanges[submoduleKey]
        return updatedChanges
      })
      
      // Clear module changes for this module if all submodules are saved
      const moduleKey = `${participantId}-${moduleIndex}`
      const moduleSubmodules = participant.modules[moduleIndex].submodules || []
      const allSubmodulesSaved = moduleSubmodules.every((sub, subIdx) => {
        const subKey = `${participantId}-${moduleIndex}-${subIdx}`
        return !submoduleChanges[subKey] || subKey === submoduleKey
      })
      
      if (allSubmodulesSaved) {
        setModuleChanges(prevChanges => {
          const updatedChanges = { ...prevChanges }
          delete updatedChanges[moduleKey]
          return updatedChanges
        })
      }
      
      setEditingSubmodule(null)
    } catch (error) {
      console.error('Error saving submodule:', error)
      alert(`Failed to save changes: ${error.message}`)
    } finally {
      setSavingSubmodule(null) // Clear loading state for this specific submodule
    }
  }

  const handleCancelSubmoduleEdit = (participantId, moduleIndex, submoduleIndex) => {
    const submoduleKey = `${participantId}-${moduleIndex}-${submoduleIndex}`
    
    // Remove all unsaved changes for this submodule from submoduleChanges
    setSubmoduleChanges(prevChanges => {
      const newChanges = { ...prevChanges }
      delete newChanges[submoduleKey]
      return newChanges
    })
    
    // Also remove any date change history entries that were added during this edit session
    // We'll remove the last entries that match this submodule (since they were just added)
    setDateChangeHistory(prev => {
      const historyKey = participantId
      const participantHistory = prev[historyKey] || []
      
      // Find the participant to get module/submodule names for matching
      const participant = participants.find(p => p.id === participantId)
      if (!participant || !participant.modules || !participant.modules[moduleIndex] || !participant.modules[moduleIndex].submodules) {
        return prev
      }
      
      const module = participant.modules[moduleIndex]
      const submodule = module.submodules[submoduleIndex]
      const moduleName = module.name || `Module ${moduleIndex + 1}`
      const submoduleName = submodule.name || `Submodule ${submoduleIndex + 1}`
      
      // Remove history entries that match this submodule and were added recently (during this edit session)
      // We'll remove entries from the end that match this submodule
      const filteredHistory = [...participantHistory]
      let removed = false
      // Remove from the end (most recent first) entries that match this submodule
      for (let i = filteredHistory.length - 1; i >= 0; i--) {
        const entry = filteredHistory[i]
        if (entry.moduleName === moduleName && entry.submoduleName === submoduleName) {
          filteredHistory.splice(i, 1)
          removed = true
        }
      }
      
      if (removed) {
        return {
          ...prev,
          [historyKey]: filteredHistory
        }
      }
      
      return prev
    })
    
    // Exit edit mode
    setEditingSubmodule(null)
  }

  // Helper to calculate module dates from submodules (earliest start, latest end)
  // Prioritizes saved module dates from database, then calculates from submodules if there are unsaved changes
  const getModuleDates = (module, participantId, moduleIdx, submoduleChanges) => {
    // Check if we have unsaved changes in submodules for this module
    const safeSubmoduleChanges = submoduleChanges || {}
    let hasUnsavedSubmoduleChanges = false
    
    if (module && module.submodules) {
      for (let subIdx = 0; subIdx < module.submodules.length; subIdx++) {
        const submoduleKey = `${participantId}-${moduleIdx}-${subIdx}`
        if (safeSubmoduleChanges[submoduleKey]) {
          hasUnsavedSubmoduleChanges = true
          break
        }
      }
    }
    
    // If no unsaved changes and module has saved dates from database, use those
    if (!hasUnsavedSubmoduleChanges && module && module.startDate && module.endDate) {
      // Normalize saved dates
      const savedStartDate = module.startDate.match(/^\d{4}-\d{2}-\d{2}$/) 
        ? module.startDate 
        : (parseDateToStorage(module.startDate) || module.startDate)
      const savedEndDate = module.endDate.match(/^\d{4}-\d{2}-\d{2}$/) 
        ? module.endDate 
        : (parseDateToStorage(module.endDate) || module.endDate)
      
      return {
        startDate: savedStartDate,
        endDate: savedEndDate
      }
    }
    
    // Calculate from submodules (either no saved dates, or has unsaved changes)
    if (!module || !module.submodules || module.submodules.length === 0) {
      return { startDate: module?.startDate || '', endDate: module?.endDate || '' }
    }
    
    const submodules = module.submodules
    let earliestStart = null
    let latestEnd = null
    
    submodules.forEach((submodule, subIdx) => {
      const submoduleKey = `${participantId}-${moduleIdx}-${subIdx}`
      const submoduleChangesData = safeSubmoduleChanges[submoduleKey] || {}
      
      // Get dates and normalize them to YYYY-MM-DD format for proper comparison
      let startDate = submoduleChangesData.startDate !== undefined 
        ? submoduleChangesData.startDate 
        : (submodule.startDate || '')
      let endDate = submoduleChangesData.endDate !== undefined
        ? submoduleChangesData.endDate
        : (submodule.endDate || '')
      
      // Normalize dates to YYYY-MM-DD format
      if (startDate && startDate.trim() !== '') {
        startDate = startDate.match(/^\d{4}-\d{2}-\d{2}$/) ? startDate : parseDateToStorage(startDate) || startDate
      }
      if (endDate && endDate.trim() !== '') {
        endDate = endDate.match(/^\d{4}-\d{2}-\d{2}$/) ? endDate : parseDateToStorage(endDate) || endDate
      }
      
      // Compare normalized dates
      if (startDate && startDate.trim() !== '') {
        if (!earliestStart || startDate < earliestStart) {
          earliestStart = startDate
        }
      }
      
      if (endDate && endDate.trim() !== '') {
        if (!latestEnd || endDate > latestEnd) {
          latestEnd = endDate
        }
      }
    })
    
    return {
      startDate: earliestStart || module?.startDate || '',
      endDate: latestEnd || module?.endDate || ''
    }
  }

  // Helper to calculate module progress from submodules (average)
  const getModuleProgress = (module, participantId, moduleIdx, submoduleChanges) => {
    if (!module || !module.submodules || module.submodules.length === 0) {
      return 0
    }
    
    // Ensure submoduleChanges is an object
    const safeSubmoduleChanges = submoduleChanges || {}
    
    const submodules = module.submodules
    let totalProgress = 0
    let count = 0
    
    submodules.forEach((submodule, subIdx) => {
      const submoduleKey = `${participantId}-${moduleIdx}-${subIdx}`
      const submoduleChangesData = safeSubmoduleChanges[submoduleKey] || {}
      
      const progress = submoduleChangesData.progress !== undefined
        ? submoduleChangesData.progress
        : (submodule.progress || 0)
      
      totalProgress += progress
      count++
    })
    
    return count > 0 ? Math.round(totalProgress / count) : 0
  }

  // Helper to calculate employee dates from modules (earliest start, latest end)
  // Prioritizes saved employee dates from database, then calculates from modules
  const getEmployeeDates = (participant, moduleChanges, submoduleChanges) => {
    // Check if participant has saved dates from database (prioritize these if no unsaved changes)
    const hasUnsavedChanges = Object.keys(moduleChanges || {}).length > 0 || Object.keys(submoduleChanges || {}).length > 0
    
    if (!hasUnsavedChanges && participant.start_date && participant.end_date) {
      // No unsaved changes and has saved dates from database, use those
      const savedStartDate = participant.start_date.match(/^\d{4}-\d{2}-\d{2}$/) 
        ? participant.start_date 
        : (parseDateToStorage(participant.start_date) || participant.start_date)
      const savedEndDate = participant.end_date.match(/^\d{4}-\d{2}-\d{2}$/) 
        ? participant.end_date 
        : (parseDateToStorage(participant.end_date) || participant.end_date)
      
      return {
        startDate: savedStartDate,
        endDate: savedEndDate
      }
    }
    
    // Calculate from modules (either no saved dates, or has unsaved changes)
    if (!participant || !participant.modules || participant.modules.length === 0) {
      return { startDate: participant.start_date || '', endDate: participant.end_date || '' }
    }
    
    // Ensure moduleChanges and submoduleChanges are objects
    const safeModuleChanges = moduleChanges || {}
    const safeSubmoduleChanges = submoduleChanges || {}
    
    let earliestStart = null
    let latestEnd = null
    
    participant.modules.forEach((module, moduleIdx) => {
      const moduleKey = `${participant.id}-${moduleIdx}`
      const moduleChangesData = safeModuleChanges[moduleKey] || {}
      const moduleDates = getModuleDates(module, participant.id, moduleIdx, safeSubmoduleChanges)
      
      const startDate = moduleChangesData.startDate !== undefined
        ? moduleChangesData.startDate
        : moduleDates.startDate
      const endDate = moduleChangesData.endDate !== undefined
        ? moduleChangesData.endDate
        : moduleDates.endDate
      
      if (startDate) {
        if (!earliestStart || startDate < earliestStart) {
          earliestStart = startDate
        }
      }
      
      if (endDate) {
        if (!latestEnd || endDate > latestEnd) {
          latestEnd = endDate
        }
      }
    })
    
    return {
      startDate: earliestStart || participant.start_date || '',
      endDate: latestEnd || participant.end_date || ''
    }
  }

  // Helper to calculate employee progress from modules (average)
  const getEmployeeProgress = (participant, moduleChanges, submoduleChanges) => {
    if (!participant || !participant.modules || participant.modules.length === 0) {
      return participant.progress || 0
    }
    
    // Ensure submoduleChanges is an object
    const safeSubmoduleChanges = submoduleChanges || {}
    
    let totalProgress = 0
    let count = 0
    
    participant.modules.forEach((module, moduleIdx) => {
      const moduleProgress = getModuleProgress(module, participant.id, moduleIdx, safeSubmoduleChanges)
      totalProgress += moduleProgress
      count++
    })
    
    return count > 0 ? Math.round(totalProgress / count) : (participant.progress || 0)
  }

  // Helper to get module change count (sum of all submodule change counts)
  const getModuleChangeCount = (module, participantId, moduleIdx, submoduleChanges) => {
    if (!module || !module.submodules || module.submodules.length === 0) {
      // If module has change_count from database, use it
      return module.change_count || 0
    }
    
    // Ensure submoduleChanges is an object
    const safeSubmoduleChanges = submoduleChanges || {}
    
    let totalChangeCount = 0
    
    // Sum up all submodule change counts
    module.submodules.forEach((submodule, subIdx) => {
      const submoduleKey = `${participantId}-${moduleIdx}-${subIdx}`
      const submoduleChangesData = safeSubmoduleChanges[submoduleKey] || {}
      
      // Get the change_count from submodule changes, or from database if available
      const submoduleChangeCount = submoduleChangesData.change_count !== undefined
        ? submoduleChangesData.change_count
        : (submodule.change_count || 0)
      totalChangeCount += submoduleChangeCount
    })
    
    return totalChangeCount
  }

  // Removed handleUpdateModuleDate - modules cannot be edited directly

  // Helper to get status from progress (source of truth)
  const getStatusFromProgress = (progress) => {
    const progressValue = typeof progress === 'number' ? progress : (parseInt(progress) || 0)
    if (progressValue === 100) {
      return 'Completed'
    } else if (progressValue > 0 && progressValue < 100) {
      return 'In Progress'
    } else {
      return 'Not Started'
    }
  }

  // Helper to get module status from submodules
  const getModuleStatus = (module, participantId, moduleIdx, submoduleChanges) => {
    if (!module || !module.submodules || module.submodules.length === 0) {
      return 'Not Started'
    }
    
    const safeSubmoduleChanges = submoduleChanges || {}
    const submodules = module.submodules
    const statuses = []
    
    submodules.forEach((submodule, subIdx) => {
      const submoduleKey = `${participantId}-${moduleIdx}-${subIdx}`
      const submoduleChangesData = safeSubmoduleChanges[submoduleKey] || {}
      // Get progress and derive status from it
      const progress = submoduleChangesData.progress !== undefined
        ? submoduleChangesData.progress
        : (submodule.progress || 0)
      const status = getStatusFromProgress(progress)
      statuses.push(status)
    })
    
    // If all submodules are Not Started → module = Not Started
    if (statuses.every(s => s === 'Not Started')) {
      return 'Not Started'
    }
    
    // If all submodules are Completed → module = Completed
    if (statuses.every(s => s === 'Completed')) {
      return 'Completed'
    }
    
    // Otherwise → module = In Progress (covers mixed states or any In Progress)
    return 'In Progress'
  }

  // Helper to get employee status from modules
  const getEmployeeStatus = (participant, moduleChanges, submoduleChanges) => {
    if (!participant || !participant.modules || participant.modules.length === 0) {
      return participant.status || 'Not Started'
    }
    
    const safeSubmoduleChanges = submoduleChanges || {}
    const modules = participant.modules
    const moduleStatuses = []
    
    modules.forEach((module, moduleIdx) => {
      const moduleStatus = getModuleStatus(module, participant.id, moduleIdx, safeSubmoduleChanges)
      moduleStatuses.push(moduleStatus)
    })
    
    // If all modules are Completed → employee = Completed
    if (moduleStatuses.every(s => s === 'Completed')) {
      return 'Completed'
    }
    
    // If all modules are Not Started → employee = Not Started
    if (moduleStatuses.every(s => s === 'Not Started')) {
      return 'Not Started'
    }
    
    // Otherwise → employee = In Progress (covers mixed states or any In Progress)
    return 'In Progress'
  }

  // Helper to get submodule date considering changes (always returns YYYY-MM-DD format)
  const getSubmoduleDate = (submodule, submoduleKey, field, submoduleChanges) => {
    if (!submodule) return ''
    const safeSubmoduleChanges = submoduleChanges || {}
    const submoduleChangesData = safeSubmoduleChanges[submoduleKey] || {}
    const dateValue = submoduleChangesData[field] !== undefined 
      ? submoduleChangesData[field] 
      : (submodule[field] || '')
    
    // Ensure date is in YYYY-MM-DD format
    if (dateValue && dateValue.trim() !== '') {
      // If already in YYYY-MM-DD format, return as-is
      if (dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return dateValue
      }
      // Otherwise, parse it to YYYY-MM-DD format
      return parseDateToStorage(dateValue) || dateValue
    }
    
    return ''
  }

  // Helper to validate sequential submodule dates
  const validateSubmoduleDateOrder = (participant, moduleIndex, submoduleIndex, field, value, submoduleChanges) => {
    const module = participant.modules[moduleIndex]
    if (!module || !module.submodules) return true
    
    // Ensure submoduleChanges is an object
    const safeSubmoduleChanges = submoduleChanges || {}
    
    const submodules = module.submodules
    const submodule = submodules[submoduleIndex]
    
    // Validate startDate <= endDate for the same submodule
    if (field === 'startDate' || field === 'endDate') {
      const submoduleKey = `${participant.id}-${moduleIndex}-${submoduleIndex}`
      // Use the new value if it's the field being changed, otherwise get from changes
      const currentStartDate = field === 'startDate' ? value : getSubmoduleDate(submodule, submoduleKey, 'startDate', safeSubmoduleChanges)
      const currentEndDate = field === 'endDate' ? value : getSubmoduleDate(submodule, submoduleKey, 'endDate', safeSubmoduleChanges)
      
      // Only validate if both dates exist
      if (currentStartDate && currentEndDate) {
        // Compare as date strings (YYYY-MM-DD format)
        if (currentStartDate > currentEndDate) {
          alert('Start date must be before or equal to end date')
          return false
        }
      }
    }
    
    // Validate endDate <= next submodule's startDate
    if (field === 'endDate' && submoduleIndex < submodules.length - 1) {
      const nextSubmodule = submodules[submoduleIndex + 1]
      if (nextSubmodule) {
        const nextSubmoduleKey = `${participant.id}-${moduleIndex}-${submoduleIndex + 1}`
        const nextSubmoduleStartDate = getSubmoduleDate(nextSubmodule, nextSubmoduleKey, 'startDate', safeSubmoduleChanges)
        
        // Allow equal dates: endDate <= nextSubmoduleStartDate
        // Only validate if both dates exist and are valid date strings
        if (value && nextSubmoduleStartDate && value.trim() !== '' && nextSubmoduleStartDate.trim() !== '') {
          // Normalize both dates to YYYY-MM-DD format for comparison
          // value comes from DateInput in YYYY-MM-DD format, but ensure it's valid
          // nextSubmoduleStartDate might be in YYYY-MM-DD or DD-MM-YYYY format
          const normalizedValue = value.match(/^\d{4}-\d{2}-\d{2}$/) ? value : parseDateToStorage(value)
          const normalizedNextDate = nextSubmoduleStartDate.match(/^\d{4}-\d{2}-\d{2}$/) 
            ? nextSubmoduleStartDate 
            : parseDateToStorage(nextSubmoduleStartDate)
          
          // Only validate if both dates were successfully normalized
          if (normalizedValue && normalizedNextDate && normalizedValue.length === 10 && normalizedNextDate.length === 10) {
            // Compare as date strings (YYYY-MM-DD format) - string comparison works for ISO dates
            // "2025-07-10" > "2025-07-14" = false (correct, 10 < 14)
            // Debug: Log the comparison to help diagnose issues
            const comparison = normalizedValue > normalizedNextDate
            if (comparison) {
              console.log('Date validation failed:', {
                field,
                value: normalizedValue,
                nextDate: normalizedNextDate,
                comparison: `${normalizedValue} > ${normalizedNextDate} = ${comparison}`
              })
              alert(`End date (${formatDateForDisplay(normalizedValue)}) must be less than or equal to the next submodule's start date (${formatDateForDisplay(normalizedNextDate)})`)
              return false
            }
          }
        }
      }
    }
    
    // Validate startDate >= previous submodule's endDate (allow equal dates)
    if (field === 'startDate' && submoduleIndex > 0) {
      const prevSubmodule = submodules[submoduleIndex - 1]
      if (prevSubmodule) {
        const prevSubmoduleKey = `${participant.id}-${moduleIndex}-${submoduleIndex - 1}`
        const prevSubmoduleEndDate = getSubmoduleDate(prevSubmodule, prevSubmoduleKey, 'endDate', safeSubmoduleChanges)
        
        // Allow equal dates: startDate >= prevSubmoduleEndDate
        // Only validate if both dates exist and are valid date strings
        if (value && prevSubmoduleEndDate && value.trim() !== '' && prevSubmoduleEndDate.trim() !== '') {
          // Normalize both dates to YYYY-MM-DD format for comparison
          // value comes from DateInput in YYYY-MM-DD format, but ensure it's valid
          // prevSubmoduleEndDate might be in YYYY-MM-DD or DD-MM-YYYY format
          const normalizedValue = value.match(/^\d{4}-\d{2}-\d{2}$/) ? value : parseDateToStorage(value)
          const normalizedPrevDate = prevSubmoduleEndDate.match(/^\d{4}-\d{2}-\d{2}$/) 
            ? prevSubmoduleEndDate 
            : parseDateToStorage(prevSubmoduleEndDate)
          
          // Only validate if both dates were successfully normalized
          if (normalizedValue && normalizedPrevDate && normalizedValue.length === 10 && normalizedPrevDate.length === 10) {
            // Compare as date strings (YYYY-MM-DD format) - string comparison works for ISO dates
            // "2025-07-14" < "2025-07-10" = false (correct, 14 > 10)
            if (normalizedValue < normalizedPrevDate) {
              alert(`Start date (${formatDateForDisplay(normalizedValue)}) must be greater than or equal to the previous submodule's end date (${formatDateForDisplay(normalizedPrevDate)})`)
              return false
            }
          }
        }
      }
    }
    
    return true
  }

  // Helper to validate sequential module dates
  const validateModuleDateOrder = (participant, moduleIndex, newModuleDates, moduleChanges, submoduleChangesForValidation) => {
    if (!participant || !participant.modules) return true
    
    // Ensure moduleChanges and submoduleChanges are objects
    const safeModuleChanges = moduleChanges || {}
    const safeSubmoduleChanges = submoduleChangesForValidation || submoduleChanges || {}
    
    const modules = participant.modules
    
    // Validate module endDate <= next module's startDate
    if (moduleIndex < modules.length - 1) {
      const nextModule = modules[moduleIndex + 1]
      const nextModuleKey = `${participant.id}-${moduleIndex + 1}`
      const nextModuleDates = getModuleDates(nextModule, participant.id, moduleIndex + 1, safeSubmoduleChanges)
      const nextModuleChangesData = safeModuleChanges[nextModuleKey] || {}
      const nextModuleStartDate = nextModuleChangesData.startDate !== undefined 
        ? nextModuleChangesData.startDate 
        : nextModuleDates.startDate
      
      // Allow equal dates: module endDate <= nextModuleStartDate
      // Only validate if both dates exist and are valid
      if (newModuleDates.endDate && nextModuleStartDate) {
        // Normalize both dates to YYYY-MM-DD format for comparison
        const normalizedEndDate = newModuleDates.endDate.match(/^\d{4}-\d{2}-\d{2}$/) 
          ? newModuleDates.endDate 
          : parseDateToStorage(newModuleDates.endDate)
        const normalizedNextStartDate = nextModuleStartDate.match(/^\d{4}-\d{2}-\d{2}$/) 
          ? nextModuleStartDate 
          : parseDateToStorage(nextModuleStartDate)
        
        // Only validate if both dates were successfully normalized
        if (normalizedEndDate && normalizedNextStartDate && normalizedEndDate.length === 10 && normalizedNextStartDate.length === 10) {
          // Compare as date strings (YYYY-MM-DD format) - string comparison works for ISO dates
          // Debug: Log the comparison to help diagnose issues
          const comparison = normalizedEndDate > normalizedNextStartDate
          if (comparison) {
            console.log('Module date validation failed:', {
              moduleIndex,
              endDate: normalizedEndDate,
              nextStartDate: normalizedNextStartDate,
              comparison: `${normalizedEndDate} > ${normalizedNextStartDate} = ${comparison}`
            })
            alert(`Module end date must be less than or equal to the next module's start date (${formatDateForDisplay(normalizedNextStartDate)})`)
            return false
          }
        }
      }
    }
    
    // Validate module startDate >= previous module's endDate (allow equal dates)
    if (moduleIndex > 0) {
      const prevModule = modules[moduleIndex - 1]
      if (prevModule) {
        const prevModuleKey = `${participant.id}-${moduleIndex - 1}`
        const prevModuleDates = getModuleDates(prevModule, participant.id, moduleIndex - 1, safeSubmoduleChanges)
        const prevModuleChangesData = safeModuleChanges[prevModuleKey] || {}
        const prevModuleEndDate = prevModuleChangesData.endDate !== undefined 
          ? prevModuleChangesData.endDate 
          : prevModuleDates.endDate
        
        // Allow equal dates: module startDate >= prevModuleEndDate
        // Only validate if both dates exist and are valid
        if (newModuleDates.startDate && prevModuleEndDate) {
          // Normalize both dates to YYYY-MM-DD format for comparison
          const normalizedStartDate = newModuleDates.startDate.match(/^\d{4}-\d{2}-\d{2}$/) 
            ? newModuleDates.startDate 
            : parseDateToStorage(newModuleDates.startDate)
          const normalizedPrevEndDate = prevModuleEndDate.match(/^\d{4}-\d{2}-\d{2}$/) 
            ? prevModuleEndDate 
            : parseDateToStorage(prevModuleEndDate)
          
          // Only validate if both dates were successfully normalized
          if (normalizedStartDate && normalizedPrevEndDate && normalizedStartDate.length === 10 && normalizedPrevEndDate.length === 10) {
            // Compare as date strings (YYYY-MM-DD format) - string comparison works for ISO dates
            if (normalizedStartDate < normalizedPrevEndDate) {
              alert(`Module start date must be greater than or equal to the previous module's end date (${formatDateForDisplay(normalizedPrevEndDate)})`)
              return false
            }
          }
        }
      }
    }
    
    return true
  }

  const handleUpdateSubmoduleField = (participantId, moduleIndex, submoduleIndex, field, value) => {
    const submoduleKey = `${participantId}-${moduleIndex}-${submoduleIndex}`
    const participant = participants.find(p => p.id === participantId)
    if (!participant || !participant.modules || !participant.modules[moduleIndex] || !participant.modules[moduleIndex].submodules) return
    
    const submodule = participant.modules[moduleIndex].submodules[submoduleIndex]
    const oldValue = submodule[field]
    
    if (oldValue === value) return
    
    // Update submoduleChanges state
    setSubmoduleChanges(prevChanges => {
      const newChanges = { ...prevChanges }
      
      if (!newChanges[submoduleKey]) {
        // Initialize with original values from program/database
        // Get existing change_count from database (submodule.change_count)
        const dbChangeCount = submodule.change_count || 0
        newChanges[submoduleKey] = {
          change_count: dbChangeCount, // Start with database count, not 0
          original_startDate: submodule.startDate || '',
          original_endDate: submodule.endDate || '',
          original_progress: submodule.progress || 0,
          startDate: submodule.startDate || '',
          endDate: submodule.endDate || '',
          progress: submodule.progress || 0
          // Status is derived from progress, not stored separately
        }
      }
      
      // Get previous value BEFORE updating (for change count calculation)
      // If submodule already has changes, use the current value from changes, otherwise use original
      const previousValue = newChanges[submoduleKey]?.[field] !== undefined 
        ? newChanges[submoduleKey][field] 
        : oldValue
      // Get previous change count: from newChanges if exists, otherwise from database
      const previousChangeCount = newChanges[submoduleKey]?.change_count !== undefined
        ? newChanges[submoduleKey].change_count
        : (submodule.change_count || 0)
      
      // Store the new value temporarily for validation and updates
      const tempNewChanges = { ...newChanges }
      if (!tempNewChanges[submoduleKey]) {
        tempNewChanges[submoduleKey] = { ...newChanges[submoduleKey] }
      }
      tempNewChanges[submoduleKey][field] = value
      
      // Validate date order for submodules (using tempNewChanges that includes the new value)
      if (field === 'startDate' || field === 'endDate') {
        if (!validateSubmoduleDateOrder(participant, moduleIndex, submoduleIndex, field, value, tempNewChanges)) {
          // Return unchanged state if validation fails - don't update anything
          return prevChanges
        }
      }
      
      // Don't increment change_count during editing - only on save
      // Keep the change_count from database (or existing changes) but don't update it here
      // Change count will be updated only when Save button is clicked
      const currentChangeCount = newChanges[submoduleKey]?.change_count !== undefined
        ? newChanges[submoduleKey].change_count
        : (submodule.change_count || 0)
      
      tempNewChanges[submoduleKey].change_count = currentChangeCount
      
      // Recalculate module dates, progress, and change count immediately using tempNewChanges
      const updatedModule = participant.modules[moduleIndex]
      const updatedModuleDates = getModuleDates(updatedModule, participantId, moduleIndex, tempNewChanges)
      const updatedModuleProgress = getModuleProgress(updatedModule, participantId, moduleIndex, tempNewChanges)
      const updatedModuleChangeCount = getModuleChangeCount(updatedModule, participantId, moduleIndex, tempNewChanges)
      
      // Validate module date order before updating (using tempNewChanges for submodules)
      if (field === 'startDate' || field === 'endDate') {
        // Create a test set of module changes with the updated dates
        const testModuleChanges = { ...moduleChanges }
        const moduleKey = `${participantId}-${moduleIndex}`
        
        // Temporarily add the updated module dates to test validation
        const tempModuleChanges = {
          ...testModuleChanges,
          [moduleKey]: {
            ...testModuleChanges[moduleKey],
            startDate: updatedModuleDates.startDate,
            endDate: updatedModuleDates.endDate
          }
        }
        
        if (!validateModuleDateOrder(participant, moduleIndex, updatedModuleDates, tempModuleChanges, tempNewChanges)) {
          // Revert the submodule change if module validation fails
          return prevChanges
        }
      }
      
      // All validations passed, use tempNewChanges as the final newChanges
      const finalChanges = tempNewChanges
      
      // Update module changes
      setModuleChanges(prevModuleChanges => {
        const updatedModuleChanges = { ...prevModuleChanges }
        const moduleKey = `${participantId}-${moduleIndex}`
        
        if (!updatedModuleChanges[moduleKey]) {
          const originalModuleDates = getModuleDates(updatedModule, participantId, moduleIndex, {})
          // updatedModuleChangeCount already includes database counts + new changes from getModuleChangeCount
          updatedModuleChanges[moduleKey] = {
            change_count: updatedModuleChangeCount, // This already includes DB count + new changes
            original_startDate: originalModuleDates.startDate,
            original_endDate: originalModuleDates.endDate,
            startDate: updatedModuleDates.startDate,
            endDate: updatedModuleDates.endDate,
            progress: updatedModuleProgress
          }
        } else {
          updatedModuleChanges[moduleKey].startDate = updatedModuleDates.startDate
          updatedModuleChanges[moduleKey].endDate = updatedModuleDates.endDate
          updatedModuleChanges[moduleKey].change_count = updatedModuleChangeCount // This already includes DB count + new changes
          updatedModuleChanges[moduleKey].progress = updatedModuleProgress
        }
        
        return updatedModuleChanges
      })
      
      return finalChanges
    })
  }

  // Update participant dates and progress when module/submodule changes occur
  useEffect(() => {
    setParticipants(prev => {
      if (prev.length === 0) return prev
      
      return prev.map(participant => {
        const employeeDates = getEmployeeDates(participant, moduleChanges, submoduleChanges)
        const employeeProgress = getEmployeeProgress(participant, moduleChanges, submoduleChanges)
        
        // Only update if values actually changed to avoid unnecessary re-renders
        if (participant.start_date === employeeDates.startDate && 
            participant.end_date === employeeDates.endDate && 
            participant.progress === employeeProgress) {
          return participant
        }
        
        return {
          ...participant,
          start_date: employeeDates.startDate || participant.start_date,
          end_date: employeeDates.endDate || participant.end_date,
          progress: employeeProgress
        }
      })
    })
  }, [moduleChanges, submoduleChanges])

  // Removed participant and module edit handlers - only submodules can be edited

  // Prepare data for backend save
  const handleSaveAllChanges = async () => {
    if (!selectedProgram) return
    
    try {
      setLoading(true)
      const programId = selectedProgram.program_id || selectedProgram.id
      const token = getCookie(TOKEN)
      
      // Save changes for each participant individually
      const savePromises = participants.map(async (participant) => {
        const changedSubmodules = []
        const recalculatedModules = []
        
        // Collect changed submodules and recalculated modules for this participant
        if (participant.modules) {
          participant.modules.forEach((module, moduleIdx) => {
            const moduleKey = `${participant.id}-${moduleIdx}`
            const moduleChangesData = moduleChanges[moduleKey] || {}
            const moduleDates = getModuleDates(module, participant.id, moduleIdx, submoduleChanges)
            const moduleProgress = getModuleProgress(module, participant.id, moduleIdx, submoduleChanges)
            const moduleChangeCount = getModuleChangeCount(module, participant.id, moduleIdx, submoduleChanges)
            
            // Add module to recalculated modules
            recalculatedModules.push({
              id: moduleKey,
              startDate: moduleChangesData.startDate !== undefined ? moduleChangesData.startDate : moduleDates.startDate,
              endDate: moduleChangesData.endDate !== undefined ? moduleChangesData.endDate : moduleDates.endDate,
              progress: moduleProgress,
              changesCount: moduleChangeCount
            })
            
            // Collect changed submodules for this module
            if (module.submodules) {
              const safeSubmoduleChanges = submoduleChanges || {}
              module.submodules.forEach((submodule, subIdx) => {
                const submoduleKey = `${participant.id}-${moduleIdx}-${subIdx}`
                const submoduleChangesData = safeSubmoduleChanges[submoduleKey] || {}
                
                // Only include if there are actual changes
                if (submoduleChangesData.change_count > 0 || 
                    submoduleChangesData.startDate !== undefined || 
                    submoduleChangesData.endDate !== undefined ||
                    submoduleChangesData.progress !== undefined) {
                  // Derive status from progress (source of truth)
                  const progressValue = submoduleChangesData.progress !== undefined 
                    ? submoduleChangesData.progress 
                    : (submodule.progress || 0)
                  const derivedStatus = getStatusFromProgress(progressValue)
                  
                  // Send the updated values (use changed values if available, otherwise use current values)
                  changedSubmodules.push({
                    id: submoduleKey,
                    startDate: submoduleChangesData.startDate !== undefined 
                      ? submoduleChangesData.startDate 
                      : (submodule.startDate || null),
                    endDate: submoduleChangesData.endDate !== undefined
                      ? submoduleChangesData.endDate
                      : (submodule.endDate || null),
                    progress: submoduleChangesData.progress !== undefined
                      ? submoduleChangesData.progress
                      : (submodule.progress || 0),
                    status: derivedStatus
                  })
                }
              })
            }
          })
        }
        
        // Calculate employee-level values
        const employeeDates = getEmployeeDates(participant, moduleChanges, submoduleChanges)
        const employeeProgress = getEmployeeProgress(participant, moduleChanges, submoduleChanges)
        
        const recalculatedEmployee = {
          id: participant.id,
          startDate: employeeDates.startDate,
          endDate: employeeDates.endDate,
          progress: employeeProgress
        }
        
        // Only save if there are changes
        if (changedSubmodules.length > 0 || recalculatedModules.length > 0) {
          const payload = {
            changedSubmodules,
            recalculatedModules,
            recalculatedEmployee,
            updatedAt: new Date().toISOString()
          }
          
          const response = await fetch(`${getApiBaseUrl()}/api/programs/${programId}/participants/${participant.employee_id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
          })
          
          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || 'Failed to save changes')
          }
          
          return await response.json()
        }
        
        return null
      })
      
      await Promise.all(savePromises)
      
      // Clear local changes after successful save
      setSubmoduleChanges({})
      setModuleChanges({})
      setDateChangeHistory({})
      
      // Refresh participants data
      const response = await fetch(`${getApiBaseUrl()}/api/programs/${programId}/participants`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        const participantsList = data.participants || []
        
        console.log('Refreshed participants data:', participantsList)
        
        // Transform API response to match frontend structure
        const mappedParticipants = participantsList.map(participant => {
          const participantKey = participant.id || `${programId}-${participant.employee_id}`
          
          // ALWAYS use module_data from database if available (prioritize this)
          let modules = []
          if (participant.module_data && participant.module_data.length > 0) {
            // Use module_data from database (this contains employee-specific dates)
            modules = participant.module_data.map(module => ({
              ...module,
              name: module.module_name,
              startDate: module.start_date, // Map from database format
              endDate: module.end_date, // Map from database format
              change_count: module.change_count || 0, // Preserve change_count from database
              submodules: (module.submodules || []).map(sub => ({
                ...sub,
                name: sub.submodule_name,
                startDate: sub.start_date, // Map from database format
                endDate: sub.end_date, // Map from database format
                progress: sub.progress || 0,
                change_count: sub.change_count || 0 // Preserve change_count from database
              }))
            }))
            console.log(`Participant ${participantKey} - Using module_data from database, modules:`, modules)
          } else if (selectedProgram.modules && selectedProgram.modules.length > 0) {
            // Fall back to program modules only if module_data is empty
            modules = selectedProgram.modules.map(module => ({
              ...module,
              name: module.name,
              startDate: module.startDate,
              endDate: module.endDate,
              change_count: 0,
              submodules: (module.submodules || []).map(sub => ({
                ...sub,
                name: sub.name,
                startDate: sub.startDate,
                endDate: sub.endDate,
                progress: sub.progress || 0,
                change_count: 0
              }))
            }))
            console.log(`Participant ${participantKey} - Falling back to program modules`)
          }
          
          // Use dates from module_data if available, otherwise from participant record
          let employeeStartDate = participant.start_date || ''
          let employeeEndDate = participant.end_date || ''
          
          // If module_data exists, calculate dates from modules
          if (modules && modules.length > 0) {
            const moduleStartDates = modules.map(m => m.startDate).filter(d => d)
            const moduleEndDates = modules.map(m => m.endDate).filter(d => d)
            if (moduleStartDates.length > 0) {
              employeeStartDate = moduleStartDates.reduce((min, d) => d < min ? d : min, moduleStartDates[0])
            }
            if (moduleEndDates.length > 0) {
              employeeEndDate = moduleEndDates.reduce((max, d) => d > max ? d : max, moduleEndDates[0])
            }
          }
          
          return {
            id: participantKey,
            employee_id: participant.employee_id,
            employee_name: participant.employee_name,
            employee_title: participant.employee_title,
            start_date: employeeStartDate,
            end_date: employeeEndDate,
            progress: participant.progress || 0,
            status: participant.status || 'Not Started',
            change_count: participant.total_change_count || 0,
            has_modules: modules && modules.length > 0,
            modules: modules
          }
        })
        
        console.log('Mapped participants after refresh:', mappedParticipants)
        setParticipants(mappedParticipants)
      }
      
      alert('Changes saved successfully!')
    } catch (error) {
      console.error('Error saving changes:', error)
      alert(`Failed to save changes: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveParticipant = (participantId) => {
    if (window.confirm('Are you sure you want to remove this participant from the program?')) {
      // TODO: API call to remove participant
      console.log('Removing participant:', participantId)
      setParticipants(prev => prev.filter(p => p.id !== participantId))
    }
  }

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'Completed':
        return 'bg-green-700 text-white'
      case 'In Progress':
        return 'bg-blue-100 text-blue-800'
      case 'Not Started':
        return 'bg-slate-100 text-slate-600'
      default:
        return 'bg-slate-100 text-slate-600'
    }
  }

  const getChangeBadgeClass = (count) => {
    if (count >= 7) return 'bg-red-500 text-white border-red-500'
    if (count >= 4) return 'bg-orange-500 text-white border-orange-500'
    return 'bg-slate-200 text-slate-700 border-slate-300'
  }

  const filteredParticipants = participants.filter(p => {
    if (statusFilter === 'all') return true
    if (statusFilter === 'completed') return p.status === 'Completed'
    if (statusFilter === 'in-progress') return p.status === 'In Progress'
    if (statusFilter === 'not-started') return p.status === 'Not Started'
    return true
  })

  const stats = {
    total: participants.length,
    completed: participants.filter(p => p.status === 'Completed').length,
    inProgress: participants.filter(p => p.status === 'In Progress').length,
    notStarted: participants.filter(p => p.status === 'Not Started').length,
    averageProgress: participants.length > 0 
      ? Math.round(participants.reduce((sum, p) => sum + p.progress, 0) / participants.length)
      : 0
  }

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <>
      <style>{animationStyles}</style>
      <div className="animate-fade-in">
        {/* Page Header */}
        <div className="mb-2 animate-fade-in mb-2">
          <h1 className="page-title text-xl">Learning & Training Tracker</h1>
        </div>

        {/* Program Selector and Controls */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-2 mb-2">
          <div className="grid grid-cols-[2fr_auto_auto_auto] gap-3 items-center">
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <SearchableSelect
                  label=""
                  options={programs.map(program => ({
                    value: program.program_id || program.id,
                    label: program.program_name
                  }))}
                  value={selectedProgram?.program_id || selectedProgram?.id}
                  onChange={(programId) => {
                    const program = programs.find(p => (p.program_id || p.id) === programId)
                    setSelectedProgram(program)
                    setEditingSubmodule(null) // Clear editing when switching programs
                  }}
                  placeholder="Search and select a program..."
                  searchPlaceholder="Search programs..."
                />
              </div>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-slate-90 font-medium hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-green-800 focus:border-transparent"
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="in-progress">In Progress</option>
              <option value="not-started">Not Started</option>
            </select>
            {/* Add Any btns... */}
          </div>
        </div>

        {/* Program Summary Stats */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-2">
          <div className="grid grid-cols-5 gap-3">
            <div className="text-center border border-slate-200 rounded-xl px-3 py-2 bg-slate-50">
              <div className="text-xs font-bold text-slate-900">{stats.total}</div>
              <div className="text-xs text-slate-600 uppercase mt-1">Total Participants</div>
            </div>
            <div className="text-center border border-slate-200 rounded-xl px-3 py-2 bg-slate-50">
              <div className="text-xs font-bold text-green-700">{stats.completed}</div>
              <div className="text-xs text-slate-600 uppercase mt-1">Completed</div>
            </div>
            <div className="text-center border border-slate-200 rounded-xl px-3 py-2 bg-slate-50">
              <div className="text-xs font-bold text-blue-700">{stats.inProgress}</div>
              <div className="text-xs text-slate-600 uppercase mt-1">In Progress</div>
            </div>
            <div className="text-center border border-slate-200 rounded-xl px-3 py-2 bg-slate-50">
              <div className="text-xs font-bold text-slate-600">{stats.notStarted}</div>
              <div className="text-xs text-slate-600 uppercase mt-1">Not Started</div>
            </div>
            <div className="text-center border border-slate-200 rounded-xl px-3 py-2 bg-slate-50">
              <div className="text-xs font-bold text-slate-900">{stats.averageProgress}%</div>
              <div className="text-xs text-slate-600 uppercase mt-1">Avg Progress</div>
            </div>
          </div>
        </div>

        {/* Participants Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-0 mb-6">
        
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider" style={{ width: '20%' }}>Participant</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider" style={{ width: '12%' }}>Start Date</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider" style={{ width: '12%' }}>End Date</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider" style={{ width: '15%' }}>Progress</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider" style={{ width: '10%' }}>Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider" style={{ width: '8%' }}>Changes</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider" style={{ width: '13%' }}>Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {filteredParticipants.length > 0 ? (
                  filteredParticipants.map(participant => (
                    <React.Fragment key={participant.id}>
                      {/* Main Participant Row */}
                      {(() => {
                        // Calculate employee dates, progress, and status from modules
                        const employeeDates = getEmployeeDates(participant, moduleChanges, submoduleChanges)
                        const employeeProgress = getEmployeeProgress(participant, moduleChanges, submoduleChanges)
                        const employeeStatus = getEmployeeStatus(participant, moduleChanges, submoduleChanges)
                        // Count total submodules with date changes across all modules
                        let totalChangeCount = 0
                        if (participant.modules) {
                          participant.modules.forEach((module, moduleIdx) => {
                            totalChangeCount += getModuleChangeCount(module, participant.id, moduleIdx, submoduleChanges)
                          })
                        }
                        
                        return (
                          <tr 
                            className={`transition-colors ${participant.has_modules ? 'cursor-pointer' : ''} ${
                              totalChangeCount > 3 
                                ? 'bg-red-50 hover:bg-red-100' 
                                : 'hover:bg-slate-50'
                            }`}
                            onClick={() => participant.has_modules && toggleModules(participant.id)}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                {participant.has_modules && (
                                  <svg 
                                    className={`w-4 h-4 text-slate-400 transition-transform ${expandedParticipants.has(participant.id) ? 'rotate-90' : ''}`}
                                    fill="currentColor" 
                                    viewBox="0 0 24 24"
                                  >
                                    <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
                                  </svg>
                                )}
                                <svg className="w-5 h-5 text-slate-400" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                                </svg>
                                <div>
                                  <div className="text-sm font-medium text-slate-900">{participant.employee_name}</div>
                                  <div className="text-xs text-slate-500">{participant.employee_title}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-900">
                              {employeeDates.startDate ? formatDateForDisplay(employeeDates.startDate) : '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-900">
                              {employeeDates.endDate ? formatDateForDisplay(employeeDates.endDate) : '-'}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col items-center gap-1">
                                <div className="text-xs text-slate-700 font-medium">
                                  {employeeProgress}%
                                </div>
                                <div className="w-36 h-2 border border-slate-300 rounded relative bg-slate-100 transition-all duration-300">
                                  <div 
                                    className="h-full bg-green-800 rounded transition-all duration-300"
                                    style={{ width: `${employeeProgress}%` }}
                                  >
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeClass(employeeStatus)}`}>
                                {employeeStatus}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 text-xs font-semibold rounded border ${getChangeBadgeClass(totalChangeCount)}`}>
                                  {totalChangeCount || 0}
                                </span>
                                {totalChangeCount > 0 && (
                                  <svg 
                                    className="w-4 h-4 text-slate-400 hover:text-slate-600 cursor-pointer" 
                                    fill="currentColor" 
                                    viewBox="0 0 24 24" 
                                    title="View History"
                                    onClick={async (e) => {
                                      e.stopPropagation()
                                      setSelectedParticipantForHistory(participant)
                                      setShowHistoryModal(true)
                                      
                                      // Fetch history from API
                                      setLoadingHistory(true)
                                      setFetchedHistory([]) // Clear previous history
                                      try {
                                        const programId = selectedProgram?.program_id || selectedProgram?.id
                                        const token = getCookie(TOKEN)
                                        const response = await fetch(`${getApiBaseUrl()}/api/programs/${programId}/participants/${participant.employee_id}/history`, {
                                          headers: {
                                            'Authorization': `Bearer ${token}`
                                          }
                                        })
                                        
                                        if (response.ok) {
                                          const data = await response.json()
                                          setFetchedHistory(data.history || [])
                                        } else {
                                          console.error('Failed to fetch history')
                                          setFetchedHistory([])
                                        }
                                      } catch (error) {
                                        console.error('Error fetching history:', error)
                                        setFetchedHistory([])
                                      } finally {
                                        setLoadingHistory(false)
                                      }
                                    }}
                                  >
                                    <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/>
                                  </svg>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <svg className="w-4 h-4 text-slate-400 hover:text-slate-600 cursor-pointer" fill="currentColor" viewBox="0 0 24 24" title="View Details">
                                  <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                                </svg>
                              </div>
                            </td>
                          </tr>
                        )
                      })()}

                      {/* Module Rows */}
                      {participant.has_modules && expandedParticipants.has(participant.id) && participant.modules?.map((module, moduleIdx) => {
                        const moduleKey = `${participant.id}-${moduleIdx}`
                        const isModuleExpanded = expandedModules.has(moduleKey)
                        const moduleSubmodules = module.submodules || []
                        const moduleDates = getModuleDates(module, participant.id, moduleIdx, submoduleChanges)
                        const moduleProgress = getModuleProgress(module, participant.id, moduleIdx, submoduleChanges)
                        const moduleChangeCount = getModuleChangeCount(module, participant.id, moduleIdx, submoduleChanges)
                        const moduleStatus = getModuleStatus(module, participant.id, moduleIdx, submoduleChanges)
                        
                        return (
                          <React.Fragment key={`${participant.id}-module-${moduleIdx}`}>
                            {/* Module Row */}
                            <tr 
                              className={`bg-slate-50 hover:bg-slate-100 transition-colors ${moduleSubmodules.length > 0 ? 'cursor-pointer' : ''}`}
                              onClick={() => moduleSubmodules.length > 0 && toggleModuleSubmodules(participant.id, moduleIdx)}
                            >
                              <td className="px-4 py-2 pl-12">
                                <div className="flex items-center gap-2 text-xs text-slate-700">
                                  {moduleSubmodules.length > 0 && (
                                    <svg 
                                      className={`w-4 h-4 text-slate-400 transition-transform ${isModuleExpanded ? 'rotate-90' : ''}`}
                                      fill="currentColor" 
                                      viewBox="0 0 24 24"
                                    >
                                      <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
                                    </svg>
                                  )}
                                  <span className="font-medium">{module.name}</span>
                                </div>
                              </td>
                              <td className="px-4 py-2">
                                <span className="text-xs text-slate-600">
                                  {moduleDates.startDate ? formatDateForDisplay(moduleDates.startDate) : '-'}
                                </span>
                              </td>
                              <td className="px-4 py-2">
                                <span className="text-xs text-slate-600">
                                  {moduleDates.endDate ? formatDateForDisplay(moduleDates.endDate) : '-'}
                                </span>
                              </td>
                              <td className="px-4 py-2">
                                <div className="flex flex-col items-center gap-1">
                                  <div className="text-xs text-slate-700 font-medium">
                                    {moduleProgress}%
                                  </div>
                                  <div className="w-36 h-2 border border-slate-300 rounded relative bg-slate-100 transition-all duration-300">
                                    <div 
                                      className="h-full bg-green-600 rounded transition-all duration-300"
                                      style={{ width: `${moduleProgress}%` }}
                                    >
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-2">
                                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getStatusBadgeClass(moduleStatus)}`}>
                                  {moduleStatus}
                                </span>
                              </td>
                              <td className="px-4 py-2">
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-0.5 text-xs font-semibold rounded border ${getChangeBadgeClass(moduleChangeCount)}`}>
                                    {moduleChangeCount || 0}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-2">
                                <div className="flex items-center gap-3">
                                  <svg 
                                    className="w-4 h-4 text-slate-400 hover:text-slate-600 cursor-pointer" 
                                    fill="currentColor" 
                                    viewBox="0 0 24 24" 
                                    title="View Details"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      // TODO: Implement view details functionality
                                    }}
                                  >
                                    <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                                  </svg>
                                </div>
                              </td>
                            </tr>
                            
                            {/* Submodule Rows */}
                            {isModuleExpanded && moduleSubmodules.map((submodule, subIdx) => {
                              const submoduleKey = `${participant.id}-${moduleIdx}-${subIdx}`
                              const isSubmoduleEditing = editingSubmodule === submoduleKey
                              const safeSubmoduleChanges = submoduleChanges || {}
                              const submoduleChangesData = safeSubmoduleChanges[submoduleKey] || {}
                              // Use changed dates if they exist, otherwise use original dates from database
                              const displayStartDate = submoduleChangesData.startDate !== undefined 
                                ? submoduleChangesData.startDate 
                                : (submodule.startDate || '')
                              const displayEndDate = submoduleChangesData.endDate !== undefined
                                ? submoduleChangesData.endDate
                                : (submodule.endDate || '')
                              const displayProgress = submoduleChangesData.progress !== undefined ? submoduleChangesData.progress : (submodule.progress || 0)
                              // Status is derived from progress (source of truth)
                              const displayStatus = getStatusFromProgress(displayProgress)
                              // Get change_count from changes state, or from database if available
                              const changeCount = submoduleChangesData.change_count !== undefined
                                ? submoduleChangesData.change_count
                                : (submodule.change_count || 0)
                              
                              return (
                                <tr 
                                  key={`${participant.id}-module-${moduleIdx}-sub-${subIdx}`} 
                                  className={`bg-slate-50/50 ${isSubmoduleEditing ? 'bg-yellow-50' : ''}`}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <td className="px-4 py-2 pl-20">
                                    <div className="flex items-center gap-2 text-xs text-slate-600">
                                      <span>{submodule.name}</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2">
                                    {isSubmoduleEditing ? (
                                      <DateInput
                                        value={displayStartDate || ''}
                                        onChange={(dateValue) => {
                                          handleUpdateSubmoduleField(participant.id, moduleIdx, subIdx, 'startDate', dateValue)
                                        }}
                                        className="input-field text-xs py-1 w-full"
                                        placeholder="dd-mm-yyyy"
                                      />
                                    ) : (
                                      <span className="text-xs text-slate-600">
                                        {displayStartDate ? formatDateForDisplay(displayStartDate) : '-'}
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-2">
                                    {isSubmoduleEditing ? (
                                      <DateInput
                                        value={displayEndDate || ''}
                                        onChange={(dateValue) => {
                                          handleUpdateSubmoduleField(participant.id, moduleIdx, subIdx, 'endDate', dateValue)
                                        }}
                                        className="input-field text-xs py-1 w-full"
                                        placeholder="dd-mm-yyyy"
                                      />
                                    ) : (
                                      <span className="text-xs text-slate-600">
                                        {displayEndDate ? formatDateForDisplay(displayEndDate) : '-'}
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-2">
                                    {isSubmoduleEditing ? (
                                      <select
                                        value={displayProgress}
                                        onChange={(e) => {
                                          e.stopPropagation()
                                          handleUpdateSubmoduleField(participant.id, moduleIdx, subIdx, 'progress', parseInt(e.target.value))
                                        }}
                                        className="input-field text-xs py-1 w-full"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(val => (
                                          <option key={val} value={val}>{val}%</option>
                                        ))}
                                      </select>
                                    ) : (
                                      <div className="flex flex-col items-center gap-1">
                                        <div className="text-xs text-slate-700 font-medium">
                                          {displayProgress}%
                                        </div>
                                        <div className="w-36 h-2 border border-slate-300 rounded relative bg-slate-100">
                                          <div 
                                            className="h-full bg-green-400 rounded"
                                            style={{ width: `${displayProgress}%` }}
                                          >
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-4 py-2">
                                    {/* Status is derived from progress - not editable */}
                                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getStatusBadgeClass(displayStatus)}`}>
                                      {displayStatus}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2">
                                    <div className="flex items-center gap-2">
                                      <span className={`px-2 py-0.5 text-xs font-semibold rounded border ${getChangeBadgeClass(changeCount)}`}>
                                        {changeCount || 0}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2">
                                    {isSubmoduleEditing ? (
                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={async (e) => {
                                            e.stopPropagation()
                                            await handleSaveSubmodule(participant.id, moduleIdx, subIdx)
                                          }}
                                          disabled={savingSubmodule === submoduleKey}
                                          className="px-2 py-1 text-xs border border-green-300 text-green-600 rounded hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                        >
                                          {savingSubmodule === submoduleKey ? (
                                            <>
                                              <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                              </svg>
                                              <span>Saving...</span>
                                            </>
                                          ) : (
                                            'Save'
                                          )}
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            handleCancelSubmoduleEdit(participant.id, moduleIdx, subIdx)
                                          }}
                                          className="px-2 py-1 text-xs border border-red-300 text-red-600 rounded hover:bg-red-50 transition-colors"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    ) : (
                                      canEditParticipant(participant.employee_id) ? (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            handleEditSubmodule(participant.id, moduleIdx, subIdx)
                                          }}
                                          className="text-slate-400 hover:text-slate-600 cursor-pointer"
                                          title="Edit Submodule"
                                        >
                                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                                          </svg>
                                        </button>
                                      ) : (
                                        <svg 
                                          className="w-4 h-4 text-slate-400 hover:text-slate-600 cursor-pointer" 
                                          fill="currentColor" 
                                          viewBox="0 0 24 24" 
                                          title="View Details"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            // TODO: Implement view details functionality
                                          }}
                                        >
                                          <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                                        </svg>
                                      )
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                          </React.Fragment>
                        )
                      })}
                    </React.Fragment>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="px-4 py-8 text-center text-sm text-slate-500 italic">
                      No participants found. Click "Add Participant" to enroll someone in this program.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="border-t border-slate-200 px-4 py-3 bg-slate-50 flex justify-between items-center">
          </div>
        </div>
      </div>

      {/* Date History Modal */}
      <DateHistoryTracker
        isOpen={showHistoryModal}
        onClose={() => {
          setShowHistoryModal(false)
          setSelectedParticipantForHistory(null)
          setFetchedHistory([])
          setLoadingHistory(false)
        }}
        participant={selectedParticipantForHistory}
        history={fetchedHistory}
        loading={loadingHistory}
      />
    </>
  )
}

export default LearningAndTraining

