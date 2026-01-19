import { createContext, useContext, useState, useEffect } from 'react';
import { login as loginAPI, getCurrentUser } from '../api/auth';

const AuthContext = createContext(null);

const TOKEN_KEY = 'khkt_auth_token';
const USER_KEY = 'khkt_auth_user';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
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

  const login = async (username, password) => {
    try {
      const response = await loginAPI(username, password);
      const { token: newToken, user: userData } = response;

      setToken(newToken);
      setUser(userData);
      localStorage.setItem(TOKEN_KEY, newToken);
      localStorage.setItem(USER_KEY, JSON.stringify(userData));

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
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
