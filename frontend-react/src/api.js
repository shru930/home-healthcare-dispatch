/**
 * Single REST client for the Spring Boot backend. All paths are relative (/api/...) so the same
 * build works behind the Vite dev proxy and behind nginx in Docker.
 * Errors are thrown as ApiError carrying the server's `message` and `details[]`.
 */
export class ApiError extends Error {
  constructor(message, { status = 0, details = [], path = '' } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
    this.path = path;
  }
}

function formatMessage(body, status, statusText) {
  const base = (body && body.message) || (body && body.error) || statusText || `HTTP ${status}`;
  const details = Array.isArray(body?.details) ? body.details.filter(Boolean) : [];
  return details.length ? `${base}: ${details.join('; ')}` : base;
}

export async function request(path, { method = 'GET', body, query } = {}) {
  let url = path;
  if (query) {
    const qs = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.append(k, v);
    });
    const s = qs.toString();
    if (s) url += (url.includes('?') ? '&' : '?') + s;
  }
  const init = { method, headers: { Accept: 'application/json' } };
  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(url, init);
  } catch (e) {
    throw new ApiError(`Cannot reach the backend (${e.message || 'network error'})`, { status: 0, path: url });
  }

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    const obj = data && typeof data === 'object' ? data : { message: typeof data === 'string' && data ? data : undefined };
    throw new ApiError(formatMessage(obj, res.status, res.statusText), {
      status: res.status,
      details: Array.isArray(obj.details) ? obj.details : [],
      path: obj.path || url,
    });
  }
  return data;
}

const get = (p, query) => request(p, { query });
const post = (p, body) => request(p, { method: 'POST', body: body ?? {} });
const patch = (p, body) => request(p, { method: 'PATCH', body });

export const api = {
  dashboard: () => get('/api/dashboard'),
  workflows: () => get('/api/workflows'),
  workflowStatus: (key) => get(`/api/workflows/${encodeURIComponent(key)}/status`),

  patients: () => get('/api/patients'),
  patient: (id) => get(`/api/patients/${id}`),
  registerPatient: (body) => post('/api/patients', body),
  discharge: (id, body) => post(`/api/patients/${id}/discharge`, body),

  nurses: () => get('/api/nurses'),
  setNurseAvailability: (id, available) => patch(`/api/nurses/${id}/availability`, { available }),
  assignments: () => get('/api/nurses/assignments'),

  visits: (carePlanId) => get('/api/visits', { carePlanId }),
  assessments: () => get('/api/assessments'),

  physio: () => get('/api/physio'),
  updatePhysio: (id, body) => patch(`/api/physio/${id}`, body),

  prescriptions: () => get('/api/prescriptions'),
  deliveries: () => get('/api/deliveries'),
  stock: () => get('/api/pharmacy/stock'),
  confirmDelivery: (ref) => post(`/api/deliveries/${encodeURIComponent(ref)}/confirm`),

  notifications: () => get('/api/notifications'),
  alerts: () => get('/api/alerts'),
  interventions: () => get('/api/interventions'),

  tasks: ({ assignee, candidateGroup, state, processInstanceKey } = {}) =>
    get('/api/tasks', { assignee, candidateGroup, state, processInstanceKey }),
  task: (key) => get(`/api/tasks/${key}`),
  claimTask: (key, assignee) => post(`/api/tasks/${key}/claim`, { assignee }),
  completeTask: (key, variables, actingUser) => post(`/api/tasks/${key}/complete`, { variables, actingUser }),

  faults: () => get('/api/demo/faults'),
  setFault: (fault, mode) => post('/api/demo/faults', { fault, mode }),
  resetFaults: () => post('/api/demo/faults/reset'),
};

export default api;
