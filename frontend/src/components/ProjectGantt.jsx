import React, { useEffect, useRef, useState } from 'react'
import { getCookie } from '../utils/helpers.js'
import { TOKEN, getApiBaseUrl } from '../utils/constants.js'
import SearchableDropdown from './SearchableDropdown.jsx'
import EditableCell from './EditableCell.jsx'
import ResourceAssignmentModal from './ResourceAssignmentModal.jsx'
import { useEmployees } from '../context/EmployeeContext.jsx'
import Gantt from 'frappe-gantt'
import 'frappe-gantt/dist/frappe-gantt.css'

const ProjectGantt = ({ projectId, project }) => {
  const [ganttData, setGanttData] = useState([])
  const [aiPlan, setAiPlan] = useState(null)
  const [loading, setLoading] = useState(false)
  const [aiGenerating, setAiGenerating] = useState(false)
  const [error, setError] = useState(null)
  const [selectedRow, setSelectedRow] = useState(null)
  const [hoveredRow, setHoveredRow] = useState(null)
  const [viewMode, setViewMode] = useState('detailed') // 'detailed' or 'high-level'
  const [aiPlanStatus, setAiPlanStatus] = useState('not_started') // 'not_started', 'in_progress', 'completed'
  const [showRegenerateModal, setShowRegenerateModal] = useState(false)
  const [regenerateFeedback, setRegenerateFeedback] = useState('')
  const [isEditMode, setIsEditMode] = useState(false) // Edit mode for making changes without saving to DB
  const [isSaving, setIsSaving] = useState(false) // Loading state for save button
  const [showAddModal, setShowAddModal] = useState(false)
  const [addType, setAddType] = useState(null) // 'milestone', 'task', 'subtask'
  const [addParentIdx, setAddParentIdx] = useState(null)
  const [addParentTIdx, setAddParentTIdx] = useState(null)
  const [addFormData, setAddFormData] = useState({
    title: '',
    start_date: '',
    end_date: '',
    priority: 'Medium',
    completion: 0,
    assigned_employee_id: ''
  })
  const [showResourceModal, setShowResourceModal] = useState(false)
  const [detectedRoles, setDetectedRoles] = useState([])
  const [headerLabels, setHeaderLabels] = useState({
    milestoneTask: 'Milestone / Task',
    assignedTo: 'Assigned to',
    priority: 'Priority',
    startDate: 'Start Date',
    endDate: 'End Date',
    duration: 'Duration',
    completion: 'Completion %',
    actions: 'Actions'
  })
  const { getAllEmployees, loading: employeesLoading } = useEmployees()
  const employeeOptions = getAllEmployees().map(emp => ({
    id: emp.id,
    name: `${emp.first_name || emp.firstName} ${emp.last_name || emp.lastName}`
  }))
  const svgRef = useRef(null)
  const ganttInstance = useRef(null)
  const tableRef = useRef(null)
  const chartRef = useRef(null)
  const isUpdatingFromChart = useRef(false) // Flag to prevent re-initialization loops
  const milestoneRowHeight = 33 // Same height for all rows now that we have horizontal scrolling
  const lastGanttDataRef = useRef(null) // Track previous ganttData to detect structural changes
  const lastViewModeRef = useRef(viewMode) // Track previous viewMode to detect changes
  const colorTimeoutRef = useRef(null) // Track color application timeout
  const colorApplicationInProgress = useRef(false) // Flag to prevent concurrent color applications
  const barEventListenersRef = useRef([]) // Track event listeners for cleanup
  // Helper to add days to date
  const addDays = (dateStr, days) => {
    if (!dateStr) return null
    try {
      const dt = new Date(dateStr)
      dt.setDate(dt.getDate() + Number(days || 0))
      return dt.toISOString().split('T')[0]
    } catch (e) {
      return null
    }
  }

  // Helper to calculate duration in days
  const calculateDuration = (startDate, endDate) => {
    if (!startDate || !endDate) return null;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
    return Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
  };

  // Helper to validate and adjust dates within project boundaries
  const validateAndAdjustDates = (item, projectStartDate, projectEndDate, parentStartDate = null, parentEndDate = null) => {
    let { start_date, end_date } = item;

    // Convert to Date objects for comparison
    let currentStart = start_date ? new Date(start_date) : null;
    let currentEnd = end_date ? new Date(end_date) : null;
    const projectStart = projectStartDate ? new Date(projectStartDate) : null;
    const projectEnd = projectEndDate ? new Date(projectEndDate) : null;
    const parentStart = parentStartDate ? new Date(parentStartDate) : null;
    const parentEnd = parentEndDate ? new Date(parentEndDate) : null;

    // Rule: subtask.start_date and subtask.end_date must lie within project.start_date and project.end_date
    // Rule: milestone, task, and subtask end dates must not exceed project.end_date
    // Automatically adjust invalid dates to fit within project boundaries

    // If missing dates, default to project boundaries so items render
    if (!currentStart && projectStart) {
      currentStart = projectStart;
    }
    if (!currentEnd && projectEnd) {
      currentEnd = projectEnd;
    }

    // Adjust start date if it's before project start or parent start
    if (projectStart && currentStart && currentStart < projectStart) {
      currentStart = projectStart;
    }
    if (parentStart && currentStart && currentStart < parentStart) {
      currentStart = parentStart;
    }

    // Adjust end date if it's after project end or parent end
    if (projectEnd && currentEnd && currentEnd > projectEnd) {
      currentEnd = projectEnd;
    }
    if (parentEnd && currentEnd && currentEnd > parentEnd) {
      currentEnd = parentEnd;
    }

    // Ensure end date is not before start date
    if (currentStart && currentEnd && currentEnd < currentStart) {
      currentEnd = currentStart;
    }

    // Convert back to ISO string
    item.start_date = currentStart ? currentStart.toISOString().split('T')[0] : null;
    item.end_date = currentEnd ? currentEnd.toISOString().split('T')[0] : null;
    item.duration_days = calculateDuration(item.start_date, item.end_date);

    return item;
    return item;
  };

  // Analyze plan for roles and trigger modal if needed
  const analyzeResources = (plan) => {
    if (!plan || !plan.milestones) return;

    const roles = new Set();

    plan.milestones.forEach(ms => {
      ms.tasks.forEach(task => {
        if (task.assigned_role && !task.assigned_to) {
          roles.add(task.assigned_role);
        }
        if (task.subtasks) {
          task.subtasks.forEach(st => {
            if (st.assigned_role && !st.assigned_to) {
              roles.add(st.assigned_role);
            }
          });
        }
      });
    });

    if (roles.size > 0) {
      setDetectedRoles(Array.from(roles));
      setShowResourceModal(true);
    }
  };

  const handleResourceAssignment = (assignments) => {
    if (!aiPlan) return;

    const updatedPlan = { ...aiPlan };

    updatedPlan.milestones = updatedPlan.milestones.map(ms => ({
      ...ms,
      tasks: ms.tasks.map(task => {
        const updatedTask = { ...task };

        // Update task assignment if role matches
        if (updatedTask.assigned_role && assignments[updatedTask.assigned_role]) {
          const rawId = assignments[updatedTask.assigned_role];
          // Find employee using string comparison to handle HTML select stringification
          const emp = employeeOptions.find(e => String(e.id) === String(rawId));

          if (emp) {
            updatedTask.assigned_employee_id = emp.id; // Use the correct type from source
            updatedTask.assigned_to = emp.name;
          }
        }

        // Update subtasks
        if (updatedTask.subtasks) {
          updatedTask.subtasks = updatedTask.subtasks.map(st => {
            const updatedSt = { ...st };
            if (updatedSt.assigned_role && assignments[updatedSt.assigned_role]) {
              const rawId = assignments[updatedSt.assigned_role];
              // Find employee using string comparison
              const emp = employeeOptions.find(e => String(e.id) === String(rawId));

              if (emp) {
                updatedSt.assigned_employee_id = emp.id; // Use the correct type from source
                updatedSt.assigned_to = emp.name;
              }
            }
            return updatedSt;
          });
        }

        return updatedTask;
      })
    }));

    setAiPlan(updatedPlan);
    setGanttData(convertAiPlanToGantt(updatedPlan, project));

    try {
      const token = getCookie(TOKEN);
      fetch(`${getApiBaseUrl()}/api/gantt/save-ai-plan/${projectId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ai_plan: updatedPlan })
      }).then(res => res.json()).then(data => {
        if (data.success) {
          console.log('✅ Assignments saved successfully');
        } else {
          console.error('❌ Failed to save assignments:', data.error);
        }
      });
    } catch (e) {
      console.error('❌ Error saving assignments:', e);
    }

    setShowResourceModal(false);
  };

  // Convert AI Plan to Gantt Data
  const convertAiPlanToGantt = (aiPlan, project) => {
    const ganttData = [{
      id: `project_${project.id}`,
      text: project.name,
      start_date: project.start_date,
      end_date: project.end_date,
      progress: 0,
      completion_percentage: 0,
      type: 'project',
      open: true,
      parent: 0
    }]
    if (!aiPlan || !aiPlan.milestones) return ganttData
    let itemCounter = 1
    aiPlan.milestones.forEach((ms, msIdx) => {
      const msId = `milestone_${ms.id || msIdx + 1}`
      let msStart = null, msEnd = null
      ms.tasks.forEach(t => {
        if (t.start_date && (!msStart || t.start_date < msStart)) msStart = t.start_date
        if (t.end_date && (!msEnd || t.end_date > msEnd)) msEnd = t.end_date
      })
      ganttData.push({
        id: msId,
        text: ms.title,
        start_date: ms.start_date || msStart,
        end_date: ms.end_date || msEnd,
        progress: (ms.completion || 0) / 100,
        completion_percentage: ms.completion || 0,
        type: 'milestone',
        parent: `project_${project.id}`
      })
      ms.tasks.forEach((t) => {
        const tId = `ai_task_${itemCounter++}`
        ganttData.push({
          id: tId,
          text: t.title,
          start_date: t.start_date,
          end_date: t.end_date,
          progress: (t.completion || 0) / 100,
          completion_percentage: t.completion || 0,
          type: 'task',
          parent: msId,
          assigned_to: t.assigned_to || ''
        })
        t.subtasks.forEach(st => {
          const stId = `ai_subtask_${itemCounter++}`
          ganttData.push({
            id: stId,
            text: st.title,
            start_date: st.start_date,
            end_date: st.end_date,
            progress: (st.completion || 0) / 100,
            completion_percentage: st.completion || 0,
            type: 'task',
            parent: tId,
            assigned_to: st.assigned_to || ''
          })
        })
      })
    })

    // No date adjustment needed - bars are positioned relative to project.start_date

    return ganttData
  }

  // Change bar colors to golden brown with green progress indicator
  // Optimized to reduce DOM queries and improve performance
  const applyGoldenBrownColors = (resetColors = false, tasksArray = null) => {
    if (!svgRef.current || colorApplicationInProgress.current) return

    // Batch DOM reads and writes for better performance
    const bars = svgRef.current.querySelectorAll('.bar')
    if (bars.length === 0) return

    const goldenBrown = 'rgb(212, 175, 55)' // Golden brown color for main bar (#D4AF37)
    const goldenBrownHex = '#D4AF37' // Hex version for attributes
    const goldenBrownDark = '#B8941F' // Darker shade for stroke
    const greenProgress = 'rgb(22, 101, 52)' // Green for completed portion (#166534)
    const greenProgressHex = '#166534' // Hex version for attributes

    // Create maps for faster lookup - by ID, by name, and by index
    const progressMapById = new Map()
    const progressMapByName = new Map()
    if (ganttData.length > 0) {
      ganttData.forEach(item => {
        // Get progress value - prefer completion_percentage, then progress
        let progress = 0
        if (item.completion_percentage !== undefined && item.completion_percentage !== null) {
          progress = item.completion_percentage // Already in 0-100 format
        } else if (item.progress !== undefined && item.progress !== null) {
          progress = item.progress
          // If progress is between 0-1, convert to percentage
          if (progress <= 1) {
            progress = progress * 100
          }
        }

        // Map by ID for most reliable matching
        if (item.id) {
          progressMapById.set(item.id, progress)
        }
        // Also map by name as fallback
        if (item.text) {
          progressMapByName.set(item.text, progress)
        }
      })
    }

    // Also create a map from tasks array if provided (for index-based matching)
    const progressMapByIndex = new Map()
    if (tasksArray && tasksArray.length > 0) {
      tasksArray.forEach((task, index) => {
        // Try to find matching ganttData item by task ID
        const matchingItem = ganttData.find(item => item.id === task.id)
        if (matchingItem) {
          let progress = 0
          if (matchingItem.completion_percentage !== undefined && matchingItem.completion_percentage !== null) {
            progress = matchingItem.completion_percentage
          } else if (matchingItem.progress !== undefined && matchingItem.progress !== null) {
            progress = matchingItem.progress
            if (progress <= 1) {
              progress = progress * 100
            }
          }
          progressMapByIndex.set(index, progress)
        } else if (task.progress !== undefined) {
          // Fallback to task's own progress value
          progressMapByIndex.set(index, task.progress > 1 ? task.progress : task.progress * 100)
        }
      })
    }

    // Batch DOM updates using DocumentFragment for better performance
    const updates = []

    // Apply colors to all bars (works for both detailed and high-level view)
    bars.forEach(bar => {
      if (!bar) return

      // Reset to default golden brown color (rgb(212, 175, 55))
      updates.push(() => {
        bar.style.fill = goldenBrown
        bar.style.stroke = goldenBrownDark
        bar.setAttribute('fill', goldenBrownHex)
        bar.setAttribute('stroke', goldenBrownDark)
        // Force override any inline styles that might have been set by frappe-gantt
        bar.style.setProperty('fill', goldenBrown, 'important')
        if (resetColors) {
          bar.removeAttribute('data-custom-color')
          bar.classList.remove('custom-colored')
        }
      })

      // Find progress bar more efficiently
      const barWrapper = bar.closest('.bar-wrapper') || bar.parentElement
      if (!barWrapper) return

      // Get progress value using multiple matching strategies
      let progressValue = 0
      const barIndex = Array.from(bars).indexOf(bar)

      if (tasksArray && barIndex >= 0 && barIndex < tasksArray.length) {
        if (progressMapByIndex.has(barIndex)) {
          progressValue = progressMapByIndex.get(barIndex)
        } else {
          // Fallback: get from task itself
          const task = tasksArray[barIndex]
          if (task && task.progress !== undefined) {
            progressValue = task.progress > 1 ? task.progress : task.progress * 100
          }
        }
      }

      if (progressValue === 0) {
        const barId = barWrapper.getAttribute('data-task-id') ||
          bar.getAttribute('data-id') ||
          barWrapper.querySelector('[data-task-id]')?.getAttribute('data-task-id')
        if (barId && progressMapById.has(barId)) {
          progressValue = progressMapById.get(barId)
        }
      }

      if (progressValue === 0) {
        const label = barWrapper.querySelector('.bar-label')
        if (label) {
          const labelText = label.textContent?.trim() || ''
          // Try exact match first
          if (progressMapByName.has(labelText)) {
            progressValue = progressMapByName.get(labelText)
          } else {
            // Fallback to partial match
            for (const [text, progress] of progressMapByName.entries()) {
              if (labelText.includes(text) || text.includes(labelText)) {
                progressValue = progress
                break
              }
            }
          }
        }
      }

      // Convert progress to decimal if it's a percentage
      if (progressValue > 1) {
        progressValue = progressValue / 100
      }

      // Try to find progress bar with minimal queries
      let barProgress = barWrapper.querySelector('.bar-progress')
      if (!barProgress) {
        // Fallback: look for rect with similar x position (frappe-gantt might use different class)
        const barX = parseFloat(bar.getAttribute('x') || 0)
        const allRects = barWrapper.querySelectorAll('rect')
        for (let i = 0; i < allRects.length; i++) {
          const rect = allRects[i]
          if (rect !== bar && rect.getAttribute('class') !== 'bar') {
            const rectX = parseFloat(rect.getAttribute('x') || 0)
            // Check if this rect is at the same position as the bar (likely a progress bar)
            if (Math.abs(rectX - barX) < 1) {
              barProgress = rect
              break
            }
          }
        }
      }

      // If still no progress bar found and we have progress, create one
      if (!barProgress && progressValue > 0) {
        try {
          const barRect = bar.getBBox()
          const barX = parseFloat(bar.getAttribute('x') || barRect.x)
          const barY = parseFloat(bar.getAttribute('y') || barRect.y)
          const barWidth = parseFloat(bar.getAttribute('width') || barRect.width)
          const barHeight = parseFloat(bar.getAttribute('height') || barRect.height)

          // Calculate progress width
          const progressWidth = Math.max(0, Math.min(barWidth, barWidth * progressValue))

          // Create progress bar element
          barProgress = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
          barProgress.setAttribute('class', 'bar-progress')
          barProgress.setAttribute('x', barX.toString())
          barProgress.setAttribute('y', barY.toString())
          barProgress.setAttribute('width', progressWidth.toString())
          barProgress.setAttribute('height', barHeight.toString())
          barProgress.setAttribute('rx', '3') // Match bar corner radius
          barProgress.setAttribute('ry', '3')
          barProgress.setAttribute('fill', greenProgressHex)
          barProgress.style.fill = greenProgress
          barProgress.style.setProperty('fill', greenProgress, 'important')
          barProgress.style.pointerEvents = 'none'

          // Insert before the bar so it appears behind it
          if (bar.parentNode) {
            bar.parentNode.insertBefore(barProgress, bar)
          } else if (barWrapper) {
            barWrapper.insertBefore(barProgress, barWrapper.firstChild)
          }
        } catch (e) {
          console.warn('Could not create progress bar:', e)
        }
      }

      if (barProgress && barProgress !== bar) {

        // Batch progress bar updates
        updates.push(() => {
          try {
            const barRect = bar.getBBox()
            const barWidth = barRect.width
            // progressValue is already in decimal format (0-1), so multiply by barWidth
            const progressWidth = Math.max(0, Math.min(barWidth, barWidth * progressValue))

            // Only update if progress is greater than 0
            if (progressValue > 0 && progressWidth > 0) {
              barProgress.setAttribute('width', progressWidth.toString())
              barProgress.setAttribute('x', barRect.x.toString())
              barProgress.setAttribute('y', barRect.y.toString())
              barProgress.setAttribute('height', barRect.height.toString())

              // Ensure progress bar is visible
              barProgress.style.display = 'block'
              barProgress.style.visibility = 'visible'
              barProgress.style.opacity = '1'
              barProgress.style.pointerEvents = 'none' // Don't interfere with bar interactions
            } else {
              // Hide progress bar if no progress
              barProgress.setAttribute('width', '0')
              barProgress.style.display = 'none'
            }
          } catch (e) {
            // Fallback if getBBox fails
            try {
              const barWidth = parseFloat(bar.getAttribute('width') || '0')
              if (barWidth > 0 && progressValue > 0) {
                const progressWidth = Math.max(0, Math.min(barWidth, barWidth * progressValue))
                const barX = parseFloat(bar.getAttribute('x') || '0')
                barProgress.setAttribute('width', progressWidth.toString())
                barProgress.setAttribute('x', barX.toString())
                barProgress.setAttribute('y', bar.getAttribute('y') || '0')
                barProgress.setAttribute('height', bar.getAttribute('height') || '20')
                barProgress.style.display = 'block'
                barProgress.style.visibility = 'visible'
              } else {
                barProgress.setAttribute('width', '0')
                barProgress.style.display = 'none'
              }
            } catch (err) {
              // Ignore errors
            }
          }

          // Set progress bar color to green (rgb(22, 101, 52))
          if (progressValue > 0) {
            barProgress.style.fill = greenProgress
            barProgress.setAttribute('fill', greenProgressHex)
            // Force override any inline styles
            barProgress.style.setProperty('fill', greenProgress, 'important')
          }

          if (resetColors) {
            barProgress.removeAttribute('data-custom-color')
            barProgress.classList.remove('custom-colored')
          }
        })
      }
    })

    // Execute all updates in a single batch
    updates.forEach(update => {
      try {
        update()
      } catch (e) {
        console.warn('Error applying color update:', e)
      }
    })
  }

  // Update AI Plan and Gantt Data
  const updateAiPlan = (updatedPlan) => {
    setAiPlan(updatedPlan)
    const newGanttData = convertAiPlanToGantt(updatedPlan, project)

    // Check if this is just a completion update (no structural changes)
    const lastData = lastGanttDataRef.current
    const isCompletionOnlyUpdate = lastData &&
      lastData.length === newGanttData.length &&
      newGanttData.every((item, idx) => {
        const lastItem = lastData[idx]
        return lastItem &&
          lastItem.id === item.id &&
          lastItem.start_date === item.start_date &&
          lastItem.end_date === item.end_date &&
          lastItem.text === item.text
      })

    // For completion-only updates, update progress bars immediately without re-initializing
    if (isCompletionOnlyUpdate && ganttInstance.current && svgRef.current && !isUpdatingFromChart.current) {
      // Immediate update for completion changes
      updateProgressBarsInChart(newGanttData)
      applyGoldenBrownColors(false, newGanttData)
    } else if (ganttInstance.current && svgRef.current && !isUpdatingFromChart.current) {
      // For structural changes, use requestAnimationFrame for better performance
      requestAnimationFrame(() => {
        updateProgressBarsInChart(newGanttData)
        // Also reapply colors after updating progress
        setTimeout(() => {
          applyGoldenBrownColors()
        }, 50)
      })
    }

    // Store current data for next comparison
    lastGanttDataRef.current = newGanttData

    // Set ganttData after updating progress bars to minimize re-renders
    setGanttData(newGanttData)
  }

  // Update progress bars in the chart without re-initializing
  // Optimized to reduce DOM queries and improve performance
  const updateProgressBarsInChart = (ganttDataArray) => {
    if (!svgRef.current || !ganttInstance.current || colorApplicationInProgress.current) return

    try {
      // Get all bar wrappers once (more efficient)
      const barWrappers = svgRef.current.querySelectorAll('.bar-wrapper')
      if (barWrappers.length === 0) return

      // Create a map for faster lookup (O(1) instead of O(n) for each lookup)
      const dataMap = new Map()
      ganttDataArray.forEach(item => {
        if (item.start_date && item.end_date && item.type !== 'project' && item.text) {
          // Get progress value - prefer completion_percentage, then progress
          let progress = 0
          if (item.completion_percentage !== undefined && item.completion_percentage !== null) {
            progress = item.completion_percentage / 100 // Convert to decimal
          } else if (item.progress !== undefined && item.progress !== null) {
            progress = item.progress
            // If progress is greater than 1, assume it's a percentage and convert
            if (progress > 1) {
              progress = progress / 100
            }
          }
          dataMap.set(item.text, progress) // Store as decimal (0-1)
        }
      })

      if (dataMap.size === 0) return

      const greenProgress = 'rgb(22, 101, 52)' // Green for completed portion
      const greenProgressHex = '#166534' // Hex version

      // Batch DOM updates
      const updates = []

      // Update progress bars
      barWrappers.forEach(barWrapper => {
        const bar = barWrapper.querySelector('.bar')
        if (!bar) return

        let barProgress = barWrapper.querySelector('.bar-progress')

        // Get task name from label
        const label = barWrapper.querySelector('.bar-label')
        const labelText = label?.textContent?.trim() || ''

        if (!labelText) return

        // Find matching item (try exact match first, then partial)
        let progress = 0
        if (dataMap.has(labelText)) {
          progress = dataMap.get(labelText)
        } else {
          // Fallback to partial match (only if exact match fails)
          for (const [text, prog] of dataMap.entries()) {
            if (labelText.includes(text) || text.includes(labelText)) {
              progress = prog
              break
            }
          }
        }

        // Create progress bar if it doesn't exist and we have progress
        if (!barProgress && progress > 0) {
          try {
            const barRect = bar.getBBox()
            const barX = parseFloat(bar.getAttribute('x') || barRect.x)
            const barY = parseFloat(bar.getAttribute('y') || barRect.y)
            const barWidth = parseFloat(bar.getAttribute('width') || barRect.width)
            const barHeight = parseFloat(bar.getAttribute('height') || barRect.height)
            const progressWidth = Math.max(0, Math.min(barWidth, barWidth * progress))

            barProgress = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
            barProgress.setAttribute('class', 'bar-progress')
            barProgress.setAttribute('x', barX.toString())
            barProgress.setAttribute('y', barY.toString())
            barProgress.setAttribute('width', progressWidth.toString())
            barProgress.setAttribute('height', barHeight.toString())
            barProgress.setAttribute('rx', '3')
            barProgress.setAttribute('ry', '3')
            barProgress.setAttribute('fill', greenProgressHex)
            barProgress.style.fill = greenProgress
            barProgress.style.setProperty('fill', greenProgress, 'important')
            barProgress.style.pointerEvents = 'none'

            if (bar.parentNode) {
              bar.parentNode.insertBefore(barProgress, bar)
            } else if (barWrapper) {
              barWrapper.insertBefore(barProgress, barWrapper.firstChild)
            }
          } catch (e) {
            console.warn('Could not create progress bar:', e)
            return
          }
        }

        if (!barProgress) return

        // Batch the update
        updates.push(() => {
          try {
            // Get bar dimensions
            const barRect = bar.getBBox()
            const barWidth = barRect.width
            // progress is in decimal format (0-1)
            const progressWidth = Math.max(0, Math.min(barWidth, barWidth * progress))

            // Only update if progress is greater than 0
            if (progress > 0 && progressWidth > 0) {
              // Update progress bar attributes with green color
              barProgress.setAttribute('width', progressWidth.toString())
              barProgress.setAttribute('fill', greenProgressHex)
              barProgress.setAttribute('x', barRect.x.toString())
              barProgress.setAttribute('y', barRect.y.toString())
              barProgress.setAttribute('height', barRect.height.toString())
              barProgress.style.fill = greenProgress
              barProgress.style.setProperty('fill', greenProgress, 'important')
              barProgress.style.display = 'block'
              barProgress.style.visibility = 'visible'
              barProgress.style.opacity = '1'
              barProgress.style.pointerEvents = 'none'
            } else {
              // Hide progress bar if no progress
              barProgress.setAttribute('width', '0')
              barProgress.style.display = 'none'
            }
          } catch (e) {
            // Fallback: use attributes if getBBox fails
            try {
              const barWidth = parseFloat(bar.getAttribute('width') || '0')
              if (barWidth > 0 && progress > 0) {
                const progressWidth = Math.max(0, Math.min(barWidth, barWidth * progress))
                const barX = parseFloat(bar.getAttribute('x') || '0')
                barProgress.setAttribute('width', progressWidth.toString())
                barProgress.setAttribute('fill', greenProgressHex)
                barProgress.setAttribute('x', barX.toString())
                barProgress.setAttribute('y', bar.getAttribute('y') || '0')
                barProgress.setAttribute('height', bar.getAttribute('height') || '20')
                barProgress.style.fill = greenProgress
                barProgress.style.setProperty('fill', greenProgress, 'important')
                barProgress.style.display = 'block'
                barProgress.style.visibility = 'visible'
              } else {
                barProgress.setAttribute('width', '0')
                barProgress.style.display = 'none'
              }
            } catch (err) {
              // Silently ignore errors to prevent console spam
            }
          }
        })
      })

      // Execute all updates in a batch
      updates.forEach(update => {
        try {
          update()
        } catch (e) {
          // Silently ignore errors
        }
      })
    } catch (e) {
      console.error('Error updating progress bars:', e)
    }
  }

  // Recursively update parent completions (immutably)
  const updateParentCompletions = (plan) => {
    const updatedMilestones = plan.milestones.map(ms => {
      const updatedTasks = ms.tasks.map(task => {
        let newCompletion = task.completion;
        if (task.subtasks && task.subtasks.length > 0) {
          const sum = task.subtasks.reduce((acc, st) => acc + (st.completion || 0), 0);
          newCompletion = Math.round(sum / task.subtasks.length);
        }
        return { ...task, completion: newCompletion };
      });

      let newMsCompletion = ms.completion;
      if (updatedTasks.length > 0) {
        const sum = updatedTasks.reduce((acc, t) => acc + (t.completion || 0), 0);
        newMsCompletion = Math.round(sum / updatedTasks.length);
      } else {
        newMsCompletion = 0;
      }
      return { ...ms, tasks: updatedTasks, completion: newMsCompletion };
    });
    return { ...plan, milestones: updatedMilestones };
  };

  // Update parent dates based on children (immutably)
  const updateParentDates = (plan) => {
    const projectStartDate = project?.start_date;
    const projectEndDate = project?.end_date;

    const updatedMilestones = plan.milestones.map(ms => {
      const updatedTasks = ms.tasks.map(task => {
        const adjustedSubtasks = (task.subtasks || []).map(st => {
          let adj = { ...st };
          adj = validateAndAdjustDates(adj, projectStartDate, projectEndDate);
          adj.duration_days = calculateDuration(adj.start_date, adj.end_date);
          return adj;
        });

        let minStart = null, maxEnd = null;
        adjustedSubtasks.forEach(st => {
          if (st.start_date && (!minStart || st.start_date < minStart)) minStart = st.start_date;
          if (st.end_date && (!maxEnd || st.end_date > maxEnd)) maxEnd = st.end_date;
        });

        let updatedTask = { ...task, subtasks: adjustedSubtasks };
        if (adjustedSubtasks.length > 0) {
          updatedTask.start_date = minStart;
          updatedTask.end_date = maxEnd;
        }
        updatedTask = validateAndAdjustDates(updatedTask, projectStartDate, projectEndDate);
        updatedTask.duration_days = calculateDuration(updatedTask.start_date, updatedTask.end_date);
        return updatedTask;
      });

      let msMinStart = null, msMaxEnd = null;
      updatedTasks.forEach(t => {
        if (t.start_date && (!msMinStart || t.start_date < msMinStart)) msMinStart = t.start_date;
        if (t.end_date && (!msMaxEnd || t.end_date > msMaxEnd)) msMaxEnd = t.end_date;
      });

      let updatedMilestone = { ...ms, tasks: updatedTasks, start_date: msMinStart, end_date: msMaxEnd };
      updatedMilestone = validateAndAdjustDates(updatedMilestone, projectStartDate, projectEndDate);
      updatedMilestone.duration_days = calculateDuration(updatedMilestone.start_date, updatedMilestone.end_date);
      return updatedMilestone;
    });
    return { ...plan, milestones: updatedMilestones };
  };

  // Create a mapping from Gantt task ID to AI plan structure
  const createTaskIdMapping = (plan) => {
    const mapping = {}
    if (!plan || !plan.milestones) return mapping

    let itemCounter = 1
    plan.milestones.forEach((ms, msIdx) => {
      const msId = `milestone_${ms.id || msIdx + 1}`
      mapping[msId] = { type: 'milestone', msIdx }

      ms.tasks.forEach((t, tIdx) => {
        const tId = `ai_task_${itemCounter++}`
        mapping[tId] = { type: 'task', msIdx, tIdx }

        t.subtasks.forEach((st, sIdx) => {
          const stId = `ai_subtask_${itemCounter++}`
          mapping[stId] = { type: 'subtask', msIdx, tIdx, sIdx }
        })
      })
    })
    return mapping
  }

  // Handle updates from Gantt chart (bar drags, progress changes)
  const handleGanttChartUpdate = (taskId, startDate, endDate, progress) => {
    if (!aiPlan) return

    // Set flag to prevent re-initialization loop
    isUpdatingFromChart.current = true

    const mapping = createTaskIdMapping(aiPlan)
    const taskInfo = mapping[taskId]
    if (!taskInfo) {
      isUpdatingFromChart.current = false
      return
    }

    const updatedPlan = { ...aiPlan }
    let task = null
    let milestone = updatedPlan.milestones[taskInfo.msIdx]

    if (taskInfo.type === 'milestone') {
      task = milestone
    } else if (taskInfo.type === 'task') {
      task = milestone.tasks[taskInfo.tIdx]
    } else if (taskInfo.type === 'subtask') {
      task = milestone.tasks[taskInfo.tIdx].subtasks[taskInfo.sIdx]
    }

    if (!task) {
      isUpdatingFromChart.current = false
      return
    }

    // Update dates
    if (startDate) {
      task.start_date = startDate
    }
    if (endDate) {
      task.end_date = endDate
    }
    if (progress !== undefined) {
      task.completion = Math.round(progress * 100)
    }

    // Recalculate duration
    if (task.start_date && task.end_date) {
      const start = new Date(task.start_date)
      const end = new Date(task.end_date)
      task.duration_days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1
    }

    // Update parent dates and completions
    let newPlan = updateParentDates(updatedPlan)
    newPlan = updateParentCompletions(newPlan)

    // Update state
    setAiPlan(newPlan)
    const newGanttData = convertAiPlanToGantt(newPlan, project)
    setGanttData(newGanttData)

    // Update the chart directly without re-initializing
    if (ganttInstance.current && svgRef.current) {
      try {
        // Find the task in the current chart and update it
        const taskElement = svgRef.current.querySelector(`[data-task-id="${taskId}"]`) ||
          svgRef.current.querySelector(`.bar-wrapper[data-id="${taskId}"]`)

        if (taskElement) {
          // Update progress bar if progress changed
          if (progress !== undefined) {
            const barProgress = taskElement.querySelector('.bar-progress')
            if (barProgress) {
              const bar = taskElement.querySelector('.bar')
              if (bar) {
                const barWidth = parseFloat(bar.getAttribute('width') || bar.getBBox().width)
                const progressWidth = (barWidth * progress)
                barProgress.setAttribute('width', progressWidth)
                barProgress.setAttribute('fill', '#166534') // Green-800
              }
            }
          }
        }
      } catch (e) {
        console.error('Error updating chart directly:', e)
      }
    }

    // Reset flag after a delay
    setTimeout(() => {
      isUpdatingFromChart.current = false
    }, 100)
  }

  // ✅ ---- CRUD Handlers for Milestones, Tasks, Subtasks ----
  const handleAddMilestone = () => {
    setAddType('Milestone');
    setAddParentIdx(null);
    setAddParentTIdx(null);
    setAddFormData({
      title: '',
      start_date: '',
      end_date: '',
      priority: 'Medium',
      completion: 0,
      assigned_employee_id: ''
    });
    setShowAddModal(true);
  };

  const handleAddTask = (msIdx) => {
    setAddType('Task');
    setAddParentIdx(msIdx);
    setAddParentTIdx(null);
    setAddFormData({
      title: '',
      start_date: aiPlan.milestones[msIdx].start_date || '',
      end_date: aiPlan.milestones[msIdx].end_date || '',
      priority: 'Medium',
      completion: 0,
      assigned_employee_id: ''
    });
    setShowAddModal(true);
  };

  const handleAddSubtask = (msIdx, tIdx) => {
    setAddType('Subtask');
    setAddParentIdx(msIdx);
    setAddParentTIdx(tIdx);
    setAddFormData({
      title: '',
      start_date: aiPlan.milestones[msIdx].tasks[tIdx].start_date || '',
      end_date: aiPlan.milestones[msIdx].tasks[tIdx].end_date || '',
      priority: 'Low',
      completion: 0,
      assigned_employee_id: ''
    });
    setShowAddModal(true);
  };

  // Handle Add Modal Submit
  const handleAddSubmit = (e) => {
    e.preventDefault();
    const newId = Date.now(); // Unique ID for new items
    const assignedEmployee = employeeOptions.find(e => String(e.id) === String(addFormData.assigned_employee_id));
    const newItem = {
      id: `${addType.toLowerCase()}_${newId}`,
      title: addFormData.title,
      start_date: addFormData.start_date,
      end_date: addFormData.end_date,
      priority: addFormData.priority,
      completion: addFormData.completion,
      duration_days: calculateDuration(addFormData.start_date, addFormData.end_date),
      assigned_employee_id: assignedEmployee ? assignedEmployee.id : null,
      assigned_to: assignedEmployee ? assignedEmployee.name : '',
    };

    const updatedPlan = { ...aiPlan };
    let validatedItem = { ...newItem };

    if (addType === 'Milestone') {
      validatedItem = validateAndAdjustDates(validatedItem, project?.start_date, project?.end_date);
      updatedPlan.milestones.push({ ...validatedItem, tasks: [] });
    } else if (addType === 'Task') {
      const parentMilestone = updatedPlan.milestones[addParentIdx];
      validatedItem = validateAndAdjustDates(validatedItem, project?.start_date, project?.end_date);
      if (!parentMilestone.tasks) {
        parentMilestone.tasks = [];
      }
      parentMilestone.tasks.push({ ...validatedItem, subtasks: [] });
    } else if (addType === 'Subtask') {
      const parentTask = updatedPlan.milestones[addParentIdx].tasks[addParentTIdx];
      validatedItem = validateAndAdjustDates(validatedItem, project?.start_date, project?.end_date);
      if (!parentTask.subtasks) {
        parentTask.subtasks = [];
      }
      parentTask.subtasks.push(validatedItem);
    }

    let newPlan = updateParentDates(updatedPlan);
    newPlan = updateParentCompletions(newPlan);
    updateAiPlan(newPlan);

    setShowAddModal(false);
    setAddFormData({
      title: '',
      start_date: '',
      end_date: '',
      priority: 'Medium',
      completion: 0
    });
  };

  const handleTitleUpdate = (msIdx, tIdx, sIdx, newTitle) => {
    const updatedMilestones = aiPlan.milestones.map((milestone, mIndex) => {
      if (mIndex === msIdx) {
        const updatedMilestone = { ...milestone };
        if (sIdx !== undefined) {
          // Updating a subtask title
          const updatedTasks = milestone.tasks.map((task, tIndexMap) => {
            if (tIndexMap === tIdx) {
              const updatedSubtasks = task.subtasks.map((subtask, sIndexMap) => {
                if (sIndexMap === sIdx) {
                  return { ...subtask, title: newTitle };
                }
                return subtask;
              });
              return { ...task, subtasks: updatedSubtasks };
            }
            return task;
          });
          updatedMilestone.tasks = updatedTasks;
        } else if (tIdx !== undefined) {
          // Updating a task title
          const updatedTasks = milestone.tasks.map((task, tIndexMap) => {
            if (tIndexMap === tIdx) {
              return { ...task, title: newTitle };
            }
            return task;
          });
          updatedMilestone.tasks = updatedTasks;
        } else {
          // Updating a milestone title
          updatedMilestone.title = newTitle;
        }
        return updatedMilestone;
      }
      return milestone;
    });

    const updatedPlan = { ...aiPlan, milestones: updatedMilestones };
    let newPlan = updateParentDates(updatedPlan);
    newPlan = updateParentCompletions(newPlan);
    updateAiPlan(newPlan);
  };

  const handleDeleteMilestone = (msIdx) => {
    if (!window.confirm('Delete this milestone?')) return;
    const updatedPlan = { ...aiPlan };
    updatedPlan.milestones.splice(msIdx, 1);
    updateAiPlan(updatedPlan);
  };

  const handleDeleteTask = (msIdx, tIdx) => {
    if (!window.confirm('Delete this task?')) return;
    const updatedPlan = { ...aiPlan };
    updatedPlan.milestones[msIdx].tasks.splice(tIdx, 1);
    let newPlan = updateParentDates(updatedPlan);
    newPlan = updateParentCompletions(newPlan);
    updateAiPlan(newPlan);
  };

  const handleDeleteSubtask = (msIdx, tIdx, sIdx) => {
    if (!window.confirm('Delete this subtask?')) return;
    const updatedPlan = { ...aiPlan };
    updatedPlan.milestones[msIdx].tasks[tIdx].subtasks.splice(sIdx, 1);
    let newPlan = updateParentDates(updatedPlan);
    newPlan = updateParentCompletions(newPlan);
    updateAiPlan(newPlan);
  };

  // Handle field updates from table
  const handleFieldUpdate = (msIdx, tIdx, stIdx, field, value) => {
    const updatedMilestones = aiPlan.milestones.map((milestone, mIndex) => {
      if (mIndex === msIdx) {
        const updatedMilestone = { ...milestone };
        const updatedTasks = milestone.tasks.map((task, tIndex) => {
          if (tIndex === tIdx) {
            const updatedTask = { ...task };
            if (stIdx !== undefined) {
              // Updating a subtask
              const updatedSubtasks = task.subtasks.map((subtask, sIndex) => {
                if (sIndex === stIdx) {
                  const updatedSubtask = { ...subtask };
                  if (field === 'priority') {
                    const allowed = ['High', 'Medium', 'Low'];
                    const normalized = typeof value === 'string' ? (value[0]?.toUpperCase() + value.slice(1).toLowerCase()) : value;
                    updatedSubtask.priority = allowed.includes(normalized) ? normalized : updatedSubtask.priority;
                  } else if (field === 'start_date') {
                    updatedSubtask.start_date = value;
                    if (updatedSubtask.end_date && new Date(updatedSubtask.end_date) < new Date(value)) {
                      updatedSubtask.end_date = value;
                    }
                  } else if (field === 'end_date') {
                    updatedSubtask.end_date = value;
                    if (updatedSubtask.start_date && new Date(updatedSubtask.end_date) < new Date(updatedSubtask.start_date)) {
                      updatedSubtask.start_date = updatedSubtask.end_date;
                    }
                  } else if (field === 'completion') {
                    const numValue = Math.max(0, Math.min(100, Number(value) || 0));
                    updatedSubtask.completion = numValue;
                  } else if (field === 'duration_days') {
                    const numValue = Math.max(1, Number(value) || 1);
                    updatedSubtask.duration_days = numValue;
                    if (updatedSubtask.start_date) {
                      const start = new Date(updatedSubtask.start_date);
                      const end = new Date(start);
                      end.setDate(start.getDate() + numValue - 1);
                      const endStr = end.toISOString().split('T')[0];
                      updatedSubtask.end_date = endStr;
                    }
                  }
                  // Apply validation and recalculate duration
                  let validatedSubtask = validateAndAdjustDates(
                    updatedSubtask,
                    project?.start_date,
                    project?.end_date
                  );
                  validatedSubtask.duration_days = calculateDuration(validatedSubtask.start_date, validatedSubtask.end_date);
                  return validatedSubtask;
                }
                return subtask;
              });
              updatedTask.subtasks = updatedSubtasks;
            } else {
              // Updating a task (not a subtask)
              if (field === 'priority') {
                const allowed = ['High', 'Medium', 'Low'];
                const normalized = typeof value === 'string' ? (value[0]?.toUpperCase() + value.slice(1).toLowerCase()) : value;
                updatedTask.priority = allowed.includes(normalized) ? normalized : updatedTask.priority;
              } else if (field === 'start_date') {
                updatedTask.start_date = value;
                if (updatedTask.end_date && new Date(updatedTask.end_date) < new Date(value)) {
                  updatedTask.end_date = value;
                }
              } else if (field === 'end_date') {
                updatedTask.end_date = value;
                if (updatedTask.start_date && new Date(updatedTask.end_date) < new Date(updatedTask.start_date)) {
                  updatedTask.start_date = updatedTask.end_date;
                }
              } else if (field === 'completion') {
                const numValue = Math.max(0, Math.min(100, Number(value) || 0));
                updatedTask.completion = numValue;
              } else if (field === 'duration_days') {
                const numValue = Math.max(1, Number(value) || 1);
                updatedTask.duration_days = numValue;
                if (updatedTask.start_date) {
                  const start = new Date(updatedTask.start_date);
                  const end = new Date(start);
                  end.setDate(start.getDate() + numValue - 1);
                  const endStr = end.toISOString().split('T')[0];
                  updatedTask.end_date = endStr;
                }
              }
            }
            // Apply validation and recalculate duration
            let validatedTask = validateAndAdjustDates(
              updatedTask,
              project?.start_date,
              project?.end_date
            );
            validatedTask.duration_days = calculateDuration(validatedTask.start_date, validatedTask.end_date);
            return validatedTask;
          }
          return task;
        });
        updatedMilestone.tasks = updatedTasks;
        return updatedMilestone;
      }
      return milestone;
    });

    const updatedPlan = { ...aiPlan, milestones: updatedMilestones };

    // Update parent dates and completions after all changes
    let newPlan = updateParentDates(updatedPlan);
    newPlan = updateParentCompletions(newPlan);
    updateAiPlan(newPlan);
  };

  const handleMilestoneFieldUpdate = (msIdx, field, value) => {
    const updatedMilestones = aiPlan.milestones.map((ms, index) => {
      if (index === msIdx) {
        const updatedMilestone = { ...ms };
        if (field === 'priority') {
          const allowed = ['High', 'Medium', 'Low'];
          const normalized = typeof value === 'string' ? (value[0]?.toUpperCase() + value.slice(1).toLowerCase()) : value;
          updatedMilestone.priority = allowed.includes(normalized) ? normalized : updatedMilestone.priority;
        } else if (field === 'start_date') {
          updatedMilestone.start_date = value;
          if (updatedMilestone.end_date && new Date(updatedMilestone.end_date) < new Date(value)) {
            updatedMilestone.end_date = value;
          }
        } else if (field === 'end_date') {
          updatedMilestone.end_date = value;
          if (updatedMilestone.start_date && new Date(updatedMilestone.end_date) < new Date(updatedMilestone.start_date)) {
            updatedMilestone.start_date = updatedMilestone.end_date;
          }
        } else if (field === 'completion') {
          const numValue = Math.max(0, Math.min(100, Number(value) || 0));
          updatedMilestone.completion = numValue;
        } else if (field === 'duration_days') {
          const numValue = Math.max(1, Number(value) || 1);
          updatedMilestone.duration_days = numValue;
          if (updatedMilestone.start_date) {
            const start = new Date(updatedMilestone.start_date);
            const end = new Date(start);
            end.setDate(start.getDate() + numValue - 1);
            const endStr = end.toISOString().split('T')[0];
            updatedMilestone.end_date = endStr;
          }
        }
        // Apply validation and recalculate duration
        let validatedMilestone = validateAndAdjustDates(
          updatedMilestone,
          project?.start_date,
          project?.end_date
        );
        validatedMilestone.duration_days = calculateDuration(validatedMilestone.start_date, validatedMilestone.end_date);
        return validatedMilestone;
      }
      return ms;
    });

    const updatedPlan = { ...aiPlan, milestones: updatedMilestones };
    updateAiPlan(updatedPlan);
  };

  const handleAssignmentUpdate = async (msIdx, tIdx, stIdx, employeeId) => {
    try {
      const updatedPlan = { ...aiPlan };
      let item = null;
      if (stIdx !== undefined) {
        item = updatedPlan.milestones[msIdx].tasks[tIdx].subtasks[stIdx];
      } else if (tIdx !== undefined) {
        item = updatedPlan.milestones[msIdx].tasks[tIdx];
      } else {
        item = updatedPlan.milestones[msIdx];
      }
      const selected = employeeOptions.find(e => String(e.id) === String(employeeId));
      item.assigned_employee_id = employeeId ? Number(employeeId) : null;
      item.assigned_employee_name = selected ? selected.name : '';
      const role = (item.title || 'Assignment').slice(0, 100);
      const startDate = item.start_date || project?.start_date || null;
      const endDate = item.end_date || project?.end_date || null;
      const token = getCookie(TOKEN);
      updateAiPlan(updatedPlan);
    } catch (e) {
      console.error('Assignment update error:', e);
      const updatedPlan = { ...aiPlan };
      let item = null;
      if (stIdx !== undefined) {
        item = updatedPlan.milestones[msIdx].tasks[tIdx].subtasks[stIdx];
      } else if (tIdx !== undefined) {
        item = updatedPlan.milestones[msIdx].tasks[tIdx];
      } else {
        item = updatedPlan.milestones[msIdx];
      }
      item.assigned_employee_id = employeeId ? Number(employeeId) : null;
      const selected = employeeOptions.find(e => String(e.id) === String(employeeId));
      item.assigned_employee_name = selected ? selected.name : '';
      updateAiPlan(updatedPlan);
    }
  };

  // 🔹 Fetch saved AI plan from DB
  const fetchTimeline = async () => {
    setLoading(true)
    setError(null)
    try {
      const token = getCookie(TOKEN)
      const res = await fetch(`${getApiBaseUrl()}/api/projects/${projectId}`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      })
      if (!res.ok) throw new Error(`Failed to load project (${res.status})`)
      const body = await res.json()
      if (!body.project) throw new Error('Project not found')

      const pidKey = `project_${projectId}`
      const filtered = (body.data || []).filter(item => item.id === pidKey || item.parent === pidKey)
      lastGanttDataRef.current = filtered // Store for comparison
      setGanttData(filtered)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchProjectDetails = async () => {
    try {
      const token = getCookie(TOKEN)
      const res = await fetch(`${getApiBaseUrl()}/api/projects/${projectId}`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      })
      if (!res.ok) return
      const body = await res.json()
      const p = body.project
      if (!p) return
      const raw = p.ai_plan_status
      let normalized = 'not_started'
      if (raw) {
        const s = String(raw).toLowerCase()
        if (s === 'completed') normalized = 'completed'
        else if (s === 'in_progress' || s === 'inprogress') normalized = p.ai_plan ? 'in_progress' : 'not_started'
      }
      setAiPlanStatus(normalized)
      if (p.ai_plan && (normalized === 'completed' || normalized === 'in_progress')) {
        const savedPlan = p.ai_plan
        setAiPlan(savedPlan)
        const convertedData = convertAiPlanToGantt(savedPlan, p)
        lastGanttDataRef.current = convertedData
        setGanttData(convertedData)
      }
    } catch (e) { }
  }

  // 🔹 Trigger Gemini AI + persist to DB
  const handleAIGenerate = async (feedback = null) => {
    setAiGenerating(true)
    setError(null)
    try {
      const token = getCookie(TOKEN)
      const bodyData = feedback ? { user_feedback: feedback } : {}
      const res = await fetch(`${getApiBaseUrl()}/api/gantt/ai-generate/${projectId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
      })
      const body = await res.json()
      if (!res.ok || !body.success) {
        throw new Error(body.error || 'AI generation failed')
      }

      // Store the full analysis for table display
      if (body.analysis && body.analysis.milestones) {
        // Add start_date, end_date, completion to tasks and subtasks
        const updatedAnalysis = { ...body.analysis }
        updatedAnalysis.milestones = updatedAnalysis.milestones.map(ms => ({
          ...ms,
          tasks: ms.tasks.map(t => {
            const start = project?.start_date && t.start_offset_days !== undefined
              ? addDays(project.start_date, t.start_offset_days)
              : null
            const end = start && t.duration_days
              ? addDays(start, t.duration_days - 1)
              : null
            return {
              ...t,
              start_date: start,
              end_date: end,
              completion: t.completion || 0,
              subtasks: t.subtasks.map(st => {
                const baseStart = start
                const stOffset = st.start_offset_days !== undefined ? st.start_offset_days : 0
                const stStart = baseStart ? addDays(baseStart, stOffset) : null
                const stFinish = stStart && st.duration_days
                  ? addDays(stStart, st.duration_days - 1)
                  : null
                return {
                  ...st,
                  start_date: stStart,
                  end_date: stFinish,
                  completion: st.completion || 0
                }
              })
            }
          })
        }))
        setAiPlan(updatedAnalysis)
        const newGanttData = convertAiPlanToGantt(updatedAnalysis, project)
        lastGanttDataRef.current = newGanttData // Store for comparison
        setGanttData(newGanttData)
        setAiPlanStatus('in_progress') // Update status to in_progress after generation

        // Analyze resources and trigger assignment modal
        analyzeResources(updatedAnalysis)
      }

      console.log('✅ Gemini Analysis:', {
        milestones: body.analysis?.milestones?.length || 0,
        totalTasks: body.analysis?.milestones?.reduce((sum, m) => sum + (m.tasks?.length || 0), 0) || 0,
        ganttItems: body.data?.length || 0
      })
      await fetchProjectDetails()
    } catch (e) {
      console.error('AI Generation Error:', e)
      setError(e.message || 'Failed to generate AI timeline')
    } finally {
      setAiGenerating(false)
    }
  }

  // 🔹 Handle Regenerate with feedback
  const handleRegenerate = () => {
    setShowRegenerateModal(true)
  }

  // 🔹 Handle Save AI Plan
  const handleSave = async () => {
    setIsSaving(true)
    setError(null)
    try {
      const token = getCookie(TOKEN)
      const res = await fetch(`${getApiBaseUrl()}/api/gantt/save-ai-plan/${projectId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ai_plan: aiPlan })
      })
      const body = await res.json()
      if (!res.ok || !body.success) {
        throw new Error(body.error || 'Save failed')
      }
      setAiPlanStatus('completed') // Lock the plan after saving
      setIsEditMode(false) // Exit edit mode after saving
      console.log('✅ AI Plan saved successfully')

      // Force re-initialize the chart to ensure it reflects the saved data
      if (svgRef.current) {
        initialize(false)
      }
    } catch (e) {
      console.error('Save Error:', e)
      setError(e.message || 'Failed to save AI plan')
    } finally {
      setIsSaving(false)
    }
  }

  // 🔹 Handle Edit Mode Toggle
  const handleEditMode = () => {
    setIsEditMode(true)
  }

  // 🔹 Handle Cancel Edit
  const handleCancelEdit = () => {
    // Reload the saved plan from project to discard changes
    if (project && project.ai_plan && project.ai_plan_status === 'completed') {
      const savedPlan = project.ai_plan
      setAiPlan(savedPlan)
      const convertedData = convertAiPlanToGantt(savedPlan, project)
      // Reset last data ref to force re-initialization
      lastGanttDataRef.current = null
      setGanttData(convertedData)

      // Force re-initialize the chart to ensure it reflects the saved data
      if (svgRef.current) {
        setTimeout(() => {
          initialize(false)
        }, 100)
      }
    }
    setIsEditMode(false)
  }

  // 🔹 Handle Regenerate Modal Submit
  const handleRegenerateSubmit = () => {
    if (regenerateFeedback.trim()) {
      handleAIGenerate(regenerateFeedback.trim())
      setShowRegenerateModal(false)
      setRegenerateFeedback('')
    }
  }

  // 🔹 Initialize Gantt Chart after data load
  const initialize = async (shouldResetColors = false) => {
    if (!svgRef.current) {
      console.log('⚠️ SVG ref not ready, skipping initialization')
      return
    }
    if (ganttData.length === 0) {
      console.log('⚠️ No gantt data, skipping initialization')
      return
    }
    if (isUpdatingFromChart.current) {
      console.log('⚠️ Update from chart, skipping initialization')
      return // Skip if update is from chart itself
    }

    console.log('✅ Initializing Gantt chart with', ganttData.length, 'items')

    // Properly destroy previous instance before clearing
    if (ganttInstance.current) {
      try {
        // Remove event handlers to prevent errors
        if (ganttInstance.current.on_date_change) {
          ganttInstance.current.on_date_change = null
        }
        if (ganttInstance.current.on_progress_change) {
          ganttInstance.current.on_progress_change = null
        }
        // Clear any pending operations
        if (ganttInstance.current.svg) {
          ganttInstance.current.svg = null
        }
      } catch (e) {
        // Ignore errors during cleanup
      }
      ganttInstance.current = null
    }

    // Clean up previous event listeners
    barEventListenersRef.current.forEach(({ element, event, handler }) => {
      try {
        element.removeEventListener(event, handler)
      } catch (e) {
        // Ignore errors during cleanup
      }
    })
    barEventListenersRef.current = []

    // Clear SVG after a small delay to ensure frappe-gantt has finished
    // This prevents the "Cannot read properties of undefined" error
    await new Promise(resolve => setTimeout(resolve, 100))
    if (svgRef.current) {
      try {
        // Clear all child nodes safely
        while (svgRef.current.firstChild) {
          svgRef.current.removeChild(svgRef.current.firstChild)
        }
      } catch (e) {
        // If removeChild fails, try innerHTML
        svgRef.current.innerHTML = ''
      }
    }

    const pidKey = `project_${projectId}`
    let filteredGanttData = ganttData.filter(i => i.start_date || i.end_date)
    if (viewMode === 'high-level') {
      // Only show milestones in high-level view
      filteredGanttData = filteredGanttData.filter(i => i.type === 'milestone')
    }
    const tasks = filteredGanttData
      .map(i => {
        // Fallbacks so items with a single date still render
        const start = i.start_date || i.end_date || project.start_date || null
        const end = i.end_date || i.start_date || project.end_date || start
        // Convert progress from percentage (0-100) to decimal (0-1) if needed
        let progress = i.progress || 0
        if (progress > 1) {
          progress = progress / 100
        }
        if (i.completion_percentage !== undefined && i.completion_percentage !== null) {
          progress = i.completion_percentage / 100
        }
        return {
          id: i.id,
          name: i.text,
          start,
          end,
          progress: Math.max(0, Math.min(1, progress)),
          dependencies: Array.isArray(i.depends_on) ? i.depends_on.join(',') : ''
        }
      })
      .filter(task => task.id !== pidKey)
      .sort((a, b) => (a.id === pidKey ? -1 : b.id === pidKey ? 1 : 0))

    console.log('📊 Creating Gantt chart with', tasks.length, 'tasks')
    if (tasks.length === 0) {
      console.warn('⚠️ No tasks to display in Gantt chart')
    }

    // Calculate the appropriate bar height and padding to match table row heights
    // Use milestoneRowHeight for all bars to ensure alignment with table rows
    const minStart = tasks.reduce((acc, t) => {
      if (!t.start) return acc
      if (!acc) return t.start
      return t.start < acc ? t.start : acc
    }, null)
    const maxEnd = tasks.reduce((acc, t) => {
      if (!t.end) return acc
      if (!acc) return t.end
      return t.end > acc ? t.end : acc
    }, null)

    let windowStart = minStart || project.start_date
    let windowEnd = maxEnd || project.end_date
    if (windowStart) {
      const d = new Date(windowStart)
      d.setDate(d.getDate() - 2)
      windowStart = d.toISOString().split('T')[0]
    }
    if (windowEnd) {
      const d = new Date(windowEnd)
      windowEnd = d.toISOString().split('T')[0]
    }
    // Do not clamp to project start; show earliest task even if before project.start_date
    // Also avoid clamping right side to project end to keep latest task visible

    const anchorTasks = []
    if (windowStart) {
      anchorTasks.push({ id: 'window_start', name: '', start: windowStart, end: windowStart, progress: 0, dependencies: '' })
    }
    if (windowEnd) {
      anchorTasks.push({ id: 'window_end', name: '', start: windowEnd, end: windowEnd, progress: 0, dependencies: '' })
    }
    const displayTasks = tasks.concat(anchorTasks)

    try {
      ganttInstance.current = new Gantt(svgRef.current, displayTasks, {
        header_height: 60,
        column_width: 20,
        view_modes: ['Day', 'Week', 'Month'],
        bar_height: milestoneRowHeight, // Use milestone height for all bars (now 50px)
        padding: 11,
        view_mode: 'Week',
        date_format: 'YYYY-MM-DD',
        bar_corner_radius: 3,
        arrow_curve: 5,
        start_date: windowStart,
        end_date: windowEnd,
        custom_popup_html: task => `
        <div class="p-">
          <strong>${task.name}</strong><br/>
          <small>${task.start} → ${task.end}</small><br/>
          <small>Progress: ${(task.progress * 100).toFixed(0)}%</small>
        </div>`
      })
    } catch (error) {
      console.error('❌ Error creating Gantt chart:', error)
      return
    }

    // Hide anchor tasks used for range control
    ;['window_start', 'window_end'].forEach(anchorId => {
      try {
        const el = svgRef.current?.querySelector(`.bar-wrapper[data-id="${anchorId}"]`)
        if (el) el.style.display = 'none'
      } catch (e) { }
    })

    // Add event handlers for bidirectional sync
    if (ganttInstance.current) {
      // Handle date changes when bars are dragged
      ganttInstance.current.on_date_change = (task, start, end) => {
        try {
          const startDate = start ? (start instanceof Date ? start.toISOString().split('T')[0] : start) : null
          const endDate = end ? (end instanceof Date ? end.toISOString().split('T')[0] : end) : null
          handleGanttChartUpdate(task.id, startDate, endDate, undefined)
        } catch (error) {
          console.error('Error handling date change:', error)
        }
      }

      // Handle progress changes when progress bar is adjusted
      ganttInstance.current.on_progress_change = (task, progress) => {
        try {
          handleGanttChartUpdate(task.id, undefined, undefined, progress)
        } catch (error) {
          console.error('Error handling progress change:', error)
        }
      }
    }

    // Apply colors and progress bars immediately after chart creation
    // This ensures initial colors are set correctly (golden brown bars with green progress)
    const applyColorsAndProgress = () => {
      if (!colorApplicationInProgress.current) {
        colorApplicationInProgress.current = true
        // First update progress bars to ensure they exist
        updateProgressBarsInChart(ganttData)
        // Then apply colors (which will also create progress bars if needed)
        // Pass tasks array for better matching
        requestAnimationFrame(() => {
          applyGoldenBrownColors(shouldResetColors, tasks)
          // Update progress bars again after colors are applied
          setTimeout(() => {
            updateProgressBarsInChart(ganttData)
            colorApplicationInProgress.current = false
          }, 50)
        })
      }
    }

    // Apply after a delay to ensure SVG is fully rendered by frappe-gantt
    // Frappe-gantt needs time to create all the DOM elements
    if (colorTimeoutRef.current) {
      clearTimeout(colorTimeoutRef.current)
    }
    colorTimeoutRef.current = setTimeout(() => {
      applyColorsAndProgress()
    }, 300) // Delay to ensure SVG is fully rendered

    // Also apply after a longer delay as a fallback
    setTimeout(() => {
      if (!colorApplicationInProgress.current) {
        applyColorsAndProgress()
      }
    }, 600) // Additional fallback delay

    // Add event listeners for highlighting (with proper cleanup tracking)
    if (svgRef.current) {
      const bars = svgRef.current.querySelectorAll('.bar')
      bars.forEach((bar, index) => {
        const taskId = displayTasks[index]?.id
        if (taskId === 'window_start' || taskId === 'window_end') return

        // Mouse enter handler
        const handleMouseEnter = () => {
          setHoveredRow(taskId)
          bar.style.fill = 'rgb(229, 193, 88)' // Lighter golden brown on hover (#E5C158)
        }

        // Mouse leave handler
        const handleMouseLeave = () => {
          setHoveredRow(null)
          bar.style.fill = 'rgb(212, 175, 55)' // Restore original golden brown color
        }

        // Click handler
        const handleClick = () => {
          setSelectedRow(taskId)
        }

        // Add listeners and track them for cleanup
        bar.addEventListener('mouseenter', handleMouseEnter)
        bar.addEventListener('mouseleave', handleMouseLeave)
        bar.addEventListener('click', handleClick)

        barEventListenersRef.current.push(
          { element: bar, event: 'mouseenter', handler: handleMouseEnter },
          { element: bar, event: 'mouseleave', handler: handleMouseLeave },
          { element: bar, event: 'click', handler: handleClick }
        )
      })
    }

    // Update progress bars for proper initial rendering
    updateProgressBarsInChart(ganttData)
  }

  // 🔹 Handle synchronized scrolling with JS event listeners
  useEffect(() => {
    const tableElement = tableRef.current
    const chartElement = chartRef.current

    if (tableElement && chartElement) {
      const handleTableScroll = () => {
        chartElement.scrollTop = tableElement.scrollTop
      }

      const handleChartScroll = () => {
        tableElement.scrollTop = chartElement.scrollTop
      }

      tableElement.addEventListener('scroll', handleTableScroll)
      chartElement.addEventListener('scroll', handleChartScroll)

      return () => {
        tableElement.removeEventListener('scroll', handleTableScroll)
        chartElement.removeEventListener('scroll', handleChartScroll)
      }
    }
  }, [aiPlan])




  // 🔹 Render table beside chart
  const renderPlanTable = () => {
    if (!aiPlan) {
      return (
        <div className="text-sm text-slate-500 p-4">
          No AI plan yet. Click <b>"AI Generate"</b> to create milestones and tasks.
        </div>
      )
    }

    const formatDate = (d) => {
      if (!d) return ''
      try {
        const dt = new Date(d)
        if (isNaN(dt.getTime())) return ''
        return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
      } catch (e) {
        return ''
      }
    }

    let rowIndex = 0
    return (

      <div
        ref={tableRef}
        className="border border-gray-200 rounded-md overflow-x-auto overflow-y-auto scroll-smooth h-full"
        style={{ minWidth: '100%' }}
      >
        {isEditMode && (
          <div className="flex justify-end mb-2">
            <button
              onClick={handleAddMilestone}
              className="text-xs bg-green-600 text-white px-1 py-1 rounded hover:bg-green-700"
            >
              + Add Milestone
            </button>
          </div>
        )}
        <table className="w-full border-collapse" style={{ minWidth: '600px' }}>
          <thead className="sticky top-0 z-10 bg-slate-50">
            <tr className="text-[10px] font-semibold border-b border-gray-200">
              <th className="px-1 py-2 text-left" style={{ minWidth: '200px', width: '200px' }}>
                <EditableCell
                  value={headerLabels.milestoneTask}
                  type="text"
                  onChange={(value) => setHeaderLabels(prev => ({ ...prev, milestoneTask: value }))}
                  isEditMode={isEditMode}
                />
              </th>
              {viewMode !== 'high-level' && (
                <th className="px-1 py-2 text-left" style={{ minWidth: '100px', width: '100px' }}>
                  <EditableCell
                    value={headerLabels.assignedTo}
                    type="text"
                    onChange={(value) => setHeaderLabels(prev => ({ ...prev, assignedTo: value }))}
                    isEditMode={isEditMode}
                  />
                </th>
              )}
              <th className="px-1 py-2 text-left" style={{ minWidth: '30px', width: '30px' }}>
                <EditableCell
                  value={headerLabels.priority}
                  type="text"
                  onChange={(value) => setHeaderLabels(prev => ({ ...prev, priority: value }))}
                  isEditMode={isEditMode}
                />
              </th>
              <th className="px-1 py-2 text-left" style={{ minWidth: '60px', width: '60px' }}>
                <EditableCell
                  value={headerLabels.startDate}
                  type="text"
                  onChange={(value) => setHeaderLabels(prev => ({ ...prev, startDate: value }))}
                  isEditMode={isEditMode}
                />
              </th>
              <th className="px-1 py-2 text-left" style={{ minWidth: '60px', width: '60px' }}>
                <EditableCell
                  value={headerLabels.endDate}
                  type="text"
                  onChange={(value) => setHeaderLabels(prev => ({ ...prev, endDate: value }))}
                  isEditMode={isEditMode}
                />
              </th>
              <th className="px-1 py-2 text-left" style={{ minWidth: '20px', width: '20px' }}>
                <EditableCell
                  value={headerLabels.duration}
                  type="text"
                  onChange={(value) => setHeaderLabels(prev => ({ ...prev, duration: value }))}
                  isEditMode={isEditMode}
                />
              </th>
              <th className="px-1 py-2 text-left" style={{ minWidth: '60px', width: '60px' }}>
                <EditableCell
                  value={headerLabels.completion}
                  type="text"
                  onChange={(value) => setHeaderLabels(prev => ({ ...prev, completion: value }))}
                  isEditMode={isEditMode}
                />
              </th>
              {isEditMode && (
                <th className="px-1 py-2 text-center" style={{ minWidth: '80px', width: '80px' }}>
                  <EditableCell
                    value={headerLabels.actions}
                    type="text"
                    onChange={(value) => setHeaderLabels(prev => ({ ...prev, actions: value }))}
                    isEditMode={isEditMode}
                  />
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y">
            {(aiPlan.milestones || []).map((ms, idx) => {
              // Calculate milestone dates from tasks
              let msStart = null, msEnd = null
              ms.tasks.forEach(t => {
                if (t.start_date && (!msStart || t.start_date < msStart)) msStart = t.start_date
                if (t.end_date && (!msEnd || t.end_date > msEnd)) msEnd = t.end_date
              })

              const msRowId = `milestone_${ms.id || idx + 1}`
              const isMsSelected = selectedRow === msRowId
              const isMsHovered = hoveredRow === msRowId

              return (
                <React.Fragment key={`ms-${idx}`}>
                  <tr
                    className={`text-[10px] font-semibold cursor-pointer transition-colors ${isMsSelected ? 'bg-blue-100 ring-2 ring-blue-300' :
                      isMsHovered ? 'bg-green-200' : 'bg-green-100'
                      }`}
                    style={{ height: `${milestoneRowHeight}px` }}
                    onClick={() => setSelectedRow(msRowId)}
                    onMouseEnter={() => setHoveredRow(msRowId)}
                    onMouseLeave={() => setHoveredRow(null)}
                  >
                    <td className="px-1 py-1 align-middle text-[10px]" style={{ minWidth: '200px', width: '200px' }}>
                      <EditableCell
                        value={ms.title}
                        type="text"
                        onChange={(value) => handleTitleUpdate(idx, undefined, undefined, value)}
                        isEditMode={isEditMode}
                      />
                    </td>
                    {viewMode !== 'high-level' && (
                      <td className="px-1 py-1 align-middle text-[10px]" style={{ width: '100px' }}>

                      </td>
                    )}
                    <td className="px-1 py-1 align-middle text-[10px]" style={{ width: '30px' }}>
                      <EditableCell
                        value={ms.priority || 'High'}
                        type="select"
                        onChange={(value) => handleMilestoneFieldUpdate(idx, 'priority', value)}
                        isEditMode={isEditMode}
                      />
                    </td>
                    <td className="px-1 py-1 align-middle text-[10px]" style={{ width: '60px' }}>
                      <EditableCell
                        value={ms.start_date || msStart || ''}
                        type="date"
                        onChange={(value) => handleMilestoneFieldUpdate(idx, 'start_date', value)}
                        isEditMode={isEditMode}
                      />
                    </td>
                    <td className="px-1 py-1 align-middle text-[10px]" style={{ width: '60px' }}>
                      <EditableCell
                        value={ms.end_date || msEnd || ''}
                        type="date"
                        onChange={(value) => handleMilestoneFieldUpdate(idx, 'end_date', value)}
                        isEditMode={isEditMode}
                      />
                    </td>
                    <td className="px-1 py-1 align-middle text-[10px]" style={{ width: '20px' }}>
                      <EditableCell
                        value={ms.duration_days || (msStart && msEnd ? Math.ceil((new Date(msEnd) - new Date(msStart)) / (1000 * 60 * 60 * 24)) + 1 : '')}
                        type="number"
                        min={1}
                        max={3650}
                        onChange={(value) => handleMilestoneFieldUpdate(idx, 'duration_days', value)}
                        isEditMode={isEditMode}
                        suffix={" days"}
                      />
                    </td>
                    <td className="px-1 py-1 align-middle text-[10px]" style={{ width: '60px' }}>
                      <span className="text-slate-700">{ms.completion || 0}%</span>
                    </td>
                    {isEditMode && <td className="px-1 py-1 align-middle text-[10px] text-center" style={{ minWidth: '80px', width: '80px' }}>
                      <div className="flex gap-1 justify-center">
                        <button
                          onClick={() => handleAddTask(idx)}
                          className="text-[9px] text-blue-600 hover:underline"
                          title="Add Task"
                        >
                          + Task
                        </button>
                        <button
                          onClick={() => handleDeleteMilestone(idx)}
                          className="text-[9px] text-red-600 hover:underline"
                          title="Delete Milestone"
                        >
                          🗑
                        </button>
                      </div>
                    </td>}
                  </tr>
                  {viewMode === 'detailed' && (ms.tasks || []).map((t, tIdx) => {
                    rowIndex++
                    const taskRowId = `ai_task_${rowIndex}`
                    const isTaskSelected = selectedRow === taskRowId
                    const isTaskHovered = hoveredRow === taskRowId

                    return (
                      <React.Fragment key={`task-${idx}-${tIdx}`}>
                        <tr
                          className={`text-[10px] cursor-pointer transition-colors ${isTaskSelected ? 'bg-blue-100 ring-2 ring-blue-300' :
                            isTaskHovered ? 'bg-blue-50' : 'bg-white'
                            }`}
                          style={{ height: `${milestoneRowHeight}px` }}
                          onClick={() => setSelectedRow(taskRowId)}
                          onMouseEnter={() => setHoveredRow(taskRowId)}
                          onMouseLeave={() => setHoveredRow(null)}
                        >
                          <td className="px-1 py-1 align-middle text-[10px] font-medium" style={{ minWidth: '200px', width: '200px' }}>
                            <EditableCell
                              value={t.title}
                              type="text"
                              onChange={(value) => handleTitleUpdate(idx, tIdx, undefined, value)}
                              isEditMode={isEditMode}
                            />
                          </td>
                          {viewMode !== 'high-level' && (
                            <td className="px-1 py-1 align-middle text-[10px]" style={{ width: '100px' }}>
                              <SearchableDropdown
                                value={t.assigned_employee_id || ''}
                                options={(employeeOptions && employeeOptions.length > 0)
                                  ? employeeOptions.map(e => ({ value: e.id, label: e.name }))
                                  : [{ value: '', label: employeesLoading ? 'Loading…' : 'Select' }]}
                                onChange={(value) => handleAssignmentUpdate(idx, tIdx, undefined, value)}
                                placeholder={employeesLoading ? 'Loading…' : 'Select employee'}
                                disabled={!isEditMode}
                                className="text-[10px]"
                              />
                            </td>
                          )}
                          <td className="px-1 py-1 align-middle text-[10px]" style={{ width: '30px' }}>
                            <EditableCell
                              value={t.priority || 'Medium'}
                              type="select"
                              onChange={(value) => handleFieldUpdate(idx, tIdx, undefined, 'priority', value)}
                              isEditMode={isEditMode}
                            />
                          </td>
                          <td className="px-1 py-1 align-middle text-[10px]" style={{ width: '60px' }}>
                            <EditableCell
                              value={t.start_date}
                              type="date"
                              onChange={(value) => handleFieldUpdate(idx, tIdx, undefined, 'start_date', value)}
                              isEditMode={isEditMode}
                            />
                          </td>
                          <td className="px-1 py-1 align-middle text-[10px]" style={{ width: '60px' }}>
                            <EditableCell
                              value={t.end_date}
                              type="date"
                              onChange={(value) => handleFieldUpdate(idx, tIdx, undefined, 'end_date', value)}
                              isEditMode={isEditMode}
                            />
                          </td>
                          <td className="px-1 py-1 align-middle text-[10px]" style={{ width: '20px' }}>
                            <EditableCell
                              value={t.duration_days || (t.start_date && t.end_date ? Math.ceil((new Date(t.end_date) - new Date(t.start_date)) / (1000 * 60 * 60 * 24)) + 1 : '')}
                              type="number"
                              min={1}
                              max={3650}
                              onChange={(value) => handleFieldUpdate(idx, tIdx, undefined, 'duration_days', value)}
                              isEditMode={isEditMode}
                              suffix={" days"}
                            />
                          </td>
                          <td className="px-1 py-1 align-middle text-[10px]" style={{ width: '60px' }}>
                            <span className="text-slate-700">{t.completion || 0}%</span>
                          </td>
                          {isEditMode && <td className="px-1 py-1 align-middle text-[10px] text-center" style={{ minWidth: '80px', width: '80px' }}>
                            <div className="flex gap-1 justify-center">
                              <button
                                onClick={() => handleAddSubtask(idx, tIdx)}
                                className="text-[9px] text-blue-600 hover:underline"
                                title="Add Subtask"
                              >
                                + Subtask
                              </button>
                              <button
                                onClick={() => handleDeleteTask(idx, tIdx)}
                                className="text-[9px] text-red-600 hover:underline"
                                title="Delete Task"
                              >
                                🗑
                              </button>
                            </div>
                          </td>}
                        </tr>
                        {(t.subtasks || []).map((st, sIdx) => {
                          rowIndex++
                          const subtaskRowId = `ai_subtask_${rowIndex}`
                          const isSubtaskSelected = selectedRow === subtaskRowId
                          const isSubtaskHovered = hoveredRow === subtaskRowId

                          return (
                            <tr
                              key={`sub-${idx}-${tIdx}-${sIdx}`}
                              className={`text-[10px] cursor-pointer transition-colors ${isSubtaskSelected ? 'bg-blue-100 ring-2 ring-blue-300' :
                                isSubtaskHovered ? 'bg-blue-50' : 'bg-slate-50'
                                }`}
                              style={{ height: `${milestoneRowHeight}px` }}
                              onClick={() => setSelectedRow(subtaskRowId)}
                              onMouseEnter={() => setHoveredRow(subtaskRowId)}
                              onMouseLeave={() => setHoveredRow(null)}
                            >
                              <td className="px-1 py-1 align-middle text-[10px] text-slate-700" style={{ minWidth: '200px', width: '200px' }}>
                                <EditableCell
                                  value={st.title}
                                  type="text"
                                  onChange={(value) => handleTitleUpdate(idx, tIdx, sIdx, value)}
                                  isEditMode={isEditMode}
                                />
                              </td>
                              {viewMode !== 'high-level' && (
                                <td className="px-1 py-1 align-middle text-[10px]" style={{ width: '100px' }}>
                                  <SearchableDropdown
                                    value={st.assigned_employee_id || ''}
                                    options={(employeeOptions && employeeOptions.length > 0)
                                      ? employeeOptions.map(e => ({ value: e.id, label: e.name }))
                                      : [{ value: '', label: employeesLoading ? 'Loading…' : 'Select' }]}
                                    onChange={(value) => handleAssignmentUpdate(idx, tIdx, sIdx, value)}
                                    placeholder={employeesLoading ? 'Loading…' : 'Select employee'}
                                    disabled={!isEditMode}
                                    className="text-[10px]"
                                  />
                                </td>
                              )}

                              <td className="px-1 py-1 align-middle text-[10px]" style={{ width: '30px' }}>
                                <EditableCell
                                  value={st.priority || 'Medium'}
                                  type="select"
                                  onChange={(value) => handleFieldUpdate(idx, tIdx, sIdx, 'priority', value)}
                                  isEditMode={isEditMode}
                                />
                              </td>
                              <td className="px-1 py-1 align-middle text-[10px]" style={{ width: '60px' }}>
                                <EditableCell
                                  value={st.start_date}
                                  type="date"
                                  onChange={(value) => handleFieldUpdate(idx, tIdx, sIdx, 'start_date', value)}
                                  isEditMode={isEditMode}
                                />
                              </td>
                              <td className="px-1 py-1 align-middle text-[10px]" style={{ width: '60px' }}>
                                <EditableCell
                                  value={st.end_date}
                                  type="date"
                                  onChange={(value) => handleFieldUpdate(idx, tIdx, sIdx, 'end_date', value)}
                                  isEditMode={isEditMode}
                                />
                              </td>
                              <td className="px-1 py-1 align-middle text-[10px]" style={{ width: '20px' }}>
                                <EditableCell
                                  value={st.duration_days || (st.start_date && st.end_date ? Math.ceil((new Date(st.end_date) - new Date(st.start_date)) / (1000 * 60 * 60 * 24)) + 1 : '')}
                                  type="number"
                                  min={1}
                                  max={3650}
                                  onChange={(value) => handleFieldUpdate(idx, tIdx, sIdx, 'duration_days', value)}
                                  isEditMode={isEditMode}
                                  suffix={" days"}
                                />
                              </td>
                              <td className="px-1 py-1 align-middle text-[10px]" style={{ width: '60px' }}>
                                <EditableCell
                                  value={st.completion || 0}
                                  type="number"
                                  min={0}
                                  max={100}
                                  onChange={(value) => handleFieldUpdate(idx, tIdx, sIdx, 'completion', value)}
                                  isEditMode={isEditMode}
                                />
                              </td>
                              {isEditMode && <td className="px-1 py-1 align-middle text-[10px] text-center" style={{ minWidth: '80px', width: '80px' }}>
                                <div className="flex gap-1 justify-center">
                                  <button
                                    onClick={() => handleDeleteSubtask(idx, tIdx, sIdx)}
                                    className="text-[9px] text-red-600 hover:underline"
                                    title="Delete Subtask"
                                  >
                                    🗑
                                  </button>
                                </div>
                              </td>}
                            </tr>
                          )
                        })}
                      </React.Fragment>
                    )
                  })}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  // Load saved AI plan from project when component mounts or project changes
  useEffect(() => {
    if (project) {
      const raw = project.ai_plan_status
      let normalized = 'not_started'
      if (raw) {
        const s = String(raw).toLowerCase()
        if (s === 'completed') normalized = 'completed'
        else if (s === 'in_progress' || s === 'inprogress') normalized = project.ai_plan ? 'in_progress' : 'not_started'
      }
      setAiPlanStatus(normalized)

      if (project.ai_plan && (normalized === 'completed' || normalized === 'in_progress')) {
        const savedPlan = project.ai_plan
        setAiPlan(savedPlan)
        const convertedData = convertAiPlanToGantt(savedPlan, project)
        lastGanttDataRef.current = convertedData
        setGanttData(convertedData)
      } else {
        if (normalized === 'in_progress' && !project.ai_plan) {
          fetchProjectDetails()
        } else {
          fetchTimeline()
        }
      }
    }
  }, [projectId, project?.ai_plan, project?.ai_plan_status])



  // Initialize Gantt chart when data is ready
  useEffect(() => {
    // Ensure SVG ref is ready and we have valid data before initializing
    if (!isUpdatingFromChart.current && svgRef.current && ganttData.length > 0) {
      // Check if we have at least one item with valid dates
      const hasValidData = ganttData.some(i => i.start_date && i.end_date)
      if (hasValidData) {
        // Check if this is just a completion update (no structural changes)
        const lastData = lastGanttDataRef.current
        const isCompletionOnlyUpdate = lastData &&
          lastData.length === ganttData.length &&
          ganttData.every((item, idx) => {
            const lastItem = lastData[idx]
            return lastItem &&
              lastItem.id === item.id &&
              lastItem.start_date === item.start_date &&
              lastItem.end_date === item.end_date &&
              lastItem.text === item.text
          })

        // Check if view mode changed
        const viewModeChanged = lastViewModeRef.current !== viewMode
        lastViewModeRef.current = viewMode

        // Only re-initialize if structure changed, view mode changed, or no instance
        // For completion-only updates, progress bars are already updated in updateAiPlan
        if (!isCompletionOnlyUpdate || viewModeChanged || !ganttInstance.current) {
          // Add a small delay to ensure DOM is fully ready
          const timer = setTimeout(() => {
            initialize(viewModeChanged) // Pass flag to reset colors if view mode changed
          }, 150)
          return () => clearTimeout(timer)
        }
      } else {
        console.log('⚠️ Gantt data exists but no items have valid start/end dates')
      }
    }
  }, [ganttData, viewMode])

  // Force initialization when aiPlan is first set (for initial load)
  useEffect(() => {
    if (aiPlan && ganttData.length > 0 && svgRef.current && !ganttInstance.current) {
      // Wait a bit longer for initial render
      const timer = setTimeout(() => {
        if (!isUpdatingFromChart.current) {
          console.log('🔄 Force initializing Gantt chart on aiPlan load')
          initialize(false) // Don't reset colors on initial load
        }
      }, 200)
      return () => clearTimeout(timer)
    }
  }, [aiPlan])

  // Reapply golden brown colors with green progress when chart is updated
  // Optimized to prevent excessive calls and performance issues
  useEffect(() => {
    if (ganttInstance.current && svgRef.current && ganttData.length > 0) {
      // Check if view mode changed to reset colors
      const viewModeChanged = lastViewModeRef.current !== viewMode
      const shouldResetColors = viewModeChanged

      // Clear any pending color application
      if (colorTimeoutRef.current) {
        clearTimeout(colorTimeoutRef.current)
      }

      // Debounce color application to prevent excessive calls
      // Only apply once after a short delay
      colorTimeoutRef.current = setTimeout(() => {
        if (!colorApplicationInProgress.current) {
          colorApplicationInProgress.current = true
          // First update progress bars
          updateProgressBarsInChart(ganttData)
          requestAnimationFrame(() => {
            applyGoldenBrownColors(shouldResetColors)
            // Update progress bars again after colors are applied
            setTimeout(() => {
              updateProgressBarsInChart(ganttData)
              colorApplicationInProgress.current = false
            }, 50)
          })
        }
      }, 150)

      return () => {
        if (colorTimeoutRef.current) {
          clearTimeout(colorTimeoutRef.current)
        }
      }
    }
  }, [ganttData, viewMode])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clean up all timeouts
      if (colorTimeoutRef.current) {
        clearTimeout(colorTimeoutRef.current)
      }
      // Clean up all event listeners
      barEventListenersRef.current.forEach(({ element, event, handler }) => {
        try {
          element.removeEventListener(event, handler)
        } catch (e) {
          // Ignore errors during cleanup
        }
      })
      barEventListenersRef.current = []
    }
  }, [])

  // Sync chart height with table height for perfect alignment
  useEffect(() => {
    if (tableRef.current && chartRef.current) {
      const tableHeight = tableRef.current.clientHeight
      if (tableHeight && tableHeight > 0) {
        chartRef.current.style.height = `${tableHeight}px`
      }
    }
  }, [aiPlan, viewMode])

  if (loading) return <div className="p-6 text-sm text-slate-600">Loading timeline...</div>
  if (error) return <div className="p-6 text-sm text-red-600">{error}</div>

  return (
    <div className="space-y-4 h-full">
      <div className="flex justify-between items-center">
        <div className="flex gap-2 items-center">
          {/* View Toggle Buttons */}
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('detailed')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${viewMode === 'detailed'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              Detailed View
            </button>
            <button
              onClick={() => setViewMode('high-level')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${viewMode === 'high-level'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              Executive View
            </button>
          </div>

          {aiPlanStatus === 'not_started' && (
            <button onClick={() => handleAIGenerate()} disabled={aiGenerating}
              className="px-3 py-1 text-xs bg-green-600 text-white rounded disabled:opacity-50">
              {aiGenerating ? 'Generating…' : 'AI Generate'}
            </button>
          )}
          {aiPlanStatus === 'in_progress' && (
            <>
              <button onClick={handleRegenerate} disabled={aiGenerating}
                className="px-3 py-1 text-xs bg-yellow-600 text-white rounded disabled:opacity-50">
                {aiGenerating ? 'Regenerating…' : 'Regenerate'}
              </button>
              <button onClick={handleSave} disabled={isSaving}
                className="px-3 py-1 text-xs bg-blue-600 text-white rounded disabled:opacity-50">
                {isSaving ? 'Saving…' : 'Save'}
              </button>
            </>
          )}
        </div>
      </div>

      {project && project.start_date && project.end_date && (
        <div className="bg-slate-50 border border-slate-200 rounded p-3">
          <div className="text-xs text-slate-600 mb-2">Project Timeline</div>
          {(() => {
            const start = new Date(project.start_date)
            const end = new Date(project.end_date)
            const today = new Date()

            // Calculate total project duration in days
            const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1

            // Calculate days passed since project start
            const daysPassed = Math.max(0, Math.ceil((today - start) / (1000 * 60 * 60 * 24)) + 1)

            // Calculate today's position on the timeline (capped at 100%)
            const todayPosition = Math.min(100, (daysPassed / totalDays) * 100)

            // Calculate milestone completion categories
            let completedCount = 0
            let inProgressCount = 0
            let notStartedCount = 0

            if (aiPlan && aiPlan.milestones && aiPlan.milestones.length > 0) {
              aiPlan.milestones.forEach(ms => {
                const completion = ms.completion || 0
                if (completion === 100) {
                  completedCount++
                } else if (completion >= 1 && completion <= 99) {
                  inProgressCount++
                } else {
                  notStartedCount++
                }
              })
            }

            const totalMilestones = aiPlan?.milestones?.length || 0
            const completedPercent = totalMilestones > 0 ? (completedCount / totalMilestones) * 100 : 0
            const inProgressPercent = totalMilestones > 0 ? (inProgressCount / totalMilestones) * 100 : 0
            const notStartedPercent = totalMilestones > 0 ? (notStartedCount / totalMilestones) * 100 : 0

            // Generate months between start and end dates
            const generateMonths = (startDate, endDate) => {
              const months = []
              const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
              const endMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1)

              while (current <= endMonth) {
                months.push({
                  label: current.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
                  date: new Date(current)
                })
                current.setMonth(current.getMonth() + 1)
              }
              return months
            }

            const months = generateMonths(start, end)

            // Calculate position for each month
            const getMonthPosition = (monthDate) => {
              const daysFromStart = Math.ceil((monthDate - start) / (1000 * 60 * 60 * 24))
              return Math.min(100, Math.max(0, (daysFromStart / totalDays) * 100))
            }

            return (
              <div className="relative">
                {/* Month header */}
                <div className="relative mb-2 h-6 overflow-hidden">
                  {months.map((month, index) => {
                    const position = getMonthPosition(month.date)
                    const nextPosition = index < months.length - 1 ? getMonthPosition(months[index + 1].date) : 100
                    const width = nextPosition - position

                    return (
                      <div
                        key={`${month.label}-${index}`}
                        className="absolute text-xs text-slate-600 font-medium"
                        style={{
                          left: `${position}%`,
                          width: `${width}%`,
                          textAlign: 'center',
                          transform: 'translateX(-50%)'
                        }}
                      >
                        {month.label}
                      </div>
                    )
                  })}
                </div>

                <div className="relative h-4 bg-gray-200 rounded mb-1">
                  {/* 3-color progress bar */}
                  {completedPercent > 0 && (
                    <div
                      className="absolute inset-y-0 left-0 bg-green-500 rounded-l transition-all duration-300 flex items-center justify-center"
                      style={{ width: `${completedPercent}%` }}
                    >
                      {completedPercent >= 10 && (
                        <span className="text-xs font-medium text-white">
                          {Math.round(completedPercent)}%
                        </span>
                      )}
                    </div>
                  )}
                  {inProgressPercent > 0 && (
                    <div
                      className="absolute inset-y-0 bg-yellow-500 transition-all duration-300 flex items-center justify-center"
                      style={{
                        left: `${completedPercent}%`,
                        width: `${inProgressPercent}%`
                      }}
                    >
                      {inProgressPercent >= 10 && (
                        <span className="text-xs font-medium text-slate-800">
                          {Math.round(inProgressPercent)}%
                        </span>
                      )}
                    </div>
                  )}
                  {notStartedPercent > 0 && (
                    <div
                      className="absolute inset-y-0 bg-red-500 rounded-r transition-all duration-300 flex items-center justify-center"
                      style={{
                        left: `${completedPercent + inProgressPercent}%`,
                        width: `${notStartedPercent}%`
                      }}
                    >
                      {notStartedPercent >= 10 && (
                        <span className="text-xs font-medium text-white">
                          {Math.round(notStartedPercent)}%
                        </span>
                      )}
                    </div>
                  )}

                  {/* Show percentages outside bars if too narrow */}
                  {completedPercent > 0 && completedPercent < 10 && (
                    <span
                      className="absolute text-xs font-medium text-green-700"
                      style={{
                        left: `${Math.max(completedPercent + 1, 1)}%`,
                        top: '50%',
                        transform: 'translateY(-50%)'
                      }}
                    >
                      {Math.round(completedPercent)}%
                    </span>
                  )}
                  {inProgressPercent > 0 && inProgressPercent < 10 && (
                    <span
                      className="absolute text-xs font-medium text-yellow-700"
                      style={{
                        left: `${Math.max(completedPercent + inProgressPercent + 1, completedPercent + 1)}%`,
                        top: '50%',
                        transform: 'translateY(-50%)'
                      }}
                    >
                      {Math.round(inProgressPercent)}%
                    </span>
                  )}
                  {notStartedPercent > 0 && notStartedPercent < 10 && (
                    <span
                      className="absolute text-xs font-medium text-red-700"
                      style={{
                        left: `${Math.max(completedPercent + inProgressPercent + notStartedPercent + 1, completedPercent + inProgressPercent + 1)}%`,
                        top: '50%',
                        transform: 'translateY(-50%)'
                      }}
                    >
                      {Math.round(notStartedPercent)}%
                    </span>
                  )}

                  {/* Today indicator line */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-black z-10"
                    style={{ left: `${todayPosition}%` }}
                  ></div>

                  {/* Today label above the line */}
                  <div
                    className="absolute -top-6 text-xs font-medium text-red-600 whitespace-nowrap"
                    style={{
                      left: `${todayPosition}%`,
                      transform: 'translateX(-50%)'
                    }}
                  >
                    Today
                  </div>
                </div>

                {/* Start and end dates */}
                <div className="flex justify-between text-xs text-slate-500">
                  <span>{start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}</span>
                  <span>{end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}</span>
                </div>
              </div>
            )
          })()}
        </div>
      )}

      <div className="grid grid-cols-2 gap-0 h-full">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold">AI Task Breakdown</div>
            {aiPlan && aiPlanStatus === 'completed' && !isEditMode && (
              <button onClick={handleEditMode}
                className="px-1 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </button>
            )}
            {isEditMode && (
              <div className="flex items-center gap-2">
                <button onClick={handleSave} disabled={isSaving}
                  className="px-1 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1">
                  {isSaving ? (
                    <>
                      <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    </>
                  ) : (
                    <>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                      Save
                    </>
                  )}
                </button>
                <button onClick={handleCancelEdit} disabled={isSaving}
                  className="px-1 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Cancel
                </button>
              </div>
            )}
          </div>
          {aiPlan ? renderPlanTable() : (
            <div className="text-sm text-slate-500 text-center py-12">
              {ganttData.length > 0 ? 'Timeline data loaded. Use AI Generate to create a plan.' : 'No timeline data. Click Refresh to load.'}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <style>{`
            /* Ensure initial Gantt chart colors are golden brown with green progress */
            svg .bar {
              fill: rgb(212, 175, 55) !important;
              stroke: #B8941F !important;
            }
            svg .bar-progress {
              fill: rgb(22, 101, 52) !important;
             
            }
            svg rect.bar {
              fill: rgb(212, 175, 55) !important;
            }
          `}</style>
          <div
            ref={chartRef}
            className="overflow-x-auto overflow-y-auto mt-[37px]"
            style={{ pointerEvents: 'auto' }}
          >
            <div ref={svgRef}></div>
          </div>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Add {addType}</h3>
            <form onSubmit={handleAddSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  value={addFormData.title}
                  onChange={(e) => setAddFormData({ ...addFormData, title: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={addFormData.start_date}
                  onChange={(e) => setAddFormData({ ...addFormData, start_date: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={addFormData.end_date}
                  onChange={(e) => setAddFormData({ ...addFormData, end_date: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <select
                  value={addFormData.priority}
                  onChange={(e) => setAddFormData({ ...addFormData, priority: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Completion %</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={addFormData.completion}
                  onChange={(e) => setAddFormData({ ...addFormData, completion: Number(e.target.value) })}
                  className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Assigned To</label>
                <SearchableDropdown
                  value={addFormData.assigned_employee_id}
                  options={employeeOptions.map(e => ({ value: e.id, label: e.name }))}
                  onChange={(value) => setAddFormData({ ...addFormData, assigned_employee_id: value })}
                  placeholder="Select employee"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Add {addType}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Regenerate Modal */}
      {showRegenerateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Regenerate AI Plan</h3>
            <p className="text-sm text-slate-600 mb-4">
              Provide feedback to improve the AI-generated plan (e.g., "Add more tasks for testing" or "Make milestones shorter").
            </p>
            <textarea
              value={regenerateFeedback}
              onChange={(e) => setRegenerateFeedback(e.target.value)}
              placeholder="Enter your feedback here..."
              className="w-full p-2 border border-gray-300 rounded mb-4 resize-none"
              rows={4}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowRegenerateModal(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleRegenerateSubmit}
                disabled={!regenerateFeedback.trim()}
                className="px-4 py-2 bg-yellow-600 text-white rounded disabled:opacity-50"
              >
                Regenerate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resource Assignment Modal */}
      <ResourceAssignmentModal
        isOpen={showResourceModal}
        onClose={() => setShowResourceModal(false)}
        roles={detectedRoles}
        employees={employeeOptions}
        onAssign={handleResourceAssignment}
      />
    </div>
  )
}

export default ProjectGantt
