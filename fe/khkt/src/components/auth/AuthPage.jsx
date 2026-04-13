import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { register as registerAPI } from '../../api/auth';
import { fetchSchoolClasses } from '../../api/classes';
import { getAuthErrorMessage, normalizeLoginPayload } from '../../utils/authErrors';
import OceanShell from '../layout/OceanShell';
import './AuthPage.css';

function AuthPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [activeTab, setActiveTab] = useState('login'); // 'login' or 'register'
  
  const [loginData, setLoginData] = useState({
    username: '',
    password: '',
  });
  
  const [registerData, setRegisterData] = useState({
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

  useEffect(() => {
    if (activeTab === 'register') {
      console.log('Register tab active, class_name:', registerData.class_name);
    }
  }, [activeTab, registerData.class_name]);

  const handleLoginChange = (e) => {
    const { name, value } = e.target;
    setLoginData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError(null);
  };

  const handleRegisterChange = (e) => {
    const { name, value } = e.target;
    console.log('Register field changed:', name, value);
    setRegisterData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError(null);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);

    const check = normalizeLoginPayload(loginData);
    if (!check.ok) {
      setError(check.message);
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await login(check.username, check.password);

      if (result.success) {
        // Get user role from auth context
        const authUser = JSON.parse(localStorage.getItem('khkt_auth_user') || '{}');
        
        // Redirect based on role
        if (authUser.role === 'admin') {
          navigate('/admin', { replace: true });
        } else {
          // Teacher and student go to assignments list
          navigate('/assignments', { replace: true });
        }
      } else {
        setError(result.error || 'Đăng nhập thất bại. Vui lòng thử lại.');
      }
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError(null);

    const username = registerData.username.trim();
    if (!username) {
      setError('Vui lòng nhập tên đăng nhập.');
      return;
    }
    if (!registerData.password || !registerData.confirmPassword) {
      setError('Vui lòng nhập mật khẩu và xác nhận mật khẩu.');
      return;
    }
    if (!registerData.password.trim()) {
      setError('Mật khẩu không được chỉ gồm khoảng trắng.');
      return;
    }

    if (registerData.password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự.');
      return;
    }

    if (registerData.password !== registerData.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }

    try {
      setIsSubmitting(true);
      // Register as student by default
      const result = await registerAPI(
        username,
        registerData.password,
        'student',
        registerData.name?.trim() || username,
        registerData.class_name?.trim() || null
      );

      if (result.token && result.user) {
        // Store auth data
        localStorage.setItem('khkt_auth_token', result.token);
        localStorage.setItem('khkt_auth_user', JSON.stringify(result.user));

        // Redirect to assignments list
        navigate('/assignments', { replace: true });
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
          {activeTab === 'login' ? (
            <>
              <h1>Đăng nhập</h1>
              <p>Hệ thống chấm bài Toán tự động</p>
            </>
          ) : (
            <>
              <h1>Đăng ký</h1>
              <p>Tạo tài khoản học sinh</p>
            </>
          )}
        </div>

        <div className="auth-tabs">
          <button
            className={`tab-button ${activeTab === 'login' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('login');
              setError(null);
            }}
          >
            Đăng nhập
          </button>
          <button
            className={`tab-button ${activeTab === 'register' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('register');
              setError(null);
            }}
          >
            Đăng ký
          </button>
        </div>

        {error && (
          <div
            className="error-message auth-error-banner"
            role="alert"
            aria-live="polite"
          >
            {error}
          </div>
        )}

        {activeTab === 'login' ? (
          <form onSubmit={handleLogin} className="auth-form">
            <div className="form-group">
              <label htmlFor="login-username">Tên đăng nhập</label>
              <input
                id="login-username"
                type="text"
                name="username"
                value={loginData.username}
                onChange={handleLoginChange}
                onBlur={(e) => {
                  const t = e.target.value.trim();
                  if (t !== e.target.value) {
                    setLoginData((prev) => ({ ...prev, username: t }));
                  }
                }}
                placeholder="Nhập tên đăng nhập"
                autoComplete="username"
                disabled={isSubmitting}
                autoFocus
              />
            </div>

            <div className="form-group">
              <label htmlFor="login-password">Mật khẩu</label>
              <input
                id="login-password"
                type="password"
                name="password"
                value={loginData.password}
                onChange={handleLoginChange}
                placeholder="Nhập mật khẩu"
                autoComplete="current-password"
                disabled={isSubmitting}
              />
            </div>

            <button
              type="submit"
              className="submit-button"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="auth-form">
            <div className="form-group">
              <label htmlFor="register-username">Tên đăng nhập</label>
              <input
                id="register-username"
                type="text"
                name="username"
                value={registerData.username}
                onChange={handleRegisterChange}
                onBlur={(e) => {
                  const t = e.target.value.trim();
                  if (t !== e.target.value) {
                    setRegisterData((prev) => ({ ...prev, username: t }));
                  }
                }}
                placeholder="Nhập tên đăng nhập"
                autoComplete="username"
                disabled={isSubmitting}
                autoFocus
              />
            </div>

            <div className="form-group">
              <label htmlFor="register-name">Họ và tên (tùy chọn)</label>
              <input
                id="register-name"
                type="text"
                name="name"
                value={registerData.name}
                onChange={handleRegisterChange}
                placeholder="Nhập họ và tên"
                disabled={isSubmitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="register-class">Lớp (tùy chọn)</label>
              <select
                id="register-class"
                name="class_name"
                value={registerData.class_name || ''}
                onChange={handleRegisterChange}
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
              <label htmlFor="register-password">Mật khẩu</label>
              <input
                id="register-password"
                type="password"
                name="password"
                value={registerData.password}
                onChange={handleRegisterChange}
                placeholder="Nhập mật khẩu (tối thiểu 6 ký tự)"
                autoComplete="new-password"
                disabled={isSubmitting}
                minLength={6}
              />
            </div>

            <div className="form-group">
              <label htmlFor="register-confirm-password">Xác nhận mật khẩu</label>
              <input
                id="register-confirm-password"
                type="password"
                name="confirmPassword"
                value={registerData.confirmPassword}
                onChange={handleRegisterChange}
                placeholder="Nhập lại mật khẩu"
                autoComplete="new-password"
                disabled={isSubmitting}
              />
            </div>

            <button
              type="submit"
              className="submit-button"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Đang đăng ký...' : 'Đăng ký'}
            </button>
          </form>
        )}

        <div className="auth-footer">
          <p className="help-text">
            {activeTab === 'login' 
              ? 'Chưa có tài khoản? Click tab "Đăng ký" để tạo tài khoản mới.'
              : 'Đã có tài khoản? Click tab "Đăng nhập" để đăng nhập.'}
          </p>
          {activeTab === 'register' && (
            <p className="help-text-small">
              Tài khoản mới sẽ được tạo với quyền học sinh. Để trở thành giáo viên, vui lòng liên hệ quản trị viên.
            </p>
          )}
        </div>
      </div>
    </OceanShell>
  );
}

export default AuthPage;
