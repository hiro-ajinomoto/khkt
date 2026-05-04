import { Link, useLocation, useNavigate } from "react-router-dom";
import HeaderUserBox from "./HeaderUserBox.jsx";

/**
 * Thanh điều hướng dùng chung — cùng thứ tự / pill trên mọi trang để bố cục không nhảy khi đổi tab.
 * Trên bảng doanh thu truyền `onQuickRegisterClick` để mở popup tại chỗ; các trang khác sẽ về `/` với `?quickRegister=1`.
 * @param {{ onQuickRegisterClick?: () => void }} props
 */
export default function MainNavBar({ onQuickRegisterClick }) {
  const loc = useLocation();
  const navigate = useNavigate();

  const openQuickRegister = () => {
    if (onQuickRegisterClick) {
      onQuickRegisterClick();
      return;
    }
    navigate("/?quickRegister=1");
  };

  return (
    <nav className="header-nav-links" aria-label="Điều hướng">
      <span className="header-nav-primary-group">
        <Link
          to="/"
          className="header-nav-link header-nav-link--primary"
          aria-current={loc.pathname === "/" ? "page" : undefined}
        >
          Bảng doanh thu
        </Link>
        <Link
          to="/thanh-vien"
          className="header-nav-link header-nav-link--primary"
          aria-current={loc.pathname.startsWith("/thanh-vien") ? "page" : undefined}
        >
          Trả nợ
        </Link>
      </span>
      <span className="header-nav-secondary-group">
        <Link
          to="/tong-hop"
          className="header-nav-link header-nav-link--btn header-nav-link--secondary"
          aria-current={loc.pathname === "/tong-hop" ? "page" : undefined}
        >
          Tổng hợp kỳ
        </Link>
        <button
          type="button"
          className="header-nav-link header-nav-link--btn header-nav-link--secondary"
          onClick={openQuickRegister}
        >
          Đăng ký nhanh
        </button>
      </span>
      <HeaderUserBox />
    </nav>
  );
}
