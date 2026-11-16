import api, { setUnauthorizedHandler } from '../api.js';
import { getSession, setSession } from '../session.js';

function mockFetch(status, body) {
  const fn = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: 'x',
    text: () => Promise.resolve(body === undefined ? '' : JSON.stringify(body)),
  });
  globalThis.fetch = fn;
  return fn;
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  setUnauthorizedHandler(null);
  vi.restoreAllMocks();
});

describe('api client auth', () => {
  it('attaches the bearer token when logged in', async () => {
    setSession({ token: 'abc.def', username: 'admin', displayName: 'Admin', role: 'ADMIN' });
    const f = mockFetch(200, []);
    await api.tasks();
    expect(f.mock.calls[0][1].headers.Authorization).toBe('Bearer abc.def');
  });

  it('sends no Authorization header when logged out', async () => {
    const f = mockFetch(200, []);
    await api.nurses();
    expect(f.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it('clears the session and calls the unauthorized handler on 401', async () => {
    setSession({ token: 'expired', username: 'user', role: 'USER' });
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    mockFetch(401, { message: 'Unauthorized' });
    await expect(api.dashboard()).rejects.toMatchObject({ status: 401 });
    expect(getSession()).toBeNull();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not redirect for a failed login call', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    mockFetch(401, { message: 'Invalid username or password' });
    await expect(api.login('admin', 'nope')).rejects.toThrow('Invalid username or password');
    expect(handler).not.toHaveBeenCalled();
  });

  it('keeps the session on 403 and surfaces the server message', async () => {
    setSession({ token: 't', username: 'user', role: 'USER' });
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    mockFetch(403, { message: 'Only admins can change faults' });
    await expect(api.setFault('SMS_GATEWAY', 'DOWN')).rejects.toThrow('Only admins can change faults');
    expect(getSession()).not.toBeNull();
    expect(handler).not.toHaveBeenCalled();
  });
});
