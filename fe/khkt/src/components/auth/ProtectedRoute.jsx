import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

/**
 * ProtectedRoute component that requires authentication
 * @param {Object} props
 * @param {React.ReactNode} props.children - Child components to render
 * @param {string} props.requiredRole - Required role ('admin', 'teacher', or 'student'), optional
 */
function ProtectedRoute({ children, requiredRole = null }) {
  const { isAuthenticated, isAdmin, isTeacher, isStudent, loading } = useAuth();
  const location = useLocation();

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

  if (!isAuthenticated) {
    // Redirect to login page, saving the location they were trying to access
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check role if required
  if (requiredRole === 'admin' && !isAdmin) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        <h2>Không có quyền truy cập</h2>
        <p>Bạn cần quyền quản trị viên để truy cập trang này.</p>
      </div>
    );
  }

  if (requiredRole === 'teacher' && !isTeacher) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        <h2>Không có quyền truy cập</h2>
        <p>Bạn cần quyền giáo viên để truy cập trang này.</p>
      </div>
    );
  }

  if (requiredRole === 'student' && !isStudent) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        <h2>Không có quyền truy cập</h2>
        <p>Bạn cần quyền học sinh để truy cập trang này.</p>
      </div>
    );
  }

  return children;
}

export default ProtectedRoute;
