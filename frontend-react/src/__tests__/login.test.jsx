import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../auth.jsx';
import Login from '../pages/Login.jsx';
import { getSession } from '../session.js';

function mockFetch(status, body) {
  const fn = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Unauthorized',
    text: () => Promise.resolve(JSON.stringify(body)),
  });
  globalThis.fetch = fn;
  return fn;
}

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<p>Dashboard home</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

function signIn(username, password) {
  fireEvent.change(screen.getByLabelText('Username'), { target: { value: username } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('Login page', () => {
  it('renders the title, both login tabs and the demo account hint', () => {
    renderLogin();
    expect(screen.getByRole('heading', { name: 'CareFlow' })).toBeInTheDocument();
    expect(screen.getByText('Home Healthcare Dispatch')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'User login' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: 'Admin login' }));
    expect(screen.getByRole('tab', { name: 'Admin login' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText(/admin \/ admin@123/)).toBeInTheDocument();
    expect(screen.getByText(/user \/ user@123/)).toBeInTheDocument();
  });

  it('shows the error on 401 and stays logged out', async () => {
    const f = mockFetch(401, { status: 401, message: 'Invalid username or password' });
    renderLogin();
    signIn('admin', 'wrong');
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid username or password');
    expect(f).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({ method: 'POST' }));
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ username: 'admin', password: 'wrong' });
    expect(getSession()).toBeNull();
    expect(screen.queryByText('Dashboard home')).not.toBeInTheDocument();
  });

  it('stores the session and goes to the dashboard on success', async () => {
    mockFetch(200, { token: 'tok-1', username: 'user', displayName: 'Ward Staff (User)', role: 'USER' });
    renderLogin();
    signIn('user', 'user@123');
    expect(await screen.findByText('Dashboard home')).toBeInTheDocument();
    expect(getSession()).toEqual({ token: 'tok-1', username: 'user', displayName: 'Ward Staff (User)', role: 'USER' });
  });
});
