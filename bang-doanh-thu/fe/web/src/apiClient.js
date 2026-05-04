const TOKEN_KEY = "bdt_auth_token";

export function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Gọi API kèm Bearer token nếu đã đăng nhập.
 * @param {RequestInfo | URL} input
 * @param {RequestInit} [init]
 */
export function apiFetch(input, init = {}) {
  const headers = new Headers(init.headers || undefined);
  const t = getStoredToken();
  if (t && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${t}`);
  }
  return fetch(input, { ...init, headers });
}
