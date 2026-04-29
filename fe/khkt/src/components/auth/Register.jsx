import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { register as registerAPI } from '../../api/auth';
import { useAuth } from '../../contexts/AuthContext';
import { getAuthErrorMessage } from '../../utils/authErrors';
import {
  LOGIN_USERNAME_RULES_VI,
  sanitizeLoginUsernameInput,
  validateLoginUsernameClient,
} from '../../utils/loginUsername';
import OceanShell from '../layout/OceanShell';
import './AuthPage.css';

function digitsOnly4(value) {
  return String(value ?? '')
    .replace(/\D/g, '')
    .slice(0, 4);
}

function sanitizeTeacherInviteInput(value) {
  return String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10);
}

function Register() {
  const navigate = useNavigate();
  const { setAuthSession } = useAuth();

  const [registrationKind, setRegistrationKind] = useState('student');
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    name: '',
    class_code: '',
    teacher_invite_code: '',
  });
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let next = value;
    if (name === 'class_code') next = digitsOnly4(value);
    else if (name === 'username') next = sanitizeLoginUsernameInput(value);
    else if (name === 'teacher_invite_code') next = sanitizeTeacherInviteInput(value);
    setFormData((prev) => ({
      ...prev,
      [name]: next,
    }));
    setError(null);
  };

  const handleRegistrationKindChange = (kind) => {
    setRegistrationKind(kind);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const userCheck = validateLoginUsernameClient(formData.username);
    if (!userCheck.ok) {
      setError(userCheck.detail);
      return;
    }
    const username = userCheck.username;
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
    const code = digitsOnly4(formData.class_code);
    const teacherCode = sanitizeTeacherInviteInput(formData.teacher_invite_code);

    if (registrationKind === 'student') {
      if (code.length !== 4) {
        setError('Nhập đủ mã lớp 4 chữ số do giáo viên cung cấp.');
        return;
      }
    } else if (teacherCode.length !== 10) {
      setError('Nhập đủ mã đăng ký giáo viên (10 ký tự do quản trị cấp).');
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await registerAPI({
        username,
        password: formData.password,
        name: formData.name?.trim() || username,
        class_code: registrationKind === 'student' ? code : null,
        teacher_invite_code: registrationKind === 'teacher' ? teacherCode : null,
      });

      if (result.token && result.user) {
        setAuthSession(result.token, result.user);

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
          <div className="form-group register-role-field">
            <span className="register-role-label-text">Bạn đăng ký với tư cách</span>
            <div className="register-role-options">
              <label>
                <input
                  type="radio"
                  name="registration_kind"
                  value="student"
                  checked={registrationKind === 'student'}
                  onChange={() => handleRegistrationKindChange('student')}
                  disabled={isSubmitting}
                />
                Học sinh
              </label>
              <label>
                <input
                  type="radio"
                  name="registration_kind"
                  value="teacher"
                  checked={registrationKind === 'teacher'}
                  onChange={() => handleRegistrationKindChange('teacher')}
                  disabled={isSubmitting}
                />
                Giáo viên
              </label>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="username">Tên đăng nhập</label>
            <input
              id="username"
              type="text"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              placeholder="Ví dụ: hocsinh_nguyenvana"
              autoComplete="username"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              disabled={isSubmitting}
              autoFocus
              className="font-mono"
            />
            <p className="field-hint">{LOGIN_USERNAME_RULES_VI}</p>
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

          {registrationKind === 'student' ? (
            <div className="form-group">
              <label htmlFor="class_code">Mã lớp (4 số)</label>
              <input
                id="class_code"
                type="text"
                name="class_code"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                maxLength={4}
                value={formData.class_code}
                onChange={handleInputChange}
                placeholder="Ví dụ: 4829"
                disabled={isSubmitting}
                className="font-mono tracking-[0.35em]"
                required
              />
              <p className="field-hint">
                Giáo viên chủ nhiệm hoặc quản trị cung cấp mã để vào đúng lớp. Nếu lớp đổi mã, chỉ học sinh
                mới đăng ký cần mã mới.
              </p>
            </div>
          ) : (
            <div className="form-group">
              <label htmlFor="teacher_invite_code">Mã đăng ký giáo viên</label>
              <input
                id="teacher_invite_code"
                type="text"
                name="teacher_invite_code"
                autoComplete="off"
                maxLength={10}
                value={formData.teacher_invite_code}
                onChange={handleInputChange}
                placeholder="10 ký tự do quản trị cấp"
                disabled={isSubmitting}
                className="font-mono tracking-[0.2em] uppercase"
                required
              />
              <p className="field-hint">
                Quản trị tạo mã ở mục Quản trị → Giáo viên. Mã không thay thế mã lớp; sau khi đăng ký, quản
                trị gán lớp ở mục &quot;GV — lớp&quot;.
              </p>
            </div>
          )}

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
            Học sinh cần mã lớp 4 số. Giáo viên cần mã do quản trị phát (trang Quản trị → Giáo viên).
          </p>
        </div>
      </div>
    </OceanShell>
  );
}

export default Register;
