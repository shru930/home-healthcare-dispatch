import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { BrandMark } from '../components/Sidebar.jsx';

/** Demo accounts shown as a hint. The backend decides the real role from the credentials. */
const DEMO = {
  USER: { username: 'user', password: 'user@123', label: 'Ward Staff (User)' },
  ADMIN: { username: 'admin', password: 'admin@123', label: 'Care Coordinator (Admin)' },
};

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('USER');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Enter your username and password');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await login(username.trim(), password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.status === 401 ? 'Invalid username or password' : err.message);
      setBusy(false);
    }
  };

  const tab = (value, label) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === value}
      onClick={() => { setMode(value); setError(null); }}
      className={`flex-1 rounded px-3 py-1.5 text-sm transition-colors ${mode === value ? 'bg-white font-medium text-brand-800 shadow-sm' : 'text-stone-600 hover:text-stone-900'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <BrandMark size="h-10 w-10" />
          <h1 className="mt-3 font-display text-[28px] font-semibold leading-tight text-ink">CareFlow</h1>
          <p className="text-sm text-stone-500">Home Healthcare Dispatch</p>
        </div>

        <form onSubmit={submit} noValidate className="card space-y-4 p-6">
          <div role="tablist" aria-label="Login type" className="flex gap-1 rounded-md bg-stone-100 p-1">
            {tab('USER', 'User login')}
            {tab('ADMIN', 'Admin login')}
          </div>

          <div>
            <label htmlFor="login-username" className="label">Username</label>
            <input id="login-username" className="input" autoComplete="username" placeholder={DEMO[mode].username} value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
          </div>
          <div>
            <label htmlFor="login-password" className="label">Password</label>
            <input id="login-password" type="password" className="input" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>

          {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}

          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? 'Signing in...' : 'Sign in'}
          </button>

          <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2.5 text-xs text-stone-500">
            <p className="mb-1 font-medium text-stone-600">Demo accounts</p>
            {['USER', 'ADMIN'].map((r) => (
              <p key={r} className={mode === r ? 'text-stone-800' : ''}>
                <span className="font-mono">{DEMO[r].username} / {DEMO[r].password}</span> · {DEMO[r].label}
              </p>
            ))}
          </div>
        </form>
      </div>
    </div>
  );
}
