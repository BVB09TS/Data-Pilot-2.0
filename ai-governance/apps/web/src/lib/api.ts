import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Redirect to login on 401 — but never when already on the login page
api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401 && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ── Typed helpers ─────────────────────────────────────────────────────────────

export const connectionsApi = {
  list:   (wid: string) => api.get(`/workspaces/${wid}/connections`),
  get:    (wid: string, id: string) => api.get(`/workspaces/${wid}/connections/${id}`),
  create: (wid: string, body: Record<string, unknown>) => api.post(`/workspaces/${wid}/connections`, body),
  update: (wid: string, id: string, body: Record<string, unknown>) => api.patch(`/workspaces/${wid}/connections/${id}`, body),
  delete: (wid: string, id: string) => api.delete(`/workspaces/${wid}/connections/${id}`),
  ping:   (wid: string, id: string) => api.post(`/workspaces/${wid}/connections/${id}/ping`),
};

export const nodesApi = {
  list:   (wid: string, type?: string) => api.get(`/workspaces/${wid}/nodes`, { params: type ? { type } : {} }),
  get:    (wid: string, id: string) => api.get(`/workspaces/${wid}/nodes/${id}`),
  create: (wid: string, body: Record<string, unknown>) => api.post(`/workspaces/${wid}/nodes`, body),
  update: (wid: string, id: string, body: Record<string, unknown>) => api.patch(`/workspaces/${wid}/nodes/${id}`, body),
  delete: (wid: string, id: string) => api.delete(`/workspaces/${wid}/nodes/${id}`),
};

export const edgesApi = {
  list:   (wid: string) => api.get(`/workspaces/${wid}/edges`),
  create: (wid: string, body: Record<string, unknown>) => api.post(`/workspaces/${wid}/edges`, body),
  delete: (wid: string, id: string) => api.delete(`/workspaces/${wid}/edges/${id}`),
};

export const lineageApi = {
  graph:       (wid: string) => api.get(`/workspaces/${wid}/lineage`),
  manifest:    (wid: string) => api.get(`/workspaces/${wid}/lineage/manifest`),
  ancestors:   (wid: string, nodeId: string) => api.get(`/workspaces/${wid}/lineage/ancestors/${nodeId}`),
  descendants: (wid: string, nodeId: string) => api.get(`/workspaces/${wid}/lineage/descendants/${nodeId}`),
};

export const runsApi = {
  list:       (wid: string, params?: Record<string, unknown>) => api.get(`/workspaces/${wid}/runs`, { params }),
  get:        (wid: string, id: string) => api.get(`/workspaces/${wid}/runs/${id}`),
  create:     (wid: string, body: Record<string, unknown>) => api.post(`/workspaces/${wid}/runs`, body),
  setStatus:  (wid: string, id: string, status: string) => api.patch(`/workspaces/${wid}/runs/${id}/status`, { status }),
  getLogs:    (wid: string, id: string) => api.get(`/workspaces/${wid}/runs/${id}/logs`),
  appendLogs: (wid: string, id: string, entries: unknown[]) => api.post(`/workspaces/${wid}/runs/${id}/logs`, entries),
};

export const environmentsApi = {
  list:   (wid: string) => api.get(`/workspaces/${wid}/environments`),
  create: (wid: string, body: Record<string, unknown>) => api.post(`/workspaces/${wid}/environments`, body),
  update: (wid: string, id: string, body: Record<string, unknown>) => api.patch(`/workspaces/${wid}/environments/${id}`, body),
  delete: (wid: string, id: string) => api.delete(`/workspaces/${wid}/environments/${id}`),
};

export const policiesApi = {
  list:        (wid: string) => api.get(`/workspaces/${wid}/policies`),
  get:         (wid: string, id: string) => api.get(`/workspaces/${wid}/policies/${id}`),
  create:      (wid: string, body: Record<string, unknown>) => api.post(`/workspaces/${wid}/policies`, body),
  update:      (wid: string, id: string, body: Record<string, unknown>) => api.patch(`/workspaces/${wid}/policies/${id}`, body),
  delete:      (wid: string, id: string) => api.delete(`/workspaces/${wid}/policies/${id}`),
  evaluate:    (wid: string, id: string, body: Record<string, unknown>) => api.post(`/workspaces/${wid}/policies/${id}/evaluate`, body),
  evaluations: (wid: string, id: string) => api.get(`/workspaces/${wid}/policies/${id}/evaluations`),
};

export const auditApi = {
  list: (wid: string, params?: Record<string, unknown>) => api.get(`/workspaces/${wid}/audit`, { params }),
};
