import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext.jsx";
import "./authPages.css";

export default function RegisterPage() {
  const { register, user, loading } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [registrationCode, setRegistrationCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate("/", { replace: true });
    }
  }, [loading, user, navigate]);

  if (loading) {
    return (
      <div className="auth-loading-screen">
        <p className="auth-loading-text">Đang tải…</p>
      </div>
    );
  }

  if (user) return null;

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    if (password !== password2) {
      setErr("Hai lần nhập mật khẩu không khớp.");
      return;
    }
    const code = registrationCode.trim();
    if (!code) {
      setErr("Nhập mã đăng ký (do quản trị cấp).");
      return;
    }
    setBusy(true);
    try {
      await register(username.trim(), password, code);
      navigate("/", { replace: true });
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Đăng ký thất bại.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <p className="ocean-page-eyebrow auth-eyebrow">Bảng doanh thu</p>
        <h1 className="auth-title">Đăng ký</h1>
        <p className="auth-lead">
          Cần <strong>mã đăng ký</strong> do quản trị cấp. Tên 3–32 ký tự (chữ, số, . _ -). Mật khẩu ít nhất 8 ký tự.
        </p>
        <form className="auth-form" onSubmit={onSubmit}>
          <label className="auth-field">
            <span>Mã đăng ký</span>
            <input
              type="password"
              name="registrationCode"
              autoComplete="off"
              value={registrationCode}
              onChange={(e) => setRegistrationCode(e.target.value)}
              disabled={busy}
              required
              maxLength={200}
            />
          </label>
          <label className="auth-field">
            <span>Tên đăng nhập</span>
            <input
              type="text"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={busy}
              required
            />
          </label>
          <label className="auth-field">
            <span>Mật khẩu</span>
            <input
              type="password"
              name="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              required
              minLength={8}
            />
          </label>
          <label className="auth-field">
            <span>Nhập lại mật khẩu</span>
            <input
              type="password"
              name="password2"
              autoComplete="new-password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              disabled={busy}
              required
              minLength={8}
            />
          </label>
          {err ? (
            <p className="auth-msg auth-msg--err" role="alert">
              {err}
            </p>
          ) : null}
          <button type="submit" className="auth-submit" disabled={busy}>
            {busy ? "Đang tạo tài khoản…" : "Tạo tài khoản"}
          </button>
        </form>
        <p className="auth-footer">
          Đã có tài khoản? <Link to="/dang-nhap">Đăng nhập</Link>
        </p>
      </div>
    </div>
  );
}
