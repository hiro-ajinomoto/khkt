import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext.jsx";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="auth-loading-screen">
        <p className="auth-loading-text">Đang tải…</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/dang-nhap" replace state={{ from: location.pathname + location.search }} />;
  }

  return children;
}
