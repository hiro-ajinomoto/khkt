import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { register as registerAPI } from '../../api/auth';
import { fetchSchoolClasses } from '../../api/classes';
import { getAuthErrorMessage } from '../../utils/authErrors';
import OceanShell from '../layout/OceanShell';
import './AuthPage.css';

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
  const [schoolClasses, setSchoolClasses] = useState([]);

  useEffect(() => {
    let cancelled = false;
    fetchSchoolClasses()
      .then((list) => {
        if (!cancelled) setSchoolClasses(list);
      })
      .catch(() => {
        if (!cancelled) setSchoolClasses([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

    const username = formData.username.trim();
    if (!username) {
      setError('Vui lòng nhập tên đăng nhập.');
      return;
    }
    if (!formData.password || !formData.confirmPassword) {
      setError('Vui lòng nhập mật khẩu và xác nhận mật khẩu.');
      return;
    }
    if (!formData.password.trim()) {
      setError('Mật khẩu không được chỉ gồm khoảng trắng.');
      return;
    }

    if (formData.password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }

    try {
      setIsSubmitting(true);
      // Register as student by default
      const result = await registerAPI(
        username,
        formData.password,
        'student',
        formData.name?.trim() || username,
        formData.class_name?.trim() || null
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
      setError(getAuthErrorMessage(err));
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
          <h1>Đăng ký</h1>
          <p>Tạo tài khoản mới</p>
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
              onBlur={(e) => {
                const t = e.target.value.trim();
                if (t !== e.target.value) {
                  setFormData((prev) => ({ ...prev, username: t }));
                }
              }}
              placeholder="Nhập tên đăng nhập"
              autoComplete="username"
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
            >
              <option value="">Chọn lớp (tùy chọn)</option>
              {schoolClasses.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <p className="field-hint">
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
              autoComplete="new-password"
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
              autoComplete="new-password"
              disabled={isSubmitting}
            />
          </div>

          {error ? (
            <div
              className="error-message auth-error-banner"
              role="alert"
              aria-live="polite"
            >
              {error}
            </div>
          ) : null}

          <button type="submit" className="submit-button" disabled={isSubmitting}>
            {isSubmitting ? 'Đang đăng ký...' : 'Đăng ký'}
          </button>
        </form>

        <div className="auth-footer">
          <p className="help-text">
            Đã có tài khoản?{' '}
            <Link to="/login" className="link-text">
              Đăng nhập ngay
            </Link>
          </p>
          <p className="help-text help-text-register-note">
            Tài khoản mới sẽ được tạo với quyền học sinh. Để trở thành giáo viên, vui lòng liên hệ quản trị viên.
          </p>
        </div>
      </div>
    </OceanShell>
  );
}

export default Register;
