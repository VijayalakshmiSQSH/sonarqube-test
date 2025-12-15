import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useEmployees } from '../context/EmployeeContext.jsx'
import Header from '../components/Header.jsx'
import SearchableDropdown from '../components/SearchableDropdown.jsx'

const EditEmployee = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { getEmployeeById, updateEmployee, loading, getAllEmployees } = useEmployees()
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    dateOfBirth: '',
    title: '',
    parentDepartment: '',
    department: '',
    location: '',
    manager: '',
    employmentType: 'Full-time',
    hireDate: '',
    salary: '',
    employeeStatus: 'Active'
  })

  const [errors, setErrors] = useState({})
  const [employee, setEmployee] = useState(null)
  const [initializedEmployeeId, setInitializedEmployeeId] = useState(null)

  // Get unique values for dropdowns from existing employees - memoized to prevent infinite loops
  const allEmployees = getAllEmployees()
  const parentDepartments = useMemo(() => 
    [...new Set(allEmployees.map(emp => emp.parent_department).filter(Boolean))],
    [allEmployees]
  )
  const departments = useMemo(() => 
    [...new Set(allEmployees.map(emp => emp.department).filter(Boolean))],
    [allEmployees]
  )
  const locations = useMemo(() => 
    [...new Set(allEmployees.map(emp => emp.location || emp.city).filter(Boolean))],
    [allEmployees]
  )
  const managers = useMemo(() => 
    allEmployees.filter(emp => {
      // Filter to show only active employees
      const isActive = (emp.employee_status || 'Active') === 'Active'
      if (!isActive) return false
      
      const title = emp.title || emp.designation || ''
      return title.includes('Manager') || title.includes('Director') || title.includes('VP')
    }),
    [allEmployees]
  )

  useEffect(() => {
    // Only initialize form data once per employee ID
    if (initializedEmployeeId === id) return
    
    console.log('EditEmployee: Looking for employee with ID:', id)
    const emp = getEmployeeById(id)
    console.log('EditEmployee: Found employee:', emp)
    if (emp) {
      setEmployee(emp)
      
      // Helper function to normalize manager name for matching
      const normalizeManagerName = (name) => {
        if (!name) return ''
        return name.trim().replace(/\s+/g, ' ')
      }
      
      // Get manager name from employee
      const storedManagerName = normalizeManagerName(emp.manager || emp.reporting_manager_name || '')
      
      // Try to find matching manager in the managers list
      let matchedManagerName = storedManagerName
      if (storedManagerName && managers.length > 0) {
        const matchedManager = managers.find(mgr => {
          const mgrFirstName = mgr.firstName || mgr.first_name || ''
          const mgrLastName = mgr.lastName || mgr.last_name || ''
          const mgrFullName = normalizeManagerName(`${mgrFirstName} ${mgrLastName}`)
          return normalizeManagerName(mgrFullName) === storedManagerName || 
                 mgrFullName.includes(storedManagerName) ||
                 storedManagerName.includes(mgrFullName)
        })
        
        if (matchedManager) {
          const mgrFirstName = matchedManager.firstName || matchedManager.first_name || ''
          const mgrLastName = matchedManager.lastName || matchedManager.last_name || ''
          matchedManagerName = normalizeManagerName(`${mgrFirstName} ${mgrLastName}`)
        }
      }
      
      // Format date for date input (YYYY-MM-DD)
      const formatDateForInput = (dateValue) => {
        if (!dateValue) return ''
        if (typeof dateValue === 'string') {
          // Handle different date string formats
          if (dateValue.includes('T')) {
            return dateValue.split('T')[0]
          }
          // Try to parse DD-MM-YYYY or DD/MM/YYYY formats
          const dateMatch = dateValue.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/)
          if (dateMatch) {
            const [, day, month, year] = dateMatch
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
          }
          // If already in YYYY-MM-DD format
          if (dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
            return dateValue
          }
        }
        return ''
      }
      
      setFormData({
        firstName: emp.firstName || emp.first_name || '',
        lastName: emp.lastName || emp.last_name || '',
        email: emp.email || '',
        phone: emp.phone || emp.mobile_number || '',
        address: emp.address || '',
        dateOfBirth: formatDateForInput(emp.dateOfBirth || emp.date_of_birth || ''),
        title: emp.title || emp.designation || '',
        parentDepartment: emp.parent_department || '',
        department: emp.department || '',
        location: emp.location || emp.city || '',
        manager: matchedManagerName, // Use matched manager name
        employmentType: emp.employmentType || emp.employment_type || '',
        hireDate: formatDateForInput(emp.hireDate || emp.date_of_joining || ''),
        salary: emp.salary || '',
        employeeStatus: emp.employee_status || 'Active'
      })
      setInitializedEmployeeId(id)
    } else {
      console.error('EditEmployee: No employee found with ID:', id)
      console.log('EditEmployee: Available employees:', allEmployees.map(emp => ({ id: emp.id, employee_id: emp.employee_id, employeeId: emp.employeeId, name: `${emp.first_name || emp.firstName} ${emp.last_name || emp.lastName}` })))
    }
  }, [id, getEmployeeById, allEmployees, managers, initializedEmployeeId])

  // Show loading state while employees are being fetched
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 font-sans">
        <Header />
        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="card p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-slate-600">Loading employee data...</p>
          </div>
        </main>
      </div>
    )
  }

  if (!employee) {
    return (
      <div className="min-h-screen bg-slate-100 font-sans">
        <Header />
        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="card p-8 text-center">
            <h1 className="text-2xl font-semibold text-slate-900 mb-4">Employee Not Found</h1>
            <p className="text-slate-600 mb-6">The employee you're trying to edit doesn't exist.</p>
            <p className="text-sm text-slate-500 mb-6">Employee ID: {id}</p>
            <Link to="/workforce" className="btn-primary">
              Back to Workforce
            </Link>
          </div>
        </main>
      </div>
    )
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
  }

  const validateForm = () => {
    const newErrors = {}
    
    // Required fields
    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required'
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required'
    if (!formData.email.trim()) newErrors.email = 'Email is required'
    if (!formData.phone.trim()) newErrors.phone = 'Phone is required'
    if (!formData.title.trim()) newErrors.title = 'Job title is required'
    if (!formData.parentDepartment) newErrors.parentDepartment = 'Parent department is required'
    if (!formData.department) newErrors.department = 'Department is required'
    if (!formData.location) newErrors.location = 'Location is required'
    // Hire date is now optional - removed validation
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (formData.email && !emailRegex.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address'
    }
    
    // Check for duplicate email (excluding current employee)
    if (formData.email && allEmployees.some(emp => {
      const empId = emp.id || emp.employee_id || emp.employeeId
      const currentId = parseInt(id)
      return emp.email === formData.email && empId !== currentId
    })) {
      newErrors.email = 'An employee with this email already exists'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    // Map form data to backend field names
    const backendData = {
      first_name: formData.firstName,
      last_name: formData.lastName,
      email: formData.email,
      mobile_number: formData.phone,
      date_of_birth: formData.dateOfBirth,
      designation: formData.title,
      parent_department: formData.parentDepartment,
      department: formData.department,
      city: formData.location,
      employment_type: formData.employmentType,
      date_of_joining: formData.hireDate,
      reporting_manager_name: formData.manager || null,
      employee_status: formData.employeeStatus
    }

    console.log('Updating employee with data:', backendData)
    const result = await updateEmployee(id, backendData)
    console.log('Update result:', result)
    
    if (result.success) {
      navigate('/workforce', {
        state: { message: 'Employee updated successfully!' }
      })
    } else {
      alert('Error updating employee: ' + result.error)
    }
  }

  const handleCancel = () => {
    navigate('/workforce')
  }

  return (
    <div className="min-h-screen bg-slate-100 font-sans">
      <Header />
      
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <div className="mb-6 animate-fade-in">
          <Link 
            to="/workforce"
            className="text-slate-500 hover:text-slate-700 flex items-center gap-2 text-sm transition-colors font-medium"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" d="M7.72 12.53a.75.75 0 010-1.06l7.5-7.5a.75.75 0 111.06 1.06L9.31 12l6.97 6.97a.75.75 0 11-1.06 1.06l-7.5-7.5z" clipRule="evenodd"/>
            </svg>
            Back to Workforce
          </Link>
        </div>

        <div className="card shadow-lg p-6 animate-slide-in">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-700 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M21.731 2.269a2.625 2.625 0 00-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 000-3.712zM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 00-1.32 2.214l-.8 2.685a.75.75 0 00.933.933l2.685-.8a5.25 5.25 0 002.214-1.32l8.4-8.4z"/>
                  <path d="M5.25 5.25a3 3 0 00-3 3v10.5a3 3 0 003 3h10.5a3 3 0 003-3V13.5a.75.75 0 00-1.5 0v5.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5V8.25a1.5 1.5 0 011.5-1.5h5.25a.75.75 0 000-1.5H5.25z"/>
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-slate-900">Edit Employee Information</h1>
                <p className="text-slate-600 font-medium">Update employee details and job information</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-500 font-medium">Employee ID:</span>
              <span className="text-slate-900 font-semibold font-mono">{employee.employee_id}</span>
            </div>
          </div>
          
          <form onSubmit={handleSubmit}>
            {/* Personal Information Section */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-6 pb-3 border-b border-slate-200">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-green-700" fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd"/>
                  </svg>
                </div>
                <h2 className="section-title">Personal Information</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    className={`input-field ${errors.firstName ? 'border-red-300 focus:ring-red-500' : ''}`}
                  />
                  {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    className={`input-field ${errors.lastName ? 'border-red-300 focus:ring-red-500' : ''}`}
                  />
                  {errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="email" 
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className={`input-field ${errors.email ? 'border-red-300 focus:ring-red-500' : ''}`}
                  />
                  {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Phone <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="tel" 
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className={`input-field ${errors.phone ? 'border-red-300 focus:ring-red-500' : ''}`}
                  />
                  {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Date of Birth</label>
                  <input 
                    type="date" 
                    name="dateOfBirth"
                    value={formData.dateOfBirth}
                    onChange={handleInputChange}
                    className="input-field"
                  />
                </div>
                {/* <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Address</label>
                  <input 
                    type="text" 
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    className="input-field"
                  />
                </div> */}
              </div>
            </div>

            {/* Job Information Section */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-6 pb-3 border-b border-slate-200">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-purple-600" fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" d="M7.5 5.25a3 3 0 013-3h3a3 3 0 013 3v.205c.933.085 1.857.197 2.774.334 1.454.218 2.476 1.483 2.476 2.917v3.033c0 1.211-.734 2.352-1.936 2.752A24.726 24.726 0 0112 15.75c-2.73 0-5.357-.442-7.814-1.259-1.202-.4-1.936-1.541-1.936-2.752V8.706c0-1.434 1.022-2.7 2.476-2.917A48.814 48.814 0 017.5 5.455V5.25zm7.5 0v.09a49.488 49.488 0 00-6 0v-.09a1.5 1.5 0 011.5-1.5h3a1.5 1.5 0 011.5 1.5zm-3 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd"/>
                  </svg>
                </div>
                <h2 className="section-title">Job Information</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Employee ID</label>
                  <input 
                    type="text" 
                    value={employee.employee_id}
                    className="input-field bg-slate-100 font-mono font-semibold text-slate-600" 
                    disabled 
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Role <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    className={`input-field ${errors.title ? 'border-red-300 focus:ring-red-500' : ''}`}
                  />
                  {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title}</p>}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Parent Department <span className="text-red-500">*</span>
                  </label>
                  <SearchableDropdown
                    options={parentDepartments.map(dept => ({ value: dept, label: dept }))}
                    value={formData.parentDepartment}
                    onChange={(value) => handleInputChange({ target: { name: 'parentDepartment', value } })}
                    placeholder="Search parent department..."
                    className={`${errors.parentDepartment ? 'border-red-300' : ''}`}
                  />
                  {errors.parentDepartment && <p className="text-red-500 text-xs mt-1">{errors.parentDepartment}</p>}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Department <span className="text-red-500">*</span>
                  </label>
                  <SearchableDropdown
                    options={departments.map(dept => ({ value: dept, label: dept }))}
                    value={formData.department}
                    onChange={(value) => handleInputChange({ target: { name: 'department', value } })}
                    placeholder="Search department..."
                    className={`${errors.department ? 'border-red-300' : ''}`}
                  />
                  {errors.department && <p className="text-red-500 text-xs mt-1">{errors.department}</p>}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Manager</label>
                  <SearchableDropdown
                    options={managers.map(manager => {
                      const firstName = manager.firstName || manager.first_name || ''
                      const lastName = manager.lastName || manager.last_name || ''
                      const fullName = `${firstName} ${lastName}`.trim()
                      return { value: fullName, label: fullName }
                    })}
                    value={formData.manager}
                    onChange={(value) => handleInputChange({ target: { name: 'manager', value } })}
                    placeholder="Search manager..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Location <span className="text-red-500">*</span>
                  </label>
                  <SearchableDropdown
                    options={locations.map(location => ({ value: location, label: location }))}
                    value={formData.location}
                    onChange={(value) => handleInputChange({ target: { name: 'location', value } })}
                    placeholder="Search location..."
                    className={`${errors.location ? 'border-red-300' : ''}`}
                  />
                  {errors.location && <p className="text-red-500 text-xs mt-1">{errors.location}</p>}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Employment Type</label>
                  <select 
                    name="employmentType"
                    value={formData.employmentType || ''}
                    onChange={handleInputChange}
                    className="select-field"
                  >
                    <option value="">Select employment type</option>
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Contract">Contract</option>
                    <option value="Permanent">Permanent</option>
                    <option value="Intern">Intern</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Hire Date
                  </label>
                  <input 
                    type="date" 
                    name="hireDate"
                    value={formData.hireDate}
                    onChange={handleInputChange}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Status
                  </label>
                  <select 
                    name="employeeStatus"
                    value={formData.employeeStatus}
                    onChange={handleInputChange}
                    className="select-field"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Resigned">Resigned</option>
                    <option value="Terminated">Terminated</option>
                  </select>
                </div>
                {/* <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Salary</label>
                  <input 
                    type="text" 
                    name="salary"
                    value={formData.salary}
                    onChange={handleInputChange}
                    className="input-field"
                  />
                </div> */}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 pt-6 border-t border-slate-200">
              <button 
                type="submit" 
                className="btn-primary"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Saving Changes...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z" clipRule="evenodd"/>
                    </svg>
                    Save Changes
                  </>
                )}
              </button>
              <button 
                type="button" 
                onClick={handleCancel}
                className="btn-secondary"
                disabled={loading}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z" clipRule="evenodd"/>
                </svg>
                Cancel
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}

export default EditEmployee
