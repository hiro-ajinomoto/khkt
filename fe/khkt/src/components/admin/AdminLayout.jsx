import { NavLink, Outlet, useMatch, useNavigate } from 'react-router-dom';
import OceanShell, { OceanPageLoading } from '../layout/OceanShell';
import BackToTopButton from '../layout/BackToTopButton';
import OceanListPageHeader from '../layout/OceanListPageHeader';
import ThemeToggle from '../layout/ThemeToggle';
import { useTheme } from '../../contexts/ThemeContext';
import { getAssignmentsNavIcon } from '../layout/assignmentsNavIcon';
import { useAdminWorkspace } from './AdminWorkspaceContext';
import './AdminDashboard.css';

function subnavClass({ isActive }) {
  return `admin-subnav-link${isActive ? ' admin-subnav-link--active' : ''}`;
}

export default function AdminLayout() {
  const navigate = useNavigate();
  const adminHomeMatch = useMatch({ path: '/admin', end: true });
  const { loading, error, loadData, logout, user } = useAdminWorkspace();
  const isAdmin = user?.role === 'admin';
  const { theme } = useTheme();
  const assignmentsIcon = getAssignmentsNavIcon(theme);

  if (loading) {
    return <OceanPageLoading message="Đang tải bảng quản trị..." />;
  }

  const isAdminSubRoute = !adminHomeMatch;

  return (
    <OceanShell>
      <div className="admin-dashboard">
        <div
          className={
            isAdminSubRoute
              ? 'admin-layout-ocean-header admin-layout-ocean-header--subroute-desktop'
              : 'admin-layout-ocean-header'
          }
        >
          <OceanListPageHeader
            user={user}
            isAuthenticated
            isAdmin={isAdmin}
            variant="adminHome"
            navigate={navigate}
            logout={logout}
          />
        </div>
        {isAdminSubRoute && (
          <div className="admin-header admin-header--compact admin-layout-compact-header--subroute-mobile">
            <div className="admin-header-compact-avatar" aria-hidden>
              <span className="admin-header-compact-avatar-letter">
                {user?.name?.[0] || user?.username?.[0] || 'ST'}
              </span>
            </div>
            <div className="header-actions">
              <button
                type="button"
                onClick={() => navigate('/assignments')}
                className="nav-button nav-button--icon-only"
                aria-label="Bài tập"
                title="Bài tập"
              >
                {assignmentsIcon}
              </button>
              <ThemeToggle className="admin-header-compact-theme-toggle" />
              <button
                type="button"
                onClick={logout}
                className="logout-button logout-button--icon-only"
                aria-label="Đăng xuất"
                title="Đăng xuất"
              >
                <svg
                  className="admin-logout-svg"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        <nav className="admin-subnav" aria-label="Khu vực quản lý người dùng">
          <NavLink to="/admin" end className={subnavClass}>
            Tổng quan
          </NavLink>
          <NavLink to="/admin/users/teachers" className={subnavClass}>
            Giáo viên
          </NavLink>
          <NavLink to="/admin/users/students" className={subnavClass}>
            Học sinh
          </NavLink>
          <NavLink to="/admin/sticker-redeem" className={subnavClass}>
            Đổi quà sticker
          </NavLink>
        </nav>

        {error && (
          <div className="error-message">
            {error}
            <button type="button" onClick={loadData} className="retry-button">
              Thử lại
            </button>
          </div>
        )}

        <Outlet />
      </div>
      <BackToTopButton />
    </OceanShell>
  );
}
