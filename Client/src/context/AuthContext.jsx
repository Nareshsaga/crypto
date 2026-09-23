import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

/**
 * Reads a session from localStorage and validates it before trusting it:
 * the JWT payload must decode to an object, and its `exp` claim (server signs
 * with expiresIn: 24h) must be in the future. Any malformed, corrupt or
 * expired material is treated as no session and cleared.
 */
function readValidSession() {
  try {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (!token || !userData) return null;

    const payload = JSON.parse(
      atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))
    );
    if (!payload || typeof payload !== 'object') return null;
    if (typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now()) {
      return null; // expired
    }

    return { token, user: JSON.parse(userData) };
  } catch {
    return null; // unparseable token or corrupt user data
  }
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = readValidSession();

    if (session) {
      setIsAuthenticated(true);
      setUser(session.user);
    } else {
      // no session, or the stored one is garbage/expired → clear it so the
      // route guard sends the visitor to /login instead of rendering a
      // "logged-in" shell around failing API calls.
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    setLoading(false);
  }, []);

  const login = (token, userData) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setIsAuthenticated(true);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setUser(null);
  };

  const value = {
    isAuthenticated,
    user,
    login,
    logout,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};