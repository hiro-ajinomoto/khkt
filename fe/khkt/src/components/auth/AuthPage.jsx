import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { login as loginAPI, register as registerAPI } from '../../api/auth';
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

    if (!loginData.username || !loginData.password) {
      setError('Vui lòng nhập đầy đủ thông tin');
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await login(loginData.username, loginData.password);

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
        setError(result.error || 'Đăng nhập thất bại');
      }
    } catch (err) {
      setError(err.message || 'Đăng nhập thất bại. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!registerData.username || !registerData.password || !registerData.confirmPassword) {
      setError('Vui lòng nhập đầy đủ thông tin');
      return;
    }

    if (registerData.password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }

    if (registerData.password !== registerData.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }

    try {
      setIsSubmitting(true);
      // Register as student by default
      const result = await registerAPI(
        registerData.username,
        registerData.password,
        'student',
        registerData.name || registerData.username,
        registerData.class_name || null
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
      setError(err.message || 'Đăng ký thất bại. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page-container">
      <div className="auth-page-card">
        <div className="auth-page-header">
          <img src="/logo.png" alt="Logo trường" className="logo-auth" />
          <p className="school-name">TRƯỜNG THCS TÂN THÀNH - ĐỒNG NAI</p>
          <h1>Hệ thống chấm bài Toán tự động</h1>
          <p>Đăng nhập hoặc đăng ký để tiếp tục</p>
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

        {error && <div className="error-message">{error}</div>}

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
                placeholder="Nhập tên đăng nhập"
                required
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
                required
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
                placeholder="Nhập tên đăng nhập"
                required
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

            <div className="form-group" style={{ display: 'block', visibility: 'visible' }}>
              <label htmlFor="register-class" style={{ display: 'block' }}>Lớp (tùy chọn)</label>
              <select
                id="register-class"
                name="class_name"
                value={registerData.class_name || ''}
                onChange={handleRegisterChange}
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
              <label htmlFor="register-password">Mật khẩu</label>
              <input
                id="register-password"
                type="password"
                name="password"
                value={registerData.password}
                onChange={handleRegisterChange}
                placeholder="Nhập mật khẩu (tối thiểu 6 ký tự)"
                required
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
                required
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
    </div>
  );
}

export default AuthPage;
