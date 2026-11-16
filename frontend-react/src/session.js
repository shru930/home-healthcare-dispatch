/**
 * The logged-in session ({ token, username, displayName, role }) kept in localStorage.
 * Storage access is wrapped in try/catch so the app still works when storage is blocked.
 */
const KEY = 'hh.session';

export function getSession() {
  try {
    const raw = localStorage.getItem(KEY);
    const s = raw ? JSON.parse(raw) : null;
    return s && s.token ? s : null;
  } catch {
    return null;
  }
}

export function setSession(session) {
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    /* storage unavailable: session lasts until reload */
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}

export function getToken() {
  return getSession()?.token || null;
}

/** Headers to add to any /api request made outside the api client. */
export function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
