/**
 * Thông báo lỗi thân thiện (tiếng Việt) cho fetch / HTTP.
 */

const NETWORK_MESSAGE =
  'Không kết nối được máy chủ. Kiểm tra kết nối mạng, VPN hoặc thử lại sau vài phút.';

/** Lỗi mạng (không có phản hồi HTTP). */
export function isLikelyNetworkError(error) {
  if (!error) return false;
  const m = String(error.message || error);
  if (m === 'Failed to fetch') return true;
  if (/networkerror|load failed/i.test(m)) return true;
  if (/failed to fetch/i.test(m)) return true;
  return false;
}

export function getNetworkErrorMessage() {
  return NETWORK_MESSAGE;
}

/**
 * Khi không có `detail` từ API — map theo mã HTTP.
 */
export function messageForHttpStatus(status) {
  if (status === 401) {
    return 'Phiên đăng nhập hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.';
  }
  if (status === 403) {
    return 'Bạn không có quyền thực hiện thao tác này.';
  }
  if (status === 404) {
    return 'Không tìm thấy dữ liệu hoặc đường dẫn không tồn tại.';
  }
  if (status === 408 || status === 504) {
    return 'Hết thời gian chờ máy chủ. Vui lòng thử lại.';
  }
  if (status === 429) {
    return 'Quá nhiều yêu cầu. Vui lòng đợi một chút rồi thử lại.';
  }
  if (status === 502 || status === 503) {
    return 'Máy chủ tạm thời quá tải hoặc bảo trì. Vui lòng thử lại sau.';
  }
  if (status >= 500) {
    return 'Máy chủ gặp sự cố. Vui lòng thử lại sau hoặc báo quản trị viên.';
  }
  if (status >= 400) {
    return 'Yêu cầu không hợp lệ hoặc không thể xử lý.';
  }
  return 'Đã xảy ra lỗi. Vui lòng thử lại.';
}

/**
 * Chuẩn hóa `detail` từ JSON (string hoặc mảng).
 */
export function normalizeDetail(detail) {
  if (detail == null || detail === '') return '';
  if (typeof detail === 'string') return detail.trim();
  if (Array.isArray(detail)) {
    return detail
      .map((x) =>
        typeof x === 'object' && x?.msg != null ? String(x.msg) : String(x)
      )
      .filter(Boolean)
      .join(' ');
  }
  return String(detail);
}

/**
 * Thông điệp hiển thị cho người dùng sau lỗi fetch (!response.ok hoặc ném Error).
 */
export function describeApiFailure(response, body, fallbackContext) {
  const detail = normalizeDetail(body?.detail);
  if (detail) return detail;
  if (response?.status) return messageForHttpStatus(response.status);
  return fallbackContext || 'Đã xảy ra lỗi. Vui lòng thử lại.';
}

/**
 * Trong catch: nếu lỗi mạng thì trả về câu chuẩn; không đổi Error khác.
 */
export function userFacingErrorMessage(error, fallback = 'Đã xảy ra lỗi. Vui lòng thử lại.') {
  if (isLikelyNetworkError(error)) return NETWORK_MESSAGE;
  const m = error?.message;
  if (typeof m === 'string' && m.trim()) return m;
  return fallback;
}
