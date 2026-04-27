import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import AssignmentsList from './components/assignments/AssignmentsList'
import CreateAssignmentForm from './components/assignments/CreateAssignmentForm'
import EditAssignmentForm from './components/assignments/EditAssignmentForm'
import AssignmentDetail from './components/assignments/AssignmentDetail'
import AuthPage from './components/auth/AuthPage'
import Login from './components/auth/Login'
import Register from './components/auth/Register'
import AdminApp from './components/admin/AdminApp'
import MySubmissions from './components/submissions/MySubmissions'
import StickerRedeem from './components/submissions/StickerRedeem'
import TeacherSubmissionsList from './components/submissions/TeacherSubmissionsList'
import TeacherSubmissionReview from './components/submissions/TeacherSubmissionReview'
import TeacherClassCodesPage from './components/teacher/TeacherClassCodesPage'
import ProtectedRoute from './components/auth/ProtectedRoute'
import { OceanPageLoading } from './components/layout/OceanShell'
import StudentStickerDock from './components/submissions/StudentStickerDock'
import AppErrorBoundary from './components/errors/AppErrorBoundary'
import NotFoundPage from './components/errors/NotFoundPage'
import ServerErrorPage from './components/errors/ServerErrorPage'
import './App.css'

function AppRoutes() {
  const { isAuthenticated, isAdmin, loading } = useAuth();

  if (loading) {
    return <OceanPageLoading message="Đang tải..." />;
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
        path="/admin/*"
        element={
          <ProtectedRoute requiredRole="admin">
            <AdminApp />
          </ProtectedRoute>
        }
      />
      <Route
        path="/assignments"
        element={
          <ProtectedRoute>
            <AssignmentsList />
          </ProtectedRoute>
        }
      />
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
      <Route
        path="/assignments/:id"
        element={
          <ProtectedRoute>
            <AssignmentDetail />
          </ProtectedRoute>
        }
      />
      <Route 
        path="/my-submissions" 
        element={
          <ProtectedRoute requiredRole="student">
            <MySubmissions />
          </ProtectedRoute>
        } 
      />
      <Route
        path="/teacher/submissions"
        element={
          <ProtectedRoute requiredRole="teacher">
            <TeacherSubmissionsList />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/submissions/:id"
        element={
          <ProtectedRoute requiredRole="teacher">
            <TeacherSubmissionReview />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/class-codes"
        element={
          <ProtectedRoute requiredRole="teacher">
            <TeacherClassCodesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sticker-rewards"
        element={
          <ProtectedRoute requiredRole="student">
            <StickerRedeem />
          </ProtectedRoute>
        }
      />
      <Route path="/500" element={<ServerErrorPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

function AppShell() {
  const location = useLocation();
  const hideFooter =
    location.pathname === '/login' ||
    location.pathname === '/register' ||
    location.pathname === '/500';

  const hideStudentStickerDock =
    location.pathname === '/login' ||
    location.pathname === '/register' ||
    location.pathname === '/500' ||
    location.pathname.startsWith('/admin');

  return (
    <div className="app">
      {!hideStudentStickerDock ? <StudentStickerDock /> : null}
      <AppRoutes />
      {!hideFooter ? (
        <footer className="app-footer">
          <p className="footer-school-name">TRƯỜNG THCS TÂN THÀNH - ĐỒNG NAI</p>
          <p className="footer-standard">TRƯỜNG CHUẨN QUỐC GIA</p>
          <p className="footer-address">Ấp Tân Phú, xã Tân Tiến, Tỉnh Đồng Nai</p>
          <p className="footer-phone">Điện thoại liên hệ: 0363267637</p>
        </footer>
      ) : null}
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppErrorBoundary>
        <AppShell />
      </AppErrorBoundary>
    </BrowserRouter>
  )
}

export default App
