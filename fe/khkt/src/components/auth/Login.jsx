import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import OceanShell from '../layout/OceanShell';
import './AuthPage.css';

function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.username || !formData.password) {
      setError('Vui lòng nhập đầy đủ thông tin');
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await login(formData.username, formData.password);

      if (result.success) {
        const authUser = JSON.parse(localStorage.getItem('khkt_auth_user') || '{}');

        if (authUser.role === 'admin') {
          navigate('/admin', { replace: true });
        } else {
          navigate('/assignments', { replace: true });
        }
      } else {
        setError(result.error || 'Đăng nhập thất bại');
      }
    } catch (err) {
      setError(err.message || 'Đăng nhập thất bại. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <OceanShell centered contentClassName="!max-w-none">
      <div className="auth-page-card w-full max-w-md rounded-[28px] border border-cyan-300/15 bg-slate-900/80 shadow-2xl shadow-cyan-950/40 ring-1 ring-white/10 backdrop-blur-xl">
        <div className="auth-page-header">
          <img src="/logo.png" alt="Logo trường" className="logo-auth" />
          <p className="school-name">TRƯỜNG THCS TÂN THÀNH - ĐỒNG NAI</p>
          <h1>Đăng nhập</h1>
          <p>Hệ thống chấm bài Toán tự động</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="username">Tên đăng nhập</label>
            <input
              id="username"
              type="text"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              placeholder="Nhập tên đăng nhập"
              required
              disabled={isSubmitting}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Mật khẩu</label>
            <input
              id="password"
              type="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="Nhập mật khẩu"
              required
              disabled={isSubmitting}
            />
          </div>

          {error ? <div className="error-message">{error}</div> : null}

          <button type="submit" className="submit-button" disabled={isSubmitting}>
            {isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>

        <div className="auth-footer">
          <p className="help-text">
            Chưa có tài khoản?{' '}
            <Link to="/register" className="link-text">
              Đăng ký ngay
            </Link>
          </p>
        </div>
      </div>
    </OceanShell>
  );
}

export default Login;
