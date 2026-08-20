import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('staff_token'));
  const [loading, setLoading] = useState(true);

  const API_URL = 'http://localhost:8080/api';
  const validRoles = ['city_health_officer', 'sanitization_inspector', 'barangay_official'];

  useEffect(() => {
    const initAuth = async () => {
      if (token) {
        try {
          const res = await fetch(`${API_URL}/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await res.json();
          if (data.success && validRoles.includes(data.user.role)) {
            setUser(data.user);
          } else {
            logout();
          }
        } catch (error) {
          console.error("Auth check failed:", error);
          logout();
        }
      }
      setLoading(false);
    };

    initAuth();
  }, [token]);

  const login = async (username, password) => {
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      
      if (data.success) {
        if (!validRoles.includes(data.user.role)) {
          return { success: false, message: 'Access denied. You are not a staff member.' };
        }
        localStorage.setItem('staff_token', data.token);
        setToken(data.token);
        setUser(data.user);
        return { success: true };
      } else {
        return { success: false, message: data.detail || 'Login failed' };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, message: 'Network error. Could not connect to server.' };
    }
  };

  const logout = () => {
    localStorage.removeItem('staff_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, API_URL }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
