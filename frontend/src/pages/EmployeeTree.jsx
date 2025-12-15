import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { usePermissions } from '../context/PermissionContext.jsx'
import Header from '../components/Header.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import { getCookie } from '../utils/helpers.js'
import { TOKEN, getApiBaseUrl } from '../utils/constants.js'
import axios from 'axios'

const NODE_WIDTH = 220
const NODE_HEIGHT = 90
const HORIZONTAL_SPACING = 280  // Space between columns (left to right)
const VERTICAL_SPACING = 110     // Space between nodes in same column (up to down)

// Helper function to construct proper image URL
const getImageUrl = (photoUrl, apiBaseUrl) => {
  if (!photoUrl || typeof photoUrl !== 'string') return null
  
  const trimmedUrl = photoUrl.trim()
  if (!trimmedUrl) return null
  
  // If it's already a full URL (http/https), return as is
  if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
    return trimmedUrl
  }
  
  // If it starts with /, it's a relative path from the API base
  if (trimmedUrl.startsWith('/')) {
    return `${apiBaseUrl}${trimmedUrl}`
  }
  
  // Otherwise, assume it's relative to the API base
  return `${apiBaseUrl}/${trimmedUrl}`
}

// Employee Node Component
const EmployeeNode = ({ node, x, y, isCollapsed, onToggle, onAddClick, canEdit, selectedNode, onNodeClick }) => {
  const isSelected = selectedNode?.id === node.id
  
  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Node Container */}
      <g 
        className="cursor-pointer"
        onClick={() => onNodeClick && onNodeClick(node)}
      >
        {/* Background */}
        <rect
          width={NODE_WIDTH}
          height={NODE_HEIGHT}
          rx={8}
          fill={isSelected ? '#dcfce7' : 'white'}
          stroke={isSelected ? '#166534' : '#e2e8f0'}
          strokeWidth={isSelected ? 2 : 1}
          className="transition-all duration-200 hover:shadow-lg"
        />
        
        {/* Avatar */}
        <defs>
          <clipPath id={`avatar-clip-${node.id}`}>
            <circle cx={NODE_WIDTH / 2} cy={35} r={25} />
          </clipPath>
        </defs>
        {node.avatar ? (
          <image
            href={node.avatar}
            x={NODE_WIDTH / 2 - 25}
            y={10}
            width={50}
            height={50}
            clipPath={`url(#avatar-clip-${node.id})`}
            className="object-cover"
          />
        ) : (
          <>
            <circle
              cx={NODE_WIDTH / 2}
              cy={35}
              r={25}
              fill="#426653"
              className="flex items-center justify-center"
            />
            <text
              x={NODE_WIDTH / 2}
              y={40}
              textAnchor="middle"
              fill="white"
              fontSize="20"
              fontWeight="bold"
            >
              {node.name.charAt(0).toUpperCase()}
            </text>
          </>
        )}
        
        {/* Name */}
        <text
          x={NODE_WIDTH / 2}
          y={75}
          textAnchor="middle"
          fill="#1e293b"
          fontSize="13"
          fontWeight="600"
          className="select-none"
        >
          {node.name.length > 20 ? node.name.substring(0, 20) + '...' : node.name}
        </text>
        
        {/* Title */}
        <text
          x={NODE_WIDTH / 2}
          y={92}
          textAnchor="middle"
          fill="#64748b"
          fontSize="11"
          className="select-none"
        >
          {node.title ? (node.title.length > 25 ? node.title.substring(0, 25) + '...' : node.title) : 'No Title'}
        </text>
        
        {/* Team Size Badge */}
        {node.team_size > 0 && (
          <>
            <rect
              x={NODE_WIDTH - 45}
              y={5}
              width={40}
              height={20}
              rx={10}
              fill="#15803d"
              className="select-none"
            />
            <text
              x={NODE_WIDTH - 25}
              y={18}
              textAnchor="middle"
              fill="white"
              fontSize="11"
              fontWeight="bold"
              className="select-none"
            >
              {node.team_size}
            </text>
          </>
        )}
      </g>
      
      {/* Collapse/Expand Button (Right side for left-to-right layout) */}
      {node.children && node.children.length > 0 && (
        <circle
          cx={NODE_WIDTH + 15}
          cy={NODE_HEIGHT / 2}
          r={12}
          fill="#166534"
          className="cursor-pointer hover:fill-green-700 transition-colors"
          onClick={(e) => {
            e.stopPropagation()
            onToggle(node.id)
          }}
        />
      )}
      {node.children && node.children.length > 0 && (
        <text
          x={NODE_WIDTH + 15}
          y={NODE_HEIGHT / 2 + 5}
          textAnchor="middle"
          fill="white"
          fontSize="14"
          fontWeight="bold"
          className="cursor-pointer select-none"
          onClick={(e) => {
            e.stopPropagation()
            onToggle(node.id)
          }}
        >
          {isCollapsed ? '▶' : '◀'}
        </text>
      )}
      
      {/* Add Employee Button */}
      {canEdit && (
        <g
          className="cursor-pointer"
          onClick={(e) => {
            e.stopPropagation()
            onAddClick(node)
          }}
        >
          <circle
            cx={NODE_WIDTH - 20}
            cy={NODE_HEIGHT - 20}
            r={15}
            fill="#15803d"
            className="hover:fill-green-700 transition-colors"
          />
          <text
            x={NODE_WIDTH - 20}
            y={NODE_HEIGHT - 15}
            textAnchor="middle"
            fill="white"
            fontSize="18"
            fontWeight="bold"
            className="select-none"
          >
            +
          </text>
        </g>
      )}
    </g>
  )
}

// Connection Line Component (Left to Right)
const ConnectionLine = ({ x1, y1, x2, y2 }) => {
  const midX = (x1 + x2) / 2
  return (
    <path
      d={`M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`}
      fill="none"
      stroke="#cbd5e1"
      strokeWidth="2"
      markerEnd="url(#arrowhead)"
    />
  )
}

const EmployeeTree = () => {
  const { hasPermission, loading: permissionsLoading } = usePermissions()
  const [treeData, setTreeData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [collapsedNodes, setCollapsedNodes] = useState(new Set())
  const [selectedNode, setSelectedNode] = useState(null)
  const [rootEmployee, setRootEmployee] = useState(null) // Selected root employee for hierarchy
  const [showRootSelector, setShowRootSelector] = useState(true) // Show root selector initially
  const [lastClickTime, setLastClickTime] = useState(0)
  const [lastClickedNode, setLastClickedNode] = useState(null)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [assigningManager, setAssigningManager] = useState(null)
  const [allEmployees, setAllEmployees] = useState([])
  const [searchTerm, setSearchTerm] = useState('') // For assign modal
  const [rootEmployeeSearchTerm, setRootEmployeeSearchTerm] = useState('') // For root employee selector
  const [selectedEmployees, setSelectedEmployees] = useState([])
  const [assigning, setAssigning] = useState(false)
  const [showUnassignModal, setShowUnassignModal] = useState(false)
  const [unassigningManager, setUnassigningManager] = useState(null)
  const [selectedEmployeesToUnassign, setSelectedEmployeesToUnassign] = useState([])
  const [unassigning, setUnassigning] = useState(false)
  const [unassignSearchTerm, setUnassignSearchTerm] = useState('')
  const [parentEmployee, setParentEmployee] = useState(null) // Parent of current root employee
  const [failedImages, setFailedImages] = useState(new Set()) // Track which images failed to load
  
  // Column scroll state
  const [columnScrolls, setColumnScrolls] = useState({}) // { columnIndex: scrollPosition }
  const [horizontalScroll, setHorizontalScroll] = useState(0) // Horizontal scroll position of columns container
  const columnRefs = useRef({}) // Refs for each column container
  const columnsContainerRef = useRef(null) // Ref for the horizontal scrolling container
  const nodeRefs = useRef({}) // Refs for each node to get actual positions

  const apiBaseUrl = getApiBaseUrl()

  // Check permissions
  const canView = hasPermission('view-employee-tree')
  const canEdit = hasPermission('edit-employee-tree')

  // Fetch employee tree
  const fetchTree = useCallback(async () => {
    try {
      setLoading(true)
      const token = getCookie(TOKEN)
      const response = await axios.get(`${apiBaseUrl}/api/employee-tree`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      if (response.data.success) {
        setTreeData(response.data.tree || [])
      } else {
        setError(response.data.error || 'Failed to fetch employee tree')
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch employee tree')
      console.error('Error fetching tree:', err)
    } finally {
      setLoading(false)
    }
  }, [apiBaseUrl])

  // Fetch all employees for assignment
  const fetchAllEmployees = useCallback(async () => {
    try {
      const token = getCookie(TOKEN)
      const response = await axios.get(`${apiBaseUrl}/api/employee-tree/employees`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      if (response.data.success) {
        setAllEmployees(response.data.employees || [])
      }
    } catch (err) {
      console.error('Error fetching employees:', err)
    }
  }, [apiBaseUrl])

  // Identify main root/CEO employee
  const identifyMainRoot = useMemo(() => {
    if (!allEmployees.length || !treeData.length) return null
    
    // First, try to find CEO by title
    const ceo = allEmployees.find(emp => 
      emp.title && emp.title.toLowerCase().includes('ceo')
    )
    if (ceo) return ceo
    
    // If no CEO found, find the first root node from treeData
    if (treeData.length > 0) {
      const firstRootId = treeData[0].id
      const rootEmployee = allEmployees.find(emp => emp.id === firstRootId)
      if (rootEmployee) return rootEmployee
    }
    
    // Fallback: find employee with no reporting_manager_name
    const rootEmp = allEmployees.find(emp => 
      !emp.reporting_manager_name || emp.reporting_manager_name.trim() === ''
    )
    return rootEmp || null
  }, [allEmployees, treeData])

  useEffect(() => {
    if (canView) {
      fetchTree()
      fetchAllEmployees()
    }
  }, [canView, fetchTree, fetchAllEmployees])

  // Toggle node collapse
  const toggleNode = (nodeId) => {
    setCollapsedNodes(prev => {
      const newSet = new Set(prev)
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId)
      } else {
        newSet.add(nodeId)
      }
      return newSet
    })
  }

  // Build column structure (left to right)
  const buildColumns = (node, columnIndex = 0) => {
    if (!node) return []
    
    const columns = []
    const isCollapsed = collapsedNodes.has(node.id)
    const hasChildren = node.children && node.children.length > 0 && !isCollapsed
    
    // Add current node to current column
    if (!columns[columnIndex]) {
      columns[columnIndex] = []
    }
    columns[columnIndex].push({
      node,
      columnIndex,
      parentId: null
    })
    
    // Add children to next column
    if (hasChildren) {
      const childColumns = buildColumns(node.children[0], columnIndex + 1)
      // Merge child columns
      childColumns.forEach((col, idx) => {
        const actualColIndex = columnIndex + 1 + idx
        if (!columns[actualColIndex]) {
          columns[actualColIndex] = []
        }
        columns[actualColIndex].push(...col)
      })
      
      // Add remaining children
      for (let i = 1; i < node.children.length; i++) {
        const child = node.children[i]
        const childCols = buildColumns(child, columnIndex + 1)
        childCols.forEach((col, idx) => {
          const actualColIndex = columnIndex + 1 + idx
          if (!columns[actualColIndex]) {
            columns[actualColIndex] = []
          }
          // Add with parent reference
          col.forEach(item => {
            columns[actualColIndex].push({
              ...item,
              parentId: node.id
            })
          })
        })
      }
    }
    
    return columns
  }

  // Organize nodes into columns (properly maintaining hierarchy)
  const organizeIntoColumns = (node, columnIndex = 0, columns = [], parentId = null) => {
    if (!node) return columns
    
    const isCollapsed = collapsedNodes.has(node.id)
    const hasChildren = node.children && node.children.length > 0 && !isCollapsed
    
    // Ensure column exists
    if (!columns[columnIndex]) {
      columns[columnIndex] = []
    }
    
    // Check if node already exists in this column (avoid duplicates)
    const exists = columns[columnIndex].some(item => item.node.id === node.id)
    if (!exists) {
      // Add current node to column
      columns[columnIndex].push({
        node,
        parentId: parentId
      })
    }
    
    // Process children in next column
    if (hasChildren) {
      node.children.forEach((child) => {
        organizeIntoColumns(child, columnIndex + 1, columns, node.id)
      })
    }
    
    return columns
  }

  // Find employee in tree data
  const findEmployeeInTree = (tree, employeeId) => {
    for (const root of tree) {
      if (root.id === employeeId) {
        return root
      }
      const findInChildren = (node) => {
        if (node.id === employeeId) return node
        if (node.children) {
          for (const child of node.children) {
            const found = findInChildren(child)
            if (found) return found
          }
        }
        return null
      }
      const found = findInChildren(root)
      if (found) return found
    }
    return null
  }

  // Update tree node with new children (optimistic update)
  const updateTreeNodeWithChildren = (tree, managerId, newChildren) => {
    const updateNode = (node) => {
      if (node.id === managerId) {
        // Create a new node object with updated children
        const existingChildren = node.children || []
        const existingChildIds = new Set(existingChildren.map(c => c.id))
        
        // Only add children that don't already exist
        const childrenToAdd = newChildren.filter(child => !existingChildIds.has(child.id))
        
        // Calculate team_size increment: count of new children + their team_size
        const teamSizeIncrement = childrenToAdd.reduce((sum, child) => {
          return sum + 1 + (child.team_size || 0)
        }, 0)
        
        return {
          ...node,
          children: [...existingChildren, ...childrenToAdd],
          team_size: (node.team_size || 0) + teamSizeIncrement
        }
      }
      
      if (node.children && node.children.length > 0) {
        return {
          ...node,
          children: node.children.map(updateNode)
        }
      }
      
      return node
    }
    
    return tree.map(updateNode)
  }

  // Create child node from employee data
  const createChildNode = (employee) => {
    // Check if this employee already exists in the tree
    // If so, reuse that node structure (including children) for consistency
    const existingNode = findEmployeeInTree(treeData, employee.id)
    
    if (existingNode) {
      // Reuse existing node structure but create a new reference
      // This allows the same employee to appear under multiple managers
      return {
        ...existingNode,
        // Keep the existing children structure if any
        children: existingNode.children ? [...existingNode.children] : []
      }
    }
    
    // Create new node if employee doesn't exist in tree
    return {
      id: employee.id,
      name: employee.name,
      title: employee.title || '',
      avatar: employee.avatar,
      email: employee.email,
      employee_id: employee.employee_id,
      team_size: 0,
      children: []
    }
  }

  // Handle column scroll
  const handleColumnScroll = (columnIndex, direction) => {
    const columnElement = columnRefs.current[columnIndex]
    if (!columnElement) return
    
    const scrollAmount = 150 // pixels to scroll
    const currentScroll = columnElement.scrollTop
    const newScroll = direction === 'up' 
      ? Math.max(0, currentScroll - scrollAmount)
      : Math.min(columnElement.scrollHeight - columnElement.clientHeight, currentScroll + scrollAmount)
    
    columnElement.scrollTo({
      top: newScroll,
      behavior: 'smooth'
    })
    
    setColumnScrolls(prev => ({
      ...prev,
      [columnIndex]: newScroll
    }))
  }

  // Organize nodes into columns
  const displayNode = rootEmployee
  const columns = displayNode ? organizeIntoColumns(displayNode, 0, []) : []
  
  // Debug logging for columns
  useEffect(() => {
    if (displayNode) {
      console.log('Display Node:', displayNode)
      console.log('Display Node Children:', displayNode.children)
      console.log('Is Collapsed:', collapsedNodes.has(displayNode.id))
      console.log('Generated Columns:', columns)
      console.log('Columns Length:', columns.length)
      columns.forEach((col, idx) => {
        console.log(`Column ${idx}:`, col.length, 'nodes')
      })
    }
  }, [displayNode, columns.length, collapsedNodes])

  // Update scroll state when column is scrolled manually
  useEffect(() => {
    const handleScroll = (columnIndex) => {
      const columnElement = columnRefs.current[columnIndex]
      if (columnElement) {
        setColumnScrolls(prev => ({
          ...prev,
          [columnIndex]: columnElement.scrollTop
        }))
      }
    }

    // Add scroll listeners to all columns
    const cleanupFunctions = []
    Object.keys(columnRefs.current).forEach((key) => {
      const element = columnRefs.current[key]
      if (element) {
        const scrollHandler = () => handleScroll(parseInt(key))
        element.addEventListener('scroll', scrollHandler)
        cleanupFunctions.push(() => element.removeEventListener('scroll', scrollHandler))
      }
    })

    return () => {
      cleanupFunctions.forEach(cleanup => cleanup())
    }
  }, [columns.length, columnScrolls])

  // Handle horizontal scroll of columns container
  useEffect(() => {
    const container = columnsContainerRef.current
    if (!container) return

    const handleHorizontalScroll = () => {
      setHorizontalScroll(container.scrollLeft)
    }

    container.addEventListener('scroll', handleHorizontalScroll)
    return () => {
      container.removeEventListener('scroll', handleHorizontalScroll)
    }
  }, [columns.length])

  // Handle assign button click
  const handleAddClick = (node) => {
    if (!canEdit) return
    setAssigningManager(node)
    setShowAssignModal(true)
    setSelectedEmployees([])
    setSearchTerm('')
  }

  // Handle employee selection
  const handleEmployeeToggle = (employeeId) => {
    setSelectedEmployees(prev => {
      if (prev.includes(employeeId)) {
        return prev.filter(id => id !== employeeId)
      } else {
        return [...prev, employeeId]
      }
    })
  }

  // Handle select all
  const handleSelectAll = () => {
    // Only select employees that are not already assigned
    const availableEmployees = filteredEmployees.filter(emp => !emp.isAlreadyAssigned).map(emp => emp.id)
    const allSelected = availableEmployees.every(id => selectedEmployees.includes(id)) && availableEmployees.length > 0
    
    if (allSelected) {
      setSelectedEmployees(prev => prev.filter(id => !availableEmployees.includes(id)))
    } else {
      setSelectedEmployees(prev => [...new Set([...prev, ...availableEmployees])])
    }
  }

  // Check if an employee is already assigned to ANY manager in the entire tree
  const isEmployeeAssignedToAnyManager = (employeeId) => {
    if (!employeeId) return false
    
    // Helper function to check if employee is a child of any node in the tree
    const checkInNodeTree = (node) => {
      if (!node) return false
      
      // Check if this node has the employee as a direct child
      const existingChildren = node.children || []
      if (existingChildren.some(child => child.id === employeeId)) {
        return true
      }
      
      // Recursively check children
      if (node.children && node.children.length > 0) {
        for (const child of node.children) {
          if (checkInNodeTree(child)) {
            return true
          }
        }
      }
      
      return false
    }
    
    // Check in rootEmployee if it exists (for the current view)
    if (rootEmployee) {
      if (checkInNodeTree(rootEmployee)) {
        return true
      }
    }
    
    // Check in the full tree data
    for (const root of treeData) {
      if (checkInNodeTree(root)) {
        return true
      }
    }
    
    // Check in columns structure (the actual displayed structure)
    if (columns && columns.length > 0) {
      // Check all columns - if employee appears in any column (except column 0 as root),
      // it means they're assigned to someone
      for (let colIndex = 1; colIndex < columns.length; colIndex++) {
        const column = columns[colIndex]
        for (const item of column) {
          if (item.node.id === employeeId && item.parentId) {
            // Employee is in a column with a parent, meaning they're assigned
            return true
          }
        }
      }
      
      // Also check if any manager has this employee as a child
      for (let colIndex = 0; colIndex < columns.length; colIndex++) {
        const column = columns[colIndex]
        for (const item of column) {
          const existingChildren = item.node.children || []
          if (existingChildren.some(child => child.id === employeeId)) {
            return true
          }
        }
      }
    }
    
    return false
  }

  // Check if an employee is already a direct child of a specific manager (for backward compatibility)
  const isEmployeeAlreadyAssigned = (managerId, employeeId) => {
    if (!managerId || !employeeId) return false
    
    // Helper function to check if employee is a direct child of manager in a node tree
    const checkInNodeTree = (node) => {
      if (!node) return false
      
      if (node.id === managerId) {
        const existingChildren = node.children || []
        const isAssigned = existingChildren.some(child => child.id === employeeId)
        return isAssigned
      }
      
      if (node.children && node.children.length > 0) {
        for (const child of node.children) {
          const result = checkInNodeTree(child)
          if (result) return true
        }
      }
      
      return false
    }
    
    // First check in rootEmployee if it exists (for the current view)
    if (rootEmployee) {
      const result = checkInNodeTree(rootEmployee)
      if (result) return true
    }
    
    // Also check in the full tree data
    for (const root of treeData) {
      const result = checkInNodeTree(root)
      if (result) return true
    }
    
    // Also check in columns structure
    if (columns && columns.length > 0) {
      for (let colIndex = 0; colIndex < columns.length; colIndex++) {
        const column = columns[colIndex]
        for (const item of column) {
          if (item.node.id === managerId) {
            const existingChildren = item.node.children || []
            if (existingChildren.some(child => child.id === employeeId)) {
              return true
            }
          }
        }
      }
    }
    
    return false
  }

  // Filter employees (show all but mark already assigned as disabled)
  const filteredEmployees = useMemo(() => {
    return allEmployees.filter(emp => {
      // Exclude the manager themselves
      if (assigningManager && emp.id === assigningManager.id) return false
      
      // Apply search filter
      if (!searchTerm) return true
      const search = searchTerm.toLowerCase()
      return (
        emp.name.toLowerCase().includes(search) ||
        emp.email.toLowerCase().includes(search) ||
        emp.employee_id.toLowerCase().includes(search)
      )
    }).map(emp => ({
      ...emp,
      // Check if employee is assigned to ANY manager in the entire tree
      isAlreadyAssigned: isEmployeeAssignedToAnyManager(emp.id)
    }))
  }, [allEmployees, assigningManager, searchTerm, rootEmployee, treeData, columns])

  // Handle employee toggle for unassign modal
  const handleUnassignEmployeeToggle = (employeeId) => {
    setSelectedEmployeesToUnassign(prev => {
      if (prev.includes(employeeId)) {
        return prev.filter(id => id !== employeeId)
      } else {
        return [...prev, employeeId]
      }
    })
  }

  // Handle select all for unassign modal
  const handleUnassignSelectAll = () => {
    if (!unassigningManager || !unassigningManager.children) return
    
    const filteredChildren = getFilteredAssignedEmployees()
    const allSelected = filteredChildren.every(emp => selectedEmployeesToUnassign.includes(emp.id)) && filteredChildren.length > 0
    
    if (allSelected) {
      setSelectedEmployeesToUnassign([])
    } else {
      setSelectedEmployeesToUnassign(filteredChildren.map(emp => emp.id))
    }
  }

  // Get filtered assigned employees for unassign modal
  const getFilteredAssignedEmployees = () => {
    if (!unassigningManager || !unassigningManager.children) return []
    
    return unassigningManager.children.filter(child => {
      if (!unassignSearchTerm) return true
      const search = unassignSearchTerm.toLowerCase()
      return (
        child.name.toLowerCase().includes(search) ||
        child.email?.toLowerCase().includes(search) ||
        child.employee_id?.toLowerCase().includes(search) ||
        child.title?.toLowerCase().includes(search)
      )
    })
  }

  // Get count of employees to be unassigned
  const getEmployeesToUnassignCount = () => {
    if (!unassigningManager || !unassigningManager.children) return 0
    const allChildrenIds = unassigningManager.children.map(child => child.id)
    const employeesToKeep = selectedEmployeesToUnassign.filter(id => allChildrenIds.includes(id))
    return allChildrenIds.filter(id => !employeesToKeep.includes(id)).length
  }

  // Update tree node by removing children (for unassign)
  const updateTreeNodeByRemovingChildren = (tree, managerId, employeeIdsToRemove) => {
    const updateNode = (node) => {
      if (node.id === managerId) {
        const existingChildren = node.children || []
        const childrenToKeep = existingChildren.filter(child => !employeeIdsToRemove.includes(child.id))
        
        // Calculate team_size decrement: count of removed children + their team_size
        const removedChildren = existingChildren.filter(child => employeeIdsToRemove.includes(child.id))
        const teamSizeDecrement = removedChildren.reduce((sum, child) => {
          return sum + 1 + (child.team_size || 0)
        }, 0)
        
        return {
          ...node,
          children: childrenToKeep,
          team_size: Math.max(0, (node.team_size || 0) - teamSizeDecrement)
        }
      }
      
      if (node.children && node.children.length > 0) {
        return {
          ...node,
          children: node.children.map(updateNode)
        }
      }
      
      return node
    }
    
    return tree.map(updateNode)
  }

  // Handle unassign
  const handleUnassign = async () => {
    if (!unassigningManager) return

    try {
      setUnassigning(true)
      const token = getCookie(TOKEN)
      
      // Get the employees that will be unassigned (all children minus those selected to keep)
      const allChildrenIds = unassigningManager.children.map(child => child.id)
      const employeesToKeep = selectedEmployeesToUnassign.filter(id => allChildrenIds.includes(id))
      const employeesToUnassign = allChildrenIds.filter(id => !employeesToKeep.includes(id))
      
      if (employeesToUnassign.length === 0) {
        // No changes - all employees remain assigned
        setShowUnassignModal(false)
        setUnassigningManager(null)
        setSelectedEmployeesToUnassign([])
        setUnassignSearchTerm('')
        setUnassigning(false)
        return
      }
      
      // Optimistically update the UI before API call
      const updatedTree = updateTreeNodeByRemovingChildren(treeData, unassigningManager.id, employeesToUnassign)
      setTreeData(updatedTree)
      
      // Update root employee if needed
      if (rootEmployee) {
        if (rootEmployee.id === unassigningManager.id) {
          // Root employee is the manager being updated
          const existingChildren = rootEmployee.children || []
          const childrenToKeep = existingChildren.filter(child => !employeesToUnassign.includes(child.id))
          
          const removedChildren = existingChildren.filter(child => employeesToUnassign.includes(child.id))
          const teamSizeDecrement = removedChildren.reduce((sum, child) => {
            return sum + 1 + (child.team_size || 0)
          }, 0)
          
          setRootEmployee({
            ...rootEmployee,
            children: childrenToKeep,
            team_size: Math.max(0, (rootEmployee.team_size || 0) - teamSizeDecrement)
          })
        } else {
          // Root employee contains the manager somewhere in its subtree
          const updatedRootNode = findEmployeeInTree(updatedTree, rootEmployee.id)
          if (updatedRootNode) {
            setRootEmployee(updatedRootNode)
          } else {
            // Update rootEmployee's subtree recursively
            const updateRootSubtree = (node) => {
              if (node.id === unassigningManager.id) {
                const existingChildren = node.children || []
                const childrenToKeep = existingChildren.filter(child => !employeesToUnassign.includes(child.id))
                
                const removedChildren = existingChildren.filter(child => employeesToUnassign.includes(child.id))
                const teamSizeDecrement = removedChildren.reduce((sum, child) => {
                  return sum + 1 + (child.team_size || 0)
                }, 0)
                
                return {
                  ...node,
                  children: childrenToKeep,
                  team_size: Math.max(0, (node.team_size || 0) - teamSizeDecrement)
                }
              }
              
              if (node.children && node.children.length > 0) {
                return {
                  ...node,
                  children: node.children.map(updateRootSubtree)
                }
              }
              
              return node
            }
            
            setRootEmployee(updateRootSubtree(rootEmployee))
          }
        }
      }
      
      // Make API call to persist changes
      const response = await axios.post(
        `${apiBaseUrl}/api/employee-tree/unassign`,
        {
          manager_id: unassigningManager.id,
          employee_ids: employeesToUnassign
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      )

      if (response.data.success) {
        // Success - UI already updated optimistically
        setShowUnassignModal(false)
        setUnassigningManager(null)
        setSelectedEmployeesToUnassign([])
        setUnassignSearchTerm('')
      } else {
        // If API call failed, revert the optimistic update
        fetchTree()
        alert(response.data.error || 'Failed to unassign employees')
      }
    } catch (err) {
      // On error, revert the optimistic update by fetching fresh data
      fetchTree()
      alert(err.response?.data?.error || 'Failed to unassign employees')
    } finally {
      setUnassigning(false)
    }
  }

  // Handle assign
  const handleAssign = async () => {
    if (!assigningManager || selectedEmployees.length === 0) return

    try {
      setAssigning(true)
      const token = getCookie(TOKEN)
      
      // Filter out employees that are already assigned to ANY manager
      const validEmployeeIds = selectedEmployees.filter(empId => 
        !isEmployeeAssignedToAnyManager(empId)
      )
      
      if (validEmployeeIds.length === 0) {
        alert('All selected employees are already assigned to a manager in the tree')
        setAssigning(false)
        return
      }
      
      // Get employee data for the valid selected employees
      const employeesToAdd = allEmployees.filter(emp => validEmployeeIds.includes(emp.id))
      const newChildNodes = employeesToAdd.map(createChildNode)
      
      // Optimistically update the UI before API call
      const updatedTree = updateTreeNodeWithChildren(treeData, assigningManager.id, newChildNodes)
      setTreeData(updatedTree)
      
      // Ensure the manager node is expanded so new children are visible
      if (collapsedNodes.has(assigningManager.id)) {
        setCollapsedNodes(prev => {
          const newSet = new Set(prev)
          newSet.delete(assigningManager.id)
          return newSet
        })
      }
      
      // Update root employee - either directly if it's the manager, or find updated node in tree
      if (rootEmployee) {
        if (rootEmployee.id === assigningManager.id) {
          // Root employee is the manager being updated
          const existingChildren = rootEmployee.children || []
          const existingChildIds = new Set(existingChildren.map(c => c.id))
          const childrenToAdd = newChildNodes.filter(child => !existingChildIds.has(child.id))
          
          const teamSizeIncrement = childrenToAdd.reduce((sum, child) => {
            return sum + 1 + (child.team_size || 0)
          }, 0)
          
          setRootEmployee({
            ...rootEmployee,
            children: [...existingChildren, ...childrenToAdd],
            team_size: (rootEmployee.team_size || 0) + teamSizeIncrement
          })
        } else {
          // Root employee contains the manager somewhere in its subtree
          // Find the updated node in the new treeData and update rootEmployee accordingly
          const updatedRootNode = findEmployeeInTree(updatedTree, rootEmployee.id)
          if (updatedRootNode) {
            setRootEmployee(updatedRootNode)
          } else {
            // If not found in tree, update rootEmployee's subtree recursively
            const updateRootSubtree = (node) => {
              if (node.id === assigningManager.id) {
                const existingChildren = node.children || []
                const existingChildIds = new Set(existingChildren.map(c => c.id))
                const childrenToAdd = newChildNodes.filter(child => !existingChildIds.has(child.id))
                
                const teamSizeIncrement = childrenToAdd.reduce((sum, child) => {
                  return sum + 1 + (child.team_size || 0)
                }, 0)
                
                return {
                  ...node,
                  children: [...existingChildren, ...childrenToAdd],
                  team_size: (node.team_size || 0) + teamSizeIncrement
                }
              }
              
              if (node.children && node.children.length > 0) {
                return {
                  ...node,
                  children: node.children.map(updateRootSubtree)
                }
              }
              
              return node
            }
            
            setRootEmployee(updateRootSubtree(rootEmployee))
          }
        }
      }
      
      // Make API call to persist changes
      const response = await axios.post(
        `${apiBaseUrl}/api/employee-tree/assign`,
        {
          manager_id: assigningManager.id,
          employee_ids: validEmployeeIds
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      )

      if (response.data.success) {
        // Success - UI already updated optimistically
        setShowAssignModal(false)
        setAssigningManager(null)
        setSelectedEmployees([])
        // Optionally show a success message
        // You can add a toast notification here if needed
      } else {
        // If API call failed, revert the optimistic update
        fetchTree()
        alert(response.data.error || 'Failed to assign employees')
      }
    } catch (err) {
      // On error, revert the optimistic update by fetching fresh data
      fetchTree()
      alert(err.response?.data?.error || 'Failed to assign employees')
    } finally {
      setAssigning(false)
    }
  }

  // Handle root employee selection
  const handleRootSelect = async (employee) => {
    // Clear search term when employee is selected
    setRootEmployeeSearchTerm('')
    
    try {
      setLoading(true)
      const token = getCookie(TOKEN)
      
      // Fetch the employee's subtree from the API (includes parent info)
      const response = await axios.get(
        `${apiBaseUrl}/api/employee-tree/employee/${employee.id}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      )
      
      if (response.data.success && response.data.tree) {
        // Log debug information
        if (response.data.debug) {
          console.log('Employee Tree Debug Info:', response.data.debug)
          console.log('Tree Node:', response.data.tree)
          console.log('Children Count:', response.data.tree?.children?.length || 0)
          console.log('Children:', response.data.tree?.children)
        }
        
        // Set parent employee from API response
        setParentEmployee(response.data.parent || null)
        
        // Ensure root node is expanded (remove from collapsed set if present)
        setCollapsedNodes(prev => {
          const newSet = new Set(prev)
          newSet.delete(response.data.tree.id)
          return newSet
        })
        
        // Use the subtree returned from the API
        setRootEmployee(response.data.tree)
        setShowRootSelector(false)
        setSelectedNode(response.data.tree)
        
        // Additional logging
        console.log('Root Employee Set:', response.data.tree)
        console.log('Has Children:', response.data.tree?.children && response.data.tree.children.length > 0)
        console.log('Parent Employee:', response.data.parent)
      } else {
        // Fallback: create a simple node structure if API fails
        setParentEmployee(null)
        setRootEmployee({
          id: employee.id,
          name: employee.name,
          title: employee.title,
          avatar: employee.avatar,
          team_size: 0,
          children: []
        })
        setShowRootSelector(false)
        setSelectedNode({
          id: employee.id,
          name: employee.name,
          title: employee.title,
          avatar: employee.avatar
        })
      }
    } catch (err) {
      console.error('Error fetching employee subtree:', err)
      // Fallback: create a simple node structure on error
      setParentEmployee(null)
      setRootEmployee({
        id: employee.id,
        name: employee.name,
        title: employee.title,
        avatar: employee.avatar,
        team_size: 0,
        children: []
      })
      setShowRootSelector(false)
      setSelectedNode({
        id: employee.id,
        name: employee.name,
        title: employee.title,
        avatar: employee.avatar
      })
    } finally {
      setLoading(false)
    }
  }

  // Handle node click - set as new root on double click, show unassign modal on single click if has children
  const handleNodeClick = (node) => {
    const now = Date.now()
    const timeDiff = now - lastClickTime
    
    // Check for double click (within 300ms)
    if (lastClickedNode?.id === node.id && timeDiff < 300) {
      // Fetch the subtree to get parent info
      handleRootSelect({
        id: node.id,
        name: node.name,
        title: node.title,
        avatar: node.avatar
      })
      setLastClickTime(0)
      setLastClickedNode(null)
    } else {
      setSelectedNode(node)
      setLastClickTime(now)
      setLastClickedNode(node)
      
      // If node has children and user has edit permission, show unassign modal
      if (canEdit && node.children && node.children.length > 0) {
        setUnassigningManager(node)
        setShowUnassignModal(true)
        // Pre-select all assigned employees
        setSelectedEmployeesToUnassign(node.children.map(child => child.id))
        setUnassignSearchTerm('')
      }
    }
  }

  // Handle team size badge click - show assigned employees in new column
  const handleTeamSizeClick = (node, e) => {
    e.stopPropagation()
    if (node.children && node.children.length > 0) {
      // Expand the node if collapsed
      if (collapsedNodes.has(node.id)) {
        toggleNode(node.id)
      }
      // The children will automatically show in the next column
      // Scroll to the first child if needed
      setTimeout(() => {
        const firstChild = node.children[0]
        if (firstChild) {
          const childElement = document.getElementById(`node-${firstChild.id}`)
          if (childElement) {
            childElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        }
      }, 100)
    }
  }

  // Find path from root to selected employee
  const findPathToNode = (rootNode, targetId, path = []) => {
    if (!rootNode) return null
    
    const currentPath = [...path, rootNode.id]
    
    if (rootNode.id === targetId) {
      return currentPath
    }
    
    if (rootNode.children && rootNode.children.length > 0) {
      for (const child of rootNode.children) {
        const result = findPathToNode(child, targetId, currentPath)
        if (result) return result
      }
    }
    
    return null
  }

  // Get path from root to selected node
  const selectedPath = selectedNode && rootEmployee 
    ? findPathToNode(rootEmployee, selectedNode.id) 
    : null

  // Show loader while permissions are being fetched
  if (permissionsLoading) {
    return (
      <div className="min-h-screen bg-slate-100">
        <Header />
        <main className="max-w-[97%] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
              <p className="text-slate-600">Loading Employee Tree...</p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (!canView) {
    return (
      <div className="min-h-screen bg-slate-100">
        <Header />
        <main className="max-w-[100%] mx-auto px-2 sm:px-2 lg:px-2 py-2">
          <div className="card p-8 text-center">
            <div className="mx-auto w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Access Denied</h2>
            <p className="text-slate-600">You don't have permission to view Employee Tree.</p>
          </div>
        </main>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100">
        <Header />
        <main className="max-w-[97%] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingSpinner message="Loading employee tree..." fullScreen={false} />
        </main>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-100">
        <Header />
        <main className="max-w-[97%] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <Header />
      <main className="max-w-[97%] mx-auto px-4 sm:px-6 lg:px-8 py-8">
         <div className="bg-white p-4 animate-slide-in">
           <div className="flex justify-between items-center mb-3">
             <div>
               <h1 className="text-xl font-semibold text-slate-900 mb-1">Employee Tree</h1>
             </div>
              <div className="flex gap-2 items-center">
                {columns.length > 0 && (
                  <div className="text-sm text-slate-500">
                    {columns.length} Column{columns.length !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
           </div>

          {/* Root Employee Selector */}
          {showRootSelector && (
            <div className="mb-4 p-4 bg-slate-50 rounded-lg border border-slate-200" style={{ height: 'fit-content' }}>
              <p className="text-sm font-medium text-slate-700 mb-3">Select an employee to view their hierarchy:</p>
              
              {/* Search Bar */}
              <div className="mb-3">
                <input
                  type="text"
                  placeholder="Search employees by name, email, or employee ID..."
                  value={rootEmployeeSearchTerm}
                  onChange={(e) => setRootEmployeeSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                />
              </div>
              
              <div className="max-h-70 overflow-y-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                <style>{`
                  div::-webkit-scrollbar {
                    display: none;
                    width: 0;
                    height: 0;
                  }
                `}</style>
                {(() => {
                  // Filter employees based on search term
                  let filteredRootEmployees = allEmployees.filter(emp => {
                    if (!rootEmployeeSearchTerm) return true
                    const search = rootEmployeeSearchTerm.toLowerCase()
                    return (
                      emp.name.toLowerCase().includes(search) ||
                      emp.email?.toLowerCase().includes(search) ||
                      emp.employee_id?.toLowerCase().includes(search) ||
                      emp.title?.toLowerCase().includes(search)
                    )
                  })
                  
                  // Sort: main root first, then others
                  const mainRootId = identifyMainRoot?.id
                  filteredRootEmployees = filteredRootEmployees.sort((a, b) => {
                    if (a.id === mainRootId) return -1
                    if (b.id === mainRootId) return 1
                    return 0
                  })
                  
                  if (filteredRootEmployees.length === 0) {
                    return (
                      <div className="text-center py-8 text-slate-500 text-sm">
                        No employees found matching "{rootEmployeeSearchTerm}"
                      </div>
                    )
                  }
                  
                  return (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                      {filteredRootEmployees.map((emp) => {
                        const isMainRoot = identifyMainRoot && emp.id === identifyMainRoot.id
                        return (
                          <button
                            key={emp.id}
                            onClick={() => handleRootSelect(emp)}
                            className={`flex items-center gap-2 p-2 rounded-lg transition-colors text-left relative ${
                              isMainRoot
                                ? 'bg-green-50 border-2 border-green-500 hover:bg-green-100 hover:border-green-600 shadow-sm'
                                : 'bg-white border border-slate-300 hover:bg-slate-50 hover:border-green-500'
                            }`}
                          >
                            {isMainRoot && (
                              <div className="absolute top-1 right-1 z-10">
                                <div className="bg-green-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                                  <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M9.504 1.132a1 1 0 01.992 0l1.75 1a1 1 0 11-.992 1.736L10 3.152l-1.254.716a1 1 0 11-.992-1.736l1.75-1zM5.618 4.504a1 1 0 01-.372 1.364L5.016 6l.23.132a1 1 0 11-.992 1.736L3 7.723V8a1 1 0 01-2 0V6a.996.996 0 01.52-.878l1.734-.99a1 1 0 011.364.372zm8.764 0a1 1 0 011.364-.372l1.734.99A.996.996 0 0118 6v2a1 1 0 11-2 0v-.277l-1.254.145a1 1 0 11-.992-1.736L14.984 6l-.23-.132a1 1 0 01-.372-1.364zm-7 4a1 1 0 011.364-.372L10 8.848l1.254-.716a1 1 0 11.992 1.736L11 10.723V12a1 1 0 11-2 0v-1.277l-1.246-.855a1 1 0 01-.372-1.364zM3 11a1 1 0 011 1v1.277l1.246.855a1 1 0 11-.992 1.736l-1.75-1A1 1 0 012 14v-2a1 1 0 011-1zm14 0a1 1 0 011 1v2a1 1 0 01-.504.868l-1.75 1a1 1 0 11-.992-1.736L16 13.277V12a1 1 0 011-1zm-9.618 5.504a1 1 0 01.372 1.364l-.254.145V16a1 1 0 112 0v.013l-.254-.145a1 1 0 01-.372-1.364z" clipRule="evenodd" />
                                  </svg>
                                  MAIN ROOT
                                </div>
                              </div>
                            )}
                            {emp.avatar && !failedImages.has(emp.id) ? (
                              <img 
                                src={getImageUrl(emp.avatar, apiBaseUrl) || emp.avatar} 
                                alt={emp.name} 
                                className={`w-8 h-8 rounded-full object-cover ${isMainRoot ? 'ring-2 ring-green-500' : ''}`}
                                onError={(e) => {
                                  // Mark this image as failed
                                  setFailedImages(prev => new Set(prev).add(emp.id))
                                  e.target.style.display = 'none'
                                }}
                                onLoad={(e) => {
                                  // Ensure image is visible on successful load
                                  e.target.style.display = 'block'
                                }}
                              />
                            ) : null}
                            <div 
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold ${
                                isMainRoot ? 'bg-green-600 ring-2 ring-green-500' : 'bg-[#426653]'
                              }`}
                              style={{ display: (emp.avatar && !failedImages.has(emp.id)) ? 'none' : 'flex' }}
                            >
                              {emp.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs font-medium truncate ${
                                isMainRoot ? 'text-green-900 font-semibold' : 'text-slate-900'
                              }`}>
                                {emp.name}
                              </p>
                              <p className={`text-xs truncate ${
                                isMainRoot ? 'text-green-700' : 'text-slate-500'
                              }`}>
                                {emp.title || 'No Title'}
                              </p>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )
                })()}
              </div>
            </div>
          )}

          {/* Change Root Employee Button */}
          {!showRootSelector && rootEmployee && (
            <div className="mb-1 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-600">Viewing hierarchy for:</span>
                <span className="text-sm font-semibold text-slate-900">{rootEmployee.name}</span>
              </div>
              <div className="flex items-center gap-2">
                {parentEmployee && (
                  <button
                    onClick={async () => {
                      // Navigate to parent employee
                      await handleRootSelect(parentEmployee)
                    }}
                    className="px-3 py-1.5 text-sm bg-green-50 hover:bg-green-100 border border-green-300 text-green-700 rounded-lg transition-colors flex items-center gap-2"
                    title={`View ${parentEmployee.name}'s hierarchy`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
                    </svg>
                    <span className="hidden sm:inline">
                      <span className="font-medium">↑</span> {parentEmployee.name.split(' ').slice(0, 2).join(' ')}
                    </span>
                    <span className="sm:hidden">↑</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowRootSelector(true)
                    setRootEmployee(null)
                    setSelectedNode(null)
                    setParentEmployee(null)
                    setRootEmployeeSearchTerm('') // Clear search when reopening selector
                  }}
                  className="px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition-colors"
                >
                  Change Employee
                </button>
              </div>
            </div>
          )}

          {/* Org Chart Container - Column Layout */}
          <div className="w-full h-[calc(100vh-10px)] border border-slate-200 rounded-lg overflow-hidden bg-white relative">
            {columns.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-slate-500">Select an employee to view their hierarchy</p>
              </div>
            ) : columns.length === 1 && rootEmployee && (!rootEmployee.children || rootEmployee.children.length === 0) ? (
              <div className="flex flex-col items-center justify-center h-full">
                <div className="text-center p-8">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">No Direct Reports</h3>
                  <p className="text-slate-600 mb-4">
                    {rootEmployee.name} doesn't have any employees reporting to them yet.
                  </p>
                  {canEdit && (
                    <p className="text-sm text-slate-500">
                      Click the <span className="font-semibold">+</span> button on the employee card to assign direct reports.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="relative h-full">
                {/* Connection Lines Overlay (SVG) */}
                <svg className="absolute inset-0 pointer-events-none z-0" style={{ width: '100%', height: '100%' }}>
                  {/* Build a map of all nodes with their positions and draw lines for ALL relationships */}
                  {(() => {
                    // First, build a complete map of all nodes with their positions
                    const nodePositionMap = new Map()
                    columns.forEach((column, colIndex) => {
                      column.forEach((item, rowIndex) => {
                        nodePositionMap.set(item.node.id, {
                          columnIndex: colIndex,
                          rowIndex: rowIndex,
                          node: item.node
                        })
                      })
                    })
                    
                    // Now, iterate through ALL nodes and draw lines for every parent-child relationship
                    const allLines = []
                    
                    // Use the tree structure to find all relationships
                    const processNode = (node, parentColumnIndex = null, parentRowIndex = null) => {
                      if (!node) return
                      
                      const isCollapsed = collapsedNodes.has(node.id)
                      const hasChildren = node.children && node.children.length > 0 && !isCollapsed
                      
                      // Get current node's position
                      const currentNodePos = nodePositionMap.get(node.id)
                      if (!currentNodePos) return
                      
                      const currentColumnIndex = currentNodePos.columnIndex
                      const currentRowIndex = currentNodePos.rowIndex
                      
                       // If this node has a parent, draw T-junction pattern line from parent to this node
                       if (parentColumnIndex !== null && parentRowIndex !== null && parentColumnIndex < currentColumnIndex) {
                         const parentColumnScroll = columnScrolls[parentColumnIndex] || 0
                         const childColumnScroll = columnScrolls[currentColumnIndex] || 0
                         
                         const headerHeight = 32
                         const columnPadding = 8 // p-2 = 8px
                         const nodeGap = 8 // space-y-2 = 8px gap between nodes
                         
                         // Calculate exact Y positions at the vertical center of each node
                         // Formula: header + padding + (rowIndex * (nodeHeight + gap)) + (nodeHeight / 2)
                         const baseParentY = headerHeight + columnPadding + (parentRowIndex * (NODE_HEIGHT + nodeGap)) + (NODE_HEIGHT / 2)
                         const baseChildY = headerHeight + columnPadding + (currentRowIndex * (NODE_HEIGHT + nodeGap)) + (NODE_HEIGHT / 2)
                         
                         // Adjust for scroll position
                         const parentY = baseParentY - parentColumnScroll
                         const childY = baseChildY - childColumnScroll
                         
                         const columnWidth = NODE_WIDTH + 60
                         // Parent X: right edge at exact center (column start + padding + node width)
                         // Adjust for horizontal scroll
                         const parentX = (parentColumnIndex * columnWidth) + columnPadding + NODE_WIDTH - horizontalScroll
                         // Child X: left edge at exact center (column start + padding)
                         const childX = (currentColumnIndex * columnWidth) + columnPadding - horizontalScroll
                         
                         // Get parent node to check for siblings
                         const parentNode = columns[parentColumnIndex]?.[parentRowIndex]?.node
                         const parentChildren = parentNode?.children || []
                         const currentChildIndex = parentChildren.findIndex(c => c.id === node.id)
                         
                         // Calculate vertical trunk position (center Y of all children)
                         // Find all sibling positions to calculate trunk center
                         const siblingPositions = parentChildren
                           .map(child => nodePositionMap.get(child.id))
                           .filter(Boolean)
                           .map(pos => {
                             const scroll = columnScrolls[pos.columnIndex] || 0
                             return headerHeight + columnPadding + (pos.rowIndex * (NODE_HEIGHT + nodeGap)) + (NODE_HEIGHT / 2) - scroll
                           })
                         
                         const trunkY = siblingPositions.length > 0 
                           ? (Math.min(...siblingPositions) + Math.max(...siblingPositions)) / 2
                           : parentY
                         
                         // Horizontal branch position (midpoint between columns)
                         const branchX = (parentX + childX) / 2
                         
                         // Check if this connection is part of the selected path
                         const isInSelectedPath = selectedPath && parentNode &&
                           selectedPath.includes(parentNode.id) && 
                           selectedPath.includes(node.id) &&
                           selectedPath.indexOf(parentNode.id) === selectedPath.indexOf(node.id) - 1
                         
                         // Draw connection lines: parent center -> child center
                         // Pattern: Horizontal from parent -> Vertical trunk -> Horizontal to child
                         allLines.push(
                           <g key={`line-${parentNode?.id || 'unknown'}-${node.id}`}>
                             {/* Step 1: Horizontal line from parent node center to vertical trunk */}
                             <line
                               x1={parentX}
                               y1={parentY}
                               x2={branchX}
                               y2={parentY}
                               stroke={isInSelectedPath ? "#166534" : "#cbd5e1"}
                               strokeWidth={isInSelectedPath ? "3" : "2"}
                               opacity={isInSelectedPath ? "1" : "0.6"}
                             />
                             
                             {/* Step 2: Vertical trunk from parent level to child level */}
                             <line
                               x1={branchX}
                               y1={parentY}
                               x2={branchX}
                               y2={childY}
                               stroke={isInSelectedPath ? "#166534" : "#cbd5e1"}
                               strokeWidth={isInSelectedPath ? "3" : "2"}
                               opacity={isInSelectedPath ? "1" : "0.6"}
                             />
                             
                             {/* Step 3: Horizontal line from vertical trunk to child node center */}
                             <line
                               x1={branchX}
                               y1={childY}
                               x2={childX}
                               y2={childY}
                               stroke={isInSelectedPath ? "#166534" : "#cbd5e1"}
                               strokeWidth={isInSelectedPath ? "3" : "2"}
                               opacity={isInSelectedPath ? "1" : "0.6"}
                             />
                           </g>
                         )
                       }
                      
                      // Process children
                      if (hasChildren) {
                        node.children.forEach((child) => {
                          const childPos = nodePositionMap.get(child.id)
                          if (childPos) {
                            processNode(child, currentColumnIndex, currentRowIndex)
                          }
                        })
                      }
                    }
                    
                    // Start processing from root
                    if (rootEmployee) {
                      processNode(rootEmployee)
                    }
                    
                    return allLines
                  })()}
                  
                </svg>
                
                {/* Columns */}
                <div 
                  ref={columnsContainerRef}
                  className="flex h-full overflow-x-auto relative z-10" 
                  style={{ overflowY: 'hidden' }}
                  onScroll={(e) => {
                    setHorizontalScroll(e.target.scrollLeft)
                  }}
                >
                  {columns.map((column, columnIndex) => {
                    const columnLabel = String.fromCharCode(65 + columnIndex) // A, B, C, etc.
                    const columnElement = columnRefs.current[columnIndex]
                    const currentScroll = columnElement?.scrollTop || 0
                    const canScrollUp = currentScroll > 0
                    const canScrollDown = columnElement 
                      ? columnElement.scrollHeight > columnElement.clientHeight + currentScroll + 10
                      : false
                    
                    return (
                      <div
                        key={columnIndex}
                        className="flex-shrink-0 border-r border-slate-200 last:border-r-0 relative"
                        style={{ width: `${NODE_WIDTH + 60}px` }}
                      >
                        {/* Column Header - Zoho Style (minimal) */}
                        <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-2 py-1.5 flex items-center justify-between min-h-[32px]">
                          <span className="text-xs font-medium text-slate-600">{columnLabel}</span>
                          <div className="flex flex-col gap-0.5">
                            <button
                              onClick={() => handleColumnScroll(columnIndex, 'up')}
                              disabled={!canScrollUp}
                              className="w-5 h-5 flex items-center justify-center bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              title="Scroll Up"
                            >
                              <svg className="w-2.5 h-2.5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleColumnScroll(columnIndex, 'down')}
                              disabled={!canScrollDown}
                              className="w-5 h-5 flex items-center justify-center bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              title="Scroll Down"
                            >
                              <svg className="w-2.5 h-2.5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        
                        {/* Column Content - Scrollable */}
                        <div
                          ref={el => {
                            if (el) columnRefs.current[columnIndex] = el
                          }}
                          className="overflow-y-auto h-[calc(100%-32px)]"
                          style={{ 
                            scrollBehavior: 'smooth',
                            scrollbarWidth: 'none', // Firefox
                            msOverflowStyle: 'none', // IE and Edge
                          }}
                          onScroll={(e) => {
                            e.stopPropagation() // Prevent event bubbling
                            setColumnScrolls(prev => ({
                              ...prev,
                              [columnIndex]: e.target.scrollTop
                            }))
                          }}
                          onWheel={(e) => {
                            e.stopPropagation() // Prevent scrolling parent
                          }}
                        >
                          <style>{`
                            div::-webkit-scrollbar {
                              display: none; /* Chrome, Safari, Opera */
                              width: 0;
                              height: 0;
                            }
                          `}</style>
                          <div className="px-2 pt-2 pb-8 space-y-2">
                            {column.map((item, rowIndex) => {
                              const node = item.node
                              const isCollapsed = collapsedNodes.has(node.id)
                              const hasChildren = node.children && node.children.length > 0 && !isCollapsed
                              
                              // Get scroll position for this column to adjust line positions
                              const columnScroll = columnScrolls[columnIndex] || 0
                              
                              return (
                                <div 
                                  key={node.id} 
                                  id={`node-${node.id}`}
                                  className="relative"
                                  data-row-index={rowIndex}
                                  data-column-index={columnIndex}
                                  data-node-y={16 + 32 + (rowIndex * (NODE_HEIGHT + VERTICAL_SPACING)) + (NODE_HEIGHT / 2) - columnScroll}
                                >
                                  {/* Employee Card - Horizontal Layout */}
                                  <div
                                    className={`bg-white rounded-lg border p-2 cursor-pointer transition-all relative flex items-center gap-3 ${
                                      selectedNode?.id === node.id
                                        ? 'border-green-700 bg-green-50 shadow-sm'
                                        : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
                                    }`}
                                    style={{ width: `${NODE_WIDTH}px`, height: `${NODE_HEIGHT}px` }}
                                    onClick={() => handleNodeClick(node)}
                                  >
                                    {/* Avatar - Left Side */}
                                    <div className="flex-shrink-0">
                                      {node.avatar && !failedImages.has(node.id) ? (
                                        <img
                                          src={getImageUrl(node.avatar, apiBaseUrl) || node.avatar}
                                          alt={node.name}
                                          className="w-12 h-12 rounded-full object-cover border-2 border-slate-200"
                                          onError={(e) => {
                                            setFailedImages(prev => new Set(prev).add(node.id))
                                            e.target.style.display = 'none'
                                          }}
                                        />
                                      ) : null}
                                      <div 
                                        className="w-12 h-12 rounded-full bg-slate-300 flex items-center justify-center text-slate-600 font-semibold text-base border-2 border-slate-200"
                                        style={{ display: (node.avatar && !failedImages.has(node.id)) ? 'none' : 'flex' }}
                                      >
                                        {node.name.charAt(0).toUpperCase()}
                                      </div>
                                    </div>
                                    
                                    {/* Name and Title - Right Side */}
                                    <div className="flex-1 min-w-0">
                                      {/* Name */}
                                      <h3 className="text-sm font-semibold text-slate-900 mb-0.5 truncate" title={node.name}>
                                        {node.name}
                                      </h3>
                                      
                                      {/* Title */}
                                      <p className="text-xs text-slate-500 truncate" title={node.title}>
                                        {node.title || 'No Title'}
                                      </p>
                                    </div>
                                    
                                    {/* Team Size Badge - Top Right */}
                                    {node.team_size > 0 && (
                                      <button
                                        onClick={(e) => handleTeamSizeClick(node, e)}
                                        className="absolute top-1.5 right-1.5 bg-green-700 text-white text-xs font-semibold px-1.5 py-0.5 rounded hover:bg-green-800 transition-colors cursor-pointer z-20 shadow-sm"
                                        title={`Click to view ${node.team_size} assigned employee(s)`}
                                      >
                                        {node.team_size}
                                      </button>
                                    )}
                                    
                                    {/* Collapse/Expand Button - Right Edge */}
                                    {hasChildren && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          toggleNode(node.id)
                                        }}
                                        className="absolute -right-2 top-1/2 transform -translate-y-1/2 w-5 h-5 bg-green-700 text-white rounded-full flex items-center justify-center hover:bg-green-800 transition-colors z-10 shadow-sm"
                                        title={isCollapsed ? 'Expand' : 'Collapse'}
                                      >
                                        <span className="text-[10px] font-bold">{isCollapsed ? '▶' : '◀'}</span>
                                      </button>
                                    )}
                                    
                                    {/* Add Employee Button - Bottom Right */}
                                    {canEdit && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleAddClick(node)
                                        }}
                                        className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-700 text-white rounded-full flex items-center justify-center hover:bg-green-800 transition-colors z-10 shadow-sm"
                                        title="Add Employee"
                                      >
                                        <span className="text-xs font-bold">+</span>
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Assign Employee Modal */}
      {showAssignModal && assigningManager && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-900">
                Assign Employees to {assigningManager.name}
              </h2>
            </div>

            <div className="p-6 flex-1 overflow-hidden flex flex-col">
              {/* Search */}
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Search employees..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              {/* Select All */}
              {filteredEmployees.length > 0 && (
                <div className="mb-3 pb-3 border-b border-slate-200">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filteredEmployees.filter(emp => !emp.isAlreadyAssigned).every(emp => selectedEmployees.includes(emp.id)) && filteredEmployees.filter(emp => !emp.isAlreadyAssigned).length > 0}
                      onChange={handleSelectAll}
                      className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                      disabled={filteredEmployees.filter(emp => !emp.isAlreadyAssigned).length === 0}
                    />
                    <span className="text-sm font-medium text-slate-700">
                      Select All ({filteredEmployees.filter(emp => !emp.isAlreadyAssigned).length} available)
                    </span>
                  </label>
                </div>
              )}

              {/* Employee List */}
              <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                <style>{`
                  div::-webkit-scrollbar {
                    display: none;
                    width: 0;
                    height: 0;
                  }
                `}</style>
                {filteredEmployees.length === 0 ? (
                  <p className="text-slate-500 text-center py-8">No employees found</p>
                ) : (
                  <div className="space-y-2">
                    {filteredEmployees.map((emp) => {
                      const isDisabled = emp.isAlreadyAssigned
                      return (
                        <label
                          key={emp.id}
                          className={`flex items-center gap-3 p-3 rounded-lg ${
                            isDisabled 
                              ? 'bg-slate-100 opacity-60 cursor-not-allowed' 
                              : 'hover:bg-slate-50 cursor-pointer'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedEmployees.includes(emp.id)}
                            onChange={() => !isDisabled && handleEmployeeToggle(emp.id)}
                            disabled={isDisabled}
                            className="w-4 h-4 text-green-600 rounded focus:ring-green-500 disabled:cursor-not-allowed"
                          />
                          <div className="flex items-center gap-3 flex-1">
                            {emp.avatar && !failedImages.has(emp.id) ? (
                              <img
                                src={getImageUrl(emp.avatar, apiBaseUrl) || emp.avatar}
                                alt={emp.name}
                                className={`w-10 h-10 rounded-full object-cover ${isDisabled ? 'opacity-50' : ''}`}
                                onError={(e) => {
                                  setFailedImages(prev => new Set(prev).add(emp.id))
                                  e.target.style.display = 'none'
                                }}
                              />
                            ) : null}
                            <div 
                              className={`w-10 h-10 rounded-full bg-[#426653] flex items-center justify-center text-white font-semibold ${isDisabled ? 'opacity-50' : ''}`}
                              style={{ display: (emp.avatar && !failedImages.has(emp.id)) ? 'none' : 'flex' }}
                            >
                              {emp.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1">
                              <p className={`text-sm font-medium ${isDisabled ? 'text-slate-400' : 'text-slate-900'}`}>
                                {emp.name}
                                {isDisabled && (
                                  <span className="ml-2 text-xs text-slate-400 italic">(Already assigned)</span>
                                )}
                              </p>
                              <p className={`text-xs ${isDisabled ? 'text-slate-300' : 'text-slate-500'}`}>
                                {emp.title || 'No Title'}
                              </p>
                            </div>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex gap-3">
              <button
                onClick={() => {
                  setShowAssignModal(false)
                  setAssigningManager(null)
                  setSelectedEmployees([])
                  setSearchTerm('')
                }}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50"
                disabled={assigning}
              >
                Cancel
              </button>
              <button
                onClick={handleAssign}
                disabled={selectedEmployees.length === 0 || assigning}
                className="flex-1 px-4 py-2 bg-green-700 text-white rounded-lg font-medium hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {assigning ? 'Assigning...' : `Assign (${selectedEmployees.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unassign Employee Modal */}
      {showUnassignModal && unassigningManager && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-900">
                Unassign Employees from {unassigningManager.name}
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                Uncheck employees to remove them from this manager
              </p>
            </div>

            <div className="p-6 flex-1 overflow-hidden flex flex-col">
              {/* Search */}
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Search assigned employees..."
                  value={unassignSearchTerm}
                  onChange={(e) => setUnassignSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              {/* Select All */}
              {(() => {
                const filteredChildren = getFilteredAssignedEmployees()
                return filteredChildren.length > 0 && (
                  <div className="mb-3 pb-3 border-b border-slate-200">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filteredChildren.every(emp => selectedEmployeesToUnassign.includes(emp.id)) && filteredChildren.length > 0}
                        onChange={handleUnassignSelectAll}
                        className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                      />
                      <span className="text-sm font-medium text-slate-700">
                        Select All ({filteredChildren.length} assigned)
                      </span>
                    </label>
                  </div>
                )
              })()}

              {/* Employee List */}
              <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                <style>{`
                  div::-webkit-scrollbar {
                    display: none;
                    width: 0;
                    height: 0;
                  }
                `}</style>
                {(() => {
                  const filteredChildren = getFilteredAssignedEmployees()
                  if (filteredChildren.length === 0) {
                    return (
                      <p className="text-slate-500 text-center py-8">
                        {unassignSearchTerm ? 'No employees found matching your search' : 'No employees assigned'}
                      </p>
                    )
                  }
                  
                  return (
                    <div className="space-y-2">
                      {filteredChildren.map((emp) => {
                        const isSelected = selectedEmployeesToUnassign.includes(emp.id)
                        return (
                          <label
                            key={emp.id}
                            className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleUnassignEmployeeToggle(emp.id)}
                              className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                            />
                            <div className="flex items-center gap-3 flex-1">
                              {emp.avatar && !failedImages.has(emp.id) ? (
                                <img
                                  src={getImageUrl(emp.avatar, apiBaseUrl) || emp.avatar}
                                  alt={emp.name}
                                  className="w-10 h-10 rounded-full object-cover"
                                  onError={(e) => {
                                    setFailedImages(prev => new Set(prev).add(emp.id))
                                    e.target.style.display = 'none'
                                  }}
                                />
                              ) : null}
                              <div 
                                className="w-10 h-10 rounded-full bg-[#426653] flex items-center justify-center text-white font-semibold"
                                style={{ display: (emp.avatar && !failedImages.has(emp.id)) ? 'none' : 'flex' }}
                              >
                                {emp.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-medium text-slate-900">
                                  {emp.name}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {emp.title || 'No Title'}
                                </p>
                              </div>
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  )
                })()}
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex gap-3">
              <button
                onClick={() => {
                  setShowUnassignModal(false)
                  setUnassigningManager(null)
                  setSelectedEmployeesToUnassign([])
                  setUnassignSearchTerm('')
                }}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50"
                disabled={unassigning}
              >
                Cancel
              </button>
              <button
                onClick={handleUnassign}
                disabled={unassigning || getEmployeesToUnassignCount() === 0}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {unassigning ? 'Unassigning...' : `Unassign (${getEmployeesToUnassignCount()})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default EmployeeTree

