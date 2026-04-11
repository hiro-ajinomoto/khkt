import { Link } from 'react-router-dom';
import OceanShell from '../layout/OceanShell';
import './ErrorPages.css';

/**
 * Trang 404 — đường dẫn không tồn tại.
 */
export default function NotFoundPage() {
  return (
    <OceanShell centered contentClassName="!max-w-none">
      <div className="error-page-card">
        <p className="error-page-code" aria-hidden>
          404
        </p>
        <h1 className="error-page-title">Không tìm thấy trang</h1>
        <p className="error-page-desc">
          Địa chỉ bạn mở không tồn tại hoặc đã được đổi. Kiểm tra lại đường link
          hoặc quay về trang chủ.
        </p>
        <div className="error-page-actions">
          <Link to="/" className="error-page-btn error-page-btn--primary">
            Về trang chủ
          </Link>
          <Link to="/assignments" className="error-page-btn error-page-btn--ghost">
            Danh sách bài tập
          </Link>
        </div>
      </div>
    </OceanShell>
  );
}
