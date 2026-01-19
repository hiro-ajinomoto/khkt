import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { register as registerAPI } from '../../api/auth';
import './Login.css';

function Register() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    name: '',
    class_name: '',
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

    // Validation
    if (!formData.username || !formData.password || !formData.confirmPassword) {
      setError('Vui lòng nhập đầy đủ thông tin');
      return;
    }

    if (formData.password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }

    try {
      setIsSubmitting(true);
      // Register as student by default
      const result = await registerAPI(
        formData.username,
        formData.password,
        'student',
        formData.name || formData.username,
        formData.class_name || null
      );

      if (result.token && result.user) {
        // Store auth data
        localStorage.setItem('khkt_auth_token', result.token);
        localStorage.setItem('khkt_auth_user', JSON.stringify(result.user));

        // Redirect based on role (though new users are always students)
        if (result.user.role === 'admin') {
          navigate('/admin', { replace: true });
        } else if (result.user.role === 'teacher') {
          navigate('/', { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      } else {
        setError('Đăng ký thất bại. Vui lòng thử lại.');
      }
    } catch (err) {
      setError(err.message || 'Đăng ký thất bại. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <img src="/logo.png" alt="Logo trường" className="logo-auth" />
          <p className="school-name">TRƯỜNG THCS TÂN THÀNH - ĐỒNG NAI</p>
          <h1>Đăng ký</h1>
          <p>Tạo tài khoản mới</p>
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
            <label htmlFor="name">Họ và tên (tùy chọn)</label>
            <input
              id="name"
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Nhập họ và tên"
              disabled={isSubmitting}
            />
          </div>

          <div className="form-group">
            <label htmlFor="class_name">Lớp (tùy chọn)</label>
            <select
              id="class_name"
              name="class_name"
              value={formData.class_name || ''}
              onChange={handleInputChange}
              disabled={isSubmitting}
              style={{ 
                display: 'block', 
                width: '100%',
                visibility: 'visible',
                opacity: 1,
                height: 'auto',
                minHeight: '40px'
              }}
            >
              <option value="">Chọn lớp (tùy chọn)</option>
              <option value="8A1">8A1</option>
              <option value="8A2">8A2</option>
              <option value="8A3">8A3</option>
              <option value="8A4">8A4</option>
              <option value="8A5">8A5</option>
            </select>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#999', fontStyle: 'italic' }}>
              * Lưu ý: Chỉ học sinh cần chọn lớp. Nếu bạn trở thành giáo viên sau này, bạn không cần lớp.
            </p>
          </div>

          <div className="form-group">
            <label htmlFor="password">Mật khẩu</label>
            <input
              id="password"
              type="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="Nhập mật khẩu (tối thiểu 6 ký tự)"
              required
              disabled={isSubmitting}
              minLength={6}
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Xác nhận mật khẩu</label>
            <input
              id="confirmPassword"
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              placeholder="Nhập lại mật khẩu"
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
            {isSubmitting ? 'Đang đăng ký...' : 'Đăng ký'}
          </button>
        </form>

        <div className="login-footer">
          <p className="help-text">
            Đã có tài khoản?{' '}
            <Link to="/login" className="link-text">
              Đăng nhập ngay
            </Link>
          </p>
          <p className="help-text" style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
            Tài khoản mới sẽ được tạo với quyền học sinh. Để trở thành giáo viên, vui lòng liên hệ quản trị viên.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Register;
