import { Component } from 'react';
import OceanShell from '../layout/OceanShell';
import './ErrorPages.css';

/**
 * Bắt lỗi render React — hiển thị UI thân thiện thay vì màn hình trắng.
 */
export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('AppErrorBoundary:', error, info);
  }

  render() {
    const { error } = this.state;
    const { children } = this.props;

    if (error) {
      const msg =
        error?.message && String(error.message).trim()
          ? String(error.message)
          : 'Lỗi không xác định.';

      return (
        <OceanShell centered contentClassName="!max-w-none">
          <div className="error-page-card">
            <p className="error-page-code" aria-hidden>
              !
            </p>
            <h1 className="error-page-title">Ứng dụng gặp lỗi</h1>
            <p className="error-page-desc">
              Đã xảy ra lỗi khi hiển thị trang. Thử tải lại hoặc quay về trang
              chủ.
            </p>
            <div className="error-page-detail" role="status">
              {msg}
            </div>
            <div className="error-page-actions">
              <button
                type="button"
                className="error-page-btn error-page-btn--primary"
                onClick={() => window.location.reload()}
              >
                Tải lại trang
              </button>
              <a href="/" className="error-page-btn error-page-btn--ghost">
                Về trang chủ
              </a>
            </div>
          </div>
        </OceanShell>
      );
    }

    return children;
  }
}
