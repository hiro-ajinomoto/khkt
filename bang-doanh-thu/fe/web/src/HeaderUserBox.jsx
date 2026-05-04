import { useAuth } from "./AuthContext.jsx";

/** Một ô: tên + đăng xuất (gọn, cùng viền). */
export default function HeaderUserBox() {
  const { user, logout } = useAuth();
  if (!user?.username) return null;
  return (
    <div className="header-user-box" title={`${user.username} — Đăng xuất`}>
      <span className="header-user-box-name">{user.username}</span>
      <button type="button" className="header-user-box-logout" onClick={() => logout()}>
        Đăng xuất
      </button>
    </div>
  );
}
