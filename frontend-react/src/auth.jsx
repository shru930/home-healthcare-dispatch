import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import api, { setUnauthorizedHandler } from './api.js';
import { getSession, setSession, clearSession } from './session.js';
import { Spinner, EmptyState } from './components/Feedback.jsx';

/**
 * Login state for the whole app.
 *   user  = { token, username, displayName, role } or null
 *   login(username, password), logout(), isAdmin
 * On start, a stored token is checked once with GET /api/auth/me.
 */
const AuthContext = createContext({ user: null, checking: false, isAdmin: false, login: async () => {}, logout: async () => {} });

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(getSession);
  const [checking, setChecking] = useState(() => !!getSession());

  // Any 401 from the api client: forget the user and go to the login page.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      navigate('/login', { replace: true });
    });
    return () => setUnauthorizedHandler(null);
  }, [navigate]);

  // Validate a stored token once on start. A 401 is handled by the handler above;
  // a network error keeps the stored session (the backend may just be restarting).
  useEffect(() => {
    const stored = getSession();
    if (!stored) return;
    let alive = true;
    api
      .me()
      .then((me) => {
        if (!alive || !me) return;
        const next = { ...stored, ...me, token: stored.token };
        setSession(next);
        setUser(next);
      })
      .catch(() => {})
      .finally(() => alive && setChecking(false));
    return () => {
      alive = false;
    };
  }, []);

  const login = useCallback(async (username, password) => {
    const res = await api.login(username, password);
    const session = { token: res.token, username: res.username, displayName: res.displayName, role: res.role };
    setSession(session);
    setUser(session);
    return session;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      /* clear locally even if the server call fails */
    }
    clearSession();
    setUser(null);
    navigate('/login', { replace: true });
  }, [navigate]);

  const value = useMemo(() => ({ user, checking, isAdmin: user?.role === 'ADMIN', login, logout }), [user, checking, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

/** Route guard: renders children only when logged in, otherwise redirects to /login. */
export function RequireAuth({ children }) {
  const { user, checking } = useAuth();
  const location = useLocation();
  if (checking) return <Spinner label="Checking session..." className="justify-center py-20" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

/** Admin-only page guard: USER sees a short message instead of the page. */
export function RequireAdmin({ children }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) {
    return <EmptyState title="Admin access required">This page is only available to the care coordinator (admin) account.</EmptyState>;
  }
  return children;
}
