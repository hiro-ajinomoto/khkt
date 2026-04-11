import { Link, useLocation } from 'react-router-dom';
import OceanShell from '../layout/OceanShell';
import './ErrorPages.css';

/**
 * Trang lỗi máy chủ / 500 — có thể truy cập trực tiếp hoặc từ ErrorBoundary.
 */
export default function ServerErrorPage() {
  const location = useLocation();
  const state = location.state;
  const detail =
    (typeof state?.message === 'string' && state.message) ||
    (typeof state?.detail === 'string' && state.detail) ||
    null;

  return (
    <OceanShell centered contentClassName="!max-w-none">
      <div className="error-page-card">
        <p className="error-page-code" aria-hidden>
          500
        </p>
        <h1 className="error-page-title">Đã xảy ra lỗi</h1>
        <p className="error-page-desc">
          Hệ thống gặp sự cố tạm thời. Bạn có thể tải lại trang hoặc quay lại sau
          vài phút. Nếu lỗi lặp lại, vui lòng báo quản trị viên.
        </p>
        {detail ? (
          <div className="error-page-detail" role="status">
            {detail}
          </div>
        ) : null}
        <div className="error-page-actions">
          <button
            type="button"
            className="error-page-btn error-page-btn--primary"
            onClick={() => window.location.reload()}
          >
            Tải lại trang
          </button>
          <Link to="/" className="error-page-btn error-page-btn--ghost">
            Về trang chủ
          </Link>
        </div>
      </div>
    </OceanShell>
  );
}
