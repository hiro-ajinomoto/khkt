import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch, getStoredToken, setStoredToken } from "./apiClient.js";

/** @typedef {{ id: string; username: string }} AuthUser */

const AuthContext = createContext(
  /** @type {{ user: AuthUser | null; loading: boolean; login: (u: string, p: string) => Promise<void>; register: (u: string, p: string) => Promise<void>; logout: () => void; refreshUser: () => Promise<void> } | null} */ (
    null
  ),
);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(/** @type {AuthUser | null} */ (null));
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const t = getStoredToken();
    if (!t) {
      setUser(null);
      return;
    }
    const r = await apiFetch("/api/auth/me");
    if (!r.ok) {
      setStoredToken(null);
      setUser(null);
      return;
    }
    const data = await r.json();
    if (data?.user?.id && data?.user?.username) {
      setUser({ id: String(data.user.id), username: String(data.user.username) });
    } else {
      setStoredToken(null);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refreshUser();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshUser]);

  const login = useCallback(async (username, password) => {
    setStoredToken(null);
    const r = await apiFetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = typeof j.message === "string" ? j.message : "Đăng nhập thất bại.";
      throw new Error(msg);
    }
    if (!j.token || !j.user?.id) throw new Error("Phản hồi không hợp lệ.");
    setStoredToken(j.token);
    setUser({ id: String(j.user.id), username: String(j.user.username) });
  }, []);

  const register = useCallback(async (username, password) => {
    setStoredToken(null);
    const r = await apiFetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = typeof j.message === "string" ? j.message : j.error === "username_taken" ? "Tên đăng nhập đã được dùng." : "Đăng ký thất bại.";
      throw new Error(msg);
    }
    if (!j.token || !j.user?.id) throw new Error("Phản hồi không hợp lệ.");
    setStoredToken(j.token);
    setUser({ id: String(j.user.id), username: String(j.user.username) });
  }, []);

  const logout = useCallback(() => {
    setStoredToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refreshUser }),
    [user, loading, login, register, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
