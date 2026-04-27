/**
 * Cùng quy tắc với be/src/utils/loginUsername.js (đăng ký).
 */

export const LOGIN_USERNAME_RULES_VI =
  'Tên đăng nhập: 3–32 ký tự, chỉ chữ thường a–z, số 0–9 và dấu gạch dưới (_). Không dấu tiếng Việt, không khoảng trắng.';

const LOGIN_USERNAME_PATTERN = /^[a-z0-9_]{3,32}$/;

/** Gõ tên đăng nhập: chỉ giữ a-z, 0-9, _; chữ thường; tối đa 32 ký tự. */
export function sanitizeLoginUsernameInput(raw) {
  return String(raw ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 32);
}

/**
 * @returns {{ ok: true, username: string } | { ok: false, detail: string }}
 */
export function validateLoginUsernameClient(username) {
  const u = String(username ?? '').trim();
  if (!u) {
    return { ok: false, detail: 'Vui lòng nhập tên đăng nhập.' };
  }
  if (u.length < 3) {
    return { ok: false, detail: 'Tên đăng nhập cần ít nhất 3 ký tự.' };
  }
  if (u.length > 32) {
    return { ok: false, detail: 'Tên đăng nhập tối đa 32 ký tự.' };
  }
  if (!LOGIN_USERNAME_PATTERN.test(u)) {
    return { ok: false, detail: LOGIN_USERNAME_RULES_VI };
  }
  return { ok: true, username: u };
}
