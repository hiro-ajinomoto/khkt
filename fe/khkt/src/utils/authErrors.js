/**
 * Chuẩn hóa `detail` từ API (Express string hoặc mảng validation kiểu FastAPI).
 */
export function parseApiDetail(detail) {
  if (detail == null || detail === '') return '';
  if (typeof detail === 'string') return detail.trim();
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (item == null) return '';
        if (typeof item === 'string') return item;
        if (typeof item === 'object' && item.msg != null) return String(item.msg);
        return String(item);
      })
      .filter(Boolean)
      .join(' ');
  }
  if (typeof detail === 'object' && detail.msg != null) return String(detail.msg);
  return String(detail);
}

const PATTERNS_VI = [
  [/invalid username or password/i, 'Sai tên đăng nhập hoặc mật khẩu.'],
  [/username and password are required/i, 'Vui lòng nhập tên đăng nhập và mật khẩu.'],
  [/username already exists/i, 'Tên đăng nhập đã được sử dụng.'],
  [/registration failed/i, 'Đăng ký thất bại. Vui lòng thử lại.'],
  [/user not found/i, 'Không tìm thấy tài khoản.'],
  [/failed to get user/i, 'Không tải được thông tin tài khoản.'],
  [/login failed/i, 'Đăng nhập thất bại.'],
  [/unauthorized/i, 'Phiên đăng nhập không hợp lệ.'],
];

/**
 * Đổi thông báo tiếng Anh từ API sang tiếng Việt (nếu khớp). Giữ nguyên chuỗi đã là tiếng Việt.
 */
export function toVietnameseAuthMessage(raw) {
  const s = typeof raw === 'string' ? raw.trim() : parseApiDetail(raw);
  if (!s) return 'Đã xảy ra lỗi. Vui lòng thử lại.';
  for (const [re, vi] of PATTERNS_VI) {
    if (re.test(s)) return vi;
  }
  return s;
}

/**
 * Thông báo hiển thị cho người dùng sau lỗi đăng nhập / gọi API auth.
 */
/**
 * Kiểm tra trước khi gọi API đăng nhập: trim tên đăng nhập, không gửi mật khẩu chỉ khoảng trắng.
 */
export function normalizeLoginPayload({ username, password }) {
  const u = String(username ?? '').trim();
  const p = password != null ? String(password) : '';
  if (!u) {
    return { ok: false, message: 'Vui lòng nhập tên đăng nhập.' };
  }
  if (!p) {
    return { ok: false, message: 'Vui lòng nhập mật khẩu.' };
  }
  if (!p.trim()) {
    return {
      ok: false,
      message: 'Mật khẩu không được chỉ gồm khoảng trắng.',
    };
  }
  return { ok: true, username: u, password: p };
}

export function getAuthErrorMessage(error) {
  if (!error) return 'Đã xảy ra lỗi. Vui lòng thử lại.';
  const msg = error.message != null ? String(error.message) : String(error);

  if (
    msg === 'Failed to fetch' ||
    /networkerror|load failed|fetch/i.test(msg) ||
    /failed to fetch/i.test(msg)
  ) {
    return 'Không kết nối được máy chủ. Kiểm tra mạng hoặc thử lại sau.';
  }

  return toVietnameseAuthMessage(msg);
}
