/**
 * Quy tắc tên đăng nhập (đăng ký mới). Không áp dụng lại cho đăng nhập —
 * tài khoản cũ vẫn đăng nhập bằng đúng chuỗi đã lưu.
 */

/** Chữ thường ASCII, số và _; 3–32 ký tự. */
export const LOGIN_USERNAME_PATTERN = /^[a-z0-9_]{3,32}$/;

export const LOGIN_USERNAME_RULES_VI =
  'Tên đăng nhập: 3–32 ký tự, chỉ chữ thường a–z, số 0–9 và dấu gạch dưới (_). Không dấu tiếng Việt, không khoảng trắng.';

/**
 * @param {unknown} raw
 * @returns {{ ok: true, username: string } | { ok: false, detail: string }}
 */
export function validateNewLoginUsername(raw) {
  const username = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (!username) {
    return { ok: false, detail: 'Vui lòng nhập tên đăng nhập.' };
  }
  if (username.length < 3) {
    return { ok: false, detail: 'Tên đăng nhập cần ít nhất 3 ký tự.' };
  }
  if (username.length > 32) {
    return { ok: false, detail: 'Tên đăng nhập tối đa 32 ký tự.' };
  }
  if (!LOGIN_USERNAME_PATTERN.test(username)) {
    return { ok: false, detail: LOGIN_USERNAME_RULES_VI };
  }
  return { ok: true, username };
}
