import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { AuthProvider } from './context/AuthContext.jsx'
import { EmployeeProvider } from './context/EmployeeContext.jsx'
import { PermissionProvider } from './context/PermissionContext.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'

// Pages
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import EmployeeDirectory from './pages/EmployeeDirectory.jsx'
import EmployeeDetail from './pages/EmployeeDetail.jsx'
import EmployeeProfile from './pages/EmployeeProfile.jsx'
import CreateEmployee from './pages/CreateEmployee.jsx'
import EditEmployee from './pages/EditEmployee.jsx'
import Projects from './pages/Projects.jsx'
import ProjectDetails from './pages/ProjectDetails.jsx'
import Skills from './pages/Skills.jsx'
import KRA from './pages/KRA.jsx'
import GoalsAndMilestonesStandalone from './pages/GoalsAndMilestonesStandalone.jsx'
import EmployeeTree from './pages/EmployeeTree.jsx'
import AuditLog from './pages/AuditLog.jsx'
import AdminLogin from './pages/AdminLogin.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'
import Culture from './pages/culture/Culture.jsx'

// Styles
import './styles/index.css'

function App() {
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID 

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <AuthProvider>
        <EmployeeProvider>
          <PermissionProvider>
            <Router>
            <div className="min-h-screen bg-slate-100 font-sans">
              <Routes>
                {/* Public Routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/admin/login" element={<AdminLogin />} />
                
                {/* Protected Routes */}
                <Route path="/" element={
                  <ProtectedRoute>
                    <Navigate to="/workforce" replace />
                  </ProtectedRoute>
                } />
                
                <Route path="/workforce" element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                } />
                
                <Route path="/directory" element={
                  <ProtectedRoute>
                    <EmployeeDirectory />
                  </ProtectedRoute>
                } />
                
                <Route path="/employee/:id" element={
                  <ProtectedRoute>
                    <EmployeeDetail />
                  </ProtectedRoute>
                } />
                
                <Route path="/employee-profile/:id" element={
                  <ProtectedRoute>
                    <EmployeeProfile />
                  </ProtectedRoute>
                } />
                
                <Route path="/employee/create" element={
                  <ProtectedRoute>
                    <CreateEmployee />
                  </ProtectedRoute>
                } />
                
                <Route path="/employee/:id/edit" element={
                  <ProtectedRoute>
                    <EditEmployee />
                  </ProtectedRoute>
                } />
                
                <Route path="/projects" element={
                  <ProtectedRoute>
                    <Projects />
                  </ProtectedRoute>
                } />
                
                <Route path="/project/:id" element={
                  <ProtectedRoute>
                    <ProjectDetails />
                  </ProtectedRoute>
                } />
                
                <Route path="/skills" element={
                  <ProtectedRoute>
                    <Skills />
                  </ProtectedRoute>
                } />
                
                <Route path="/kra" element={
                  <ProtectedRoute>
                    <KRA />
                  </ProtectedRoute>
                } />
                
                <Route path="/employee-tree" element={
                  <ProtectedRoute>
                    <EmployeeTree />
                  </ProtectedRoute>
                } />
                
                <Route path="/culture" element={
                  <ProtectedRoute>
                    <Culture />
                  </ProtectedRoute>
                } />
                
                <Route path="/culture/performance" element={
                  <ProtectedRoute>
                    <Culture />
                  </ProtectedRoute>
                } />
                
                <Route path="/culture/morale" element={
                  <ProtectedRoute>
                    <Culture />
                  </ProtectedRoute>
                } />
                
                <Route path="/audit-log" element={
                  <ProtectedRoute>
                    <AuditLog />
                  </ProtectedRoute>
                } />
                
                <Route path="/kra/assignment" element={
                  <ProtectedRoute>
                    <KRA />
                  </ProtectedRoute>
                } />
                
                <Route path="/kra/goals" element={
                  <ProtectedRoute>
                    <KRA />
                  </ProtectedRoute>
                } />
                
                <Route path="/kra/overall" element={
                  <ProtectedRoute>
                    <KRA />
                  </ProtectedRoute>
                } />
                
                <Route path="/goals-milestones" element={
                  <ProtectedRoute>
                    <GoalsAndMilestonesStandalone />
                  </ProtectedRoute>
                } />
                
                {/* Admin Routes */}
                <Route path="/admin/dashboard" element={<AdminDashboard />} />
                
                {/* Catch all - redirect to workforce */}
                <Route path="*" element={<Navigate to="/workforce" replace />} />
              </Routes>
            </div>
            </Router>
          </PermissionProvider>
        </EmployeeProvider>
      </AuthProvider>
    </GoogleOAuthProvider>
  )
}

export default App