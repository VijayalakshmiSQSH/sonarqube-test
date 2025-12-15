import { useState, useEffect, useCallback } from 'react'
import { useEmployees } from '../context/EmployeeContext.jsx'
import Header from '../components/Header.jsx'
import EmployeeDirectory from './EmployeeDirectory.jsx'
import { getCookie } from '../utils/helpers.js'
import { TOKEN, getApiBaseUrl } from '../utils/constants.js'

const Dashboard = () => {
  const { getStats, getAllEmployees } = useEmployees()
  
  const stats = getStats()
  const allEmployees = getAllEmployees()
  
  // State for allocation data
  const [projects, setProjects] = useState([])
  const [weeklyAllocations, setWeeklyAllocations] = useState([])
  const [allocationLoading, setAllocationLoading] = useState(false)
  const [allocationError, setAllocationError] = useState(null)

  // Fetch allocation data
  const fetchAllocationData = useCallback(async () => {
    const token = getCookie(TOKEN)
    if (!token) {
      setAllocationError('Authentication token not found')
      return
    }

    try {
      setAllocationLoading(true)
      setAllocationError(null)
      
      const baseUrl = getApiBaseUrl()
      
      // Fetch projects and allocations
      const [projectsResponse, allocationsResponse] = await Promise.all([
        fetch(`${baseUrl}/api/projects`, {
          headers: { 
            'Authorization': `Bearer ${token}`, 
            'Content-Type': 'application/json' 
          }
        }),
        fetch(`${baseUrl}/api/allocations`, {
          headers: { 
            'Authorization': `Bearer ${token}`, 
            'Content-Type': 'application/json' 
          }
        })
      ])
      
      if (projectsResponse.ok) {
        const projectsData = await projectsResponse.json()
        setProjects(projectsData.projects || [])
      }
      
      if (allocationsResponse.ok) {
        const allocationsData = await allocationsResponse.json()
        setWeeklyAllocations(allocationsData.allocations || [])
      }
      
    } catch (err) {
      console.error('Error fetching allocation data:', err)
      setAllocationError('Failed to load allocation data')
    } finally {
      setAllocationLoading(false)
    }
  }, [])

  // Fetch data on mount
  useEffect(() => {
    fetchAllocationData()
  }, [fetchAllocationData])



  return (
    <div className="min-h-screen bg-slate-100 font-sans">
      <Header />
      
      <main className="w-[97%] mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Clean Welcome Section */}
        <div className="mb-4 animate-fade-in">
          <h1 className="page-title text-xl">Employee Directory</h1>
          <p className="page-subtitle">Manage your organization's workforce efficiently</p>
        </div>



        {/* Employee Directory Section */}
        <div className="animate-slide-in">
          <EmployeeDirectory 
            embedded={true} 
            projects={projects}
            weeklyAllocations={weeklyAllocations}
            allocationLoading={allocationLoading}
            allocationError={allocationError}
          />
        </div>
      </main>

    </div>
  )
}

export default Dashboard