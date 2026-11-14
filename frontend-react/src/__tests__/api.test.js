import api, { request, ApiError } from '../api.js';

function mockFetch(status, body, { raw = false } = {}) {
  const text = raw ? body : body === undefined ? '' : JSON.stringify(body);
  const fn = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    text: () => Promise.resolve(text),
  });
  globalThis.fetch = fn;
  return fn;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('api client', () => {
  it('returns parsed JSON on success and uses relative /api paths', async () => {
    const f = mockFetch(200, [{ id: 1 }]);
    await expect(api.nurses()).resolves.toEqual([{ id: 1 }]);
    expect(f).toHaveBeenCalledWith('/api/nurses', expect.objectContaining({ method: 'GET' }));
  });

  it('throws ApiError with the server message and details', async () => {
    mockFetch(400, {
      timestamp: '2026-11-14T10:00:00Z',
      status: 400,
      error: 'Bad Request',
      message: 'Validation failed',
      path: '/api/patients',
      details: ['phone: must be 10 digits', 'mrn: must not be blank'],
    });
    const err = await api.registerPatient({}).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(400);
    expect(err.message).toBe('Validation failed: phone: must be 10 digits; mrn: must not be blank');
    expect(err.details).toHaveLength(2);
    expect(err.path).toBe('/api/patients');
  });

  it('uses the message alone when details are empty', async () => {
    mockFetch(409, { status: 409, error: 'Conflict', message: 'Task 1 is not open any more', details: [] });
    await expect(api.completeTask(1, {}, 'x')).rejects.toThrow(/^Task 1 is not open any more$/);
  });

  it('falls back to status text for non-JSON error bodies', async () => {
    mockFetch(502, '<html>Bad gateway</html>', { raw: true });
    await expect(api.dashboard()).rejects.toThrow('<html>Bad gateway</html>');
    mockFetch(503, undefined);
    await expect(api.dashboard()).rejects.toThrow('Error');
  });

  it('wraps network failures', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const err = await api.dashboard().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(0);
    expect(err.message).toMatch(/Cannot reach the backend/);
  });

  it('sends JSON bodies and skips empty query params', async () => {
    const f = mockFetch(200, {});
    await api.tasks({ assignee: 'nurse.priya', candidateGroup: '' });
    expect(f.mock.calls[0][0]).toBe('/api/tasks?assignee=nurse.priya');
    await api.completeTask('42', { visitStatus: 'COMPLETED' }, 'nurse.priya');
    const [url, init] = f.mock.calls[1];
    expect(url).toBe('/api/tasks/42/complete');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({ variables: { visitStatus: 'COMPLETED' }, actingUser: 'nurse.priya' });
  });

  it('handles empty success bodies', async () => {
    mockFetch(200, undefined);
    await expect(request('/api/x')).resolves.toBeNull();
  });
});
