import { useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useEmployees } from '../context/EmployeeContext.jsx'
import Header from '../components/Header.jsx'

const EmployeeDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { getEmployeeById, deleteEmployee } = useEmployees()
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  
  const employee = getEmployeeById(id)

  if (!employee) {
    return (
      <div className="min-h-screen bg-slate-100 font-sans">
        <Header />
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="card p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z"/>
              </svg>
            </div>
            <h1 className="text-2xl font-semibold text-slate-900 mb-4">Employee Not Found</h1>
            <p className="text-slate-600 mb-6">The employee you're looking for doesn't exist.</p>
            <Link to="/directory" className="btn-primary">
              Back to Directory
            </Link>
          </div>
        </main>
      </div>
    )
  }

  const handleDeleteClick = () => {
    setShowDeleteModal(true)
  }

  const handleDeleteConfirm = async () => {
    setIsDeleting(true)
    try {
      const result = await deleteEmployee(id)
      if (result.success) {
        setShowDeleteModal(false)
        setTimeout(() => {
          navigate('/directory', {
            state: { message: `${employee.firstName} ${employee.lastName} has been deleted successfully.` }
          })
        }, 500)
      }
    } catch (error) {
      console.error('Error deleting employee:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeleteCancel = () => {
    setShowDeleteModal(false)
  }

  const skillColors = [
    'bg-blue-100 text-blue-800',
    'bg-cyan-100 text-cyan-800',
    'bg-green-100 text-green-800',
    'bg-yellow-100 text-yellow-800',
    'bg-orange-100 text-orange-800',
    'bg-indigo-100 text-indigo-800',
    'bg-purple-100 text-purple-800',
    'bg-pink-100 text-pink-800'
  ]

  const certificationColors = [
    'bg-emerald-600',
    'bg-blue-600',
    'bg-purple-600'
  ]

  return (
    <div className="min-h-screen bg-slate-100 font-sans">
      <Header />
      
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <div className="mb-6 animate-fade-in">
          <Link 
            to="/directory"
            className="text-slate-500 hover:text-slate-700 flex items-center gap-2 text-sm transition-colors font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/>
            </svg>
            Back to Directory
          </Link>
        </div>

        {/* Employee Profile Header */}
        <div className="card p-8 mb-8 animate-slide-in">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-6">
              {/* Avatar */}
              <div className="avatar avatar-lg bg-blue-600">
                <span>{employee.avatar}</span>
              </div>
              
              {/* Employee Info */}
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold text-slate-900">
                  {employee.firstName} {employee.lastName}
                </h1>
                <p className="text-xl text-slate-600 font-medium">{employee.title}</p>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-slate-500 font-medium">ID: {employee.id}</span>
                </div>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <Link 
                to={`/employee/${id}/edit`}
                className="group bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-xl transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl"
                title="Edit Employee"
              >
                <svg className="w-5 h-5 group-hover:rotate-12 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                </svg>
              </Link>
              
              <button 
                onClick={handleDeleteClick}
                className="group bg-red-600 hover:bg-red-700 text-white p-3 rounded-xl transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl"
                title="Delete Employee"
              >
                  <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                  </svg>
                </button>
            </div>
          </div>
        </div>

        {/* Grid Layout for Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Contact Information */}
          <div className="card p-6 animate-slide-in">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                </svg>
              </div>
              <h2 className="section-title">Contact Information</h2>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                <span className="text-slate-600 text-sm font-medium">Email</span>
                <span className="text-slate-900 font-semibold">{employee.email}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                <span className="text-slate-600 text-sm font-medium">Phone</span>
                <span className="text-slate-900 font-semibold">{employee.phone}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                <span className="text-slate-600 text-sm font-medium">Location</span>
                <span className="text-slate-900 font-semibold">{employee.location}</span>
              </div>
              {employee.address && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-slate-400 rounded-full mt-2"></div>
                  <span className="text-slate-600 text-sm font-medium">Address</span>
                  <span className="text-slate-900 font-semibold">{employee.address}</span>
                </div>
              )}
            </div>
          </div>

          {/* Job Details */}
          <div className="card p-6 animate-slide-in">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2"/>
                </svg>
              </div>
              <h2 className="section-title">Job Details</h2>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                <span className="text-slate-600 text-sm font-medium">Department</span>
                <span className="text-slate-900 font-semibold">{employee.department}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                <span className="text-slate-600 text-sm font-medium">Manager</span>
                <span className="text-blue-600 hover:text-blue-700 font-semibold cursor-pointer">
                  {employee.manager}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                <span className="text-slate-600 text-sm font-medium">Hire Date</span>
                <span className="text-slate-900 font-semibold">
                  {new Date(employee.hireDate).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </span>
              </div>
              {employee.employmentType && (
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                  <span className="text-slate-600 text-sm font-medium">Employment Type</span>
                  <span className="text-slate-900 font-semibold">{employee.employmentType}</span>
                </div>
              )}
              {employee.salary && (
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                  <span className="text-slate-600 text-sm font-medium">Salary</span>
                  <span className="text-slate-900 font-semibold">{employee.salary}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Skills Section */}
        {employee.skills && employee.skills.length > 0 && (
          <div className="card p-6 mb-8 animate-slide-in">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                </svg>
              </div>
              <h2 className="section-title">Skills & Expertise</h2>
            </div>
            
            <div className="flex flex-wrap gap-3">
              {employee.skills.map((skill, index) => (
                <span 
                  key={index}
                  className={`skill-tag ${skillColors[index % skillColors.length]}`}
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Certifications Section */}
        {employee.certifications && employee.certifications.length > 0 && (
          <div className="card p-6 mb-8 animate-slide-in">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 004.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 003.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 713.138-3.138z"/>
                </svg>
              </div>
              <h2 className="section-title">Certifications</h2>
            </div>
            
            <div className="space-y-4">
              {employee.certifications.map((cert, index) => (
                <div key={index} className="group bg-slate-50 border border-slate-200 rounded-xl p-4 hover:shadow-md transition-all duration-300">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 ${certificationColors[index % certificationColors.length]} rounded-xl flex items-center justify-center`}>
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900">{cert.title}</h3>
                        <p className="text-sm text-slate-600 font-medium">{cert.issuer}</p>
                      </div>
                    </div>
                    {cert.expiry && (
                      <span className="text-sm text-slate-500 font-semibold">{cert.expiry}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Direct Reports Section */}
        {employee.directReports && employee.directReports.length > 0 && (
          <div className="card p-6 animate-slide-in">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
                </svg>
              </div>
              <h2 className="section-title">Team</h2>
            </div>
            
            <div>
              <p className="text-slate-600 mb-4 text-sm font-medium">
                Direct Reports ({employee.directReports.length})
              </p>
              <div className="space-y-3">
                {employee.directReports.map((report, index) => (
                  <div key={index} className="flex items-center gap-4 p-3 bg-slate-50 border border-slate-200 rounded-xl hover:shadow-md transition-all duration-300 group">
                    <div className={`avatar avatar-sm bg-${['green', 'pink', 'orange'][index % 3]}-600`}>
                      <span>{report.avatar}</span>
                    </div>
                    <div className="flex-1">
                      <Link 
                        to={`/employee/${report.id}`}
                        className="text-slate-900 font-semibold hover:text-blue-600 transition-colors group-hover:text-blue-600"
                      >
                        {report.name}
                      </Link>
                      <p className="text-sm text-slate-600 font-medium">{report.title}</p>
                    </div>
                    <svg className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
                    </svg>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-md w-full p-6 animate-scale-in">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z"/>
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Delete Employee</h3>
              <p className="text-slate-600 mb-4">
                Are you sure you want to delete <span className="font-semibold text-slate-900">{employee.firstName} {employee.lastName}</span>?
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-6">
                <p className="text-sm text-red-800 font-medium">
                  This action cannot be undone. The employee will be permanently removed from the system.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleDeleteCancel}
                disabled={isDeleting}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="bg-red-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2 flex-1 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:transform-none"
              >
                {isDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Deleting...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                    Delete Employee
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default EmployeeDetail