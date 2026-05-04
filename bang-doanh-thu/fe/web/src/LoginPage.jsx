import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext.jsx";
import "./authPages.css";

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = typeof location.state?.from === "string" ? location.state.from : "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate(from, { replace: true });
    }
  }, [loading, user, from, navigate]);

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
    setBusy(true);
    try {
      await login(username.trim(), password);
      navigate(from, { replace: true });
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Lỗi đăng nhập.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <p className="ocean-page-eyebrow auth-eyebrow">Bảng doanh thu</p>
        <h1 className="auth-title">Đăng nhập</h1>
        <form className="auth-form" onSubmit={onSubmit}>
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
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              required
            />
          </label>
          {err ? (
            <p className="auth-msg auth-msg--err" role="alert">
              {err}
            </p>
          ) : null}
          <button type="submit" className="auth-submit" disabled={busy}>
            {busy ? "Đang đăng nhập…" : "Đăng nhập"}
          </button>
        </form>
        <p className="auth-footer">
          Chưa có tài khoản? <Link to="/dang-ky">Đăng ký</Link>
        </p>
      </div>
    </div>
  );
}
