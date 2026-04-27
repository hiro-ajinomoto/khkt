import { createContext, useContext, useState, useEffect } from 'react';
import { login as loginAPI, getCurrentUser } from '../api/auth';
import { getAuthErrorMessage } from '../utils/authErrors';

const AuthContext = createContext(null);

const TOKEN_KEY = 'khkt_auth_token';
const USER_KEY = 'khkt_auth_user';

function emitAuthChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('khkt-auth-changed'));
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    emitAuthChanged();
  };

  // Load auth state from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedUser = localStorage.getItem(USER_KEY);

    if (storedToken && storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        setToken(storedToken);
        setUser(userData);
        
        // Verify token is still valid by fetching current user
        getCurrentUser(storedToken)
          .then((currentUser) => {
            setUser(currentUser);
            localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
            emitAuthChanged();
          })
          .catch((error) => {
            // Token invalid or network error, clear auth
            console.error('Error verifying token:', error);
            logout();
          })
          .finally(() => {
            setLoading(false);
          });
      } catch (error) {
        console.error('Error loading auth state:', error);
        logout();
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  // Khi tab/cửa sổ khác cùng origin đổi `localStorage` (ví dụ vừa đăng ký HS ở tab 2),
  // `getAuthHeader()` ở tab này đã trỏ tài khoản mới nhưng state React còn cũ → API lệch quyền.
  // Đồng bộ lại từ localStorage; sự kiện `storage` không chạy ở tab gây thay đổi.
  useEffect(() => {
    function onStorageEvent(e) {
      if (e.key !== TOKEN_KEY && e.key !== USER_KEY) return;
      if (e.newValue == null) {
        setToken(null);
        setUser(null);
        emitAuthChanged();
        return;
      }
      const t = localStorage.getItem(TOKEN_KEY);
      const u = localStorage.getItem(USER_KEY);
      if (t && u) {
        try {
          setToken(t);
          setUser(JSON.parse(u));
          emitAuthChanged();
        } catch {
          /* ignore */
        }
      }
    }
    window.addEventListener('storage', onStorageEvent);
    return () => window.removeEventListener('storage', onStorageEvent);
  }, []);

  const setAuthSession = (newToken, userData) => {
    setToken(newToken);
    setUser(userData);
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    emitAuthChanged();
  };

  const login = async (username, password) => {
    try {
      const response = await loginAPI(username, password);
      const { token: newToken, user: userData } = response;

      setAuthSession(newToken, userData);

      return { success: true };
    } catch (error) {
      return { success: false, error: getAuthErrorMessage(error) };
    }
  };

  const isAuthenticated = !!token && !!user;
  const isAdmin = user?.role === 'admin';
  const isTeacher = user?.role === 'teacher' || user?.role === 'admin';
  const isStudent = user?.role === 'student';

  const value = {
    user,
    token,
    login,
    setAuthSession,
    logout,
    isAuthenticated,
    isAdmin,
    isTeacher,
    isStudent,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
