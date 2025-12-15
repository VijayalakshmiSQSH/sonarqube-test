import { createContext, useContext, useState, useEffect } from 'react'
import { useAuth } from './AuthContext.jsx'
import { getCookie } from '../utils/helpers.js'
import { TOKEN, getApiBaseUrl } from '../utils/constants.js'

const EmployeeContext = createContext()

export const useEmployees = () => {
  const context = useContext(EmployeeContext)
  if (context === undefined) {
    throw new Error('useEmployees must be used within an EmployeeProvider')
  }
  return context
}


export const EmployeeProvider = ({ children }) => {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(false)
  const { isAuthenticated, user } = useAuth()

  // Refresh employees from backend
  const refreshEmployees = async () => {
    if (!isAuthenticated()) return
    
    const token = getCookie(TOKEN)
    if (!token) return
    
    setLoading(true)
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/employees`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setEmployees(data.employees || [])
      }
    } catch (error) {
      console.error('Error refreshing employees:', error)
    } finally {
      setLoading(false)
    }
  }

  // Load employees from backend when component mounts
  useEffect(() => {
    if (isAuthenticated()) {
      refreshEmployees()
    }
    // Always try to fetch from database, don't use mock data
  }, [isAuthenticated])

  // Get all employees
  const getAllEmployees = () => employees

  // Get employee by ID
  const getEmployeeById = (id) => {
    if (!id) return null
    return employees.find(emp => 
      emp.id === id || 
      emp.employee_id === id || 
      emp.employeeId === id ||
      emp.id === parseInt(id) ||
      emp.employee_id === parseInt(id) ||
      emp.employeeId === parseInt(id)
    )
  }

  // Add new employee
  const addEmployee = async (employeeData) => {
    setLoading(true)
    try {
      // Frontend validation: Check if email already exists
      if (employeeData.email) {
        const existingEmployee = employees.find(emp => emp.email === employeeData.email)
        if (existingEmployee) {
          throw new Error('Email ID already exists')
        }
      }

      if (isAuthenticated()) {
        // Backend API call
        const token = getCookie(TOKEN)
        if (!token) {
          throw new Error('No authentication token found')
        }

        // Transform frontend field names to backend field names
        const backendData = {
          first_name: employeeData.firstName,
          last_name: employeeData.lastName,
          email: employeeData.email,
          mobile_number: employeeData.phone || null,
          designation: employeeData.title || null,
          parent_department: employeeData.parentDepartment || null,
          department: employeeData.department || null,
          city: employeeData.location || null,
          employment_type: employeeData.employmentType || null,
          date_of_joining: employeeData.hireDate || null,
          employee_id: employeeData.employeeId,
          reporting_manager_name: employeeData.managerName || null,
          // Handle billing rate properly
          billing_rate_per_hour: employeeData.billingRate && employeeData.billingRate.trim() 
            ? parseFloat(employeeData.billingRate) 
            : null
        }

        // Remove any undefined or empty string values that might cause issues
        Object.keys(backendData).forEach(key => {
          if (backendData[key] === undefined || backendData[key] === '') {
            backendData[key] = null
          }
        })

        console.log('Sending data to backend:', backendData)

        const response = await fetch(`${getApiBaseUrl()}/api/employees`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(backendData)
        })

        if (!response.ok) {
          let errorMessage = 'Failed to create employee'
          try {
            const errorData = await response.json()
            errorMessage = errorData.error || errorMessage
            console.error('Backend error response:', errorData)
          } catch (parseError) {
            console.error('Failed to parse error response:', parseError)
            errorMessage = `Server error: ${response.status} ${response.statusText}`
          }
          throw new Error(errorMessage)
        }

        const data = await response.json()
        
        // Refresh employees list
        await refreshEmployees()
        
        return { success: true, employee: data.employee }
      } else {
        // Mock data creation
        const newId = employeeData.employeeId || `EMP${String(employees.length + 1).padStart(3, '0')}`
        const newEmployee = {
          ...employeeData,
          id: newId,
          employeeId: newId,
          avatar: `${employeeData.firstName[0]}${employeeData.lastName[0]}`,
          skills: employeeData.skills || [],
          certifications: employeeData.certifications || [],
          directReports: []
        }
        
        setEmployees(prev => [...prev, newEmployee])
        return { success: true, employee: newEmployee }
      }
    } catch (error) {
      console.error('Error adding employee:', error)
      return { success: false, error: error.message }
    } finally {
      setLoading(false)
    }
  }

  // Update employee
  const updateEmployee = async (id, updates) => {
    setLoading(true)
    try {
      // Frontend validation: Check if email already exists for other employees
      if (updates.email) {
        const existingEmployee = employees.find(emp => {
          const empId = emp.id || emp.employee_id || emp.employeeId
          const currentId = parseInt(id)
          return emp.email === updates.email && empId !== currentId
        })
        if (existingEmployee) {
          throw new Error('Email ID already exists for another employee')
        }
      }

      if (isAuthenticated()) {
        // Backend API call
        const token = getCookie(TOKEN)
        if (!token) {
          throw new Error('No authentication token found')
        }

        const response = await fetch(`${getApiBaseUrl()}/api/employees/${id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(updates)
        })

        if (!response.ok) {
          let errorMessage = 'Failed to update employee'
          try {
            const errorData = await response.json()
            errorMessage = errorData.error || errorMessage
            console.error('Backend error response:', errorData)
            console.error('Response status:', response.status)
            console.error('Response headers:', response.headers)
          } catch (parseError) {
            console.error('Failed to parse error response:', parseError)
            errorMessage = `Server error: ${response.status} ${response.statusText}`
          }
          throw new Error(errorMessage)
        }

        const data = await response.json()
        
        // Update local state
        setEmployees(prev => 
          prev.map(emp => {
            const empId = emp.id || emp.employee_id || emp.employeeId
            const currentId = parseInt(id)
            if (empId === currentId) {
              // Use the updated employee data from backend response
              const updatedEmp = { 
                ...emp, 
                ...data.employee,
                // Ensure avatar is updated with correct field names
                avatar: `${data.employee.first_name?.[0] || data.employee.firstName?.[0] || emp.first_name?.[0] || emp.firstName?.[0] || ''}${data.employee.last_name?.[0] || data.employee.lastName?.[0] || emp.last_name?.[0] || emp.lastName?.[0] || ''}`
              }
              console.log('Updated employee in state:', updatedEmp)
              return updatedEmp
            }
            return emp
          })
        )
        
        return { success: true, employee: data.employee }
      } else {
        // Mock data update
        setEmployees(prev => 
          prev.map(emp => 
            emp.id === id 
              ? { ...emp, ...updates, avatar: `${updates.firstName?.[0] || emp.firstName[0]}${updates.lastName?.[0] || emp.lastName[0]}` }
              : emp
          )
        )
        return { success: true }
      }
    } catch (error) {
      console.error('Error updating employee:', error)
      return { success: false, error: error.message }
    } finally {
      setLoading(false)
    }
  }

  // Delete employee (remove completely)
  const deleteEmployee = async (id) => {
    setLoading(true)
    try {
      if (isAuthenticated()) {
        // Backend API call
        const token = getCookie(TOKEN)
        if (!token) {
          throw new Error('No authentication token found')
        }

        console.log('Attempting to delete employee with ID:', id)
        const response = await fetch(`${getApiBaseUrl()}/api/employees/${id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })

        if (!response.ok) {
          const errorData = await response.json()
          console.error('Delete API error:', errorData)
          throw new Error(errorData.error || 'Failed to delete employee')
        }

        const result = await response.json()
        console.log('Delete API success:', result)

        // Update local state - filter by multiple possible ID fields
        setEmployees(prev => prev.filter(emp => {
          const empId = emp.id || emp.employee_id || emp.employeeId
          const deleteId = parseInt(id)
          return empId !== deleteId
        }))
        
        return { success: true }
      } else {
        // Mock data deletion
        setEmployees(prev => prev.filter(emp => {
          const empId = emp.id || emp.employee_id || emp.employeeId
          const deleteId = parseInt(id)
          return empId !== deleteId
        }))
        return { success: true }
      }
    } catch (error) {
      console.error('Error deleting employee:', error)
      return { success: false, error: error.message }
    } finally {
      setLoading(false)
    }
  }

  // Search and filter employees
  const searchEmployees = (query, filters = {}) => {
    try {
      let filtered = employees || []

      // Apply text search
      if (query && query.trim()) {
        const searchLower = query.toLowerCase().trim()
        filtered = filtered.filter(emp => {
          try {
            // Handle both mock data field names and backend field names
            const firstName = (emp.first_name || emp.firstName || '').toString()
            const lastName = (emp.last_name || emp.lastName || '').toString()
            const email = (emp.email || '').toString()
            const employeeId = (emp.employee_id || emp.employeeId || emp.id || '').toString()
            const parentDepartment = (emp.parent_department || '').toString()
            const department = (emp.department || '').toString()
            const designation = (emp.designation || emp.title || '').toString()
            const location = (emp.city || emp.location || '').toString()
            
            const matches = 
              firstName.toLowerCase().includes(searchLower) ||
              lastName.toLowerCase().includes(searchLower) ||
              email.toLowerCase().includes(searchLower) ||
              employeeId.toLowerCase().includes(searchLower) ||
              parentDepartment.toLowerCase().includes(searchLower) ||
              department.toLowerCase().includes(searchLower) ||
              designation.toLowerCase().includes(searchLower) ||
              location.toLowerCase().includes(searchLower) ||
              // Search in full name
              `${firstName} ${lastName}`.toLowerCase().includes(searchLower)
            
            return matches
          } catch (error) {
            console.warn('Error filtering employee:', emp, error)
            return false
          }
        })
      }

      // Apply filters
      if (filters.parentDepartment && filters.parentDepartment.length > 0) {
        filtered = filtered.filter(emp => {
          try {
            return emp.parent_department && filters.parentDepartment.includes(emp.parent_department)
          } catch (error) {
            console.warn('Error filtering by parent department:', emp, error)
            return false
          }
        })
      }
      if (filters.department && filters.department.length > 0) {
        filtered = filtered.filter(emp => {
          try {
            return emp.department && filters.department.includes(emp.department)
          } catch (error) {
            console.warn('Error filtering by department:', emp, error)
            return false
          }
        })
      }
      if (filters.location && filters.location.length > 0) {
        filtered = filtered.filter(emp => {
          try {
            const location = emp.city || emp.location
            return location && filters.location.includes(location)
          } catch (error) {
            console.warn('Error filtering by location:', emp, error)
            return false
          }
        })
      }
      if (filters.role && filters.role.length > 0) {
        filtered = filtered.filter(emp => {
          try {
            const designation = emp.designation || emp.title || ''
            // Match exact designation (not partial match like before)
            return designation && filters.role.includes(designation)
          } catch (error) {
            console.warn('Error filtering by role:', emp, error)
            return false
          }
        })
      }
      if (filters.status && filters.status.length > 0) {
        filtered = filtered.filter(emp => {
          try {
            const status = emp.employee_status || emp.status || 'Active'
            return filters.status.includes(status)
          } catch (error) {
            console.warn('Error filtering by status:', emp, error)
            return false
          }
        })
      }
      if (filters.experience && filters.experience.length > 0) {
        filtered = filtered.filter(emp => {
          try {
            const experience = emp.total_experience || emp.experience || 0
            // Convert experience to years if it's a string
            let experienceYears = 0
            // Handle numeric format
            const value = Number(experience)
            if (!isNaN(value)) {
              // If value is less than 1.0, treat as months (multiply by 100)
              experienceYears = value < 1.0 ? (value * 100) / 12 : value
            }
            
            // Apply range filter - check if any selected range matches
            return filters.experience.some(range => {
              if (range === '0-1') {
                return experienceYears >= 0 && experienceYears < 1
              } else if (range === '1-3') {
                return experienceYears >= 1 && experienceYears < 3
              } else if (range === '3-5') {
                return experienceYears >= 3 && experienceYears < 5
              } else if (range === '5-8') {
                return experienceYears >= 5 && experienceYears < 8
              } else if (range === '8-10') {
                return experienceYears >= 8 && experienceYears < 10
              } else if (range === '10+') {
                return experienceYears >= 10
              }
              return false
            })
          } catch (error) {
            console.warn('Error filtering by experience:', emp, error)
            return false
          }
        })
      }

      return filtered
    } catch (error) {
      console.error('Error in searchEmployees:', error)
      return []
    }
  }

  // Get statistics
  const getStats = () => {
    const totalEmployees = employees.length
    const departments = [...new Set(employees.map(emp => emp.department))].length
    
    // Recent activity mock
    const recentUpdates = employees.slice(-5).reverse()

    return {
      totalEmployees,
      departments,
      recentUpdates: recentUpdates.length
    }
  }

  // Get department overview
  const getDepartmentOverview = () => {
    const deptMap = employees.reduce((acc, emp) => {
      if (!acc[emp.department]) {
        acc[emp.department] = {
          name: emp.department,
          count: 0,
          employees: []
        }
      }
      acc[emp.department].count++
      acc[emp.department].employees.push(emp)
      return acc
    }, {})

    return Object.values(deptMap).map(dept => ({
      ...dept,
      manager: dept.employees.find(emp => emp.title.includes('Manager') || emp.title.includes('Director'))?.firstName + ' ' + 
               dept.employees.find(emp => emp.title.includes('Manager') || emp.title.includes('Director'))?.lastName || 'TBD',
      locations: [...new Set(dept.employees.map(emp => emp.location))].join(', ')
    }))
  }

  // Get work locations from backend
  const getWorkLocations = async () => {
    if (!isAuthenticated()) {
      // Return mock locations when not authenticated
      return [...new Set(employees.map(emp => emp.city || emp.location).filter(Boolean))]
    }
    
    const token = getCookie(TOKEN)
    if (!token) return []
    
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/employees/locations`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        return data.locations || []
      }
    } catch (error) {
      console.error('Error fetching work locations:', error)
    }
    
    return []
  }

  // Get all employees for manager dropdown
  const getAllEmployeesForManager = () => {
    return employees
      .filter(emp => {
        // Filter to show only active employees
        return (emp.employee_status || 'Active') === 'Active'
      })
      .map(emp => ({
        id: emp.id,
        name: `${emp.first_name || emp.firstName} ${emp.last_name || emp.lastName}`,
        title: emp.designation || emp.title,
        department: emp.department
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  const value = {
    employees,
    loading,
    getAllEmployees,
    getEmployeeById,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    searchEmployees,
    getStats,
    getDepartmentOverview,
    refreshEmployees,
    getWorkLocations,
    getAllEmployeesForManager
  }

  return (
    <EmployeeContext.Provider value={value}>
      {children}
    </EmployeeContext.Provider>
  )
}
