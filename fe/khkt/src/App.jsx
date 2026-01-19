import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import AssignmentsList from './components/assignments/AssignmentsList'
import CreateAssignmentForm from './components/assignments/CreateAssignmentForm'
import EditAssignmentForm from './components/assignments/EditAssignmentForm'
import AssignmentDetail from './components/assignments/AssignmentDetail'
import AuthPage from './components/auth/AuthPage'
import Login from './components/auth/Login'
import Register from './components/auth/Register'
import AdminDashboard from './components/admin/AdminDashboard'
import MySubmissions from './components/submissions/MySubmissions'
import ProtectedRoute from './components/auth/ProtectedRoute'
import './App.css'

function AppRoutes() {
  const { isAuthenticated, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh' 
      }}>
        <div>Đang tải...</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route 
        path="/" 
        element={
          isAuthenticated ? (
            isAdmin ? (
              <Navigate to="/admin" replace />
            ) : (
              <Navigate to="/assignments" replace />
            )
          ) : (
            <AuthPage />
          )
        } 
      />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route 
        path="/admin" 
        element={
          <ProtectedRoute requiredRole="admin">
            <AdminDashboard />
          </ProtectedRoute>
        } 
      />
      <Route path="/assignments" element={<AssignmentsList />} />
      <Route 
        path="/assignments/create" 
        element={
          <ProtectedRoute requiredRole="teacher">
            <CreateAssignmentForm />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/assignments/:id/edit" 
        element={
          <ProtectedRoute requiredRole="teacher">
            <EditAssignmentForm />
          </ProtectedRoute>
        } 
      />
      <Route path="/assignments/:id" element={<AssignmentDetail />} />
      <Route 
        path="/my-submissions" 
        element={
          <ProtectedRoute requiredRole="student">
            <MySubmissions />
          </ProtectedRoute>
        } 
      />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <AppRoutes />
        <footer className="app-footer">
          <p className="footer-school-name">TRƯỜNG THCS TÂN THÀNH - ĐỒNG NAI</p>
          <p className="footer-standard">TRƯỜNG CHUẨN QUỐC GIA</p>
          <p className="footer-address">Ấp Tân Phú, xã Tân Tiến, Tỉnh Đồng Nai</p>
          <p className="footer-phone">Điện thoại liên hệ: 0363267637</p>
        </footer>
      </div>
    </BrowserRouter>
  )
}

export default App
