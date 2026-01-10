import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './Login.css';

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get redirect path from location state or default to home
  const from = location.state?.from?.pathname || '/';

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
        // Get user role from auth context
        const authUser = JSON.parse(localStorage.getItem('khkt_auth_user') || '{}');
        
        // Redirect based on role
        if (authUser.role === 'admin') {
          navigate('/admin', { replace: true });
        } else if (authUser.role === 'teacher') {
          // Teacher goes to assignments list
          navigate('/', { replace: true });
        } else {
          // Student goes to assignments list
          navigate('/', { replace: true });
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
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>Đăng nhập</h1>
          <p>Hệ thống chấm bài Toán tự động</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
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

          {error && <div className="error-message">{error}</div>}

          <button
            type="submit"
            className="login-button"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>

        <div className="login-footer">
          <p className="help-text">
            Chưa có tài khoản?{' '}
            <Link to="/register" className="link-text">
              Đăng ký ngay
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
