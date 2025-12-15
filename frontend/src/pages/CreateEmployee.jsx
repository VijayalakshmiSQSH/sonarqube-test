import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEmployees } from '../context/EmployeeContext.jsx'
import Header from '../components/Header.jsx'
import SearchableDropdown from '../components/SearchableDropdown.jsx'

const CreateEmployee = () => {
  const navigate = useNavigate()
  const { addEmployee, loading, getAllEmployees, getWorkLocations, getAllEmployeesForManager } = useEmployees()
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    title: '',
    parentDepartment: '',
    department: '',
    location: '',
    manager: '',
    managerName: '',
    employmentType: 'Full-time',
    hireDate: '',
    employeeId: '',
    billingRate: '',
    rateEffectiveDate: '',
    skills: [],
    certifications: [],
    emergencyContactName: '',
    emergencyContactRelationship: '',
    emergencyContactPhone: '',
    emergencyContactEmail: ''
  })

  const [errors, setErrors] = useState({})
  const [locations, setLocations] = useState([])
  
  // Skills and Certifications state
  const [newSkill, setNewSkill] = useState('')
  const [newCertification, setNewCertification] = useState({
    title: '',
    issuer: '',
    expiry: ''
  })

  // Predefined skills suggestions
  const suggestedSkills = [
    'JavaScript', 'React', 'Node.js', 'Python', 'Java', 'SQL', 'AWS', 'Docker',
    'Kubernetes', 'Git', 'Agile', 'Scrum', 'Project Management', 'Leadership',
    'Communication', 'Problem Solving', 'Team Management', 'Strategic Planning',
    'Data Analysis', 'Machine Learning', 'DevOps', 'UI/UX Design', 'Marketing',
    'Sales', 'Customer Service', 'Finance', 'Accounting', 'HR Management'
  ]

  // Load locations on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const locationsData = await getWorkLocations()
        setLocations(locationsData)
      } catch (error) {
        console.error('Error loading dropdown data:', error)
      }
    }
    
    loadData()
  }, [getWorkLocations])

  // Get unique values for dropdowns from existing employees
  const allEmployees = getAllEmployees()
  
  // Managers list - reactive to employees array, updates automatically when employees load
  // Using allEmployees.length as dependency to avoid unnecessary recalculations
  const managers = useMemo(() => {
    // This will automatically update when employees are loaded
    return getAllEmployeesForManager()
  }, [getAllEmployeesForManager, allEmployees.length])
  const parentDepartments = [...new Set(allEmployees.map(emp => emp.parent_department).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  const departments = [...new Set(allEmployees.map(emp => emp.department).filter(Boolean))].sort((a, b) => a.localeCompare(b))

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

  // Skills management
  const addSkill = () => {
    if (newSkill.trim() && !formData.skills.includes(newSkill.trim())) {
      setFormData(prev => ({
        ...prev,
        skills: [...prev.skills, newSkill.trim()]
      }))
      setNewSkill('')
    }
  }

  const addSuggestedSkill = (skill) => {
    if (!formData.skills.includes(skill)) {
      setFormData(prev => ({
        ...prev,
        skills: [...prev.skills, skill]
      }))
    }
  }

  const removeSkill = (skillToRemove) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.filter(skill => skill !== skillToRemove)
    }))
  }

  const handleSkillKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addSkill()
    }
  }

  // Certifications management
  const addCertification = () => {
    if (newCertification.title.trim() && newCertification.issuer.trim()) {
      setFormData(prev => ({
        ...prev,
        certifications: [...prev.certifications, { ...newCertification }]
      }))
      setNewCertification({ title: '', issuer: '', expiry: '' })
    }
  }

  const removeCertification = (index) => {
    setFormData(prev => ({
      ...prev,
      certifications: prev.certifications.filter((_, i) => i !== index)
    }))
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
    // Hire date is now optional
    // if (!formData.hireDate) newErrors.hireDate = 'Hire date is required'
    if (!formData.employeeId.trim()) newErrors.employeeId = 'Employee ID is required'
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (formData.email && !emailRegex.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address'
    }

    // Billing rate validation
    if (formData.billingRate && formData.billingRate.trim()) {
      const billingRate = parseFloat(formData.billingRate)
      if (isNaN(billingRate) || billingRate < 0) {
        newErrors.billingRate = 'Billing rate must be a valid positive number'
      }
    }
    
    // Check for duplicate email
    if (formData.email && allEmployees.some(emp => emp.email === formData.email)) {
      newErrors.email = 'An employee with this email already exists'
    }

    // Check for duplicate employee ID
    if (formData.employeeId && allEmployees.some(emp => emp.employee_id === formData.employeeId || emp.employeeId === formData.employeeId)) {
      newErrors.employeeId = 'An employee with this ID already exists'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    const result = await addEmployee(formData)
    
    if (result.success) {
      // Navigate to directory with success message
      navigate('/directory', {
        state: { 
          message: 'Employee created successfully!',
          type: 'success'
        }
      })
    } else {
      // Show user-friendly error message
      const errorMessage = result.error || 'An unexpected error occurred while creating the employee'
      setErrors({ general: errorMessage })
      
      // Scroll to top to show error
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleCancel = () => {
    navigate('/directory')
  }

  return (
    <div className="min-h-screen bg-slate-100 font-sans">
      <Header />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Title */}
        <div className="mb-8 animate-fade-in">
          <h2 className="page-title">Add New Employee</h2>
          <p className="page-subtitle">Fill in the information below to create a new employee record</p>
        </div>

        {/* General Error Message */}
        {errors.general && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <div className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center mr-3">
                <svg className="w-3 h-3 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-1.72 6.97a.75.75 0 10-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 101.06 1.06L12 13.06l1.72 1.72a.75.75 0 101.06-1.06L13.06 12l1.72-1.72a.75.75 0 10-1.06-1.06L12 10.94l-1.72-1.72z" clipRule="evenodd"/>
                </svg>
              </div>
              <p className="text-red-800 font-medium">{errors.general}</p>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="card animate-slide-in">
          {/* Personal Information Section */}
          <div className="card-header">
            <h3 className="section-title">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-green-700" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd"/>
                </svg>
              </div>
              Personal Information
            </h3>
          </div>
          <div className="px-6 py-6 grid grid-cols-1 md:grid-cols-2 gap-6">
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
                placeholder="Enter first name"
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
                placeholder="Enter last name"
              />
              {errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input 
                type="email" 
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className={`input-field ${errors.email ? 'border-red-300 focus:ring-red-500' : ''}`}
                placeholder="employee@company.com"
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Phone Number <span className="text-red-500">*</span>
              </label>
              <input 
                type="tel" 
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                className={`input-field ${errors.phone ? 'border-red-300 focus:ring-red-500' : ''}`}
                placeholder="(555) 123-4567"
              />
              {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
            </div>
          </div>

          {/* Job Information Section */}
          <div className="card-header border-t">
            <h3 className="section-title">
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-purple-600" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M7.5 5.25a3 3 0 013-3h3a3 3 0 013 3v.205c.933.085 1.857.197 2.774.334 1.454.218 2.476 1.483 2.476 2.917v3.033c0 1.211-.734 2.352-1.936 2.752A24.726 24.726 0 0112 15.75c-2.73 0-5.357-.442-7.814-1.259-1.202-.4-1.936-1.541-1.936-2.752V8.706c0-1.434 1.022-2.7 2.476-2.917A48.814 48.814 0 017.5 5.455V5.25zm7.5 0v.09a49.488 49.488 0 00-6 0v-.09a1.5 1.5 0 011.5-1.5h3a1.5 1.5 0 011.5 1.5zm-3 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd"/>
                </svg>
              </div>
              Job Information
            </h3>
          </div>
          <div className="px-6 py-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Job Title <span className="text-red-500">*</span>
              </label>
              <input 
                type="text" 
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                className={`input-field ${errors.title ? 'border-red-300 focus:ring-red-500' : ''}`}
                placeholder="Enter job title"
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
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Location <span className="text-red-500">*</span>
              </label>
              <SearchableDropdown
                options={[...locations, 'Remote'].map(location => ({ value: location, label: location }))}
                value={formData.location}
                onChange={(value) => handleInputChange({ target: { name: 'location', value } })}
                placeholder="Search location..."
                className={`${errors.location ? 'border-red-300' : ''}`}
              />
              {errors.location && <p className="text-red-500 text-xs mt-1">{errors.location}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Manager</label>
              <SearchableDropdown
                options={managers.map(manager => ({ value: manager.name, label: `${manager.name} - ${manager.title}` }))}
                value={formData.managerName}
                onChange={(value) => {
                  setFormData(prev => ({
                    ...prev,
                    manager: value,
                    managerName: value
                  }))
                }}
                placeholder="Search manager..."
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Employment Type</label>
              <select 
                name="employmentType"
                value={formData.employmentType}
                onChange={handleInputChange}
                className="select-field"
              >
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
                Employee ID <span className="text-red-500">*</span>
              </label>
              <input 
                type="text" 
                name="employeeId"
                value={formData.employeeId}
                onChange={handleInputChange}
                className={`input-field ${errors.employeeId ? 'border-red-300 focus:ring-red-500' : ''}`}
                placeholder="EMP001"
              />
              {errors.employeeId && <p className="text-red-500 text-xs mt-1">{errors.employeeId}</p>}
            </div>
          </div>

          {/* Billing Information Section - Hidden for now */}
          {false && (
            <>
              <div className="card-header border-t">
                <h3 className="section-title">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                      <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM9.75 6.75a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5h-4.5zm0 3a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5h-4.5zm0 3a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5h-4.5z" clipRule="evenodd"/>
                    </svg>
                  </div>
                  Billing Information
                </h3>
              </div>
              <div className="px-6 py-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Billing Rate ($/hr)</label>
                  <input 
                    type="number" 
                    name="billingRate"
                    value={formData.billingRate}
                    onChange={handleInputChange}
                    className="input-field"
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Rate Effective Date</label>
                  <input 
                    type="date" 
                    name="rateEffectiveDate"
                    value={formData.rateEffectiveDate}
                    onChange={handleInputChange}
                    className="input-field"
                  />
                </div>
              </div>
            </>
          )}

          {/* Skills & Expertise Section - Hidden for now */}
          {false && (
            <>
              <div className="card-header border-t">
                <h3 className="section-title">
                  <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                    </svg>
                  </div>
                  Skills & Expertise
                </h3>
              </div>
              <div className="px-6 py-6 space-y-6">
                {/* Add New Skill */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Add Skills</label>
                  <div className="flex gap-2 mb-4">
                    <input
                      type="text"
                      value={newSkill}
                      onChange={(e) => setNewSkill(e.target.value)}
                      onKeyPress={handleSkillKeyPress}
                      placeholder="Enter a skill (e.g., JavaScript, Project Management)"
                      className="input-field flex-1"
                    />
                    <button
                      type="button"
                      onClick={addSkill}
                      className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-emerald-700 transition-colors"
                    >
                      Add
                    </button>
                  </div>

                  {/* Suggested Skills */}
                  <div className="mb-4">
                    <p className="text-sm text-slate-600 mb-2">Suggested skills:</p>
                    <div className="flex flex-wrap gap-2">
                      {suggestedSkills
                        .filter(skill => !formData.skills.includes(skill))
                        .slice(0, 8)
                        .map(skill => (
                        <button
                          key={skill}
                          type="button"
                          onClick={() => addSuggestedSkill(skill)}
                          className="text-sm bg-slate-100 text-slate-700 px-3 py-1 rounded-full hover:bg-emerald-100 hover:text-emerald-700 transition-colors"
                        >
                          + {skill}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Current Skills */}
                  {formData.skills.length > 0 && (
                    <div>
                      <p className="text-sm text-slate-600 mb-2">Added skills:</p>
                      <div className="flex flex-wrap gap-2">
                        {formData.skills.map((skill, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-sm font-medium"
                          >
                            {skill}
                            <button
                              type="button"
                              onClick={() => removeSkill(skill)}
                              className="text-emerald-600 hover:text-emerald-800 ml-1"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                              </svg>
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Certifications Section - Hidden for now */}
          {false && (
            <>
              <div className="card-header border-t">
                <h3 className="section-title">
                  <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 004.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 003.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/>
                    </svg>
                  </div>
                  Certifications
                </h3>
              </div>
              <div className="px-6 py-6 space-y-6">
                {/* Add New Certification */}
                <div className="bg-slate-50 rounded-xl p-4 border">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3">Add New Certification</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Certification Title</label>
                      <input
                        type="text"
                        value={newCertification.title}
                        onChange={(e) => setNewCertification(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="e.g., AWS Solutions Architect"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800 focus:border-green-800"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Issuing Organization</label>
                      <input
                        type="text"
                        value={newCertification.issuer}
                        onChange={(e) => setNewCertification(prev => ({ ...prev, issuer: e.target.value }))}
                        placeholder="e.g., Amazon Web Services"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800 focus:border-green-800"
                      />
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-slate-600 mb-1">Expiry Date (Optional)</label>
                        <input
                          type="month"
                          value={newCertification.expiry}
                          onChange={(e) => setNewCertification(prev => ({ ...prev, expiry: e.target.value }))}
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800 focus:border-green-800"
                        />
                      </div>
                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={addCertification}
                          className="bg-amber-600 text-white px-3 py-2 rounded-lg font-medium hover:bg-amber-700 transition-colors text-sm"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Current Certifications */}
                {formData.certifications.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-slate-700 mb-3">Current Certifications</h4>
                    <div className="space-y-3">
                      {formData.certifications.map((cert, index) => (
                        <div key={index} className="bg-white border border-slate-200 rounded-lg p-4 flex items-center justify-between">
                          <div className="flex-1">
                            <h5 className="font-semibold text-slate-900">{cert.title}</h5>
                            <p className="text-sm text-slate-600">Issued by {cert.issuer}</p>
                            {cert.expiry && (
                              <p className="text-xs text-slate-500 mt-1">
                                Expires: {new Date(cert.expiry).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeCertification(index)}
                            className="text-slate-400 hover:text-red-600 p-1 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Emergency Contact Section - Hidden for now */}
          {false && (
            <>
              <div className="card-header border-t">
                <h3 className="section-title">
                  <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                      <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd"/>
                    </svg>
                  </div>
                  Emergency Contact
                </h3>
              </div>
              <div className="px-6 py-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Contact Name</label>
                  <input 
                    type="text" 
                    name="emergencyContactName"
                    value={formData.emergencyContactName}
                    onChange={handleInputChange}
                    className="input-field"
                    placeholder="Emergency contact name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Relationship</label>
                  <input 
                    type="text" 
                    name="emergencyContactRelationship"
                    value={formData.emergencyContactRelationship}
                    onChange={handleInputChange}
                    className="input-field"
                    placeholder="Spouse, Parent, etc."
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Contact Phone</label>
                  <input 
                    type="tel" 
                    name="emergencyContactPhone"
                    value={formData.emergencyContactPhone}
                    onChange={handleInputChange}
                    className="input-field"
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Contact Email</label>
                  <input 
                    type="email" 
                    name="emergencyContactEmail"
                    value={formData.emergencyContactEmail}
                    onChange={handleInputChange}
                    className="input-field"
                    placeholder="contact@example.com"
                  />
                </div>
              </div>
            </>
          )}

          {/* Action Buttons */}
          <div className="px-6 py-6 bg-slate-50 rounded-b-2xl flex justify-end space-x-4 border-t border-slate-200">
            <button 
              type="button" 
              onClick={handleCancel}
              className="btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn-primary"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Saving...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z" clipRule="evenodd"/>
                  </svg>
                  Save Employee
                </>
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}

export default CreateEmployee